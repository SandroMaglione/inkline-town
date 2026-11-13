/**
 * The materials a model's parts draw with (see `ink-mesh.ts` for the parts):
 * unlit, in display space, faces pushed back behind their ink.
 *
 * - `partMaterial` for one model drawn alone (the map's ground layers, the
 *   catalogue, the labs): its colour on the material.
 * - `copyMaterial` for the town's shared models (`pool.ts`): each copy's
 *   parts have materials of their own, with its colour, opacity and surface
 *   state.
 */
import { FlatMaterial, type ShaderBit, type View3D } from "@pixi/3d"
import type { Renderer, RenderTexture } from "pixi.js"
import { copySurfaceBit, faceBiasBit, GLASS, inkLineBit, inkSilhouetteBit, materialSurfaceBit, plainBit } from "./bits.ts"
import type { InkPart, PartRole } from "./assets/ink-mesh.ts"
import type { SurfaceState } from "./surface-state.ts"

const roleBits: Record<PartRole, ReadonlyArray<ShaderBit>> = { fill: [faceBiasBit], hull: [], ink: [], contour: [inkSilhouetteBit], line: [inkLineBit], edge: [inkLineBit, inkSilhouetteBit] }
const ribbon = (role: PartRole) => role === "line" || role === "edge"
const doubleSided = (role: PartRole) => role === "fill" || ribbon(role)

/** The materials with faces, which `faceBiasBit` moves back by the size in pixels of the picture being drawn. */
const faces = new Set<FlatMaterial>()
let pixels: readonly [number, number] = [1, 1]
function face(material: FlatMaterial) {
  material.data.facePixels = pixels
  faces.add(material)
}
/**
 * Tells the faces the size in pixels of `view`'s next picture: the part of the view its camera's viewport takes,
 * at `target`'s pixels to a unit, or the canvas's.
 */
export function sizeFaces(renderer: Renderer, view: View3D, target?: RenderTexture) {
  const resolution = target?.source.resolution ?? renderer.resolution
  const width = view.width * view.camera.viewport.width * resolution, height = view.height * view.camera.viewport.height * resolution
  if (width === pixels[0] && height === pixels[1]) return
  pixels = [width, height]
  for (const material of faces) material.data.facePixels = pixels
}
/** Draws `view` on the canvas, or into `options.target`. Draw every picture through here (or after `sizeFaces`), so its faces sit behind their ink. */
export function draw(renderer: Renderer, view: View3D, options: { target?: RenderTexture; clear?: boolean; clearColor?: [number, number, number, number] } = {}) {
  sizeFaces(renderer, view, options.target)
  renderer.render({ container: view, ...options })
}
/** Destroys a material `partMaterial` or `copyMaterial` made. */
export function releaseMaterial(material: FlatMaterial) {
  faces.delete(material)
  material.destroy()
}

/** A part of one model; `surface` gives its faces the structure shading, with its own state. */
export function partMaterial(part: InkPart, surface: boolean): FlatMaterial {
  const material = new FlatMaterial({
    baseColor: part.color,
    alpha: part.opacity,
    // A stroke's soft edge blends, as three.js's alpha-to-coverage lines did.
    alphaMode: part.opacity < 1 || ribbon(part.role) ? "blend" : "opaque",
    doubleSided: doubleSided(part.role),
    extraBits: [...(surface && part.role === "fill" ? [materialSurfaceBit] : []), ...roleBits[part.role]]
  })
  if (ribbon(part.role)) {
    material.data.lineWidth = part.width
    material.data.lineAlpha = part.opacity
  }
  if (surface && part.role === "fill") {
    material.data.surfaceGlass = Number(GLASS.includes(part.color))
    material.data.surfaceTime = 0
  }
  if (part.role === "fill") face(material)
  return material
}
/** Writes a structure's surface state, its size (`bounds`: half width, height, seed, on) and the time into its material. */
export function setSurface(material: FlatMaterial, state: SurfaceState, bounds: readonly [number, number, number, number], time: number) {
  material.data.surfaceState = [state.wear, state.care, state.snow, state.burning]
  material.data.surfaceHazards = [state.fireRisk, state.health, state.order, state.sick]
  material.data.surfaceBounds = [...bounds]
  material.data.surfaceTime = time
}

/** The material of one part of one copy of a shared model: its colour, opacity and surface state are its own. */
export function copyMaterial(part: InkPart, blend: boolean): FlatMaterial {
  const material = new FlatMaterial({
    alphaMode: blend ? "blend" : "opaque",
    doubleSided: doubleSided(part.role),
    extraBits: [plainBit, ...(part.role === "fill" ? [copySurfaceBit] : []), ...roleBits[part.role]]
  })
  if (part.role === "fill") {
    material.data.surfaceGlass = Number(GLASS.includes(part.color))
    face(material)
  }
  return material
}
