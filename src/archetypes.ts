/**
 * Content to components: how each thing in `content.ts` is assembled from
 * the schema's components. A building is a `Tile`, a `Building`, a `Status`,
 * `Staff`, and one component for each role its kind has. Anything that
 * costs materials starts as a `Site`, anything else starts `Rising`; the
 * land is a `Tile` and its own marker.
 */
import { amounts, goodIds, home, total, type Kind } from "./content.ts"
import type { Point } from "./iso.ts"
import {
  Building, Carriers, Field, Game, Gatherer, House, Inventory, Planter, Recipe, Rising, Road, Rock, Service, Site, Staff,
  Status, Storage, Tile, Tree, Water
} from "./schema.ts"
import { ticks } from "./content.ts"

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
    [Staff, { needed: kind.workers, assigned: 0 }]
  )

/** How a new building starts: owed its materials, or rising straight away. */
export const startOf = (kind: Kind) => site(kind.cost)

/** The role components a kind's buildings carry, inserted after the building is spawned. */
export const rolesOf = (kind: Kind) => {
  const roles = []
  if (kind.recipe) {
    const r = kind.recipe
    roles.push(Game.Command.entry(Recipe, { input: r.input, inputs: r.inputs, output: r.output, batch: r.batch, period: ticks(r.seconds), progress: 0, made: 0 }))
  }
  if (kind.gathers) roles.push(Game.Command.entry(Gatherer, { source: kind.gathers.source, radius: kind.gathers.radius }))
  if (kind.plants) {
    const p = kind.plants
    roles.push(Game.Command.entry(Planter, { what: p.what, radius: p.radius, interval: ticks(p.seconds), cooldown: 0, max: p.max }))
  }
  if (kind.holds) {
    const all = kind.holds.accepts === "all"
    roles.push(Game.Command.entry(Inventory, { stock: amounts({}), accepts: all ? goodIds : kind.holds.accepts, cap: kind.holds.cap }))
    if (all) roles.push(Game.Command.entry(Storage, {}))
  } else if (kind.recipe) {
    // A gatherer keeps what it makes until a carrier takes it.
    roles.push(Game.Command.entry(Inventory, { stock: amounts({}), accepts: [kind.recipe.output], cap: 8 }))
  }
  if (kind.carriers) roles.push(Game.Command.entry(Carriers, { count: kind.carriers }))
  if (kind.service) {
    const s = kind.service
    roles.push(Game.Command.entry(Service, { service: s.service, interval: ticks(s.seconds), cooldown: 0, range: s.range }))
  }
  return roles
}

export const houseDraft = (cell: Point) =>
  Game.Command.spawn(
    [Tile, { x: cell.x, y: cell.y, size: 1 }],
    [House, { tier: 1, residents: 0, food: 0, bread: 0, cloth: 0, faith: 0, clock: 0 }]
  )
export const houseStart = () => site(home.cost)

export const roadDraft = (cell: Point) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Road, {}])
export const treeDraft = (cell: Point, growth: number) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Tree, { growth }])
export const rockDraft = (cell: Point, ore: boolean, amount: number) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Rock, { ore, amount }])
export const waterDraft = (cell: Point) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Water, {}])
export const fieldDraft = (cell: Point) => Game.Command.spawn([Tile, { x: cell.x, y: cell.y, size: 1 }], [Field, { growth: 0 }])
