/**
 * A slider for one of the town's levers. While it is held, the town's
 * numbers do not move it back; `sync` sets it otherwise.
 */
import { el } from "./dom.ts"

export const slider = (min: number, max: number, step: number, onInput: (value: number) => void) => {
  const input = el("input", "slider")
  input.type = "range"
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  let held = false
  input.addEventListener("pointerdown", () => (held = true))
  input.addEventListener("pointerup", () => (held = false))
  input.addEventListener("blur", () => (held = false))
  const paint = () => input.style.setProperty("--at", `${((Number(input.value) - min) / (max - min)) * 100}%`)
  input.oninput = () => {
    paint()
    onInput(Number(input.value))
  }
  const sync = (value: number) => {
    if (held || input.value === String(value)) return
    input.value = String(value)
    paint()
  }
  paint()
  return { input, sync }
}
