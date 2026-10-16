/**
 * The bridge between the page and the town. The page writes the pointer and
 * gestures; the town's present systems turn gestures into a selection, a
 * preview, and edits; the simulation applies the edits on its next step.
 * None of it is saved: it is host state, handed to systems as a service.
 */
import type { Amounts, CharterValue, GoodId, GroundId, KindId, PropId, Tier, WinterId } from "./content.ts"
import type { IconName } from "./icons.ts"
import type { Point } from "./iso.ts"
import type { Status } from "./schema.ts"
import type { OverlayCell } from "./render3d/models.ts"

/** How a line of a panel reads: fine, worth a look, wrong, or an aside. */
export type Tone = "ok" | "warn" | "bad" | "dim"
/**
 * A line of a building's or home's description: an icon, what it is about,
 * its value, and (when something is wrong, or worth knowing) a note
 * underneath saying why and what to do. `goods` are shown as icon chips.
 */
export interface Line {
  readonly icon: IconName | GoodId
  readonly label: string
  readonly value?: string | undefined
  readonly note?: string | undefined
  readonly tone?: Tone | undefined
  readonly goods?: ReadonlyArray<{ readonly good: GoodId; readonly count: number }> | undefined
  /** What to do about it, under the note: and, when it is to build something, what (the panel offers to place it). */
  readonly fix?: { readonly text: string; readonly build?: KindId | undefined } | undefined
}

/**
 * A box of a panel's rows under a heading (`help` sits behind an ⓘ). Every
 * row reads the same way: what, then a short value; a note under it only
 * when there is something to do about it, or a line of context.
 */
export interface Group {
  readonly title: string
  readonly icon: IconName
  readonly help?: string | undefined
  readonly lines: ReadonlyArray<Line>
}

/** Something that needs looking at now, and where (when it is somewhere). */
export interface Alert {
  /** A next step to take, something going wrong, or something that costs the town now. */
  readonly tone: "hint" | "warn" | "bad"
  readonly text: string
  readonly at: Point | null
  /** The footprint there, cells a side, for the outline. */
  readonly size: number
  /** The entity to select on the way there, if there is one. */
  readonly id: number | null
  /** Buildings the line names, by kind: where one of each stands, so its chip goes there rather than placing another. */
  readonly places?: Partial<Record<KindId, { readonly at: Point; readonly size: number; readonly id: number }>>
}

export type Tool = "select" | "road" | "pave" | "home" | "bulldoze" | "place" | "ground" | "prop" | "upgrade"

/** What the map shows over the town: nothing, or one of its views, cell by cell. */
export const viewIds = ["none", "appeal", "workers", "fire", "health", "order", "condition"] as const
export type View = (typeof viewIds)[number]

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
  /** Road cells a thing being placed would reach: a service's walkers, or the commute its workers (or a home's residents) make. */
  range: Array<Point>
  /** What `range` shows, for the tooltip. */
  rangeNote: string | null
  /** Park cells about to be laid or furnished, as they will look. */
  parks: Array<{ readonly x: number; readonly y: number; readonly ground: GroundId; readonly prop: PropId | "none" }>
  /** The entity under the pointer. */
  hover: number | null
  /** Bulldozing: the hovered thing is tinted. */
  danger: boolean
  tooltip: string | null
  /** A road, pave, home, or park stroke being dragged: how much it lays and what it costs. */
  stroke: string | null
}

