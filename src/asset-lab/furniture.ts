import { U } from "../iso.ts"
import { Drawing } from "./primitives.ts"
import { block, wood, iron } from "./workshops.ts"
import { human } from "./dimensions.ts"

/** Furniture shares its dimensions in the work yard and on delivery carts. */
export function chair(d: Drawing, u: number, v: number, z = 0) {
  for (const x of [-0.7, 0.7]) for (const y of [-0.7, 0.7])
    block(d, u + x * U, v + y * U, 0.15 * U, 0.15 * U, z, y < 0 ? 9.5 : human.seat, wood, 0.45)
  block(d, u, v, U, U, z + human.seat, 0.65, wood, 0.55)
  for (const h of [7, 9]) block(d, u, v - 0.7 * U, 0.7 * U, 0.15 * U, z + h, 0.5, wood, 0.45)
}

export function chest(d: Drawing, u: number, v: number, z = 0) {
  block(d, u, v, 1.8 * U, 1.1 * U, z + 0.35, 3.6, wood, 0.65)
  block(d, u, v, 1.95 * U, 1.25 * U, z + 3.95, 0.7, wood, 0.65)
  for (const x of [-1.2, 1.2]) block(d, u + x * U, v + 1.12 * U, 0.12 * U, 0.06 * U, z + 0.5, 3.4, iron, 0.3)
  block(d, u, v + 1.3 * U, 0.25 * U, 0.08 * U, z + 3.1, 1, iron, 0.4)
}
