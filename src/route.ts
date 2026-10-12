/**
 * Belt routing on the grid: the cheapest path of cells between two
 * factories, going straight where it can. Belts may cross other belts at a
 * right angle, never run along one, and turn only on a free cell.
 */
import { FOOTPRINT, GRID, inside, type Point } from "./iso.ts"

/** +x, +y, -x, -y. */
export type Dir = 0 | 1 | 2 | 3
const DX = [1, 0, -1, 0] as const
const DY = [0, 1, 0, -1] as const
const opposite = (dir: Dir): Dir => ((dir + 2) % 4) as Dir
const axisOf = (dir: Dir): "h" | "v" => (dir % 2 === 0 ? "h" : "v")

/** What the belts already on a cell use of it. */
export interface Usage {
  h: boolean
  v: boolean
  turn: boolean
}

/** A factory's footprint (see `FOOTPRINT`), by its top cell. */
export interface Footprint {
  readonly x: number
  readonly y: number
}

export interface Yard {
  /** A factory stands on the cell. */
  readonly blocked: (x: number, y: number) => boolean
  readonly usage: (x: number, y: number) => Usage | undefined
}

export interface Route {
  /** The cells the belt covers, in order. */
  readonly cells: ReadonlyArray<Point>
  /** How the belt uses each cell (see `Usage`). */
  readonly uses: ReadonlyArray<"h" | "v" | "turn">
  /** The belt's centre line: from the source's wall, through each turn, to the target's wall. */
  readonly points: ReadonlyArray<Point>
}

export const key = (x: number, y: number): number => y * GRID + x

/**
 * A factory's ports: the cell just outside the middle of each side, with the
 * direction pointing away from it. A belt meets the wall there, on its door.
 */
export const sideCells = (fp: Footprint): ReadonlyArray<{ readonly x: number; readonly y: number; readonly dir: Dir }> => {
  const mid = (FOOTPRINT - 1) / 2
  return [
    { x: fp.x + FOOTPRINT, y: fp.y + mid, dir: 0 },
    { x: fp.x + mid, y: fp.y + FOOTPRINT, dir: 1 },
    { x: fp.x - 1, y: fp.y + mid, dir: 2 },
    { x: fp.x + mid, y: fp.y - 1, dir: 3 }
  ]
}

const STEP = 1
const TURN = 1.6
const CROSS = 2.5

/** Whether a belt may enter a cell going `into` and leave it going `out`. */
const fits = (yard: Yard, x: number, y: number, into: Dir, out: Dir): boolean => {
  const usage = yard.usage(x, y)
  if (usage === undefined) return true
  if (into !== out) return false
  return !usage.turn && !usage[axisOf(into)]
}

/** A binary heap of state indices by cost. */
class Heap {
  private readonly items: Array<{ cost: number; state: number }> = []
  get size() {
    return this.items.length
  }
  push(cost: number, state: number) {
    const items = this.items
    items.push({ cost, state })
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (items[parent]!.cost <= items[i]!.cost) break
      ;[items[parent], items[i]] = [items[i]!, items[parent]!]
      i = parent
    }
  }
  pop() {
    const items = this.items
    const top = items[0]!
    const last = items.pop()!
    if (items.length > 0) {
      items[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < items.length && items[l]!.cost < items[m]!.cost) m = l
        if (r < items.length && items[r]!.cost < items[m]!.cost) m = r
        if (m === i) break
        ;[items[m], items[i]] = [items[i]!, items[m]!]
        i = m
      }
    }
    return top
  }
}

/**
 * The cheapest belt from `from`'s walls to `to`'s walls, or to the free cell
 * `to` (a belt being dragged), or `null` when there is none.
 */
