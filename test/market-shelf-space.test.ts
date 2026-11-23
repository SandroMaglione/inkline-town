import assert from "node:assert/strict"
import { test } from "node:test"
import { amounts, goodIds } from "../src/game/content/index.ts"
import { shippedRules } from "../src/game/rules/config.ts"
import { askOf } from "../src/game/rules/households.ts"
import { tradeCollection } from "../src/game/rules/trade.ts"

const prices = amounts(Object.fromEntries(goodIds.map((good) => [good, 100])))
const budget = 1000

test("a buying order with nowhere to store it leaves the market price alone", () => {
  const stores = [{ stock: amounts({ fish: 10 }), accepts: ["fish"] as const, cap: 10 }]
  const result = tradeCollection(stores, { sells: [], buys: ["fish"], reserve: 12 }, prices, budget)
  assert.deepEqual(result.stores, stores)
  assert.equal(result.coins, budget)
  assert.equal(result.traded, 0)
  assert.equal(result.prices.fish, 100)
})

test("only crates placed on shelves count as demand when a buying order partly fills", () => {
  const stores = [{ stock: amounts({ fish: 10 }), accepts: ["fish"] as const, cap: 11 }]
  const full = tradeCollection(stores, { sells: [], buys: ["fish"], reserve: 11 }, prices, budget)
  const partial = tradeCollection(stores, { sells: [], buys: ["fish"], reserve: 15 }, prices, budget)
  assert.deepEqual(partial, full)
  assert.equal(partial.stores[0]?.stock.fish, 11)
  assert.equal(partial.coins, budget - askOf("fish", 100))
  assert.equal(partial.prices.fish, 100 + shippedRules.market.perBought - 1)
})
