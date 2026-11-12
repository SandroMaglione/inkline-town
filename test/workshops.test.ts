import assert from "node:assert/strict"
import { test } from "node:test"
import { makeBuilding, buildingSmokeOrigin, buildingDimensions } from "../src/render/pixi3d/assets/buildings.ts"
import { workshopIds, workshopPoint } from "../src/render/pixi3d/assets/workshops.ts"
import { vertex3 } from "../src/render/pixi3d/assets/space.ts"
import { fan, segmentHits } from "../src/render/pixi3d/mesh/ray.ts"
import { buildingAsset, noDoors } from "../src/render/pixi3d/models.ts"
import { sides } from "../src/render/pixi3d/assets/primitives.ts"
import { U } from "../src/game/world/iso.ts"

test("open workshop forecourts retain air above the work floor on every road heading", () => {
  for (const id of workshopIds) for (const side of sides) {
    const doors = { ...noDoors, [side]: true }, asset = makeBuilding(id, { doors })
    const start = vertex3(workshopPoint([0, 12 * U, 14], doors))
    const end = vertex3(workshopPoint([0, 12 * U, 20], doors))
    assert.equal(segmentHits(start, end, asset.faces.flatMap(face => fan(face.points.map(vertex3)))).length, 0, `${id}/${side}: forecourt must stay open`)
    for (const p of [...asset.faces, ...asset.strokes].flatMap(part => part.points))
      assert.ok(Math.abs(p[0]) <= 15 * U && Math.abs(p[1]) <= 15 * U, `${id}/${side}: outside original plot`)
  }
})

test("the working smithy emitter follows its flue and the other open yards do not smoke", () => {
  for (const side of sides) {
    const doors = { ...noDoors, [side]: true }, asset = makeBuilding("smithy", { doors })
    const origin = buildingSmokeOrigin("smithy", doors)!
    assert.deepEqual(asset.smokeEffect?.origin, origin)
    const mouth = asset.faces.find(face => face.color === 0x68726c && face.points.every(p => p[2] > origin[2] - .5 && p[2] < origin[2]))!
    assert.ok(mouth, `flue mouth missing for ${side}`)
    const center = mouth.points.reduce((sum, p) => [sum[0]! + p[0], sum[1]! + p[1], sum[2]! + p[2]], [0, 0, 0]).map(n => n / mouth.points.length)
    assert.ok(Math.abs(center[0]! - origin[0]) < 0.0001 && Math.abs(center[1]! - origin[1]) < 0.0001)
    assert.ok(origin[2] > center[2]! && origin[2] - center[2]! < 0.5)
    assert.equal(buildingAsset("smithy", 1, null, doors, 1).smokeEffect, undefined, "live view owns the working smoke, without a duplicate catalogue plume")
  }
  for (const id of ["mine", "sawmill"] as const) assert.equal(buildingSmokeOrigin(id), null)
  const saw=makeBuilding("sawmill")
  assert.ok(buildingDimensions("sawmill").top >= Math.max(...saw.faces.flatMap(f=>f.points.map(p=>p[2]))))
})
