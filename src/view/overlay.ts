/**
 * The map views: desirability, workers, fire, health, order, and condition,
 * each a reading washed over the town cell by cell and over each model, with
 * a legend saying what its colours mean.
 */
import { COMMUTE, condition as wear, home, risk, RISK_MAX } from "../game/content/index.ts"
import { appealAt } from "../game/world/appeal.ts"
import { doors, key, reach, useAt, type TileLike } from "../game/world/grid.ts"
import { GRID } from "../game/world/iso.ts"
import type { Interaction, Legend, OverlayCell, SceneView, TownView, View } from "./contracts.ts"
import type { Frame } from "./frame.ts"

// Blue for fine, sand for worth a look, vermilion for wrong: a scale that still reads with
// red-green colour blindness, unlike green to red.
const GOOD = 0x3a78c2
const FAIR = 0xe2c25c
const BAD = 0xc8553d
/** Citizens' homes, in the workers view. */
const COOL = 0x8a58a8
/** The buildings that serve a view (its fire watch, its healer), and a workplace's reach: ink, apart from the scale. */
const MARK = 0x3d4943
/** A meter 0 → `of` as a colour: blue when low, sand, vermilion past the warning line. */
const meterColor = (value: number, of: number, warn: number) => (value >= warn ? BAD : value >= of * 0.35 ? FAIR : GOOD)

const legends: Readonly<Record<Exclude<View, "none">, Legend>> = {
  appeal: {
    title: "desirability",
    keys: [
      { color: 0x1f4f8f, label: `${home.tiers[3].appeal}+: townhouses` },
      { color: GOOD, label: `${home.tiers[2].appeal}+: citizens` },
      { color: 0xc6d4e4, label: "0 to 4: settlers only" },
      { color: 0xeaa26a, label: "below 0: fewer people, less tax" },
      { color: BAD, label: `${home.squalid} or less: squalid` }
    ],
    note: "Every point counts: a cottage holds fewer and pays less for each point below 0, and pays more above it. Industry pushes homes away; parks (the more they hold, the further they reach), a chapel, a market, and paved streets draw them in."
  },
  workers: {
    title: "workers",
    keys: [
      { color: GOOD, label: "fully staffed" },
      { color: FAIR, label: "short of workers" },
      { color: BAD, label: "no workers" },
      { color: 0xd6b48a, label: "settlers' homes" },
      { color: COOL, label: "citizens' homes" }
    ],
    note: `Residents walk at most ${COMMUTE} road cells to work. Select a workplace to see its reach and the homes inside it.`
  },
  fire: {
    title: "fire",
    keys: [
      { color: GOOD, label: "watched" },
      { color: FAIR, label: "rising" },
      { color: BAD, label: "at risk, or burning" }
    ],
    note: "Buildings take the colour too. A fire watch's watchman resets the risk of every home and workshop along the way; vermilion means past half way, so there is still time. Wooden cottages, ovens, forges, and crowding raise it."
  },
  health: {
    title: "health",
    keys: [
      { color: GOOD, label: "visited" },
      { color: FAIR, label: "rising" },
      { color: BAD, label: "at risk, or sick" }
    ],
    note: "A healer's physician resets the risk and cures the sick. Hunger, crowding, squalor, quarry dust, and still water raise it."
  },
  order: {
    title: "order",
    keys: [
      { color: GOOD, label: "kept" },
      { color: FAIR, label: "rising" },
      { color: BAD, label: "thieves about" }
    ],
    note: "A watch house's constable keeps order. Low approval, squalor, and homes not full raise it; theft first, then the home is left derelict."
  },
  condition: {
    title: "condition",
    keys: [
      { color: GOOD, label: "well kept" },
      { color: FAIR, label: "needs mending" },
      { color: BAD, label: "run down: half pace" }
    ],
    note: "A builder's yard mends what its builder passes with planks and stone. At nothing it falls down."
  }
}
/** A view's colour over a model: pale, so the ink still reads. */
const TINT = { good: 0xbcd2ee, fair: 0xf3e3a8, bad: 0xf2b9a0, cool: 0xdccbe8, mark: 0xd5dad3, settlers: 0xead7bd, fine: 0xa9c4e8, plain: 0xffffff }

const appealColor = (v: number) =>
  v >= home.tiers[3].appeal ? 0x1f4f8f : v >= home.tiers[2].appeal ? GOOD : v >= 0 ? 0xc6d4e4 : v > home.squalid ? 0xeaa26a : BAD

