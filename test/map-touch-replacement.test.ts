import assert from "node:assert/strict"
import { test } from "node:test"
import { MapInput, type CameraWords } from "../src/render/pixi3d/input.ts"
import { blankInteraction, blankShown } from "../src/view/contracts.ts"

test("dragging over a held touch stroke holds the new stroke for confirmation", (t) => {
  const canvas = Object.assign(new EventTarget(), {
    style: { cursor: "", touchAction: "" },
    focus() {},
    setPointerCapture() {},
    getBoundingClientRect: () => ({
      x: 0, y: 0, width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100, toJSON: () => ({})
    })
  })
  const node = () => ({
    dataset: {}, textContent: "", setAttribute() {}, append() {}, remove() {},
    querySelector: () => ({ textContent: "" }),
    querySelectorAll: () => []
  })
  const document = { body: node(), createElement: node, elementFromPoint: () => canvas }
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: document },
    window: { configurable: true, value: new EventTarget() }
  })
  t.after(() => {
    Reflect.deleteProperty(globalThis, "document")
    Reflect.deleteProperty(globalThis, "window")
  })
  const groundAt = (x: number, y: number) => ({ x, y })
  const cameraWords: CameraWords = {
    label: "Camera", pan: { label: "Pan", title: "Pan" }, rotate: { label: "Rotate", title: "Rotate" },
    zoomOut: "Zoom out", zoom: "Zoom", zoomIn: "Zoom in", reset: { label: "Reset", title: "Reset" }
  }
  const ui = blankInteraction()
  ui.tool = "road"
  const scene = {
    canvas, groundAt, camera: { zoom: 1 },
    inputAt: (x: number, y: number) => ({ at: groundAt(x, y), hit: null }),
    pan() {}, rotate() {}, zoomAt() {}, zoomBy() {}, resetCamera() {}
  }
  const input = new MapInput(scene, ui, blankShown(), {
    camera: cameraWords, tapAgain() {}, blocked: () => false
  })
  t.after(() => input.dispose())
  const touch = (type: "pointerdown" | "pointermove" | "pointerup", x: number, y: number) => {
    canvas.dispatchEvent(Object.assign(new Event(type), {
      pointerId: 1, pointerType: "touch", clientX: x, clientY: y, button: 0, altKey: false
    }))
  }
  const processPress = (x: number, y: number) => {
    assert.deepEqual(ui.gestures.splice(0), [{ type: "press", at: { x, y } }])
    ui.dragFrom = { x, y }
  }

  touch("pointerdown", 10, 20)
  processPress(10, 20)
  touch("pointermove", 20, 20)
  touch("pointerup", 20, 20)
  assert.equal(ui.stroke, "held")

  touch("pointerdown", 30, 40)
  touch("pointermove", 40, 40)
  assert.equal(ui.dragFrom, null, "the previous stroke has been dropped")
  processPress(30, 40)
  touch("pointerup", 40, 40)
  assert.equal(ui.stroke, "held")
  assert.deepEqual(ui.pointer, { x: 40, y: 40 })
  assert.deepEqual(ui.gestures, [], "lifting a finger does not build")

  input.confirmStroke()
  assert.deepEqual(ui.gestures, [{ type: "release", at: { x: 40, y: 40 }, panned: false }])
})
