/**
 * The mayor's guide: the step to take now, chosen from what the town has done
 * and what it needs (see `rules/guide.ts`). Only the simulation writes the
 * guide: what the mayor says and what the town completes go to it as edits,
 * and count here until it has applied them (`pending`), so the guide moves on
 * at once.
 */
import { CONDITION_MAX, condition as wear, goodIds, home, kinds, RISK_MAX } from "../game/content/index.ts"
import type { Edit } from "../game/edits.ts"
import { courseCount, GUIDE_QUIET, guideDone, guideStep, guideSteps, lockedNote, upcoming, type GuideFacts, type GuideFocus } from "../game/rules/guide.ts"
import { met, steadyNet } from "../game/schedule.ts"
import { appealAt } from "../game/world/appeal.ts"
import { useAt, type TileLike } from "../game/world/grid.ts"
import { GRID } from "../game/world/iso.ts"
import type { Interaction, Stats } from "./contracts.ts"
import type { BuildingRow, Frame } from "./frame.ts"
import type { Numbers } from "./stats.ts"

/** The guide's state on the page's side (not saved): edits not yet applied, and its pace. */
export interface GuideState {
  readonly pending: { readonly done: Set<string>; off: boolean | null }
  /** The step it is showing, and until when it keeps quiet. */
  readonly pace: { shown: string | null; since: number; quietUntil: number }
}
export const freshGuide = (): GuideState => ({ pending: { done: new Set(), off: null }, pace: { shown: null, since: 0, quietUntil: 0 } })

