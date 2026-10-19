import { shippedRules, type Rules } from "./config.ts"
import type { Kind } from "../content/index.ts"

/** Tick alignment is significant: keep effort and equipment cadence on the same clock. */
export const paced = (pace: number, tick: number): boolean => pace >= 1 || Math.floor((tick + 1) * pace) > Math.floor(tick * pace)
export const effort = (staff: { readonly assigned: number; readonly apprentices: number }, tick: number, rules: Rules = shippedRules) =>
  staff.assigned - staff.apprentices + (paced(rules.apprentice, tick) ? staff.apprentices : 0)
export const equipmentPace = (kind: Kind, tools: number, condition: number, fishing: number, rules: Rules = shippedRules) =>
  (kind.wear && tools === 0 ? 0.5 : 1) * (condition < rules.condition.worn ? 0.5 : 1) * (kind.gathers?.source === "water" ? fishing : 1)

export interface CrewHome { readonly id: number; readonly crew: "settlers" | "citizens"; readonly residents: number }
export interface Workplace {
  readonly id: number; readonly crew: "settlers" | "citizens"; readonly needed: number
  readonly within: ReadonlyArray<{ readonly home: number; readonly distance: number }>
}
export interface Assignment { readonly assigned: number; readonly apprentices: number; readonly nearby: number }

/** Same scarcity-first, insertion-order tie break and two-pass apprenticeship as AssignStaff. */
export const assignWorkers = (homes: ReadonlyArray<CrewHome>, workplaces: ReadonlyArray<Workplace>): Map<number, Assignment> => {
  const left = new Map(homes.map((h) => [h.id, { ...h, left: h.residents }]))
  const places = workplaces.map((w, index) => ({ ...w, index, assigned: 0, apprentices: 0,
    within: [...w.within].sort((a, b) => a.distance - b.distance),
    nearby: w.within.reduce((n, h) => n + (left.get(h.home)?.crew === w.crew ? left.get(h.home)!.residents : 0), 0)
  }))
  const order = [...places].sort((a, b) => a.nearby - b.nearby || a.index - b.index)
  const fill = (place: (typeof places)[number], crew: CrewHome["crew"]) => {
    for (const within of place.within) {
      if (place.assigned >= place.needed) break
      const h = left.get(within.home)
      if (!h || h.crew !== crew || h.left === 0) continue
      const take = Math.min(place.needed - place.assigned, h.left)
      h.left -= take; place.assigned += take
      if (place.crew === "citizens" && crew === "settlers") place.apprentices += take
    }
  }
  for (const p of order) fill(p, p.crew)
  // Skilled jobs retain their crews; surplus citizens may do rough work at full pace.
  for (const p of order) if (p.crew === "settlers") fill(p, "citizens")
  for (const p of order) if (p.crew === "citizens") fill(p, "settlers")
  return new Map(places.map((p) => [p.id, { assigned: p.assigned, apprentices: p.apprentices, nearby: p.nearby }]))
}
