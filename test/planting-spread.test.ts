import assert from "node:assert/strict"
import { test } from "node:test"
import { step } from "../src/game/content/index.ts"
import { shippedRules } from "../src/game/rules/config.ts"
import { cellsOf, key } from "../src/game/world/grid.ts"
import { GRID } from "../src/game/world/iso.ts"
import { district } from "../tools/balance/scenario.ts"
import { fixture } from "../tools/balance/verify/fixture.ts"

test("wild regrowth and a forester cannot plant the same cell in one step", () => {
  const rules = shippedRules
  const base = district("one planting cell", [1, 1, 1, 1], ["forester"], false, rules)
  const forester = base.buildings.find((b) => b.kind === "forester")!
  const spot = { x: forester.tile.x + 1, y: forester.tile.y + forester.tile.size + 1 }
  const land = [{ ...spot, x: spot.x - 1 }, { ...spot, y: spot.y + 1 }].map((cell) => ({
    tile: { ...cell, size: 1 }, type: "tree" as const, amount: 1, growth: rules.grown.tree
  }))
  // Leave just one vacant cell. It is in range of the forester and connected to both mature trees.
  const occupied = [...base.roads, ...base.buildings.flatMap((b) => cellsOf(b.tile)), ...base.homes.map((h) => h.tile), ...land.map((l) => l.tile)]
  const mask = new Array<string>(GRID * GRID).fill("0")
  for (const cell of [...occupied, spot]) mask[key(cell.x, cell.y)] = "1"
  const town = fixture({ ...base, tick: rules.spreadTicks - 2, mask: mask.join(""), land }, rules)
  town.run(step.dt)

  const onSpot = town.snapshot().entities.filter(({ components }) => {
    const tile = components["Town/Tile"]
    return tile?.x === spot.x && tile.y === spot.y
  })
  assert.equal(onSpot.length, 1)
  assert.equal(onSpot[0]?.components["Town/Tree"]?.growth, 0)
  const foresterAfter = town.snapshot().entities.find((e) => e.id === forester.id)
  assert.ok(foresterAfter?.components["Town/Planter"]?.cooldown > 0, "the forester claimed the shared spot")
})
