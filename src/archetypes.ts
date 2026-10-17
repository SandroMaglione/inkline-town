import { shippedRules, type Rules } from "./rules/config.ts"
/**
 * Content to components: how each thing in `content.ts` is assembled from
 * the schema's components. A building is a `Tile`, a `Building`, a `Status`,
 * `Staff`, and one component for each role its kind has. Anything that
 * costs materials starts as a `Site`, anything else starts `Rising`; the
 * land is a `Tile` and its own marker.
 */
import { amounts, goodIds, total, type GroundId, type Kind } from "./content.ts"
import type { Point } from "./iso.ts"
import { Building, Carriers, Condition, Field, Game, Gatherer, House, Inventory, Park, Planter, Recipe, Rising, Risk, Road, Rock, Ruin, Service, Site, Staff, Status, Storage, Tile, Tree, Water } from "./schema.ts"
import { stepsOf } from "./content.ts"

const site = (cost: Kind["cost"]) => {
  const owed = amounts(cost.materials)
  return total(owed) > 0 ? Game.Command.entry(Site, { owed, total: total(owed) }) : Game.Command.entry(Rising, { ticks: 0 })
}

/** A building of `kind` on `cell`: a site waiting for materials, or (`standing`) already up. */
export const buildingDraft = (kind: Kind, cell: Point) =>
  Game.Command.spawn(
    [Tile, { x: cell.x, y: cell.y, size: kind.size }],
    [Building, { kind: kind.id }],
    [Status, "building"],
    [Staff, { needed: kind.workers, assigned: 0, apprentices: 0, nearby: 0 }]
  )

/** The components `wearOf` inserts. */
export const WearParts = [Risk, Condition] as const
/** What every home and every working building carries: its risks, and how well kept it is. */
export const wearOf = (rules: Rules = shippedRules) => [
  Game.Command.entry(Risk, { fire: 0, health: 0, order: 0, thefts: 0 }),
  Game.Command.entry(Condition, { value: rules.conditionMax })
]

/** The components `startOf` (and `houseStart`) may insert: owed materials, or rising. */
export const StartParts = [Site, Rising] as const
/** How a new building starts: owed its materials, or rising straight away. */
export const startOf = (kind: Kind) => site(kind.cost)

/** Every component `rolesOf` may insert. */
export const RoleParts = [Recipe, Gatherer, Planter, Inventory, Storage, Carriers, Service, ...WearParts] as const
/** The role components a kind's buildings carry, inserted after the building is spawned. */
export const rolesOf = (kind: Kind, rules: Rules = shippedRules) => {
  const roles = []
  if (kind.recipe) {
    const r = kind.recipe
    roles.push(Game.Command.entry(Recipe, { input: r.input, inputs: r.inputs, output: r.output, batch: r.batch, period: stepsOf(r.seconds), progress: 0, made: 0 }))
  }
  if (kind.gathers) roles.push(Game.Command.entry(Gatherer, { source: kind.gathers.source, radius: kind.gathers.radius }))
  if (kind.plants) {
    const p = kind.plants
    roles.push(Game.Command.entry(Planter, { what: p.what, radius: p.radius, interval: stepsOf(p.seconds), cooldown: 0, max: p.max }))
  }
  // A workshop that wears out tools keeps a few on its shelf too.
  const tools = kind.wear ? ["tools" as const] : []
  if (kind.holds) {
    const all = kind.holds.accepts === "all"
    const accepts = all ? goodIds : [...kind.holds.accepts, ...tools.filter((g) => !kind.holds!.accepts.includes(g))]
    roles.push(Game.Command.entry(Inventory, { stock: amounts({}), accepts, cap: kind.holds.cap }))
    // Storage takes in and sends out any good it accepts: everything, or (a granary) food.
    if (all || kind.keeps) roles.push(Game.Command.entry(Storage, {}))
  } else if (kind.recipe) {
    // A gatherer keeps what it makes until a carrier takes it.
    roles.push(Game.Command.entry(Inventory, { stock: amounts({}), accepts: [kind.recipe.output, ...tools], cap: 8 }))
  }
  if (kind.carriers) roles.push(Game.Command.entry(Carriers, { count: kind.carriers }))
  if (kind.service) {
    const s = kind.service
    roles.push(Game.Command.entry(Service, { service: s.service, interval: stepsOf(s.seconds), cooldown: 0, range: s.range }))
  }
  // The town hall neither burns nor wears.
  if (kind.id !== "townhall") roles.push(...wearOf(rules))
  return roles
}

export const houseDraft = (cell: Point) =>
  Game.Command.spawn(
    [Tile, { x: cell.x, y: cell.y, size: 1 }],
    [House, { tier: 1, residents: 0, food: 0, bread: 0, cloth: 0, faith: 0, furniture: 0, clock: 0 }]
  )
export const houseStart = (rules: Rules = shippedRules) => [site(rules.home.cost), ...wearOf(rules)]
export const ruinDraft = (tile: { readonly x: number; readonly y: number; readonly size: number }, cause: "burnt" | "collapsed" | "derelict") =>
  Game.Command.spawn([Tile, { x: tile.x, y: tile.y, size: tile.size }], [Ruin, { cause }])

export const parkDraft = (cell: Point, ground: GroundId) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Park, { ground, prop: "none" }])
export const roadDraft = (cell: Point) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Road, {}])
export const treeDraft = (cell: Point, growth: number) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Tree, { growth }])
export const rockDraft = (cell: Point, ore: boolean, amount: number) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Rock, { ore, amount }])
/** A cell of water never fished: long rested. */
export const UNFISHED = -1_000_000
export const waterDraft = (cell: Point) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Water, { fished: UNFISHED }])
export const fieldDraft = (cell: Point) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Field, { growth: 0 }])
