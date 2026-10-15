import assert from "node:assert/strict"
import { test } from "node:test"
import { inkAssets, assetById } from "../src/asset-lab/assets.ts"
import { kindIds, goodIds, kinds } from "../src/content.ts"
import { testMap } from "../src/map-lab/map.ts"
import { U } from "../src/iso.ts"
import { makeRock } from "../src/asset-lab/land.ts"
import { church, marketHall, quartersFor } from "../src/asset-lab/service-upgrades.ts"

test("the portable catalogue covers all world object families", () => {
  assert.equal(assetById.size, inkAssets.length, "Asset IDs must be unique")
  for (const id of kindIds) {
    const a = assetById.get(id)!
    assert.equal(a.reference?.type, "building", id)
    assert.equal(a.footprint, kinds[id].size, id)
  }
  for (const good of goodIds) {
    assert.ok(assetById.has(`goods-${good}`))
    assert.ok(assetById.has(`crate-${good}`))
    for (const vehicle of ["cart", "barrow"]) for (const count of [1, 4]) assert.ok(assetById.has(`${vehicle}-${good}-${count}`))
  }
  const hats = new Set(inkAssets.flatMap((a) => (a.reference?.type === "walker" ? [a.reference.dress.hat] : [])))
  assert.deepEqual([...hats].sort(), ["bonnet", "brim", "cap", "hood", "none", "top"])
  for (const tier of [1, 2]) assert.equal(inkAssets.filter((a) => a.reference?.type === "house" && a.reference.tier === tier && !a.appearance).length, 4)
  assert.equal(inkAssets.filter((a) => a.reference?.type === "tree").length, 9)
  // Stone and ore, full, quarried, and worked down to a face, one cell; and full outcrops over 2×1, 2×2, and 3×3 cells.
  assert.equal(inkAssets.filter((a) => a.reference?.type === "rock").length, 12)
  assert.equal(inkAssets.filter((a) => a.reference?.type === "field").length, 4)
})

test("all geometry is finite, nondegenerate and uses valid ink weights", () => {
  for (const a of inkAssets) {
    assert.ok(a.faces.length + a.strokes.length > 0, a.id)
    for (const face of a.faces) {
      assert.ok(face.points.length >= 3, a.id)
      for (const p of face.points) assert.ok(p.every(Number.isFinite), a.id)
      const [a0, b, c] = face.points as [readonly number[], readonly number[], readonly number[], ...unknown[]]
      const ab = b.map((n, i) => n - a0[i]!),
        ac = c.map((n, i) => n - a0[i]!)
      const cross = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!]
      assert.ok(Math.hypot(...cross) > 1e-10, `${a.id}: zero-area face`)
    }
    for (const stroke of a.strokes) {
      assert.ok(stroke.width >= 0 && Number.isFinite(stroke.width), a.id)
      assert.ok(stroke.opacity >= 0 && stroke.opacity <= 1, a.id)
      for (const p of stroke.points) assert.ok(p.every(Number.isFinite), a.id)
    }
  }
})

test("service upgrades retain the original plot and declare their family and tier", () => {
  for (const [id, kind] of [["market-hall", "market"], ["church", "chapel"]] as const) {
    const asset = assetById.get(id)!, original = assetById.get(kind)!
    assert.deepEqual(asset.reference, { type: "building", kind, tier: 2 })
    assert.equal(asset.footprint, original.footprint)
    const points = [...asset.faces, ...asset.strokes].flatMap(part => part.points)
    const edge = (kinds[kind].size * 8 - 1) * U
    assert.ok(points.every(([u, v]) => Math.abs(u) <= edge && Math.abs(v) <= edge), `${id}: geometry leaves its plot`)
    const height = (a: typeof asset) => Math.max(...a.faces.flatMap(f => f.points.map(p => p[2])))
    assert.ok(height(asset) > height(original), `${id}: upgrade should have a taller silhouette`)
  }
})

test("the review map includes every catalogue model at least once", () => {
  const represented = new Set(testMap.buildings.map((p) => p.asset))
  assert.deepEqual([...represented].sort(), inkAssets.map((a) => a.id).sort())
  assert.equal(testMap.coverage, inkAssets.length)
})

test("buildings, homes and resource deposits stay inside their plates", () => {
  const models = [...inkAssets.filter(a=>a.reference?.type==="building"||a.reference?.type==="house"),...Array.from({length:6},(_,i)=>[makeRock(false,true,i),makeRock(true,true,i),makeRock(false,"worked",i),makeRock(true,"worked",i),makeRock(false,"worked",i,3,3)]).flat()]
  for(const a of models){
    const half=(a.footprint!*8-1)*U
    for(const p of [...a.faces.flatMap(f=>f.points),...a.strokes.flatMap(s=>s.points)])assert.ok(Math.abs(p[0])<=half+0.0001&&Math.abs(p[1])<=half+0.0001,`${a.id}: geometry outside the ${a.footprint}-cell plate`)
  }
})

test("an upgraded market or church turns to face its road, keeping its plot and its light", () => {
  for (const side of ["right", "left", "backRight", "backLeft"] as const) {
    const doors = { [side]: true }
    const q = quartersFor("chapel", doors)
    assert.ok(q >= 0 && q < 4)
    for (const asset of [church({ plate: false, doors }), marketHall({ plate: false, doors })]) {
      const edge = (kinds.market.size * 8 - 1) * U
      assert.ok(asset.faces.every((f) => f.points.every(([u, v]) => Math.abs(u) <= edge + 1e-9 && Math.abs(v) <= edge + 1e-9)), `${asset.id} facing ${side}`)
      assert.ok(!asset.faces.some((f) => f.color === 0xf5f6f2), `${asset.id}: no plate in the town`)
    }
  }
  // The church's tower door is on its +v side as drawn: turned to the road on each side.
  const towerAt = (doors: Record<string, boolean>) => {
    const tall = church({ plate: false, doors }).faces.flatMap((f) => f.points).filter((p) => p[2] > 110)
    const [u, v] = [tall.reduce((n, p) => n + p[0], 0) / tall.length, tall.reduce((n, p) => n + p[1], 0) / tall.length]
    return Math.abs(u) > Math.abs(v) ? (u > 0 ? "right" : "backRight") : v > 0 ? "left" : "backLeft"
  }
  for (const side of ["right", "left", "backRight", "backLeft"]) assert.equal(towerAt({ [side]: true }), side)
  // Lit faces stay lit: as many of the church's faces carry the lit wall colour whichever way it turns.
  const lit = (doors: Record<string, boolean>) => church({ plate: false, doors }).faces.filter((f) => f.color === 0xe9ebe5).length
  assert.equal(lit({ right: true }), lit({ left: true }))
})
