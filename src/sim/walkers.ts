/**
 * Walking: every walker steps along its route; service buildings send a
 * walker out now and then, who wanders the roads serving the homes beside
 * it — a market's (or the town hall's) with a basket of provisions, a
 * chapel's with faith — and walks home when its range is walked.
 */
import * as Random from "@typeonce/bevy-ts-math/Random"

import { amounts, categoryColor, each, home, kinds, provisions, total, type Amounts, type Need } from "../content.ts"
import { DIRS, doors, isRoad, key, nearest, pathTo, reach } from "../grid.ts"
import { inside, type Point } from "../iso.ts"
import {
  Building, Figure, Game, Grid, House, Inventory, Paused, Recipe, Rising, Rng, Roam, Route, Service, Site, Staff, Status, Tile, WalkerOf,
  maybe, type Status as StatusValue
} from "../schema.ts"
import { CELL_STEPS } from "./shared.ts"

/** Steps a walker takes each tick: 1.25 cells a second. */
const WALK = 1
/** Of each provision, the most a walker's basket holds. */
const BASKET = 10
/** Walkers a service building may have out on the roads at once. */
const OUT = 2

/** Every walker steps along its route; one whose next cell is no longer road is lost. */
export const Walk = Game.System(
  "Town/Walk",
  {
    queries: { walkers: Game.Query({ selection: { route: Game.Query.write(Route) } }) },
    resources: { grid: Game.System.readResource(Grid) }
  },
  ({ queries, resources, commands }) => {
    const grid = resources.grid.get()
    for (const { entity, data } of queries.walkers.each()) {
      const route = data.route.get()
      const last = route.cells.length - 1
      if (route.index >= last) continue
      const next = route.cells[route.index + 1]!
      if (!isRoad(grid, next.x, next.y)) {
        commands.despawn(entity.id)
        continue
      }
      const step = route.step + WALK
      if (step < CELL_STEPS) data.route.set({ ...route, step })
      else {
        const index = route.index + 1
        data.route.set({ ...route, index, step: index >= last ? 0 : step - CELL_STEPS })
      }
    }
  }
)

/**
 * A staffed service building sends a walker every `interval` steps, up to
 * `OUT` at a time. A provisions walker fills its basket from the building's stock, and
 * only goes when there is something to hand out.
 */
export const SendWalkers = Game.System(
  "Town/SendWalkers",
  {
    queries: {
      services: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          building: Game.Query.read(Building),
          staff: Game.Query.read(Staff),
          service: Game.Query.write(Service),
          status: Game.Query.write(Status),
          inventory: Game.Query.optional(Inventory),
          recipe: Game.Query.optional(Recipe),
          paused: Game.Query.optional(Paused)
        },
        without: [Site, Rising]
      }),
      inventories: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Service] }),
      walkers: Game.Query({ selection: { roam: Game.Query.read(Roam), home: Game.Query.readRelation(WalkerOf) } })
    },
    resources: { grid: Game.System.readResource(Grid) }
  },
  ({ queries, resources, commands }) => {
    const grid = resources.grid.get()
    const out = new Map<number, number>()
    for (const { data } of queries.walkers.each()) out.set(data.home.get(), (out.get(data.home.get()) ?? 0) + 1)

    for (const { entity, data } of queries.services.each()) {
      const service = data.service.get()
      const staff = data.staff.get()
      const starts = doors(grid, data.tile.get())
      const stock = maybe(data.inventory)?.stock
      const staffed = !data.paused.present && (staff.needed === 0 || staff.assigned > 0)
      const basket: Amounts = each((g) => (service.service === "goods" && stock && provisions.includes(g) ? Math.min(BASKET, stock[g]) : 0))
      const goes = service.service === "faith" || total(basket) > 0
      if (!maybe(data.recipe)) {
        const status: StatusValue = data.paused.present
          ? "paused"
          : starts.length === 0
          ? "unconnected"
          : !staffed
          ? "unstaffed"
          : out.has(entity.id)
          ? "working"
          : goes
          ? "idle"
          : "starved"
        if (data.status.get() !== status) data.status.set(status)
      }

      const cooldown = Math.max(0, service.cooldown - 1)
      if (cooldown === 0 && (out.get(entity.id) ?? 0) < OUT && starts.length > 0 && staffed && goes) {
        const color = categoryColor[kinds[data.building.get().kind].category]
        const draft = Game.Command.spawn(
          [Figure, { role: "walker", color }],
          [Route, { cells: [starts[0]!], index: 0, step: 0 }],
          [Roam, { service: service.service, left: service.range, basket, back: false }]
        )
        commands.spawn(Game.Command.relate(draft, WalkerOf, entity.id))
        const inv = queries.inventories.get(entity.id)
        if (inv.ok && total(basket) > 0) {
          const i = inv.value.data.inventory.get()
          inv.value.data.inventory.set({ ...i, stock: each((g) => i.stock[g] - basket[g]) })
        }
        data.service.set({ ...service, cooldown: service.interval })
      } else if (cooldown !== service.cooldown) data.service.set({ ...service, cooldown })
    }
  }
)

