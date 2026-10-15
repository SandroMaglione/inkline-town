import assert from "node:assert/strict"
import { test } from "node:test"
import * as THREE from "three"
import { makeBuilding, buildingSmokeOrigin } from "../src/asset-lab/buildings.ts"
import { tradeYardIds } from "../src/asset-lab/trades.ts"
import { workshopPoint } from "../src/asset-lab/workshops.ts"
import { type InkAsset, sides } from "../src/asset-lab/primitives.ts"
import { buildingAsset, noDoors } from "../src/render3d/models.ts"
import { vertex3 } from "../src/asset-lab/renderer.ts"
import { kinds } from "../src/content.ts"
import { U } from "../src/iso.ts"

function hits(asset: InkAsset, start: THREE.Vector3, end: THREE.Vector3) {
  const ray = new THREE.Ray(start, end.clone().sub(start).normalize())
  return asset.faces.flatMap(face => face.points.slice(1, -1).flatMap((_, i) => {
    const hit = ray.intersectTriangle(vertex3(face.points[0]!), vertex3(face.points[i + 1]!), vertex3(face.points[i + 2]!), false, new THREE.Vector3())
    return hit && hit.distanceTo(start) <= end.distanceTo(start) ? [hit] : []
  }))
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
    const mouth = asset.faces.find(face => face.points.every(p => Math.abs(p[2] - 48.02) < 0.0001))!
    assert.ok(mouth)
    const center = mouth.points.reduce((sum, p) => [sum[0]! + p[0], sum[1]! + p[1]], [0, 0]).map(n => n / mouth.points.length)
    assert.ok(Math.abs(center[0]! - origin[0]) < 0.0001 && Math.abs(center[1]! - origin[1]) < 0.0001)
    assert.equal(buildingAsset("bakery", 1, null, doors, 1).smokeEffect, undefined)
  }
})
