import assert from "node:assert/strict"
import { test } from "node:test"
import { planPatrols } from "../src/game/rules/patrol.ts"
import { cellOf, GridBuilder, key, reach, roadPrint } from "../src/game/world/grid.ts"

const start = { x: 32, y: 32 }
const end = { x: 34, y: 32 }

// Different road networks that formerly shared the 32-bit fingerprint 0x9b93d059.
const connected = [848, 851, 909, 914, 916, 1033, 1169, 1229, 2080, 2081, 2082]
const blocked = [589, 655, 789, 916, 917, 1174, 1232, 1292, 2080, 2082]

const indexRoads = (cells: ReadonlyArray<number>) => {
  const builder = new GridBuilder()
  for (const k of cells) builder.claim({ ...cellOf(k), size: 1 }, k + 1, "road")
  const grid = builder.value()
  return { ...grid, roads: roadPrint(grid) }
}

test("road reachability is independent of which town previously filled the cache", () => {
  const goal = key(end.x, end.y)
  assert.equal(reach(indexRoads(connected), [start]).distance[goal], 2)
  assert.equal(reach(indexRoads(blocked), [start]).distance[goal], -1)
})

test("patrol plans do not inherit routes through missing road cells", () => {
  const station = { x: start.x - 1, y: start.y, size: 1 }
  const targets = [{ id: 1, tile: { x: end.x, y: end.y + 1, size: 1 } }]
  assert.deepEqual(planPatrols(indexRoads(connected), station, 6, targets).unreachable, [])
  assert.deepEqual(planPatrols(indexRoads(blocked), station, 6, targets), { tours: [], unreachable: [1] })
})
