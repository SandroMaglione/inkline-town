import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync, readdirSync } from "node:fs"
import { amounts, goodIds, kinds } from "../src/content.ts"
import { resolveRules } from "../src/rules/config.ts"
import { analyze } from "../tools/balance/model/analyze.ts"
import { project } from "../tools/balance/model/project.ts"
import { searchParameters, searchDistricts } from "../tools/balance/model/search.ts"
import { citizensDistrict, buildScenario } from "../tools/balance/catalog.ts"
import { district, validateScenario } from "../tools/balance/scenario.ts"
import { verify, verifyProduction } from "../tools/balance/verify/checks.ts"
import { verifyBuilds } from "../tools/balance/verify/builds.ts"
import { provenance } from "../tools/balance/provenance.ts"
import { assessTransfers } from "../tools/balance/model/transport.ts"
import { fixture } from "../tools/balance/verify/fixture.ts"
import { capacity, moreAdmin, serveGoods, taxOf, taxOutlook, taxRoom, wantsCitizenGoods } from "../src/rules/households.ts"
import { approvalTarget } from "../src/rules/approval.ts"
import { tradeCollection } from "../src/rules/trade.ts"
import { assignWorkers } from "../src/rules/production.ts"
import { planPatrols } from "../src/rules/patrol.ts"
import { scenarioGrid } from "../tools/balance/scenario.ts"
import { GRID } from "../src/iso.ts"

test("candidate rules are immutable, isolated and also executed by the game", () => {
  const base = resolveRules(), original = kinds.weaver.recipe!.seconds
  const candidate = resolveRules([{ path: "kinds.weaver.recipe.seconds", value: 12 }])
  assert.equal(base.kinds.weaver.recipe!.seconds, original)
  assert.equal(kinds.weaver.recipe!.seconds, original)
  assert(Object.isFrozen(candidate.kinds.weaver.recipe))
  assert.throws(() => resolveRules([{ path: "kinds.fishery.size", value: 1 }]), /Structural/)
  assert.throws(() => resolveRules([{ path: "__proto__.polluted", value: 1 }]), /Invalid/)
  const result = verifyProduction(candidate, "weaver", false, true)
  assert(result.pass, JSON.stringify(result))
  assert.equal(result.expected, 5)
  assert.equal(kinds.weaver.recipe!.seconds, original)
})