/** The guide's part of the town's numbers; `hallRow`: the town hall, which several steps point at. */
export const guideOf = (frame: Frame, ui: Interaction, send: (edit: Edit) => void, state: GuideState, numbers: Numbers, hallRow: BuildingRow | undefined): Stats["guide"] => {
  const { grid, buildings, houses, cells, rates } = frame
  const census = frame.world.census
  const stock = frame.world.stock
  const pace = state.pace
  const { season, crown, mood, net, coins, f, t, seconds } = numbers
  // The page writes what the mayor told it; then the guide puts away what the town has done, and picks the step to show.
  // Only the simulation writes the guide: both go to it as edits, and count here until it has applied them.
  const pending = state.pending
  for (const action of ui.guide.splice(0)) {
    if (action.type === "skip") {
      pending.done.add(action.id)
      send({ type: "guide", done: [action.id] })
    } else {
      pending.off = action.type === "off"
      send({ type: "guideOff", off: pending.off })
    }
  }
  const placedKinds = new Set(buildings.map(({ data }) => data.building.get().kind))
  const standingKinds = new Set(buildings.filter(({ data }) => !data.site.present && !data.rising.present).map(({ data }) => data.building.get().kind))
  const wornRow = buildings.find((row) => frame.finished(row) && !row.data.hall.present && (row.data.condition.value()?.value ?? CONDITION_MAX) < wear.mend)
  // A settlers' home with bread, cloth, and faith, kept from citizens only by its street.
  const poorRow = houses.find((row) => {
    const h = row.data.house.get()
    if (h.tier !== 1 || !frame.finished(row)) return false
    const tile = row.data.tile.get()
    return met(h, "bread") && met(h, "cloth") && met(h, "faith") && appealAt(cells, tile.x, tile.y) < home.tiers[2].appeal
  })
  const saved = frame.world.guide
  for (const id of saved.done) pending.done.delete(id)
  if (pending.off === saved.off) pending.off = null
  const guide = { done: [...saved.done, ...pending.done], off: pending.off ?? saved.off }
  const put = new Set(guide.done)
  /** A road within two cells of water: reckoned only until the guide's road step is put away. */
  const roadNearWater = () => {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (useAt(grid, x, y) !== "road") continue
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (useAt(grid, x + dx, y + dy) === "water") return true
      }
    }
    return false
  }
  const facts: GuideFacts = {
    homes: houses.length,
    builtHomes: houses.filter(frame.finished).length,
    residents: census.settlers + census.citizens,
    citizens: census.citizens,
    finerHomes: houses.filter((row) => row.data.house.get().tier > 1).length,
    placed: placedKinds,
    standing: standingKinds,
    stock,
    sick: census.sick,
    burning: census.burning,
    winter: season.winter,
    winterIn: season.coming === null ? null : seconds(season.left),
    worn: wornRow !== undefined,
    poorStreet: poorRow !== undefined,
    crown: { open: crown.open, met: crown.met },
    net: steadyNet(frame.world.history.samples, net),
    approval: mood.approval,
    trading: rates.sells.length > 0 || rates.buys.length > 0,
    buysTools: rates.buys.includes("tools"),
    taxed: rates.settlers !== 100 || rates.citizens !== 100,
    most: Math.max(...goodIds.map((g) => stock[g])),
    sawTown: ui.menu === "town",
    sawHome: houses.some((row) => row.entity.id === ui.selected),
    sawBuilding: buildings.some((row) => row.entity.id === ui.selected && !row.data.hall.present),
    roadToWater: put.has("road") || roadNearWater(),
    coins,
    unreached: put.has("market") || standingKinds.has("market") ? 0 : frame.unreachedHomes(),
    rank: f.rank,
    upgraded: new Set(buildings.filter((row) => row.data.upgraded.present).map((row) => row.data.building.get().kind)),
    risk: {
      fire: houses.some((row) => (row.data.risk.value()?.fire ?? 0) >= RISK_MAX * 0.35),
      health: houses.some((row) => (row.data.risk.value()?.health ?? 0) >= RISK_MAX * 0.35),
      order: houses.some((row) => (row.data.risk.value()?.order ?? 0) >= RISK_MAX * 0.35)
    },
    fewTrees: buildings.some((row) => {
      if (row.data.building.get().kind !== "lumberjack" || !frame.finished(row)) return false
      const tile = row.data.tile.get()
      const reach = kinds.lumberjack.gathers!.radius
      return frame.trees.map(({ data }) => data.tile.get()).filter((t) => t.x >= tile.x - reach && t.x < tile.x + tile.size + reach && t.y >= tile.y - reach && t.y < tile.y + tile.size + reach).length < 6
    })
  }
  const playing = f.state === "playing" && !ui.founding
  const newly = playing ? guideDone(facts, put) : []
  if (newly.length > 0) {
    send({ type: "guide", done: newly })
    for (const id of newly) {
      put.add(id)
      pending.done.add(id)
    }
  }
  // The guide keeps quiet a while after a step is put away; a new town (the clock gone back) starts it afresh.
  if (t < pace.since) Object.assign(pace, { shown: null, since: 0, quietUntil: 0 })
  if (pace.shown !== null && put.has(pace.shown)) Object.assign(pace, { shown: null, quietUntil: t + GUIDE_QUIET * 60 })
  const step = guide.off || !playing ? null : guideStep(facts, put, { shown: pace.shown, quiet: t < pace.quietUntil })
  if (step && !step.urgent?.(facts)) pace.shown = step.id
  pace.since = t
  const hallTile = hallRow?.data.tile.get()
  /** Of some tiles, the one nearest the town hall. */
  const nearestHall = (tiles: ReadonlyArray<TileLike>): TileLike | undefined => {
    if (!hallTile) return tiles[0]
    let best: TileLike | undefined
    let far = Infinity
    for (const tile of tiles) {
      const d = Math.abs(tile.x - hallTile.x) + Math.abs(tile.y - hallTile.y)
      if (d < far) [best, far] = [tile, d]
    }
    return best
  }
  const focusOf = (focus: GuideFocus | null): { at: TileLike | null; id: number | null } => {
    if (focus === null) return { at: null, id: null }
    if (focus === "hall") return { at: hallTile ?? null, id: null }
    if (focus === "water") return { at: nearestHall(frame.water.map(({ data }) => data.tile.get())) ?? null, id: null }
    if (focus === "trees") return { at: nearestHall(frame.trees.map(({ data }) => data.tile.get())) ?? null, id: null }
    if (focus === "stone" || focus === "ore") {
      const ore = focus === "ore"
      return { at: nearestHall(frame.rocks.filter(({ data }) => data.rock.get().ore === ore).map(({ data }) => data.tile.get())) ?? null, id: null }
    }
    const row = focus === "worn" ? wornRow : focus === "poorStreet" ? poorRow : buildings.find(({ data }) => data.building.get().kind === focus.kind)
    return row ? { at: row.data.tile.get(), id: row.entity.id } : { at: null, id: null }
  }
  const shown = step ? focusOf(step.focus) : null
  return {
    step:
      step && shown
        ? {
            key: step.id,
            chapter: step.chapter,
            goal: step.goal,
            text: step.action,
            why: step.why,
            waiting: step.waiting?.(facts) ?? null,
            locked: lockedNote(step, facts),
            next: upcoming(facts, put),
            asks: step.asks ?? [],
            near: step.focus !== null && typeof step.focus === "object" && shown.id !== null ? step.focus.kind : null,
            count: courseCount(step),
            at: shown.at,
            size: shown.at?.size ?? 1,
            id: shown.id
          }
        : null,
    done: guideSteps.filter((s) => put.has(s.id)).length,
    total: guideSteps.length,
    off: guide.off
  }
}
