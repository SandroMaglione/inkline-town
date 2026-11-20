/** A ruin's panel: what happened to it, and what it does to the streets until it is cleared. */
import type { Panel } from "../contracts.ts"
import type { Frame, RuinRow } from "../frame.ts"

export const ruinPanel = (frame: Frame, row: RuinRow): Panel => {
  const r = row.data.ruin
  const words = frame.t.view.ruin
  return {
    type: "ruin",
    id: row.entity.id,
    cell: row.data.tile,
    cause: r.cause,
    lines: [
      { icon: "condition", label: words.happened, value: words.what[r.cause], tone: "bad" },
      { icon: "appeal", label: words.appeal, value: frame.t.format.signed(-3), tone: "warn", note: words.untilCleared }
    ]
  }
}
