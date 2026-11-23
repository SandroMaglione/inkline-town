import assert from "node:assert/strict"
import { test } from "node:test"
import type { Edit } from "../src/game/edits.ts"
import { headless } from "../src/game/headless.ts"
import { Game } from "../src/game/schema.ts"
import { blankInteraction } from "../src/view/contracts.ts"
import { frameAccess, frameOf } from "../src/view/frame.ts"
import { applyGestures } from "../src/view/interaction/gestures.ts"
import { en } from "../src/i18n/index.ts"

const GestureFrame = Game.Inspector("Town/GestureFrame", frameAccess, ({ queries, resources }) => frameOf(queries, resources, en))

for (const tool of ["road", "pave", "home", "ground"] as const) {
  test(`cancelling a ${tool} stroke before the next frame never sends a build edit`, () => {
    const town = headless({ size: "small", term: 45, land: "fair", seed: 11 })
    const frame = town.runtime.inspect(GestureFrame)
    const ui = blankInteraction()
    ui.tool = tool
    const edits: Array<Edit> = []
    const press = { type: "press", at: { x: 10, y: 15 } } as const
    const release = { type: "release", at: { x: 12, y: 15 } } as const
    ui.gestures.push(press, { ...release, panned: true })
    applyGestures(frame, ui, (edit) => edits.push(edit), () => {})
    assert.equal(edits.length, 0, "the cancelled gesture must not build")
    assert.equal(ui.dragFrom, null)

    ui.gestures.push(press, { ...release, panned: false })
    applyGestures(frame, ui, (edit) => edits.push(edit), () => {})
    assert.equal(edits.length, 1, "an ordinary release must still build")
  })
}
