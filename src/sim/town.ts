/**
 * The town: homes grow, level up, or empty depending on what reaches them;
 * taxes are collected from homes connected to the town hall and upkeep paid
 * for every standing building; and the census counts it all.
 */
import { appealAt } from "../appeal.ts"
import {
  admin, goodIds, goods, home, kinds, LEDGER_TICKS, market, PAUSED_UPKEEP, risk, TRADE_LOAD, type GoodId, type Need, type Tier
} from "../content.ts"
import { doors, key, reach } from "../grid.ts"
import {
  Appeal, Building, Burning, Census, Charter, Game, Grid, House, Inventory, Ledger, Market, Mood, Paused, Policy, Rising, Risk, Sick, Site,
  Staff, Storage, Tile, Time, TownHall, Treasury, maybe
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
 * mayor, and up to all of them when it approves, needs or not. Nobody
 * wants to live where it is squalid (desirability `home.squalid` or less):
 * such a home holds fewer.
 */
export const capacity = (h: Needs, approval: number, desirability = 0): number => {
  const max = home.tiers[h.tier].residents
  const squalor = desirability <= home.squalid ? home.crowded : 1
  return Math.max(1, Math.min(max, Math.round(max * (0.5 + 0.5 * satisfaction(h)) * appealOf(approval) * squalor)))
}

/** Whether every risk meter of a home is kept low: a service walker of each kind passes it. */
export const kept = (r: { readonly fire: number; readonly health: number; readonly order: number }) =>
  r.fire < risk.kept && r.health < risk.kept && r.order < risk.kept

/**
 * The tier a home settles into: settlers whose every citizens' need is met,
 * on a street desirable enough, become citizens; citizens with a street
 * nicer still and all three services calling become burghers in a
 * townhouse. A home that loses more than one of its needs, or whose street
 * falls below its tier, steps back down.
 */
export const tierFor = (h: Needs, desirability: number, r: { readonly fire: number; readonly health: number; readonly order: number }): Tier => {
  const fits = (tier: Tier) => desirability >= home.tiers[tier].appeal
  if (h.tier === 1) return satisfaction(h, 2) === 1 && fits(2) ? 2 : 1
  if (satisfaction(h) < 2 / 3 || !fits(2)) return 1
  if (h.tier === 2) return satisfaction(h, 3) === 1 && fits(3) && kept(r) ? 3 : 2
  return fits(3) && kept(r) ? 3 : 2
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
 * Needs wear off, food faster in winter. Every so often a home settles
 * into its tier (see `tierFor`) and one resident moves in or out towards
 * what the home holds (half as many while it is sick). Everyone leaves a
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
          burning: Game.Query.optional(Burning)
        },
        without: [Site, Rising]
      })
    },
    resources: {
      grid: Game.System.readResource(Grid),
      mood: Game.System.readResource(Mood),
      appeal: Game.System.readResource(Appeal),
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter)
    }
  },
  ({ queries, resources }) => {
    const grid = resources.grid.get()
    const approval = resources.mood.get().approval
    const cells = resources.appeal.get().cells
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
      if (data.burning.present) next.residents = 0
      else if (next.clock % home.settle === 0) {
        const tile = data.tile.get()
        const desirability = appealAt(cells, tile.x, tile.y)
        next.tier = tierFor(next, desirability, maybe(data.risk) ?? { fire: 0, health: 0, order: 0 })
        const well = connected(grid, tile) ? capacity(next, approval, desirability) : 0
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
            const put = inv.accepts.includes(good) ? Math.min(wanted, inv.cap - inv.stock[good]) : 0
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
      homes: Game.Query({ selection: { house: Game.Query.read(House), sick: Game.Query.optional(Sick) }, without: [Site, Rising] }),
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
