/**
 * The town's world. Every entity is assembled from small components (see
 * `archetypes.ts`): a `Tile` on the grid, then whichever roles it has. The
 * land is `Tree`s, `Rock`s, `Water`, and a farm's `Field`s; the town is
 * `Road`s, `House`s, and `Building`s that may hold an `Inventory`, follow a
 * `Recipe`, gather from the land (`Gatherer`), plant (`Planter`), send
 * `Carriers`, or offer a `Service`. A building still owed materials is a
 * `Site`; one going up is `Rising`. Walkers follow a `Route` on an `Errand`
 * or a `Roam`, as children of the building that sent them.
 *
 * Saved components and resources are constructed with a validator, so the
 * whole world snapshots to plain data and loads back checked.
 */
import { Decode, Descriptor, Schema } from "@typeonce/bevy-ts"
import type { OptionalReadCell } from "@typeonce/bevy-ts/Query"
import type { NodeRegistry } from "@typeonce/bevy-ts-render"

import type { BuildingView, FieldView, HouseView, RockView, Stage, TreeView, WalkerView } from "./art.ts"
import { goodIds, kindIds, type Amounts } from "./content.ts"
import type { UiValue } from "./ui.ts"

export const Root = Schema.defineRoot("Town")

/** An optional query slot's value, or `undefined` when the entity lacks it. */
export const maybe = <T>(cell: OptionalReadCell<T>) => (cell.present ? cell.get() : undefined)

const integer = Decode.integer
const cell = Decode.struct({ x: integer, y: integer })
const good = Decode.literal(...goodIds)
const service = Decode.literal("goods", "faith")
/** A count of every good. */
const amounts = Decode.struct({
  wood: integer, planks: integer, stone: integer, ore: integer, tools: integer, fish: integer,
  wheat: integer, flour: integer, bread: integer, wool: integer, cloth: integer
})

export const statuses = ["building", "idle", "working", "starved", "blocked", "unstaffed", "unconnected"] as const
export type Status = (typeof statuses)[number]

// ── On the grid ───────────────────────────────────────────────────────────

/** A square of cells on the grid, by its top cell, `size` cells a side. */
export const Tile = Descriptor.ConstructedComponent(Decode.struct({ x: integer, y: integer, size: integer }))("Town/Tile")
export const Road = Descriptor.Tag("Town/Road")
/** Materials still owed before it can go up, out of `total`. */
export const Site = Descriptor.ConstructedComponent(Decode.struct({ owed: amounts, total: integer }))("Town/Site")
/** Going up: steps since its materials were all in (see `BUILD_TICKS`). Removed once it stands. */
export const Rising = Descriptor.ConstructedComponent(Decode.struct({ ticks: integer }))("Town/Rising")

// ── The land ──────────────────────────────────────────────────────────────

export const Tree = Descriptor.ConstructedComponent(Decode.struct({ growth: integer }))("Town/Tree")
export const Rock = Descriptor.ConstructedComponent(Decode.struct({ ore: Decode.boolean, amount: integer }))("Town/Rock")
export const Water = Descriptor.Tag("Town/Water")
export const Field = Descriptor.ConstructedComponent(Decode.struct({ growth: integer }))("Town/Field")

// ── Homes ─────────────────────────────────────────────────────────────────

/** A home: its tier, residents, and steps left of each need a walker last met. */
export const House = Descriptor.ConstructedComponent(Decode.struct({
  tier: Decode.literal(1, 2),
  residents: integer,
  food: integer,
  bread: integer,
  cloth: integer,
  faith: integer,
  clock: integer
}))("Town/House")

// ── Buildings and their roles ─────────────────────────────────────────────

export const Building = Descriptor.ConstructedComponent(Decode.struct({ kind: Decode.literal(...kindIds) }))("Town/Building")
export const TownHall = Descriptor.Tag("Town/TownHall")
export const Status = Descriptor.ConstructedComponent(Decode.literal(...statuses))("Town/Status")

/** Workers it needs, and how many the town could spare it this step. */
export const Staff = Descriptor.ConstructedComponent(Decode.struct({ needed: integer, assigned: integer }))("Town/Staff")

/** Goods on hand: only the ones it `accepts`, up to `cap` of each. */
export const Inventory = Descriptor.ConstructedComponent(Decode.struct({ stock: amounts, accepts: Decode.array(good), cap: integer }))("Town/Inventory")
/** Takes any good in, and sends goods out to whoever needs them. */
export const Storage = Descriptor.Tag("Town/Storage")

/** Turns inputs (or nothing) into outputs: a job takes `period` steps of a full crew. */
export const Recipe = Descriptor.ConstructedComponent(Decode.struct({
  input: Decode.nullable(good),
  inputs: integer,
  output: good,
  batch: integer,
  period: integer,
  /** Worker-steps put into the current job (0: none started). */
  progress: integer,
  made: integer
}))("Town/Recipe")

/** Its recipe needs this within `radius` cells of its footprint. */
export const Gatherer = Descriptor.ConstructedComponent(Decode.struct({
  source: Decode.literal("tree", "stone", "ore", "field", "water"),
  radius: integer
}))("Town/Gatherer")

/** Plants trees or fields within `radius`, one every `interval` steps, up to `max`. */
export const Planter = Descriptor.ConstructedComponent(Decode.struct({
  what: Decode.literal("tree", "field"),
  radius: integer,
  interval: integer,
  cooldown: integer,
  max: integer
}))("Town/Planter")

