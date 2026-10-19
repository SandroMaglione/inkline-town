/**
 * The view, once a frame: the world read in one pass (see `frame.ts`), then
 * the pointer's gestures become a selection and edits; the preview, the
 * tooltip, the panel, the map view, the alerts, the upgrades, the guide, and
 * the town's numbers are filled in for the UI (`TownView`) and the renderer
 * (`SceneView`). It never writes the world: what changes the town goes to the
 * simulation as an edit.
 */
import { Game } from "../game/schema.ts"
import { alertsOf, freshPatience } from "./alerts.ts"
import { frameAccess, frameOf } from "./frame.ts"
import { freshGuide, guideOf } from "./guide.ts"
import { applyGestures } from "./interaction/gestures.ts"
import { drawOverlay } from "./overlay.ts"
import { panelOf } from "./panels/index.ts"
import { previewOf } from "./preview.ts"
import { Interaction, Outbox, Shown } from "./services.ts"
import { numbersOf, statsOf } from "./stats.ts"
import { tooltipOf } from "./tooltip.ts"
import { noneWanted, upgradesOf, upgradesWanted } from "./upgrades.ts"

export const Project = Game.System(
  "Town/Project",
  {
    queries: frameAccess.queries,
    resources: frameAccess.resources,
    services: { interaction: Game.System.service(Interaction), shown: Game.System.service(Shown), outbox: Game.System.service(Outbox) },
    /** The view's own state, not saved (rebuilt after a load): the guide's, the alerts' patience, and the upgrades the town needs. */
    local: () => ({ guide: freshGuide(), patience: freshPatience(), wanted: noneWanted() })
  },
  ({ queries, resources, services, local }) => {
    const ui = services.interaction
    const { town, scene } = services.shown
    const send = services.outbox.push
    const toast = (message: string) => town.toasts.push(message)
    const frame = frameOf(queries, resources)

    applyGestures(frame, ui, send, toast)
    const { preview, dropping } = previewOf(frame, ui)
    tooltipOf(frame, ui, preview, dropping)
    scene.preview = preview
    town.tooltip = preview.tooltip
    town.stroke = preview.stroke

    const wanted = () => upgradesWanted(frame, local.wanted)
    town.panel = panelOf(frame, ui, wanted)
    drawOverlay(frame, ui, scene, town)

    const { alerts, shortStaffed, hallRow } = alertsOf(frame, local.patience)
    const { upgrades, due, hint } = upgradesOf(frame, wanted())
    if (hint) alerts.push(hint)
    scene.wanted = due
    const numbers = numbersOf(frame)
    const guide = guideOf(frame, ui, send, local.guide, numbers, hallRow)
    town.stats = statsOf(frame, numbers, { alerts, shortStaffed, upgrades, guide, hallRow })
    scene.pace = ui.founding || town.stats.fate.state !== "playing" ? 0 : ui.speed
  }
)
