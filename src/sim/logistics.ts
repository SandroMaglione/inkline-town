import { every } from "../content.ts"
import { transport } from "../rules/config.ts"
import { wantsBurgherGoods, wantsCitizenGoods } from "../rules/households.ts"
import { appealAt } from "../appeal.ts"
import { preferDelivery } from "../rules/transport.ts"
/**
 * Carriers: every good that moves walks along the roads in a carrier's
 * crate. What a building wants — a site's materials, a workshop's input, a
 * market's provisions — is a demand; a producer sends what it makes to the
 * emptiest operating shelf, or else to the nearest storage with room, and a
 * storage balances the demands it can meet. Construction comes first. Crates
 * already on their way count against a demand, so no one is sent twice.
 */
import { goodIds, provisions, type GoodId } from "../content.ts"
import { doors, nearest, pathTo, reach, key, type Reach } from "../grid.ts"
import type { Point } from "../iso.ts"
import { Building, Burning, Carriers, Errand, Figure, Game, Rules, Grid, House, Appeal, Inventory, Recipe, Rising, Route, Service, Site, Storage, Tile, Time, WalkerOf, Works } from "../schema.ts"
import { CELL_STEPS } from "./shared.ts"

/** The most a carrier takes at once. */
const LOAD = transport.load
/** Carriers are sent out this often: ten times a second, a delay no one sees, at a sixth of the work. */
const DISPATCH_TICKS = transport.dispatchTicks

