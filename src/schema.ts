/**
 * The town's world. Every entity is assembled from small components (see
 * `archetypes.ts`): a `Tile` on the grid, then whichever roles it has. The
 * land is `Tree`s, `Rock`s, `Water`, and a farm's `Field`s; the town is
 * `Road`s, `Park` cells, `House`s, and `Building`s that may hold an `Inventory`, follow a
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

import type { BuildingView, FieldView, HouseView, RockView, RuinView, TreeView, WalkerView } from "./render3d/views.ts"
import type { GameScene } from "./render3d/scene.ts"
import { goodIds, groundIds, kindIds, landIds, propIds, serviceIds, sizeIds, type Amounts } from "./content.ts"
import type { Rules as RuleInputs } from "./rules/config.ts"
import type { UiValue } from "./ui.ts"

export const Root = Schema.defineRoot("Town")

/** An optional query slot's value, or `undefined` when the entity lacks it. */
export const maybe = <T>(cell: OptionalReadCell<T>) => (cell.present ? cell.get() : undefined)

const integer = Decode.integer
const cell = Decode.struct({ x: integer, y: integer })
const good = Decode.literal(...goodIds)
const service = Decode.literal(...serviceIds)
/** A count of every good. */
const amounts = Decode.struct({
  wood: integer, planks: integer, stone: integer, ore: integer, tools: integer, fish: integer, smoked: integer,
  wheat: integer, flour: integer, bread: integer, wool: integer, cloth: integer
})

export const statuses = ["building", "idle", "working", "starved", "blocked", "unstaffed", "unconnected", "paused"] as const
export type Status = (typeof statuses)[number]

// ── On the grid ───────────────────────────────────────────────────────────

/** A square of cells on the grid, by its top cell, `size` cells a side. */
export const Tile = Descriptor.ConstructedComponent(Decode.struct({ x: integer, y: integer, size: integer }))("Town/Tile")
export const Road = Descriptor.Tag("Town/Road")
/** A road paved with stone: a little nicer to live on (see `appeal.ts`). */
export const Paved = Descriptor.Tag("Town/Paved")
/** A cell of park: its ground, and what stands on it (see `parks` in content). */
export const Park = Descriptor.ConstructedComponent(Decode.struct({ ground: Decode.literal(...groundIds), prop: Decode.literal("none", ...propIds) }))("Town/Park")
/** What is left of a home or building that burned, fell down, or was left derelict, until it is cleared. */
export const Ruin = Descriptor.ConstructedComponent(Decode.struct({ cause: Decode.literal("burnt", "collapsed", "derelict") }))("Town/Ruin")
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
  tier: Decode.literal(1, 2, 3),
  residents: integer,
  food: integer,
  bread: integer,
  cloth: integer,
  faith: integer,
  clock: integer
}))("Town/House")

// ── Risks and wear (homes and buildings) ──────────────────────────────────

/**
 * Risk meters, 0 → `RISK_MAX` (see `risk` in content): fire, sickness, and
 * disorder (a building only has the first), and thefts since a constable last
 * passed.
 */
export const Risk = Descriptor.ConstructedComponent(Decode.struct({ fire: integer, health: integer, order: integer, thefts: integer }))("Town/Risk")
/** How well kept it is, 0 → `CONDITION_MAX`; it falls into ruin at nothing. */
export const Condition = Descriptor.ConstructedComponent(Decode.struct({ value: integer }))("Town/Condition")
/** On fire: steps until it is lost, and which fire (see `Fires`) it belongs to. */
export const Burning = Descriptor.ConstructedComponent(Decode.struct({ left: integer, fire: integer }))("Town/Burning")
/** A sick household: steps until it passes on its own. */
export const Sick = Descriptor.ConstructedComponent(Decode.struct({ left: integer }))("Town/Sick")

// ── Buildings and their roles ─────────────────────────────────────────────