export const emptyPreview = (): Preview => ({ plots: [], ghosts: [], roads: [], range: [], rangeNote: null, parks: [], hover: null, danger: false, tooltip: null, stroke: null })

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
      /** How it is, as a row of its own above the rest: working, or what keeps it from it and what to do. */
      readonly state: Line
      /** Whether it can be paused (not the town hall, not a site), and whether it is. */
      readonly pausable: boolean
      readonly paused: boolean
      /** What pulling it down costs and gives back: "pull down: −25 coins · 2 planks back". */
      readonly salvage: string
      readonly groups: ReadonlyArray<Group>
      /** What it is called and what it is for, at its level of upgrades (a market hall, not a market). */
      readonly title: string
      readonly blurb: string
      /** Upgrades it has had (see `Kind.upgrade`), and whether it has had any. */
      readonly level: number
      readonly upgraded: boolean
      /**
       * The upgrade it could have next (`null`: none, or one under way): what it becomes, what it costs
       * now and carried in, what changes, and what keeps it from it now (the rank; coins short).
       */
      readonly upgrade: {
        readonly title: string
        readonly blurb: string
        readonly price: string
        /** Why the town needs it now, when it does (the gold arrow over it); `null`: it can wait. */
        readonly needed: string | null
        /** Coins now, and the materials carriers bring. */
        readonly cost: { readonly coins: number; readonly materials: Partial<Record<GoodId, number>> }
        readonly changes: ReadonlyArray<string>
        readonly blocked: string | null
        readonly short: string | null
      } | null
      /** An upgrade under way: what it is to become, the share of its materials in, and what is still owed. */
      readonly works: { readonly title: string; readonly share: number; readonly left: string } | null
    }
  | {
      readonly type: "house"
      readonly id: number
      readonly cell: Point
      readonly tier: Tier
      /** Whether it can be closed (standing, not on fire), and whether it is: a closed home stands empty and costs nothing. */
      readonly closable: boolean
      readonly closed: boolean
      readonly salvage: string
      /** How it is, in a word or two for the header ("4 residents", "hungry"), and whether that is trouble. */
      readonly summary: string
      readonly trouble: boolean
      readonly groups: ReadonlyArray<Group>
    }
  | {
      readonly type: "park"
      readonly id: number
      readonly cell: Point
      /** Cells, and the desirability it gives out to how far. */
      readonly cells: number
      readonly value: number
      readonly reach: number
      readonly lines: ReadonlyArray<Line>
    }
  | {
      readonly type: "ruin"
      readonly id: number
      readonly cell: Point
      readonly cause: "burnt" | "collapsed" | "derelict"
      readonly lines: ReadonlyArray<Line>
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
  /** What the same homes would pay a minute with every need met: taxes left on the table when it is more. */
  readonly suppliedTaxes: number
  /** Taxes a minute at each step of a tier's rate, once the homes settle at it; empty while the tier has no homes. */
  readonly taxOutlook: Readonly<Record<"settlers" | "citizens", ReadonlyArray<{ readonly rate: number; readonly taxes: number }>>>
  readonly trade: number
  readonly upkeep: number
  readonly admin: number
  /** Coins a minute: taxes and trade less upkeep and administration. */
  readonly net: number
  readonly homes: number
  /** Homes with each need met. */
  readonly needs: { readonly food: number; readonly bread: number; readonly cloth: number; readonly faith: number; readonly furniture: number }
  /** Homes that are townhouses (the ones that keep furniture). */
  readonly townhouses: number
  readonly policy: {
    readonly settlers: number
    readonly citizens: number
    readonly sells: ReadonlyArray<GoodId>
    readonly buys: ReadonlyArray<GoodId>
    readonly reserve: number
    readonly loads: Amounts
  }
  readonly stock: Amounts
  /** Each good's price with traders, in percent of the usual. */
  readonly prices: Amounts
  readonly settlers: number
  /** Citizens in citizens' homes and townhouses; of them, `burghers` in townhouses. */
  readonly citizens: number
  readonly burghers: number
  readonly jobs: number
  readonly employed: number
  /** Workplaces short of workers, to step through from the jobs counter. */
  readonly shortStaffed: ReadonlyArray<{ readonly id: number; readonly title: string; readonly cell: Point; readonly size: number; readonly assigned: number; readonly needed: number; readonly nobodyNear: boolean }>
  readonly charter: CharterValue
  /** Minutes since the town was founded (see `fate.began` for this term's). */
  readonly minute: number
  readonly season: {
    readonly year: number
    readonly winter: boolean
    readonly left: number
    /** This winter's severity, while it lasts; and the next one the almanac foresees, and the one after. */
    readonly severity: WinterId | null
    readonly coming: WinterId | null
    readonly after: WinterId | null
  }
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
    readonly state: "playing" | "lost" | "over"
    readonly reason: string
    /** Minute (since the founding) the term ended. */
    readonly at: number
    /** Which term this is, from 1, and the minute (since the founding) it began. */
    readonly term: number
    readonly began: number
    /** The rank the town has reached (see `ranks`), and the next one, or `null` at the top. */
    readonly rank: number
    readonly rankTitle: string
    readonly nextTitle: string | null
    /** This term's score, once it has ended. */
    readonly score: number
    /** Seconds left before each danger ends the term, or `null` when it is not threatening. */
    readonly bankrupt: number | null
    readonly revolt: number | null
    /** Seconds the next rank's goals have to hold still, or `null` when they are not all met. */
    readonly rises: number | null
    readonly peak: number
  }
  /** The next rank's goals (see `goalsOf`): what each asks (`target`, in its own unit), how the town stands, and whether it is met. */
  readonly goals: ReadonlyArray<{ readonly id: string; readonly target: number; readonly text: string; readonly value: string; readonly met: boolean }>
  readonly larder: number
  /**
   * Each good over the last minute: made, used (eaten, worked up, built
   * with, rotted, sent away), and bought less sold; and how much the town
   * holds outside storage now (workshops, markets, baskets, crates). A
   * rolling minute, reckoned again every ten seconds; `null` for the
   * first half minute.
   */
  readonly flow: {
    readonly made: Amounts
    readonly used: Amounts
    readonly traded: Amounts
    readonly elsewhere: Amounts
    /** The treasury over the same minute: taxes and other income, upkeep and spending, and trade. */
    readonly coins: { readonly made: number; readonly used: number; readonly traded: number }
  } | null
  /** Food the town ate, and food that rotted in store, over the last minute. */
  readonly eaten: number
  readonly rotted: number
  /** Homes sick, and homes and buildings on fire, right now. */
  readonly sick: number
  readonly burning: number
  readonly history: ReadonlyArray<{
    readonly tick: number
    readonly coins: number
    readonly residents: number
    readonly citizens: number
    readonly approval: number
    readonly net: number
  }>
  readonly chronicle: ReadonlyArray<{ readonly tick: number; readonly text: string; readonly alarm: boolean; readonly at: Point | null }>
  /** What needs looking at right now, a line each: workshops waiting, workplaces no one can reach, food running out. */
  readonly alerts: ReadonlyArray<Alert>
  /**
   * The upgrades the town could make, one for each kind and level (a market to a market hall; the town
   * hall to a guildhall, or a guildhall to a city hall): what it becomes, what it costs now and carried
   * in, what changes, what keeps it from it (the rank), and how many buildings are ready for it and under way.
   */
  readonly upgrades: ReadonlyArray<{
    readonly kind: KindId
    readonly level: number
    readonly from: string
    readonly to: string
    readonly blurb: string
    readonly coins: number
    readonly materials: Partial<Record<GoodId, number>>
    readonly price: string
    readonly changes: ReadonlyArray<string>
    readonly blocked: string | null
    readonly ready: number
    readonly underway: number
  }>
  /** The mayor's guide: the step to take now (if any, and the guide is on), and how far along it is. */
  readonly guide: {
    readonly step:
      | (Omit<Alert, "tone"> & {
          readonly key: string
          readonly chapter: string
          readonly goal: string
          /** Why the step matters, in a sentence or two (`text` is what to do). */
          readonly why: string
          /** The mayor has done their part, and the town is at work on it: what is happening (`null`: not yet). */
          readonly waiting: string | null
          /** The town cannot build what it asks for yet: what opens it (`null`: it can). */
          readonly locked: string | null
          /** The next step that waits for the town to need it, and when it comes ("Next: a quarry, once stone falls below 8"). */
          readonly next: string | null
          /** The buildings it asks for: only these become chips that place one. */
          readonly asks: ReadonlyArray<KindId>
          /** The building it points at, when that stands (`id`): its name goes there rather than placing another. */
          readonly near: KindId | null
          /** Where it stands in the opening ("step 3 of 8"), or `null` after it. */
          readonly count: { readonly at: number; readonly of: number } | null
        })
      | null
    readonly done: number
    readonly total: number
    readonly off: boolean
  }
}

