import assert from "node:assert/strict"
import { test } from "node:test"
import { makeBuilding, buildingDimensions } from "../src/render/pixi3d/assets/buildings.ts"
import { ruralDoorIds } from "../src/render/pixi3d/assets/rural.ts"
import { sides, type InkAsset } from "../src/render/pixi3d/assets/primitives.ts"
import { vertex3 } from "../src/render/pixi3d/assets/space.ts"
import { fan, segmentHits } from "../src/render/pixi3d/mesh/ray.ts"
import { noDoors } from "../src/render/pixi3d/models.ts"
import { kinds } from "../src/game/content/index.ts"
import { U } from "../src/game/world/iso.ts"

test("rural timber doors stay within their plots when opened on any road face", () => {
  for (const id of ruralDoorIds) for (const side of sides) for (const open of [0, 0.5, 1]) {
    const asset = makeBuilding(id, { doors: { ...noDoors, [side]: true }, open })
    const half = (kinds[id].size * 8 - 1) * U
    for (const p of [...asset.faces, ...asset.strokes].flatMap(part => part.points))
      assert.ok(Math.abs(p[0]) <= half + 0.0001 && Math.abs(p[1]) <= half + 0.0001, `${id}/${side}/${open}: leaves original plot`)
  }
})

function verticalHits(asset: InkAsset, u: number, v: number, from: number, to: number) {
  return segmentHits(vertex3([u * U, v * U, from]), vertex3([u * U, v * U, to]), asset.faces.flatMap(face => fan(face.points.map(vertex3))))
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
