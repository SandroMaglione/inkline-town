/** A park's panel: what it is worth, why, and what would make it better. */
import { grounds, propIds, props } from "../../game/content/index.ts"
import type { ParkValue } from "../../game/world/appeal.ts"
import { say, type Catalog } from "../../i18n/index.ts"
import type { Line, Panel } from "../contracts.ts"
import type { Frame, ParkRow } from "../frame.ts"

/** A park, for its panel: what it is worth, why, and what would make it better. */
const describePark = (t: Catalog, p: ParkValue): Array<Line> => {
  const words = t.view.park
  const has = new Set(p.cells.map((c) => c.prop))
  const missing = propIds.filter((id) => !has.has(id))
  const upkeep = p.cells.reduce((n, c) => n + grounds[c.ground].upkeep + (c.prop === "none" ? 0 : props[c.prop].upkeep), 0)
  const placed = p.cells.filter((c) => c.prop !== "none").length - p.crowded
  return [
    { icon: "decor", label: words.size, value: words.sizeOf(p.cells.length, p.beauty) },
    { icon: "appeal", label: words.madeOf, value: words.parts(p.parts.map((part) => ({ label: say(words.part, part.label), value: part.value }))) },
    { icon: "homes", label: words.streets, value: words.worth(p.value, p.reach), tone: "ok" },
    p.entrances > 0
      ? { icon: "road", label: words.ways, value: words.waysIn(p.entrances) }
      : { icon: "road", label: words.ways, value: words.none, tone: "warn", note: words.noWays },
    { icon: "decor", label: words.furnishings, value: words.furnished(placed, Math.floor(p.cells.length / 2)), tone: p.crowded > 0 ? "warn" : undefined, note: p.crowded > 0 ? words.crowded(p.crowded) : undefined },
    ...(missing.length > 0 ? [{ icon: "info", label: words.nicerWith, value: words.missing(missing), tone: "dim" } as Line] : []),
    { icon: "upkeep", label: words.upkeep, value: words.upkeepValue(Math.round(upkeep * 10) / 10) }
  ]
}

/** The panel of a park that is picked: the whole park the cell belongs to, or `null` if it is not one. */
export const parkPanel = (frame: Frame, row: ParkRow): Panel | null => {
  const picked = frame.parkOf(row.data.tile)
  if (!picked) return null
  return {
    type: "park",
    id: row.entity.id,
    cell: row.data.tile,
    cells: picked.cells.length,
    value: picked.value,
    reach: picked.reach,
    lines: describePark(frame.t, picked)
  }
}