export const Building = Descriptor.ConstructedComponent(Decode.struct({ kind: Decode.literal(...kindIds) }))("Town/Building")
export const TownHall = Descriptor.Tag("Town/TownHall")
export const Status = Descriptor.ConstructedComponent(Decode.literal(...statuses))("Town/Status")
/** Stopped by the town: no workers, a quarter of its upkeep. */
export const Paused = Descriptor.Tag("Town/Paused")
/** Upgraded where it stands (see `Kind.upgrade`): its walker, desirability, and upkeep are the upgrade's. */
export const Upgraded = Descriptor.Tag("Town/Upgraded")

/**
 * Workers it needs, how many came (`apprentices` of them settlers standing
 * in for citizens), and how many of its crew live within a commute.
 */
export const Staff = Descriptor.ConstructedComponent(Decode.struct({ needed: integer, assigned: integer, apprentices: integer, nearby: integer }))("Town/Staff")

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
/** The next tour of a service's district. Optional in older saved worlds. */
export const Patrol = Descriptor.ConstructedComponent(Decode.struct({ next: integer }))("Town/Patrol")

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

/** A firefighter running to a blaze, then walking back. */
export const Rescue = Descriptor.ConstructedComponent(Decode.struct({ target: Decode.handle(Root, Tile), back: Decode.boolean }))("Town/Rescue")

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
/** The last collection's taxes, trade (sold less bought), upkeep, and administration, per minute. */
export const Ledger = Descriptor.ConstructedResource(Decode.struct({ taxes: integer, trade: integer, upkeep: integer, admin: integer }))("Town/Ledger")
export const Census = Descriptor.ConstructedResource(Decode.struct({
  homes: integer,
  settlers: integer,
  /** Residents of citizens' homes and townhouses together: the citizens the goals count. */
  citizens: integer,
  /** Of the citizens, those in townhouses. */
  burghers: integer,
  jobs: integer,
  employed: integer,
  /** Homes with each need met right now. */
  food: integer,
  bread: integer,
  cloth: integer,
  faith: integer,
  /** Homes sick, and homes and buildings on fire, right now. */
  sick: integer,
  burning: integer
}))("Town/Census")
/**
 * The town's tax rates (in percent of the usual, for each tier), what it
 * sells to traders beyond the reserve it keeps, and what it buys up to it;
 * `loads` is how much of each good may change hands at a collection.
 */
export const Policy = Descriptor.ConstructedResource(Decode.struct({
  settlers: integer,
  citizens: integer,
  sells: Decode.array(good),
  buys: Decode.array(good),
  reserve: integer,
  loads: amounts
}))("Town/Policy")

/**
 * What the town was founded on: the size of its land, its term in minutes,
 * how rich the land is, its seed, and the step it was founded on.
 */
export const Charter = Descriptor.ConstructedResource(Decode.struct({
  size: Decode.literal(...sizeIds),
  term: integer,
  land: Decode.literal(...landIds),
  seed: integer,
  founded: integer,
  /** Each year's winter, rolled when the town is founded: "none" for the first, then mild, normal, or hard. */
  winters: Decode.array(Decode.literal("none", "mild", "normal", "hard"))
}))("Town/Charter")
/** Which cells are land ("1") and which open water beyond the coast ("0"), by `key`; and how many are land. */
export const Land = Descriptor.ConstructedResource(Decode.struct({ mask: Decode.string, cells: integer }))("Town/Land")

/** Each good's price with traders, in percent of the usual (see `market`). */
export const Market = Descriptor.ConstructedResource(Decode.struct({ prices: amounts }))("Town/Market")

/** The town's approval, -100 → 100, where it is heading, and why: each part of the target. */
export const Mood = Descriptor.ConstructedResource(Decode.struct({
  approval: integer,
  target: integer,
  base: integer,
  needs: integer,
  taxes: integer,
  debt: integer,
  crown: integer,
  winter: integer,
  /** The grudge over taxes past: points off the target now, and the town's memory of them in tenths (see `mood.grudge`). */
  grudge: integer,
  memory: integer
}))("Town/Mood")

/**
 * The crown's requests: the one open now (if `open`), when the next comes,
 * how many were met and missed (and missed in a row), and when the misses
 * the crown still remembers were.
 */
