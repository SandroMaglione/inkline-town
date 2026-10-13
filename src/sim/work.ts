/**
 * Building and working: the grid and the town's stock are indexed, sites
 * whose materials are in start going up, workers are assigned, recipes
 * turn inputs (or the land) into goods, planters sow trees and fields, and
 * what is sown grows.
 */
import * as Random from "@typeonce/bevy-ts-math/Random"

import { fieldDraft, treeDraft } from "../archetypes.ts"
import {
  amounts, APPRENTICE, BUILD_TICKS, COMMUTE, condition, crewOf, goodIds, GROWN, kinds, ticks, total, winters, type Amounts, type Crew
} from "../content.ts"
import { around, DIRS, doors, GridBuilder, key, ownerAt, reach, roadPrint, useAt } from "../grid.ts"
import {
  Building, Burning, Charter, Condition, Field, FieldOf, Game, Gatherer, Grid, House, Inventory, Land, Paused, Planter, Recipe, Rising, Rng,
  Rock, Site, Staff, Status, Stock, Storage, Tile, Time, Tree, maybe, type Status as StatusValue
} from "../schema.ts"
import { connected, elapsed, seasonAt, TileRead, useOf } from "./shared.ts"

/**
 * Whether a building working at `pace` (a share of full speed, a sum of
 * halves and quarters) gets its step in on step `tick`: at a half, every
 * other step; at a quarter, every fourth.
 */
export const paced = (pace: number, tick: number): boolean => pace >= 1 || Math.floor((tick + 1) * pace) > Math.floor(tick * pace)

/**
 * What stands where on the land, for every system after it this step.
 * Tiles never move, so the grid is only rebuilt when one is laid or one of
 * those standing on it goes (a load spawns the whole world again, so it is
 * rebuilt then too).
 */
export const IndexGrid = Game.System(
  "Town/IndexGrid",
  {
    queries: { tiles: TileRead, laid: Game.Query({ selection: { tile: Game.Query.read(Tile) }, filters: [Game.Query.added(Tile)] }) },
    despawned: { entities: Game.System.readDespawned() },
    resources: { land: Game.System.readResource(Land), grid: Game.System.writeResource(Grid) }
  },
  ({ queries, despawned, resources }) => {
    const known = resources.grid.get().tiles
    const changed = known === undefined || queries.laid.each().length > 0 || despawned.entities.all().some((id) => known.has(id))
    if (!changed) return
    const grid = new GridBuilder(resources.land.get().mask)
    const tiles = new Set<number>()
    for (const { entity, data } of queries.tiles.each()) {
      grid.claim(data.tile.get(), entity.id, useOf(data))
      tiles.add(entity.id)
    }
    const value = grid.value()
    resources.grid.set({ ...value, roads: roadPrint(value), tiles })
  }
)

/** The goods in every storage, summed. */
export const CountStock = Game.System(
  "Town/CountStock",
  {
    queries: { stores: Game.Query({ selection: { inventory: Game.Query.read(Inventory) }, with: [Storage], without: [Site, Rising] }) },
    resources: { stock: Game.System.writeResource(Stock) }
  },
  ({ queries, resources }) => {
    const sum: Record<string, number> = { ...amounts({}) }
    for (const { data } of queries.stores.each()) {
      const s = data.inventory.get().stock
      for (const g of goodIds) sum[g] = (sum[g] ?? 0) + s[g]
    }
    resources.stock.set(sum as Amounts)
  }
)

// ── Going up ──────────────────────────────────────────────────────────────

/** Where a site's walls are once its materials are in: it goes on rising from here. */
export const SITE_SHARE = 0.35

