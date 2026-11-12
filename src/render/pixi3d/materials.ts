/**
 * The materials a model's parts draw with (see `ink-mesh.ts` for the parts):
 * unlit, in display space, faces pushed back behind their ink.
 *
 * - `partMaterial` for one model drawn alone (the map's ground layers, the
 *   catalogue, the labs): its colour on the material.
 * - `instanceMaterial` for the town's shared models (`pool.ts`): colour,
 *   opacity and surface state per copy, so one material serves every model
 *   with the same kind of part.
 */
import { FlatMaterial, type ShaderBit } from "@pixi/3d"
import { faceBiasBit, GLASS, inkLineBit, inkSilhouetteBit, instanceBit, instanceSurfaceBit, materialSurfaceBit } from "./bits.ts"
import type { InkPart, PartRole } from "./assets/ink-mesh.ts"
import type { SurfaceState } from "./surface-state.ts"

const roleBits: Record<PartRole, ReadonlyArray<ShaderBit>> = { fill: [faceBiasBit], hull: [], ink: [], contour: [inkSilhouetteBit], line: [inkLineBit] }
const doubleSided = (role: PartRole) => role === "fill" || role === "line"

/** A part of one model; `surface` gives its faces the structure shading, with its own state. */
export function partMaterial(part: InkPart, surface: boolean): FlatMaterial {
  const material = new FlatMaterial({
    baseColor: part.color,
    alpha: part.opacity,
    // A stroke's soft edge blends, as three.js's alpha-to-coverage lines did.
    alphaMode: part.opacity < 1 || part.role === "line" ? "blend" : "opaque",
    doubleSided: doubleSided(part.role),
    extraBits: [...(surface && part.role === "fill" ? [materialSurfaceBit] : []), ...roleBits[part.role]]
  })
  if (part.role === "line") {
    material.data.lineWidth = part.width
    material.data.lineAlpha = part.opacity
  }
  if (surface && part.role === "fill") {
    material.data.surfaceGlass = Number(GLASS.includes(part.color))
    material.data.surfaceTime = 0
  }
  return material
}
/** Writes a structure's surface state, its size (`bounds`: half width, height, seed, on) and the time into its material. */
export function setSurface(material: FlatMaterial, state: SurfaceState, bounds: readonly [number, number, number, number], time: number) {
  material.data.surfaceState = [state.wear, state.care, state.snow, state.burning]
  material.data.surfaceHazards = [state.fireRisk, state.health, state.order, state.sick]
  material.data.surfaceBounds = [...bounds]
  material.data.surfaceTime = time
}

const shared = new Map<string, FlatMaterial>()
/** The material every shared copy of such a part draws with: `blend` for a copy fading or see-through. */
export function instanceMaterial(part: InkPart, blend: boolean): FlatMaterial {
  const glass = part.role === "fill" && GLASS.includes(part.color)
  const key = `${part.role}/${part.opacity}/${glass}/${blend}`
  let material = shared.get(key)
  if (!material) {
    material = new FlatMaterial({
      alphaMode: blend ? "blend" : "opaque",
      doubleSided: doubleSided(part.role),
      extraBits: [instanceBit, ...(part.role === "fill" ? [instanceSurfaceBit] : []), ...roleBits[part.role]]
    })
    material.data.opacity = part.opacity
    if (part.role === "fill") material.data.surfaceGlass = Number(glass)
    shared.set(key, material)
  }
  return material
}