export const Dispatch = Game.System(
  "Town/Dispatch",
  {
    queries: {
      senders: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          inventory: Game.Query.write(Inventory),
          carriers: Game.Query.read(Carriers),
          building: Game.Query.optional(Building),
          storage: Game.Query.optional(Storage),
          recipe: Game.Query.optional(Recipe)
        },
        without: [Site, Rising, Burning]
      }),
      wanting: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          building: Game.Query.optional(Building),
          inventory: Game.Query.optional(Inventory),
          recipe: Game.Query.optional(Recipe),
          service: Game.Query.optional(Service),
          storage: Game.Query.optional(Storage)
        },
        without: [Site, Rising, Burning]
      }),
      homes: Game.Query({ selection: { tile: Game.Query.read(Tile), house: Game.Query.read(House) }, without: [Site, Rising, Burning] }),
      sites: Game.Query({ selection: { tile: Game.Query.read(Tile), site: Game.Query.read(Site) } }),
      works: Game.Query({ selection: { tile: Game.Query.read(Tile), works: Game.Query.read(Works) }, without: [Burning] }),
      errands: Game.Query({ selection: { errand: Game.Query.read(Errand), home: Game.Query.readRelation(WalkerOf) } })
    },
    resources: { grid: Game.System.readResource(Grid), appeal: Game.System.readResource(Appeal), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.spawns(Errand), Game.System.relates(WalkerOf))
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { kinds, goods, spoils, toolStock: TOOL_STOCK } = rules

    if (!every(resources.time.get(), DISPATCH_TICKS)) return
    const grid = resources.grid.get()
    const out = new Map<number, number>()
    const incoming = new Map<string, number>()
    const inbound = (target: number, good: GoodId) => incoming.get(`${target}:${good}`) ?? 0
    const expect = (target: number, good: GoodId, count: number) => incoming.set(`${target}:${good}`, inbound(target, good) + count)
    for (const { data } of queries.errands.each()) {
      const errand = data.errand.get()
      out.set(data.home.get(), (out.get(data.home.get()) ?? 0) + 1)
      if (!errand.back) expect(errand.target, errand.good, errand.count)
    }

    type Id = ReturnType<typeof queries.sites.each>[number]["entity"]["id"]
    // Outstanding demand and shelf fill, including goods already in transit.
    interface Want {
      readonly id: Id
      readonly doors: ReadonlyArray<Point>
      readonly good: GoodId
      readonly want: () => number
      readonly site: boolean
      readonly fill?: () => number
    }
    const wants: Array<Want> = []
    for (const { entity, data } of queries.sites.each()) {
      const site = data.site.get()
      const ds = doors(grid, data.tile.get())
      for (const g of goodIds) if (site.owed[g] > 0) wants.push({ id: entity.id, doors: ds, good: g, site: true, want: () => site.owed[g] - inbound(entity.id, g) })
    }
    // An upgrade under way is building work too: its materials go before anyone's shelves.
    for (const { entity, data } of queries.works.each()) {
      const works = data.works.get()
      const ds = doors(grid, data.tile.get())
      for (const g of goodIds) if (works.owed[g] > 0) wants.push({ id: entity.id, doors: ds, good: g, site: true, want: () => works.owed[g] - inbound(entity.id, g) })
    }
    const sitesWant = new Set(wants.filter((w) => w.want() > 0).map((w) => w.good))
    const rooms: Array<{ readonly id: Id; readonly doors: ReadonlyArray<Point>; readonly room: (g: GoodId) => number; readonly keeps: boolean }> = []
    for (const { entity, data } of queries.wanting.each()) {
      const inventory = data.inventory.value()
      if (!inventory) continue
      const ds = doors(grid, data.tile.get())
      if (ds.length === 0) continue
      const recipe = data.recipe.value()
      const space = (g: GoodId) => (inventory.accepts.includes(g) ? inventory.cap - inventory.stock[g] - inbound(entity.id, g) : 0)
      const kind = data.building.value()?.kind
      if (data.storage.present) {
        rooms.push({ id: entity.id, doors: ds, room: space, keeps: kind !== undefined && (kinds[kind].keeps ?? 0) > 1 })
      }
      if (recipe && recipe.input !== null) {
        const g = recipe.input
        wants.push({ id: entity.id, doors: ds, good: g, site: false, want: () => space(g), fill: () => (inventory.stock[g] + inbound(entity.id, g)) / inventory.cap })
      }
      // A workshop that wears out tools keeps a couple on hand.
      if (kind !== undefined && kinds[kind].wear) wants.push({ id: entity.id, doors: ds, good: "tools", site: false, want: () => TOOL_STOCK - inventory.stock.tools - inbound(entity.id, "tools"), fill: () => (inventory.stock.tools + inbound(entity.id, "tools")) / TOOL_STOCK })
      const service = data.service.value()?.service
      if (service === "goods") {
        const roads = reach(grid, [ds[0]!]), range = data.service.value()!.range
        let citizenDistrict = false, burgherDistrict = false
        for (const { data: h } of queries.homes.each()) {
          const tile = h.tile.get(), found = nearest(roads, doors(grid, tile))
          if (found === null || found.distance >= range) continue
          const desirability = appealAt(resources.appeal.get().cells, tile.x, tile.y)
          citizenDistrict ||= wantsCitizenGoods(h.house.get(), desirability, rules)
          burgherDistrict ||= wantsBurgherGoods(h.house.get(), desirability, rules)
          if (burgherDistrict) break
        }
        for (const g of provisions) {
          if (g === "cloth" && !citizenDistrict) continue
          if (g === "furniture" && !burgherDistrict) continue
          const cap = Math.min(inventory.cap, rules.transport.basket)
          wants.push({ id: entity.id, doors: ds, good: g, site: false,
            want: () => cap - inventory.stock[g] - inbound(entity.id, g), fill: () => (inventory.stock[g] + inbound(entity.id, g)) / cap })
        }
      }
      if (service === "repair") for (const g of ["planks", "stone"] as const) wants.push({ id: entity.id, doors: ds, good: g, site: false, want: () => space(g) })
    }

    const send = (from: { readonly id: Id; readonly roads: Reach }, to: { readonly id: Id; readonly cell: Point }, good: GoodId, count: number) => {
      const draft = Game.Command.spawn(
        [Figure, { role: "carrier", color: goods[good].color }],
        [Route, { cells: pathTo(from.roads, to.cell), index: 0, step: 0 }],
        [Errand, { target: Game.Entity.handle(to.id, Tile), good, count, back: false }]
      )
      commands.spawn(Game.Command.relate(draft, WalkerOf, from.id))
      out.set(from.id, (out.get(from.id) ?? 0) + 1)
      expect(to.id, good, count)
    }

    for (const { entity, data } of queries.senders.each()) {
      const carriers = data.carriers.get().count
      if ((out.get(entity.id) ?? 0) >= carriers) continue
      const starts = doors(grid, data.tile.get())
      if (starts.length === 0) continue
      const roads = reach(grid, starts)
      const inventory = data.inventory.get()
      let stock = inventory.stock
      const recipe = data.recipe.value()

      // A storage meets demands with what it holds; anyone else sends on what it made.
      // A producer waits for a full load (or a full shelf) so its carriers do not walk with one crate.
      const ready = recipe ? stock[recipe.output] >= Math.min(LOAD, inventory.cap - recipe.batch) : false
      // What sites are waiting for goes first: otherwise steady demand for one good keeps every carrier busy.
      const offers: ReadonlyArray<GoodId> = data.storage.present
        ? goodIds.filter((g) => stock[g] > 0).sort((a, b) => Number(!sitesWant.has(a)) - Number(!sitesWant.has(b)))
        : recipe && ready ? [recipe.output] : []
      for (const good of offers) {
        if ((out.get(entity.id) ?? 0) >= carriers) break
        let best: { readonly id: Id; readonly cell: Point; readonly distance: number; readonly count: number; readonly site: boolean; readonly fill?: number } | null = null
        for (const w of wants) {
          if (w.good !== good || w.id === entity.id) continue
          const count = Math.min(LOAD, stock[good], w.want())
          if (count <= 0) continue
          const found = nearest(roads, w.doors)
          // Sites come first, then the lowest shelf fill; distance breaks ties.
          if (found && preferDelivery({ site: w.site, distance: found.distance, fill: w.fill?.() ?? 0 }, best)) best = { id: w.id, ...found, count, site: w.site, fill: w.fill?.() ?? 0 }
        }
        // Food that spoils goes to a granary if there is one in reach, before the nearest storage; a
        // storage that does not keep food sends it on to a granary that does.
        const perishable = spoils[good] !== undefined
        const senderKeeps = (kinds[data.building.value()?.kind ?? "townhall"].keeps ?? 0) > 1
        if (best === null && (!data.storage.present || (perishable && !senderKeeps))) {
          let kept = false
          for (const r of rooms) {
            if (r.id === entity.id || (data.storage.present && !r.keeps)) continue
            const count = Math.min(LOAD, stock[good], r.room(good))
            if (count <= 0) continue
            const found = nearest(roads, r.doors)
            const keeps = perishable && r.keeps
            if (found && (best === null || (keeps && !kept) || (keeps === kept && found.distance < best.distance))) {
              best = { id: r.id, ...found, count, site: false }
              kept = keeps
            }
          }
        }
        if (best === null) continue
        send({ id: entity.id, roads }, best, good, best.count)
        stock = { ...stock, [good]: stock[good] - best.count }
      }
      if (stock !== inventory.stock) data.inventory.set({ ...inventory, stock })
    }
  }
)

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

    for (const { entity, data } of queries.carriers.each()) {
      const route = data.route.get()
      const errand = data.errand.get()
      if (errand.back) {
        if (!arrived(route)) continue
        const home = queries.inventories.get(data.home.get())
        if (home.ok && errand.count > 0) {
          const inv = home.value.data.inventory.get()
          const room = inv.cap - inv.stock[errand.good]
          home.value.data.inventory.set({ ...inv, stock: { ...inv.stock, [errand.good]: inv.stock[errand.good] + Math.min(room, errand.count) } })
        }
        commands.despawn(entity)
        continue
      }
      const target = queries.targets.getHandle(errand.target)
      if (!target.ok) {
        // Nowhere to take it: carry it home.
        data.route.set(turnAround(route))
        data.errand.set({ ...errand, back: true })
        continue
      }
      if (!arrived(route)) continue
      let handed = 0
      const site = queries.sites.get(target.value.entity.id)
      const works = queries.works.get(target.value.entity.id)
      const inventory = queries.inventories.get(target.value.entity.id)
      if (works.ok && works.value.data.works.get().owed[errand.good] > 0) {
        const w = works.value.data.works.get()
        handed = Math.min(errand.count, w.owed[errand.good])
        works.value.data.works.set({ ...w, owed: { ...w.owed, [errand.good]: w.owed[errand.good] - handed } })
      } else if (site.ok) {
        const s = site.value.data.site.get()
        handed = Math.min(errand.count, s.owed[errand.good])
        site.value.data.site.set({ ...s, owed: { ...s.owed, [errand.good]: s.owed[errand.good] - handed } })
      } else if (inventory.ok) {
        const inv = inventory.value.data.inventory.get()
        if (inv.accepts.includes(errand.good)) {
          handed = Math.min(errand.count, inv.cap - inv.stock[errand.good])
          inventory.value.data.inventory.set({ ...inv, stock: { ...inv.stock, [errand.good]: inv.stock[errand.good] + handed } })
        }
      }
      data.route.set({ cells: [...route.cells].reverse(), index: 0, step: 0 })
      data.errand.set({ ...errand, count: errand.count - handed, back: true })
    }
  }
)

