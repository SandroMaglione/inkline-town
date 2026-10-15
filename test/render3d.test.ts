import assert from "node:assert/strict"
import { test } from "node:test"
import * as THREE from "three"
import { kindIds } from "../src/content.ts"
import { Drawing, type InkAsset } from "../src/asset-lab/primitives.ts"
import { buildingAsset, buildingHeight, homeAsset, noDoors, treeVariant } from "../src/render3d/models.ts"
import { upgradeHeights } from "../src/asset-lab/service-upgrades.ts"
import { ModelHandle, ModelPool } from "../src/render3d/pool.ts"
import { assetById } from "../src/asset-lab/assets.ts"
import { surfaceState, hazardStrength } from "../src/render3d/surface-state.ts"
import { StructureEffects } from "../src/render3d/structure-effects.ts"

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

test("live construction and fitting are valid for every building and all three home tiers", () => {
  for (const build of [0, 0.125, 0.3, 0.55, 0.77, 0.78, 0.8, 0.9, 1]) {
    for (const kind of kindIds) for (const side of Object.keys(noDoors)) {
      valid(buildingAsset(kind, build, 0.5, { ...noDoors, [side]: true }, 0.5))
    }
    for (const tier of [1, 2, 3] as const) valid(homeAsset(tier, 0.62, build, 1, { ...noDoors, backLeft: true }))
  }
})

test("live service upgrades retain their taller models and material bounds beside the revised base buildings", () => {
  for (const id of ["market", "chapel"] as const) for (const side of Object.keys(noDoors)) {
    const doors = { ...noDoors, [side]: true }
    const base = buildingAsset(id, 1, null, doors, 1)
    const upgraded = buildingAsset(id, 1, null, doors, 1, { winter: true }, true)
    valid(upgraded)
    assert.equal(upgraded.reference?.type === "building" && upgraded.reference.tier, 2)
    const top = (asset: InkAsset) => Math.max(...asset.faces.flatMap(face => face.points.map(p => p[2])))
    assert.ok(top(upgraded) > top(base), `${id}/${side}: live upgrade lost its silhouette`)
    assert.equal(buildingHeight(id, true), upgradeHeights[id].eave)
    assert.equal(upgraded.effects?.height, upgradeHeights[id].eave)
    assert.equal(upgraded.effects?.state.snow, 1)
  }
  for (const [id, height] of [["bakery", 28], ["weaver", 30], ["fishery", 20]] as const)
    assert.equal(buildingHeight(id), height, `${id}: public height must follow the revised model`)
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

test("surface states preserve the base geometry instead of making variant meshes", () => {
  for (const id of ["granary", "smokehouse", "firewatch", "healer", "hospital", "watchhouse", "builder"] as const) {
    const plain = buildingAsset(id, 1, null, noDoors, 0)
    for (const appearance of ["worn", "winter"] as const) {
      const model = buildingAsset(id, 1, null, noDoors, 0, { worn: appearance === "worn", winter: appearance === "winter" })
      valid(model)
      assert.ok(assetById.has(`${id}-${appearance}`))
      assert.deepEqual(model.faces,plain.faces)
      assert.deepEqual(model.strokes,plain.strokes)
      assert.ok(model.effects)
    }
  }
  for (const tier of [1, 2, 3] as const) {
    const plain = homeAsset(tier, 0.03, 1, null, noDoors)
    for (const look of [{ band: "fine" as const }, { band: "poor" as const }, { worn: true }, { winter: true }]) {
      const model = homeAsset(tier, 0.03, 1, null, noDoors, look)
      valid(model)
      assert.deepEqual(model.faces,plain.faces)
      assert.deepEqual(model.strokes,plain.strokes)
      assert.ok(model.effects)
    }
  }
})

test("different surface states share geometry and remain independent per instance", () => {
  const pool=new ModelPool(),a=new ModelHandle(pool),b=new ModelHandle(pool)
  let built=0
  const create=()=>{built++;return homeAsset(2,0.28,1,null,noDoors)}
  a.use("home",create);b.use("home",create)
  a.effectBounds.set(12,30,0.1,1);b.effectBounds.copy(a.effectBounds)
  a.effects=surfaceState({snow:1});b.effects=surfaceState({wear:0.9,burning:1})
  pool.flush()
  // Non-pickable effects use the same pool; inspect the render batch directly.
  const part=pool.root.children[0]!.children[0] as THREE.Mesh
  const state=part.geometry.getAttribute("structureState")
  assert.equal(state.getZ(0),1);assert.equal(state.getX(1),Math.fround(0.9));assert.equal(state.getW(1),1)
  for(let i=0;i<100;i++){a.effects=surfaceState({wear:i/100});pool.flush()}
  assert.equal(built,1);assert.equal(pool.stats().templates,1)
  const particles=new StructureEffects(create(),26)
  particles.set(surfaceState({burning:1}));particles.update(0)
  assert.equal(particles.group.children.length,3)
  particles.update(100);assert.equal(particles.group.children.length,3)
  particles.set(surfaceState());assert.equal(particles.group.visible,false)
  particles.dispose();pool.dispose()
})

test("hazard effects become visible at the warning threshold and remain bounded", () => {
  assert.equal(hazardStrength(6999,7000,10000),0)
  assert.equal(hazardStrength(7000,7000,10000),0.35)
  assert.equal(hazardStrength(10000,7000,10000),1)
  assert.equal(hazardStrength(12000,7000,10000),1)
})
