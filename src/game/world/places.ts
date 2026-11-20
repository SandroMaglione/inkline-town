/**
 * Where something happened: the street named after the nearest landmark,
 * so a fire or a theft can be told as news. It is told as data (which
 * landmark, and which of the ways a street is called: see `Place`), and the
 * page's language names it ("Mill Lane", "Chapel Street"). The same building
 * always gives its streets the same name.
 */
import type { KindId } from "../content/index.ts"
import { STREET_WAYS, type Place } from "../said.ts"
import { ringOf } from "./appeal.ts"

export interface Landmark {
  readonly kind: KindId
  readonly x: number
  readonly y: number
  readonly size: number
}

/** The street a cell is on: named after the nearest landmark within eight cells, or (`null`) the edge of town. */
export const placeName = (landmarks: ReadonlyArray<Landmark>, cell: { readonly x: number; readonly y: number }): Place => {
  let best: Landmark | null = null
  let distance = 9
  for (const l of landmarks) {
    const d = ringOf(l, cell.x, cell.y)
    if (d < distance) {
      best = l
      distance = d
    }
  }
  if (!best) return null
  return { kind: best.kind, way: (Math.imul(best.x * 73 + best.y * 31 + 7, 2654435761) >>> 0) % STREET_WAYS }
}