/** A map view's legend: what each colour means. */
export interface Legend {
  readonly title: string
  readonly keys: ReadonlyArray<{ readonly color: number; readonly label: string }>
  readonly note: string
}

export interface UiValue {
  tool: Tool
  /** The kind being placed with the `place` tool, and the kind whose buildings the `upgrade` tool upgrades. */
  placing: KindId | null
  upgrading?: KindId | null
  /** The ground laid with the `ground` tool, and the furnishing set with the `prop` tool. */
  ground: GroundId
  prop: PropId
  /** Which side panel the toolbar opened, when nothing is selected. */
  menu: "build" | "town" | null
  /** The pointer on the grid, or `null` off the canvas. */
  pointer: Point | null
  /** Camera-ray entity hit. Undefined allows grid-only headless interaction. */
  pointerHit?: number | null
  /** Where a road, a row of homes, or a patch of park being dragged started. */
  dragFrom: Point | null
  /** The stroke from `dragFrom` is held for a tap to confirm (touch), or let go here it would be dropped (off the map). */
  stroke?: "held" | "cancel" | null
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
  /** The map view shown over the town, its cells (rebuilt as the town changes), and its legend. */
  view: View
  overlay: { readonly key: string; readonly cells: ReadonlyArray<OverlayCell> }
  /** The view's colour for each building and home, washed over the model itself so it reads from above. */
  tints: ReadonlyMap<number, number>
  /** The buildings whose upgrade the town needs now, with why (the gold arrow over each). */
  wanted: ReadonlyMap<number, string>
  legend: Legend | null
  /** A place the page points at (from the ticker): outlined until `until`, in the clock's seconds. */
  flash: { readonly cell: Point; readonly size: number; readonly until: number } | null
  /** What the mayor told the guide since the last frame: put a step away, or turn the guide off or on (see `Guide`). */
  guide: Array<{ readonly type: "skip"; readonly id: string } | { readonly type: "off" | "on" }>
  toast: (message: string) => void
}
