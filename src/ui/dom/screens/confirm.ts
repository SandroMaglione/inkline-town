/** Asks before something that replaces the town: save first, go ahead, or stay. The town waits while it asks. */
import type { Controls } from "../controls.ts"
import { el } from "../kit/dom.ts"

export const createConfirm = (
  save: () => string | null,
  speed: () => number,
  controls: Pick<Controls, "setSpeed" | "toast">
) => {
  const box = el("div", "dialog")
  const ask = (title: string, text: string, go: string, run: () => void) => {
    const wasSpeed = speed()
    controls.setSpeed(0)
    box.replaceChildren()
    const card = el("div", "sheet narrow")
    card.append(el("h2", "", title), el("p", "sub", text))
    const actions = el("div", "actions")
    const close = (resume: boolean) => {
      box.classList.remove("open")
      if (resume) controls.setSpeed(wasSpeed)
    }
    const stay = el("button", "frame primary", "Keep playing")
    stay.onclick = () => close(true)
    const saveFirst = el("button", "frame", `Save, then ${go.toLowerCase()}`)
    saveFirst.onclick = () => {
      const failed = save()
      if (failed) return controls.toast(failed)
      close(true)
      run()
    }
    const leave = el("button", "frame danger", `${go} without saving`)
    leave.onclick = () => {
      close(true)
      run()
    }
    actions.append(stay, saveFirst, leave)
    card.append(actions)
    box.append(card)
    box.classList.add("open")
    stay.focus()
  }
  return {
    element: box,
    ask,
    open: () => box.classList.contains("open"),
    /** Esc: keep playing. */
    dismiss: () => box.querySelector<HTMLButtonElement>(".primary")?.click()
  }
}
