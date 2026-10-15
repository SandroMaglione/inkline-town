import { wildTreeSpots, canSeedTree } from "../rules/land.ts"
/**
 * Building and working: the grid and the town's stock are indexed, sites
 * whose materials are in start going up, workers are assigned, recipes
 * turn inputs (or the land) into goods, planters sow trees and fields, and
 * what is sown grows.
 */
import * as Random from "@typeonce/bevy-ts-math/Random"

import { fieldDraft, treeDraft } from "../archetypes.ts"
import { amounts, crewOf, goodIds, ticks, total, type Amounts, type Crew } from "../content.ts"

/** The flow of goods is counted in slices this many seconds long, and the last `FLOW_SLICES` of them (a minute) are kept. */
const FLOW_SLICE = 10
const FLOW_SLICES = 6

const each = (f: (g: (typeof goodIds)[number]) => number): Amounts => Object.fromEntries(goodIds.map((g) => [g, f(g)])) as Amounts
import { around, doors, GridBuilder, key, ownerAt, reach, roadPrint, useAt } from "../grid.ts"
import { Building, Burning, Charter, Chronicle, Errand, Flow, Roam, Condition, Field, FieldOf, Game, Rules, Gatherer, Grid, House, Inventory, Land, Paused, Paved, Planter, Recipe, Rising, Rng, Rock, Site, Staff, Status, Stock, Storage, Tile, Time, Treasury, Tree, maybe, type Status as StatusValue } from "../schema.ts"
import { connected, elapsed, seasonAt, TileRead, useOf, write } from "./shared.ts"

import { assignWorkers, equipmentPace, effort, paced } from "../rules/production.ts"
export { effort, paced } from "../rules/production.ts"

/**
 * What stands where on the land, for every system after it this step.
 * Tiles never move, so the grid is only rebuilt when one is laid or one of
 * those standing on it goes (a load spawns the whole world again, so it is
 * rebuilt then too).
 */
export const IndexGrid = Game.System(
  "Town/IndexGrid",
  {
    queries: {
      tiles: TileRead,
      laid: Game.Query({ selection: { tile: Game.Query.read(Tile) }, filters: [Game.Query.added(Tile)] }),
      /** A road just paved: the grid's paved cells change without any tile coming or going. */
      paved: Game.Query({ selection: { paved: Game.Query.read(Paved) }, filters: [Game.Query.added(Paved)] })
    },
    despawned: { entities: Game.System.readDespawned() },
    resources: { land: Game.System.readResource(Land), grid: Game.System.writeResource(Grid) }
  },
  ({ queries, despawned, resources }) => {
    const known = resources.grid.get().tiles
    const changed = known === undefined || queries.laid.each().length > 0 || queries.paved.each().length > 0 || despawned.entities.all().some((id) => known.has(id))
    if (!changed) return
    const grid = new GridBuilder(resources.land.get().mask)
    const tiles = new Set<number>()
    const paved = new Set<number>()
    for (const { entity, data } of queries.tiles.each()) {
      const t = data.tile.get()
      grid.claim(t, entity.id, useOf(data))
      tiles.add(entity.id)
      if (data.road.present && data.paved.present) paved.add(key(t.x, t.y))
    }
    const value = grid.value()
    resources.grid.set({ ...value, roads: roadPrint(value), tiles, paved })
  }
)

/**
 * The goods in every storage, summed; and everything the town holds,
 * anywhere, for the minute's `Flow`, which closes every minute.
 */