export const Raise = Game.System(
  "Town/Raise",
  {
    queries: {
      sites: Game.Query({ selection: { site: Game.Query.read(Site) } }),
      rising: Game.Query({ selection: { rising: Game.Query.write(Rising), status: Game.Query.optional(Status) } })
    }
  },
  ({ queries, commands }) => {
    for (const { entity, data } of queries.sites.each()) {
      if (total(data.site.get().owed) > 0) continue
      commands.remove(entity.id, Site)
      commands.insert(entity.id, Game.Command.entry(Rising, { ticks: Math.round(BUILD_TICKS * SITE_SHARE) }))
    }
    for (const { entity, data } of queries.rising.each()) {
      const ticks = data.rising.get().ticks + 1
      if (ticks >= BUILD_TICKS) {
        commands.remove(entity.id, Rising)
        // Up and standing; its work (if it has any) says otherwise from here on.
        if (data.status.present) commands.insert(entity.id, Game.Command.entry(Status, "idle"))
      } else data.rising.set({ ticks })
    }
  }
)

// ── Workers ───────────────────────────────────────────────────────────────

/** Workers are reassigned this often: residents move in and out every few seconds, no faster. */
export const STAFF_TICKS = ticks(0.5)

/**
 * Residents go to work at the workplaces within a commute of their home
 * (`COMMUTE` road cells), nearest homes first; the workplaces with the
 * fewest of their crew within reach are staffed first (in the order they
 * were placed, among equals), so a mine with its own cottages is not robbed
 * of them by a workshop in town. Settlers do the rough work and citizens the skilled; citizens
 * never take a settlers' job, and settlers fill a citizens' job only once
 * every workplace has had its own crew, as apprentices at a slower pace. A
 * paused or burning building gets nobody.
 */
export const AssignStaff = Game.System(
  "Town/AssignStaff",
  {
    queries: {
      homes: Game.Query({ selection: { tile: Game.Query.read(Tile), house: Game.Query.read(House) }, without: [Site, Rising, Burning] }),
      workplaces: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          building: Game.Query.read(Building),
          staff: Game.Query.write(Staff),
          paused: Game.Query.optional(Paused),
          burning: Game.Query.optional(Burning)
        },
        without: [Site, Rising]
      })
    },
    resources: { grid: Game.System.readResource(Grid), time: Game.System.readResource(Time) }
  },
  ({ queries, resources }) => {
    if (resources.time.get().tick % STAFF_TICKS !== 0) return
    const grid = resources.grid.get()
    const homes: Array<{ readonly crew: Crew; left: number; readonly doors: ReadonlyArray<{ readonly x: number; readonly y: number }> }> = []
    for (const { data } of queries.homes.each()) {
      const h = data.house.get()
      const ds = doors(grid, data.tile.get())
      if (h.residents > 0 && ds.length > 0) homes.push({ crew: crewOf(h.tier), left: h.residents, doors: ds })
    }
    type Row = ReturnType<typeof queries.workplaces.each>[number]
    const places: Array<{
      readonly data: Row["data"]
      readonly staff: { readonly needed: number; readonly assigned: number; readonly apprentices: number; readonly nearby: number }
      readonly crew: Crew
      readonly within: ReadonlyArray<{ readonly home: (typeof homes)[number]; readonly distance: number }>
      assigned: number
      apprentices: number
      readonly nearby: number
    }> = []
    for (const { data } of queries.workplaces.each()) {
      const staff = data.staff.get()
      if (staff.needed === 0) continue
      const crew = kinds[data.building.get().kind].crew
      const starts = doors(grid, data.tile.get())
      const within: Array<{ readonly home: (typeof homes)[number]; readonly distance: number }> = []
      if (starts.length > 0 && !data.paused.present && !data.burning.present) {
        const roads = reach(grid, starts)
        for (const home of homes) {
          let distance = -1
          for (const d of home.doors) {
            const n = roads.distance[key(d.x, d.y)]!
            if (n >= 0 && (distance < 0 || n < distance)) distance = n
          }
          if (distance >= 0 && distance <= COMMUTE) within.push({ home, distance })
        }
        within.sort((a, b) => a.distance - b.distance)
      }
      const nearby = within.reduce((n, w) => n + (w.home.crew === crew ? w.home.left : 0), 0)
      places.push({ data, staff, crew, within, assigned: 0, apprentices: 0, nearby })
    }
    const fill = (place: (typeof places)[number], from: Crew) => {
      for (const { home } of place.within) {
        if (place.assigned >= place.staff.needed) return
        if (home.crew !== from || home.left === 0) continue
        const take = Math.min(place.staff.needed - place.assigned, home.left)
        home.left -= take
        place.assigned += take
        if (from !== place.crew) place.apprentices += take
      }
    }
    const order = places.map((place, index) => ({ place, index })).sort((a, b) => a.place.nearby - b.place.nearby || a.index - b.index)
    for (const { place } of order) fill(place, place.crew)
    for (const { place } of order) if (place.crew === "citizens") fill(place, "settlers")
    for (const { data, staff, assigned, apprentices, nearby } of places) {
      if (staff.assigned !== assigned || staff.apprentices !== apprentices || staff.nearby !== nearby) data.staff.set({ ...staff, assigned, apprentices, nearby })
    }
  }
)

