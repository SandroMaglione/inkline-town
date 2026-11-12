/**
 * Mesh data with no renderer in it: plain typed arrays the Pixi 3D adapter
 * uploads (`../gpu.ts`), the GLB writer packs (`../assets/glb.ts`), and the
 * tests read in Node.
 *
 * The shapes are ports of the three.js r186 algorithms the town's models were
 * approved with (MIT, © three.js authors): `CylinderGeometry`,
 * `CatmullRomCurve3` with `TubeGeometry` and its Frenet frames,
 * `BufferGeometry.computeVertexNormals`, and `BufferGeometryUtils`'
 * `mergeGeometries` and `mergeVertices`, so every vertex lands where it did.
 */
import { add, apply3, cross, distanceSquared, dot, length, normalize, rotationAxis, rotationBetween, scale, sub, type Mat3, type Vec3 } from "./vec3.ts"

export interface Attribute {
  readonly data: Float32Array
  readonly size: number
}
export interface MeshData {
  readonly positions: Float32Array
  readonly normals: Float32Array
  /** Triangle indices, or `null` for a triangle list. */
  readonly index: Uint32Array | null
  /** Extra per-vertex attributes, by shader name (`aInkNormalA`, …). */
  readonly attributes: Readonly<Record<string, Attribute>>
}

const vertexCount = (mesh: MeshData) => mesh.positions.length / 3
export const triangleCount = (mesh: MeshData) => (mesh.index ? mesh.index.length : vertexCount(mesh)) / 3
const at = (data: Float32Array, i: number): Vec3 => [data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!]

/** Per-vertex normals: each triangle's (unnormalised) normal summed into its corners, as three.js does. */
export function vertexNormals(positions: Float32Array, index: Uint32Array | null): Float32Array {
  const normals = new Float32Array(positions.length)
  const count = index ? index.length : positions.length / 3
  for (let i = 0; i < count; i += 3) {
    const [a, b, c] = index ? [index[i]!, index[i + 1]!, index[i + 2]!] : [i, i + 1, i + 2]
    const pA = at(positions, a), pB = at(positions, b), pC = at(positions, c)
    const n = cross(sub(pC, pB), sub(pA, pB))
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) normals[v * 3 + k]! += n[k]!
  }
  for (let v = 0; v < normals.length / 3; v++) {
    const n = normalize(at(normals, v))
    normals.set(n, v * 3)
  }
  return normals
}

/** A triangle list with flat normals. */
export function triangles(positions: ReadonlyArray<number> | Float32Array): MeshData {
  const p = Float32Array.from(positions)
  return { positions: p, normals: vertexNormals(p, null), index: null, attributes: {} }
}

/** A convex (or star-shaped about its first point) polygon, fanned from its first point. */
export function polygon(points: ReadonlyArray<Vec3>): MeshData {
  const positions: Array<number> = []
  for (let i = 1; i < points.length - 1; i++) positions.push(...points[0]!, ...points[i]!, ...points[i + 1]!)
  return triangles(positions)
}

/** three.js's `CylinderGeometry(radius, radius, height, radialSegments)`: closed, axis +Y, centred on the origin. */
export function cylinder(radius: number, height: number, radialSegments = 6): MeshData {
  const positions: Array<number> = [], normals: Array<number> = [], indices: Array<number> = []
  const half = height / 2
  let index = 0
  const rows: Array<Array<number>> = []
  for (let y = 0; y <= 1; y++) {
    const row: Array<number> = []
    for (let x = 0; x <= radialSegments; x++) {
      const theta = (x / radialSegments) * Math.PI * 2, sin = Math.sin(theta), cos = Math.cos(theta)
      positions.push(radius * sin, -y * height + half, radius * cos)
      normals.push(...normalize([sin, 0, cos]))
      row.push(index++)
    }
    rows.push(row)
  }
  for (let x = 0; x < radialSegments; x++) {
    const a = rows[0]![x]!, b = rows[1]![x]!, c = rows[1]![x + 1]!, d = rows[0]![x + 1]!
    if (radius > 0) indices.push(a, b, d)
    if (radius > 0) indices.push(b, c, d)
  }
  for (const top of [true, false]) {
    if (radius <= 0) continue
    const sign = top ? 1 : -1, centre = index
    for (let x = 1; x <= radialSegments; x++) {
      positions.push(0, half * sign, 0)
      normals.push(0, sign, 0)
      index++
    }
    const ring = index
    for (let x = 0; x <= radialSegments; x++) {
      const theta = (x / radialSegments) * Math.PI * 2
      positions.push(radius * Math.sin(theta), half * sign, radius * Math.cos(theta))
      normals.push(0, sign, 0)
      index++
    }
    for (let x = 0; x < radialSegments; x++) {
      const c = centre + x, i = ring + x
      if (top) indices.push(i, i + 1, c)
      else indices.push(i + 1, i, c)
    }
  }
  return { positions: Float32Array.from(positions), normals: Float32Array.from(normals), index: Uint32Array.from(indices), attributes: {} }
}