export const CountStock = Game.System(
  "Town/CountStock",
  {
    queries: {
      stores: Game.Query({ selection: { inventory: Game.Query.read(Inventory) }, with: [Storage], without: [Site, Rising] }),
      shelves: Game.Query({ selection: { inventory: Game.Query.read(Inventory) }, without: [Site, Rising] }),
      baskets: Game.Query({ selection: { roam: Game.Query.read(Roam) } }),
      crates: Game.Query({ selection: { errand: Game.Query.read(Errand) } })
    },
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      stock: Game.System.writeResource(Stock),
      treasury: Game.System.readResource(Treasury),
      flow: Game.System.writeResource(Flow)
    }
  },
  ({ queries, resources }) => {
    const sum: Record<string, number> = { ...amounts({}) }
    for (const { data } of queries.stores.each()) {
      const s = data.inventory.get().stock
      for (const g of goodIds) sum[g] = (sum[g] ?? 0) + s[g]
    }
    resources.stock.set(sum as Amounts)

    const held: Record<string, number> = { ...amounts({}) }
    for (const { data } of queries.shelves.each()) {
      const s = data.inventory.get().stock
      for (const g of goodIds) held[g] = held[g]! + s[g]
    }
    for (const { data } of queries.baskets.each()) {
      const b = data.roam.get().basket
      for (const g of goodIds) held[g] = held[g]! + b[g]
    }
    for (const { data } of queries.crates.each()) {
      const e = data.errand.get()
      held[e.good] = held[e.good]! + e.count
    }
    const tick = resources.time.get().tick
    const charter = resources.charter.get()
    const town = `${charter.seed}:${charter.founded}`
    const f = resources.flow.get()
    const now = held as Amounts
    const treasury = resources.treasury.get().coins
    const fresh = { start: treasury, made: 0, traded: 0, seen: treasury, booked: 0 }
    // A new or loaded town, or the clock gone back: start counting again from here.
    if (f.town !== town || tick < f.since || f.start === null) {
      resources.flow.set({ town, since: tick, start: now, made: amounts({}), traded: amounts({}), held: now, coins: fresh, slices: [], last: null })
      return
    }
    // Coins that came in other than by the collection (a reward, a refund) were made; any that went out are left over as used.
    const other = treasury - f.coins.seen - f.coins.booked
    const coins = { ...f.coins, made: f.coins.made + Math.max(0, other), seen: treasury, booked: 0 }
    if (tick - f.since < ticks(FLOW_SLICE)) {
      resources.flow.set({ ...f, held: now, coins })
      return
    }
    // A slice is done: the last minute rolls on by one, and is reckoned again.
    const slices = [...f.slices, { start: f.start, made: f.made, traded: f.traded, coins: { start: coins.start, made: coins.made, traded: coins.traded } }].slice(-FLOW_SLICES)
    const enough = slices.length >= FLOW_SLICES / 2
    const scale = FLOW_SLICES / slices.length
    const over = (key: "made" | "traded") => each((g) => slices.reduce((n, s) => n + s[key][g], 0))
    const made = over("made"), traded = over("traded")
    const used = each((g) => Math.max(0, slices[0]!.start[g] + made[g] + traded[g] - now[g]))
    const perMinute = (a: Amounts) => each((g) => Math.round(a[g] * scale))
    const coinsMade = slices.reduce((n, s) => n + s.coins.made, 0)
    const coinsTraded = slices.reduce((n, s) => n + s.coins.traded, 0)
    const coinsUsed = Math.max(0, slices[0]!.coins.start + coinsMade + coinsTraded - treasury)
    resources.flow.set({
      town, since: tick, start: now, made: amounts({}), traded: amounts({}), held: now, coins: fresh, slices,
      last: enough
        ? {
            made: perMinute(made), used: perMinute(used), traded: perMinute(traded),
            coins: { made: Math.round(coinsMade * scale), used: Math.round(coinsUsed * scale), traded: Math.round(coinsTraded * scale) }
          }
        : null
    })
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
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, commands, services }) => {
    const rules = services.rules
    const { buildTicks: BUILD_TICKS } = rules

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
    resources: { grid: Game.System.readResource(Grid), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules
    const { kinds, commute: COMMUTE, staffTicks: STAFF_TICKS } = rules

    if (resources.time.get().tick % STAFF_TICKS !== 0) return
    const grid = resources.grid.get()
    const homes: Array<{ readonly id: number; readonly crew: Crew; left: number; readonly doors: ReadonlyArray<{ readonly x: number; readonly y: number }> }> = []
    for (const { entity, data } of queries.homes.each()) {
      const h = data.house.get()
      const ds = doors(grid, data.tile.get())
      if (h.residents > 0 && ds.length > 0) homes.push({ id: entity.id, crew: crewOf(h.tier), left: h.residents, doors: ds })
    }
    type Row = ReturnType<typeof queries.workplaces.each>[number]
    const places: Array<{
      readonly id: number;
      readonly data: Row["data"]
      readonly staff: { readonly needed: number; readonly assigned: number; readonly apprentices: number; readonly nearby: number }
      readonly crew: Crew
      readonly within: ReadonlyArray<{ readonly home: (typeof homes)[number]; readonly distance: number }>
      assigned: number
      apprentices: number
      readonly nearby: number
    }> = []
    for (const { entity, data } of queries.workplaces.each()) {
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
      places.push({ id: entity.id, data, staff, crew, within, assigned: 0, apprentices: 0, nearby })
    }
    const assigned = assignWorkers(
      homes.map((h) => ({ id: h.id, crew: h.crew, residents: h.left })),
      places.map((p) => ({ id: p.id, crew: p.crew, needed: p.staff.needed,
        within: p.within.map((w) => ({ home: w.home.id, distance: w.distance })) }))
    )
    for (const { id, data, staff } of places) {
      const next = assigned.get(id)!
      if (staff.assigned !== next.assigned || staff.apprentices !== next.apprentices || staff.nearby !== next.nearby) data.staff.set({ ...staff, ...next })
    }
  }
)

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
    resources: {
      grid: Game.System.readResource(Grid),
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      flow: Game.System.writeResource(Flow),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { kinds, winters, grown: GROWN } = rules
    const made: Record<string, number> = {}

    const grid = resources.grid.get()
    const tick = resources.time.get().tick
    const t = elapsed(resources.time.get(), resources.charter.get())
    const season = seasonAt(t, resources.charter.get(), rules)
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
    // A worked face gives one more now and then.
    if (tick % rules.faceTicks === 0)
      for (const { data } of queries.rocks.each()) {
        const r = data.rock.get()
        if (r.amount <= 0) data.rock.set({ ...r, amount: 1 })
      }

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
          // Quarried down, a rock stays as a worked face (see `FACE_TICKS`).
          rock.data.rock.set({ ...r, amount: r.amount - 1 })
          if (r.amount === 2 && ![...rocks().values()].some((o) => o !== rock && o.data.rock.get().ore === r.ore && o.data.rock.get().amount >= 2))
            write(
              resources.chronicle,
              t,
              r.ore
                ? "The last of the open ore is dug: the worked faces still give a little, slowly. Traders sell ore and tools."
                : "The last of the open stone is quarried: the worked faces still give a little, slowly. Traders sell stone.",
              true,
              c
            )
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

      const pace = equipmentPace(kind, stock.tools, maybe(data.condition)?.value ?? Infinity, fishing, rules)
      const put = effort(staff, tick, rules)
      if (open && recipe.progress > 0 && put > 0 && paced(pace, tick)) {
        const progress = recipe.progress + put
        if (progress > recipe.period * staff.needed) {
          recipe = { ...recipe, progress: 0, made: recipe.made + 1 }
          stock = { ...stock, [recipe.output]: stock[recipe.output] + recipe.batch }
          made[recipe.output] = (made[recipe.output] ?? 0) + recipe.batch
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
    if (Object.keys(made).length > 0) resources.flow.update((f) => ({ ...f, made: each((g) => f.made[g] + (made[g] ?? 0)) }))
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
    resources: { grid: Game.System.readResource(Grid), rng: Game.System.writeResource(Rng), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { staffTicks: STAFF_TICKS } = rules

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
    resources: { grid: Game.System.readResource(Grid), rng: Game.System.writeResource(Rng), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { grown: GROWN, spreadTicks: SPREAD_TICKS } = rules

    if (resources.time.get().tick % SPREAD_TICKS !== 0) return
    const grid = resources.grid.get()
    const random = Random.make(resources.rng.get())
    const grown = queries.trees.each().filter(({ data }) => data.tree.get().growth >= GROWN.tree)
    const parent = random.pick(grown)
    if (parent) {
      const t = parent.data.tile.get()
      const spot = random.pick(wildTreeSpots(grid, t))
      if (spot && canSeedTree(grid, spot)) commands.spawn(treeDraft(spot, 0))
    }
    resources.rng.set(random.state)
  }
)

/** Trees and fields grow until they are ready; fields not in winter. */
export const Grow = Game.System(
  "Town/Grow",
  {
    queries: {
      trees: Game.Query({ selection: { tree: Game.Query.write(Tree) } }),
      fields: Game.Query({ selection: { field: Game.Query.write(Field) } })
    },
    resources: { time: Game.System.readResource(Time), charter: Game.System.readResource(Charter) },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules
    const { grown: GROWN, growTicks: GROW_TICKS } = rules

    if (resources.time.get().tick % GROW_TICKS !== 0) return
    for (const { data } of queries.trees.each()) {
      const growth = data.tree.get().growth
      if (growth < GROWN.tree) data.tree.set({ growth: Math.min(GROWN.tree, growth + GROW_TICKS) })
    }
    if (seasonAt(elapsed(resources.time.get(), resources.charter.get()), resources.charter.get(), rules).winter) return
    for (const { data } of queries.fields.each()) {
      const growth = data.field.get().growth
      if (growth < GROWN.field) data.field.set({ growth: Math.min(GROWN.field, growth + GROW_TICKS) })
    }
  }
)
