/** Whether a building may be laid where the pointer is, and why not. */
import type { Kind } from "../../game/content/index.ts"
import { lockReason } from "../../game/schedule.ts"
import { around, canPlace, doors, useAt, type TileLike } from "../../game/world/grid.ts"
import type { Frame } from "../frame.ts"

/**
 * What is wrong with a building where it would stand, before it is laid: no road at the middle of a side (`noRoad`:
 * it is not laid, as nobody could bring its materials or work there), or nothing in reach to gather (`nothingNear`:
 * laid, but said). Data: the page's language says it (`view.place` in `i18n`).
 */
export type PlaceProblem =
  | { readonly _tag: "noRoad" }
  | { readonly _tag: "nothingNear"; readonly source: "tree" | "stone" | "ore" | "water"; readonly radius: number }

/** Whether a problem keeps the building from being laid at all. */
export const refuses = (problem: PlaceProblem | null): boolean => problem?._tag === "noRoad"

export const placeProblem = (frame: Frame, kind: Kind, tile: TileLike): PlaceProblem | null => {
  const grid = frame.grid
  if (!canPlace(grid, tile) || lockReason(kind, frame.world.census)) return null
  if (doors(grid, tile).length === 0) return { _tag: "noRoad" }
  const source = kind.gathers?.source
  if (!source || source === "field") return null
  const reachCells = around(tile, kind.gathers!.radius)
  const found =
    source === "stone" || source === "ore"
      ? frame.rocks.some(({ data }) => {
          const t = data.tile
          return data.rock.ore === (source === "ore") && reachCells.some((c) => c.x >= t.x && c.x < t.x + t.size && c.y >= t.y && c.y < t.y + t.size)
        })
      : reachCells.some((c) => useAt(grid, c.x, c.y) === source)
  return found ? null : { _tag: "nothingNear", source, radius: kind.gathers!.radius }
}
