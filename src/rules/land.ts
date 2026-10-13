import { DIRS, useAt } from "../grid.ts"
import type { GridValue } from "../schema.ts"
import type { Point } from "../iso.ts"

/** Keep unsuccessful candidates: the game picks first and checks fertility afterward. */
export const wildTreeSpots = (grid: GridValue, parent: Point): ReadonlyArray<Point> =>
  DIRS.map((d) => ({ x: parent.x + d.x, y: parent.y + d.y })).filter((c) => useAt(grid, c.x, c.y) === "empty")
export const canSeedTree = (grid: GridValue, spot: Point) =>
  DIRS.filter((d) => useAt(grid, spot.x + d.x, spot.y + d.y) === "tree").length >= 2
