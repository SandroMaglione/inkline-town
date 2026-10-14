/**
 * Rocks are one per cell in the simulation, but a deposit reads better as a
 * few big outcrops than as a grid of pebbles. This joins neighbouring rocks
 * of the same kind into blocks of 3×3, 2×2, 2×1 or 1×2, drawn once by the
 * block's first cell; the others draw nothing. It only changes the picture:
 * a quarry still cuts, and a rock still runs out, one cell at a time.
 */
import { hash } from "../asset-lab/land.ts"

export interface RockCell {
  readonly id: number
  readonly x: number
  readonly y: number
  readonly ore: boolean
}

/** A cell's part in a block: it draws `w` × `h` cells from it, or (`lead` the cell that does) nothing. */
export type RockPart = { readonly draws: true; readonly w: number; readonly h: number; readonly members: ReadonlyArray<number> } | { readonly draws: false; readonly lead: number }

/** Which sizes to try at a cell, biggest first; some cells skip the bigger ones, so a deposit mixes sizes. */
const sizesAt = (x: number, y: number): ReadonlyArray<readonly [number, number]> => {
  const roll = hash(x * 13 + 5, y * 7 + 11)
  const two: ReadonlyArray<readonly [number, number]> = roll < 0.5 ? [[2, 1], [1, 2]] : [[1, 2], [2, 1]]
  if (roll < 0.45) return [[3, 3], [2, 2], ...two]
  if (roll < 0.8) return [[2, 2], ...two]
  if (roll < 0.95) return two
  return []
}

export const rockBlocks = (cells: ReadonlyArray<RockCell>): Map<number, RockPart> => {
  const at = new Map<string, RockCell>()
  for (const c of cells) at.set(`${c.x},${c.y}`, c)
  const taken = new Set<number>()
  const parts = new Map<number, RockPart>()
  const sorted = [...cells].sort((a, b) => a.y - b.y || a.x - b.x)
  for (const c of sorted) {
    if (taken.has(c.id)) continue
    let block: Array<RockCell> = [c]
    let size: readonly [number, number] = [1, 1]
    for (const [w, h] of sizesAt(c.x, c.y)) {
      const found: Array<RockCell> = []
      for (let dy = 0; dy < h; dy++)
        for (let dx = 0; dx < w; dx++) {
          const n = at.get(`${c.x + dx},${c.y + dy}`)
          if (n && n.ore === c.ore && !taken.has(n.id)) found.push(n)
        }
      if (found.length === w * h) {
        block = found
        size = [w, h]
        break
      }
    }
    for (const n of block) {
      taken.add(n.id)
      parts.set(n.id, n === c ? { draws: true, w: size[0], h: size[1], members: block.map((m) => m.id) } : { draws: false, lead: c.id })
    }
  }
  return parts
}
