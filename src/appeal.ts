/**
 * Desirability: how pleasant each cell is to live on. Buildings and the land
 * add to it or take from it, fading with distance (see `Kind.appeal` and
 * `appeal` in content): industry pushes homes away, parks, fountains, and a
 * chapel draw them in. Buildings' effects add up; water and woods count
 * once however many are near, and so do paved streets. Plain functions,
 * shared by the simulation (which keeps the whole grid, see `Appraise`) and
 * the page (which explains one cell).
 */
import { appeal, kinds, type KindId } from "./content.ts"
import { key } from "./grid.ts"
import { GRID } from "./iso.ts"

/** Something that makes the cells around it nicer or worse to live on. */
export interface AppealSource {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly value: number
  readonly reach: number
  /** What it is, for the readout: "park", "smithy", "water". */
  readonly label: string
  /** `sum`: adds up with others; `nature` and `paved`: only the strongest of their kind counts. */
  readonly mode: "sum" | "nature" | "paved"
}

/** How far a cell is from a footprint, in rings: 0 on it, 1 beside it. */
export const ringOf = (s: { readonly x: number; readonly y: number; readonly size: number }, x: number, y: number) =>
  Math.max(0, s.x - x, x - (s.x + s.size - 1), s.y - y, y - (s.y + s.size - 1))

/** What a source does at `ring` cells from its footprint: all of it beside it, fading to a little at its reach. */
export const effectAt = (source: { readonly value: number; readonly reach: number }, ring: number): number => {
  if (ring > source.reach) return 0
  return Math.trunc((source.value * (source.reach - Math.max(1, ring) + 1)) / source.reach)
}

/** A building of a kind as a source, if it has any effect. */
export const buildingSource = (kind: KindId, tile: { readonly x: number; readonly y: number; readonly size: number }): AppealSource | null => {
  const a = kinds[kind].appeal
  return a ? { ...tile, value: a.value, reach: a.reach, label: kinds[kind].title.toLowerCase(), mode: "sum" } : null
}

export const landSource = (what: "water" | "forest" | "paved" | "ruin" | "worn", cell: { readonly x: number; readonly y: number; readonly size?: number }): AppealSource => ({
  x: cell.x,
  y: cell.y,
  size: cell.size ?? 1,
  ...appeal[what],
  label: what === "forest" ? "woods" : what === "paved" ? "paved street" : what === "worn" ? "a run-down home" : what,
  mode: what === "water" || what === "forest" ? "nature" : what === "paved" ? "paved" : "sum"
})

const clamp = (n: number) => Math.max(appeal.floor, Math.min(appeal.ceiling, n))

/** Every cell's desirability, by `key`. */
export const appealGrid = (sources: ReadonlyArray<AppealSource>): Array<number> => {
  const sum = new Int32Array(GRID * GRID)
  const nature = new Int32Array(GRID * GRID)
  const paved = new Int32Array(GRID * GRID)
  for (const s of sources) {
    const into = s.mode === "sum" ? sum : s.mode === "nature" ? nature : paved
    for (let y = Math.max(0, s.y - s.reach); y < Math.min(GRID, s.y + s.size + s.reach); y++) {
      for (let x = Math.max(0, s.x - s.reach); x < Math.min(GRID, s.x + s.size + s.reach); x++) {
        const e = effectAt(s, ringOf(s, x, y))
        if (e === 0) continue
        const k = key(x, y)
        if (s.mode === "sum") into[k] = into[k]! + e
        else if (e > 0 ? e > into[k]! : e < into[k]!) into[k] = e
      }
    }
  }
  return Array.from({ length: GRID * GRID }, (_, k) => clamp(sum[k]! + nature[k]! + paved[k]!))
}

/** One cell's desirability and what makes it, strongest first: "park +6", "bakery −4". */
export const appealParts = (sources: ReadonlyArray<AppealSource>, cell: { readonly x: number; readonly y: number }) => {
  const parts = new Map<string, number>()
  const best = { nature: { label: "", value: 0 }, paved: { label: "", value: 0 } }
  for (const s of sources) {
    const e = effectAt(s, ringOf(s, cell.x, cell.y))
    if (e === 0) continue
    if (s.mode === "sum") parts.set(s.label, (parts.get(s.label) ?? 0) + e)
    else if (Math.abs(e) > Math.abs(best[s.mode].value)) best[s.mode] = { label: s.label, value: e }
  }
  for (const b of [best.nature, best.paved]) if (b.value !== 0) parts.set(b.label, (parts.get(b.label) ?? 0) + b.value)
  const list = [...parts].map(([label, value]) => ({ label, value })).filter((p) => p.value !== 0)
  list.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  return { value: clamp(list.reduce((n, p) => n + p.value, 0)), parts: list }
}

/** A cell's desirability from a reckoned grid (0 before the first reckoning). */
export const appealAt = (cells: ReadonlyArray<number>, x: number, y: number): number => cells[key(x, y)] ?? 0
