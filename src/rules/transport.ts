import { DIRS, isRoad } from "../grid.ts"
import type { GridValue } from "../schema.ts"
import type { Point } from "../iso.ts"

/** Shared candidate enumeration; Random.pick selects uniformly from this list in the runtime. */
export const onwardRoads = (grid: GridValue, cell: Point, previous: Point | null): ReadonlyArray<Point> =>
  DIRS.map((d) => ({ x: cell.x + d.x, y: cell.y + d.y }))
    .filter((c) => isRoad(grid, c.x, c.y) && !(previous && c.x === previous.x && c.y === previous.y))

export interface DeliveryCandidate {
  readonly site: boolean; readonly distance: number; readonly fill?: number
}
/** Construction first; operating shelves with the lowest fill come next, then distance. */
export const preferDelivery = (candidate: DeliveryCandidate, best: DeliveryCandidate | null): boolean =>
  best === null || (candidate.site && !best.site) || (candidate.site === best.site &&
    (candidate.site ? candidate.distance < best.distance :
      (candidate.fill ?? 0) < (best.fill ?? 0) || ((candidate.fill ?? 0) === (best.fill ?? 0) && candidate.distance < best.distance)))
