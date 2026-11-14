/**
 * Rays against triangles and boxes, with no renderer in it: the map's
 * picking (`../pool.ts`) and the model tests share it.
 */
import { add, cross, dot, scale, sub, type Vec3 } from "./vec3.ts"

export interface Ray {
  readonly origin: Vec3
  readonly direction: Vec3
}
export const pointOn = (ray: Ray, t: number): Vec3 => add(ray.origin, scale(ray.direction, t))

/**
 * How far along `ray` it meets triangle `a b c`, or `null` (as three.js's
 * `Ray.intersectTriangle`: Möller–Trumbore, either side unless `cull`).
 */
export function rayTriangle(ray: Ray, a: Vec3, b: Vec3, c: Vec3, cull = false): number | null {
  const edge1 = sub(b, a), edge2 = sub(c, a), normal = cross(edge1, edge2)
  let DdN = dot(ray.direction, normal), sign: number
  if (DdN > 0) {
    if (cull) return null
    sign = 1
  } else if (DdN < 0) {
    sign = -1
    DdN = -DdN
  } else return null
  const diff = sub(ray.origin, a)
  const DdQxE2 = sign * dot(ray.direction, cross(diff, edge2))
  if (DdQxE2 < 0) return null
  const DdE1xQ = sign * dot(ray.direction, cross(edge1, diff))
  if (DdE1xQ < 0 || DdQxE2 + DdE1xQ > DdN) return null
  const QdN = -sign * dot(diff, normal)
  if (QdN < 0) return null
  return QdN / DdN
}

/** Whether `ray` passes through the box `[min, max]` ahead of its origin (the slab test). */
export function rayHitsBox(ray: Ray, min: Vec3, max: Vec3): boolean {
  let near = -Infinity, far = Infinity
  for (let k = 0; k < 3; k++) {
    const o = ray.origin[k]!, d = ray.direction[k]!
    if (Math.abs(d) < 1e-12) {
      if (o < min[k]! || o > max[k]!) return false
      continue
    }
    const t1 = (min[k]! - o) / d, t2 = (max[k]! - o) / d
    near = Math.max(near, Math.min(t1, t2))
    far = Math.min(far, Math.max(t1, t2))
  }
  return far >= Math.max(near, 0)
}

/** A polygon fanned from its first point into triangles, as faces are drawn. */
export function fan(points: ReadonlyArray<Vec3>): Array<[Vec3, Vec3, Vec3]> {
  return points.slice(1, -1).map((_, i) => [points[0]!, points[i + 1]!, points[i + 2]!])
}
/** Where the segment from `start` to `end` crosses `triangles`: each crossing's distance from `start`. */
export function segmentHits(start: Vec3, end: Vec3, triangles: Iterable<readonly [Vec3, Vec3, Vec3]>): Array<number> {
  const delta = sub(end, start), reach = Math.hypot(...delta), ray: Ray = { origin: start, direction: scale(delta, 1 / reach) }
  const out: Array<number> = []
  for (const [a, b, c] of triangles) {
    const t = rayTriangle(ray, a, b, c)
    if (t !== null && t <= reach) out.push(t)
  }
  return out
}
