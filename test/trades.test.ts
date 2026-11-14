import assert from "node:assert/strict"
import { test } from "node:test"
import { makeBuilding, buildingSmokeOrigin } from "../src/render/pixi3d/assets/buildings.ts"
import { tradeYardIds } from "../src/render/pixi3d/assets/trades.ts"
import { workshopPoint } from "../src/render/pixi3d/assets/workshops.ts"
import { type InkAsset, sides } from "../src/render/pixi3d/assets/primitives.ts"
import { buildingAsset, noDoors } from "../src/render/pixi3d/models.ts"
import { vertex3 } from "../src/render/pixi3d/assets/space.ts"
import { fan, segmentHits } from "../src/render/pixi3d/mesh/ray.ts"
import type { Vec3 } from "../src/render/pixi3d/mesh/vec3.ts"
import { kinds } from "../src/game/content/index.ts"
import { U } from "../src/game/world/iso.ts"

function hits(asset: InkAsset, start: Vec3, end: Vec3) {
  return segmentHits(start, end, asset.faces.flatMap(face => fan(face.points.map(vertex3))))
}

test("trade yards keep open approaches and remain inside their plots through construction and work", () => {
  for (const id of tradeYardIds) for (const side of sides) for (const build of [0.3, 0.6, 0.85, 1]) {
    const doors = { ...noDoors, [side]: true }, asset = buildingAsset(id, build, 0.5, doors, 1)
    const half = (kinds[id].size * 8 - 1) * U
    for (const p of [...asset.faces, ...asset.strokes].flatMap(part => part.points))
      assert.ok(Math.abs(p[0]) <= half && Math.abs(p[1]) <= half, `${id}/${side}/${build}: outside original plot`)
    const v = (id === "warehouse" ? 20 : 12) * U
    assert.equal(hits(asset, vertex3(workshopPoint([0, v, 14], doors)), vertex3(workshopPoint([0, v, 20], doors))).length, 0, `${id}: approach must remain open`)
  }
})

test("the bakery oven is recessed masonry, with smoke attached to its actual flue", () => {
  for (const side of sides) {
    const doors = { ...noDoors, [side]: true }, asset = makeBuilding("bakery", { doors })
    const at = (v: number) => vertex3(workshopPoint([-6 * U, v * U, 10], doors))
    assert.equal(hits(asset, at(12), at(0)).length, 0, `${side}: the oven mouth must be open`)
    assert.ok(hits(asset, at(12), at(-2)).length > 0, `${side}: the oven needs a back`)
    const origin = buildingSmokeOrigin("bakery", doors)!
    assert.deepEqual(asset.smokeEffect?.origin, origin)
    const mouth = asset.faces.find(face => face.color === 0x68726c && face.points.every(p => p[2] > origin[2] - .5 && p[2] < origin[2]))!
    assert.ok(mouth)
    const center = mouth.points.reduce((sum, p) => [sum[0]! + p[0], sum[1]! + p[1]], [0, 0]).map(n => n / mouth.points.length)
    assert.ok(Math.abs(center[0]! - origin[0]) < 0.0001 && Math.abs(center[1]! - origin[1]) < 0.0001)
    assert.equal(buildingAsset("bakery", 1, null, doors, 1).smokeEffect, undefined)
  }
})