/** `mesh` rotated by `rotation` (normals too) and then moved by `translation`. */
export function transformed(mesh: MeshData, rotation: Mat3 | null, translation: Vec3 = [0, 0, 0]): MeshData {
  const positions = new Float32Array(mesh.positions.length), normals = new Float32Array(mesh.normals.length)
  for (let v = 0; v < positions.length / 3; v++) {
    const p = at(mesh.positions, v), n = at(mesh.normals, v)
    positions.set(add(rotation ? apply3(rotation, p) : p, translation), v * 3)
    normals.set(rotation ? normalize(apply3(rotation, n)) : n, v * 3)
  }
  return { ...mesh, positions, normals }
}

/** A closed six-sided rod from `a` to `b`, `width` across: how ink strokes become geometry. */
export function rod(a: Vec3, b: Vec3, width: number, radialSegments = 6): MeshData | null {
  const delta = sub(b, a), l = length(delta)
  if (l < 0.0001) return null
  return transformed(cylinder(width / 2, l, radialSegments), rotationBetween([0, 1, 0], normalize(delta)), scale(add(a, b), 0.5))
}
/** A centripetal Catmull-Rom curve through `points` (three.js's `CatmullRomCurve3` defaults). */
class CatmullRom {
  private lengths: Array<number> | null = null
  private readonly points: ReadonlyArray<Vec3>
  private readonly closed: boolean
  constructor(points: ReadonlyArray<Vec3>, closed: boolean) {
    this.points = points
    this.closed = closed
  }
  point(t: number): Vec3 {
    const points = this.points, l = points.length
    const p = (l - (this.closed ? 0 : 1)) * t
    let intPoint = Math.floor(p), weight = p - intPoint
    if (this.closed) intPoint += intPoint > 0 ? 0 : (Math.floor(Math.abs(intPoint) / l) + 1) * l
    else if (weight === 0 && intPoint === l - 1) {
      intPoint = l - 2
      weight = 1
    }
    const p0 = this.closed || intPoint > 0 ? points[(intPoint - 1) % l]! : add(sub(points[0]!, points[1]!), points[0]!)
    const p1 = points[intPoint % l]!, p2 = points[(intPoint + 1) % l]!
    const p3 = this.closed || intPoint + 2 < l ? points[(intPoint + 2) % l]! : add(sub(points[l - 1]!, points[l - 2]!), points[l - 1]!)
    let dt0 = distanceSquared(p0, p1) ** 0.25, dt1 = distanceSquared(p1, p2) ** 0.25, dt2 = distanceSquared(p2, p3) ** 0.25
    if (dt1 < 1e-4) dt1 = 1
    if (dt0 < 1e-4) dt0 = dt1
    if (dt2 < 1e-4) dt2 = dt1
    const axis = (k: number) => {
      const x0 = p0[k]!, x1 = p1[k]!, x2 = p2[k]!, x3 = p3[k]!
      let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1
      let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2
      t1 *= dt1
      t2 *= dt1
      const c0 = x1, c1 = t1, c2 = -3 * x1 + 3 * x2 - 2 * t1 - t2, c3 = 2 * x1 - 2 * x2 + t1 + t2
      return c0 + c1 * weight + c2 * weight * weight + c3 * weight * weight * weight
    }
    return [axis(0), axis(1), axis(2)]
  }
  private arcLengths() {
    if (this.lengths) return this.lengths
    const divisions = 200, cache = [0]
    let last = this.point(0), sum = 0
    for (let p = 1; p <= divisions; p++) {
      const current = this.point(p / divisions)
      sum += Math.sqrt(distanceSquared(current, last))
      cache.push(sum)
      last = current
    }
    return (this.lengths = cache)
  }
  private uToT(u: number) {
    const arcLengths = this.arcLengths(), il = arcLengths.length, target = u * arcLengths[il - 1]!
    let low = 0, high = il - 1, i = 0
    while (low <= high) {
      i = Math.floor(low + (high - low) / 2)
      const comparison = arcLengths[i]! - target
      if (comparison < 0) low = i + 1
      else if (comparison > 0) high = i - 1
      else {
        high = i
        break
      }
    }
    i = high
    if (arcLengths[i] === target) return i / (il - 1)
    const before = arcLengths[i]!, after = arcLengths[i + 1]!
    return (i + (target - before) / (after - before)) / (il - 1)
  }
  pointAt(u: number) {
    return this.point(this.uToT(u))
  }
  tangentAt(u: number): Vec3 {
    const t = this.uToT(u), delta = 0.0001
    return normalize(sub(this.point(Math.min(1, t + delta)), this.point(Math.max(0, t - delta))))
  }
}

