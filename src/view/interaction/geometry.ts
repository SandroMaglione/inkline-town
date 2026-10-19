/** Cells under the pointer, footprints around it, and the cells a drag covers. */
import type { Point } from "../../game/world/iso.ts"

export const cellAt = (at: Point): Point => {
  return { x: Math.floor(at.x), y: Math.floor(at.y) }
}

/** The footprint `size` cells a side centred on a point, by its top cell. */
export const footprintAt = (at: Point, size: number): Point => {
  return { x: Math.floor(at.x - (size - 1) / 2), y: Math.floor(at.y - (size - 1) / 2) }
}

/** Every cell between two corners, both included. */
export const rectangle = (a: Point, b: Point): Array<Point> => {
  const out: Array<Point> = []
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y })
  return out
}
