/**
 * What needs looking at now, a line each: fires, sickness, workshops idle
 * for want of their input, workplaces no one can reach, and food running
 * out. A shelf runs empty for a moment all the time, so idleness and hunger
 * are only said once they have lasted (see `Patience`).
 */
import { kinds, stepsOf, type GoodId, type KindId } from "../game/content/index.ts"
import { larder } from "../game/schedule.ts"
import type { TileLike } from "../game/world/grid.ts"
import type { Point } from "../game/world/iso.ts"
import type { Alert } from "./contracts.ts"
import type { Frame } from "./frame.ts"

/** How long things have been wrong, so the ticker waits before saying so. Not saved; it starts over on a load. */
export interface Patience {
  /** When each workshop began waiting for its input: the ticker only says so after `ALERT_PATIENCE`. */
  readonly starvedSince: Map<number, number>
  /** Since when the store has held no food (`null`: it has some). Fish comes in and goes out in handfuls, so the ticker waits `HUNGER_PATIENCE` before saying so. */
  emptySince: number | null
  /** Once said, it stays said a while, so a handful of fish arriving does not flick it off and on. */
  hungryUntil: number
}
export const freshPatience = (): Patience => ({ starvedSince: new Map(), emptySince: null, hungryUntil: 0 })
const ALERT_PATIENCE = stepsOf(30)
const HUNGER_PATIENCE = stepsOf(20)

/** The alerts this frame; the workplaces short of workers; and the town hall's row. */
export const alertsOf = (frame: Frame, patience: Patience) => {
  const { buildings, houses, tick } = frame
  const words = frame.t.view.alerts
  const alerts: Array<Alert> = []
  const census = frame.world.census
  const stock = frame.world.stock
  /** A building of this kind stands (built, not a site). */
  const stands = (k: KindId) => buildings.some(({ data }) => data.building.kind === k && data.site === undefined && data.rising === undefined)
  // Each line says what is wrong, then what to do about it.
  const burningRow = [...buildings, ...houses].find(({ data }) => data.burning !== undefined)
  if (census.burning > 0) alerts.push({ tone: "bad", text: words.fire(census.burning, stands("firewatch")), at: burningRow?.data.tile ?? null, size: burningRow?.data.tile.size ?? 1, id: burningRow?.entity.id ?? null })
  const sickRow = houses.find(({ data }) => data.sick !== undefined)
  if (census.sick > 0) alerts.push({ tone: "warn", text: words.sick(census.sick, stands("healer") || stands("hospital")), at: sickRow?.data.tile ?? null, size: 1, id: sickRow?.entity.id ?? null })
  // Workshops waiting on their input, and workplaces nobody can reach, a line for each kind: where the first of it stands, and how many.
  const waiting = new Map<KindId, { n: number; at: TileLike; id: number; kind: KindId; good: GoodId }>()
  const remote = new Map<KindId, { n: number; at: TileLike; id: number; kind: KindId }>()
  const shortStaffed: Array<{ id: number; title: string; cell: Point; size: number; assigned: number; needed: number; nobodyNear: boolean }> = []
  const seen = new Set<number>()
  for (const { entity, data } of buildings) {
    if (data.site !== undefined || data.rising !== undefined || data.paused !== undefined) continue
    const kind = kinds[data.building.kind]
    const status = data.status
    const staff = data.staff
    const tile = data.tile
    if (status === "starved" && kind.recipe?.input) {
      seen.add(entity.id)
      const since = patience.starvedSince.get(entity.id) ?? tick
      if (!patience.starvedSince.has(entity.id)) patience.starvedSince.set(entity.id, tick)
      if (tick - since >= ALERT_PATIENCE) {
        const was = waiting.get(kind.id)
        waiting.set(kind.id, was ? { ...was, n: was.n + 1 } : { n: 1, at: tile, id: entity.id, kind: kind.id, good: kind.recipe.input })
      }
    }
    if (staff.needed > 0 && staff.assigned < staff.needed) shortStaffed.push({ id: entity.id, title: frame.t.kind.name(kind.id), cell: tile, size: tile.size, assigned: staff.assigned, needed: staff.needed, nobodyNear: staff.nearby === 0 })
    if (status === "unstaffed" && staff.nearby === 0) {
      const was = remote.get(kind.id)
      remote.set(kind.id, was ? { ...was, n: was.n + 1 } : { n: 1, at: tile, id: entity.id, kind: kind.id })
    }
  }
  for (const id of [...patience.starvedSince.keys()]) if (!seen.has(id)) patience.starvedSince.delete(id)
  const first = (m: Map<KindId, { at: TileLike; id: number }>) => [...m.values()][0]
  const placesOf = (m: Map<KindId, { at: TileLike; id: number; kind: KindId }>) =>
    Object.fromEntries([...m.values()].map((v) => [v.kind, { at: v.at, size: v.at.size, id: v.id }]))
  if (waiting.size > 0) alerts.push({ tone: "warn", text: words.idle([...waiting.values()]), at: first(waiting)?.at ?? null, size: first(waiting)?.at.size ?? 1, id: first(waiting)?.id ?? null, places: placesOf(waiting) })
  if (remote.size > 0) alerts.push({ tone: "warn", text: words.remote([...remote.values()]), at: first(remote)?.at ?? null, size: first(remote)?.at.size ?? 1, id: first(remote)?.id ?? null, places: placesOf(remote) })
  const hallRow = buildings.find(({ data }) => data.hall !== undefined)
  const empty = census.homes > 0 && larder(stock) === 0
  if (!empty || (patience.emptySince !== null && patience.emptySince > tick)) patience.emptySince = null
  if (empty && patience.emptySince === null) patience.emptySince = tick
  if (empty && tick - patience.emptySince! >= HUNGER_PATIENCE) patience.hungryUntil = tick + HUNGER_PATIENCE
  if (patience.hungryUntil > tick + HUNGER_PATIENCE) patience.hungryUntil = 0
  if (census.homes > 0 && tick < patience.hungryUntil) alerts.push({ tone: "bad", text: words.hungry, at: hallRow?.data.tile ?? null, size: hallRow?.data.tile.size ?? 1, id: hallRow?.entity.id ?? null })
  return { alerts, shortStaffed, hallRow }
}