/** Worker-steps a crew puts in this step: apprentices only on their share of the steps (see `APPRENTICE`). */
export const effort = (staff: { readonly assigned: number; readonly apprentices: number }, tick: number) =>
  staff.assigned - staff.apprentices + (paced(APPRENTICE, tick) ? staff.apprentices : 0)

// ── Recipes ───────────────────────────────────────────────────────────────

/**
 * One step of every recipe. A job starts when there is room for what it
 * makes, its input is in, and (for a gatherer) the land has what it needs
 * within reach: a grown tree is felled, a rock chipped, a ripe field
 * reaped. Then the crew puts its worker-steps in; a full crew finishes in
 * `period` steps. It goes at half pace without the tools it wears out, and
 * at half pace again once it is run down; in winter, fishing goes at the
 * winter's pace (a hard winter's is a quarter).
 */
export const Work = Game.System(
  "Town/Work",
  {
    queries: {
      workshops: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          building: Game.Query.read(Building),
          staff: Game.Query.read(Staff),
          recipe: Game.Query.write(Recipe),
          inventory: Game.Query.write(Inventory),
          status: Game.Query.write(Status),
          gatherer: Game.Query.optional(Gatherer),
          paused: Game.Query.optional(Paused),
          condition: Game.Query.optional(Condition)
        },
        without: [Site, Rising]
      }),
      trees: Game.Query({ selection: { tree: Game.Query.read(Tree) } }),
      rocks: Game.Query({ selection: { rock: Game.Query.write(Rock) } }),
      fields: Game.Query({ selection: { field: Game.Query.write(Field) } })
    },
    resources: { grid: Game.System.readResource(Grid), time: Game.System.readResource(Time), charter: Game.System.readResource(Charter) }
  },
  ({ queries, resources, commands }) => {
    const grid = resources.grid.get()
    const tick = resources.time.get().tick
    const t = elapsed(resources.time.get(), resources.charter.get())
    const season = seasonAt(t, resources.charter.get())
    const fishing = season.severity ? winters[season.severity].fishing : 1
    // The land by entity, looked up only once some gatherer starts a job this step.
    const lazy = <T>(make: () => T) => {
      let value: T | undefined
      return () => (value ??= make())
    }
    const trees = lazy(() => new Map(queries.trees.each().map((row) => [row.entity.id as number, row])))
    const rocks = lazy(() => new Map(queries.rocks.each().map((row) => [row.entity.id as number, row])))
    const fields = lazy(() => new Map(queries.fields.each().map((row) => [row.entity.id as number, row])))
    const used = new Set<number>()

    /** Takes what a gatherer needs from the land within reach, or says there is none. */
    const gather = (source: "tree" | "stone" | "ore" | "field" | "water", tile: { x: number; y: number; size: number }, radius: number): boolean => {
      for (const c of around(tile, radius)) {
        const use = useAt(grid, c.x, c.y)
        const id = ownerAt(grid, c.x, c.y)
        if (used.has(id)) continue
        if (source === "water" && use === "water") return true
        if (source === "tree" && use === "tree") {
          const tree = trees().get(id)
          if (!tree || tree.data.tree.get().growth < GROWN.tree) continue
          commands.despawn(tree.entity.id)
          used.add(id)
          return true
        }
        if ((source === "stone" || source === "ore") && use === "rock") {
          const rock = rocks().get(id)
          if (!rock) continue
          const r = rock.data.rock.get()
          if (r.ore !== (source === "ore") || r.amount <= 0) continue
          if (r.amount <= 1) {
            commands.despawn(rock.entity.id)
            used.add(id)
          } else rock.data.rock.set({ ...r, amount: r.amount - 1 })
          return true
        }
        if (source === "field" && use === "field") {
          const field = fields().get(id)
          if (!field || field.data.field.get().growth < GROWN.field) continue
          field.data.field.set({ growth: 0 })
          used.add(id)
          return true
        }
      }
      return false
    }

    for (const { data } of queries.workshops.each()) {
      const tile = data.tile.get()
      const kind = kinds[data.building.get().kind]
      const staff = data.staff.get()
      const gatherer = maybe(data.gatherer)
      let recipe = data.recipe.get()
      const inventory = data.inventory.get()
      let stock = inventory.stock
      const open = connected(grid, tile)
      const room = stock[recipe.output] + recipe.batch <= inventory.cap
      const fed = recipe.input === null || stock[recipe.input] >= recipe.inputs
      let short = !fed

      if (open && staff.assigned > 0 && recipe.progress === 0 && room && fed) {
        if (gatherer && !gather(gatherer.source, tile, gatherer.radius)) short = true
        else {
          if (recipe.input !== null) stock = { ...stock, [recipe.input]: stock[recipe.input] - recipe.inputs }
          recipe = { ...recipe, progress: 1 }
        }
      }
      const worn = (maybe(data.condition)?.value ?? Infinity) < condition.worn
      const pace = (kind.wear && stock.tools === 0 ? 0.5 : 1) * (worn ? 0.5 : 1) * (gatherer?.source === "water" ? fishing : 1)
      const put = effort(staff, tick)
      if (open && recipe.progress > 0 && put > 0 && paced(pace, tick)) {
        const progress = recipe.progress + put
        if (progress > recipe.period * staff.needed) {
          recipe = { ...recipe, progress: 0, made: recipe.made + 1 }
          stock = { ...stock, [recipe.output]: stock[recipe.output] + recipe.batch }
          // Every so many jobs wear out a tool.
          if (kind.wear && recipe.made % kind.wear === 0 && stock.tools > 0) stock = { ...stock, tools: stock.tools - 1 }
        } else recipe = { ...recipe, progress }
      }
      const status: StatusValue = data.paused.present
        ? "paused"
        : !open
        ? "unconnected"
        : staff.assigned === 0
        ? "unstaffed"
        : recipe.progress > 0
        ? "working"
        : !room
        ? "blocked"
        : short
        ? "starved"
        : "idle"
      data.recipe.set(recipe)
      if (stock !== inventory.stock) data.inventory.set({ ...inventory, stock })
      if (data.status.get() !== status) data.status.set(status)
    }
  }
)

