import { appealAt } from "../../world/appeal.ts"
import { goodIds, type GoodId } from "../../content/index.ts"
import { Appeal, Burning, Charter, Game, Rules, Grid, House, Inventory, Mood, Paused, Policy, Rebuilt, Rising, Risk, Sick, Site, Storage, Tile, Time, Treasury } from "../../schema.ts"
import { connected, elapsed, seasonAt } from "../shared.ts"
import { ageNeeds, mealDecay, capacity, rateOf, shortOf, tierFor } from "../../rules/households.ts"

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
