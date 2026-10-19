import * as THREE from "three"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js"
import { palette, type Face, type InkAsset, type Vertex } from "./primitives.ts"
import { installSurfaceShader } from "../surface-shader.ts"
import { SmokePlume } from "../smoke-effects.ts"
import { FountainWater } from "../fountain-effects.ts"

/** A 30° elevation and 45° heading reproduce the game's 64×32 projection.
 * The vertical conversion preserves pixel-authored building heights exactly. */
export const floorScale = 32 * Math.SQRT2
export const vertex3 = ([u, v, z]: Vertex) => new THREE.Vector3(u * floorScale, z / Math.cos(Math.PI / 6), v * floorScale)

function contourCenters(asset: InkAsset) {
  const sums = new Map<number, { point: THREE.Vector3; count: number }>()
  for (const face of asset.faces)
    if (face.contour) {
      const sum = sums.get(face.contour) ?? { point: new THREE.Vector3(), count: 0 }
      for (const p of face.points) {
        sum.point.add(vertex3(p))
        sum.count++
      }
      sums.set(face.contour, sum)
    }
  return new Map([...sums].map(([id, sum]) => [id, sum.point.divideScalar(sum.count)]))
}
function outwardPoints(face: Face, centers: Map<number, THREE.Vector3>) {
  const ps = face.points.map(vertex3)
  const normal = new THREE.Vector3().crossVectors(ps[1]!.clone().sub(ps[0]!), ps[2]!.clone().sub(ps[0]!))
  const center = ps.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(ps.length)
  if (normal.dot(center.sub(centers.get(face.contour!)!)) < 0) ps.reverse()
  return ps
}

/** Inward hulls give short curved contours a continuous ink silhouette,
 * including at high zoom where separate round-ended lines overlap. */
function silhouetteMesh(asset: InkAsset, faces: ReadonlyArray<Face>) {
  const centers = contourCenters(asset),
    normals = new Map<string, THREE.Vector3>()
  const key = (p: THREE.Vector3, contour: number) =>
    `${contour}|` +
    p
      .toArray()
      .map((n) => n.toFixed(4))
      .join(",")
  for (const face of faces) {
    const ps = outwardPoints(face, centers),
      n = new THREE.Vector3().crossVectors(ps[1]!.clone().sub(ps[0]!), ps[2]!.clone().sub(ps[0]!)).normalize()
    for (const p of ps) {
      const normal = normals.get(key(p, face.contour!)) ?? new THREE.Vector3()
      normal.add(n)
      normals.set(key(p, face.contour!), normal)
    }
  }
  const positions: Array<number> = []
  for (const face of faces) {
    const ps = outwardPoints(face, centers).map((p) =>
      p.clone().add(
        normals
          .get(key(p, face.contour!))!
          .clone()
          .normalize()
          .multiplyScalar((face.contourWidth ?? 1) * 0.5)
      )
    )
    for (let i = 1; i < ps.length - 1; i++) for (const p of [ps[0]!, ps[i + 1]!, ps[i]!]) positions.push(...p.toArray())
  }
  const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: palette.ink, side: THREE.FrontSide }))
  mesh.name = "ink-silhouette"
  return mesh
}

const materialCache = new Map<string, THREE.MeshBasicMaterial>()
function fillMaterial(color: number, opacity = 1) {
  const key = `${color}/${opacity}`
  let material = materialCache.get(key)
  if (!material) {
    material = new THREE.MeshBasicMaterial({
      color,
      opacity,
      transparent: opacity < 1,
      depthWrite: opacity >= 1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 6,
      polygonOffsetUnits: 2
    })
    materialCache.set(key, material)
  }
  return material
}
function faceMesh(points: ReadonlyArray<Vertex>, color: number, opacity = 1) {
  const coordinates = points.map(vertex3)
  const positions: Array<number> = []
  for (let i = 1; i < coordinates.length - 1; i++)
    for (const p of [coordinates[0]!, coordinates[i]!, coordinates[i + 1]!]) positions.push(...p.toArray())
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, fillMaterial(color, opacity))
  mesh.userData.structureSurface = true
  return mesh
}

