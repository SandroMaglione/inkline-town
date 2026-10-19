/**
 * The pointer's gestures, turned into what the tool does: a drag lays roads,
 * homes, paving, or park ground; a click places a building, furnishes a park,
 * starts an upgrade, bulldozes, or selects. What changes the town goes to the
 * simulation as an edit.
 */
import { kinds, upgradeAt } from "../../game/content/index.ts"
import type { Edit } from "../../game/edits.ts"
import { lPath } from "../../game/world/grid.ts"
import { inside } from "../../game/world/iso.ts"
import type { Interaction } from "../contracts.ts"
import type { Frame } from "../frame.ts"
import { cellAt, footprintAt, rectangle } from "./geometry.ts"
import { placeProblem } from "./placing.ts"

export const applyGestures = (frame: Frame, ui: Interaction, send: (edit: Edit) => void, toast: (message: string) => void) => {
  const buildings = frame.buildings
  for (const gesture of ui.gestures.splice(0)) {
    const cell = cellAt(gesture.at)
    if (gesture.type === "press") {
      ui.dragFrom = (ui.tool === "road" || ui.tool === "home" || ui.tool === "pave" || ui.tool === "ground") && inside(cell.x, cell.y) ? cell : null
      continue
    }
    switch (ui.tool) {
      case "road":
      case "pave":
      case "home": {
        if (ui.dragFrom) {
          const cells = lPath(ui.dragFrom, cell).filter((c) => inside(c.x, c.y))
          send(ui.tool === "road" ? { type: "roads", cells } : ui.tool === "pave" ? { type: "pave", cells } : { type: "homes", cells })
        }
        ui.dragFrom = null
        break
      }
      case "ground": {
        if (ui.dragFrom) send({ type: "ground", ground: ui.ground, cells: rectangle(ui.dragFrom, cell).filter((c) => inside(c.x, c.y)) })
        ui.dragFrom = null
        break
      }
      case "prop": {
        if (gesture.panned) break
        send({ type: "prop", prop: ui.prop, cell })
        break
      }
      case "place": {
        if (gesture.panned || !ui.placing) break
        const kind = kinds[ui.placing]
        const at = footprintAt(gesture.at, kind.size)
        const problem = placeProblem(frame, kind, { ...at, size: kind.size })
        if (problem?.refuse) {
          toast(`A ${kind.title.toLowerCase()} ${problem.text}`)
          break
        }
        send({ type: "building", kind: ui.placing, cell: at, open: false })
        break
      }
      case "upgrade": {
        // A click on a building of the kind being upgraded begins its works.
        if (gesture.panned) break
        const hit = frame.pickAt(gesture.at, gesture.hit)
        const row = hit !== null ? buildings.find((b) => b.entity.id === hit) : undefined
        const kind = row ? kinds[row.data.building.get().kind] : undefined
        if (!row || !kind || (ui.upgrading && kind.id !== ui.upgrading)) {
          const wanted = ui.upgrading ? (upgradeAt(kinds[ui.upgrading], 0) ? kinds[ui.upgrading].title.toLowerCase() : "building") : "building"
          toast(`Pick a ${wanted} to upgrade`)
          break
        }
        if (row.data.works.present) {
          toast(`The ${kind.title.toLowerCase()} is already being upgraded`)
          break
        }
        send({ type: "upgrade", cell: row.data.tile.get() })
        break
      }
      case "bulldoze": {
        if (gesture.panned) break
        const hit = frame.pickAt(gesture.at, gesture.hit)
        send({ type: "remove", cell: (hit !== null ? frame.tileOf(hit) : undefined) ?? cell })
        break
      }
      case "select": {
        if (gesture.panned) break
        ui.selected = frame.pickAt(gesture.at, gesture.hit)
        if (ui.selected !== null) ui.menu = null
        break
      }
    }
  }
  if (ui.selected !== null && frame.tileOf(ui.selected) === undefined) ui.selected = null
}
