/**
 * The world as the view reads it, once a frame: every row it looks at and
 * every resource value, taken in one pass by `Project` and handed to the
 * modules that turn it into a preview, a panel, the map views, alerts, and
 * the town's numbers. The lookups that cost a walk of the town (the homes no
 * food walker reaches, the neighbourhood's sources) are reckoned once, when
 * first asked.
 */
import type { Descriptor } from "@typeonce/ritmo"
import type { Query, QueryMatch } from "@typeonce/ritmo/Query"

import { buildingSource, homeSource, landSource, parkSources, parksOf, type AppealSource, type ParkCell, type ParkValue } from "../game/world/appeal.ts"
import { condition as wear, CONDITION_MAX, type KindId } from "../game/content/index.ts"
import type { Fix } from "../game/rules/explain.ts"
import {
  Appeal, Building, Burning, Census, Charter, Chronicle, Condition, Crown, Fate, Flow, Game, Grid, Guide, Handed, History, House, Inventory, Ledger, Market, Mood,
  Pantry, Park, Paused, Paved, Policy, Rebuilt, Recipe, Rising, Risk, Road, Rock, Ruin, Service, Sick, Site, Staff, Status, Stock, Tile, Time, TownHall, Treasury, Tree,
  Upgraded, Water, WalkerOf, Works
} from "../game/schema.ts"
import { doors, isRoad, key, nearest, reach, type TileLike } from "../game/world/grid.ts"
import type { Point } from "../game/world/iso.ts"
import type { Line } from "./contracts.ts"

export const BuildingRead = Game.Query({
  selection: {
    tile: Game.Query.read(Tile),
    building: Game.Query.read(Building),
    status: Game.Query.read(Status),
    staff: Game.Query.read(Staff),
    site: Game.Query.optional(Site),
    rising: Game.Query.optional(Rising),
    recipe: Game.Query.optional(Recipe),
    inventory: Game.Query.optional(Inventory),
    service: Game.Query.optional(Service),
    walkers: Game.Query.optionalRelated(WalkerOf),
    hall: Game.Query.optional(TownHall),
    paused: Game.Query.optional(Paused),
    upgraded: Game.Query.optional(Upgraded),
    works: Game.Query.optional(Works),
    risk: Game.Query.optional(Risk),
    condition: Game.Query.optional(Condition),
    burning: Game.Query.optional(Burning)
  }
})
export const HouseRead = Game.Query({
  selection: {
    tile: Game.Query.read(Tile),
    house: Game.Query.read(House),
    rebuilt: Game.Query.optional(Rebuilt),
    site: Game.Query.optional(Site),
    rising: Game.Query.optional(Rising),
    risk: Game.Query.optional(Risk),
    condition: Game.Query.optional(Condition),
    burning: Game.Query.optional(Burning),
    sick: Game.Query.optional(Sick),
    closed: Game.Query.optional(Paused)
  }
})
export const RuinRead = Game.Query({ selection: { tile: Game.Query.read(Tile), ruin: Game.Query.read(Ruin) } })
export const ParkRead = Game.Query({ selection: { tile: Game.Query.read(Tile), park: Game.Query.read(Park) } })
const TreeRead = Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Tree] })
const WaterRead = Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Water] })
const RockRead = Game.Query({ selection: { tile: Game.Query.read(Tile), rock: Game.Query.read(Rock) } })
const PavedRead = Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road, Paved] })

type Row<Q extends Query.Any> = QueryMatch<typeof Game.schema, Q>
export type BuildingRow = Row<typeof BuildingRead>
export type HouseRow = Row<typeof HouseRead>
export type RuinRow = Row<typeof RuinRead>
export type ParkRow = Row<typeof ParkRead>
export type RockRow = Row<typeof RockRead>

/** What `Project` declares to read: the queries and resources a frame is made of. */
export const frameAccess = {
  queries: { buildings: BuildingRead, houses: HouseRead, ruins: RuinRead, parks: ParkRead, trees: TreeRead, water: WaterRead, rocks: RockRead, paved: PavedRead },
  resources: {
    grid: Game.System.readResource(Grid),
    census: Game.System.readResource(Census),
    treasury: Game.System.readResource(Treasury),
    ledger: Game.System.readResource(Ledger),
    stock: Game.System.readResource(Stock),
    flow: Game.System.readResource(Flow),
    handed: Game.System.readResource(Handed),
    policy: Game.System.readResource(Policy),
    time: Game.System.readResource(Time),
    charter: Game.System.readResource(Charter),
    market: Game.System.readResource(Market),
    mood: Game.System.readResource(Mood),
    crown: Game.System.readResource(Crown),
    fate: Game.System.readResource(Fate),
    history: Game.System.readResource(History),
    chronicle: Game.System.readResource(Chronicle),
    appeal: Game.System.readResource(Appeal),
    pantry: Game.System.readResource(Pantry),
    guide: Game.System.readResource(Guide)
  }
}

