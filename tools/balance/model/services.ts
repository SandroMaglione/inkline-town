import { doors, key, nearest, reach, type TileLike } from "../../../src/grid.ts"
import { planPatrols, serviceDoors } from "../../../src/rules/patrol.ts"
import type { Rules } from "../../../src/rules/config.ts"
import type { Assignment } from "../../../src/rules/production.ts"
import { scenarioGrid } from "../scenario.ts"
import type { ModelBuilding, Scenario } from "../types.ts"

export interface Contact {
  readonly target: number; readonly expectedVisitsPerTrip: number; readonly hitProbability: number
  readonly firstHitSeconds: number | null; readonly visitsPerMinute: number
  readonly maximumVisitGapSeconds: number; readonly visitGapsSeconds: ReadonlyArray<number>
}
export interface ServiceProfile {
  readonly source: number; readonly service: string; readonly tripsPerMinute: number
  readonly meanTripSeconds: number; readonly contacts: ReadonlyArray<Contact>
  readonly tours: number; readonly cycleSeconds: number; readonly unreachable: ReadonlyArray<number>
  readonly assumption: string
}

/** The actual deterministic route planner; no runtime or random sampler is used. */
export const serviceProfile = (scenario: Scenario, building: ModelBuilding, staff: Assignment, rules: Rules): ServiceProfile | null => {
  const kind = rules.kinds[building.kind], service = kind.service
  if (!service || building.paused || building.site || (kind.workers > 0 && staff.assigned === 0)) return null
  const grid = scenarioGrid(scenario, rules).value(), starts = doors(grid, building.tile)
  if (starts.length === 0) return null
  const targets: ReadonlyArray<{ readonly id: number; readonly tile: TileLike }> = service.service === "fire" || service.service === "repair"
    ? [...scenario.homes, ...scenario.buildings.filter(b => !b.site && b.kind !== "townhall")] : scenario.homes
  const plan = planPatrols(grid, building.tile, service.range, targets)
  if (plan.tours.length === 0) return null
  const secondsPerCell = rules.transport.cellSteps * rules.stepSeconds / rules.transport.walk
  const homeRoads = reach(grid, starts)
  const meanTripSeconds = plan.tours.reduce((n, tour) => n + (tour.length - 1 + (nearest(homeRoads, [tour.at(-1)!])?.distance ?? 0)) * secondsPerCell, 0) / plan.tours.length
  const apprenticed = staff.assigned > 0 && staff.assigned === staff.apprentices
  const launchSeconds = service.seconds / (apprenticed ? rules.apprentice : 1)
  const tripsPerMinute = Math.min(60 / launchSeconds, meanTripSeconds > 0 ? rules.transport.active * 60 / meanTripSeconds : Infinity)
  const cadence = 60 / tripsPerMinute, cycleSeconds = cadence * plan.tours.length
  const contacts = targets.flatMap((target): Contact[] => {
    const beside = new Set(serviceDoors(grid, target.tile).map(p => key(p.x, p.y)))
    const visits = plan.tours.map(tour => tour.flatMap((p, i) => beside.has(key(p.x, p.y)) ? [i * secondsPerCell] : []))
    const hits = visits.filter(v => v.length > 0)
    if (hits.length === 0) return []
    const times = visits.flatMap((v, tour) => v.map(t => (tour * cadence + t) % cycleSeconds)).sort((a, b) => a - b)
    const gaps = times.map((t, i) => i + 1 < times.length ? times[i + 1]! - t : times[0]! + cycleSeconds - t)
    const expectedVisitsPerTrip = times.length / plan.tours.length
    return [{ target: target.id, expectedVisitsPerTrip, hitProbability: hits.length / plan.tours.length,
      firstHitSeconds: hits.reduce((n, v) => n + v[0]!, 0) / hits.length, visitsPerMinute: expectedVisitsPerTrip * tripsPerMinute,
      maximumVisitGapSeconds: Math.max(...gaps), visitGapsSeconds: gaps }]
  })
  return { source: building.id, service: service.service, tripsPerMinute, meanTripSeconds, contacts,
    tours: plan.tours.length, cycleSeconds, unreachable: plan.unreachable,
    assumption: "Exact planned coverage and tour visit fractions. Launch timing uses mean occupancy; goods and repair baskets may empty sooner. Revisit gaps assume evenly spaced launches; service phases are not independent in the runtime." }
}

/** Fraction of a uniformly placed window missing a visit under the stated periodic timing estimate. */
export const missProbability = (profiles: ReadonlyArray<ServiceProfile>, target: number, seconds: number): number => {
  let miss = 1
  for (const p of profiles) {
    const c = p.contacts.find(c => c.target === target)
    if (!c) continue
    miss *= c.visitGapsSeconds.reduce((n, gap) => n + Math.max(0, gap - seconds), 0) / p.cycleSeconds
  }
  return miss
}
