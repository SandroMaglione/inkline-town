import { doors, key, reach, type TileLike } from "../../../src/grid.ts"
import { GRID } from "../../../src/iso.ts"
import { onwardRoads } from "../../../src/rules/transport.ts"
import type { Rules } from "../../../src/rules/config.ts"
import type { Assignment } from "../../../src/rules/production.ts"
import { scenarioGrid } from "../scenario.ts"
import type { ModelBuilding, Scenario } from "../types.ts"

export interface Contact {
  readonly target: number; readonly expectedVisitsPerTrip: number; readonly hitProbability: number
  readonly firstHitSeconds: number | null; readonly visitsPerMinute: number
}
export interface ServiceProfile {
  readonly source: number; readonly service: string; readonly tripsPerMinute: number
  readonly meanTripSeconds: number; readonly contacts: ReadonlyArray<Contact>
  readonly assumption: string
}
interface State { readonly previous: number; readonly cell: number; readonly probability: number }

/** Finite non-backtracking random-walk DP. No random samples or headless runtime are used. */
export const serviceProfile = (scenario: Scenario, building: ModelBuilding, staff: Assignment, rules: Rules): ServiceProfile | null => {
  const kind = rules.kinds[building.kind], service = kind.service
  if (!service || building.paused || building.site || (kind.workers > 0 && staff.assigned === 0)) return null
  const grid = scenarioGrid(scenario, rules).value(), starts = doors(grid, building.tile)
  if (starts.length === 0) return null
  const homeRoads = reach(grid, starts), secondsPerCell = rules.transport.cellSteps * rules.stepSeconds / rules.transport.walk
  const targets: ReadonlyArray<{ readonly id: number; readonly tile: TileLike }> = service.service === "fire" || service.service === "repair" ? [...scenario.homes, ...scenario.buildings.filter((b) => !b.site && !rules.kinds[b.kind].decor)] : scenario.homes
  const beside = new Map<number, Set<number>>()
  for (const t of targets) for (const d of doors(grid, t.tile)) {
    const k = key(d.x, d.y), set = beside.get(k) ?? new Set<number>(); set.add(t.id); beside.set(k, set)
  }
  const next = (state: State): ReadonlyArray<number> => {
    const cell = { x: state.cell % GRID, y: Math.floor(state.cell / GRID) }
    const previous = state.previous < 0 ? null : { x: state.previous % GRID, y: Math.floor(state.previous / GRID) }
    const candidates = onwardRoads(grid, cell, previous).map((p) => key(p.x, p.y))
    return candidates.length > 0 ? candidates : state.previous < 0 ? [] : [state.previous]
  }
  const advance = (states: ReadonlyArray<State>, avoid = -1): State[] => {
    const result = new Map<string, State>()
    for (const s of states) {
      if (beside.get(s.cell)?.has(avoid)) continue
      const choices = next(s)
      for (const cell of choices) {
        const id = `${s.cell}:${cell}`, probability = s.probability / choices.length
        const old = result.get(id)
        result.set(id, { previous: s.cell, cell, probability: probability + (old?.probability ?? 0) })
      }
    }
    return [...result.values()]
  }
  const initial: State[] = [{ previous: -1, cell: key(starts[0]!.x, starts[0]!.y), probability: 1 }]
  const expected = new Map<number, number>()
  let states = initial, meanTripSeconds = 0
  for (let step = 0; step < service.range; step++) {
    for (const state of states) {
      for (const id of beside.get(state.cell) ?? []) expected.set(id, (expected.get(id) ?? 0) + state.probability)
      if (step === service.range - 1 || next(state).length === 0) {
        const distance = homeRoads.distance[state.cell]!
        meanTripSeconds += state.probability * (step + Math.max(0, distance)) * secondsPerCell
      }
    }
    states = advance(states)
  }
  const apprenticed = staff.assigned > 0 && staff.assigned === staff.apprentices
  const launchSeconds = service.seconds / (apprenticed ? rules.apprentice : 1)
  const tripsPerMinute = Math.min(60 / launchSeconds, meanTripSeconds > 0 ? rules.transport.active * 60 / meanTripSeconds : Infinity)
  const contacts = targets.filter((t) => expected.has(t.id)).map((t): Contact => {
    let unhit = initial, hitProbability = 0, firstHit = 0
    for (let step = 0; step < service.range; step++) {
      const now = unhit.filter((s) => beside.get(s.cell)?.has(t.id)).reduce((sum, s) => sum + s.probability, 0)
      hitProbability += now; firstHit += now * step * secondsPerCell
      unhit = advance(unhit, t.id)
    }
    return { target: t.id, expectedVisitsPerTrip: expected.get(t.id)!, hitProbability,
      firstHitSeconds: hitProbability > 0 ? firstHit / hitProbability : null,
      visitsPerMinute: expected.get(t.id)! * tripsPerMinute }
  })
  return { source: building.id, service: service.service, tripsPerMinute, meanTripSeconds, contacts,
    assumption: "Exact finite-path probabilities for uniform choices on fixed roads; trip rate uses mean occupancy. Goods/repair profiles assume unlimited baskets. Revisit-gap estimates assume independent excursions." }
}

/** Excursion-level renewal approximation; avoids counting repeated visits on one trip as independent protection. */
export const missProbability = (profiles: ReadonlyArray<ServiceProfile>, target: number, seconds: number): number => {
  let log = 0
  for (const p of profiles) {
    const c = p.contacts.find((c) => c.target === target)
    if (!c || c.hitProbability === 0) continue
    const trips = p.tripsPerMinute * seconds / 60
    if (c.hitProbability >= 1 && trips >= 1) return 0
    log += trips * Math.log(Math.max(1e-12, 1 - c.hitProbability))
  }
  return Math.exp(log)
}
