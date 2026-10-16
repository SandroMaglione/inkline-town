import assert from "node:assert/strict"
import { test } from "node:test"
import * as THREE from "three"
import { makeBuilding, buildingDimensions } from "../src/asset-lab/buildings.ts"
import { ruralDoorIds } from "../src/asset-lab/rural.ts"
import { sides, type InkAsset } from "../src/asset-lab/primitives.ts"
import { vertex3 } from "../src/asset-lab/renderer.ts"
import { noDoors } from "../src/render3d/models.ts"
import { kinds } from "../src/content.ts"
import { U } from "../src/iso.ts"

test("rural timber doors stay within their plots when opened on any road face", () => {
  for (const id of ruralDoorIds) for (const side of sides) for (const open of [0, 0.5, 1]) {
    const asset = makeBuilding(id, { doors: { ...noDoors, [side]: true }, open })
    const half = (kinds[id].size * 8 - 1) * U
    for (const p of [...asset.faces, ...asset.strokes].flatMap(part => part.points))
      assert.ok(Math.abs(p[0]) <= half + 0.0001 && Math.abs(p[1]) <= half + 0.0001, `${id}/${side}/${open}: leaves original plot`)
  }
})

function verticalHits(asset: InkAsset, u: number, v: number, from: number, to: number) {
  const start = vertex3([u * U, v * U, from]), end = vertex3([u * U, v * U, to])
  const ray = new THREE.Ray(start, end.clone().sub(start).normalize())
  return asset.faces.flatMap(face => face.points.slice(1, -1).flatMap((_, i) => {
    const hit = ray.intersectTriangle(vertex3(face.points[0]!), vertex3(face.points[i + 1]!), vertex3(face.points[i + 2]!), false, new THREE.Vector3())
    return hit && hit.distanceTo(start) <= end.distanceTo(start) ? [hit] : []
  }))
}

test("the fire-watch ladder landing and every roof tread connect to the lookout without roof obstruction", () => {
  const asset = makeBuilding("firewatch")
  const landing = buildingDimensions("firewatch").height + 8.5
  const stations = [
    [12.3, -4.5, landing],
    ...Array.from({ length: 7 }, (_, i) => {
      const t = (i + 0.5) / 7
      return [11 - 7 * t, -4.5 + 2.7 * t, landing + 6 * (i + 1) / 7]
    }),
    [3.9, -1.8, landing + 6]
  ]
  for (const [u, v, z] of stations) {
    assert.ok(verticalHits(asset, u!, v!, z! + 0.1, z! - 0.65).length > 0, `Unsupported route at ${u}/${v}/${z}`)
    assert.equal(verticalHits(asset, u!, v!, z! + 0.1, z! + 17).length, 0, `Roof obstructs a walker at ${u}/${v}/${z}`)
  }
  const highest = Math.max(...asset.faces.flatMap(face => face.points.map(p => p[2])))
  assert.ok(buildingDimensions("firewatch").top >= highest, "Problem marker must sit above the lookout roof")
})