export const Crown = Descriptor.ConstructedResource(Decode.struct({
  open: Decode.boolean,
  good,
  amount: integer,
  issued: integer,
  due: integer,
  reward: integer,
  next: integer,
  met: integer,
  missed: integer,
  /** Requests missed since one was last met. */
  streak: integer,
  snubs: Decode.array(integer)
}))("Town/Crown")

export const fateStates = ["playing", "lost", "over"] as const
/**
 * How the term is going: still `playing`; `lost` (bankrupt, in revolt,
 * abandoned, or dismissed by the crown), or `over` (the term ran out: the
 * mayor may stand for another), with why and when. `term` is which term
 * this is, from 1, and `began` the step (since the founding) it began on;
 * `rank` the highest the town has reached (see `ranks`). The `since`
 * fields are when each danger (or the next rank's goals) began, or -1.
 */
export const Fate = Descriptor.ConstructedResource(Decode.struct({
  state: Decode.literal(...fateStates),
  reason: Decode.string,
  at: integer,
  term: integer,
  began: integer,
  rank: integer,
  debtSince: integer,
  revoltSince: integer,
  goalSince: integer,
  peak: integer,
  score: integer
}))("Town/Fate")

/** The town over its term: a sample every `HISTORY_TICKS`. */
export const History = Descriptor.ConstructedResource(Decode.struct({
  samples: Decode.array(Decode.struct({ tick: integer, coins: integer, residents: integer, citizens: integer, approval: integer, net: integer }))
}))("Town/History")
/** What happened, in a line each; an `alarm` is news the page announces (a fire, a theft, winter coming); `at` is where, when it was somewhere. */
export const Chronicle = Descriptor.ConstructedResource(Decode.struct({
  lines: Decode.array(Decode.struct({ tick: integer, text: Decode.string, alarm: Decode.boolean, at: Decode.nullable(cell) }))
}))("Town/Chronicle")

/**
 * The mayor's guide (see `rules/guide.ts`): the steps it has put away, done or
 * dismissed, and whether the mayor turned it off. Written by the page, not the
 * simulation; saved with the town.
 */
export const Guide = Descriptor.ConstructedResource(Decode.struct({ done: Decode.array(Decode.string), off: Decode.boolean }))("Town/Guide")
/** How desirable each cell is to live on (by `key`), reckoned every `appeal.every` steps; empty before the first. */
export const Appeal = Descriptor.ConstructedResource(Decode.struct({ cells: Decode.array(integer) }))("Town/Appeal")

/**
 * The town's food over the last minute: what walkers handed out and what
 * rotted, counting now, and the last full minute's totals.
 */
export const Pantry = Descriptor.ConstructedResource(Decode.struct({ eaten: integer, rotted: integer, eatenLast: integer, rottedLast: integer, warned: integer }))("Town/Pantry")

/** Fires burning now (each started at a cell, the homes and buildings it took so far), and the next fire's number. */
export const Fires = Descriptor.ConstructedResource(Decode.struct({
  fires: Decode.array(Decode.struct({ id: integer, x: integer, y: integer, homes: integer, buildings: integer })),
  next: integer
}))("Town/Fires")

/** What stands on each cell, rebuilt every step from the tiles (see `grid.ts`). */
/** `void`: off the land, past the coast. */
export type Use = "empty" | "road" | "park" | "house" | "building" | "tree" | "rock" | "water" | "field" | "ruin" | "void"
export interface GridValue {
  /** Entity id on each cell (by `key`), or 0. */
  readonly owner: ReadonlyArray<number>
  readonly use: ReadonlyArray<Use>
  /** A fingerprint of where the roads are, when known: paths are cached against it. */
  readonly roads?: number
  /** The entities standing on it, when known: the grid only changes when one of them goes. */
  readonly tiles?: ReadonlySet<number>
  /** Paved road cells (by `key`), when known: walkers and carriers move faster along them. */
  readonly paved?: ReadonlySet<number>
}
export const Grid = Descriptor.TransientResource<GridValue>()("Town/Grid")
/** Goods in the town's storage, summed every step. */
export const Stock = Descriptor.TransientResource<Amounts>()("Town/Stock")
/** Ten seconds of goods: what the town held as it began, what was made, and what was traded. */
export interface FlowSlice {
  readonly start: Amounts
  readonly made: Amounts
  readonly traded: Amounts
  readonly coins: CoinSlice
}
/**
 * Ten seconds of the treasury, counted as goods are: what it held as the
 * slice began, what came in (taxes, rewards, refunds), and what trade
 * brought (sold less bought). What went out is what is left over.
 */
