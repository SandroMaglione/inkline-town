/**
 * The town: homes grow, level up, or empty depending on what reaches them;
 * taxes are collected from homes connected to the town hall and upkeep paid
 * for every standing building; and the census counts it all.
 */
import { appealOf, goods, home, kinds, LEDGER_TICKS, TRADE_LOAD, type Need, type Tier } from "../content.ts"
import { doors, key, reach } from "../grid.ts"
import { Building, Census, Game, Grid, House, Inventory, Ledger, Policy, Rising, Site, Staff, Storage, Tile, Time, TownHall, Treasury } from "../schema.ts"
import { connected } from "./shared.ts"

interface Needs {
  readonly tier: Tier
  readonly food: number
  readonly bread: number
  readonly cloth: number
  readonly faith: number
}

export const met = (h: Needs, need: Need): boolean => h[need] > 0

/** The share of its tier's needs a home has met, 0 → 1. */
export const satisfaction = (h: Needs, tier: Tier = h.tier): number => {
  const needs = home.tiers[tier].needs
  return needs.filter((n) => met(h, n)).length / needs.length
}

export interface Rates {
  readonly settlers: number
  readonly citizens: number
}
const rateOf = (rates: Rates, tier: Tier) => (tier === 1 ? rates.settlers : rates.citizens)

/**
 * Residents a home holds at its tier and satisfaction: half when nothing is
 * met, all when everything is; fewer under high taxes, and up to all of
 * them under low ones.
 */
export const capacity = (h: Needs, rates: Rates): number => {
  const max = home.tiers[h.tier].residents
  return Math.max(1, Math.min(max, Math.round(max * (0.5 + 0.5 * satisfaction(h)) * appealOf(rateOf(rates, h.tier)))))
}

/** Coins a home pays a minute. */
export const taxOf = (h: Needs & { readonly residents: number }, rates: Rates): number =>
  h.residents * home.tiers[h.tier].tax * (rateOf(rates, h.tier) / 100) * (0.25 + 0.75 * satisfaction(h))

/**
 * Needs wear off. Every so often a home settles: settlers whose every
 * citizens' need is met become citizens; citizens missing more than one need
 * go back to being settlers. One resident moves in or out towards what the
 * home holds; everyone leaves a home with no road.
 */
export const Households = Game.System(
  "Town/Households",
  {
    queries: { homes: Game.Query({ selection: { tile: Game.Query.read(Tile), house: Game.Query.write(House) }, without: [Site, Rising] }) },
    resources: { grid: Game.System.readResource(Grid), policy: Game.System.readResource(Policy) }
  },
  ({ queries, resources }) => {
    const grid = resources.grid.get()
    const rates = resources.policy.get()
    for (const { data } of queries.homes.each()) {
      const h = data.house.get()
      const next = {
        ...h,
        clock: h.clock + 1,
        food: Math.max(0, h.food - 1),
        bread: Math.max(0, h.bread - 1),
        cloth: Math.max(0, h.cloth - 1),
        faith: Math.max(0, h.faith - 1)
      }
      if (next.clock % home.settle === 0) {
        if (next.tier === 1 && satisfaction(next, 2) === 1) next.tier = 2
        else if (next.tier === 2 && satisfaction(next) < 2 / 3) next.tier = 1
        const cap = connected(grid, data.tile.get()) ? capacity(next, rates) : 0
        next.residents += Math.sign(cap - next.residents)
      }
      data.house.set(next)
    }
  }
)

/**
 * Every `LEDGER_TICKS`: taxes in from homes the town hall can reach by road,
 * coins from traders for what the town sells beyond its reserve (taken from
 * its storage, fullest first), and upkeep out for every standing building.
 */
export const Collect = Game.System(
  "Town/Collect",
  {
    queries: {
      homes: Game.Query({ selection: { tile: Game.Query.read(Tile), house: Game.Query.read(House) }, without: [Site, Rising] }),
      buildings: Game.Query({ selection: { building: Game.Query.read(Building) }, without: [Site] }),
      halls: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [TownHall] }),
      stores: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Storage], without: [Site, Rising] })
    },
    resources: {
      time: Game.System.readResource(Time),
      grid: Game.System.readResource(Grid),
      policy: Game.System.readResource(Policy),
      treasury: Game.System.writeResource(Treasury),
      ledger: Game.System.writeResource(Ledger)
    }
  },
  ({ queries, resources }) => {
    if (resources.time.get().tick % LEDGER_TICKS !== 0) return
    const grid = resources.grid.get()
    const hall = queries.halls.each()[0]
    const roads = hall ? reach(grid, doors(grid, hall.data.tile.get())) : null
    const share = LEDGER_TICKS / (60 * 60)
    let taxes = 0
    for (const { data } of queries.homes.each()) {
      const reached = roads !== null && doors(grid, data.tile.get()).some((c) => roads.distance[key(c.x, c.y)]! >= 0)
      if (reached) taxes += taxOf(data.house.get(), resources.policy.get())
    }
    let upkeep = 0
    for (const { data } of queries.buildings.each()) upkeep += kinds[data.building.get().kind].upkeep
    // Traders take the surplus.
    const policy = resources.policy.get()
    const stores = queries.stores.each()
    let sold = 0
    for (const good of policy.sells) {
      const held = stores.reduce((sum, { data }) => sum + data.inventory.get().stock[good], 0)
      let surplus = Math.min(TRADE_LOAD, held - policy.reserve)
      if (surplus <= 0) continue
      sold += surplus * goods[good].price
      for (const { data } of [...stores].sort((a, b) => b.data.inventory.get().stock[good] - a.data.inventory.get().stock[good])) {
        if (surplus <= 0) break
        const inv = data.inventory.get()
        const take = Math.min(surplus, inv.stock[good])
        data.inventory.set({ ...inv, stock: { ...inv.stock, [good]: inv.stock[good] - take } })
        surplus -= take
      }
    }
    resources.treasury.update((t) => ({ coins: t.coins + Math.round(taxes * share) + sold - Math.round(upkeep * share) }))
    resources.ledger.set({ taxes: Math.round(taxes), trade: Math.round(sold / share), upkeep: Math.round(upkeep) })
  }
)

export const TakeCensus = Game.System(
  "Town/TakeCensus",
  {
    queries: {
      homes: Game.Query({ selection: { house: Game.Query.read(House) }, without: [Site, Rising] }),
      workplaces: Game.Query({ selection: { staff: Game.Query.read(Staff) }, without: [Site, Rising] })
    },
    resources: { census: Game.System.writeResource(Census) }
  },
  ({ queries, resources }) => {
    let homes = 0
    let settlers = 0
    let citizens = 0
    const needs = { food: 0, bread: 0, cloth: 0, faith: 0 }
    for (const { data } of queries.homes.each()) {
      const h = data.house.get()
      homes += 1
      if (h.tier === 1) settlers += h.residents
      else citizens += h.residents
      for (const n of ["food", "bread", "cloth", "faith"] as const) if (met(h, n)) needs[n] += 1
    }
    let jobs = 0
    let employed = 0
    for (const { data } of queries.workplaces.each()) {
      const s = data.staff.get()
      jobs += s.needed
      employed += s.assigned
    }
    resources.census.set({ homes, settlers, citizens, jobs, employed, ...needs })
  }
)
