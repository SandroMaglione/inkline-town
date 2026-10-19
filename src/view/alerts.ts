/**
 * What needs looking at now, a line each: fires, sickness, workshops idle
 * for want of their input, workplaces no one can reach, and food running
 * out. A shelf runs empty for a moment all the time, so idleness and hunger
 * are only said once they have lasted (see `Patience`).
 */
import { COMMUTE, kinds, stepsOf, type KindId } from "../game/content/index.ts"
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
  const alerts: Array<Alert> = []
  const census = frame.world.census
  const stock = frame.world.stock
  /** A building of this kind stands (built, not a site). */
  const stands = (k: KindId) => buildings.some(({ data }) => data.building.get().kind === k && !data.site.present && !data.rising.present)
  // Each line says what is wrong, then what to do about it.
  const burningRow = [...buildings, ...houses].find(({ data }) => data.burning.present)
  const fireText = `${census.burning} on fire: ${stands("firewatch") ? "the fire watch's firefighters are on their way" : "build a fire watch nearby, whose firefighters put fires out"}`
  if (census.burning > 0) alerts.push({ tone: "bad", text: fireText, at: burningRow?.data.tile.get() ?? null, size: burningRow?.data.tile.get().size ?? 1, id: burningRow?.entity.id ?? null })
  const sickRow = houses.find(({ data }) => data.sick.present)
  const sickText = `${census.sick} home${census.sick > 1 ? "s" : ""} sick, holding half as many people: ${stands("healer") || stands("hospital") ? "a healer within reach of its road cures it" : "build a healer among the homes"}`
  if (census.sick > 0) alerts.push({ tone: "warn", text: sickText, at: sickRow?.data.tile.get() ?? null, size: 1, id: sickRow?.entity.id ?? null })
  const waiting = new Map<string, { n: number; at: TileLike; id: number; kind: KindId }>()
  const remote = new Map<string, { n: number; at: TileLike; id: number; kind: KindId }>()
  const shortStaffed: Array<{ id: number; title: string; cell: Point; size: number; assigned: number; needed: number; nobodyNear: boolean }> = []
  const seen = new Set<number>()
  for (const { entity, data } of buildings) {
    if (data.site.present || data.rising.present || data.paused.present) continue
    const kind = kinds[data.building.get().kind]
    const status = data.status.get()
    const staff = data.staff.get()
    const tile = data.tile.get()
    if (status === "starved" && kind.recipe?.input) {
      seen.add(entity.id)
      const since = patience.starvedSince.get(entity.id) ?? tick
      if (!patience.starvedSince.has(entity.id)) patience.starvedSince.set(entity.id, tick)
      if (tick - since >= ALERT_PATIENCE) {
        const label = `${kind.title.toLowerCase()} needs ${kind.recipe.input}`
        const was = waiting.get(label)
        waiting.set(label, was ? { ...was, n: was.n + 1 } : { n: 1, at: tile, id: entity.id, kind: kind.id })
      }
    }
    if (staff.needed > 0 && staff.assigned < staff.needed) shortStaffed.push({ id: entity.id, title: kind.title.toLowerCase(), cell: tile, size: tile.size, assigned: staff.assigned, needed: staff.needed, nobodyNear: staff.nearby === 0 })
    if (status === "unstaffed" && staff.nearby === 0) {
      const label = kind.title.toLowerCase()
      const was = remote.get(label)
      remote.set(label, was ? { ...was, n: was.n + 1 } : { n: 1, at: tile, id: entity.id, kind: kind.id })
    }
  }
  for (const id of [...patience.starvedSince.keys()]) if (!seen.has(id)) patience.starvedSince.delete(id)
  const list = (m: Map<string, { n: number }>) => [...m].map(([k, v]) => `${k}${v.n > 1 ? ` ×${v.n}` : ""}`).join(", ")
  const first = (m: Map<string, { at: TileLike; id: number }>) => [...m.values()][0]
  const placesOf = (m: Map<string, { at: TileLike; id: number; kind: KindId }>) =>
    Object.fromEntries([...m.values()].map((v) => [v.kind, { at: v.at, size: v.at.size, id: v.id }]))
  if (waiting.size > 0) alerts.push({ tone: "warn", text: `idle: the ${list(waiting)}. Build more of what makes it, or buy it in the [town] panel`, at: first(waiting)?.at ?? null, size: first(waiting)?.at.size ?? 1, id: first(waiting)?.id ?? null, places: placesOf(waiting) })
  if (remote.size > 0) alerts.push({ tone: "warn", text: `no workers for the ${list(remote)}: lay [homes] within ${COMMUTE} road cells of it, or a road to homes nearby`, at: first(remote)?.at ?? null, size: first(remote)?.at.size ?? 1, id: first(remote)?.id ?? null, places: placesOf(remote) })
  const hallRow = buildings.find(({ data }) => data.hall.present)
  const empty = census.homes > 0 && larder(stock) === 0
  if (!empty || (patience.emptySince !== null && patience.emptySince > tick)) patience.emptySince = null
  if (empty && patience.emptySince === null) patience.emptySince = tick
  if (empty && tick - patience.emptySince! >= HUNGER_PATIENCE) patience.hungryUntil = tick + HUNGER_PATIENCE
  if (patience.hungryUntil > tick + HUNGER_PATIENCE) patience.hungryUntil = 0
  if (census.homes > 0 && tick < patience.hungryUntil) alerts.push({ tone: "bad", text: "no food in store, so homes go hungry and pay no taxes: build another fishery, or buy fish in the [town] panel", at: hallRow?.data.tile.get() ?? null, size: hallRow?.data.tile.get().size ?? 1, id: hallRow?.entity.id ?? null })
  return { alerts, shortStaffed, hallRow }
}
