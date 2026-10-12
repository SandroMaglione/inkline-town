/**
 * The isometric grid, and the one measure everything is drawn in.
 *
 * A cell is 1×1 in grid space and a 64×32 px diamond on screen: grid x runs
 * down-right, grid y down-left, z straight up (in pixels). Every length on
 * the floor is a whole number of units `U` (a sixteenth of a cell), so every
 * corner lands on a whole pixel: one unit along x is exactly (2, 1) px.
 * Heights are whole pixels.
 */
export const TILE_W = 64
export const TILE_H = 32
/** A sixteenth of a cell: the smallest length anything on the floor is measured in. */
export const U = 1 / 16
/** Cells along each side of the yard. */
export const GRID = 32
/** A factory stands on 3×3 cells; belts meet it at the middle cell of a side. */
export const FOOTPRINT = 3

export interface Point {
  readonly x: number
  readonly y: number
}

/** Grid point (and height in pixels) to world pixels. */
export const toScreen = (x: number, y: number, z = 0): Point => ({
  x: (x - y) * (TILE_W / 2),
  y: (x + y) * (TILE_H / 2) - z
})

/** World pixels (on the floor) to a grid point. */
export const toGrid = (sx: number, sy: number): Point => ({
  x: (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2,
  y: (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2
})

/** Flattens points to Pixi's `[x0, y0, x1, y1, …]`. */
export const flat = (points: ReadonlyArray<Point>): Array<number> => points.flatMap((p) => [p.x, p.y])

export const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < GRID && y < GRID
