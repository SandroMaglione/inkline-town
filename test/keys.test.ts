import assert from "node:assert/strict"
import { test } from "node:test"
import { bindKeys } from "../src/ui/dom/keys.ts"
import { blankInteraction } from "../src/view/contracts.ts"

test("browser shortcuts, composition, and repeat keys do not change the town controls", (context) => {
  const target = new EventTarget()
  for (const [name, value] of Object.entries({ window: target, HTMLElement: class {}, HTMLButtonElement: class {} })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    context.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous)
      else Reflect.deleteProperty(globalThis, name)
    })
  }
  const actions: Array<string> = []
  bindKeys(blankInteraction(), { escape: () => false, blocked: () => false }, () => {}, {
    choose: (tool) => actions.push(tool),
    toggleMenu: (menu) => actions.push(menu),
    setSpeed: (speed) => actions.push(String(speed)),
    togglePause: () => actions.push("pause"),
    setView: (view) => actions.push(view),
    refreshTools: () => {}
  })
  const press = (key: string, fields: Record<string, boolean> = {}) => {
    const event = Object.assign(new Event("keydown", { cancelable: true }), { key }, fields)
    target.dispatchEvent(event)
    return event.defaultPrevented
  }
  assert.equal(press("p", { ctrlKey: true }), false)
  assert.equal(press("r", { metaKey: true }), false)
  assert.equal(press("a", { altKey: true }), false)
  press("e", { isComposing: true })
  press("b", { repeat: true })
  assert.equal(press(" ", { repeat: true }), false)
  assert.deepEqual(actions, [])
  assert.equal(press(" "), true)
  press("R")
  press("3")
  assert.deepEqual(actions, ["pause", "road", "4"])
})
