/**
 * The economy's ledger, as tables: what every producer, food, home,
 * service, and the opening cost and give back (see `src/rules/worth.ts`),
 * and what answering the crown with bought goods leaves the town.
 *
 *   node scripts/worth.ts
 *   node scripts/worth.ts --set kinds.fishery.upkeep=5   with candidate rules
 */
import { resolveRules, type RulePatch } from "../src/rules/config.ts"
import { chainWorth, crownMargin, homes, median, openingKit, producers, services } from "../src/rules/worth.ts"
import type { GoodId } from "../src/content.ts"

const patches: Array<RulePatch> = []
for (let i = 2; i < process.argv.length; i++)
  if (process.argv[i] === "--set") {
    const [path, value] = process.argv[++i]!.split("=")
    patches.push({ path: path!, value: Number(value) })
  }
const rules = resolveRules(patches)
const r = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : n)

const made = producers(rules), usual = median(made.map((p) => p.perUpkeep))
console.log(`Producers (usual value added per coin of upkeep: ${r(usual)})`)
console.table(made.map((p) => ({ building: p.id, cost: p.cost, upkeep: p.upkeep, "adds/min": r(p.adds), "per upkeep": r(p.perUpkeep), "of usual": r(p.perUpkeep / usual), "payback min": r(p.payback) })))

console.log("Making one a minute, from the land up")
console.table((["fish", "smoked", "bread", "cloth", "planks", "stone", "tools"] as Array<GoodId>).map((g) => {
  const c = chainWorth(g, rules)
  return { good: g, cost: r(c.cost), upkeep: r(c.upkeep), workers: r(c.workers), "tools/min": r(c.tools), winter: c.winter, "keeps s": c.keeps, meets: c.meets.join(", ") }
}))

console.log("Homes (100% tax, every need met, a plain street)")
console.table(homes(rules).map((h) => ({ tier: h.tier, residents: h.residents, "tax/min": r(h.tax), "eats/min": r(h.eats), "net/min": r(h.net), cost: h.cost, "gain/min": r(h.gain), "payback min": r(h.payback), "pays its way to resident": h.breakEven })))

const kit = openingKit(10, rules)
console.log(`The first citizens' kit: ${kit.kinds.join(", ")} and 10 homes: ${kit.cost} coins, ${kit.upkeep}/min upkeep, all open at ${kit.unlockHomes} cottages`)
console.table(Object.entries(rules.lands).map(([land, l]) => ({ land, coins: l.coins, "share of kit": `${Math.round((l.coins / kit.cost) * 100)}%` })))

console.log("Services")
console.table(services(rules).map((s) => ({ building: s.id, service: s.service, cost: s.cost, upkeep: s.upkeep, "cells walked/min": r(s.reach), "per upkeep": r(s.perUpkeep) })))

console.log("The crown, answered with bought goods")
console.table((["planks", "stone", "tools", "cloth"] as Array<GoodId>).flatMap((g) => [10, 30, 60].map((n) => crownMargin(g, n, rules))))
