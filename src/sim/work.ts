/**
 * Building and working: the grid and the town's stock are indexed, sites
 * whose materials are in start going up, workers are assigned, recipes
 * turn inputs (or the land) into goods, planters sow trees and fields, and
 * what is sown grows.
 */
import * as Random from "@typeonce/bevy-ts-math/Random"

import { fieldDraft, treeDraft } from "../archetypes.ts"
import { amounts, BUILD_TICKS, goodIds, GROWN, ticks, total, type Amounts } from "../content.ts"
import { around, DIRS, GridBuilder, key, ownerAt, roadPrint, useAt } from "../grid.ts"
import {
  Charter, Field, FieldOf, Game, Gatherer, Grid, House, Inventory, Land, Paused, Planter, Recipe, Rising, Rng, Rock, Site, Staff, Status,
  Stock, Storage, Tile, Time, Tree, maybe, type Status as StatusValue
} from "../schema.ts"
import { connected, elapsed, seasonAt, TileRead, useOf } from "./shared.ts"

/** What stands where on the land, for every system after it this step. */
export const IndexGrid = Game.System(
  "Town/IndexGrid",
  { queries: { tiles: TileRead }, resources: { land: Game.System.readResource(Land), grid: Game.System.writeResource(Grid) } },
  ({ queries, resources }) => {
    const grid = new GridBuilder(resources.land.get().mask)
    for (const { entity, data } of queries.tiles.each()) grid.claim(data.tile.get(), entity.id, useOf(data))
    const value = grid.value()
    resources.grid.set({ ...value, roads: roadPrint(value) })
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

/**
 * Residents go to work in the order buildings were placed, as many as each
 * needs while any are left; a paused building gets nobody.
 */
export const AssignStaff = Game.System(
  "Town/AssignStaff",
  {
    queries: {
      homes: Game.Query({ selection: { house: Game.Query.read(House) }, without: [Site, Rising] }),
      workplaces: Game.Query({ selection: { tile: Game.Query.read(Tile), staff: Game.Query.write(Staff), paused: Game.Query.optional(Paused) }, without: [Site, Rising] })
    },
    resources: { grid: Game.System.readResource(Grid) }
  },
  ({ queries, resources }) => {
    const grid = resources.grid.get()
    let pool = 0
    for (const { data } of queries.homes.each()) pool += data.house.get().residents
    for (const { data } of queries.workplaces.each()) {
      const staff = data.staff.get()
      const assigned = connected(grid, data.tile.get()) && !data.paused.present ? Math.min(staff.needed, pool) : 0
      pool -= assigned
      if (assigned !== staff.assigned) data.staff.set({ ...staff, assigned })
    }
  }
)

// ── Recipes ───────────────────────────────────────────────────────────────

/**
 * One step of every recipe. A job starts when there is room for what it
 * makes, its input is in, and (for a gatherer) the land has what it needs
 * within reach: a grown tree is felled, a rock chipped, a ripe field
 * reaped. Then the crew puts its worker-steps in; a full crew finishes in
 * `period` steps. In winter, fishing goes at half pace.
 */
export const Work = Game.System(
  "Town/Work",
  {
    queries: {
      workshops: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          staff: Game.Query.read(Staff),
          recipe: Game.Query.write(Recipe),
          inventory: Game.Query.write(Inventory),
          status: Game.Query.write(Status),
          gatherer: Game.Query.optional(Gatherer),
          paused: Game.Query.optional(Paused)
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
    const t = elapsed(resources.time.get(), resources.charter.get())
    const slowFishing = seasonAt(t, resources.charter.get()).winter && t % 2 === 1
    const trees = new Map(queries.trees.each().map((row) => [row.entity.id as number, row]))
    const rocks = new Map(queries.rocks.each().map((row) => [row.entity.id as number, row]))
    const fields = new Map(queries.fields.each().map((row) => [row.entity.id as number, row]))
    const used = new Set<number>()

    /** Takes what a gatherer needs from the land within reach, or says there is none. */
    const gather = (source: "tree" | "stone" | "ore" | "field" | "water", tile: { x: number; y: number; size: number }, radius: number): boolean => {
      for (const c of around(tile, radius)) {
        const use = useAt(grid, c.x, c.y)
        const id = ownerAt(grid, c.x, c.y)
        if (used.has(id)) continue
        if (source === "water" && use === "water") return true
        if (source === "tree" && use === "tree") {
          const tree = trees.get(id)
          if (!tree || tree.data.tree.get().growth < GROWN.tree) continue
          commands.despawn(tree.entity.id)
          used.add(id)
          return true
        }
        if ((source === "stone" || source === "ore") && use === "rock") {
          const rock = rocks.get(id)
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
          const field = fields.get(id)
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
      if (open && recipe.progress > 0 && staff.assigned > 0 && !(slowFishing && gatherer?.source === "water")) {
        const progress = recipe.progress + staff.assigned
        if (progress > recipe.period * staff.needed) {
          recipe = { ...recipe, progress: 0, made: recipe.made + 1 }
          stock = { ...stock, [recipe.output]: stock[recipe.output] + recipe.batch }
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
    resources: { grid: Game.System.readResource(Grid), rng: Game.System.writeResource(Rng) }
  },
  ({ queries, resources, commands }) => {
    const grid = resources.grid.get()
    const random = Random.make(resources.rng.get())
    const sown = new Set<number>()
    for (const { entity, data } of queries.planters.each()) {
      const tile = data.tile.get()
      const staff = data.staff.get()
      const planter = data.planter.get()
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
    for (const { data } of queries.trees.each()) {
      const growth = data.tree.get().growth
      if (growth < GROWN.tree) data.tree.set({ growth: growth + 1 })
    }
    if (seasonAt(elapsed(resources.time.get(), resources.charter.get()), resources.charter.get()).winter) return
    for (const { data } of queries.fields.each()) {
      const growth = data.field.get().growth
      if (growth < GROWN.field) data.field.set({ growth: growth + 1 })
    }
  }
)
