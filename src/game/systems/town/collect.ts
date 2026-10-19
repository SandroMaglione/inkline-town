import { every } from "../../content/index.ts"
import { tradeCollection } from "../../rules/trade.ts"
import { appealAt, parkUpkeep } from "../../world/appeal.ts"
import { doors, key, reach } from "../../world/grid.ts"
import { amounts, goodIds, upgradeAt, upkeepOf, type GoodId } from "../../content/index.ts"
import { Appeal, Building, Flow, Game, Rules, Grid, House, Inventory, Ledger, Market, Park, Paused, Policy, Rising, Site, Storage, Tile, Time, TownHall, Treasury, Upgraded } from "../../schema.ts"
import { baseCollection, adminOf, taxOf } from "../../rules/households.ts"

/**
 * Every `LEDGER_TICKS`: taxes in from homes the town hall can reach by road;
 * trade with the travelling merchants, who buy what the town sells beyond
 * its reserve (taken from its storage, fullest first) and sell it what it
 * buys up to its reserve (brought to the storage with most room), at prices
 * that fall the more the town sells and rise the more it buys; upkeep out
 * for every standing building (a quarter for a paused one); and the town
 * hall's administration, which grows faster than the town.
 */
export const Collect = Game.System(
  "Town/Collect",
  {
    queries: {
      /** A closed home pays nothing and costs the town hall nothing. */
      homes: Game.Query({ selection: { tile: Game.Query.read(Tile), house: Game.Query.read(House) }, without: [Site, Rising, Paused] }),
      buildings: Game.Query({ selection: { building: Game.Query.read(Building), paused: Game.Query.optional(Paused), upgraded: Game.Query.optional(Upgraded) }, without: [Site] }),
      halls: Game.Query({ selection: { tile: Game.Query.read(Tile), upgraded: Game.Query.optional(Upgraded) }, with: [TownHall] }),
      stores: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Storage], without: [Site, Rising] }),
      parks: Game.Query({ selection: { park: Game.Query.read(Park) } })
    },
    resources: {
      time: Game.System.readResource(Time),
      grid: Game.System.readResource(Grid),
      appeal: Game.System.readResource(Appeal),
      policy: Game.System.readResource(Policy),
      market: Game.System.writeResource(Market),
      treasury: Game.System.writeResource(Treasury),
      ledger: Game.System.writeResource(Ledger),
      flow: Game.System.writeResource(Flow)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules
    const { kinds, ledgerTicks: LEDGER_TICKS, pausedUpkeep: PAUSED_UPKEEP } = rules

    if (!every(resources.time.get(), LEDGER_TICKS)) return
    const grid = resources.grid.get()
    const policy = resources.policy.get()
    const hall = queries.halls.each()[0]
    const roads = hall ? reach(grid, doors(grid, hall.data.tile.get())) : null
    const share = LEDGER_TICKS / (60 * 60)
    const cells = resources.appeal.get().cells
    let taxes = 0
    let residents = 0
    for (const { data } of queries.homes.each()) {
      residents += data.house.get().residents
      const tile = data.tile.get()
      const reached = roads !== null && doors(grid, tile).some((c) => roads.distance[key(c.x, c.y)]! >= 0)
      if (reached) taxes += taxOf(data.house.get(), policy, rules, appealAt(cells, tile.x, tile.y))
    }
    let upkeep = 0
    for (const { data } of queries.buildings.each()) upkeep += upkeepOf(kinds[data.building.get().kind], data.upgraded.value()?.level ?? 0) * (data.paused.present ? PAUSED_UPKEEP : 1)
    for (const { data } of queries.parks.each()) upkeep += parkUpkeep(data.park.get(), rules)
    // A guildhall or a city hall runs the town for less (see `Upgrade.admin`).
    const saves = (hall ? upgradeAt(kinds.townhall, hall.data.upgraded.value()?.level ?? 0)?.admin : undefined) ?? 0
    const admin = adminOf(residents, rules, saves)

    const stores = queries.stores.each()
    const before = resources.treasury.get().coins
    const traded = tradeCollection(stores.map(({ data }) => data.inventory.get()), policy, resources.market.get().prices,
      before + baseCollection(taxes, upkeep, residents, rules, saves).delta, rules)
    // What changed hands, for the minute's flow of goods: bought less sold.
    const moved: Partial<Record<GoodId, number>> = {}
    for (const [i, row] of stores.entries()) {
      const before = row.data.inventory.get().stock
      const after = traded.stores[i]!.stock
      for (const g of goodIds) if (after[g] !== before[g]) moved[g] = (moved[g] ?? 0) + after[g] - before[g]
      row.data.inventory.set(traded.stores[i]!)
    }
    if (Object.keys(moved).length > 0) resources.flow.update((f) => ({ ...f, traded: amounts(Object.fromEntries(goodIds.map((g) => [g, f.traded[g] + (moved[g] ?? 0)]))) }))
    // And the treasury's: the taxes came in, trade changed hands; upkeep and administration are left over as used.
    const collected = Math.round(taxes * share)
    resources.flow.update((f) => ({
      ...f,
      coins: { ...f.coins, made: f.coins.made + collected, traded: f.coins.traded + traded.traded, booked: f.coins.booked + traded.coins - before }
    }))
    resources.market.set({ prices: traded.prices })
    resources.treasury.set({ coins: traded.coins })
    resources.ledger.set({ taxes: Math.round(taxes), trade: Math.round(traded.traded / share), upkeep: Math.round(upkeep), admin })
  }
)
