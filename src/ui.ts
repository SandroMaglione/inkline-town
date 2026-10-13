/**
 * The bridge between the page and the town. The page writes the pointer and
 * gestures; the town's present systems turn gestures into a selection, a
 * preview, and edits; the simulation applies the edits on its next step.
 * None of it is saved: it is host state, handed to systems as a service.
 */
import type { Amounts, CharterValue, GoodId, KindId, Tier } from "./content.ts"
import type { Point } from "./iso.ts"
import type { Status } from "./schema.ts"

export type Tool = "select" | "road" | "home" | "bulldoze" | "place"

/** A change to the town, applied by the simulation (see `ApplyEdits`). */
export type Edit =
  /** `open`: show the new building in the panel. */
  | { readonly type: "building"; readonly kind: KindId; readonly cell: Point; readonly open: boolean }
  | { readonly type: "homes"; readonly cells: ReadonlyArray<Point> }
  | { readonly type: "roads"; readonly cells: ReadonlyArray<Point> }
  /** Removes whatever stands on a cell (not rocks, water, or the town hall). */
  | { readonly type: "remove"; readonly cell: Point }
  /** Sets a tier's tax rate, in percent of the usual. */
  | { readonly type: "tax"; readonly tier: "settlers" | "citizens"; readonly rate: number }
  /** Sells a good to traders beyond the reserve, buys it up to the reserve, or neither. */
  | { readonly type: "trade"; readonly good: GoodId; readonly mode: TradeMode }
  /** How much of each good the town keeps before selling, and buys up to. */
  | { readonly type: "reserve"; readonly amount: number }
  /** Pauses the building on a cell, or sets it back to work. */
  | { readonly type: "pause"; readonly cell: Point; readonly on: boolean }
  /** Sends the crown what it asked for. */
  | { readonly type: "deliver" }
  /** Having completed the town, stays on to govern it to the end of the term. */
  | { readonly type: "govern" }
  /** Clears everything and founds a new town on the land a charter describes. */
  | { readonly type: "newTown"; readonly charter: CharterValue }

export type TradeMode = "sell" | "buy" | "none"

/** What the pointer did, in grid coordinates. */
export type Gesture =
  | { readonly type: "press"; readonly at: Point }
  | { readonly type: "release"; readonly at: Point; readonly panned: boolean; readonly hit?: number | null }

export type Look = "hover" | "picked" | "blocked" | "reach"

/** What the town shows besides its entities: ghosts, the road being dragged, outlines. */
export interface Preview {
  /** Outlines on the floor: `size` cells a side from (x, y). */
  plots: Array<{ readonly x: number; readonly y: number; readonly size: number; readonly look: Look }>
  /** Ghost buildings and homes, at their footprints' top cells. */
  ghosts: Array<{ readonly what: KindId | "home"; readonly cell: Point }>
  /** Road cells about to be laid. */
  roads: Array<Point>
  /** The entity under the pointer. */
  hover: number | null
  /** Bulldozing: the hovered thing is tinted. */
  danger: boolean
  tooltip: string | null
}

export const emptyPreview = (): Preview => ({ plots: [], ghosts: [], roads: [], hover: null, danger: false, tooltip: null })

/** The side panel: the build menu, the town's numbers and taxes, a building, or a home. */
export type Panel =
  | { readonly type: "build" }
  | { readonly type: "town" }
  | {
      readonly type: "building"
      readonly id: number
      readonly cell: Point
      readonly kind: KindId
      readonly status: Status
      /** Why it is not working, when it is not. */
      readonly problem: string | null
      /** Whether it can be paused (not the town hall, not a site), and whether it is. */
      readonly pausable: boolean
      readonly paused: boolean
      readonly lines: ReadonlyArray<string>
    }
  | {
      readonly type: "house"
      readonly id: number
      readonly cell: Point
      readonly tier: Tier
      readonly lines: ReadonlyArray<string>
    }

/** A thing's hit area for the pointer, nearest first. */
export interface HitBox {
  readonly id: number
  readonly depth: number
  readonly contains: (at: Point) => boolean
}

/** The town's numbers for the top bar and the panels. */
export interface Stats {
  readonly coins: number
  readonly taxes: number
  readonly trade: number
  readonly upkeep: number
  readonly admin: number
  /** Coins a minute: taxes and trade less upkeep and administration. */
  readonly net: number
  readonly homes: number
  /** Homes with each need met. */
  readonly needs: { readonly food: number; readonly bread: number; readonly cloth: number; readonly faith: number }
  readonly policy: {
    readonly settlers: number
    readonly citizens: number
    readonly sells: ReadonlyArray<GoodId>
    readonly buys: ReadonlyArray<GoodId>
    readonly reserve: number
  }
  readonly stock: Amounts
  /** Each good's price with traders, in percent of the usual. */
  readonly prices: Amounts
  readonly settlers: number
  readonly citizens: number
  readonly jobs: number
  readonly employed: number
  readonly charter: CharterValue
  /** Minutes into the term. */
  readonly minute: number
  readonly season: { readonly year: number; readonly winter: boolean; readonly left: number }
  readonly mood: {
    readonly approval: number
    readonly target: number
    readonly parts: ReadonlyArray<{ readonly label: string; readonly value: number }>
  }
  /** The crown's open request, if any: seconds left to answer it. */
  readonly crown: {
    readonly open: boolean
    readonly good: GoodId
    readonly amount: number
    readonly left: number
    readonly reward: number
    readonly met: number
    readonly missed: number
    /** Missed in a row, and how many in a row the crown puts up with. */
    readonly streak: number
    readonly patience: number
    /** Seconds until the next request. */
    readonly next: number
  }
  readonly fate: {
    readonly state: "playing" | "won" | "lost" | "over"
    readonly reason: string
    /** Minute the term ended. */
    readonly at: number
    readonly governing: boolean
    readonly score: number
    /** Seconds left before each danger ends the term, or `null` when it is not threatening. */
    readonly bankrupt: number | null
    readonly revolt: number | null
    /** Seconds the goals have to hold still, or `null` when they are not all met. */
    readonly complete: number | null
    readonly peak: number
  }
  readonly goals: ReadonlyArray<{ readonly text: string; readonly value: string; readonly met: boolean }>
  readonly larder: number
  readonly history: ReadonlyArray<{
    readonly tick: number
    readonly coins: number
    readonly residents: number
    readonly citizens: number
    readonly approval: number
    readonly net: number
  }>
  readonly chronicle: ReadonlyArray<{ readonly tick: number; readonly text: string }>
}

export interface UiValue {
  tool: Tool
  /** The kind being placed with the `place` tool. */
  placing: KindId | null
  /** Which side panel the toolbar opened, when nothing is selected. */
  menu: "build" | "town" | null
  /** The pointer on the grid, or `null` off the canvas. */
  pointer: Point | null
  /** Camera-ray entity hit. Undefined allows grid-only headless interaction. */
  pointerHit?: number | null
  /** Where a road or a row of homes being dragged started. */
  dragFrom: Point | null
  selected: number | null
  gestures: Array<Gesture>
  edits: Array<Edit>
  preview: Preview
  hits: ReadonlyArray<HitBox>
  panel: Panel | null
  /** Where each building and home stands on the grid, for the camera to look at. */
  centres: ReadonlyMap<number, Point>
  stats: Stats | null
  /** Steps of the simulation a fixed step: 0 (paused), 1, 2, or 4. */
  speed: number
  /** The new-town dialog is open: the town waits. */
  founding: boolean
  toast: (message: string) => void
}
