import { Ops } from "@typeonce/ritmo-math"
import { shippedRules, type Rules } from "./rules/config.ts"
/**
 * Desirability: how pleasant each cell is to live on. Buildings and the land
 * add to it or take from it, fading with distance (see `Kind.appeal` and
 * `appeal` in content): industry pushes homes away, parks and a chapel
 * draw them in. A park is its cells of ground taken together (see
 * `parkSources`): its reach is measured from its nearest cell. Buildings' effects add up; water and woods count
 * once however many are near, and so do paved streets. Fine homes lift the
 * homes beside them (not themselves), up to `appeal.homesMost`. Plain functions,
 * shared by the simulation (which keeps the whole grid, see `Appraise`) and
 * the page (which explains one cell).
 */
import { upgradeAt, type GroundId, type KindId, type PropId } from "./content.ts"
import { cellOf, DIRS, key } from "./grid.ts"
import { GRID, inside, type Point } from "./iso.ts"

/** Something that makes the cells around it nicer or worse to live on. */
export interface AppealSource {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly value: number
  readonly reach: number
  /** Rings it gives its whole value out to before it starts to fade (1 when not given). */
  readonly full?: number
  /** What it is, for the readout: "park", "smithy", "water". */
  readonly label: string
  /**
   * `sum`: adds up with others; `nature` and `paved`: only the strongest of
   * their kind counts; `homes`: adds up, to `appeal.homesMost` at most, and
   * never on the home's own cell; `park`: the finest counts in full, the
   * others `park.others` of theirs.
   */
  readonly mode: "sum" | "nature" | "paved" | "homes" | "park"
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

/**
 * What a source does at `ring` cells from its footprint: all of it out to
 * `full` rings (beside it, when not given), then fading to a little at its
 * reach. A chapel (4, out to 4, full 2) gives 4, 4, 2, 1.
 */
export const effectAt = (source: { readonly value: number; readonly reach: number; readonly full?: number }, ring: number): number => {
  if (ring > source.reach) return 0
  const full = Math.max(1, Math.min(source.reach, source.full ?? 1))
  if (ring <= full) return source.value
  return Math.trunc((source.value * (source.reach - ring + 1)) / (source.reach - full + 1))
}
/** What a source does to a cell at `ring`: a home's lift is for its neighbours, not itself. */
const effectOf = (s: AppealSource, ring: number) => (s.mode === "homes" && ring === 0 ? 0 : effectAt(s, ring))

/** A building of a kind as a source, if it has any effect: an upgraded one's is its upgrade's (see `Kind.upgrade`). */
export const buildingSource = (
  kind: KindId,
  tile: { readonly x: number; readonly y: number; readonly size: number },
  rules: Rules = shippedRules,
  level = 0
): AppealSource | null => {
  const up = upgradeAt(rules.kinds[kind], level)
  const a = up?.appeal ?? rules.kinds[kind].appeal
  const title = up?.title ?? rules.kinds[kind].title
  return a ? { ...tile, value: a.value, reach: a.reach, ...(a.full ? { full: a.full } : {}), label: title.toLowerCase(), mode: "sum" } : null
}

/** A citizens' home or a townhouse lifts the homes beside it; a settlers' cottage does nothing. */
export const homeSource = (tier: 1 | 2 | 3, tile: { readonly x: number; readonly y: number; readonly size?: number }, rules: Rules = shippedRules): AppealSource | null =>
  tier === 1 ? null : { x: tile.x, y: tile.y, size: tile.size ?? 1, ...(tier === 2 ? rules.appeal.citizens : rules.appeal.burghers), label: "fine homes beside it", mode: "homes" }

export const landSource = (what: "water" | "forest" | "paved" | "ruin" | "worn", cell: { readonly x: number; readonly y: number; readonly size?: number }, rules: Rules = shippedRules): AppealSource => ({
  x: cell.x,
  y: cell.y,
  size: cell.size ?? 1,
  ...rules.appeal[what],
  label: what === "forest" ? "woods" : what === "paved" ? "paved street" : what === "worn" ? "a run-down home" : what,
  mode: what === "water" || what === "forest" ? "nature" : what === "paved" ? "paved" : "sum"
})

const clamp = (n: number, rules: Rules) => Math.max(rules.appeal.floor, Math.min(rules.appeal.ceiling, n))

/** Every cell's desirability, by `key`. */
export const appealGrid = (sources: ReadonlyArray<AppealSource>, rules: Rules = shippedRules): Array<number> => {
  const sum = new Int32Array(GRID * GRID)
  const nature = new Int32Array(GRID * GRID)
  const paved = new Int32Array(GRID * GRID)
  const homes = new Int32Array(GRID * GRID)
  const parkBest = new Int32Array(GRID * GRID)
  const parkAll = new Int32Array(GRID * GRID)
  for (const s of sources) {
    if (s.mode === "park") {
      for (let y = Math.max(0, s.y - s.reach); y < Math.min(GRID, s.y + s.size + s.reach); y++)
        for (let x = Math.max(0, s.x - s.reach); x < Math.min(GRID, s.x + s.size + s.reach); x++) {
          const e = effectOf(s, ringTo(s, x, y)), k = key(x, y)
          parkAll[k] = parkAll[k]! + e
          if (e > parkBest[k]!) parkBest[k] = e
        }
      continue
    }
    const into = s.mode === "sum" ? sum : s.mode === "nature" ? nature : s.mode === "paved" ? paved : homes
    for (let y = Math.max(0, s.y - s.reach); y < Math.min(GRID, s.y + s.size + s.reach); y++) {
      for (let x = Math.max(0, s.x - s.reach); x < Math.min(GRID, s.x + s.size + s.reach); x++) {
        const e = effectOf(s, ringTo(s, x, y))
        if (e === 0) continue
        const k = key(x, y)
        if (s.mode === "sum" || s.mode === "homes") into[k] = into[k]! + e
        else if (e > 0 ? e > into[k]! : e < into[k]!) into[k] = e
      }
    }
  }
  const parks = (k: number) => parkBest[k]! + Math.trunc((parkAll[k]! - parkBest[k]!) * rules.park.others)
  return Array.from({ length: GRID * GRID }, (_, k) => clamp(sum[k]! + nature[k]! + paved[k]! + Math.min(rules.appeal.homesMost, homes[k]!) + parks(k), rules))
}

/** One cell's desirability and what makes it, strongest first: "park +6", "bakery −4". */
export const appealParts = (sources: ReadonlyArray<AppealSource>, cell: { readonly x: number; readonly y: number }, rules: Rules = shippedRules) => {
  const parts = new Map<string, number>()
  const best = { nature: { label: "", value: 0 }, paved: { label: "", value: 0 } }
  let homes = { label: "", value: 0 }
  const parks: Array<number> = []
  for (const s of sources) {
    const e = effectOf(s, ringTo(s, cell.x, cell.y))
    if (e === 0) continue
    if (s.mode === "park") parks.push(e)
    else if (s.mode === "sum") parts.set(s.label, (parts.get(s.label) ?? 0) + e)
    else if (s.mode === "homes") homes = { label: s.label, value: Math.min(rules.appeal.homesMost, homes.value + e) }
    else if (Math.abs(e) > Math.abs(best[s.mode].value)) best[s.mode] = { label: s.label, value: e }
  }
  for (const b of [best.nature, best.paved, homes]) if (b.value !== 0) parts.set(b.label, (parts.get(b.label) ?? 0) + b.value)
  if (parks.length > 0) {
    const finest = Math.max(...parks), all = parks.reduce((n, e) => n + e, 0)
    parts.set("park", (parts.get("park") ?? 0) + finest + Math.trunc((all - finest) * rules.park.others))
  }
  const list = [...parts].map(([label, value]) => ({ label, value })).filter((p) => p.value !== 0)
  list.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  return { value: clamp(list.reduce((n, p) => n + p.value, 0), rules), parts: list }
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
 * `park.cellsPerProp` whole cells counts, and each one of a kind after the first
 * counts `park.repeat` of the one before; and its entrances, each walk or
 * square beside a road (`road`), up to `park.entrances`. A lawn is
 * pleasant; a lawn with walks in from the street, lamps, and a statue is a
 * park.
 */
export const parkValue = (cells: ReadonlyArray<ParkCell>, road: (x: number, y: number) => boolean = () => false, rules: Rules = shippedRules): ParkValue => {
  const { grounds, props, park } = rules
  const groundRaw = cells.reduce((n, c) => n + grounds[c.ground].beauty, 0)
  const ground = Math.min(park.groundMost, groundRaw)
  const room = Math.floor(cells.length / park.cellsPerProp)
  const placed = cells.filter((c) => c.prop !== "none").map((c) => c.prop as PropId)
  // Each furnishing's worth given those of its kind before it; the best count first.
  const seen = new Map<PropId, number>()
  const worths = placed
    .sort((a, b) => props[b].beauty - props[a].beauty)
    .map((p) => {
      const n = seen.get(p) ?? 0
      seen.set(p, n + 1)
      return { prop: p, worth: props[p].beauty * Ops.pow(park.repeat, n) }
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
export const parksOf = (cells: ReadonlyArray<ParkCell>, road?: (x: number, y: number) => boolean, rules: Rules = shippedRules): Array<ParkValue> => {
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
    out.push(parkValue(members, road, rules))
  }
  return out
}

/** Each park as a desirability source, measured from its nearest cell. */
export const parkSources = (cells: ReadonlyArray<ParkCell>, road?: (x: number, y: number) => boolean, rules: Rules = shippedRules): Array<AppealSource> =>
  parksOf(cells, road, rules)
    .filter((p) => p.value > 0)
    .map((p) => {
      const xs = p.cells.map((c) => c.x)
      const ys = p.cells.map((c) => c.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      const size = Math.max(Math.max(...xs) - x, Math.max(...ys) - y) + 1
      // A bigger park gives its whole worth further out: half its reach, rounded down.
      return { x, y, size, value: p.value, reach: p.reach, full: Math.max(1, Math.floor(p.reach / 2)), label: "park", mode: "park", cells: p.cells }
    })

/** Per-minute upkeep paid for a park cell, including its furnishing. */
export const parkUpkeep = (cell: Pick<ParkCell, "ground" | "prop">, rules: Rules = shippedRules) =>
  rules.grounds[cell.ground].upkeep + (cell.prop === "none" ? 0 : rules.props[cell.prop].upkeep)
