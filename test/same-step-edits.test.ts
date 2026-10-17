/**
 * What is placed and taken back in the same step: ApplyEdits queues the
 * spawn, so no query sees it yet, and pulling it down (or founding a new
 * town) must despawn it through the id `spawn` returned, not leave it
 * standing off the grid.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { STEP_SECONDS, type CharterValue } from "../src/content.ts"
import { headless } from "../src/sim/headless.ts"

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
  town.run(STEP_SECONDS)
  assert.deepEqual(at(town, home), [])
  // The cell is free again: a home can go there next step.
  town.edit({ type: "homes", cells: [home] })
  town.run(STEP_SECONDS)
  assert.equal(at(town, home).length, 1)
})

test("a new town founded in the same step as a placement keeps nothing of it", () => {
  const fresh = headless(charter)
  fresh.edit({ type: "newTown", charter })
  fresh.run(STEP_SECONDS)

  const town = headless(charter)
  town.edit({ type: "roads", cells: roads }, { type: "homes", cells: [home] }, { type: "newTown", charter })
  town.run(STEP_SECONDS)

  assert.equal(town.snapshot().entities.length, fresh.snapshot().entities.length)
  assert.deepEqual(at(town, home), at(fresh, home))
})
