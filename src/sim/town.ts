/**
 * The town: homes grow, level up, or empty depending on what reaches them;
 * taxes are collected from homes connected to the town hall and upkeep paid
 * for every standing building; and the census counts it all.
 */
import { admin, goodIds, goods, home, kinds, LEDGER_TICKS, market, PAUSED_UPKEEP, TRADE_LOAD, type GoodId, type Need, type Tier } from "../content.ts"
import { doors, key, reach } from "../grid.ts"
import {
  Building, Census, Charter, Game, Grid, House, Inventory, Ledger, Market, Mood, Paused, Policy, Rising, Site, Staff, Storage, Tile, Time,
  TownHall, Treasury
} from "../schema.ts"
import { connected, elapsed, seasonAt } from "./shared.ts"

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

/** How approval (-100 → 100) sits with a home: a third as many residents at its worst, half again at its best. */
export const appealOf = (approval: number): number => (approval < 0 ? 1 + approval / 150 : 1 + approval / 200)

/**
 * Residents a home holds at its tier and satisfaction: half when nothing is
 * met, all when everything is; fewer when the town disapproves of its
 * mayor, and up to all of them when it approves, needs or not.
 */
export const capacity = (h: Needs, approval: number): number => {
  const max = home.tiers[h.tier].residents
  return Math.max(1, Math.min(max, Math.round(max * (0.5 + 0.5 * satisfaction(h)) * appealOf(approval))))
}

/** Coins a minute the town hall's administration costs for `homes` homes. */
export const adminOf = (homes: number): number => Math.round(homes * (admin.perHome + homes / admin.growth))

/** What traders pay for one of a good now, and what they ask for one. */
export const priceOf = (good: GoodId, percent: number) => (goods[good].price * percent) / 100
export const askOf = (good: GoodId, percent: number) => Math.ceil(priceOf(good, percent) * market.markup)

/** Coins a home pays a minute. */
export const taxOf = (h: Needs & { readonly residents: number }, rates: Rates): number =>
  h.residents * home.tiers[h.tier].tax * (rateOf(rates, h.tier) / 100) * (0.25 + 0.75 * satisfaction(h))

/**
 * Needs wear off, food faster in winter. Every so often a home settles:
 * settlers whose every citizens' need is met become citizens; citizens
 * missing more than one need go back to being settlers. One resident moves
 * in or out towards what the home holds; everyone leaves a home with no
 * road.
 */
