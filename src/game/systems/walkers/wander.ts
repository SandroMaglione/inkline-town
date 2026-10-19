import { serveGoods } from "../../rules/households.ts"
import { appealAt } from "../../world/appeal.ts"
import { amounts, each, stepsOf, total } from "../../content/index.ts"
import { DIRS, doors, nearest, ownerAt, pathTo, reach, useAt } from "../../world/grid.ts"
import { inside, type Point } from "../../world/iso.ts"
import { Condition, Game, Rules, Grid, Appeal, Handed, House, Inventory, Pantry, Paused, Rising, Risk, Roam, Route, Service, Sick, Site, Tile, Time, WalkerOf, type HandedValue } from "../../schema.ts"

const arrived = (route: { readonly cells: ReadonlyArray<Point>; readonly index: number }) => route.index >= route.cells.length - 1

/**
 * A service walker wanders: at each cell it serves the homes (and, for a
 * fire watch or a builder, the buildings) beside it, then follows its planned tour. The service rotates its tours to cover every
 * reachable target. Once its tour is
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
      homes: Game.Query({ selection: { house: Game.Query.write(House) }, without: [Site, Rising, Paused] }),
      cared: Game.Query({
        selection: { risk: Game.Query.write(Risk), condition: Game.Query.write(Condition), sick: Game.Query.optional(Sick) },
        without: [Site, Rising]
      }),
      buildings: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Service] }),
      inventories: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Service] })
    },
    resources: { grid: Game.System.readResource(Grid), appeal: Game.System.readResource(Appeal), pantry: Game.System.writeResource(Pantry), handed: Game.System.writeResource(Handed), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.despawns(Roam), Game.System.removes(Sick))
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { home, condition: wear, conditionMax: CONDITION_MAX } = rules

    const grid = resources.grid.get()
    const walkers = queries.walkers.each()
    const homes = new Map<number, ReturnType<typeof queries.homes.each>[number]>()
    for (const row of queries.homes.each()) homes.set(row.entity.id, row)
    const cared = new Map<number, ReturnType<typeof queries.cared.each>[number]>()
    for (const row of queries.cared.each()) cared.set(row.entity.id, row)
    let eaten = 0
    // What each walker hands each home, for its building's last minute (see `Handed`).
    const tick = resources.time.get().step
    const handed: Array<HandedValue["log"][number]> = []

    for (const { entity, data } of walkers) {
      const route = data.route.get()
      const roam = data.roam.get()
      // left counts cells still to serve. Older saves can finish their current short segment.
      if (roam.back ? !arrived(route) : roam.left > route.cells.length ? !arrived(route) : route.index < route.cells.length - roam.left) continue
      const from = data.home.get()

      if (roam.back) {
        const inv = queries.inventories.get(from)
        if (inv.ok && total(roam.basket) > 0) {
          const i = inv.value.data.inventory.get()
          // What it did not hand out goes back on the shelf, even past its room (the shelf filled again meanwhile):
          // the building asks for no more until it is down again, and nothing is lost.
          inv.value.data.inventory.set({ ...i, stock: each((g) => i.stock[g] + roam.basket[g]) })
        }
        commands.despawn(entity)
        continue
      }

      // Serve the homes (and buildings) beside this cell.
      const cell = route.cells[route.index]!
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
            const served = serveGoods(h, amounts(basket), rules, appealAt(resources.appeal.get().cells, x, y))
            const given = Object.fromEntries(Object.entries(served.basket).filter(([g, n]) => (basket[g] ?? 0) > n).map(([g, n]) => [g, (basket[g] ?? 0) - n]))
            if (Object.keys(given).length > 0) handed.push({ at: tick, from: data.home.get(), to: id, goods: given })
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
          if (care.data.sick.present) commands.remove(care.entity, Sick)
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
      if (left > 0 && keepsGoing && !arrived(route)) {
        data.roam.set({ ...roam, left, basket: carrying })
        continue
      }

      // Head home.
      const building = queries.buildings.get(from)
      const way = reach(grid, [cell])
      const door = building.ok ? nearest(way, doors(grid, building.value.data.tile.get())) : null
      if (!door) {
        commands.despawn(entity)
        continue
      }
      data.route.set({ cells: pathTo(way, door.cell), index: 0, step: 0 })
      data.roam.set({ ...roam, left: 0, basket: carrying, back: true })
    }
    if (eaten > 0) resources.pantry.update((p) => ({ ...p, eaten: p.eaten + eaten }))
    // The last minute only; a log from another town (its clock behind this one's) is dropped.
    const kept = resources.handed.get().log.filter((l) => l.at <= tick && tick - l.at < stepsOf(60))
    if (handed.length > 0 || kept.length !== resources.handed.get().log.length) resources.handed.set({ log: [...kept, ...handed] })
  }
)
