/**
 * From a replay (the replay loop's dry run, see PLAYTEST.md): a homes edit
 * along a fresh road puts every cottage down in the same step, empty. The
 * replay showed ApplyEdits spawning all four in tick 2; this keeps it so
 * without the replay file.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { step } from "../src/content.ts"
import { headless } from "../src/sim/headless.ts"

test("a homes edit along a fresh road raises every cottage in one step, empty", () => {
  const town = headless({ size: "small", term: 45, land: "fair", seed: 7 })
  const homes = [{ x: 35, y: 30 }, { x: 36, y: 30 }, { x: 37, y: 30 }, { x: 38, y: 30 }]
  town.edit(
    { type: "roads", cells: Array.from({ length: 9 }, (_, i) => ({ x: 34 + i, y: 31 })) },
    { type: "homes", cells: homes }
  )
  town.run(step.dt)
  const houses = town.snapshot().entities.filter((entity) => entity.components["Town/House"] !== undefined)
  assert.deepEqual(
    houses.map((entity) => ({ tile: entity.components["Town/Tile"], residents: entity.components["Town/House"].residents })),
    homes.map((cell) => ({ tile: { ...cell, size: 1 }, residents: 0 }))
  )
})
