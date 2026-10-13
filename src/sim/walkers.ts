import { serveGoods } from "../rules/households.ts"
import { transport } from "../rules/config.ts"
import { onwardRoads } from "../rules/transport.ts"
/**
 * Walking: every walker steps along its route; service buildings send a
 * walker out now and then, who wanders the roads serving the homes beside
 * it — a market's (or the town hall's) with a basket of provisions, a
 * chapel's with faith, a fire watch's, a healer's, and a watch house's
 * keeping down the risk of fire, sickness, and disorder, a builder's with
 * planks and stone to mend — and walks home when its range is walked.
 */
import * as Random from "@typeonce/bevy-ts-math/Random"

import { amounts, categoryColor, each, provisions, total, type Amounts } from "../content.ts"
import { DIRS, doors, isRoad, nearest, ownerAt, pathTo, reach, useAt } from "../grid.ts"
import { inside, type Point } from "../iso.ts"
import { Building, Burning, Condition, Figure, Game, Rules, Grid, House, Inventory, Pantry, Paused, Recipe, Rescue, Rising, Risk, Rng, Roam, Route, Service, Sick, Site, Staff, Status, Tile, Time, WalkerOf, maybe, type Status as StatusValue } from "../schema.ts"
import { CELL_STEPS } from "./shared.ts"
import { paced } from "./work.ts"

/** Steps a walker takes each tick: 1.25 cells a second. */
const WALK = transport.walk
/** Firefighters run to a blaze. */
const RUN = transport.run
/** Of each provision, the most a walker's basket holds. */
const BASKET = transport.basket
/** Walkers a service building may have out on the roads at once. */
const OUT = transport.active