test("the mathematical layer has no runtime or rendering value imports", () => {
  const paths = [...readdirSync("tools/balance/model").filter((f) => f.endsWith(".ts")).map((f) => `tools/balance/model/${f}`),
    ...readdirSync("src/rules").filter((f) => f.endsWith(".ts")).map((f) => `src/rules/${f}`), "tools/balance/scenario.ts"]
  for (const path of paths) {
    const text = readFileSync(path, "utf8").replace(/^import type [\s\S]*?from [^\n]+\n/gm, "")
    assert(!/import[^\n]*from ["'][^"']*(?:sim\/|schema\.ts|render3d|bevy-ts)[^"']*["']/.test(text), path)
  }
})

test("paused upkeep candidates are shared with the actual ledger", () => {
  const rules = resolveRules([{ path: "pausedUpkeep", value: 0.5 }])
  const base = district("paused-ledger", Array(4).fill(1), ["warehouse", "warehouse", "warehouse"])
  const scenario = { ...base, homes: base.homes.map((h) => ({ ...h, food: 10000000 })), buildings: base.buildings.map((b) => ({ ...b, stock: amounts({}), paused: b.kind !== "townhall" })) }
  const expected = analyze({ rules, scenario }, { services: false }).economy.roundedNetPerMinute
  const town = fixture(scenario, rules), before = town.snapshot().resources["Town/Treasury"].coins
  town.run(60)
  assert.equal(town.snapshot().resources["Town/Treasury"].coins - before, expected)
  assert.notEqual(expected, analyze({ rules: resolveRules(), scenario }, { services: false }).economy.roundedNetPerMinute)
})

test("cell parks share grouping, beauty and upkeep with the real game", () => {
  const rules = resolveRules([{ path: "grounds.flowers.beauty", value: 1.25 }, { path: "props.fountain.beauty", value: 6 }, { path: "grounds.flowers.upkeep", value: 0.4 }])
  const base = citizensDistrict(rules), scenario = { ...base,
    homes: base.homes.map((h) => ({ ...h, food: 10000000 })), buildings: base.buildings.filter((b) => b.kind === "townhall").map((b) => ({ ...b, stock: amounts({}) })) }
  const expected = analyze({ rules, scenario }, { services: false })
  const town = fixture(scenario, rules), before = town.snapshot().resources["Town/Treasury"].coins
  town.run(60)
  const actual = town.snapshot()
  assert.equal(actual.resources["Town/Treasury"].coins - before, expected.economy.roundedNetPerMinute)
  for (const h of expected.household) {
    const tile = scenario.homes.find((home) => home.id === h.id)!.tile
    assert.equal(actual.resources["Town/Appeal"].cells[tile.y * GRID + tile.x], h.desirability)
  }
  assert(expected.economy.parkUpkeepPerMinute > 0)
  assert.notEqual(expected.household[0]!.desirability, analyze({ rules: resolveRules(), scenario }, { services: false }).household[0]!.desirability)
})

test("desirability rejects an industrial citizen plan even with sufficient goods", () => {
  const rules = resolveRules(), industrial = analyze({ rules, scenario: citizensDistrict(rules, false) }), zoned = analyze({ rules, scenario: citizensDistrict(rules, true) })
  assert.equal(industrial.household.filter((h) => h.potentialTier >= 2).length, 0)
  assert(zoned.household.filter((h) => h.potentialTier >= 2).length > 0)
  assert(industrial.findings.some((f) => f.code === "appeal-blocks-citizens"))
})

test("citizens can do rough work but isolated workplaces cannot borrow global workers", () => {
  const rules = resolveRules(), s = district("unreachable", [2, 2], ["fishery"])
  const a = analyze({ rules, scenario: s }, { services: false })
  assert.equal(a.recipes[0]!.staff.assigned, 2)
  assert.equal(a.recipes[0]!.staff.apprentices, 0)
  const distant = { ...s, homes: s.homes.map((h) => ({ ...h, tier: 1 as const, residents: 4, tile: { ...h.tile, x: h.tile.x + 30 } })) }
  assert.equal(analyze({ rules, scenario: distant }, { services: false }).recipes[0]!.staff.assigned, 0)
})

test("finite raw-resource forecasts conserve material and never create negative goods", () => {
  const rules = resolveRules(), base = district("finite-quarry", Array(4).fill(1), ["quarry"]), q = base.buildings.find((b) => b.kind === "quarry")!
  const scenario = { ...base, land: [{ tile: { x: q.tile.x, y: q.tile.y + 2, size: 1 }, type: "stone" as const, amount: 2, growth: 0 }] }
  const result = project({ rules, scenario }, { seconds: 180 })
  assert(result.rows.at(-1)!.stock.stone <= rules.lands.fair.stock.stone + 2 + 1e-8)
  for (const row of result.rows) for (const count of Object.values(row.stock)) assert(count >= -1e-8)
})

test("invalid overlapping geometry is rejected before making mathematical claims", () => {
  const rules = resolveRules(), scenario = citizensDistrict(rules)
  assert.throws(() => validateScenario({ ...scenario, homes: scenario.homes.map((h, i) => i === 1 ? { ...h, tile: scenario.homes[0]!.tile } : h) }, rules), /overlapping/)
})

test("different goods share a storage's carrier time, and construction has dispatch priority", () => {
  const rules = resolveRules(), scenario = district("shared-pool", [1, 1], ["warehouse", "mill"])
  const hall = scenario.buildings[0]!, warehouse = scenario.buildings.find((b) => b.kind === "warehouse")!, mill = scenario.buildings.find((b) => b.kind === "mill")!
  const budget = assessTransfers({ rules, scenario }, [{ source: hall.id, target: mill.id, good: "wheat", goodsPerMinute: 100 }, { source: hall.id, target: warehouse.id, good: "stone", goodsPerMinute: 100, construction: true }])
  assert.equal(budget.pools.length, 1)
  assert.equal(budget.dispatchPriority[0]!.good, "stone")
  assert.equal(budget.pools[0]!.requiredCarrierSeconds, budget.routes.reduce((n, r) => n + r.carrierSecondsPerMinute!, 0))
})

test("steady-state search counts working tools separately and leaves shipped parameters untouched", () => {
  const rules = resolveRules(), result = searchDistricts(rules, 8)
  assert.equal(result.length, 27)
  assert.equal(result[0]!.cost, 870)
  assert.equal(result[0]!.materials.tools, 6)
  assert.equal(result[0]!.affordableAtFoundation, true)
  const score = (a: ReturnType<typeof analyze>) => a.availableAfterWorkshops.cloth
  const candidates = searchParameters({ rules, scenario: citizensDistrict(rules) }, [[{ path: "kinds.weaver.recipe.seconds", value: 12 }], []], score)
  assert.deepEqual(candidates[0]!.patches, [])
  assert.equal(provenance(rules, []).parametersChanged, false)
})

test("controlled production, ledger and planned service comparisons pass", () => {
  const comparisons = verify(resolveRules(), 3)
  for (const c of comparisons) assert(c.pass, JSON.stringify(c))
})

test("the mathematical plan reaches citizens through ordinary game construction", () => {
  const rules = resolveRules(), { scenario, builds } = buildScenario(rules)
  const r = verifyBuilds({ rules, scenario }, builds)
  assert.deepEqual(r.messages, [])
  // Six of its sixteen homes become citizens' homes: 48 citizens.
  assert.equal(r.actual.at(-1)!.citizens, 48)
  assert(r.firstCitizenSecond !== null && r.firstCitizenSecond <= 300)
  assert.equal(r.prediction.rows.at(-1)!.citizens, 48)
  assert(r.prediction.assumptions.length > 0)
  assert.equal(r.errors.length, r.actual.length)
})


test("promotion-aware goods preserve cloth and feed an eligible settler bread before food expires", () => {
  const rules = resolveRules(), house = { tier: 1 as const, residents: 4, food: rules.home.lasts.food, bread: 0, cloth: 0, faith: 0, furniture: 0 }
  const eligible = serveGoods(house, amounts({ bread: 2, cloth: 2, fish: 2 }), rules, rules.home.tiers[2].appeal)
  assert(eligible.house.bread > 0 && eligible.house.cloth > 0)
  const worker = serveGoods({ ...house, food: 0 }, amounts({ bread: 2, cloth: 2, fish: 2 }), rules, 0)
  assert.equal(worker.basket.fish, 1)
  assert.equal(worker.basket.bread, 2)
  assert.equal(worker.basket.cloth, 2)
  assert.equal(wantsCitizenGoods(house, 0, rules), false)
  const fallback = serveGoods({ ...house, food: 0 }, amounts({ bread: 1 }), rules, 0)
  assert(fallback.house.food > 0)
})

test("a visit feeds a home by its residents: a cottage one meal, a citizens' home two, a townhouse three", () => {
  const rules = resolveRules(), hungry = { food: 0, bread: 0, cloth: 0, faith: 0, furniture: 0 }
  const cottage = serveGoods({ ...hungry, tier: 1 as const, residents: 4 }, amounts({ fish: 10 }), rules, 0)
  assert.equal(cottage.eaten, 1)
  assert.equal(cottage.basket.fish, 9)
  const citizens = serveGoods({ ...hungry, tier: 2 as const, residents: 8 }, amounts({ bread: 10, cloth: 2 }), rules, rules.home.tiers[2].appeal)
  assert.equal(citizens.basket.bread, 8)
  assert.equal(citizens.house.food, rules.home.lasts.food)
  const townhouse = serveGoods({ ...hungry, tier: 3 as const, residents: 12 }, amounts({ bread: 10 }), rules, rules.home.tiers[3].appeal)
  assert.equal(townhouse.basket.bread, 7)
  // A basket short of bread makes up the meal with fish, and a basket short of both feeds the home for part of the time.
  const mixed = serveGoods({ ...hungry, tier: 3 as const, residents: 12 }, amounts({ bread: 1, fish: 1 }), rules, rules.home.tiers[3].appeal)
  assert.equal(mixed.eaten, 2)
  assert.equal(mixed.house.food, Math.round(rules.home.lasts.food * 2 / 3))
  assert.equal(mixed.house.bread, Math.round(rules.home.lasts.bread / 3))
})

test("taxes above 100% empty homes directly, settlers sooner, so the most a rate brings in comes before the top", () => {
  const rules = resolveRules(), fed = { tier: 1 as const, residents: 4, food: 1, bread: 0, cloth: 0, faith: 0, furniture: 0 }
  assert.equal(taxRoom(100, 1, rules), 1)
  assert.equal(taxRoom(50, 1, rules), 1)
  assert(Math.abs(taxRoom(150, 1, rules) - 0.8) < 1e-9)
  assert(Math.abs(taxRoom(200, 1, rules) - 0.5) < 1e-9)
  assert(taxRoom(200, 2, rules) > taxRoom(200, 1, rules))
  assert.equal(capacity(fed, 0, 0, rules, 200), 2)
  // A town of fed cottages: income rises and then falls with the rate.
  const homes = Array.from({ length: 40 }, () => ({ ...fed, desirability: 0, paying: true }))
  const approvalAt = (r: { settlers: number; citizens: number }, memory: number) => approvalTarget(homes, r, 1000, 0, false, rules, memory).target
  const income = [100, 125, 150, 175, 200].map((rate) => taxOutlook(homes, { settlers: 100, citizens: 100 }, "settlers", rate, approvalAt, rules))
  const best = income.indexOf(Math.max(...income))
  assert(best > 0 && best < income.length - 1, JSON.stringify(income))
  assert(income.at(-1)! < income[best]!)
})

test("administration: each more resident costs more, and about what a fed settler pays near the medium goal", () => {
  const rules = resolveRules()
  // 80 cottages and 150 cottages, by their residents.
  assert(moreAdmin(320, 4, rules) > moreAdmin(80, 4, rules) * 2)
  const cottage = taxOf({ tier: 1, residents: 4, food: 1, bread: 0, cloth: 0, faith: 0, furniture: 0 }, { settlers: 100, citizens: 100 }, rules)
  assert(moreAdmin(320, 4, rules) > cottage * 0.5 && moreAdmin(320, 4, rules) < cottage, `${moreAdmin(320, 4, rules)} vs ${cottage}`)
  assert(moreAdmin(600, 4, rules) > cottage)
})

test("buying drives a price up faster than selling drives it down, and a dear price calms slowly", () => {
  const rules = resolveRules(), prices = amounts(Object.fromEntries(goodIds.map((g) => [g, 100])))
  const shelf = { stock: amounts({ fish: 0 }), accepts: goodIds, cap: 1000 }
  const bought = tradeCollection([shelf], { sells: [], buys: ["fish"], reserve: 12 }, prices, 10000, rules)
  assert.equal(bought.stores[0]!.stock.fish, 12)
  const dear = bought.prices.fish
  assert(dear >= 100 + 12 * rules.market.perBought - 5, String(dear))
  let calm = dear
  for (let i = 0; i < 6; i++) calm = tradeCollection([{ ...shelf, stock: amounts({ fish: 1000 }) }], { sells: [], buys: [], reserve: 0 }, { ...prices, fish: calm }, 0, rules).prices.fish
  assert(calm > 100 + (dear - 100) / 2, `a minute later fish is still dear: ${calm}`)
})

test("surplus citizens fill rough jobs after skilled jobs without an apprentice penalty", () => {
  const within = [{ home: 1, distance: 1 }]
  const staff = assignWorkers([{ id: 1, crew: "citizens", residents: 8 }], [
    { id: 1, crew: "settlers", needed: 7, within },
    { id: 2, crew: "citizens", needed: 3, within }
  ])
  assert.equal(staff.get(2)!.assigned, 3)
  assert.equal(staff.get(1)!.assigned, 5)
  assert.equal(staff.get(1)!.apprentices, 0)
})

test("rotating patrols cover every reachable branch and survive save/load with their cursor", () => {
  const rules = resolveRules(), scenario = district("patrol-branches", Array(10).fill(1), ["chapel"], true, rules)
  const source = scenario.buildings.find(b => b.kind === "chapel")!, grid = scenarioGrid(scenario, rules).value()
  const plan = planPatrols(grid, source.tile, rules.kinds.chapel.service!.range, scenario.homes)
  assert.deepEqual(plan.unreachable, [])
  assert(plan.tours.every(tour => tour.length <= rules.kinds.chapel.service!.range))
  const town = fixture(scenario, rules)
  town.run(0.5)
  const saved = town.snapshot()
  assert(saved.entities.some(e => e.components["Town/Patrol"]))
  town.run(30)
  const expected = town.snapshot()
  const restored = fixture(scenario, rules)
  restored.restore(saved)
  assert.equal(JSON.stringify(restored.snapshot()), JSON.stringify(saved))
  restored.run(30)
  assert.deepEqual(restored.snapshot(), expected)
})
