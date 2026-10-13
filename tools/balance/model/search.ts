import type { KindId } from "../../../src/content.ts"
import { amounts } from "../../../src/content.ts"
import { resolveRules, type RulePatch, type Rules } from "../../../src/rules/config.ts"
import { analyze } from "./analyze.ts"
import { district } from "../scenario.ts"
import type { Inputs } from "../types.ts"

/** Offline experiments only. Candidates are immutable and are never written to game content. */
export const searchParameters = (inputs: Inputs, candidates: ReadonlyArray<ReadonlyArray<RulePatch>>, score: (result: ReturnType<typeof analyze>) => number) =>
  candidates.map((patches) => {
    // Patches are relative to shipped content. Refuse silently mixing a different base configuration.
    if (JSON.stringify(inputs.rules) !== JSON.stringify(resolveRules())) throw new Error("Parameter search requires the shipped-rule base")
    const rules = resolveRules(patches), analysis = analyze({ rules, scenario: inputs.scenario }, { services: false })
    return { patches, rules, analysis, score: score(analysis) }
  }).sort((a, b) => b.score - a.score)

/** Enumerates affordable production packages at the unchanged game parameters. */
export const searchDistricts = (rules: Rules, homes = 8) => {
  const results: Array<{ buildings: ReadonlyArray<KindId>; cost: number; materials: Record<string, number>; foodPerMinute: number; clothPerMinute: number; workers: number; upkeep: number; affordableAtFoundation: boolean }> = []
  for (let bakeries = 1; bakeries <= 3; bakeries++) for (let weavers = 1; weavers <= 3; weavers++) for (let fisheries = 0; fisheries <= 2; fisheries++) {
    const kinds: KindId[] = ["chapel", ...Array.from({ length: bakeries }, () => ["farm", "mill", "bakery"] as const).flat(), ...Array.from({ length: weavers }, () => ["sheep", "weaver"] as const).flat(), ...Array<KindId>(fisheries).fill("fishery")]
    const base = district("candidate", Array(homes).fill(1), kinds, false, rules)
    const scenario = { ...base, buildings: base.buildings.map((b) => b.kind === "townhall" ? { ...b, stock: amounts({}) } : b) }
    const analysis = analyze({ rules, scenario }, { services: false, minutes: 1 })
    const materials: Record<string, number> = {}
    for (const k of kinds) for (const [g, n] of Object.entries(rules.kinds[k].cost.materials)) materials[g] = (materials[g] ?? 0) + n!
    materials.tools = (materials.tools ?? 0) + kinds.filter((k) => rules.kinds[k].wear).length
    const cost = kinds.reduce((n, k) => n + rules.kinds[k].cost.coins, 0)
    const workers = kinds.reduce((n, k) => n + rules.kinds[k].workers, 0), upkeep = kinds.reduce((n, k) => n + rules.kinds[k].upkeep, 0)
    results.push({ buildings: kinds, cost, materials, foodPerMinute: analysis.availableAfterWorkshops.bread + analysis.availableAfterWorkshops.fish,
      clothPerMinute: analysis.availableAfterWorkshops.cloth, workers, upkeep,
      affordableAtFoundation: cost <= rules.lands.fair.coins && Object.entries(materials).every(([g, n]) => n <= rules.lands.fair.stock[g as keyof typeof rules.lands.fair.stock]) })
  }
  return results.sort((a, b) => a.cost - b.cost)
}