// ── The land ──────────────────────────────────────────────────────────────

/** A forester plants trees and a farm sows fields on free ground within reach, one at a time. */
export const Plant = Game.System(
  "Town/Plant",
  {
    queries: {
      planters: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          staff: Game.Query.read(Staff),
          planter: Game.Query.write(Planter),
          status: Game.Query.write(Status),
          recipe: Game.Query.optional(Recipe),
          paused: Game.Query.optional(Paused)
        },
        without: [Site, Rising]
      })
    },
    resources: { grid: Game.System.readResource(Grid), rng: Game.System.writeResource(Rng), time: Game.System.readResource(Time) }
  },
  ({ queries, resources, commands }) => {
    const grid = resources.grid.get()
    const random = Random.make(resources.rng.get())
    const sown = new Set<number>()
    const tick = resources.time.get().tick
    for (const { entity, data } of queries.planters.each()) {
      const tile = data.tile.get()
      const staff = data.staff.get()
      const planter = data.planter.get()
      // While it waits to plant again, it only counts down (and looks around twice a second for its status).
      if (planter.cooldown > 1 && tick % STAFF_TICKS !== 0) {
        data.planter.set({ ...planter, cooldown: planter.cooldown - 1 })
        continue
      }
      const open = connected(grid, tile)
      const reach = around(tile, planter.radius)
      const grown = reach.filter((c) => useAt(grid, c.x, c.y) === planter.what).length
      const spots = reach.filter((c) => useAt(grid, c.x, c.y) === "empty" && !sown.has(key(c.x, c.y)))
      // A forester has no recipe of its own: its status is its planting.
      if (!maybe(data.recipe)) {
        const status: StatusValue = data.paused.present ? "paused" : !open ? "unconnected" : staff.assigned === 0 ? "unstaffed" : grown < planter.max && spots.length > 0 ? "working" : "idle"
        if (data.status.get() !== status) data.status.set(status)
      }
      const cooldown = Math.max(0, planter.cooldown - 1)
      if (cooldown > 0 || !open || staff.assigned === 0 || grown >= planter.max || spots.length === 0) {
        if (cooldown !== planter.cooldown) data.planter.set({ ...planter, cooldown })
        continue
      }
      const spot = random.pick(spots)!
      sown.add(key(spot.x, spot.y))
      if (planter.what === "tree") commands.spawn(treeDraft(spot, 0))
      else commands.spawn(Game.Command.relate(fieldDraft(spot), FieldOf, entity.id))
      data.planter.set({ ...planter, cooldown: planter.interval })
    }
    resources.rng.set(random.state)
  }
)

