import { transport } from "../../rules/config.ts"
import { planPatrols } from "../../rules/patrol.ts"
import { categoryColor, each, provisions, total, type Amounts } from "../../content/index.ts"
import { doors } from "../../world/grid.ts"
import { Building, Burning, Condition, Figure, Game, Rules, Grid, Patrol, House, Inventory, Paused, Recipe, Rising, Roam, Route, Service, Site, Staff, Status, Tile, Time, WalkerOf, type Status as StatusValue } from "../../schema.ts"
import { paced } from "../work/index.ts"

/** Of each provision, the most a walker's basket holds. */
const BASKET = transport.basket
/** Walkers a service building may have out on the roads at once. */
const OUT = transport.active

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
      patrols: Game.Query({ selection: { patrol: Game.Query.write(Patrol) } }),
      targets: Game.Query({ selection: { tile: Game.Query.read(Tile), house: Game.Query.optional(House) }, with: [Condition], without: [Site, Rising, Burning] }),
      walkers: Game.Query({ selection: { roam: Game.Query.read(Roam), home: Game.Query.readRelation(WalkerOf) } })
    },
    resources: { grid: Game.System.readResource(Grid), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.spawns(Roam), Game.System.inserts(Patrol), Game.System.relates(WalkerOf))
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { kinds, apprentice: APPRENTICE } = rules

    const grid = resources.grid.get()
    const tick = resources.time.get().step
    const out = new Map<number, number>()
    for (const { data } of queries.walkers.each()) out.set(data.home.get(), (out.get(data.home.get()) ?? 0) + 1)

    for (const { entity, data } of queries.services.each()) {
      const service = data.service.get()
      const staff = data.staff.get()
      const starts = doors(grid, data.tile.get())
      const stock = data.inventory.value()?.stock
      const staffed = !data.paused.present && (staff.needed === 0 || staff.assigned > 0)
      const carries = (g: (typeof provisions)[number]) =>
        service.service === "goods" ? provisions.includes(g) : service.service === "repair" ? g === "planks" || g === "stone" : false
      const basket: Amounts = each((g) => (stock && carries(g) ? Math.min(BASKET, stock[g]) : 0))
      const goes = service.service === "goods" ? total(basket) > 0 : service.service === "repair" ? basket.planks > 0 : true
      if (!data.recipe.value()) {
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
        const targets = queries.targets.each().filter(({ data }) => service.service === "fire" || service.service === "repair" || data.house.present)
          .map(({ entity, data }) => ({ id: entity.id as number, tile: data.tile.get() }))
        const plan = planPatrols(grid, data.tile.get(), service.range, targets)
        if (plan.tours.length === 0) continue
        const patrol = queries.patrols.get(entity.id)
        const cursor = patrol.ok ? patrol.value.data.patrol.get().next : 0
        const tour = plan.tours[cursor % plan.tours.length]!
        if (patrol.ok) patrol.value.data.patrol.set({ next: (cursor + 1) % plan.tours.length })
        else commands.insert(entity, Game.Command.entry(Patrol, { next: 1 % plan.tours.length }))
        const color = categoryColor[kinds[data.building.get().kind].category]
        const draft = Game.Command.spawn(
          [Figure, { role: "walker", color }],
          [Route, { cells: [...tour], index: 0, step: 0 }],
          [Roam, { service: service.service, left: tour.length, basket, back: false }]
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