/** Carriers it may have out at once. */
export const Carriers = Descriptor.ConstructedComponent(Decode.struct({ count: integer }))("Town/Carriers")

/** Sends a walker out every `interval` steps. */
export const Service = Descriptor.ConstructedComponent(Decode.struct({ service, interval: integer, cooldown: integer, range: integer }))("Town/Service")

// ── Walkers ───────────────────────────────────────────────────────────────

/** How a walker looks: a carrier, or a walker in its building's colour. */
export const Figure = Descriptor.ConstructedComponent(Decode.struct({ role: Decode.literal("carrier", "walker"), color: integer }))("Town/Figure")

/**
 * Where a walker is going: road cells in order, the one it last reached, and
 * how far on to the next (in steps of `CELL_STEPS`). At the last cell it has
 * arrived, and waits for its errand or roam to give it somewhere new.
 */
export const Route = Descriptor.ConstructedComponent(Decode.struct({ cells: Decode.array(cell), index: integer, step: integer }))("Town/Route")

/** Carrying `count` of a good to a building, then walking back (still carrying it, if it could not be handed over). */
export const Errand = Descriptor.ConstructedComponent(Decode.struct({
  target: Decode.handle(Root, Tile),
  good,
  count: integer,
  back: Decode.boolean
}))("Town/Errand")

/** Wandering the roads serving homes, `left` cells more, then walking back with what is left in its basket. */
export const Roam = Descriptor.ConstructedComponent(Decode.struct({ service, left: integer, basket: amounts, back: Decode.boolean }))("Town/Roam")

/** A walker belongs to the building that sent it, and goes when it goes. */
export const { relation: WalkerOf } = Descriptor.Hierarchy("Town/WalkerOf", "Town/Walkers")
/** A field belongs to the farm that sowed it. */
export const { relation: FieldOf } = Descriptor.Hierarchy("Town/FieldOf", "Town/Fields")

// ── Resources ─────────────────────────────────────────────────────────────

export const Time = Descriptor.ConstructedResource(Decode.struct({ tick: integer }))("Town/Time")
/** The deterministic random state (see `@typeonce/bevy-ts-math/Random`). */
export const Rng = Descriptor.ConstructedResource(integer)("Town/Rng")
export const Treasury = Descriptor.ConstructedResource(Decode.struct({ coins: integer }))("Town/Treasury")
/** The last collection's taxes, trade, and upkeep, per minute. */
export const Ledger = Descriptor.ConstructedResource(Decode.struct({ taxes: integer, trade: integer, upkeep: integer }))("Town/Ledger")
export const Census = Descriptor.ConstructedResource(Decode.struct({
  homes: integer,
  settlers: integer,
  citizens: integer,
  jobs: integer,
  employed: integer,
  /** Homes with each need met right now. */
  food: integer,
  bread: integer,
  cloth: integer,
  faith: integer
}))("Town/Census")
/** The town's tax rates (in percent of the usual, for each tier), and what it sells to traders beyond the reserve it keeps. */
export const Policy = Descriptor.ConstructedResource(Decode.struct({ settlers: integer, citizens: integer, sells: Decode.array(good), reserve: integer }))("Town/Policy")

/** What stands on each cell, rebuilt every step from the tiles (see `grid.ts`). */
export type Use = "empty" | "road" | "house" | "building" | "tree" | "rock" | "water" | "field"
export interface GridValue {
  /** Entity id on each cell (by `key`), or 0. */
  readonly owner: ReadonlyArray<number>
  readonly use: ReadonlyArray<Use>
}
export const Grid = Descriptor.TransientResource<GridValue>()("Town/Grid")
/** Goods in the town's storage, summed every step. */
export const Stock = Descriptor.TransientResource<Amounts>()("Town/Stock")

// ── Host services ─────────────────────────────────────────────────────────

export const Ui = Descriptor.Service<UiValue>()("Town/Ui")
/** The frame's length, for animation only: the simulation runs on `Time`. */
export const Clock = Descriptor.Service<{ deltaSeconds: number; elapsed: number }>()("Town/Clock")
export const StageService = Descriptor.Service<Stage>()("Town/Stage")
export const BuildingNodes = Descriptor.Service<NodeRegistry.NodeRegistry<BuildingView>>()("Town/BuildingNodes")
export const HouseNodes = Descriptor.Service<NodeRegistry.NodeRegistry<HouseView>>()("Town/HouseNodes")
export const WalkerNodes = Descriptor.Service<NodeRegistry.NodeRegistry<WalkerView>>()("Town/WalkerNodes")
export const TreeNodes = Descriptor.Service<NodeRegistry.NodeRegistry<TreeView>>()("Town/TreeNodes")
export const RockNodes = Descriptor.Service<NodeRegistry.NodeRegistry<RockView>>()("Town/RockNodes")
export const FieldNodes = Descriptor.Service<NodeRegistry.NodeRegistry<FieldView>>()("Town/FieldNodes")

export const Game = Schema.bind(
  Schema.fragment({
    components: {
      Tile, Road, Site, Rising, Tree, Rock, Water, Field, House, Building, TownHall, Status, Staff, Inventory, Storage,
      Recipe, Gatherer, Planter, Carriers, Service, Figure, Route, Errand, Roam
    },
    resources: { Time, Rng, Treasury, Ledger, Census, Policy, Grid, Stock },
    relations: { WalkerOf, FieldOf }
  }),
  Root
)