export interface BuiltAsset {
  group: THREE.Group
  lineMaterials: Array<{ material: LineMaterial; width: number }>
  updateContours: (camera: THREE.Camera) => void
  updateEffects: (time: number) => void
  dispose: () => void
}
export function buildAsset(asset: InkAsset, options: { batchFaces?: boolean; meshInk?: boolean; hullContours?: boolean; meshContours?:boolean; surfaceEffects?: boolean } = {}): BuiltAsset {
  const group = new THREE.Group()
  group.name = asset.id
  if (options.batchFaces) {
    const batches = new Map<string, { color: number; opacity: number; geometries: Array<THREE.BufferGeometry> }>()
    for (const face of asset.faces) {
      const key = `${face.color}/${face.opacity ?? 1}`,
        batch = batches.get(key) ?? { color: face.color, opacity: face.opacity ?? 1, geometries: [] }
      batch.geometries.push(faceMesh(face.points, face.color, face.opacity ?? 1).geometry)
      batches.set(key, batch)
    }
    for (const { color, opacity, geometries } of batches.values()) {
      const geometry = mergeGeometries(geometries)
      if (!geometry) throw new Error("Could not batch map faces")
      geometries.forEach((g) => g.dispose())
      const mesh = new THREE.Mesh(geometry, fillMaterial(color, opacity))
      mesh.userData.structureSurface = true
      group.add(mesh)
    }
  } else {
    for (const face of asset.faces) group.add(faceMesh(face.points, face.color, face.opacity ?? 1))
  }
  const lineMaterials: Array<{ material: LineMaterial; width: number }> = []
  const effectTime = { value: 0 }, effectMaterials: THREE.MeshBasicMaterial[] = []
  if (asset.effects && options.surfaceEffects !== false) {
    const e = asset.effects
    for (const child of group.children) if (child instanceof THREE.Mesh && child.userData.structureSurface) {
      const source = child.material as THREE.MeshBasicMaterial, material = source.clone()
      installSurfaceShader(material, source.color.getHex(THREE.SRGBColorSpace), effectTime, e.state, new THREE.Vector4(e.half * floorScale, e.height / Math.cos(Math.PI / 6), 0.31, 1))
      child.material = material; effectMaterials.push(material)
    }
  }
  const curveMaterials: Array<THREE.MeshBasicMaterial> = []
  const curves = new Map<string, { geometries: Array<THREE.BufferGeometry>; color: number; opacity: number }>()
  const batches = new Map<string, { positions: Array<number>; width: number; color: number; opacity: number }>()
  for (const stroke of asset.strokes) {
    const key = `${stroke.width}/${stroke.color}/${stroke.opacity}`
    if (options.meshInk && stroke.width > 0 && stroke.points.length <= 8) {
      const batch = curves.get(key) ?? { geometries: [], color: stroke.color, opacity: stroke.opacity }
      for (let i = 1; i < stroke.points.length; i++) {
        const a = vertex3(stroke.points[i - 1]!),
          b = vertex3(stroke.points[i]!),
          delta = b.clone().sub(a),
          length = delta.length()
        if (length < 0.0001) continue
        const g = new THREE.CylinderGeometry(stroke.width / 2, stroke.width / 2, length, 6)
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()))
        g.translate(...a.add(b).multiplyScalar(0.5).toArray())
        batch.geometries.push(g)
      }
      if (batch.geometries.length) curves.set(key, batch)
      continue
    }
    // Continuous tubes keep small circle joins clean at high magnification.
    const first = stroke.points[0]!,
      last = stroke.points.at(-1)!
    if (stroke.width > 0 && stroke.points.length > 8) {
      const closed = first.every((n, i) => Math.abs(n - last[i]!) < 1e-6)
      const curve = new THREE.CatmullRomCurve3((closed ? stroke.points.slice(0, -1) : stroke.points).map(vertex3), closed)
      const geometry = new THREE.TubeGeometry(curve, (stroke.points.length - 1) * 2, stroke.width / 2, 6, closed)
      const batch = curves.get(key) ?? { geometries: [], color: stroke.color, opacity: stroke.opacity }
      batch.geometries.push(geometry)
      curves.set(key, batch)
      continue
    }
    const batch = batches.get(key) ?? { positions: [], width: stroke.width, color: stroke.color, opacity: stroke.opacity }
    for (let i = 1; i < stroke.points.length; i++)
      batch.positions.push(...vertex3(stroke.points[i - 1]!).toArray(), ...vertex3(stroke.points[i]!).toArray())
    batches.set(key, batch)
  }
  const addLines = (positions: Array<number>, width: number, color: number, opacity: number) => {
    const geometry = new LineSegmentsGeometry().setPositions(positions)
    const material = new LineMaterial({
      color,
      opacity,
      transparent: opacity < 1,
      depthTest: true,
      depthWrite: false,
      alphaToCoverage: true,
      worldUnits: true
    })
    material.linewidth = width
    const lines = new LineSegments2(geometry, material)
    lines.renderOrder = 2
    group.add(lines)
    lineMaterials.push({ material, width })
    return lines
  }
  for (const b of batches.values()) addLines(b.positions, b.width, b.color, b.opacity)
  for (const { geometries, color, opacity } of curves.values()) {
    const geometry = mergeGeometries(geometries)!
    geometries.forEach((g) => g.dispose())
    const material = new THREE.MeshBasicMaterial({ color, opacity, transparent: opacity < 1, depthWrite: false })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = 2
    group.add(mesh)
    curveMaterials.push(material)
  }

  // Smooth props and foliage get view-dependent silhouette edges, without
  // drawing their hidden edges or the internal triangulation.
  const counts = new Map<number, number>()
  for (const face of asset.faces) if (face.contour) counts.set(face.contour, (counts.get(face.contour) ?? 0) + 1)
  const smooth = new Set([...counts].filter(([, count]) => options.hullContours || count > 6).map(([id]) => id))
  const smoothFaces = asset.faces.filter((f) => f.contour && smooth.has(f.contour) && (f.contourWidth ?? 1) > 0)
  const hull = smoothFaces.length ? silhouetteMesh(asset, smoothFaces) : null
  if (hull) group.add(hull)
  const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; normals: Array<THREE.Vector3>; width: number }>()
  const centers = contourCenters(asset)
  for (const face of asset.faces.filter((f) => f.contour && !smooth.has(f.contour))) {
    const points = outwardPoints(face, centers)
    const normal = new THREE.Vector3().crossVectors(points[1]!.clone().sub(points[0]!), points[2]!.clone().sub(points[0]!)).normalize()
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!,
        b = points[(i + 1) % points.length]!
      const keys = [
        a
          .toArray()
          .map((n) => n.toFixed(4))
          .join(","),
        b
          .toArray()
          .map((n) => n.toFixed(4))
          .join(",")
      ].sort()
      const key = `${face.contour}|${keys.join("|")}`
      const edge = edges.get(key) ?? { a, b, normals: [], width: face.contourWidth ?? 1 }
      edge.normals.push(normal)
      edges.set(key, edge)
    }
  }
  // GPU silhouette masks let sharp foliage share instances at every camera
  // angle, without a wireframe or an expanded hull crossing the canopy.
  if (options.meshContours) {
    const batches = new Map<number, Array<THREE.BufferGeometry>>()
    for (const { a, b, normals, width } of edges.values()) {
      const delta = b.clone().sub(a), length = delta.length()
      if (length < 0.0001 || width <= 0) continue
      const geometry = new THREE.CylinderGeometry(width / 2, width / 2, length, 6)
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()))
      geometry.translate(...a.clone().add(b).multiplyScalar(0.5).toArray())
      const n1 = normals[0]!, n2 = normals[1] ?? n1.clone().negate(), count = geometry.getAttribute("position").count
      geometry.setAttribute("inkNormalA", new THREE.Float32BufferAttribute(Array.from({ length: count }, () => n1.toArray()).flat(), 3))
      geometry.setAttribute("inkNormalB", new THREE.Float32BufferAttribute(Array.from({ length: count }, () => n2.toArray()).flat(), 3))
      const batch = batches.get(width) ?? []
      batch.push(geometry)
      batches.set(width, batch)
    }
    for (const geometries of batches.values()) {
      const material = new THREE.MeshBasicMaterial({ color: palette.ink, depthWrite: false })
      const mesh = new THREE.Mesh(mergeGeometries(geometries)!, material)
      mesh.renderOrder = 2
      group.add(mesh)
      curveMaterials.push(material)
      geometries.forEach(g => g.dispose())
    }
  }
  const contours = new Map(
    (options.meshContours ? [] : [...new Set([...edges.values()].map((e) => e.width))]).map((width) => [width, addLines([0, 0, 0, 0, 0, 0], width, palette.ink, 1)])
  )
  const lastDirection = new THREE.Vector3()
  const updateContours = (camera: THREE.Camera) => {
    if (!contours.size) return
    group.updateWorldMatrix(true, false)
    const direction = camera
      .getWorldDirection(new THREE.Vector3())
      .negate()
      .applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()).invert())
    if (direction.distanceToSquared(lastDirection) < 1e-12) return
    lastDirection.copy(direction)
    const batches = new Map<number, Array<number>>()
    for (const { a, b, normals, width } of edges.values()) {
      const signs = normals.map((n) => n.dot(direction))
      if (normals.length === 1 || (Math.min(...signs) < 0 && Math.max(...signs) >= 0)) {
        const positions = batches.get(width) ?? []
        positions.push(...a.toArray(), ...b.toArray())
        batches.set(width, positions)
      }
    }
    for (const [width, lines] of contours) {
      const positions = batches.get(width) ?? []
      const previous = lines.geometry
      lines.geometry = new LineSegmentsGeometry().setPositions(positions.length ? positions : [0, 0, 0, 0, 0, 0])
      previous.dispose()
    }
  }
  const plume=asset.smokeEffect&&options.surfaceEffects!==false?new SmokePlume():null
  if(plume){plume.group.position.copy(vertex3(asset.smokeEffect!.origin));group.add(plume.group);plume.update(0)}
  const fountains=options.surfaceEffects!==false?(asset.fountains??[]).map(f=>new FountainWater(f)):[]
  for(const fountain of fountains)group.add(fountain.group)
  const dispose = () => {
    plume?.dispose()
    fountains.forEach(f=>f.dispose())
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose()
    })
    for (const { material } of lineMaterials) material.dispose()
    curveMaterials.forEach((material) => material.dispose())
    effectMaterials.forEach(m => m.dispose())
    if (hull) (hull.material as THREE.Material).dispose()
    for (const object of group.children) if (object instanceof LineSegments2) object.geometry.dispose()
  }
  return { group, lineMaterials, updateContours, updateEffects: time => { effectTime.value = time;plume?.update(time);fountains.forEach(f=>f.update(time)) }, dispose }
}

