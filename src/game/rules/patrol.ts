import { around, doors, isRoad, key, nearest, pathTo, reach, roadPrint, type TileLike } from "../world/grid.ts"
import type { GridValue } from "../schema.ts"
import type { Point } from "../world/iso.ts"

export interface PatrolTarget { readonly id: number; readonly tile: TileLike }
export interface PatrolPlan {
  readonly tours: ReadonlyArray<ReadonlyArray<Point>>
  readonly unreachable: ReadonlyArray<number>
}

/** Every edge cell can serve a building, matching the runtime's adjacent-cell check. */
export const serviceDoors = (grid: GridValue, tile: TileLike) => around(tile, 1).filter(p =>
  isRoad(grid, p.x, p.y) && ((p.x >= tile.x && p.x < tile.x + tile.size) || (p.y >= tile.y && p.y < tile.y + tile.size)))

const cache = new Map<string, PatrolPlan>()
/** Bounded outbound tours, rotated on each dispatch. Return distance still occupies a walker. */
export const planPatrols = (grid: GridValue, source: TileLike, range: number, targets: ReadonlyArray<PatrolTarget>): PatrolPlan => {
  const fingerprint = grid.roads ?? roadPrint(grid)
  const id = JSON.stringify([fingerprint, source, range, targets])
  const known = cache.get(id)
  if (known) return known
  const starts = doors(grid, source)
  if (starts.length === 0 || range < 1) return { tours: [], unreachable: targets.map(t => t.id) }
  const start: Point = { x: starts[0]!.x, y: starts[0]!.y }
  const local = { ...grid, roads: fingerprint }, from = reach(local, [start])
  const at = targets.map(t => ({ ...t, doors: serviceDoors(local, t.tile) }))
  const remaining = at.filter(t => { const n = nearest(from, t.doors); return n !== null && n.distance < range })
  const unreachable = at.filter(t => !remaining.includes(t)).map(t => t.id)
  const tours: Point[][] = []
  while (remaining.length > 0) {
    const tour: Point[] = [start]
    for (;;) {
      const way = reach(local, [tour.at(-1)!])
      let best: { index: number; path: Point[]; distance: number } | null = null
      for (const [index, target] of remaining.entries()) {
        const found = nearest(way, target.doors)
        if (!found || tour.length + found.distance > range) continue
        if (!best || found.distance < best.distance || (found.distance === best.distance && target.id < remaining[best.index]!.id))
          best = { index, path: pathTo(way, found.cell), distance: found.distance }
      }
      if (!best) break
      tour.push(...best.path.slice(1))
      // Every target beside any cell on this tour is already covered.
      const visited = new Set(tour.map(p => key(p.x, p.y)))
      for (let i = remaining.length - 1; i >= 0; i--)
        if (remaining[i]!.doors.some(p => visited.has(key(p.x, p.y)))) remaining.splice(i, 1)
    }
    tours.push(tour)
  }
  const result = { tours, unreachable }
  if (cache.size >= 256) cache.clear()
  cache.set(id, result)
  return result
}
