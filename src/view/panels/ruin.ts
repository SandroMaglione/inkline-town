/** A ruin's panel: what happened to it, and what it does to the streets until it is cleared. */
import type { Panel } from "../contracts.ts"
import type { RuinRow } from "../frame.ts"

export const ruinPanel = (row: RuinRow): Panel => {
  const r = row.data.ruin.get()
  return {
    type: "ruin",
    id: row.entity.id,
    cell: row.data.tile.get(),
    cause: r.cause,
    lines: [
      { icon: "condition", label: "what happened", value: r.cause === "burnt" ? "it burned down" : r.cause === "collapsed" ? "it fell down for want of mending" : "it was left derelict after its thefts", tone: "bad" },
      { icon: "appeal", label: "desirability nearby", value: "−3", tone: "warn", note: "until it is cleared: bulldoze it" }
    ]
  }
}
