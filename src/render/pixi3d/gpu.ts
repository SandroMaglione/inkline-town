/**
 * Mesh data (`mesh/geometry.ts`) uploaded as Pixi 3D geometry, and the
 * colour maths the town's pictures were approved with.
 *
 * A `Geometry3D` built from an attribute map takes no built-in attributes
 * besides the map's, so every geometry here names all of its own: position,
 * normal, and whatever extra a shader bit reads.
 */
import { Box, Geometry3D, Vector3 } from "@pixi/3d"
import { Buffer, BufferUsage, type Attribute, type VertexFormat } from "pixi.js"
import { bounds, type MeshData } from "./mesh/geometry.ts"
import type { Vec3 } from "./mesh/vec3.ts"

const formats: Record<number, VertexFormat> = { 1: "float32", 2: "float32x2", 3: "float32x3", 4: "float32x4" }
const attribute = (data: Float32Array, size: number): Attribute => ({
  buffer: new Buffer({ data, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST }),
  format: formats[size]!,
  stride: size * 4,
  offset: 0
})
const sequence = (count: number) => (count < 65536 ? Uint16Array.from({ length: count }, (_, i) => i) : Uint32Array.from({ length: count }, (_, i) => i))

/**
 * `mesh` as GPU geometry: positions, normals and its extra attributes (by their shader names). `extent`
 * replaces the bounds for a mesh a shader moves (an effect's particles), so it is not culled while in view.
 */
export function toGeometry(mesh: MeshData, extent?: readonly [Vec3, Vec3]): Geometry3D {
  const attributes: Record<string, Attribute> = { aPosition: attribute(mesh.positions, 3), aNormal: attribute(mesh.normals, 3) }
  for (const [name, a] of Object.entries(mesh.attributes)) attributes[name] = attribute(a.data, a.size)
  const [min, max] = extent ?? bounds(mesh)
  return new Geometry3D({
    attributes,
    indices: mesh.index ? (mesh.positions.length / 3 < 65536 ? Uint16Array.from(mesh.index) : mesh.index) : sequence(mesh.positions.length / 3),
    bounds3D: new Box(new Vector3(...min), new Vector3(...max))
  })
}

/**
 * Line segments (`positions`: two points a segment) as ribbons: four corners
 * a segment, each carrying both ends and which corner it is, for
 * `inkLineBit` to turn to the camera and widen.
 */
export function lineGeometry(positions: Float32Array): Geometry3D {
  const segments = positions.length / 6
  const at = new Float32Array(segments * 12), start = new Float32Array(segments * 12), end = new Float32Array(segments * 12), corner = new Float32Array(segments * 8)
  const index: Array<number> = []
  for (let s = 0; s < segments; s++) {
    const a = positions.subarray(s * 6, s * 6 + 3), b = positions.subarray(s * 6 + 3, s * 6 + 6)
    for (let k = 0; k < 4; k++) {
      const v = s * 4 + k, far = k >= 2
      at.set(far ? b : a, v * 3)
      start.set(a, v * 3)
      end.set(b, v * 3)
      corner.set([far ? 1 : 0, k % 2 === 0 ? -1 : 1], v * 2)
    }
    const v = s * 4
    index.push(v, v + 2, v + 1, v + 1, v + 2, v + 3)
  }
  const mesh: MeshData = { positions: at, normals: new Float32Array(at.length), index: Uint32Array.from(index), attributes: { aLineStart: { data: start, size: 3 }, aLineEnd: { data: end, size: 3 }, aLineCorner: { data: corner, size: 2 } } }
  return toGeometry(mesh)
}

/** sRGB to linear light, as three.js (and glTF) do it: the piecewise curve. */
export const toLinear = (c: number) => (c < 0.04045 ? c * 0.0773993808 : (c * 0.9478672986 + 0.0521327014) ** 2.4)
/** Linear light to sRGB, as three.js's output encoding does it. */
export const toDisplay = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** 0.41666 - 0.055)
export const channels = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
/**
 * `color` tinted by `tint`, multiplied in linear light, as three.js's instance
 * colours did it, and written back for the screen.
 */
export function tinted(color: number, tint: number, out: Float32Array, offset: number) {
  const a = channels(color), t = channels(tint)
  for (let k = 0; k < 3; k++) out[offset + k] = tint === 0xffffff ? a[k]! : toDisplay(toLinear(a[k]!) * toLinear(t[k]!))
}