const worldResources = {
  grid: Grid, census: Census, treasury: Treasury, ledger: Ledger, stock: Stock, flow: Flow, handed: Handed, policy: Policy, time: Time, charter: Charter,
  market: Market, mood: Mood, crown: Crown, fate: Fate, history: History, chronicle: Chronicle, appeal: Appeal, pantry: Pantry, guide: Guide
}
/** Every resource the view reads, as its value this frame. */
export type World = { readonly [K in keyof typeof worldResources]: Descriptor.Descriptor.Value<(typeof worldResources)[K]> }
type FrameRows = { readonly [K in keyof typeof frameAccess.queries]: Row<(typeof frameAccess.queries)[K]> }

/** A thing's hit area for the pointer, nearest first. */
interface HitBox {
  readonly id: number
  readonly depth: number
  readonly contains: (at: Point) => boolean
}

/** A thing's hit area: its footprint on the floor. */
const hitBox = (id: number, tile: TileLike): HitBox => ({
  id,
  depth: tile.x + tile.y + tile.size,
  contains: (at) => at.x >= tile.x && at.x <= tile.x + tile.size && at.y >= tile.y && at.y <= tile.y + tile.size
})
const hitAt = (hits: ReadonlyArray<HitBox>, at: Point, entity?: number | null) =>
  entity === undefined ? (hits.find((h) => h.contains(at))?.id ?? null) : entity

/** Rows with a site's plate down or still rising are not built yet. */
type Raised = { readonly data: { readonly site: { readonly present: boolean }; readonly rising: { readonly present: boolean } } }

/**
 * Reads the frame: `queries` and `resources` as `Project`'s callback receives
 * them (see `frameAccess`).
 */