export const Households = Game.System(
  "Town/Households",
  {
    queries: { homes: Game.Query({ selection: { tile: Game.Query.read(Tile), house: Game.Query.write(House) }, without: [Site, Rising] }) },
    resources: {
      grid: Game.System.readResource(Grid),
      mood: Game.System.readResource(Mood),
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter)
    }
  },
  ({ queries, resources }) => {
    const grid = resources.grid.get()
    const approval = resources.mood.get().approval
    const t = elapsed(resources.time.get(), resources.charter.get())
    // In winter a meal lasts two thirds as long.
    const eat = seasonAt(t, resources.charter.get()).winter && t % 2 === 0 ? 2 : 1
    for (const { data } of queries.homes.each()) {
      const h = data.house.get()
      const next = {
        ...h,
        clock: h.clock + 1,
        food: Math.max(0, h.food - eat),
        bread: Math.max(0, h.bread - eat),
        cloth: Math.max(0, h.cloth - 1),
        faith: Math.max(0, h.faith - 1)
      }
      if (next.clock % home.settle === 0) {
        if (next.tier === 1 && satisfaction(next, 2) === 1) next.tier = 2
        else if (next.tier === 2 && satisfaction(next) < 2 / 3) next.tier = 1
        const cap = connected(grid, data.tile.get()) ? capacity(next, approval) : 0
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
      homes: Game.Query({ selection: { tile: Game.Query.read(Tile), house: Game.Query.read(House) }, without: [Site, Rising] }),
      buildings: Game.Query({ selection: { building: Game.Query.read(Building), paused: Game.Query.optional(Paused) }, without: [Site] }),
      halls: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [TownHall] }),
      stores: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Storage], without: [Site, Rising] })
    },
    resources: {
      time: Game.System.readResource(Time),
      grid: Game.System.readResource(Grid),
      policy: Game.System.readResource(Policy),
      market: Game.System.writeResource(Market),
      treasury: Game.System.writeResource(Treasury),
      ledger: Game.System.writeResource(Ledger)
    }
  },
  ({ queries, resources }) => {
    if (resources.time.get().tick % LEDGER_TICKS !== 0) return
    const grid = resources.grid.get()
    const policy = resources.policy.get()
    const hall = queries.halls.each()[0]
    const roads = hall ? reach(grid, doors(grid, hall.data.tile.get())) : null
    const share = LEDGER_TICKS / (60 * 60)
    let taxes = 0
    let homes = 0
    for (const { data } of queries.homes.each()) {
      homes += 1
      const reached = roads !== null && doors(grid, data.tile.get()).some((c) => roads.distance[key(c.x, c.y)]! >= 0)
      if (reached) taxes += taxOf(data.house.get(), policy)
    }
    let upkeep = 0
    for (const { data } of queries.buildings.each()) upkeep += kinds[data.building.get().kind].upkeep * (data.paused.present ? PAUSED_UPKEEP : 1)
    const admin = adminOf(homes)

    // Trade.
    const stores = queries.stores.each()
    const prices: Record<GoodId, number> = { ...resources.market.get().prices }
    let coins = resources.treasury.get().coins + Math.round(taxes * share) - Math.round((upkeep + admin) * share)
    let traded = 0
    for (const good of goodIds) {
      const held = stores.reduce((sum, { data }) => sum + data.inventory.get().stock[good], 0)
      if (policy.sells.includes(good)) {
        let surplus = Math.min(TRADE_LOAD, held - policy.reserve)
        if (surplus > 0) {
          const earned = Math.round(surplus * priceOf(good, prices[good]))
          coins += earned
          traded += earned
          prices[good] = Math.max(market.floor, prices[good] - surplus * market.perUnit)
          for (const { data } of [...stores].sort((a, b) => b.data.inventory.get().stock[good] - a.data.inventory.get().stock[good])) {
            if (surplus <= 0) break
            const inv = data.inventory.get()
            const take = Math.min(surplus, inv.stock[good])
            data.inventory.set({ ...inv, stock: { ...inv.stock, [good]: inv.stock[good] - take } })
            surplus -= take
          }
        }
      } else if (policy.buys.includes(good)) {
        const ask = askOf(good, prices[good])
        let wanted = Math.min(TRADE_LOAD, policy.reserve - held, Math.floor(coins / ask))
        if (wanted > 0) {
          coins -= wanted * ask
          traded -= wanted * ask
          prices[good] = Math.min(market.ceiling, prices[good] + wanted * market.perUnit)
          for (const { data } of [...stores].sort((a, b) => a.data.inventory.get().stock[good] - b.data.inventory.get().stock[good])) {
            if (wanted <= 0) break
            const inv = data.inventory.get()
            const put = Math.min(wanted, inv.cap - inv.stock[good])
            if (put <= 0) continue
            data.inventory.set({ ...inv, stock: { ...inv.stock, [good]: inv.stock[good] + put } })
            wanted -= put
          }
          // What found no room is refunded.
          if (wanted > 0) {
            coins += wanted * ask
            traded += wanted * ask
          }
        }
      }
      // Prices drift back towards the usual.
      const gap = 100 - prices[good]
      prices[good] += gap === 0 ? 0 : Math.sign(gap) * Math.max(1, Math.round(Math.abs(gap) / 10))
    }
    resources.market.set({ prices })
    resources.treasury.set({ coins })
    resources.ledger.set({ taxes: Math.round(taxes), trade: Math.round(traded / share), upkeep: Math.round(upkeep), admin })
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
