/**
 * The effects' small shapes, as three.js r186 built them (`PlaneGeometry`,
 * `SphereGeometry`, `CircleGeometry`; MIT, © three.js authors), with texture
 * coordinates in `aUV`; and `copies`, which bakes many copies of one into a
 * single mesh, each carrying its own values for the shader (a seed, a place).
 */
import type { MeshData } from "./geometry.ts"

const withUV = (positions: Array<number>, normals: Array<number>, uvs: Array<number>, index: Array<number>): MeshData => ({
  positions: Float32Array.from(positions),
  normals: Float32Array.from(normals),
  index: Uint32Array.from(index),
  attributes: { aUV: { data: Float32Array.from(uvs), size: 2 } }
})

/** A `width` × `height` rectangle in the XY plane, facing +Z. */
export function plane(width = 1, height = 1): MeshData {
  const w = width / 2, h = height / 2
  return withUV([-w, h, 0, w, h, 0, -w, -h, 0, w, -h, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 1, 1, 1, 0, 0, 1, 0], [0, 2, 1, 2, 3, 1])
}

export function sphere(radius: number, widthSegments: number, heightSegments: number): MeshData {
  const positions: Array<number> = [], normals: Array<number> = [], uvs: Array<number> = [], index: Array<number> = [], grid: Array<Array<number>> = []
  let next = 0
  for (let iy = 0; iy <= heightSegments; iy++) {
    const row: Array<number> = [], v = iy / heightSegments
    const uOffset = iy === 0 ? 0.5 / widthSegments : iy === heightSegments ? -0.5 / widthSegments : 0
    for (let ix = 0; ix <= widthSegments; ix++) {
      const u = ix / widthSegments
      const x = -radius * Math.cos(u * Math.PI * 2) * Math.sin(v * Math.PI), y = radius * Math.cos(v * Math.PI), z = radius * Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI)
      positions.push(x, y, z)
      const l = Math.hypot(x, y, z) || 1
      normals.push(x / l, y / l, z / l)
      uvs.push(u + uOffset, 1 - v)
      row.push(next++)
    }
    grid.push(row)
  }
  for (let iy = 0; iy < heightSegments; iy++)
    for (let ix = 0; ix < widthSegments; ix++) {
      const a = grid[iy]![ix + 1]!, b = grid[iy]![ix]!, c = grid[iy + 1]![ix]!, d = grid[iy + 1]![ix + 1]!
      if (iy !== 0) index.push(a, b, d)
      if (iy !== heightSegments - 1) index.push(b, c, d)
    }
  return withUV(positions, normals, uvs, index)
}

/** A disc of `radius` lying flat (three.js's `CircleGeometry` turned `rotateX(-π/2)`), facing +Y. */
export function disc(radius: number, segments: number): MeshData {
  const positions = [0, 0, 0], normals = [0, 1, 0], uvs = [0.5, 0.5], index: Array<number> = []
  for (let s = 0; s <= segments; s++) {
    const t = (s / segments) * Math.PI * 2, x = radius * Math.cos(t), y = radius * Math.sin(t)
    positions.push(x, 0, -y)
    normals.push(0, 1, 0)
    uvs.push((x / radius + 1) / 2, (y / radius + 1) / 2)
  }
  for (let i = 1; i <= segments; i++) index.push(i, i + 1, 0)
  return withUV(positions, normals, uvs, index)
}

/** `rotateX(-π/2)`: a shape in the XY plane laid flat. */
export function flat(mesh: MeshData): MeshData {
  const turn = (data: Float32Array) => {
    const out = new Float32Array(data.length)
    for (let i = 0; i < data.length; i += 3) out.set([data[i]!, data[i + 2]!, -data[i + 1]!], i)
    return out
  }
  return { ...mesh, positions: turn(mesh.positions), normals: turn(mesh.normals) }
}

/** `count` copies of `base` in one mesh; each vertex of copy `i` carries `values[name](i)`. */
export function copies(base: MeshData, count: number, values: Record<string, (i: number) => ReadonlyArray<number>>): MeshData {
  const n = base.positions.length / 3, baseIndex = base.index ?? Uint32Array.from({ length: n }, (_, i) => i)
  const positions = new Float32Array(base.positions.length * count), normals = new Float32Array(base.normals.length * count), index = new Uint32Array(baseIndex.length * count)
  const attributes: Record<string, { data: Float32Array; size: number }> = {}
  for (const [name, a] of Object.entries(base.attributes)) attributes[name] = { data: new Float32Array(a.data.length * count), size: a.size }
  for (const [name, value] of Object.entries(values)) attributes[name] = { data: new Float32Array(n * count * value(0).length), size: value(0).length }
  for (let i = 0; i < count; i++) {
    positions.set(base.positions, i * base.positions.length)
    normals.set(base.normals, i * base.normals.length)
    for (let k = 0; k < baseIndex.length; k++) index[i * baseIndex.length + k] = baseIndex[k]! + i * n
    for (const [name, a] of Object.entries(base.attributes)) attributes[name]!.data.set(a.data, i * a.data.length)
    for (const [name, value] of Object.entries(values)) {
      const v = value(i), target = attributes[name]!
      for (let j = 0; j < n; j++) target.data.set(v, (i * n + j) * v.length)
    }
  }
  return { positions, normals, index, attributes }
}
