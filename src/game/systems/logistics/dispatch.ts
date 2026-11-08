import { every } from "../../content/index.ts"
import { transport } from "../../rules/config.ts"
import { wantsBurgherGoods, wantsCitizenGoods } from "../../rules/households.ts"
import { appealAt } from "../../world/appeal.ts"
import { preferDelivery } from "../../rules/transport.ts"
import { goodIds, provisions, type GoodId } from "../../content/index.ts"
import { doors, nearest, pathTo, reach, key, type Reach } from "../../world/grid.ts"
import type { Point } from "../../world/iso.ts"
import { Building, Burning, Carriers, Errand, Figure, Game, Rules, Grid, House, Appeal, Inventory, Recipe, Rising, Route, Service, Site, Storage, Tile, Time, WalkerOf, Works } from "../../schema.ts"

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
    const errands = queries.errands.data
    for (const entity of queries.errands.each()) {
      const errand = errands.errand.get(entity)
      out.set(errands.home.get(entity), (out.get(errands.home.get(entity)) ?? 0) + 1)
      if (!errand.back) expect(errand.target, errand.good, errand.count)
    }

    type Id = ReturnType<typeof queries.sites.each>[number]["id"]
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
    const sites = queries.sites.data
    for (const entity of queries.sites.each()) {
      const site = sites.site.get(entity)
      const ds = doors(grid, sites.tile.get(entity))
      for (const g of goodIds) if (site.owed[g] > 0) wants.push({ id: entity.id, doors: ds, good: g, site: true, want: () => site.owed[g] - inbound(entity.id, g) })
    }
    // An upgrade under way is building work too: its materials go before anyone's shelves.
    const upgrades = queries.works.data
    for (const entity of queries.works.each()) {
      const works = upgrades.works.get(entity)
      const ds = doors(grid, upgrades.tile.get(entity))
      for (const g of goodIds) if (works.owed[g] > 0) wants.push({ id: entity.id, doors: ds, good: g, site: true, want: () => works.owed[g] - inbound(entity.id, g) })
    }
    const sitesWant = new Set(wants.filter((w) => w.want() > 0).map((w) => w.good))
    const rooms: Array<{ readonly id: Id; readonly doors: ReadonlyArray<Point>; readonly room: (g: GoodId) => number; readonly keeps: boolean }> = []
    const wanting = queries.wanting.data
    const homes = queries.homes.data
    for (const entity of queries.wanting.each()) {
      const inventory = wanting.inventory.get(entity)
      if (!inventory) continue
      const ds = doors(grid, wanting.tile.get(entity))
      if (ds.length === 0) continue
      const recipe = wanting.recipe.get(entity)
      const space = (g: GoodId) => (inventory.accepts.includes(g) ? inventory.cap - inventory.stock[g] - inbound(entity.id, g) : 0)
      const kind = wanting.building.get(entity)?.kind
      if (wanting.storage.has(entity)) {
        rooms.push({ id: entity.id, doors: ds, room: space, keeps: kind !== undefined && (kinds[kind].keeps ?? 0) > 1 })
      }
      if (recipe && recipe.input !== null) {
        const g = recipe.input
        wants.push({ id: entity.id, doors: ds, good: g, site: false, want: () => space(g), fill: () => (inventory.stock[g] + inbound(entity.id, g)) / inventory.cap })
      }
      // A workshop that wears out tools keeps a couple on hand.
      if (kind !== undefined && kinds[kind].wear) wants.push({ id: entity.id, doors: ds, good: "tools", site: false, want: () => TOOL_STOCK - inventory.stock.tools - inbound(entity.id, "tools"), fill: () => (inventory.stock.tools + inbound(entity.id, "tools")) / TOOL_STOCK })
      const service = wanting.service.get(entity)?.service
      if (service === "goods") {
        const roads = reach(grid, [ds[0]!]), range = wanting.service.get(entity)!.range
        let citizenDistrict = false, burgherDistrict = false
        for (const home of queries.homes.each()) {
          const tile = homes.tile.get(home), found = nearest(roads, doors(grid, tile))
          if (found === null || found.distance >= range) continue
          const desirability = appealAt(resources.appeal.get().cells, tile.x, tile.y)
          citizenDistrict ||= wantsCitizenGoods(homes.house.get(home), desirability, rules)
          burgherDistrict ||= wantsBurgherGoods(homes.house.get(home), desirability, rules)
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

    const { data } = queries.senders
    for (const entity of queries.senders.each()) {
      const carriers = data.carriers.get(entity).count
      if ((out.get(entity.id) ?? 0) >= carriers) continue
      const starts = doors(grid, data.tile.get(entity))
      if (starts.length === 0) continue
      const roads = reach(grid, starts)
      const inventory = data.inventory.get(entity)
      let stock = inventory.stock
      const recipe = data.recipe.get(entity)

      // A storage meets demands with what it holds; anyone else sends on what it made.
      // A producer waits for a full load (or a full shelf) so its carriers do not walk with one crate.
      const ready = recipe ? stock[recipe.output] >= Math.min(LOAD, inventory.cap - recipe.batch) : false
      // What sites are waiting for goes first: otherwise steady demand for one good keeps every carrier busy.
      const offers: ReadonlyArray<GoodId> = data.storage.has(entity)
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
        const senderKeeps = (kinds[data.building.get(entity)?.kind ?? "townhall"].keeps ?? 0) > 1
        if (best === null && (!data.storage.has(entity) || (perishable && !senderKeeps))) {
          let kept = false
          for (const r of rooms) {
            if (r.id === entity.id || (data.storage.has(entity) && !r.keeps)) continue
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
      if (stock !== inventory.stock) data.inventory.set(entity, { ...inventory, stock })
    }
  }
)
