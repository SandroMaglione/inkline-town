/**
 * The keyboard: each command's and map view's key from the tool table
 * (`view/tools.ts`), the speeds on 1, 2, and 3, space to pause, and Esc to
 * step back (drop a stroke, put the tool down, close the panel).
 */
import type { Interaction } from "../../view/contracts.ts"
import { commands, mapViews, type Command, type MapViewId } from "../../view/tools.ts"
import type { Controls } from "./controls.ts"

/** `sheet.escape`: Esc closes the sheet open over the map, if any; `sheet.blocked`: the keys are not the map's now. */
export const bindKeys = (
  ui: Interaction,
  sheet: { readonly escape: () => void; readonly blocked: () => boolean },
  cancelStroke: () => void,
  controls: Pick<Controls, "choose" | "toggleMenu" | "setSpeed" | "togglePause" | "setView" | "refreshTools">
) => {
  const letters = new Map<string, () => void>()
  for (const command of Object.values(commands) as Array<Command>) {
    const action = command.action
    if (!command.key || command.key.length !== 1) continue
    letters.set(command.key.toLowerCase(), () => ("tool" in action ? controls.choose(action.tool) : "menu" in action ? controls.toggleMenu(action.menu) : undefined))
  }
  for (const view of Object.keys(mapViews) as Array<MapViewId>)
    letters.set(mapViews[view].key.toLowerCase(), () => controls.setView(ui.view === view ? "none" : view))

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest("input,select,textarea,[contenteditable=true]")) return
    if (event.key === " " && event.target instanceof HTMLButtonElement) return
    if (event.key === "Escape") sheet.escape()
    if (sheet.blocked()) return
    if (event.key === " ") {
      event.preventDefault()
      controls.togglePause()
    }
    if (event.key === "1") controls.setSpeed(1)
    if (event.key === "2") controls.setSpeed(2)
    if (event.key === "3") controls.setSpeed(4)
    if (event.key === "Escape") {
      // A stroke being drawn or held is dropped first; the tool stays.
      if (ui.dragFrom) cancelStroke()
      else if (ui.tool !== "select") controls.choose("select")
      else if (ui.menu) ui.menu = null
      else ui.selected = null
      controls.refreshTools()
    }
    letters.get(event.key.toLowerCase())?.()
  })
}