/** three.js's `TubeGeometry(new CatmullRomCurve3(points, closed), tubularSegments, radius, radialSegments, closed)`. */
export function tube(points: ReadonlyArray<Vec3>, closed: boolean, tubularSegments: number, radius: number, radialSegments: number): MeshData {
  const path = new CatmullRom(points, closed)
  const tangents: Array<Vec3> = [], normals: Array<Vec3> = [], binormals: Array<Vec3> = []
  for (let i = 0; i <= tubularSegments; i++) tangents.push(path.tangentAt(i / tubularSegments))
  const t0 = tangents[0]!
  let min = Number.MAX_VALUE, start: Vec3 = [0, 0, 0]
  const [tx, ty, tz] = t0.map(Math.abs) as [number, number, number]
  if (tx <= min) { min = tx; start = [1, 0, 0] }
  if (ty <= min) { min = ty; start = [0, 1, 0] }
  if (tz <= min) start = [0, 0, 1]
  const v0 = normalize(cross(t0, start))
  normals.push(cross(t0, v0))
  binormals.push(cross(t0, normals[0]!))
  let vec: Vec3 = [0, 0, 0]
  for (let i = 1; i <= tubularSegments; i++) {
    let n = normals[i - 1]!
    vec = cross(tangents[i - 1]!, tangents[i]!)
    if (length(vec) > Number.EPSILON) {
      vec = normalize(vec)
      const theta = Math.acos(Math.min(1, Math.max(-1, dot(tangents[i - 1]!, tangents[i]!))))
      n = apply3(rotationAxis(vec, theta), n)
    }
    normals.push(n)
    binormals.push(cross(tangents[i]!, n))
  }
  if (closed) {
    let theta = Math.acos(Math.min(1, Math.max(-1, dot(normals[0]!, normals[tubularSegments]!)))) / tubularSegments
    if (dot(tangents[0]!, cross(normals[0]!, normals[tubularSegments]!)) > 0) theta = -theta
    for (let i = 1; i <= tubularSegments; i++) {
      normals[i] = apply3(rotationAxis(tangents[i]!, theta * i), normals[i]!)
      binormals[i] = cross(tangents[i]!, normals[i]!)
    }
  }
  const positions: Array<number> = [], vertexNormalList: Array<number> = [], indices: Array<number> = []
  const segment = (i: number) => {
    const P = path.pointAt(i / tubularSegments), N = normals[i]!, B = binormals[i]!
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2, sin = Math.sin(v), cos = -Math.cos(v)
      const normal = normalize([cos * N[0] + sin * B[0], cos * N[1] + sin * B[1], cos * N[2] + sin * B[2]])
      vertexNormalList.push(...normal)
      positions.push(P[0] + radius * normal[0], P[1] + radius * normal[1], P[2] + radius * normal[2])
    }
  }
  for (let i = 0; i < tubularSegments; i++) segment(i)
  segment(closed ? 0 : tubularSegments)
  for (let j = 1; j <= tubularSegments; j++)
    for (let i = 1; i <= radialSegments; i++) {
      const a = (radialSegments + 1) * (j - 1) + (i - 1), b = (radialSegments + 1) * j + (i - 1), c = (radialSegments + 1) * j + i, d = (radialSegments + 1) * (j - 1) + i
      indices.push(a, b, d, b, c, d)
    }
  return { positions: Float32Array.from(positions), normals: Float32Array.from(vertexNormalList), index: Uint32Array.from(indices), attributes: {} }
}

/** `mesh` with one more per-vertex attribute, the same value at every vertex. */
export function withConstant(mesh: MeshData, name: string, value: ReadonlyArray<number>): MeshData {
  const count = vertexCount(mesh), data = new Float32Array(count * value.length)
  for (let v = 0; v < count; v++) data.set(value, v * value.length)
  return { ...mesh, attributes: { ...mesh.attributes, [name]: { data, size: value.length } } }
}

