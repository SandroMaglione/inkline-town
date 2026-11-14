/**
 * The town's model space: grid cells and pixel heights (see `primitives.ts`)
 * to world units. A 30° elevation and 45° heading reproduce the game's 64×32
 * projection; the vertical conversion keeps pixel-authored heights exact.
 */
import type { Vertex } from "./primitives.ts"
import type { Vec3 } from "../mesh/vec3.ts"

export const floorScale = 32 * Math.SQRT2
export const heightScale = 1 / Math.cos(Math.PI / 6)
export const vertex3 = ([u, v, z]: Vertex): Vec3 => [u * floorScale, z / Math.cos(Math.PI / 6), v * floorScale]