/** GLB uses ordinary meshes for ink strokes so the outlines survive import.
 * Rounded props use an inverted hull for their view-dependent silhouette. */
export async function exportAsset(asset: InkAsset) {
  const group = new THREE.Group()
  group.name = asset.id
  if(asset.effects)group.userData.inklineSurfaceEffects=asset.effects
  if(asset.smokeEffect)group.userData.inklineSmokeEffect=asset.smokeEffect
  if(asset.fountains?.length)group.userData.inklineFountains=asset.fountains
  for (const face of asset.faces) group.add(faceMesh(face.points, face.color, face.opacity ?? 1))
  const contourFaces = asset.faces.filter((face) => face.contour)
  const hull = contourFaces.length ? silhouetteMesh(asset, contourFaces) : null
  if (hull) group.add(hull)
  const inkMaterials = new Map<string, THREE.MeshBasicMaterial>()
  for (const stroke of asset.strokes) {
    const key = `${stroke.color}/${stroke.opacity}`
    let material = inkMaterials.get(key)
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: stroke.color, opacity: stroke.opacity, transparent: stroke.opacity < 1 })
      inkMaterials.set(key, material)
    }
    for (let i = 1; i < stroke.points.length; i++) {
      const a = vertex3(stroke.points[i - 1]!),
        b = vertex3(stroke.points[i]!),
        delta = b.clone().sub(a),
        length = delta.length()
      if (length < 0.0001) continue
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(stroke.width / 2, stroke.width / 2, length, 6), material)
      mesh.position.copy(a.clone().add(b).multiplyScalar(0.5))
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
      group.add(mesh)
    }
  }
  // Batch like materials before export rather than shipping hundreds of nodes.
  const merged = new THREE.Group()
  merged.name = group.name
  merged.userData = { ...group.userData }
  group.updateMatrixWorld(true)
  const batches = new Map<THREE.MeshBasicMaterial, Array<THREE.BufferGeometry>>()
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
    geometry.applyMatrix4(object.matrixWorld)
    for (const attribute of Object.keys(geometry.attributes))
      if (attribute !== "position" && attribute !== "normal") geometry.deleteAttribute(attribute)
    const material = object.material as THREE.MeshBasicMaterial
    const geometries = batches.get(material) ?? []
    geometries.push(geometry)
    batches.set(material, geometries)
  })
  for (const [material, geometries] of batches) {
    const combined = mergeGeometries(geometries)
    if (!combined) throw new Error("Could not batch exported geometry")
    const geometry = mergeVertices(combined)
    combined.dispose()
    geometries.forEach((g) => g.dispose())
    merged.add(new THREE.Mesh(geometry, material))
  }
  const result = await new GLTFExporter().parseAsync(merged, { binary: true })
  merged.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose()
  })
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose()
  })
  for (const material of inkMaterials.values()) material.dispose()
  if (hull) (hull.material as THREE.Material).dispose()
  if (!(result instanceof ArrayBuffer)) throw new Error("Expected binary glTF")
  return result
}

export async function reloadExportedAsset(asset: InkAsset) {
  return (await new GLTFLoader().parseAsync(await exportAsset(asset), "")).scene
}
