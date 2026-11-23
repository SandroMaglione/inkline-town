import assert from "node:assert/strict"
import { test } from "node:test"
import { setImmediate } from "node:timers/promises"
import { en } from "../src/i18n/index.ts"
import { createShare } from "../src/ui/dom/screens/share.ts"
import type { Stats } from "../src/view/contracts.ts"

test("preparing a share card is single-flight and closing restores the town's speed", async (t) => {
  const classes = new Set<string>()
  const element = () => ({
    classList: { add: classes.add.bind(classes), remove: classes.delete.bind(classes), contains: classes.has.bind(classes) },
    append: () => {},
    focus: () => {},
    replaceChildren: () => {},
    querySelectorAll: () => []
  })
  const context = new Proxy({ measureText: () => ({ width: 0 }) }, { get: (g, key) => key === "measureText" ? g.measureText : () => {} })
  const canvas = { ...element(), width: 1200, getContext: () => context }
  const blobs: Array<(blob: Blob) => void> = []
  const pictures: Array<() => void> = []
  class DeferredImage {
    onload = () => {}
    set src(_value: string) { pictures.push(this.onload) }
  }
  for (const [key, value] of [
    ["document", { createElement: (tag: string) => tag === "canvas" ? { ...canvas, toBlob: (ready: (blob: Blob) => void) => blobs.push(ready) } : element(), createTextNode: (text: string) => text }],
    ["Image", DeferredImage],
    ["location", { host: "local.test" }]
  ] as const) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { value, configurable: true })
    t.after(() => {
      if (old) Object.defineProperty(globalThis, key, old)
      else Reflect.deleteProperty(globalThis, key)
    })
  }
  t.mock.method(URL, "createObjectURL", () => "blob:share-fixture")
  let speed = 3
  let draws = 0
  const stats = {
    fate: { state: "playing", rank: 0, term: 1 }, season: { year: 1 },
    charter: { size: "small", land: "fair", term: 45 },
    settlers: 0, citizens: 0, coins: 120, mood: { approval: 0 }
  } as Stats
  const share = createShare(en, () => stats, () => speed, () => false, {
    picture: () => {
      draws++
      return document.createElement("canvas")
    },
    camera: () => null
  }, () => "", { setSpeed: (next) => { speed = next }, toast: () => {} })
  const first = share.open()
  const repeated = share.open()
  assert.equal(draws, 1)
  assert.equal(share.isOpen(), true)
  assert.equal(speed, 0)
  share.close()
  assert.equal(speed, 3)
  for (let i = 0; i < 5; i++) {
    pictures.shift()!()
    await setImmediate()
  }
  blobs.shift()!(new Blob(["card"]))
  await Promise.all([first, repeated])
  assert.equal(share.isOpen(), false, "an asynchronous card must not reopen after closing")
  assert.equal(speed, 3)
})
