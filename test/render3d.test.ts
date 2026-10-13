import assert from "node:assert/strict"
import { test } from "node:test"
import * as THREE from "three"
import { kindIds } from "../src/content.ts"
import { Drawing, type InkAsset } from "../src/asset-lab/primitives.ts"
import { buildingAsset, homeAsset, noDoors, treeVariant } from "../src/render3d/models.ts"
import { ModelHandle, ModelPool } from "../src/render3d/pool.ts"

function valid(asset: InkAsset) {
  for (const face of asset.faces) {
    assert.ok(face.points.every(p => p.every(Number.isFinite)), asset.id)
    const [a, b, c] = face.points
    assert.ok(a && b && c)
    const ab = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),
      ac = new THREE.Vector3(...c).sub(new THREE.Vector3(...a))
    assert.ok(ab.cross(ac).length() > 1e-10, `${asset.id}: zero-area face`)
  }
  for (const stroke of asset.strokes) assert.ok(stroke.points.every(p => p.every(Number.isFinite)), asset.id)
}

test("live construction and fitting are valid for every building and both home tiers", () => {
  for (const build of [0, 0.125, 0.3, 0.55, 0.77, 0.78, 0.8, 0.9, 1]) {
    for (const kind of kindIds) for (const side of Object.keys(noDoors)) {
      valid(buildingAsset(kind, build, 0.5, { ...noDoors, [side]: true }, 0.5))
    }
    for (const tier of [1, 2] as const) valid(homeAsset(tier, 0.62, build, 1, { ...noDoors, backLeft: true }))
  }
})

test("shared geometry retains independent colours, transforms and entity picking", () => {
  const pool = new ModelPool(), root = new THREE.Group()
  let built = 0
  const create = () => {
    built++
    const d = new Drawing("box", "Box", "")
    d.box(0, 0, 0.1, 0.1, 0, 5, 0xff0001, 0xff0001, 0xff0001)
    return d.asset
  }
  const a = new ModelHandle(pool, 17), b = new ModelHandle(pool, 29)
  root.add(a.root, b.root)
  b.root.position.x = 30
  a.colors = new Map([[0xff0001, 0x89aabb]])
  b.colors = new Map([[0xff0001, 0x663311]])
  a.use("box", create)
  b.use("box", create)
  pool.flush()
  assert.equal(built, 1)
  assert.equal(pool.stats().models, 2)
  const fill = pool.pickables().find(p => (p as THREE.Mesh).material instanceof THREE.MeshBasicMaterial &&
    (p as THREE.Mesh).geometry.getAttribute("inkNormalA") === undefined &&
    (p as THREE.Mesh).geometry.getAttribute("position").count === 36) as THREE.InstancedMesh
  assert.ok(fill)
  const color = new THREE.Color()
  fill.getColorAt(0, color)
  assert.equal(color.getHex(THREE.SRGBColorSpace), 0x89aabb)
  fill.getColorAt(1, color)
  assert.equal(color.getHex(THREE.SRGBColorSpace), 0x663311)
  pool.root.updateMatrixWorld(true)
  const ray = new THREE.Raycaster(new THREE.Vector3(30, 10, 0), new THREE.Vector3(0, -1, 0))
  const hit = ray.intersectObjects(pool.pickables(), false).find(h => h.instanceId !== undefined)
  assert.ok(hit)
  assert.equal(hit.object.userData.handles[hit.instanceId!].entity, 29)
  b.dispose()
  pool.flush()
  assert.equal(fill.count, 1)
  a.dispose()
  for (let i = 0; i < 100; i++) {
    a.use(`state/${i}`, create)
    pool.flush()
  }
  assert.ok(pool.stats().templates <= 65, "Idle animation/construction states must not accumulate")
  pool.dispose()
})

test("a seeded forest uses a bounded set of variants and preserves cell offsets", () => {
  const variants = new Set<string>()
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = treeVariant(x, y)
    variants.add(v.id)
    assert.ok(v.scale > 0.8 && v.scale < 1.25)
    assert.ok(v.offset.every(Number.isFinite))
  }
  assert.ok(variants.size <= 34)
})
