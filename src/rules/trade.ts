import { goodIds, type Amounts, type GoodId } from "../content.ts"
import { askOf, priceOf } from "./households.ts"
import { shippedRules, type Rules } from "./config.ts"

/** `loads`: how much of each good may change hands at a collection (at most `rules.tradeLoad`); all of it when absent. */
export interface TradePolicy { readonly sells: ReadonlyArray<GoodId>; readonly buys: ReadonlyArray<GoodId>; readonly reserve: number; readonly loads?: Partial<Amounts> }
export interface Shelf { readonly stock: Amounts; readonly accepts: ReadonlyArray<GoodId>; readonly cap: number }

/** Exact collection trade, including price drift and refunds. Shelves keep runtime insertion order. */
export const tradeCollection = (initial: ReadonlyArray<Shelf>, policy: TradePolicy, initialPrices: Amounts, startingCoins: number, rules: Rules = shippedRules) => {
  const stores = initial.map((s) => ({ ...s, stock: { ...s.stock } })), prices = { ...initialPrices }
  let coins = startingCoins, traded = 0
  for (const good of goodIds) {
    const held = stores.reduce((sum, s) => sum + s.stock[good], 0)
    const load = Math.min(rules.tradeLoad, policy.loads?.[good] ?? rules.tradeLoad)
    if (policy.sells.includes(good)) {
      let surplus = Math.min(load, held - policy.reserve)
      if (surplus > 0) {
        const earned = Math.round(surplus * priceOf(good, prices[good], rules))
        coins += earned; traded += earned
        prices[good] = Math.max(rules.market.floor, prices[good] - surplus * rules.market.perUnit)
        for (const inv of [...stores].sort((a, b) => b.stock[good] - a.stock[good])) {
          if (surplus <= 0) break
          const take = Math.min(surplus, inv.stock[good]); inv.stock[good] -= take; surplus -= take
        }
      }
    } else if (policy.buys.includes(good)) {
      const ask = askOf(good, prices[good], rules)
      let wanted = Math.min(load, policy.reserve - held, Math.floor(coins / ask))
      if (wanted > 0) {
        coins -= wanted * ask; traded -= wanted * ask
        prices[good] = Math.min(rules.market.ceiling, prices[good] + wanted * rules.market.perUnit)
        for (const inv of [...stores].sort((a, b) => a.stock[good] - b.stock[good])) {
          if (wanted <= 0) break
          const put = inv.accepts.includes(good) ? Math.min(wanted, inv.cap - inv.stock[good]) : 0
          if (put <= 0) continue
          inv.stock[good] += put; wanted -= put
        }
        if (wanted > 0) { coins += wanted * ask; traded += wanted * ask }
      }
    }
    const gap = 100 - prices[good]
    prices[good] += gap === 0 ? 0 : Math.sign(gap) * Math.max(1, Math.round(Math.abs(gap) / 10))
  }
  return { stores, prices, coins, traded }
}
