/** A park's panel: what it is worth, why, and what would make it better. */
import { grounds, propIds, props } from "../../game/content/index.ts"
import type { ParkValue } from "../../game/world/appeal.ts"
import type { Line, Panel } from "../contracts.ts"
import type { Frame, ParkRow } from "../frame.ts"
import { signed } from "../text.ts"

/** What a park does for the streets around it. */
export const parkText = (p: ParkValue) => `desirability ${signed(p.value)} out to ${p.reach} cells`

/** A park, for its panel: what it is worth, why, and what would make it better. */
const describePark = (p: ParkValue): Array<Line> => {
  const has = new Set(p.cells.map((c) => c.prop))
  const missing = propIds.filter((id) => !has.has(id)).map((id) => props[id].title.toLowerCase())
  const upkeep = p.cells.reduce((n, c) => n + grounds[c.ground].upkeep + (c.prop === "none" ? 0 : props[c.prop].upkeep), 0)
  const placed = p.cells.filter((c) => c.prop !== "none").length - p.crowded
  return [
    { icon: "decor", label: "size", value: `${p.cells.length} cell${p.cells.length === 1 ? "" : "s"} · beauty ${p.beauty}` },
    { icon: "appeal", label: "made of", value: p.parts.map((part) => `${part.label} ${part.value}`).join(", ") || "nothing yet" },
    { icon: "homes", label: "the streets around", value: parkText(p), tone: "ok" },
    p.entrances > 0
      ? { icon: "road", label: "ways in from the street", value: `${p.entrances}${p.entrances > 2 ? " (2 count)" : ""}` }
      : { icon: "road", label: "ways in from the street", value: "none", tone: "warn", note: "lay a gravel walk or a paved square out to a road: +1.5 each, two count" },
    { icon: "decor", label: "furnishings that count", value: `${placed} of ${Math.floor(p.cells.length / 2)}`, tone: p.crowded > 0 ? "warn" : undefined, note: p.crowded > 0 ? `${p.crowded} too many: one counts for every 2 cells of park, so lay more ground` : undefined },
    ...(missing.length > 0 ? [{ icon: "info", label: "nicer with", value: missing.join(", "), tone: "dim" } as Line] : []),
    { icon: "upkeep", label: "upkeep", value: `${Math.round(upkeep * 10) / 10} coins a minute` }
  ]
}

/** The panel of a park that is picked: the whole park the cell belongs to, or `null` if it is not one. */
export const parkPanel = (frame: Frame, row: ParkRow): Panel | null => {
  const picked = frame.parkOf(row.data.tile.get())
  if (!picked) return null
  return {
    type: "park",
    id: row.entity.id,
    cell: row.data.tile.get(),
    cells: picked.cells.length,
    value: picked.value,
    reach: picked.reach,
    lines: describePark(picked)
  }
}
