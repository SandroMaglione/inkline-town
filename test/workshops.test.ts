import assert from "node:assert/strict"
import { test } from "node:test"
import * as THREE from "three"
import { makeBuilding, buildingSmokeOrigin, buildingDimensions } from "../src/asset-lab/buildings.ts"
import { workshopIds, workshopPoint } from "../src/asset-lab/workshops.ts"
import { vertex3 } from "../src/asset-lab/renderer.ts"
import { buildingAsset, noDoors } from "../src/render3d/models.ts"
import { sides } from "../src/asset-lab/primitives.ts"
import { U } from "../src/iso.ts"

test("open workshop forecourts retain air above the work floor on every road heading", () => {
  for (const id of workshopIds) for (const side of sides) {
    const doors = { ...noDoors, [side]: true }, asset = makeBuilding(id, { doors })
    const start = vertex3(workshopPoint([0, 12 * U, 14], doors))
    const end = vertex3(workshopPoint([0, 12 * U, 20], doors))
    const ray = new THREE.Ray(start, end.clone().sub(start).normalize())
    for (const face of asset.faces) for (let i = 1; i < face.points.length - 1; i++) {
      const hit = ray.intersectTriangle(vertex3(face.points[0]!), vertex3(face.points[i]!), vertex3(face.points[i + 1]!), false, new THREE.Vector3())
      assert.ok(!hit || hit.distanceTo(start) > end.distanceTo(start), `${id}/${side}: forecourt must stay open`)
    }
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
