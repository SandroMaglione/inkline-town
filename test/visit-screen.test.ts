import assert from "node:assert/strict"
import { test } from "node:test"
import { en } from "../src/i18n/index.ts"
import { createVisit } from "../src/ui/dom/screens/visit.ts"

test("playing from a shared town saves first and keeps the visit on a storage error", (t) => {
  const events: string[] = []
  const classes = new Set<string>()
  const element = () => ({
    classList: { add: classes.add.bind(classes), remove: classes.delete.bind(classes), contains: classes.has.bind(classes) },
    onclick: undefined as (() => void) | undefined,
    append: () => {},
    replaceChildren: () => {}
  })
  const buttons: Array<ReturnType<typeof element>> = []
  for (const [key, value] of [
    ["document", { body: element(), createElement: (tag: string) => {
      const node = element()
      if (tag === "button") buttons.push(node)
      return node
    } }],
    ["window", { history: { replaceState: () => events.push("leave") } }]
  ] as const) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { value, configurable: true })
    t.after(() => {
      if (old) Object.defineProperty(globalThis, key, old)
      else Reflect.deleteProperty(globalThis, key)
    })
  }
  let problem: string | null = "The save slots are full."
  const controls = {
    adopt: () => { events.push("save"); return problem },
    toast: (message: string) => events.push(message),
    openCharter: () => {},
    closeCharter: () => {},
    resetPage: () => {},
    setSpeed: () => {}
  }
  const visit = createVisit(en, controls)
  visit.visit("a shared town")
  const play = buttons[0]!
  play.onclick!()
  assert.equal(visit.visiting(), true)
  assert.deepEqual(events, ["save", problem])
  problem = null
  play.onclick!()
  assert.equal(visit.visiting(), false)
  assert.deepEqual(events.slice(2), ["save", "leave", en.page.visit.yours])
})
