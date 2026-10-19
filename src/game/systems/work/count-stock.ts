import { amounts, goodIds, stepsOf, type Amounts } from "../../content/index.ts"
import { Charter, Errand, Flow, Roam, Game, Inventory, Rising, Site, Stock, Storage, Time, Treasury } from "../../schema.ts"
import { each } from "./per-good.ts"

/** The flow of goods is counted in slices this many seconds long, and the last `FLOW_SLICES` of them (a minute) are kept. */
const FLOW_SLICE = 10
const FLOW_SLICES = 6

/**
 * The goods in every storage, summed; and everything the town holds,
 * anywhere, for the minute's `Flow`, which closes every minute.
 */
export const CountStock = Game.System(
  "Town/CountStock",
  {
    queries: {
      stores: Game.Query({ selection: { inventory: Game.Query.read(Inventory) }, with: [Storage], without: [Site, Rising] }),
      shelves: Game.Query({ selection: { inventory: Game.Query.read(Inventory) }, without: [Site, Rising] }),
      baskets: Game.Query({ selection: { roam: Game.Query.read(Roam) } }),
      crates: Game.Query({ selection: { errand: Game.Query.read(Errand) } })
    },
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      stock: Game.System.writeResource(Stock),
      treasury: Game.System.readResource(Treasury),
      flow: Game.System.writeResource(Flow)
    }
  },
  ({ queries, resources }) => {
    const sum: Record<string, number> = { ...amounts({}) }
    for (const { data } of queries.stores.each()) {
      const s = data.inventory.get().stock
      for (const g of goodIds) sum[g] = (sum[g] ?? 0) + s[g]
    }
    resources.stock.set(sum as Amounts)

    const held: Record<string, number> = { ...amounts({}) }
    for (const { data } of queries.shelves.each()) {
      const s = data.inventory.get().stock
      for (const g of goodIds) held[g] = held[g]! + s[g]
    }
    for (const { data } of queries.baskets.each()) {
      const b = data.roam.get().basket
      for (const g of goodIds) held[g] = held[g]! + b[g]
    }
    for (const { data } of queries.crates.each()) {
      const e = data.errand.get()
      held[e.good] = held[e.good]! + e.count
    }
    const tick = resources.time.get().step
    const charter = resources.charter.get()
    const town = `${charter.seed}:${charter.founded}`
    const f = resources.flow.get()
    const now = held as Amounts
    const treasury = resources.treasury.get().coins
    const fresh = { start: treasury, made: 0, traded: 0, seen: treasury, booked: 0 }
    // A new or loaded town, or the clock gone back: start counting again from here.
    if (f.town !== town || tick < f.since || f.start === null) {
      resources.flow.set({ town, since: tick, start: now, made: amounts({}), traded: amounts({}), held: now, coins: fresh, slices: [], last: null })
      return
    }
    // Coins that came in other than by the collection (a reward, a refund) were made; any that went out are left over as used.
    const other = treasury - f.coins.seen - f.coins.booked
    const coins = { ...f.coins, made: f.coins.made + Math.max(0, other), seen: treasury, booked: 0 }
    if (tick - f.since < stepsOf(FLOW_SLICE)) {
      resources.flow.set({ ...f, held: now, coins })
      return
    }
    // A slice is done: the last minute rolls on by one, and is reckoned again.
    const slices = [...f.slices, { start: f.start, made: f.made, traded: f.traded, coins: { start: coins.start, made: coins.made, traded: coins.traded } }].slice(-FLOW_SLICES)
    const enough = slices.length >= FLOW_SLICES / 2
    const scale = FLOW_SLICES / slices.length
    const over = (key: "made" | "traded") => each((g) => slices.reduce((n, s) => n + s[key][g], 0))
    const made = over("made"), traded = over("traded")
    const used = each((g) => Math.max(0, slices[0]!.start[g] + made[g] + traded[g] - now[g]))
    const perMinute = (a: Amounts) => each((g) => Math.round(a[g] * scale))
    const coinsMade = slices.reduce((n, s) => n + s.coins.made, 0)
    const coinsTraded = slices.reduce((n, s) => n + s.coins.traded, 0)
    const coinsUsed = Math.max(0, slices[0]!.coins.start + coinsMade + coinsTraded - treasury)
    resources.flow.set({
      town, since: tick, start: now, made: amounts({}), traded: amounts({}), held: now, coins: fresh, slices,
      last: enough
        ? {
            made: perMinute(made), used: perMinute(used), traded: perMinute(traded),
            coins: { made: Math.round(coinsMade * scale), used: Math.round(coinsUsed * scale), traded: Math.round(coinsTraded * scale) }
          }
        : null
    })
  }
)
