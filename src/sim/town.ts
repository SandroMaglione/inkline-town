import { every } from "../content.ts"
import { tradeCollection } from "../rules/trade.ts"
/**
 * The town: homes grow, level up, or empty depending on what reaches them;
 * taxes are collected from homes connected to the town hall and upkeep paid
 * for every standing building and park; and the census counts it all.
 */
import { appealAt, parkUpkeep } from "../appeal.ts"
import { doors, key, reach } from "../grid.ts"
import { amounts, goodIds, upgradeAt, upkeepOf, type GoodId } from "../content.ts"
import { Appeal, Building, Burning, Census, Charter, Flow, Game, Rules, Grid, House, Inventory, Ledger, Market, Mood, Park, Paused, Policy, Rebuilt, Rising, Risk, Sick, Site, Staff, Storage, Tile, Time, TownHall, Treasury, Upgraded } from "../schema.ts"
import { connected, elapsed, seasonAt } from "./shared.ts"

import { ageNeeds, baseCollection, mealDecay, adminOf, capacity, met, rateOf, shortOf, taxOf, tierFor } from "../rules/households.ts"
export { adminOf, appealOf, askOf, capacity, kept, met, priceOf, satisfaction, taxOf, tierFor, type Rates } from "../rules/households.ts"

/**
 * Needs wear off, food faster in winter. Every so often a home settles
 * into its tier (see `tierFor`), rising to a tier it was never rebuilt
 * for only once the treasury and the store pay for it (see `home.tiers`),
 * and one resident moves in or out towards
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
          rebuilt: Game.Query.optional(Rebuilt),
          risk: Game.Query.optional(Risk),
          sick: Game.Query.optional(Sick),
          burning: Game.Query.optional(Burning),
          closed: Game.Query.optional(Paused)
        },
        without: [Site, Rising]
      }),
      stores: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Storage], without: [Site, Rising] })
    },
    resources: {
      grid: Game.System.thisTick(Game.System.readResource(Grid)),
      mood: Game.System.readResource(Mood),
      appeal: Game.System.readResource(Appeal),
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      policy: Game.System.readResource(Policy),
      treasury: Game.System.writeResource(Treasury)
    },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.inserts(Rebuilt))
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { home, risk } = rules
    // What the store holds, reckoned only once some home is ready to rise this step.
    let stock: Record<GoodId, number> | null = null
    const held = () => (stock ??= Object.fromEntries(goodIds.map((g) => [g, queries.stores.each().reduce((n, { data }) => n + data.inventory.get().stock[g], 0)])) as Record<GoodId, number>)
    /** Pays a home's rise from the treasury and the store, fullest first; or says it cannot. */
    const pay = (cost: { readonly coins: number; readonly materials: Partial<Record<GoodId, number>> }): boolean => {
      if (shortOf(cost, resources.treasury.get().coins, held())) return false
      resources.treasury.update((tr) => ({ coins: tr.coins - cost.coins }))
      for (const [g, n] of Object.entries(cost.materials) as Array<[GoodId, number]>) {
        let owed = n
        held()[g] -= n
        for (const { data } of [...queries.stores.each()].sort((a, b) => b.data.inventory.get().stock[g] - a.data.inventory.get().stock[g])) {
          if (owed <= 0) break
          const inv = data.inventory.get(), k = Math.min(owed, inv.stock[g])
          data.inventory.set({ ...inv, stock: { ...inv.stock, [g]: inv.stock[g] - k } })
          owed -= k
        }
      }
      return true
    }

    const grid = resources.grid.get()
    const approval = resources.mood.get().approval
    const policy = resources.policy.get()
    const cells = resources.appeal.get().cells
    const t = elapsed(resources.time.get(), resources.charter.get())
    // In winter a meal lasts two thirds as long.
    const eat = mealDecay(t, seasonAt(t, resources.charter.get(), rules).winter)
    for (const { entity, data } of queries.homes.each()) {
      const h = data.house.get()
      const next = ageNeeds(h, eat)
      // A home on fire, or closed by the town, stands empty.
      if (data.burning.present || data.closed.present) next.residents = 0
      else if (next.clock % home.settle === 0) {
        const tile = data.tile.get()
        const desirability = appealAt(cells, tile.x, tile.y)
        const tier = tierFor(next, desirability, data.risk.value() ?? { fire: 0, health: 0, order: 0 }, rules)
        // Rising a tier is a rebuilding, paid for at once, once: a home that cannot be paid for waits, and one
        // that stepped down moves back up into what it was rebuilt as.
        const built = data.rebuilt.value()?.tier ?? 1
        if (tier <= h.tier || tier <= built) next.tier = tier
        else if (pay(home.tiers[tier].rise)) {
          next.tier = tier
          commands.insert(entity, Game.Command.entry(Rebuilt, { tier: tier as 2 | 3 }))
        }
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
    const needs = { food: 0, bread: 0, cloth: 0, faith: 0, furniture: 0 }
    for (const { data } of queries.homes.each()) {
      const h = data.house.get()
      homes += 1
      if (h.tier === 1) settlers += h.residents
      else citizens += h.residents
      if (h.tier === 3) burghers += h.residents
      if (data.sick.present) sick += 1
      for (const n of ["food", "bread", "cloth", "faith", "furniture"] as const) if (met(h, n)) needs[n] += 1
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
