/**
 * Share, the guide, save, load, new town, and the language: a row of icons
 * in the bottom right (folded into one menu on a phone). Founding or loading
 * replaces the town, so each asks first.
 */
import type { Catalog } from "../../i18n/index.ts"
import type { Interaction, Stats } from "../../view/contracts.ts"
import type { IconName } from "../../view/icons.ts"
import type { Controls, Fold } from "./controls.ts"
import { createCreditCorner } from "./brand/credit.ts"
import { el } from "./kit/dom.ts"
import { iconEl } from "./kit/icons.ts"

export const createSystemMenu = (
  t: Catalog,
  ui: Interaction,
  persistence: () => { readonly save: () => string | null; readonly load: () => { readonly said: string } },
  resetCamera: () => void,
  fold: () => Fold | null,
  controls: Pick<Controls, "toast" | "confirmLeave" | "openCharter" | "openShare" | "openLanguage" | "setFold">
) => {
  const said = t.page.system
  const system = el("div", "system")
  const action = (name: IconName, words: { readonly label: string; readonly tip: string }, run: () => void) => {
    const button = el("button", name === "share" ? "labelled" : "")
    button.title = words.tip
    button.append(iconEl(name), document.createTextNode(words.label))
    button.onclick = run
    system.append(button)
  }
  action("share", said.share, () => controls.openShare())
  // The guide, on or off (it is on for a new mayor).
  const guideButton = el("button", "guide-toggle")
  guideButton.title = said.guide.tip
  guideButton.append(iconEl("hint"), document.createTextNode(said.guide.label))
  let guideOff = false
  guideButton.onclick = () => ui.guide.push({ type: guideOff ? "on" : "off" })
  system.append(guideButton)
  action("save", said.save, () => controls.toast(persistence().save() ?? t.page.save.saved))
  action("load", said.load, () => controls.confirmLeave(said.leave.load, () => controls.toast(persistence().load().said)))
  action("newTown", said.newTown, () => controls.confirmLeave(said.leave.newTown, () => controls.openCharter(true)))
  action("language", said.language, () => controls.openLanguage())
  // A phone has no camera bar: this puts the camera back.
  action("view", said.recentre, resetCamera)
  system.lastElementChild!.classList.add("phone-only")
  // The maker's credit rides just above the bar, wherever the bar goes.
  system.append(createCreditCorner(t))
  // A choice from the menu folds it.
  system.addEventListener("click", () => {
    if (fold() === "more") controls.setFold(null)
  })
  return {
    element: system,
    update: (s: Stats) => {
      guideOff = s.guide.off
      guideButton.classList.toggle("on", !s.guide.off)
      guideButton.title = s.guide.off ? said.guide.turnOn : said.guide.turnOff
    }
  }
}
