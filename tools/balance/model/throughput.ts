import type { Kind, WinterId } from "../../../src/content.ts"
import { around, useAt, ownerAt, type GridBuilder } from "../../../src/grid.ts"
import { ruleTicks, type Rules } from "../../../src/rules/config.ts"
import { equipmentPace, effort, paced } from "../../../src/rules/production.ts"
import type { Assignment } from "../../../src/rules/production.ts"
import type { RecipeCapacity, Scenario, ModelBuilding } from "../types.ts"

/** Tiny periodic cadence calculation, not an ECS run. Products of average paces are insufficient. */
export const recipeCapacity = (kind: Kind, staff: Assignment, tools: number, condition: number, severity: WinterId | null, rules: Rules): RecipeCapacity => {
  const zero = { jobsPerMinute: 0, outputPerMinute: 0, inputPerMinute: 0, toolsPerMinute: 0, meanJobTicks: 0, cadenceTicks: 1 }
  if (!kind.recipe || staff.assigned === 0 || kind.workers === 0) return zero
  const pace = equipmentPace(kind, tools, condition, severity === null ? 1 : rules.winters[severity].fishing, rules)
  let period = 1
  while (period <= 4096 && (Math.abs(pace * period - Math.round(pace * period)) > 1e-9 || Math.abs(rules.apprentice * period - Math.round(rules.apprentice * period)) > 1e-9)) period += 1
  if (period > 4096) throw new Error("Cadence denominator exceeds 4096; choose a supported rational pace")
  const weights = Array.from({ length: period }, (_, tick) => paced(pace, tick) ? effort(staff, tick, rules) : 0)
  const total = weights.reduce((sum, n) => sum + n, 0)
  if (total === 0) return zero
  const required = ruleTicks(kind.recipe.seconds, rules) * kind.workers
  if (required <= 0) throw new Error("Recipe period must be positive")
  const duration = (phase: number) => {
    const cycles = Math.max(0, Math.ceil(required / total) - 1)
    let done = cycles * total, ticks = cycles * period
    while (done < required) { done += weights[(phase + ticks) % period]!; ticks += 1 }
    return ticks
  }
  const seen = new Map<number, { readonly ticks: number; readonly jobs: number }>()
  let phase = 0, ticks = 0, jobs = 0
  while (!seen.has(phase)) {
    seen.set(phase, { ticks, jobs })
    const d = duration(phase); ticks += d; jobs += 1; phase = (phase + d) % period
  }
  const start = seen.get(phase)!, meanJobTicks = (ticks - start.ticks) / (jobs - start.jobs)
  const jobsPerMinute = 60 / (meanJobTicks * rules.stepSeconds)
  return { jobsPerMinute, outputPerMinute: jobsPerMinute * kind.recipe.batch,
    inputPerMinute: jobsPerMinute * kind.recipe.inputs, toolsPerMinute: kind.wear ? jobsPerMinute / kind.wear : 0,
    meanJobTicks, cadenceTicks: period }
}

/** Accessible source ceiling over the specified horizon. Forestry overlaps are called out separately. */
export const sourceCeiling = (b: ModelBuilding, scenario: Scenario, grid: GridBuilder, severity: WinterId | null, minutes: number, rules: Rules): number => {
  const k = rules.kinds[b.kind], g = k.gathers
  if (!g) return Infinity
  const ids = new Set(around(b.tile, g.radius).filter((p) => useAt(grid.value(), p.x, p.y) === (g.source === "ore" || g.source === "stone" ? "rock" : g.source)).map((p) => ownerAt(grid.value(), p.x, p.y)))
  const sources = scenario.land.filter((l, i) => ids.has(-1 - i) && l.type === g.source)
  // Each cell of water gives a catch, then rests (see `RESTOCK_TICKS`): shared with other fisheries, this is a ceiling.
  if (g.source === "water") return sources.length * 60 / (rules.restockTicks * rules.stepSeconds)
  if (g.source === "field") {
    const ripe = sources.filter((l) => l.growth >= rules.grown.field).length
    return severity === null ? Math.max(sources.length, k.plants?.max ?? 0) * 60 / (rules.grown.field * rules.stepSeconds) : ripe / Math.max(minutes, 1 / 60)
  }
  const finite = sources.reduce((sum, l) => sum + (g.source === "tree" ? Number(l.growth >= rules.grown.tree) : l.amount), 0)
  const planted = g.source === "tree" ? scenario.buildings.filter((p) => p.kind === "forester" && !p.paused && !p.site && Math.abs(p.tile.x - b.tile.x) <= g.radius + rules.kinds.forester.plants!.radius && Math.abs(p.tile.y - b.tile.y) <= g.radius + rules.kinds.forester.plants!.radius).length * 60 / rules.kinds.forester.plants!.seconds : 0
  // Wild spreading can add at most one tree per checkpoint globally. Ignoring it would make this falsely narrow.
  const wildUpper = g.source === "tree" && scenario.land.some((l) => l.type === "tree") ? 60 / (rules.spreadTicks * rules.stepSeconds) : 0
  return finite / Math.max(minutes, 1 / 60) + planted + wildUpper
}
