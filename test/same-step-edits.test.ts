/**
 * What is placed and taken back in the same step: ApplyEdits queues the
 * spawn, so no query sees it yet, and pulling it down (or founding a new
 * town) must despawn it through the id `spawn` returned, not leave it
 * standing off the grid.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { PAVE_COST, step, type CharterValue } from "../src/game/content/index.ts"
import { headless } from "../src/game/headless.ts"

const charter: CharterValue = { size: "small", term: 45, land: "fair", seed: 7 }
const roads = Array.from({ length: 9 }, (_, i) => ({ x: 34 + i, y: 31 }))
const home = { x: 36, y: 30 }

const at = (town: ReturnType<typeof headless>, cell: { readonly x: number; readonly y: number }) =>
  town.snapshot().entities.filter((entity) => {
    const tile = entity.components["Town/Tile"]
    return tile !== undefined && tile.x === cell.x && tile.y === cell.y
  })

test("a home placed and pulled down in the same step is gone", () => {
  const town = headless(charter)
  town.edit({ type: "roads", cells: roads }, { type: "homes", cells: [home] }, { type: "remove", cell: home })
  town.run(step.dt)
  assert.deepEqual(at(town, home), [])
  // The cell is free again: a home can go there next step.
  town.edit({ type: "homes", cells: [home] })
  town.run(step.dt)
  assert.equal(at(town, home).length, 1)
})

test("a new town founded in the same step as a placement keeps nothing of it", () => {
  const fresh = headless(charter)
  fresh.edit({ type: "newTown", charter })
  fresh.run(step.dt)

  const town = headless(charter)
  town.edit({ type: "roads", cells: roads }, { type: "homes", cells: [home] }, { type: "newTown", charter })
  town.run(step.dt)

  assert.equal(town.snapshot().entities.length, fresh.snapshot().entities.length)
  assert.deepEqual(at(town, home), at(fresh, home))
})

test("overlapping paving edits in one step charge for each road only once", () => {
  const town = headless(charter)
  const unpaved = roads.slice(0, 3)
  town.edit({ type: "roads", cells: unpaved })
  town.run(step.dt)
  const before = town.snapshot()

  town.edit({ type: "pave", cells: unpaved.slice(0, 2) }, { type: "pave", cells: unpaved.slice(1) })
  town.run(step.dt)
  const after = town.snapshot()

  assert.ok(unpaved.every((cell) => at(town, cell)[0]?.components["Town/Paved"]))
  assert.equal(before.resources["Town/Treasury"].coins - after.resources["Town/Treasury"].coins, 3 * PAVE_COST.coins)
  const stone = (snap: typeof before) => snap.entities.find((entity) => entity.components["Town/TownHall"])!.components["Town/Inventory"].stock.stone
  assert.equal(stone(before) - stone(after), 3 * PAVE_COST.stone)
})
