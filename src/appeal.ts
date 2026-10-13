/**
 * Desirability: how pleasant each cell is to live on. Buildings and the land
 * add to it or take from it, fading with distance (see `Kind.appeal` and
 * `appeal` in content): industry pushes homes away, parks and a chapel
 * draw them in. A park is its cells of ground taken together (see
 * `parkSources`): its reach is measured from its nearest cell. Buildings' effects add up; water and woods count
 * once however many are near, and so do paved streets. Plain functions,
 * shared by the simulation (which keeps the whole grid, see `Appraise`) and
 * the page (which explains one cell).
 */
import { appeal, grounds, kinds, park, props, type GroundId, type KindId, type PropId } from "./content.ts"
import { cellOf, DIRS, key } from "./grid.ts"
import { GRID, inside, type Point } from "./iso.ts"

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
  /** A park: the cells it covers, inside the square (x, y, size) around them. */
  readonly cells?: ReadonlyArray<Point>
}

/** How far a cell is from a footprint, in rings: 0 on it, 1 beside it. */
export const ringOf = (s: { readonly x: number; readonly y: number; readonly size: number }, x: number, y: number) =>
  Math.max(0, s.x - x, x - (s.x + s.size - 1), s.y - y, y - (s.y + s.size - 1))

/** How far a cell is from a source: from its nearest cell, for a park. */
const ringTo = (s: AppealSource, x: number, y: number) => {
  if (!s.cells) return ringOf(s, x, y)
  let best = Infinity
  for (const c of s.cells) best = Math.min(best, Math.max(Math.abs(c.x - x), Math.abs(c.y - y)))
  return best
}

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
        const e = effectAt(s, ringTo(s, x, y))
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
    const e = effectAt(s, ringTo(s, cell.x, cell.y))
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

// ── Parks ─────────────────────────────────────────────────────────────────

/** A cell of park, as the town knows it. */
export interface ParkCell {
  readonly x: number
  readonly y: number
  readonly ground: GroundId
  readonly prop: PropId | "none"
}

/** A whole park: its cells, its beauty and what makes it, and what it does to the streets around it. */
export interface ParkValue {
  readonly cells: ReadonlyArray<ParkCell>
  readonly beauty: number
  readonly parts: ReadonlyArray<{ readonly label: string; readonly value: number }>
  /** Furnishings past what its size holds, which add nothing. */
  readonly crowded: number
  /** Walks and squares beside a road: its ways in from the street. */
  readonly entrances: number
  readonly value: number
  readonly reach: number
}

const tenth = (n: number) => Math.round(n * 10) / 10

/**
 * One park's worth: its ground (each cell a little, flower beds more, up to
 * `park.groundMost`), and its furnishings, the best first: one for every
 * `park.cellsPerProp` cells counts, and each one of a kind after the first
 * counts `park.repeat` of the one before; and its entrances, each walk or
 * square beside a road (`road`), up to `park.entrances`. A lawn is
 * pleasant; a lawn with walks in from the street, lamps, and a statue is a
 * park.
 */
export const parkValue = (cells: ReadonlyArray<ParkCell>, road: (x: number, y: number) => boolean = () => false): ParkValue => {
  const groundRaw = cells.reduce((n, c) => n + grounds[c.ground].beauty, 0)
  const ground = Math.min(park.groundMost, groundRaw)
  const room = Math.ceil(cells.length / park.cellsPerProp)
  const placed = cells.filter((c) => c.prop !== "none").map((c) => c.prop as PropId)
  // Each furnishing's worth given those of its kind before it; the best count first.
  const seen = new Map<PropId, number>()
  const worths = placed
    .sort((a, b) => props[b].beauty - props[a].beauty)
    .map((p) => {
      const n = seen.get(p) ?? 0
      seen.set(p, n + 1)
      return { prop: p, worth: props[p].beauty * park.repeat ** n }
    })
    .sort((a, b) => b.worth - a.worth)
  const counted = worths.slice(0, room)
  const byKind = new Map<string, number>()
  for (const w of counted) byKind.set(props[w.prop].title.toLowerCase(), (byKind.get(props[w.prop].title.toLowerCase()) ?? 0) + w.worth)
  const entrances = cells.filter((c) => (c.ground === "path" || c.ground === "square") && DIRS.some((d) => road(c.x + d.x, c.y + d.y))).length
  const welcome = Math.min(entrances, park.entrances) * park.entrance
  const beauty = ground + welcome + counted.reduce((n, w) => n + w.worth, 0)
  const parts = [
    { label: groundRaw > ground ? "ground (all it counts for)" : "ground", value: tenth(ground) },
    { label: `way${Math.min(entrances, park.entrances) === 1 ? "" : "s"} in from the street`, value: welcome },
    ...[...byKind].map(([label, value]) => ({ label, value: tenth(value) }))
  ].filter((p) => p.value > 0)
  return {
    cells,
    beauty: tenth(beauty),
    parts,
    crowded: worths.length - counted.length,
    entrances,
    value: Math.min(park.most, Math.round(beauty)),
    reach: Math.min(park.reach[2], park.reach[0] + Math.floor(cells.length / park.reach[1]))
  }
}

/** The town's parks: cells of park that touch (side by side) are one park. */
export const parksOf = (cells: ReadonlyArray<ParkCell>, road?: (x: number, y: number) => boolean): Array<ParkValue> => {
  const at = new Map<number, ParkCell>()
  for (const c of cells) at.set(key(c.x, c.y), c)
  const seen = new Set<number>()
  const out: Array<ParkValue> = []
  for (const start of at.keys()) {
    if (seen.has(start)) continue
    seen.add(start)
    const queue = [start]
    const members: Array<ParkCell> = []
    for (let head = 0; head < queue.length; head++) {
      const k = queue[head]!
      members.push(at.get(k)!)
      const c = cellOf(k)
      for (const d of DIRS) {
        if (!inside(c.x + d.x, c.y + d.y)) continue
        const n = key(c.x + d.x, c.y + d.y)
        if (seen.has(n) || !at.has(n)) continue
        seen.add(n)
        queue.push(n)
      }
    }
    out.push(parkValue(members, road))
  }
  return out
}

/** Each park as a desirability source, measured from its nearest cell. */
export const parkSources = (cells: ReadonlyArray<ParkCell>, road?: (x: number, y: number) => boolean): Array<AppealSource> =>
  parksOf(cells, road)
    .filter((p) => p.value > 0)
    .map((p) => {
      const xs = p.cells.map((c) => c.x)
      const ys = p.cells.map((c) => c.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      const size = Math.max(Math.max(...xs) - x, Math.max(...ys) - y) + 1
      return { x, y, size, value: p.value, reach: p.reach, label: "park", mode: "sum", cells: p.cells }
    })
