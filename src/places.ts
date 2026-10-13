/**
 * Where something happened, in words: a street named after the nearest
 * landmark ("Mill Lane", "Chapel Street"), so a fire or a theft can be told
 * as news. The same building always gives its streets the same name.
 */
import type { KindId } from "./content.ts"
import { ringOf } from "./appeal.ts"

const streetOf: Readonly<Record<KindId, string>> = {
  townhall: "Hall", warehouse: "Warehouse", granary: "Granary", lumberjack: "Timber", forester: "Forest", quarry: "Quarry",
  mine: "Mine", fishery: "Fisher", smokehouse: "Smokehouse", sawmill: "Sawmill", smithy: "Smithy", farm: "Farm", mill: "Mill",
  bakery: "Baker", sheep: "Shepherd", weaver: "Weaver", market: "Market", chapel: "Chapel", firewatch: "Watch", healer: "Healer",
  hospital: "Hospital", watchhouse: "Constable", builder: "Builder"
}
const suffixes = ["Lane", "Street", "Row", "Way", "Close", "Walk"] as const

export interface Landmark {
  readonly kind: KindId
  readonly x: number
  readonly y: number
  readonly size: number
}

/** The street a cell is on: named after the nearest landmark within eight cells, or the edge of town. */
export const placeName = (landmarks: ReadonlyArray<Landmark>, cell: { readonly x: number; readonly y: number }): string => {
  let best: Landmark | null = null
  let distance = 9
  for (const l of landmarks) {
    const d = ringOf(l, cell.x, cell.y)
    if (d < distance) {
      best = l
      distance = d
    }
  }
  if (!best) return "the edge of town"
  const suffix = suffixes[(Math.imul(best.x * 73 + best.y * 31 + 7, 2654435761) >>> 0) % suffixes.length]!
  return `${streetOf[best.kind]} ${best.kind === "townhall" ? "Square" : suffix}`
}

/** "one", "two", … for small counts in the news. */
export const counted = (n: number, one: string, many = `${one}s`) =>
  `${n <= 10 ? ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] : n} ${n === 1 ? one : many}`
