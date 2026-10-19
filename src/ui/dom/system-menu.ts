/**
 * Share, the guide, save, load, and new town: a row of icons in the bottom
 * right (folded into one menu on a phone). Founding or loading replaces the
 * town, so each asks first.
 */
import type { Interaction, Stats } from "../../view/contracts.ts"
import type { IconName } from "../../view/icons.ts"
import type { Controls, Fold } from "./controls.ts"
import { el } from "./kit/dom.ts"
import { iconEl } from "./kit/icons.ts"

export const createSystemMenu = (
  ui: Interaction,
  persistence: () => { readonly save: () => string | null; readonly load: () => string | null },
  resetCamera: () => void,
  fold: () => Fold | null,
  controls: Pick<Controls, "toast" | "confirmLeave" | "openCharter" | "openShare" | "setFold">
) => {
  const system = el("div", "system")
  const action = (name: IconName, label: string, tip: string, run: () => void) => {
    const button = el("button", name === "share" ? "labelled" : "")
    button.title = tip
    button.append(iconEl(name), document.createTextNode(label))
    button.onclick = run
    system.append(button)
  }
  action("share", "share", "Share a picture of the town, or a link anyone can open to watch it and play on", () => controls.openShare())
  // The guide, on or off (it is on for a new mayor).
  const guideButton = el("button", "guide-toggle")
  guideButton.title = "Turn the guide on or off: it tells a new mayor what to do next, and why"
  guideButton.append(iconEl("hint"), document.createTextNode("guide"))
  let guideOff = false
  guideButton.onclick = () => ui.guide.push({ type: guideOff ? "on" : "off" })
  system.append(guideButton)
  action("save", "save", "Save the town in this browser (it also autosaves every two minutes)", () => controls.toast(persistence().save() ?? "Saved"))
  action("load", "load", "Load the latest save: yours or the autosave, whichever is newer", () =>
    controls.confirmLeave("load the latest save?", "The town as it is now is replaced by the latest save (yours or the autosave).", "Load", () =>
      controls.toast(persistence().load() ?? "Loaded")
    )
  )
  action("newTown", "new town", "Found a new town on new land", () =>
    controls.confirmLeave("found a new town?", "This town is left behind for good unless it is saved first.", "Choose new land", () => controls.openCharter(true))
  )
  // A phone has no camera bar: this puts the camera back.
  action("view", "recentre", "Back to the original angle and centre", resetCamera)
  system.lastElementChild!.classList.add("phone-only")
  // A choice from the menu folds it.
  system.addEventListener("click", () => {
    if (fold() === "more") controls.setFold(null)
  })
  return {
    element: system,
    update: (s: Stats) => {
      guideOff = s.guide.off
      guideButton.classList.toggle("on", !s.guide.off)
      guideButton.title = s.guide.off ? "Turn the guide back on: a next step to take, and why, at the top of the ticker" : "Turn the guide off"
    }
  }
}
