/**
 * `Households` reads `Grid` with `Game.System.thisTick`: `IndexGrid`, its only
 * writer, must run before it in the same step, or a home whose road was just
 * removed keeps its residents a step too long. `simulate` compiles because it
 * does; this locks the check in.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { Game } from "../src/schema.ts"
import { headless } from "../src/sim/headless.ts"
import { Households } from "../src/sim/town.ts"
import { IndexGrid } from "../src/sim/work.ts"

test("a Grid writer placed after Households fails to compile and tryTick rejects it", () => {
  const town = headless({ size: "small", term: 45, land: "fair", seed: 7 })
  const misordered = Game.Schedule(Households, IndexGrid)
  // Never called: the compile error is the test.
  const compileTime = () =>
    // @ts-expect-error Town/Households needs Town/Grid from this tick, but its writer Town/IndexGrid runs after it
    town.runtime.tick(misordered)
  void compileTime
  const result = town.runtime.tryTick(misordered)
  assert.equal(result.ok, false)
  assert.ok(!result.ok && result.error.kind === "TickOrderViolation" && result.error.issues.some((issue) => issue.writer === "Town/IndexGrid"))
})
