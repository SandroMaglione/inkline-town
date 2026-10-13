import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { amounts, kinds } from "../src/content.ts"
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

test("desirability rejects an industrial citizen plan even with sufficient goods", () => {
  const rules = resolveRules(), industrial = analyze({ rules, scenario: citizensDistrict(rules, false) }), zoned = analyze({ rules, scenario: citizensDistrict(rules, true) })
  assert.equal(industrial.household.filter((h) => h.potentialTier >= 2).length, 0)
  assert(zoned.household.filter((h) => h.potentialTier >= 2).length > 0)
  assert(industrial.findings.some((f) => f.code === "appeal-blocks-citizens"))
})

test("isolated workplaces and citizen-only raw industry cannot borrow global workers", () => {
  const rules = resolveRules(), s = district("unreachable", [2, 2], ["fishery"])
  const a = analyze({ rules, scenario: s }, { services: false })
  assert.equal(a.recipes[0]!.staff.assigned, 0)
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
  assert.equal(result[0]!.materials.tools, 9)
  assert.equal(result[0]!.affordableAtFoundation, false)
  const score = (a: ReturnType<typeof analyze>) => a.availableAfterWorkshops.cloth
  const candidates = searchParameters({ rules, scenario: citizensDistrict(rules) }, [[{ path: "kinds.weaver.recipe.seconds", value: 12 }], []], score)
  assert.deepEqual(candidates[0]!.patches, [])
  assert.equal(provenance(rules, []).parametersChanged, false)
})

test("controlled production, ledger and stochastic service comparisons pass", () => {
  const comparisons = verify(resolveRules(), 12)
  for (const c of comparisons) assert(c.pass, JSON.stringify(c))
})

test("the mathematical plan reaches citizens through ordinary game construction", () => {
  const rules = resolveRules(), { scenario, builds } = buildScenario(rules)
  const r = verifyBuilds({ rules, scenario }, builds)
  assert.deepEqual(r.messages, [])
  assert.equal(r.actual.at(-1)!.citizens, 32)
  assert.equal(r.firstCitizenSecond, 336)
  assert.equal(r.prediction.rows.at(-1)!.citizens, 32)
  assert(r.prediction.assumptions.length > 0)
  assert.equal(r.errors.length, r.actual.length)
})

test("shared-rule extraction preserves the original PR's complete minute-30 world", { timeout: 90000 }, () => {
  const out = mkdtempSync(join(tmpdir(), "inkline-rule-parity-"))
  try {
    const child = spawnSync(process.execPath, ["scripts/balance.ts", "--seeds", "1", "--term", "60", "--snapshot", "30", "--out", out], { encoding: "utf8", timeout: 80000 })
    assert.equal(child.status, 0, child.stderr)
    const world = JSON.parse(readFileSync(join(out, "medium-fair-1000-30min.json"), "utf8")).world
    assert.equal(createHash("sha256").update(JSON.stringify(world)).digest("hex"), "e759806fa37003f6215db219c3a784332afc2fc5c44d22845b71dc0fcdd78f87")
  } finally { rmSync(out, { recursive: true, force: true }) }
})
