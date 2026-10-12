/**
 * The grid as the town uses it: what stands on each cell, where a tile meets
 * the road, the land around a building, and the paths walkers take. Plain
 * functions over a `GridValue` (see `schema.ts`), rebuilt from the tiles
 * each step.
 */
import { GRID, inside, type Point } from "./iso.ts"
import type { GridValue, Use } from "./schema.ts"

export const key = (x: number, y: number): number => y * GRID + x
export const cellOf = (k: number): Point => ({ x: k % GRID, y: Math.floor(k / GRID) })

/** +x, +y, -x, -y: the order every search tries neighbours in, so paths are deterministic. */
export const DIRS: ReadonlyArray<Point> = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]

export interface TileLike {
  readonly x: number
  readonly y: number
  readonly size: number
}

export type { Use }

/** A grid being filled in: tiles are claimed one by one, and placement checks see the claims so far. */
export class GridBuilder {
  readonly owner: Array<number> = new Array(GRID * GRID).fill(0)
  readonly use: Array<Use> = new Array(GRID * GRID).fill("empty")

  claim(tile: TileLike, id: number, use: Use) {
    for (const c of cellsOf(tile)) {
      const k = key(c.x, c.y)
      this.owner[k] = id
      this.use[k] = use
    }
  }

  free(tile: TileLike) {
    for (const c of cellsOf(tile)) {
      const k = key(c.x, c.y)
      this.owner[k] = 0
      this.use[k] = "empty"
    }
  }

  value(): GridValue {
    return { owner: this.owner, use: this.use }
  }
}

export const cellsOf = (tile: TileLike): Array<Point> => {
  const out: Array<Point> = []
  for (let dy = 0; dy < tile.size; dy++) for (let dx = 0; dx < tile.size; dx++) out.push({ x: tile.x + dx, y: tile.y + dy })
  return out
}

export const useAt = (grid: GridValue, x: number, y: number): Use => (inside(x, y) ? grid.use[key(x, y)]! : "water")
export const ownerAt = (grid: GridValue, x: number, y: number): number => (inside(x, y) ? grid.owner[key(x, y)]! : 0)
export const isRoad = (grid: GridValue, x: number, y: number): boolean => inside(x, y) && grid.use[key(x, y)] === "road"

/** Every cell of a tile is on the map and empty, or (when building) only trees, which are felled. */
export const canPlace = (grid: GridValue, tile: TileLike): boolean =>
  cellsOf(tile).every((c) => inside(c.x, c.y) && (grid.use[key(c.x, c.y)] === "empty" || grid.use[key(c.x, c.y)] === "tree"))

/** The cells around a tile, out to `radius`, nearest rings first. */
export const around = (tile: TileLike, radius: number): Array<Point> => {
  const out: Array<Point> = []
  for (let r = 1; r <= radius; r++) {
    for (let y = tile.y - r; y < tile.y + tile.size + r; y++) {
      for (let x = tile.x - r; x < tile.x + tile.size + r; x++) {
        const ring = Math.max(tile.x - x, x - (tile.x + tile.size - 1), tile.y - y, y - (tile.y + tile.size - 1))
        if (ring === r && inside(x, y)) out.push({ x, y })
      }
    }
  }
  return out
}

/** Which side of a tile an entrance is on: +x (0), +y (1), -x (2), -y (3). */
export interface Entrance extends Point {
  readonly side: 0 | 1 | 2 | 3
}

/**
 * Where a tile meets the road: the cells just outside the middle of each
 * side (the middle two, on an even side). A building's door stands centred
 * on a side a road meets there.
 */
export const entrances = (tile: TileLike): ReadonlyArray<Entrance> => {
  const lo = Math.floor((tile.size - 1) / 2)
  const hi = Math.ceil((tile.size - 1) / 2)
  const out: Array<Entrance> = []
  for (let o = lo; o <= hi; o++) {
    out.push(
      { x: tile.x + tile.size, y: tile.y + o, side: 0 },
      { x: tile.x + o, y: tile.y + tile.size, side: 1 },
      { x: tile.x - 1, y: tile.y + o, side: 2 },
      { x: tile.x + o, y: tile.y - 1, side: 3 }
    )
  }
  return out
}

/** The entrances with a road on them. */
export const doors = (grid: GridValue, tile: TileLike): ReadonlyArray<Entrance> =>
  entrances(tile).filter((c) => isRoad(grid, c.x, c.y))

/** Distances along the road from a set of road cells, and the way back to them. */
export interface Reach {
  readonly distance: Int32Array
  readonly previous: Int32Array
}

export const reach = (grid: GridValue, from: ReadonlyArray<Point>): Reach => {
  const distance = new Int32Array(GRID * GRID).fill(-1)
  const previous = new Int32Array(GRID * GRID).fill(-1)
  const queue: Array<number> = []
  for (const c of from) {
    if (!isRoad(grid, c.x, c.y)) continue
    const k = key(c.x, c.y)
    if (distance[k] !== -1) continue
    distance[k] = 0
    queue.push(k)
  }
  for (let head = 0; head < queue.length; head++) {
    const k = queue[head]!
    const c = cellOf(k)
    for (const d of DIRS) {
      const nx = c.x + d.x
      const ny = c.y + d.y
      if (!isRoad(grid, nx, ny)) continue
      const n = key(nx, ny)
      if (distance[n] !== -1) continue
      distance[n] = distance[k]! + 1
      previous[n] = k
      queue.push(n)
    }
  }
  return { distance, previous }
}

/** The nearest of `to` that `reach` got to, and how far it is. */
export const nearest = (r: Reach, to: ReadonlyArray<Point>): { readonly cell: Point; readonly distance: number } | null => {
  let best: { cell: Point; distance: number } | null = null
  for (const c of to) {
    const d = r.distance[key(c.x, c.y)]!
    if (d >= 0 && (best === null || d < best.distance)) best = { cell: { x: c.x, y: c.y }, distance: d }
  }
  return best
}

/** The road cells from where `reach` started to `to`, both ends included. */
export const pathTo = (r: Reach, to: Point): Array<Point> => {
  const path: Array<Point> = []
  for (let k = key(to.x, to.y); k !== -1; k = r.previous[k]!) path.push(cellOf(k))
  return path.reverse()
}

/** A straight run, or an L along the longer side first, from `a` to `b`. */
export const lPath = (a: Point, b: Point): Array<Point> => {
  const out: Array<Point> = []
  const corner = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y }
  const walk = (from: Point, to: Point) => {
    const dx = Math.sign(to.x - from.x)
    const dy = Math.sign(to.y - from.y)
    let x = from.x
    let y = from.y
    while (x !== to.x || y !== to.y) {
      out.push({ x, y })
      x += dx
      y += dy
    }
  }
  walk(a, corner)
  walk(corner, b)
  out.push(b)
  return out
}
