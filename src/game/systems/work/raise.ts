import { anA, asUpgraded, goodIds, stepsOf, total, upgradeAt, worksNeeded } from "../../content/index.ts"
import { Building, Carriers, Charter, Chronicle, Game, Rules, Inventory, Recipe, Rising, Service, Site, Staff, Status, Storage, Time, Upgraded, Works } from "../../schema.ts"
import { elapsed, write } from "../shared.ts"

/** How often a storage under works takes a crate for it from its own shelves. */
const SELF_SUPPLY_TICKS = stepsOf(1)

/** Where a site's walls are once its materials are in: it goes on rising from here. */
export const SITE_SHARE = 0.35

export const Raise = Game.System(
  "Town/Raise",
  {
    queries: {
      sites: Game.Query({ selection: { site: Game.Query.read(Site) } }),
      rising: Game.Query({ selection: { rising: Game.Query.write(Rising), status: Game.Query.optional(Status) } }),
      works: Game.Query({
        selection: {
          works: Game.Query.write(Works),
          building: Game.Query.read(Building),
          staff: Game.Query.write(Staff),
          recipe: Game.Query.optional(Recipe),
          carriers: Game.Query.optional(Carriers),
          service: Game.Query.optional(Service)
        }
      }),
      /** A storage under works (the town hall, a warehouse): its own shelves. */
      stocked: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Storage, Works] })
    },
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.removes(Works, Site, Rising), Game.System.inserts(Upgraded, Recipe, Carriers, Service, Rising, Status))
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { buildTicks: BUILD_TICKS } = rules

    // An upgrade whose materials are all in stands upgraded: it works from here on as `asUpgraded` says,
    // keeping what it holds and what it was in the middle of.
    const tick = resources.time.get().step
    const { data } = queries.works
    const stocked = queries.stocked.data
    for (const entity of queries.works.each()) {
      let works = data.works.get(entity)
      // A storage under works (the town hall) builds with what it holds itself, a crate at a time.
      const shelves = queries.stocked.get(entity.id)
      if (shelves.ok && tick % SELF_SUPPLY_TICKS === 0) {
        const own = stocked.inventory.get(shelves.value)
        const g = goodIds.find((g) => works.owed[g] > 0 && own.stock[g] > 0)
        if (g) {
          const n = Math.min(rules.transport.load, works.owed[g], own.stock[g])
          stocked.inventory.set(shelves.value, { ...own, stock: { ...own.stock, [g]: own.stock[g] - n } })
          works = { ...works, owed: { ...works.owed, [g]: works.owed[g] - n } }
          data.works.set(entity, works)
        }
      }
      // Builders work on as the materials come in, never ahead of them.
      const needed = worksNeeded(works.total, rules), allowed = needed * (1 - total(works.owed) / Math.max(1, works.total))
      if (works.done < allowed) {
        works = { ...works, done: works.done + 1 }
        data.works.set(entity, works)
      }
      if (total(works.owed) > 0 || works.done < needed) continue
      const base = rules.kinds[data.building.get(entity).kind], kind = asUpgraded(base, works.level)
      commands.remove(entity, Works)
      commands.insert(entity, Game.Command.entry(Upgraded, { level: works.level }))
      data.staff.set(entity, { ...data.staff.get(entity), needed: kind.workers })
      const recipe = data.recipe.get(entity), carriers = data.carriers.get(entity), service = data.service.get(entity)
      if (recipe && kind.recipe) commands.insert(entity, Game.Command.entry(Recipe, { ...recipe, period: stepsOf(kind.recipe.seconds) }))
      if (shelves.ok && kind.holds) stocked.inventory.set(shelves.value, { ...stocked.inventory.get(shelves.value), cap: kind.holds.cap })
      if (carriers && kind.carriers) commands.insert(entity, Game.Command.entry(Carriers, { count: kind.carriers }))
      if (service && kind.service) commands.insert(entity, Game.Command.entry(Service, { ...service, interval: stepsOf(kind.service.seconds), range: kind.service.range }))
      const was = (upgradeAt(base, works.level - 1)?.title ?? base.title).toLowerCase()
      write(resources.chronicle, elapsed(resources.time.get(), resources.charter.get()), `The ${was} is now ${anA(upgradeAt(base, works.level)!.title.toLowerCase())}.`, true)
    }

    const sites = queries.sites.data
    for (const entity of queries.sites.each()) {
      if (total(sites.site.get(entity).owed) > 0) continue
      commands.remove(entity, Site)
      commands.insert(entity, Game.Command.entry(Rising, { ticks: Math.round(BUILD_TICKS * SITE_SHARE) }))
    }
    const rising = queries.rising.data
    for (const entity of queries.rising.each()) {
      const ticks = rising.rising.get(entity).ticks + 1
      if (ticks >= BUILD_TICKS) {
        commands.remove(entity, Rising)
        // Up and standing; its work (if it has any) says otherwise from here on.
        if (rising.status.has(entity)) commands.insert(entity, Game.Command.entry(Status, "idle"))
      } else rising.rising.set(entity, { ticks })
    }
  }
)
