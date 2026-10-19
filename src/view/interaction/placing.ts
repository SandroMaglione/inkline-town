/** Whether a building may be laid where the pointer is, and why not. */
import type { Kind } from "../../game/content/index.ts"
import { lockReason } from "../../game/schedule.ts"
import { around, canPlace, doors, useAt, type TileLike } from "../../game/world/grid.ts"
import type { Frame } from "../frame.ts"

/**
 * What is wrong with a building where it would stand, before it is laid: no road at the middle of a side (it is
 * not laid: nobody could bring its materials or work there), or nothing in reach to gather (laid, but said).
 */
export const placeProblem = (frame: Frame, kind: Kind, tile: TileLike): { readonly refuse: boolean; readonly text: string } | null => {
  const grid = frame.grid
  if (!canPlace(grid, tile) || lockReason(kind, frame.world.census)) return null
  if (doors(grid, tile).length === 0) return { refuse: true, text: "needs a road at the middle of one side" }
  const source = kind.gathers?.source
  if (!source || source === "field") return null
  const reachCells = around(tile, kind.gathers!.radius)
  const found =
    source === "stone" || source === "ore"
      ? frame.rocks.some(({ data }) => {
          const t = data.tile.get()
          return data.rock.get().ore === (source === "ore") && reachCells.some((c) => c.x >= t.x && c.x < t.x + t.size && c.y >= t.y && c.y < t.y + t.size)
        })
      : reachCells.some((c) => useAt(grid, c.x, c.y) === source)
  const what = { tree: "trees", stone: "pale stone rocks", ore: "dark ore rocks", water: "water" }[source]
  return found ? null : { refuse: false, text: `no ${what} within ${kind.gathers!.radius} cells` }
}