export const frameOf = (
  queries: { readonly [K in keyof FrameRows]: { each(): ReadonlyArray<FrameRows[K]> } },
  resources: { readonly [K in keyof World]: { get(): World[K] } }
) => {
  const world: World = {
    grid: resources.grid.get(), census: resources.census.get(), treasury: resources.treasury.get(), ledger: resources.ledger.get(), stock: resources.stock.get(),
    flow: resources.flow.get(), handed: resources.handed.get(), policy: resources.policy.get(), time: resources.time.get(), charter: resources.charter.get(),
    market: resources.market.get(), mood: resources.mood.get(), crown: resources.crown.get(), fate: resources.fate.get(), history: resources.history.get(),
    chronicle: resources.chronicle.get(), appeal: resources.appeal.get(), pantry: resources.pantry.get(), guide: resources.guide.get()
  }
  const grid = world.grid
  const buildings = queries.buildings.each()
  const houses = queries.houses.each()
  const ruins = queries.ruins.each()
  const parkRows = queries.parks.each()
  const rocks = queries.rocks.each()
  const parkCells: Array<ParkCell> = parkRows.map(({ data }) => ({ ...data.tile.get(), ...data.park.get() }))
  const parkAt = new Map(parkRows.map((row) => [key(row.data.tile.get().x, row.data.tile.get().y), row] as const))
  const road = (x: number, y: number) => isRoad(grid, x, y)
  const hits: Array<HitBox> = [
    ...buildings.map(({ entity, data }) => hitBox(entity.id, data.tile.get())),
    ...houses.map(({ entity, data }) => hitBox(entity.id, data.tile.get())),
    ...ruins.map(({ entity, data }) => hitBox(entity.id, data.tile.get())),
    ...parkRows.map(({ entity, data }) => hitBox(entity.id, data.tile.get()))
  ].sort((l, r) => r.depth - l.depth)
  // What stands, for a fix that builds something: it offers the first link of the chain the town lacks, else the last.
  const standing = new Set<KindId>(buildings.filter((r) => !r.data.site.present).map((r) => r.data.building.get().kind))
  const finished = (row: Raised) => !row.data.site.present && !row.data.rising.present
  let unreached: number | null = null
  let sources: Array<AppealSource> | null = null
  const frame = {
    world,
    grid,
    rates: world.policy,
    approval: world.mood.approval,
    cells: world.appeal.cells,
    tick: world.time.step,
    buildings,
    houses,
    ruins,
    parkRows,
    rocks,
    trees: queries.trees.each(),
    water: queries.water.each(),
    paved: queries.paved.each(),
    /** The rocks by cell: which are ore, and which are worked down to their faces. */
    rockAt: new Map(rocks.map(({ data }) => [key(data.tile.get().x, data.tile.get().y), data.rock.get()])),
    parkCells,
    parkAt,
    road,
    /** The park a cell belongs to, as it is, or as it would be with `changed` cells laid over it. */
    parkOf: (cell: Point, changed: ReadonlyArray<ParkCell> = []): ParkValue | undefined => {
      const over = new Map(parkCells.map((c) => [key(c.x, c.y), c]))
      for (const c of changed) over.set(key(c.x, c.y), c)
      return parksOf([...over.values()], road).find((p) => p.cells.some((c) => c.x === cell.x && c.y === cell.y))
    },
    /** How far a park reaches, as one square around it. */
    reachPlots: (p: ParkValue) => {
      const xs = p.cells.map((c) => c.x)
      const ys = p.cells.map((c) => c.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      const size = Math.max(Math.max(...xs) - x, Math.max(...ys) - y) + 1
      return [{ x: x - p.reach, y: y - p.reach, size: size + 2 * p.reach, look: "reach" as const }]
    },
    /** What the pointer is on: the model the camera ray hit, or else (parks have nothing standing to hit) the park on the cell. */
    pickAt: (at: Point, entity?: number | null) => {
      const hit = hitAt(hits, at, entity)
      return hit ?? parkAt.get(key(Math.floor(at.x), Math.floor(at.y)))?.entity.id ?? null
    },
    tileOf: (id: number) => [...buildings, ...houses, ...ruins, ...parkRows].find((row) => row.entity.id === id)?.data.tile.get(),
    standing,
    finished,
    fixOf: (f: Fix | undefined): Line["fix"] => f && { text: f.text, build: f.build?.find((k) => !standing.has(k)) ?? f.build?.at(-1) },
    /** Built homes no food walker reaches: a walk from each walker's door, so reckoned once a frame, when asked. */
    unreachedHomes: () => {
      if (unreached !== null) return unreached
      const walks = buildings
        .filter((row) => row.data.service.value()?.service === "goods" && finished(row))
        .map((row) => ({ way: reach(grid, doors(grid, row.data.tile.get())), range: row.data.service.value()!.range }))
      unreached = houses.filter((row) => {
        if (!finished(row)) return false
        const ds = doors(grid, row.data.tile.get())
        return ds.length > 0 && !walks.some((w) => (nearest(w.way, ds)?.distance ?? Infinity) < w.range)
      }).length
      return unreached
    },
    /** Everything that makes a street nicer or worse (only when a home's panel asks). */
    appealSources: () => {
      if (sources) return sources
      sources = []
      for (const { data } of buildings) {
        if (data.site.present || data.rising.present) continue
        const s = buildingSource(data.building.get().kind, data.tile.get(), undefined, data.upgraded.value()?.level ?? 0)
        if (s) sources.push(s)
      }
      for (const { data } of queries.trees.each()) sources.push(landSource("forest", data.tile.get()))
      for (const { data } of queries.water.each()) sources.push(landSource("water", data.tile.get()))
      for (const { data } of queries.paved.each()) sources.push(landSource("paved", data.tile.get()))
      sources.push(...parkSources(parkCells, road))
      for (const { data } of ruins) sources.push(landSource("ruin", data.tile.get()))
      for (const { data } of houses) {
        if (data.site.present || data.rising.present) continue
        if ((data.condition.value()?.value ?? CONDITION_MAX) < wear.worn) sources.push(landSource("worn", data.tile.get()))
        const fine = data.closed.present ? null : homeSource(data.house.get().tier, data.tile.get())
        if (fine) sources.push(fine)
      }
      return sources
    }
  }
  return frame
}
export type Frame = ReturnType<typeof frameOf>

