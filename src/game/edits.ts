/**
 * What the player can ask of the town. Every UI (the page, a bot, a test)
 * and the view's map gestures send these; only the simulation applies them,
 * at the start of its next step (see `systems/edits`). Replays record them.
 */
import type { CharterValue, GoodId, GroundId, KindId, PropId } from "./content/index.ts"
import type { Point } from "./world/iso.ts"

/** A change to the town, applied by the simulation (see `ApplyEdits`). */
export type Edit =
  /** `open`: show the new building in the panel. */
  | { readonly type: "building"; readonly kind: KindId; readonly cell: Point; readonly open: boolean }
  | { readonly type: "homes"; readonly cells: ReadonlyArray<Point> }
  | { readonly type: "roads"; readonly cells: ReadonlyArray<Point> }
  /** Paves the road on each cell (coins, and stone from storage). */
  | { readonly type: "pave"; readonly cells: ReadonlyArray<Point> }
  /** Lays park ground on each empty cell (or relays a park cell's ground). */
  | { readonly type: "ground"; readonly ground: GroundId; readonly cells: ReadonlyArray<Point> }
  /** Sets a furnishing on a cell of park. */
  | { readonly type: "prop"; readonly prop: PropId; readonly cell: Point }
  /** Removes whatever stands on a cell (not rocks, water, or the town hall); on a park, its furnishing first. */
  | { readonly type: "remove"; readonly cell: Point }
  /** Sets a tier's tax rate, in percent of the usual. */
  | { readonly type: "tax"; readonly tier: "settlers" | "citizens"; readonly rate: number }
  /** Sells a good to traders beyond the reserve, buys it up to the reserve, or neither; `amount`, up to how much a collection. */
  | { readonly type: "trade"; readonly good: GoodId; readonly mode: TradeMode; readonly amount?: number }
  /** How much of each good the town keeps before selling, and buys up to. */
  | { readonly type: "reserve"; readonly amount: number }
  /** Pauses the building on a cell (or closes the home), or sets it back to work. */
  | { readonly type: "pause"; readonly cell: Point; readonly on: boolean }
  /** Sends the crown what it asked for. */
  | { readonly type: "deliver" }
  /** Once a term has run out, stands for another: the same town, a new term. */
  | { readonly type: "nextTerm" }
  /** Upgrades the building on a cell where it stands (see `Kind.upgrade`). */
  | { readonly type: "upgrade"; readonly cell: Point }
  /** Clears everything and founds a new town on the land a charter describes. */
  | { readonly type: "newTown"; readonly charter: CharterValue }
  /** Puts guide steps away: the mayor skipped them, or the town has done them (see `rules/guide.ts`). */
  | { readonly type: "guide"; readonly done: ReadonlyArray<string> }
  /** Turns the mayor's guide off, or back on. */
  | { readonly type: "guideOff"; readonly off: boolean }

export type TradeMode = "sell" | "buy" | "none"

/** Edits waiting for the next step: pushed by the page and the view, taken by the simulation's `Edits` service. */
export const editQueue = () => {
  const queued: Array<Edit> = []
  return {
    queued: queued as ReadonlyArray<Edit>,
    push: (...edits: ReadonlyArray<Edit>) => {
      queued.push(...edits)
    },
    snapshot: (): ReadonlyArray<Edit> => queued.splice(0)
  }
}
export type EditQueue = ReturnType<typeof editQueue>