/** How often a wild forest seeds a new tree. */
const SPREAD_TICKS = ticks(1.5)

/**
 * Wild forests regrow: now and then a grown tree seeds an empty cell beside
 * it, but only one that already has two trees around it, so forests fill
 * back in and creep at their edges without seeding the open town. A cleared
 * patch needs a forester.
 */
export const Spread = Game.System(
  "Town/Spread",
  {
    queries: { trees: Game.Query({ selection: { tile: Game.Query.read(Tile), tree: Game.Query.read(Tree) } }) },
    resources: { grid: Game.System.readResource(Grid), rng: Game.System.writeResource(Rng), time: Game.System.readResource(Time) }
  },
  ({ queries, resources, commands }) => {
    if (resources.time.get().tick % SPREAD_TICKS !== 0) return
    const grid = resources.grid.get()
    const random = Random.make(resources.rng.get())
    const grown = queries.trees.each().filter(({ data }) => data.tree.get().growth >= GROWN.tree)
    const parent = random.pick(grown)
    if (parent) {
      const t = parent.data.tile.get()
      const spot = random.pick(DIRS.map((d) => ({ x: t.x + d.x, y: t.y + d.y })).filter((c) => useAt(grid, c.x, c.y) === "empty"))
      if (spot && DIRS.filter((d) => useAt(grid, spot.x + d.x, spot.y + d.y) === "tree").length >= 2) commands.spawn(treeDraft(spot, 0))
    }
    resources.rng.set(random.state)
  }
)

/** Trees and fields grow this many steps at a time. */
const GROW_TICKS = 10

/** Trees and fields grow until they are ready; fields not in winter. */
export const Grow = Game.System(
  "Town/Grow",
  {
    queries: {
      trees: Game.Query({ selection: { tree: Game.Query.write(Tree) } }),
      fields: Game.Query({ selection: { field: Game.Query.write(Field) } })
    },
    resources: { time: Game.System.readResource(Time), charter: Game.System.readResource(Charter) }
  },
  ({ queries, resources }) => {
    if (resources.time.get().tick % GROW_TICKS !== 0) return
    for (const { data } of queries.trees.each()) {
      const growth = data.tree.get().growth
      if (growth < GROWN.tree) data.tree.set({ growth: Math.min(GROWN.tree, growth + GROW_TICKS) })
    }
    if (seasonAt(elapsed(resources.time.get(), resources.charter.get()), resources.charter.get()).winter) return
    for (const { data } of queries.fields.each()) {
      const growth = data.field.get().growth
      if (growth < GROWN.field) data.field.set({ growth: Math.min(GROWN.field, growth + GROW_TICKS) })
    }
  }
)
