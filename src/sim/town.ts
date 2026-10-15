import { tradeCollection } from "../rules/trade.ts"
/**
 * The town: homes grow, level up, or empty depending on what reaches them;
 * taxes are collected from homes connected to the town hall and upkeep paid
 * for every standing building and park; and the census counts it all.
 */
import { appealAt, parkUpkeep } from "../appeal.ts"
import { doors, key, reach } from "../grid.ts"
import { amounts, goodIds, type GoodId } from "../content.ts"
import { Appeal, Building, Burning, Census, Charter, Flow, Game, Rules, Grid, House, Inventory, Ledger, Market, Mood, Park, Paused, Policy, Rising, Risk, Sick, Site, Staff, Storage, Tile, Time, TownHall, Treasury, maybe } from "../schema.ts"
import { connected, elapsed, seasonAt } from "./shared.ts"

import { ageNeeds, baseCollection, mealDecay, adminOf, capacity, met, rateOf, taxOf, tierFor } from "../rules/households.ts"
export { adminOf, appealOf, askOf, capacity, kept, met, priceOf, satisfaction, taxOf, tierFor, type Rates } from "../rules/households.ts"

/**
 * Needs wear off, food faster in winter. Every so often a home settles
 * into its tier (see `tierFor`) and one resident moves in or out towards
 * what the home holds (half as many while it is sick, fewer under heavy
 * taxes). Everyone leaves a
 * home with no road, or on fire.
 */
export const Households = Game.System(
  "Town/Households",
  {
    queries: {
      homes: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          house: Game.Query.write(House),
          risk: Game.Query.optional(Risk),
          sick: Game.Query.optional(Sick),
          burning: Game.Query.optional(Burning),
          closed: Game.Query.optional(Paused)
        },
        without: [Site, Rising]
      })
    },
    resources: {
      grid: Game.System.readResource(Grid),
      mood: Game.System.readResource(Mood),
      appeal: Game.System.readResource(Appeal),
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      policy: Game.System.readResource(Policy)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules
    const { home, risk } = rules

    const grid = resources.grid.get()
    const approval = resources.mood.get().approval
    const policy = resources.policy.get()
    const cells = resources.appeal.get().cells
    const t = elapsed(resources.time.get(), resources.charter.get())
    // In winter a meal lasts two thirds as long.
    const eat = mealDecay(t, seasonAt(t, resources.charter.get(), rules).winter)
    for (const { data } of queries.homes.each()) {
      const h = data.house.get()
      const next = ageNeeds(h, eat)
      // A home on fire, or closed by the town, stands empty.
      if (data.burning.present || data.closed.present) next.residents = 0
      else if (next.clock % home.settle === 0) {
        const tile = data.tile.get()
        const desirability = appealAt(cells, tile.x, tile.y)
        next.tier = tierFor(next, desirability, maybe(data.risk) ?? { fire: 0, health: 0, order: 0 }, rules)
        const well = connected(grid, tile) ? capacity(next, approval, desirability, rules, rateOf(policy, next.tier)) : 0
        const cap = data.sick.present ? Math.floor(well * risk.health.sickly) : well
        next.residents = Math.min(next.residents, home.tiers[next.tier].residents)
        next.residents += Math.sign(cap - next.residents)
      }
      data.house.set(next)
    }
  }
)

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
      buildings: Game.Query({ selection: { building: Game.Query.read(Building), paused: Game.Query.optional(Paused) }, without: [Site] }),
      halls: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [TownHall] }),
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

    if (resources.time.get().tick % LEDGER_TICKS !== 0) return
    const grid = resources.grid.get()
    const policy = resources.policy.get()
    const hall = queries.halls.each()[0]
    const roads = hall ? reach(grid, doors(grid, hall.data.tile.get())) : null
    const share = LEDGER_TICKS / (60 * 60)
    const cells = resources.appeal.get().cells
    let taxes = 0
    let homes = 0
    for (const { data } of queries.homes.each()) {
      homes += 1
      const tile = data.tile.get()
      const reached = roads !== null && doors(grid, tile).some((c) => roads.distance[key(c.x, c.y)]! >= 0)
      if (reached) taxes += taxOf(data.house.get(), policy, rules, appealAt(cells, tile.x, tile.y))
    }
    let upkeep = 0
    for (const { data } of queries.buildings.each()) upkeep += kinds[data.building.get().kind].upkeep * (data.paused.present ? PAUSED_UPKEEP : 1)
    for (const { data } of queries.parks.each()) upkeep += parkUpkeep(data.park.get(), rules)
    const admin = adminOf(homes, rules)

    const stores = queries.stores.each()
    const before = resources.treasury.get().coins
    const traded = tradeCollection(stores.map(({ data }) => data.inventory.get()), policy, resources.market.get().prices,
      before + baseCollection(taxes, upkeep, homes, rules).delta, rules)
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

export const TakeCensus = Game.System(
  "Town/TakeCensus",
  {
    queries: {
      homes: Game.Query({ selection: { house: Game.Query.read(House), sick: Game.Query.optional(Sick) }, without: [Site, Rising, Paused] }),
      workplaces: Game.Query({ selection: { staff: Game.Query.read(Staff) }, without: [Site, Rising] }),
      burning: Game.Query({ selection: { burning: Game.Query.read(Burning) } })
    },
    resources: { census: Game.System.writeResource(Census) }
  },
  ({ queries, resources }) => {
    let homes = 0
    let settlers = 0
    let citizens = 0
    let burghers = 0
    let sick = 0
    const needs = { food: 0, bread: 0, cloth: 0, faith: 0 }
    for (const { data } of queries.homes.each()) {
      const h = data.house.get()
      homes += 1
      if (h.tier === 1) settlers += h.residents
      else citizens += h.residents
      if (h.tier === 3) burghers += h.residents
      if (data.sick.present) sick += 1
      for (const n of ["food", "bread", "cloth", "faith"] as const) if (met(h, n)) needs[n] += 1
    }
    let jobs = 0
    let employed = 0
    for (const { data } of queries.workplaces.each()) {
      const s = data.staff.get()
      jobs += s.needed
      employed += s.assigned
    }
    resources.census.set({ homes, settlers, citizens, burghers, jobs, employed, ...needs, sick, burning: queries.burning.each().length })
  }
)