export interface CoinSlice {
  readonly start: number
  readonly made: number
  readonly traded: number
}
/**
 * Where the town's goods go, over the last minute, a slice of `FLOW_SLICE`
 * at a time (not saved: it starts over on a load). `made` by workshops and
 * gatherers and `traded` (bought less sold) are counted into the slice under
 * way, which began at `since` holding `start`; `held` is everything the
 * town holds now, in storage or not (workshops, markets, walkers' baskets,
 * carriers' crates). What was used (eaten, worked up, built with, rotted,
 * sent to the crown) is what is left over: `start + made + traded − held`.
 */
export interface FlowValue {
  /** Which town it counts (its seed and founding step): a new or loaded town starts over. */
  readonly town: string
  readonly since: number
  readonly start: Amounts | null
  readonly made: Amounts
  readonly traded: Amounts
  readonly held: Amounts
  /**
   * The treasury's slice under way. `seen` is the treasury the last count
   * saw, and `booked` what the collection has already counted since (its
   * taxes and trade): any other change in between is a coin made, or one
   * left over as used.
   */
  readonly coins: CoinSlice & { readonly seen: number; readonly booked: number }
  /** The last minute's slices, oldest first. */
  readonly slices: ReadonlyArray<FlowSlice>
  /** A minute's worth over the slices kept, or `null` before there are enough to say. */
  readonly last: {
    readonly made: Amounts
    readonly used: Amounts
    readonly traded: Amounts
    readonly coins: { readonly made: number; readonly used: number; readonly traded: number }
  } | null
}
export const Flow = Descriptor.TransientResource<FlowValue>()("Town/Flow")

// ── Host services ─────────────────────────────────────────────────────────

export const Rules = Descriptor.Service<RuleInputs>()("Town/Rules")
export const Ui = Descriptor.Service<UiValue>()("Town/Ui")
/** The frame's length, for animation only: the simulation runs on `Time`. */
export const Clock = Descriptor.Service<{ deltaSeconds: number; elapsed: number }>()("Town/Clock")
export const StageService = Descriptor.Service<GameScene>()("Town/Stage")
export const BuildingNodes = Descriptor.Service<NodeRegistry.NodeRegistry<BuildingView>>()("Town/BuildingNodes")
export const HouseNodes = Descriptor.Service<NodeRegistry.NodeRegistry<HouseView>>()("Town/HouseNodes")
export const WalkerNodes = Descriptor.Service<NodeRegistry.NodeRegistry<WalkerView>>()("Town/WalkerNodes")
export const TreeNodes = Descriptor.Service<NodeRegistry.NodeRegistry<TreeView>>()("Town/TreeNodes")
export const RockNodes = Descriptor.Service<NodeRegistry.NodeRegistry<RockView>>()("Town/RockNodes")
export const FieldNodes = Descriptor.Service<NodeRegistry.NodeRegistry<FieldView>>()("Town/FieldNodes")
export const RuinNodes = Descriptor.Service<NodeRegistry.NodeRegistry<RuinView>>()("Town/RuinNodes")

export const Game = Schema.bind(
  Schema.fragment({
    components: {
      Tile, Road, Paved, Park, Ruin, Site, Rising, Tree, Rock, Water, Field, House, Risk, Condition, Burning, Sick, Building, TownHall, Status,
      Paused, Upgraded, Staff, Inventory, Storage, Recipe, Gatherer, Planter, Carriers, Service, Patrol, Figure, Route, Errand, Rescue, Roam
    },
    resources: {
      Time, Rng, Treasury, Ledger, Census, Policy, Charter, Land, Market, Mood, Crown, Fate, History, Chronicle, Guide, Appeal, Pantry, Fires,
      Grid, Stock, Flow
    },
    relations: { WalkerOf, FieldOf }
  }),
  Root
)