const arrived = (route: { readonly cells: ReadonlyArray<Point>; readonly index: number }) => route.index >= route.cells.length - 1

/**
 * A service walker wanders: at each cell it serves the homes beside it, then
 * picks a road onward at random (never straight back, unless it must). Once
 * its range is walked, or its basket is empty, it heads home by the shortest
 * road, and puts back what it still carries.
 *
 * A home low on a need takes what meets it: bread or else fish for food
 * (bread meets the citizens' bread need too), cloth for cloth; a chapel's
 * walker brings faith.
 */
export const Wander = Game.System(
  "Town/Wander",
  {
    queries: {
      walkers: Game.Query({ selection: { route: Game.Query.write(Route), roam: Game.Query.write(Roam), home: Game.Query.readRelation(WalkerOf) } }),
      homes: Game.Query({ selection: { tile: Game.Query.read(Tile), house: Game.Query.write(House) }, without: [Site, Rising] }),
      buildings: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Service] }),
      inventories: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Service] })
    },
    resources: { grid: Game.System.readResource(Grid), rng: Game.System.writeResource(Rng) }
  },
  ({ queries, resources, commands }) => {
    const grid = resources.grid.get()
    const random = Random.make(resources.rng.get())
    const homes = new Map<number, ReturnType<typeof queries.homes.each>[number]>()
    for (const row of queries.homes.each()) {
      const t = row.data.tile.get()
      homes.set(key(t.x, t.y), row)
    }
    const low = (left: number, need: Need) => left < home.lasts[need] / 2

    for (const { entity, data } of queries.walkers.each()) {
      const route = data.route.get()
      if (!arrived(route)) continue
      const roam = data.roam.get()
      const from = data.home.get()

      if (roam.back) {
        const inv = queries.inventories.get(from)
        if (inv.ok && total(roam.basket) > 0) {
          const i = inv.value.data.inventory.get()
          inv.value.data.inventory.set({ ...i, stock: each((g) => Math.min(i.cap, i.stock[g] + roam.basket[g])) })
        }
        commands.despawn(entity.id)
        continue
      }

      // Serve the homes beside this cell.
      const cell = route.cells[route.cells.length - 1]!
      const basket: Record<string, number> = { ...roam.basket }
      for (const d of DIRS) {
        const x = cell.x + d.x
        const y = cell.y + d.y
        const row = inside(x, y) ? homes.get(key(x, y)) : undefined
        if (!row) continue
        const h = { ...row.data.house.get() }
        if (roam.service === "faith") h.faith = home.lasts.faith
        else {
          if ((low(h.food, "food") || (h.tier === 2 && low(h.bread, "bread"))) && (basket.bread ?? 0) > 0) {
            basket.bread = (basket.bread ?? 0) - 1
            h.food = home.lasts.food
            h.bread = home.lasts.bread
          } else if (low(h.food, "food") && (basket.fish ?? 0) > 0) {
            basket.fish = (basket.fish ?? 0) - 1
            h.food = home.lasts.food
          }
          if (low(h.cloth, "cloth") && (basket.cloth ?? 0) > 0) {
            basket.cloth = (basket.cloth ?? 0) - 1
            h.cloth = home.lasts.cloth
          }
        }
        row.data.house.set(h)
      }
      const left = roam.left - 1
      const carrying = amounts(basket)
      if (left > 0 && (roam.service !== "goods" || total(carrying) > 0)) {
        const previous = route.cells.length >= 2 ? route.cells[route.cells.length - 2]! : null
        const onward = DIRS
          .map((d) => ({ x: cell.x + d.x, y: cell.y + d.y }))
          .filter((c) => isRoad(grid, c.x, c.y) && !(previous && c.x === previous.x && c.y === previous.y))
        const next = random.pick(onward) ?? previous
        if (next) {
          data.route.set({ cells: [cell, next], index: 0, step: 0 })
          data.roam.set({ ...roam, left, basket: carrying })
          continue
        }
      }

      // Head home.
      const building = queries.buildings.get(from)
      const way = reach(grid, [cell])
      const door = building.ok ? nearest(way, doors(grid, building.value.data.tile.get())) : null
      if (!door) {
        commands.despawn(entity.id)
        continue
      }
      data.route.set({ cells: pathTo(way, door.cell), index: 0, step: 0 })
      data.roam.set({ ...roam, left: 0, basket: carrying, back: true })
    }
    resources.rng.set(random.state)
  }
)
