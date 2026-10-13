/**
 * Saving and loading (`src/save.ts`) against a real headless town and
 * storage in a map: every way a load can go, and that a failed one leaves
 * the town as it was.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { Effect } from "effect"

import { load, loadLatest, memoryStorage, read, save, SAVE_FORMAT, SAVE_VERSION, Storage, World, type LoadError } from "../src/save.ts"
import { headless, type Headless } from "../src/sim/headless.ts"

const worldOf = (town: Headless): World["Service"] => ({
  snapshot: () => town.snapshot(),
  restore: (data) => {
    try {
      town.restore(data as never)
      return null
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause)
    }
  },
  title: () => "a test town"
})

/**
 * The world as it plays: everything but the counter new entity ids come
 * from, which bevy-ts never moves backwards on a load (so ids are never
 * reused), and which nothing in the town reads.
 */
const playing = (town: Headless) => {
  const { nextEntity: _, ...world } = town.snapshot()
  return JSON.stringify(world)
}

const setup = () => {
  const town = headless({ size: "small", term: 45, land: "fair", seed: 5 })
  const storage = memoryStorage()
  const run = <A, E>(program: Effect.Effect<A, E, Storage | World>) =>
    Effect.runSync(Effect.result(program.pipe(Effect.provideService(Storage, storage), Effect.provideService(World, worldOf(town)))))
  return { town, storage, run }
}

const failure = <A>(result: { _tag: "Success"; success: A } | { _tag: "Failure"; failure: LoadError }) => {
  assert.equal(result._tag, "Failure")
  return (result as { failure: LoadError }).failure
}

test("a saved town loads back as it was", () => {
  const { town, run } = setup()
  town.run(30)
  const saved = run(save("manual"))
  assert.equal(saved._tag, "Success")
  const before = playing(town)
  town.run(30)
  assert.notEqual(playing(town), before)
  assert.equal(run(load("manual"))._tag, "Success")
  assert.equal(playing(town), before)
})

test("nothing saved", () => {
  const { run } = setup()
  assert.equal(failure(run(load("manual")))._tag, "NothingSaved")
  assert.equal(failure(run(load("auto")))._tag, "NothingSaved")
})

test("a file that is not a save is unreadable", () => {
  const { storage, run } = setup()
  storage.set("inkline-town/save/manual", "{ not json")
  assert.equal(failure(run(load("manual")))._tag, "Unreadable")
  storage.set("inkline-town/save/manual", JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION, slot: "manual" }))
  assert.equal(failure(run(load("manual")))._tag, "Unreadable")
})

test("a save from another version is refused by name", () => {
  const { storage, run } = setup()
  storage.set("inkline-town/save/manual", JSON.stringify({ format: SAVE_FORMAT, version: 1, slot: "manual", savedAt: 0, title: "", world: {} }))
  const error = failure(run(load("manual")))
  assert.equal(error._tag, "WrongVersion")
})

test("a world the simulation refuses leaves the town untouched", () => {
  const { town, storage, run } = setup()
  town.run(10)
  run(save("manual"))
  const file = JSON.parse(storage.get("inkline-town/save/manual")!)
  file.world.resources["Town/Treasury"] = { coins: "lots" }
  storage.set("inkline-town/save/manual", JSON.stringify(file))
  town.run(10)
  const before = JSON.stringify(town.snapshot())
  assert.equal(failure(run(load("manual")))._tag, "Rejected")
  assert.equal(JSON.stringify(town.snapshot()), before, "a refused load changes nothing, not even the id counter")
})

test("a storage that will not take the save says so", () => {
  const { town } = setup()
  const full: Storage["Service"] = {
    get: () => null,
    set: () => {
      throw new Error("the storage is full")
    }
  }
  const result = Effect.runSync(Effect.result(save("auto").pipe(Effect.provideService(Storage, full), Effect.provideService(World, worldOf(town)))))
  assert.equal(result._tag, "Failure")
  assert.equal((result as { failure: { _tag: string } }).failure._tag, "StorageFailed")
})

test("a save from before files had envelopes still loads", () => {
  const { town, storage, run } = setup()
  town.run(10)
  storage.set("town/save/charter", JSON.stringify(town.snapshot()))
  const before = playing(town)
  town.run(10)
  assert.equal(run(load("manual"))._tag, "Success")
  assert.equal(playing(town), before)
})

test("loading takes the newer of the mayor's save and the autosave", () => {
  const { town, storage, run } = setup()
  run(save("manual"))
  town.run(20)
  run(save("auto"))
  const auto = JSON.parse(storage.get("inkline-town/save/auto")!)
  const manual = JSON.parse(storage.get("inkline-town/save/manual")!)
  storage.set("inkline-town/save/manual", JSON.stringify({ ...manual, savedAt: 1000 }))
  storage.set("inkline-town/save/auto", JSON.stringify({ ...auto, savedAt: 2000 }))
  const loaded = run(loadLatest)
  assert.equal(loaded._tag, "Success")
  assert.equal((loaded as { success: { slot: string } }).success.slot, "auto")
  storage.set("inkline-town/save/manual", JSON.stringify({ ...manual, savedAt: 3000 }))
  assert.equal((run(loadLatest) as { success: { slot: string } }).success.slot, "manual")
  assert.equal(run(read("auto"))._tag, "Success")
})

test("a town saved before the guide loads, with the guide from its start", () => {
  const { town, storage, run } = setup()
  town.run(10)
  run(save("manual"))
  const file = JSON.parse(storage.get("inkline-town/save/manual")!)
  delete file.world.resources["Town/Guide"]
  storage.set("inkline-town/save/manual", JSON.stringify({ ...file, version: 6 }))
  assert.equal(run(load("manual"))._tag, "Success")
  assert.deepEqual(town.snapshot().resources["Town/Guide"], { done: [], off: false })
})
