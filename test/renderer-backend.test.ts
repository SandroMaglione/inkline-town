import assert from "node:assert/strict"
import { test } from "node:test"
import { backend } from "../src/render/pixi3d/gpu.ts"

function signal() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

for (const outcome of ["complete", "timeout", "lost"] as const) {
  test(`only a completed GPU probe selects WebGPU (${outcome})`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const submitted = signal()
    const frame = signal()
    const lost = signal()
    let destroyed = false
    const device = {
      lost: lost.promise,
      queue: { submit: () => submitted.resolve(), onSubmittedWorkDone: () => frame.promise },
      createCommandEncoder: () => ({ beginRenderPass: () => ({ end() {} }), finish() {} }),
      destroy() { destroyed = true }
    }
    const context = {
      configure() {},
      getCurrentTexture: () => ({ createView() {} })
    }
    const gpu = {
      requestAdapter: async () => ({
        features: new Set(["indirect-first-instance"]),
        requestDevice: async () => device
      }),
      getPreferredCanvasFormat: () => "bgra8unorm"
    }
    for (const [name, value] of Object.entries({
      navigator: { gpu },
      location: { search: "" },
      document: { createElement: () => ({ getContext: () => context }) }
    })) {
      const original = Object.getOwnPropertyDescriptor(globalThis, name)
      Object.defineProperty(globalThis, name, { configurable: true, value })
      t.after(() => {
        if (original) Object.defineProperty(globalThis, name, original)
        else Reflect.deleteProperty(globalThis, name)
      })
    }

    const choosing = backend()
    await submitted.promise
    if (outcome === "complete") frame.resolve()
    if (outcome === "lost") lost.resolve()
    if (outcome === "timeout") t.mock.timers.tick(1000)
    const selected = await Promise.race([choosing, new Promise<null>((done) => setImmediate(() => done(null)))])
    assert.equal(selected, outcome === "complete" ? "webgpu" : "webgl")
    assert.equal(destroyed, true)
  })
}
