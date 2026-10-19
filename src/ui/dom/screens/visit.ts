/**
 * Visiting a shared town: it runs as its mayor left it, with the building
 * tools put away, until the visitor plays on from here (it becomes theirs,
 * and autosaves) or founds a town of their own.
 */
import type { Controls } from "../controls.ts"
import { el } from "../kit/dom.ts"
import { iconEl } from "../kit/icons.ts"

export const createVisit = (
  controls: Pick<Controls, "toast" | "openCharter" | "setSpeed"> & { readonly closeCharter: () => void; readonly resetPage: () => void }
) => {
  const visitBar = el("div", "card visit")
  let visiting = false
  const endVisit = () => {
    visiting = false
    document.body.classList.remove("visiting")
    visitBar.classList.remove("show")
    window.history.replaceState(null, "", "/")
  }
  /** The shared town is loaded: show it running. */
  const visit = (title: string) => {
    visiting = true
    controls.closeCharter()
    controls.resetPage()
    document.body.classList.add("visiting")
    visitBar.replaceChildren()
    const text = el("div", "cell")
    text.append(iconEl("town", 18))
    const words = el("span", "stack")
    words.append(el("b", "", "a shared town"), el("small", "", title))
    text.append(words)
    const play = el("button", "frame primary", "Play from here")
    play.title = "Make this town yours: build, govern, and it autosaves in this browser"
    play.onclick = () => {
      endVisit()
      controls.toast("The town is yours: it autosaves as you play")
    }
    const own = el("button", "frame", "Found your own")
    own.onclick = () => controls.openCharter(true)
    const buttons = el("div", "cell")
    buttons.append(play, own)
    visitBar.append(text, buttons)
    visitBar.classList.add("show")
    controls.setSpeed(1)
  }
  /** The shared town could not be opened: say why, and found a town instead. */
  const visitFailed = (message: string) => {
    window.history.replaceState(null, "", "/")
    controls.openCharter(false)
    controls.toast(message)
  }
  return { element: visitBar, visit, visitFailed, endVisit, visiting: () => visiting }
}
