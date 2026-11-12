/**
 * The Pixi 3D adapter for one model drawn alone: the map's ground layers, the
 * page's pictures, the catalogue and the labs. (The town's repeated models are
 * shared copies instead; see `pool.ts`.)
 *
 * The geometry is `ink-mesh.ts`'s; the GLB is `glb.ts`'s, which keeps ordinary
 * meshes and unlit materials so the ink survives import into another renderer.
 */
import { Container3D, Mesh3D, Model3D, type FlatMaterial, type Scene3DSource } from "@pixi/3d"
import { Assets } from "pixi.js"
import type { InkAsset } from "./primitives.ts"
import { inkMesh, type InkMeshOptions, type InkPart } from "./ink-mesh.ts"
import { exportAsset } from "./glb.ts"
import { floorScale, vertex3 } from "./space.ts"
import { lineGeometry, toGeometry } from "../gpu.ts"
import { bounds } from "../mesh/geometry.ts"
import { add, type Vec3 } from "../mesh/vec3.ts"
import { partMaterial, setSurface } from "../materials.ts"
import { SmokePlume } from "../smoke-effects.ts"
import { FountainWater } from "../fountain-effects.ts"

export { exportAsset } from "./glb.ts"
export { floorScale, vertex3 } from "./space.ts"

export interface BuiltAsset {
  readonly group: Container3D
  readonly parts: ReadonlyArray<{ readonly part: InkPart; readonly mesh: Mesh3D }>
  /** Its extent in its own space, effects included: `[min, max]`. */
  readonly bounds: readonly [Vec3, Vec3]
  /** Moves its effects (smoke, fountains, a burning structure's flicker) to `time`, in seconds. */
  updateEffects: (time: number) => void
  dispose: () => void
}

export function buildAsset(asset: InkAsset, options: InkMeshOptions & { surfaceEffects?: boolean } = {}): BuiltAsset {
  const group = new Container3D({ label: asset.id })
  const effects = asset.effects && options.surfaceEffects !== false ? asset.effects : null
  const surfaces: Array<FlatMaterial> = []
  const parts = inkMesh(asset, options).map((part) => {
    const material = partMaterial(part, effects !== null)
    if (effects && part.role === "fill") {
      setSurface(material, effects.state, [effects.half * floorScale, effects.height / Math.cos(Math.PI / 6), 0.31, 1], 0)
      surfaces.push(material)
    }
    const mesh = new Mesh3D({ geometry: part.role === "line" ? lineGeometry(part.mesh.positions) : toGeometry(part.mesh), material, castShadow: false })
    group.addChild(mesh)
    return { part, mesh }
  })
  const plume = asset.smokeEffect && options.surfaceEffects !== false ? new SmokePlume() : null
  if (plume) {
    plume.group.position.set(...vertex3(asset.smokeEffect!.origin))
    group.addChild(plume.group)
    plume.update(0)
  }
  const fountains = options.surfaceEffects !== false ? (asset.fountains ?? []).map((f) => new FountainWater(f)) : []
  for (const fountain of fountains) group.addChild(fountain.group)
  const boxes: Array<readonly [Vec3, Vec3]> = parts.map(({ part }) => bounds(part.mesh))
  if (plume) {
    const at = vertex3(asset.smokeEffect!.origin)
    boxes.push([add(at, [-14, 0, -14]), add(at, [14, 42, 14])])
  }
  for (const f of asset.fountains ?? []) {
    if (options.surfaceEffects === false) break
    const at = vertex3(f.origin), r = f.radius * floorScale
    boxes.push([add(at, [-r, f.level / Math.cos(Math.PI / 6) - 1, -r]), add(at, [r, f.nozzle / Math.cos(Math.PI / 6) + 7, r])])
  }
  const extent: [Vec3, Vec3] = boxes.length
    ? [[0, 1, 2].map((k) => Math.min(...boxes.map((b) => b[0][k]!))) as [number, number, number], [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b[1][k]!))) as [number, number, number]]
    : [[0, 0, 0], [0, 0, 0]]
  return {
    group,
    parts,
    bounds: extent,
    updateEffects: (time) => {
      for (const material of surfaces) material.data.surfaceTime = time
      plume?.update(time)
      for (const fountain of fountains) fountain.update(time)
    },
    dispose: () => {
      plume?.dispose()
      for (const fountain of fountains) fountain.dispose()
      for (const { mesh } of parts) {
        const material = mesh.material
        mesh.destroy({ geometry: true })
        material.destroy()
      }
      group.removeFromParent()
      group.destroy()
    }
  }
}

/** A model exported and loaded back by Pixi 3D's own glTF loader, as another app would see the GLB. */
export async function reloadExportedAsset(asset: InkAsset): Promise<Model3D> {
  const url = URL.createObjectURL(new Blob([await exportAsset(asset)], { type: "model/gltf-binary" }))
  try {
    return new Model3D(await Assets.load<Scene3DSource>({ src: url, parser: "glb" }))
  } finally {
    URL.revokeObjectURL(url)
  }
}
