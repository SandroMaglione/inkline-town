/**
 * Small 3-vector maths on plain tuples, with no renderer in it: the models'
 * geometry (see `geometry.ts`), the GLB writer and the tests share it, in the
 * browser and in Node. Each function returns a new tuple.
 */
export type Vec3 = readonly [number, number, number]

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
export const distanceSquared = (a: Vec3, b: Vec3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a)
  return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]
}
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const mean = (points: ReadonlyArray<Vec3>): Vec3 => scale(points.reduce(add, [0, 0, 0]), 1 / Math.max(1, points.length))

/** A row-major 3×3 rotation, applied as `m · v`. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number]
export const apply3 = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
]
/** The rotation of `angle` radians about the unit `axis` (as three.js's `Matrix4.makeRotationAxis`). */
export const rotationAxis = (axis: Vec3, angle: number): Mat3 => {
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c, [x, y, z] = axis, tx = t * x, ty = t * y
  return [tx * x + c, tx * y - s * z, tx * z + s * y, tx * y + s * z, ty * y + c, ty * z - s * x, tx * z - s * y, ty * z + s * x, t * z * z + c]
}
/** The shortest rotation taking unit `from` onto unit `to` (as three.js's `Quaternion.setFromUnitVectors`). */
export const rotationBetween = (from: Vec3, to: Vec3): Mat3 => {
  let r = dot(from, to) + 1
  let q: [number, number, number, number]
  if (r < Number.EPSILON) {
    r = 0
    q = Math.abs(from[0]) > Math.abs(from[2]) ? [-from[1], from[0], 0, r] : [0, -from[2], from[1], r]
  } else {
    const c = cross(from, to)
    q = [c[0], c[1], c[2], r]
  }
  const l = Math.hypot(...q), [x, y, z, w] = q.map((n) => n / l) as [number, number, number, number]
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)
  ]
}
