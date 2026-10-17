import assert from "node:assert/strict"
import { test } from "node:test"
import { Effect } from "effect"
import { HostClock } from "@typeonce/ritmo"
import { Determinism } from "@typeonce/ritmo-devtools"
import { load, memoryStorage, SAVE_FORMAT, SAVE_VERSION, Storage, World } from "../src/save.ts"
import { headless } from "../src/sim/headless.ts"
import { simulate } from "../src/sim/index.ts"

test("version 9 saves retain the exact 60 Hz step count and load as snapshot format 2", () => {
  const town = headless({ size: "small", term: 45, land: "fair", seed: 7 })
  town.run(1)
  const current = town.snapshot()
  const count = current.resources["Town/Time"].step
  const old = { ...current, version: 1, resources: { ...current.resources, "Town/Time": { tick: count } } }
  const storage = memoryStorage(new Map([["inkline-town/save/manual", JSON.stringify({ format: SAVE_FORMAT, version: 9, slot: "manual", savedAt: 0, title: "old town", world: old })]]))
  town.run(1)
  const result = Effect.runSync(Effect.result(load("manual").pipe(
    Effect.provideService(Storage, storage),
    Effect.provideService(World, { snapshot: () => town.snapshot(), title: () => "town", restore: (value) => {
      try { town.restore(value); return null } catch (error) { return String(error) }
    } })
  )))
  assert.equal(result._tag, "Success")
  if (result._tag === "Success") assert.equal(result.success.version, SAVE_VERSION)
  assert.deepEqual(town.snapshot().resources["Town/Time"], { step: count, hz: 60, dt: 1 / 60 })
  assert.equal(town.snapshot().version, 2)
})

test("the full town simulation repeats from fresh scripted input", () => {
  const result = Determinism.check(({ hostClock }) => ({
    runtime: headless({ size: "small", term: 45, land: "fair", seed: 7 }, { hostClock }).runtime,
    schedules: { simulate }
  }), { schedule: "simulate", frames: 120, hostClock: HostClock.test() })
  assert.deepEqual(result, { ok: true, frames: 120 })
})