export const route = (yard: Yard, from: Footprint, to: Footprint | { readonly cell: Point }): Route | null => {
  const states = GRID * GRID * 4
  const GOAL = states
  const cost = new Float64Array(states + 1).fill(Infinity)
  const previous = new Int32Array(states + 1).fill(-1)
  const heap = new Heap()
  const stateOf = (x: number, y: number, dir: Dir) => key(x, y) * 4 + dir

  const free = (x: number, y: number) => inside(x, y) && !yard.blocked(x, y)

  // Where the belt may end: a cell beside the target and the direction into it.
  const goals = new Map<number, Dir>()
  if ("cell" in to) {
    if (!free(to.cell.x, to.cell.y)) return null
  } else {
    for (const side of sideCells(to)) if (free(side.x, side.y)) goals.set(key(side.x, side.y), opposite(side.dir))
  }
  const isGoal = (x: number, y: number) => ("cell" in to ? x === to.cell.x && y === to.cell.y : goals.has(key(x, y)))

  for (const side of sideCells(from)) {
    if (!free(side.x, side.y)) continue
    const state = stateOf(side.x, side.y, side.dir)
    cost[state] = 0
    heap.push(0, state)
  }

  while (heap.size > 0) {
    const { cost: at, state } = heap.pop()
    if (state === GOAL) break
    if (at > cost[state]!) continue
    const into = (state % 4) as Dir
    const cell = Math.floor(state / 4)
    const x = cell % GRID
    const y = Math.floor(cell / GRID)

    if (isGoal(x, y)) {
      const out = "cell" in to ? into : goals.get(key(x, y))!
      if (fits(yard, x, y, into, out)) {
        const total = at + (out === into ? 0 : TURN)
        if (total < cost[GOAL]!) {
          cost[GOAL] = total
          previous[GOAL] = state
          heap.push(total, GOAL)
        }
      }
    }

    for (const out of [0, 1, 2, 3] as const) {
      if (out === opposite(into)) continue
      if (!fits(yard, x, y, into, out)) continue
      const nx = x + DX[out]
      const ny = y + DY[out]
      if (!free(nx, ny)) continue
      const next = stateOf(nx, ny, out)
      const total = at + STEP + (out === into ? 0 : TURN) + (yard.usage(nx, ny) ? CROSS : 0)
      if (total < cost[next]!) {
        cost[next] = total
        previous[next] = state
        heap.push(total, next)
      }
    }
  }

  if (previous[GOAL] === -1) return null

  // Walk back from the goal: cells and the direction each was entered by.
  const trail: Array<{ x: number; y: number; dir: Dir }> = []
  for (let state = previous[GOAL]!; state !== -1; state = previous[state]!) {
    const cell = Math.floor(state / 4)
    trail.push({ x: cell % GRID, y: Math.floor(cell / GRID), dir: (state % 4) as Dir })
  }
  trail.reverse()
  const last = trail[trail.length - 1]!
  const exit: Dir = "cell" in to ? last.dir : goals.get(key(last.x, last.y))!

  const cells = trail.map(({ x, y }) => ({ x, y }))
  const uses = trail.map((step, i) => {
    const out = i + 1 < trail.length ? trail[i + 1]!.dir : exit
    return step.dir === out ? axisOf(out) : ("turn" as const)
  })

  const first = trail[0]!
  const points: Array<Point> = [{ x: first.x + 0.5 - DX[first.dir] * 0.5, y: first.y + 0.5 - DY[first.dir] * 0.5 }]
  trail.forEach((step, i) => {
    if (uses[i] === "turn") points.push({ x: step.x + 0.5, y: step.y + 0.5 })
  })
  points.push(
    "cell" in to
      ? { x: last.x + 0.5, y: last.y + 0.5 }
      : { x: last.x + 0.5 + DX[exit] * 0.5, y: last.y + 0.5 + DY[exit] * 0.5 }
  )
  return { cells, uses, points }
}

/** A polyline's length and the point at a distance along it. */
export const lengthOf = (points: ReadonlyArray<Point>): number => {
  let total = 0
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
  return total
}

export const pointAt = (points: ReadonlyArray<Point>, distance: number): Point => {
  let left = distance
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    if (left <= span || i === points.length - 1) {
      const t = span === 0 ? 0 : Math.min(1, Math.max(0, left / span))
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    left -= span
  }
  return points[0] ?? { x: 0, y: 0 }
}
