/**
 * The bridge between the page and the town. The page writes the pointer and
 * gestures; the town's present systems turn gestures into a selection, a
 * preview, and edits; the simulation applies the edits on its next step.
 * None of it is saved: it is host state, handed to systems as a service.
 */
import type { Amounts, GoodId, KindId, Tier } from "./content.ts"
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
  /** Sells a good to traders, or stops selling it. */
  | { readonly type: "sell"; readonly good: GoodId; readonly on: boolean }
  /** How much of each good the town keeps before selling. */
  | { readonly type: "reserve"; readonly amount: number }
  /** Clears everything and founds a new town on land grown from `seed`. */
  | { readonly type: "newTown"; readonly seed: number }

/** What the pointer did, in world pixels. */
export type Gesture =
  | { readonly type: "press"; readonly at: Point }
  | { readonly type: "release"; readonly at: Point; readonly panned: boolean }

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

/** The town's numbers for the top bar. */
export interface Stats {
  readonly coins: number
  readonly taxes: number
  readonly trade: number
  readonly upkeep: number
  /** Coins a minute: taxes less upkeep. */
  readonly net: number
  readonly homes: number
  /** Homes with each need met. */
  readonly needs: { readonly food: number; readonly bread: number; readonly cloth: number; readonly faith: number }
  readonly policy: { readonly settlers: number; readonly citizens: number; readonly sells: ReadonlyArray<GoodId>; readonly reserve: number }
  readonly stock: Amounts
  readonly settlers: number
  readonly citizens: number
  readonly jobs: number
  readonly employed: number
}

export interface UiValue {
  tool: Tool
  /** The kind being placed with the `place` tool. */
  placing: KindId | null
  /** Which side panel the toolbar opened, when nothing is selected. */
  menu: "build" | "town" | null
  /** The pointer in world pixels, or `null` off the canvas. */
  pointer: Point | null
  /** Where a road or a row of homes being dragged started. */
  dragFrom: Point | null
  selected: number | null
  gestures: Array<Gesture>
  edits: Array<Edit>
  preview: Preview
  hits: ReadonlyArray<HitBox>
  panel: Panel | null
  /** Where each building and home stands (world pixels), for the camera to look at. */
  centres: ReadonlyMap<number, Point>
  stats: Stats | null
  toast: (message: string) => void
}
