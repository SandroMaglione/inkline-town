/**
 * Saving and loading (`src/platform/save.ts`) against a real headless town and
 * storage in a map: every way a load can go, and that a failed one leaves
 * the town as it was.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { Effect } from "effect"

import { load, loadLatest, memoryStorage, read, save, SAVE_FORMAT, SAVE_VERSION, Storage, World, type LoadError } from "../src/platform/save.ts"
import { headless, type Headless } from "../src/game/headless.ts"

const worldOf = (town: Headless): World["Service"] => ({
  snapshot: () => town.snapshot(),
  restore: (data) => {
    try {
      town.restore(data)
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

test("a town saved complete, before terms followed one another, loads as a town playing on", () => {
  const { town, storage, run } = setup()
  town.run(10)
  run(save("manual"))
  const file = JSON.parse(storage.get("inkline-town/save/manual")!)
  const { term: _t, began: _b, rank: _r, ...fate } = file.world.resources["Town/Fate"]
  file.world.resources["Town/Fate"] = { ...fate, state: "won", reason: "The town is complete.", governing: false, won: -1 }
  storage.set("inkline-town/save/manual", JSON.stringify({ ...file, version: 7 }))
  assert.equal(run(load("manual"))._tag, "Success")
  const loaded = town.snapshot().resources["Town/Fate"]
  assert.equal(loaded.state, "playing")
  assert.equal(loaded.reason, "")
  assert.equal(loaded.rank, 2)
  assert.equal(loaded.term, 1)
  assert.equal(loaded.began, 0)
  assert.equal("governing" in loaded, false)
})

test("a town saved mid-term, before ranks, loads as a hamlet", () => {
  const { town, storage, run } = setup()
  town.run(10)
  run(save("manual"))
  const file = JSON.parse(storage.get("inkline-town/save/manual")!)
  const { term: _t, began: _b, rank: _r, ...fate } = file.world.resources["Town/Fate"]
  file.world.resources["Town/Fate"] = { ...fate, governing: false, won: -1 }
  storage.set("inkline-town/save/manual", JSON.stringify({ ...file, version: 7 }))
  assert.equal(run(load("manual"))._tag, "Success")
  const loaded = town.snapshot().resources["Town/Fate"]
  assert.equal(loaded.state, "playing")
  assert.equal(loaded.rank, 0)
})

/** A save as version 8 wrote it: no furniture anywhere, and no trade load for it. */
const beforeFurniture = (world: Record<string, any>) => {
  const strip = (v: unknown): unknown =>
    Array.isArray(v) ? v.filter((x) => x !== "furniture").map(strip)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "furniture").map(([k, x]) => [k, strip(x)]))
    : v
  return strip(world)
}

test("a town saved before furniture loads with none of it, and stores and markets that take it", () => {
  const { town, storage, run } = setup()
  const hall = town.snapshot().entities.find((e) => e.components["Town/TownHall"])!.components["Town/Tile"]
  // A street off the hall's ring road, homes along it, and a market and sawmill on its far side.
  town.edit(
    { type: "roads", cells: [4, 5, 6, 7, 8, 9, 10, 11].map((dx) => ({ x: hall.x + dx, y: hall.y + 1 })) },
    { type: "homes", cells: [5, 6, 7, 8].map((dx) => ({ x: hall.x + dx, y: hall.y + 2 })) },
    { type: "building", kind: "market", cell: { x: hall.x + 4, y: hall.y - 1 }, open: false },
    { type: "building", kind: "sawmill", cell: { x: hall.x + 6, y: hall.y - 1 }, open: false }
  )
  town.run(120)
  const before = town.snapshot()
  const kinds = new Set(before.entities.map((e) => e.components["Town/Building"]?.kind))
  for (const k of ["market", "sawmill"]) assert(kinds.has(k), `no ${k} was built`)
  assert(before.entities.some((e) => e.components["Town/House"] && !e.components["Town/Site"]), "no home stands")
  run(save("manual"))
  const file = JSON.parse(storage.get("inkline-town/save/manual")!)
  const old = beforeFurniture(file.world) as typeof file.world
  assert.equal(JSON.stringify(old).includes("furniture"), false)
  storage.set("inkline-town/save/manual", JSON.stringify({ ...file, version: 8, world: old }))
  town.run(30)
  assert.equal(run(load("manual"))._tag, "Success")
  // With no furniture yet made, the carried town is the town as it was saved: furniture at its first price, too.
  const { nextEntity: _, ...world } = before
  assert.deepEqual(JSON.parse(playing(town)), world)
  const accepts = (kind: string) => town.snapshot().entities.find((e) => e.components["Town/Building"]?.kind === kind)!.components["Town/Inventory"].accepts
  assert(accepts("market").includes("furniture"))
  assert(accepts("townhall").includes("furniture"))
  assert.equal(accepts("sawmill").includes("furniture"), false)
})

test("a finer home saved before homes paid to rise keeps its rebuilding", () => {
  const { town, storage, run } = setup()
  const hall = town.snapshot().entities.find((e) => e.components["Town/TownHall"])!.components["Town/Tile"]
  town.edit({ type: "homes", cells: [{ x: hall.x + 4, y: hall.y }, { x: hall.x + 4, y: hall.y + 1 }] })
  town.run(60)
  town.change((s) => {
    for (const [i, e] of s.entities.filter((e) => e.components["Town/House"] && !e.components["Town/Site"]).entries()) e.components["Town/House"].tier = i === 0 ? 2 : 3
  })
  run(save("manual"))
  const file = JSON.parse(storage.get("inkline-town/save/manual")!)
  storage.set("inkline-town/save/manual", JSON.stringify({ ...file, version: 8, world: beforeFurniture(file.world) }))
  assert.equal(run(load("manual"))._tag, "Success")
  const rebuilt = town.snapshot().entities.filter((e) => e.components["Town/House"]).map((e) => [e.components["Town/House"].tier, e.components["Town/Rebuilt"]?.tier])
  assert.deepEqual(rebuilt.sort(), [[2, 2], [3, 3]])
})