/** One mesh of several, as three.js's `mergeGeometries` (all indexed, or none). */
export function merge(meshes: ReadonlyArray<MeshData>): MeshData {
  if (!meshes.length) throw new Error("Nothing to merge")
  const indexed = meshes[0]!.index !== null
  if (meshes.some((m) => (m.index !== null) !== indexed)) throw new Error("Cannot merge indexed and unindexed meshes")
  const names = Object.keys(meshes[0]!.attributes)
  for (const m of meshes) if (Object.keys(m.attributes).length !== names.length || names.some((n) => !(n in m.attributes))) throw new Error("Cannot merge meshes with different attributes")
  const join = (arrays: ReadonlyArray<Float32Array>) => {
    const out = new Float32Array(arrays.reduce((n, a) => n + a.length, 0))
    let o = 0
    for (const a of arrays) {
      out.set(a, o)
      o += a.length
    }
    return out
  }
  let index: Uint32Array | null = null
  if (indexed) {
    index = new Uint32Array(meshes.reduce((n, m) => n + m.index!.length, 0))
    let o = 0, base = 0
    for (const m of meshes) {
      for (let i = 0; i < m.index!.length; i++) index[o + i] = m.index![i]! + base
      o += m.index!.length
      base += vertexCount(m)
    }
  }
  return {
    positions: join(meshes.map((m) => m.positions)),
    normals: join(meshes.map((m) => m.normals)),
    index,
    attributes: Object.fromEntries(names.map((n) => [n, { data: join(meshes.map((m) => m.attributes[n]!.data)), size: meshes[0]!.attributes[n]!.size }]))
  }
}

/** Every triangle's corners spelled out, as three.js's `toNonIndexed`. */
export function unindexed(mesh: MeshData): MeshData {
  if (!mesh.index) return mesh
  const index = mesh.index
  const spread = (data: Float32Array, size: number) => {
    const out = new Float32Array(index.length * size)
    for (let i = 0; i < index.length; i++) for (let k = 0; k < size; k++) out[i * size + k] = data[index[i]! * size + k]!
    return out
  }
  return {
    positions: spread(mesh.positions, 3),
    normals: spread(mesh.normals, 3),
    index: null,
    attributes: Object.fromEntries(Object.entries(mesh.attributes).map(([n, a]) => [n, { data: spread(a.data, a.size), size: a.size }]))
  }
}

/** Vertices equal to within `tolerance` (positions and normals) shared, as three.js's `mergeVertices`. */
export function mergeVertices(mesh: MeshData, tolerance = 1e-4): MeshData {
  tolerance = Math.max(tolerance, Number.EPSILON)
  const multiplier = 10 ** Math.log10(1 / tolerance), additive = tolerance * 0.5 * multiplier
  const streams: Array<[Float32Array, number]> = [[mesh.positions, 3], [mesh.normals, 3], ...Object.values(mesh.attributes).map((a): [Float32Array, number] => [a.data, a.size])]
  const count = mesh.index ? mesh.index.length : vertexCount(mesh)
  const hashToIndex = new Map<string, number>(), outIndex: Array<number> = [], outStreams = streams.map(([, size]) => [] as Array<number>)
  for (let i = 0; i < count; i++) {
    const v = mesh.index ? mesh.index[i]! : i
    let hash = ""
    for (const [data, size] of streams) for (let k = 0; k < size; k++) hash += `${Math.trunc(data[v * size + k]! * multiplier + additive)},`
    let next = hashToIndex.get(hash)
    if (next === undefined) {
      next = hashToIndex.size
      hashToIndex.set(hash, next)
      streams.forEach(([data, size], s) => {
        for (let k = 0; k < size; k++) outStreams[s]!.push(data[v * size + k]!)
      })
    }
    outIndex.push(next)
  }
  const names = Object.keys(mesh.attributes)
  return {
    positions: Float32Array.from(outStreams[0]!),
    normals: Float32Array.from(outStreams[1]!),
    index: Uint32Array.from(outIndex),
    attributes: Object.fromEntries(names.map((n, i) => [n, { data: Float32Array.from(outStreams[i + 2]!), size: mesh.attributes[n]!.size }]))
  }
}

/** The smallest box around `mesh`: `[min, max]`. */
export function bounds(mesh: MeshData): [Vec3, Vec3] {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
  const p = mesh.positions
  for (let i = 0; i < p.length; i += 3) {
    x0 = Math.min(x0, p[i]!); y0 = Math.min(y0, p[i + 1]!); z0 = Math.min(z0, p[i + 2]!)
    x1 = Math.max(x1, p[i]!); y1 = Math.max(y1, p[i + 1]!); z1 = Math.max(z1, p[i + 2]!)
  }
  return [[x0, y0, z0], [x1, y1, z1]]
}
