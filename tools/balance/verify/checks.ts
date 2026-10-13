import { amounts, type KindId } from "../../../src/content.ts"
import { type Rules } from "../../../src/rules/config.ts"
import { analyze } from "../model/analyze.ts"
import { recipeCapacity } from "../model/throughput.ts"
import { project } from "../model/project.ts"
import { assessTransfers } from "../model/transport.ts"
import { district, fromSnapshot } from "../scenario.ts"
import { component, fixture } from "./fixture.ts"
import type { Inputs, ProjectionOptions } from "../types.ts"

export interface Verification { readonly name: string; readonly confidence: string; readonly expected: number; readonly actual: number; readonly absoluteError: number; readonly tolerance: number; readonly pass: boolean; readonly detail: string }
const compare = (name: string, confidence: string, expected: number, actual: number, tolerance: number, detail: string): Verification =>
  ({ name, confidence, expected, actual, absoluteError: Math.abs(expected - actual), tolerance, pass: Math.abs(expected - actual) <= tolerance, detail })

export const verifyProduction = (rules: Rules, kind: KindId, apprentices: boolean, tools: boolean, worn = false): Verification => {
  let scenario = district(`production-${kind}`, [apprentices ? 1 : 2, apprentices ? 1 : 2], [kind], false, rules)
  scenario = { ...scenario, buildings: [...scenario.buildings, ...scenario.homes.map((h, i) => ({ id: 200 + i, kind: "garden" as const, tile: { x: h.tile.x, y: h.tile.y - 1, size: 1 }, condition: rules.conditionMax, paused: false, site: false, stock: amounts({}) }))] }
  const producer = scenario.buildings.find((b) => b.kind === kind)!, recipe = rules.kinds[kind].recipe!
  scenario = { ...scenario, homes: scenario.homes.map((h) => ({ ...h, food: 10000000, bread: apprentices ? 0 : 10000000, cloth: apprentices ? 0 : 10000000, faith: apprentices ? 0 : 10000000 })),
    buildings: scenario.buildings.map((b) => ({ ...b, stock: amounts(b.id === producer.id ? { tools: tools ? 1 : 0 } : {}), condition: b.id === producer.id && worn ? rules.condition.worn - 1 : b.condition })) }
  const town = fixture(scenario, rules)
  const seconds = 60
  let made = 0
  for (let second = 0; second < seconds; second++) {
    town.change((s) => {
      const stock = component(s, producer.id, "Town/Inventory").stock
      stock[recipe.output] = 0
      if (recipe.input) stock[recipe.input] = 8
      stock.tools = tools ? 1 : 0
    })
    town.run(1)
    made = component(town.snapshot(), producer.id, "Town/Recipe").made
  }
  const snapshot = town.snapshot(), staff = component(snapshot, producer.id, "Town/Staff")
  const expected = recipeCapacity(rules.kinds[kind], staff, tools ? 1 : 0, worn ? rules.condition.worn - 1 : rules.conditionMax, null, rules).jobsPerMinute
  return compare(`${kind}/${apprentices ? "apprentices" : "citizens"}/${tools ? "tool" : "no-tool"}/${worn ? "worn" : "new"}`, "cadence capacity", expected, made, 1,
    "Isolated workshop; inputs replenished and outputs removed each second. This verifies production cadence, not a sustainable economy.")
}

export const verifyEconomy = (rules: Rules): Verification => {
  const scenario = district("ledger", [1, 1, 1, 1], [], false, rules)
  const stable = { ...scenario, homes: scenario.homes.map((h) => ({ ...h, food: 10000000 })), buildings: scenario.buildings.map((b) => ({ ...b, stock: amounts({}) })) }
  const predicted = analyze({ rules, scenario: stable }, { services: false }).economy.roundedNetPerMinute
  const town = fixture(stable, rules), before = town.snapshot().resources["Town/Treasury"].coins
  town.run(60)
  const actual = town.snapshot().resources["Town/Treasury"].coins - before
  return compare("collection-rounding", "exact", predicted, actual, 0, "Stable settlers, no trade, no crown deadline, six actual ledger collections")
}

export const verifyTransport = (rules: Rules): Verification => {
  const base = district("carrier-capacity", Array(4).fill(1), ["lumberjack", "warehouse"], false, rules)
  const producer = base.buildings.find((b) => b.kind === "lumberjack")!, destination = base.buildings.find((b) => b.kind === "warehouse")!
  const scenario = { ...base, homes: base.homes.map((h) => ({ ...h, food: 10000000 })), buildings: base.buildings.map((b) => b.kind === "warehouse" ? { ...b, tile: { ...b.tile, x: 33 }, stock: amounts({}) } : { ...b, stock: amounts(b.kind === "townhall" ? { wood: rules.kinds.townhall.holds!.cap } : { tools: 1 }) }) }
  const town = fixture(scenario, rules)
  let delivered = 0
  for (let second = 0; second < 120; second++) {
    town.change((s) => { component(s, producer.id, "Town/Inventory").stock.wood = 8 })
    town.run(1)
    delivered = component(town.snapshot(), destination.id, "Town/Inventory").stock.wood
  }
  const budget = assessTransfers({ rules, scenario }, [{ source: producer.id, target: destination.id, good: "wood", goodsPerMinute: 1 }])
  const expected = budget.pools[0]!.availableCarrierSeconds / budget.routes[0]!.carrierSecondsPerMinute! * 2
  return compare("shared-carrier-capacity", "full-load capacity", expected, delivered, rules.kinds.lumberjack.carriers! * rules.transport.load,
    "Real full-load trips to a distant warehouse; tolerance permits one in-flight load per carrier at the measurement boundary")
}