/** Rebuilds the map view over the town when what it shows changes (the view, the picked thing, the town, every half second). */
export const drawOverlay = (frame: Frame, ui: Interaction, scene: SceneView, town: TownView) => {
  const { grid, buildings, houses, ruins, cells, tick } = frame
  const pickedBuilding = ui.selected !== null ? buildings.find((row) => row.entity.id === ui.selected) : undefined
  const view = ui.view
  const overlayKey = `${view}|${Math.floor(tick / 30)}|${ui.selected}|${buildings.length}|${houses.length}`
  if (view === "none") {
    if (scene.overlay.key !== "none") scene.overlay = { key: "none", cells: [] }
    if (scene.tints.size > 0) scene.tints = new Map()
    town.legend = null
  } else if (scene.overlay.key !== overlayKey) {
    const out: Array<OverlayCell> = []
    // The same reading washed over each model, so the view is legible where buildings hide the ground.
    const tints = new Map<number, number>()
    const tintOf = (color: number) => (color === GOOD ? TINT.good : color === FAIR ? TINT.fair : color === BAD ? TINT.bad : color === COOL ? TINT.cool : TINT.plain)
    const standing = <T extends { readonly data: { readonly site: { readonly present: boolean }; readonly rising: { readonly present: boolean } } }>(rows: ReadonlyArray<T>) =>
      rows.filter(({ data }) => !data.site.present && !data.rising.present)
    if (view === "appeal") {
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++) {
          const use = useAt(grid, x, y)
          if (use === "void" || use === "water") continue
          out.push({ x, y, size: 1, color: appealColor(appealAt(cells, x, y)), alpha: 0.32 })
        }
      for (const { entity, data } of standing(houses)) {
        const t = data.tile.get()
        const d = appealAt(cells, t.x, t.y)
        tints.set(entity.id, d >= home.tiers[2].appeal ? TINT.fine : d >= 0 ? TINT.plain : d > home.squalid ? TINT.fair : TINT.bad)
      }
    } else if (view === "workers") {
      const picked = pickedBuilding && pickedBuilding.data.staff.get().needed > 0 ? pickedBuilding : undefined
      let inReach: ((t: TileLike) => boolean) | null = null
      if (picked) {
        const roads = reach(grid, doors(grid, picked.data.tile.get()))
        for (let k = 0; k < roads.distance.length; k++) {
          const d = roads.distance[k]!
          if (d >= 0 && d <= COMMUTE) out.push({ x: k % GRID, y: Math.floor(k / GRID), size: 1, color: MARK, alpha: 0.14 })
        }
        inReach = (t) => doors(grid, t).some((c) => {
          const n = roads.distance[key(c.x, c.y)]!
          return n >= 0 && n <= COMMUTE
        })
      }
      for (const { entity, data } of standing(houses)) {
        const t = data.tile.get()
        const h = data.house.get()
        const ring = inReach !== null && inReach(t)
        out.push({ ...t, color: h.tier === 1 ? 0xd6b48a : COOL, alpha: ring ? 0.75 : 0.45, ...(ring ? { ring: true } : {}) })
        tints.set(entity.id, h.tier === 1 ? TINT.settlers : TINT.cool)
      }
      for (const { entity, data } of standing(buildings)) {
        const s = data.staff.get()
        if (s.needed === 0) continue
        const color = s.assigned >= s.needed ? GOOD : s.assigned > 0 ? FAIR : BAD
        out.push({ ...data.tile.get(), color, alpha: 0.45, ...(entity.id === picked?.entity.id ? { ring: true } : {}) })
        tints.set(entity.id, tintOf(color))
      }
    } else if (view === "fire" || view === "health" || view === "order") {
      for (const { entity, data } of standing(houses)) {
        const r = data.risk.value()
        if (!r) continue
        const struck = view === "fire" ? data.burning.present : view === "health" ? data.sick.present : r.thefts > 0
        const color = struck ? BAD : meterColor(r[view], RISK_MAX, risk.warn)
        out.push({ ...data.tile.get(), color, alpha: struck ? 0.8 : 0.5 })
        tints.set(entity.id, tintOf(color))
      }
      for (const { entity, data } of standing(buildings)) {
        const service = data.service.value()?.service
        const r = data.risk.value()
        if (service === view) {
          out.push({ ...data.tile.get(), color: MARK, alpha: 0.55, ring: true })
          tints.set(entity.id, TINT.mark)
        } else if (view === "fire" && r) {
          const color = data.burning.present ? BAD : meterColor(r.fire, RISK_MAX, risk.warn)
          out.push({ ...data.tile.get(), color, alpha: 0.4 })
          tints.set(entity.id, tintOf(color))
        }
      }
    } else if (view === "condition") {
      for (const row of [...standing(houses), ...standing(buildings)]) {
        const c = row.data.condition.value()
        if (!c) continue
        const color = c.value < wear.worn ? BAD : c.value < wear.mend ? FAIR : GOOD
        out.push({ ...row.data.tile.get(), color, alpha: 0.5 })
        tints.set(row.entity.id, tintOf(color))
      }
      for (const { entity, data } of standing(buildings)) if (data.service.value()?.service === "repair") {
        out.push({ ...data.tile.get(), color: MARK, alpha: 0.55, ring: true })
        tints.set(entity.id, TINT.mark)
      }
      for (const { data } of ruins) out.push({ ...data.tile.get(), color: BAD, alpha: 0.8 })
    }
    scene.overlay = { key: overlayKey, cells: out }
    scene.tints = tints
    town.legend = legends[view]
  }
}
