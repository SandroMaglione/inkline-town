import type { Point } from "../../world/iso.ts"
import { Errand, Game, Rules, Inventory, Route, Site, Tile, WalkerOf, Works } from "../../schema.ts"
import { CELL_STEPS } from "../shared.ts"

const arrived = (route: { readonly cells: ReadonlyArray<Point>; readonly index: number }) => route.index >= route.cells.length - 1

/** The way back from where a walker is now, mid-step or not. */
export const turnAround = (route: { readonly cells: ReadonlyArray<Point>; readonly index: number; readonly step: number }) => {
  const behind = route.cells.slice(0, route.index + 1).reverse()
  const ahead = route.cells[route.index + 1]
  return route.step > 0 && ahead
    ? { cells: [ahead, ...behind], index: 0, step: CELL_STEPS - route.step }
    : { cells: behind, index: 0, step: 0 }
}

const TargetRead = Game.Query({ selection: { tile: Game.Query.read(Tile) } })

/**
 * A carrier hands its crate over: to a site or an upgrade under way, towards what it is owed; to
 * anyone else, as much as they have room for. Then it walks back, and puts
 * whatever it still carries back where it came from.
 */
export const Deliver = Game.System(
  "Town/Deliver",
  {
    queries: {
      carriers: Game.Query({ selection: { route: Game.Query.write(Route), errand: Game.Query.write(Errand), home: Game.Query.readRelation(WalkerOf) } }),
      targets: TargetRead,
      inventories: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, without: [Site] }),
      sites: Game.Query({ selection: { site: Game.Query.write(Site) } }),
      works: Game.Query({ selection: { works: Game.Query.write(Works) } })
    },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.despawns(Errand))
  },
  ({ queries, commands, services }) => {
    const rules = services.rules
    const {  } = rules

    const { data } = queries.carriers
    const shelves = queries.inventories.data.inventory
    for (const entity of queries.carriers.each()) {
      const route = data.route.get(entity)
      const errand = data.errand.get(entity)
      if (errand.back) {
        if (!arrived(route)) continue
        const home = queries.inventories.get(data.home.get(entity))
        if (home.ok && errand.count > 0) {
          const inv = shelves.get(home.value)
          const room = inv.cap - inv.stock[errand.good]
          shelves.set(home.value, { ...inv, stock: { ...inv.stock, [errand.good]: inv.stock[errand.good] + Math.min(room, errand.count) } })
        }
        commands.despawn(entity)
        continue
      }
      const target = queries.targets.getHandle(errand.target)
      if (!target.ok) {
        // Nowhere to take it: carry it home.
        data.route.set(entity, turnAround(route))
        data.errand.set(entity, { ...errand, back: true })
        continue
      }
      if (!arrived(route)) continue
      let handed = 0
      const site = queries.sites.get(target.value.id)
      const works = queries.works.get(target.value.id)
      const inventory = queries.inventories.get(target.value.id)
      if (works.ok && queries.works.data.works.get(works.value).owed[errand.good] > 0) {
        const w = queries.works.data.works.get(works.value)
        handed = Math.min(errand.count, w.owed[errand.good])
        queries.works.data.works.set(works.value, { ...w, owed: { ...w.owed, [errand.good]: w.owed[errand.good] - handed } })
      } else if (site.ok) {
        const s = queries.sites.data.site.get(site.value)
        handed = Math.min(errand.count, s.owed[errand.good])
        queries.sites.data.site.set(site.value, { ...s, owed: { ...s.owed, [errand.good]: s.owed[errand.good] - handed } })
      } else if (inventory.ok) {
        const inv = shelves.get(inventory.value)
        if (inv.accepts.includes(errand.good)) {
          handed = Math.min(errand.count, inv.cap - inv.stock[errand.good])
          shelves.set(inventory.value, { ...inv, stock: { ...inv.stock, [errand.good]: inv.stock[errand.good] + handed } })
        }
      }
      data.route.set(entity, { cells: [...route.cells].reverse(), index: 0, step: 0 })
      data.errand.set(entity, { ...errand, count: errand.count - handed, back: true })
    }
  }
)