/** Independent runtime excursions, compared with finite-path DP rather than another mathematical sampler. */
export const verifyService = (rules: Rules, branched: boolean, seeds = 16): Verification => {
  const base = district(branched ? "branched-faith" : "straight-faith", Array(10).fill(1), ["chapel"], branched, rules)
  const scenario = { ...base, homes: base.homes.map((h) => ({ ...h, food: 10000000 })), buildings: base.buildings.map((b) => ({ ...b, stock: amounts({}) })) }
  const chapel = scenario.buildings.find((b) => b.kind === "chapel")!, target = scenario.homes[scenario.homes.length - 1]!
  const predicted = analyze({ rules, scenario }).services.find((p) => p.source === chapel.id)!.contacts.find((c) => c.target === target.id)?.hitProbability ?? 0
  let trips = 0, hits = 0
  for (let seed = 0; seed < seeds; seed++) {
    const town = fixture({ ...scenario, charter: { ...scenario.charter, seed: 1000 + seed * 7919 } }, rules)
    const seen = new Map<number, { hit: boolean; completed: boolean }>()
    for (let second = 0; second < 80; second += 0.4) {
      town.run(0.4)
      const snapshot = town.snapshot()
      const walkers = snapshot.entities.filter((e) => e.components["Town/Roam"]?.service === "faith")
      for (const e of walkers) {
        const roam = e.components["Town/Roam"], route = e.components["Town/Route"]
        const record = seen.get(e.id) ?? { hit: false, completed: false }
        const cell = roam.back ? route.cells[0] : route.cells[route.index]
        if (!record.completed && cell && Math.abs(cell.x - target.tile.x) + Math.abs(cell.y - target.tile.y) === 1) record.hit = true
        if (roam.back && !record.completed) { trips += 1; hits += Number(record.hit); record.completed = true }
        seen.set(e.id, record)
      }
    }
  }
  const actual = trips > 0 ? hits / trips : 0, tolerance = 3 * Math.sqrt(Math.max(0.01, predicted * (1 - predicted)) / Math.max(1, trips)) + 0.03
  return compare(branched ? "branched-service-hit" : "straight-service-hit", "finite-path probability", predicted, actual, tolerance,
    `${hits}/${trips} completed excursions across ${seeds} fixed seeds; tolerance is 3 standard errors plus 0.03 sampling allowance. No basket depletion in faith service.`)
}

export const verifyProjection = (inputs: Inputs, options: ProjectionOptions) => {
  if (options.builds?.length || options.crown?.length || inputs.scenario.imports || inputs.scenario.exports) throw new Error("Use a build/trade verifier for external schedules; controlled forecast comparison requires no external injections")
  const prediction = project(inputs, options), town = fixture(inputs.scenario, inputs.rules)
  let firstCitizen: number | null = null
  const actual: Array<{ second: number; coins: number; residents: number; citizens: number }> = []
  for (let second = 0; second <= options.seconds; second++) {
    const s = fromSnapshot(town.snapshot()), citizens = s.homes.filter((h) => h.tier >= 2).reduce((n, h) => n + h.residents, 0)
    if (citizens > 0 && firstCitizen === null) firstCitizen = second
    if (second % 60 === 0 || second === options.seconds) actual.push({ second, coins: s.coins, residents: s.homes.reduce((n, h) => n + h.residents, 0), citizens })
    if (second < options.seconds) town.run(1)
  }
  return { prediction, actual, firstCitizen, errors: actual.map((a) => {
    const p = prediction.rows.find((p) => p.second === a.second)!
    return { second: a.second, coins: p.coins - a.coins, residents: p.residents - a.residents, citizens: p.citizens - a.citizens }
  }), scope: "Diagnostic forecast comparison; no claim of exact equivalence, human success or full-term victory" }
}

export const verify = (rules: Rules, seeds = 16): Verification[] => [
  verifyEconomy(rules), verifyTransport(rules),
  ...(["bakery", "weaver"] as const).flatMap((kind) => [verifyProduction(rules, kind, false, true), verifyProduction(rules, kind, true, true), verifyProduction(rules, kind, true, false), verifyProduction(rules, kind, false, false, true)]),
  verifyService(rules, false, seeds), verifyService(rules, true, seeds)
]