/** Every walker steps along its route (a firefighter on the way to a blaze runs); one whose next cell is no longer road is lost. */
export const Walk = Game.System(
  "Town/Walk",
  {
    queries: { walkers: Game.Query({ selection: { route: Game.Query.write(Route), rescue: Game.Query.optional(Rescue) } }) },
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
      const running = data.rescue.present && !data.rescue.get().back
      const step = route.step + (running ? RUN : WALK)
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
        without: [Site, Rising, Burning]
      }),
      inventories: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Service] }),
      walkers: Game.Query({ selection: { roam: Game.Query.read(Roam), home: Game.Query.readRelation(WalkerOf) } })
    },
    resources: { grid: Game.System.readResource(Grid), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { kinds, apprentice: APPRENTICE } = rules

    const grid = resources.grid.get()
    const tick = resources.time.get().tick
    const out = new Map<number, number>()
    for (const { data } of queries.walkers.each()) out.set(data.home.get(), (out.get(data.home.get()) ?? 0) + 1)

    for (const { entity, data } of queries.services.each()) {
      const service = data.service.get()
      const staff = data.staff.get()
      const starts = doors(grid, data.tile.get())
      const stock = maybe(data.inventory)?.stock
      const staffed = !data.paused.present && (staff.needed === 0 || staff.assigned > 0)
      const carries = (g: (typeof provisions)[number]) =>
        service.service === "goods" ? provisions.includes(g) : service.service === "repair" ? g === "planks" || g === "stone" : false
      const basket: Amounts = each((g) => (stock && carries(g) ? Math.min(BASKET, stock[g]) : 0))
      const goes = service.service === "goods" ? total(basket) > 0 : service.service === "repair" ? basket.planks > 0 : true
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

      // A crew of apprentices sends walkers less often.
      const learning = staff.assigned > 0 && staff.assigned === staff.apprentices && !paced(APPRENTICE, tick)
      const cooldown = learning ? service.cooldown : Math.max(0, service.cooldown - 1)
      if (cooldown === 0 && (out.get(entity.id) ?? 0) < OUT && starts.length > 0 && staffed && goes) {
        const color = categoryColor[kinds[data.building.get().kind].category]
        const draft = Game.Command.spawn(
          [Figure, { role: "walker", color }],
          [Route, { cells: [{ x: starts[0]!.x, y: starts[0]!.y }], index: 0, step: 0 }],
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
 * A service walker wanders: at each cell it serves the homes (and, for a
 * fire watch or a builder, the buildings) beside it, then picks a road
 * onward at random (never straight back, unless it must). Once its range is
 * walked, or its basket is empty, it heads home by the shortest road, and
 * puts back what it still carries.
 *
 * A home low on a need takes what meets it: bread or else fish (fresh
 * first, then smoked) for food (bread meets the citizens' bread need too),
 * cloth for cloth; a chapel's walker brings faith. A watchman, a physician,
 * and a constable reset the risk they look after (a physician cures the
 * sick; a constable's visit is the end of a home's thefts); a builder mends
 * whatever is run down, a plank for a home, a plank and a stone for a
 * building.
 */
export const Wander = Game.System(
  "Town/Wander",
  {
    queries: {
      walkers: Game.Query({ selection: { route: Game.Query.write(Route), roam: Game.Query.write(Roam), home: Game.Query.readRelation(WalkerOf) } }),
      homes: Game.Query({ selection: { house: Game.Query.write(House) }, without: [Site, Rising] }),
      cared: Game.Query({
        selection: { risk: Game.Query.write(Risk), condition: Game.Query.write(Condition), sick: Game.Query.optional(Sick) },
        without: [Site, Rising]
      }),
      buildings: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Service] }),
      inventories: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Service] })
    },
    resources: { grid: Game.System.readResource(Grid), rng: Game.System.writeResource(Rng), pantry: Game.System.writeResource(Pantry) },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { home, condition: wear, conditionMax: CONDITION_MAX } = rules

    const grid = resources.grid.get()
    const random = Random.make(resources.rng.get())
    const walkers = queries.walkers.each()
    if (!walkers.some(({ data }) => arrived(data.route.get()))) return
    const homes = new Map<number, ReturnType<typeof queries.homes.each>[number]>()
    for (const row of queries.homes.each()) homes.set(row.entity.id, row)
    const cared = new Map<number, ReturnType<typeof queries.cared.each>[number]>()
    for (const row of queries.cared.each()) cared.set(row.entity.id, row)
    let eaten = 0

    for (const { entity, data } of walkers) {
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

      // Serve the homes (and buildings) beside this cell.
      const cell = route.cells[route.cells.length - 1]!
      const basket: Record<string, number> = { ...roam.basket }
      const served = new Set<number>()
      for (const d of DIRS) {
        const x = cell.x + d.x
        const y = cell.y + d.y
        if (!inside(x, y)) continue
        const use = useAt(grid, x, y)
        if (use !== "house" && use !== "building") continue
        const id = ownerAt(grid, x, y)
        if (served.has(id)) continue
        served.add(id)
        const row = use === "house" ? homes.get(id) : undefined
        const care = cared.get(id)
        if (row) {
          const h = { ...row.data.house.get() }
          if (roam.service === "faith") h.faith = home.lasts.faith
          else if (roam.service === "goods") {
            const served = serveGoods(h, amounts(basket), rules)
            Object.assign(h, served.house)
            Object.assign(basket, served.basket)
            eaten += served.eaten
          }
          row.data.house.set(h)
        }
        if (!care) continue
        const r = care.data.risk.get()
        if (roam.service === "fire" && r.fire > 0) care.data.risk.set({ ...r, fire: 0 })
        if (row && roam.service === "health") {
          if (r.health > 0) care.data.risk.set({ ...r, health: 0 })
          if (care.data.sick.present) commands.remove(care.entity.id, Sick)
        }
        if (row && roam.service === "order" && (r.order > 0 || r.thefts > 0)) care.data.risk.set({ ...r, order: 0, thefts: 0 })
        if (roam.service === "repair") {
          const c = care.data.condition.get().value
          if (c < wear.mend && (basket.planks ?? 0) > 0) {
            basket.planks = (basket.planks ?? 0) - 1
            const stone = !row && (basket.stone ?? 0) > 0
            if (stone) basket.stone = (basket.stone ?? 0) - 1
            care.data.condition.set({ value: row || stone ? CONDITION_MAX : Math.min(CONDITION_MAX, c + 300) })
          }
        }
      }
      const left = roam.left - 1
      const carrying = amounts(basket)
      const keepsGoing = roam.service === "goods" ? total(carrying) > 0 : roam.service === "repair" ? carrying.planks > 0 : true
      if (left > 0 && keepsGoing) {
        const previous = route.cells.length >= 2 ? route.cells[route.cells.length - 2]! : null
        const onward = onwardRoads(grid, cell, previous)
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
    if (eaten > 0) resources.pantry.update((p) => ({ ...p, eaten: p.eaten + eaten }))
  }
)
