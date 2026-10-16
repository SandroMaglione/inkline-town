import assert from "node:assert/strict"
import { test } from "node:test"
import * as THREE from "three"
import { kindIds, kinds } from "../src/content.ts"
import { U } from "../src/iso.ts"
import { dressed } from "../src/asset-lab/upgrade-dress.ts"
import { Drawing, type InkAsset } from "../src/asset-lab/primitives.ts"
import { buildingAsset, buildingHeight, buildingTop, homeAsset, noDoors, scaffoldAsset, treeVariant } from "../src/render3d/models.ts"
import { upgradeHeights } from "../src/asset-lab/service-upgrades.ts"
import { ModelHandle, ModelPool } from "../src/render3d/pool.ts"
import { assetById } from "../src/asset-lab/assets.ts"
import { surfaceState, hazardStrength } from "../src/render3d/surface-state.ts"
import { StructureEffects } from "../src/render3d/structure-effects.ts"
import { vertex3 } from "../src/asset-lab/renderer.ts"

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
    const upgraded = buildingAsset(id, 1, null, doors, 1, { winter: true }, 1)
    valid(upgraded)
    assert.equal(upgraded.reference?.type === "building" && upgraded.reference.tier, 2)
    const top = (asset: InkAsset) => Math.max(...asset.faces.flatMap(face => face.points.map(p => p[2])))
    assert.ok(top(upgraded) > top(base), `${id}/${side}: live upgrade lost its silhouette`)
    assert.equal(buildingHeight(id, 1), upgradeHeights[id].eave)
    assert.equal(upgraded.effects?.height, upgradeHeights[id].eave)
    assert.equal(upgraded.effects?.state.snow, 1)
  }
  for (const [id, height] of [["bakery", 26], ["weaver", 26], ["fishery", 24], ["carpenter", 28]] as const)
    assert.equal(buildingHeight(id), height, `${id}: public height must follow the revised model`)
})

test("workplace and civic upgrades stay inside their plots in every orientation and retain marker clearance", () => {
  for (const id of dressed) for (const level of id === "townhall" ? [1, 2] : [1]) for (const side of Object.keys(noDoors)) {
    const doors = { ...noDoors, [side]: true }
    const base = buildingAsset(id, 1, null, doors, 1), up = buildingAsset(id, 1, null, doors, 1, {}, level)
    valid(up)
    const plot = kinds[id].size * 8 * U + 1e-9
    const reach = (asset: InkAsset) => Math.max(...[...asset.faces.flatMap((f) => f.points), ...asset.strokes.flatMap((s) => s.points)].map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))))
    assert.ok(reach(up) <= plot, `${id}/${level}: the upgrade reaches past its plot (${reach(up)} > ${plot})`)
    assert.ok(up.faces.length + up.strokes.length > base.faces.length + base.strokes.length, `${id}/${level}: nothing is added`)
    assert.ok(buildingTop(id, level) >= buildingTop(id, 0), `${id}/${level}: its marker sinks`)
    const actualTop = Math.max(...up.faces.flatMap(f => f.points.map(p => p[2])), ...up.strokes.flatMap(s => s.points.map(p => p[2])))
    assert.ok(buildingTop(id, level) + 0.1 >= actualTop, `${id}/${level}: marker bounds miss geometry (${actualTop})`)
  }
})

test("civic milestones have progressively taller silhouettes, road-facing entrances and correct surface bounds", () => {
  let previous=buildingTop("townhall")
  for(const level of [1,2]) {
    assert.ok(buildingTop("townhall",level)>previous+5,"Each civic milestone must change the skyline")
    previous=buildingTop("townhall",level)
    for(const side of Object.keys(noDoors)) {
      const asset=buildingAsset("townhall",1,null,{...noDoors,[side]:true},1,{winter:true},level)
      const door=asset.faces.find(f=>f.color===0xbda683)!
      assert.ok(door,"A civic milestone needs a visible entrance")
      const u=door.points.reduce((n,p)=>n+p[0],0)/door.points.length,v=door.points.reduce((n,p)=>n+p[1],0)/door.points.length
      assert.equal(Math.abs(u)>Math.abs(v)?u>0?"right":"backRight":v>0?"left":"backLeft",side)
      assert.equal(asset.effects?.height,buildingHeight("townhall",level))
      assert.equal(asset.effects?.state.snow,1)
    }
  }
})

test("guildhall clock faces are circular in world space on every tower wall", () => {
  for (const side of Object.keys(noDoors)) {
    const asset=buildingAsset("townhall",1,null,{...noDoors,[side]:true},1,{},1)
    const clocks=asset.faces.filter(face=>face.color===0xf7f5e9)
    assert.equal(clocks.length,4)
    for (const face of clocks) {
      const points=face.points.slice(0,-1).map(vertex3)
      const center=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(points.length)
      const radius=points[0]!.distanceTo(center)
      assert.ok(points.every(p=>Math.abs(p.distanceTo(center)-radius)<1e-8),`${side}: squashed clock face`)
    }
  }
})

test("the same scaffold fits every building footprint and leaves all four central approaches clear", () => {
  for(const id of kindIds)for(const share of [0,.15,.5,.9,1]) {
    const size=kinds[id].size,asset=scaffoldAsset(size,buildingHeight(id),share),half=size/2
    valid(asset)
    assert.ok([...asset.faces,...asset.strokes].flatMap(p=>p.points).every(p=>Math.abs(p[0])<=half&&Math.abs(p[1])<=half),id)
    for(const [u,v,du,dv]of [[0,half+.1,0,-1],[half+.1,0,-1,0],[0,-half-.1,0,1],[-half-.1,0,1,0]]) {
      const origin=new THREE.Vector3(u,v,6),ray=new THREE.Ray(origin,new THREE.Vector3(du,dv,0))
      for(const f of asset.faces)for(let i=1;i<f.points.length-1;i++) {
        const hit=ray.intersectTriangle(new THREE.Vector3(...f.points[0]!),new THREE.Vector3(...f.points[i]!),new THREE.Vector3(...f.points[i+1]!),false,new THREE.Vector3())
        assert.ok(!hit||hit.distanceTo(origin)>.6,`${id}/${share}: scaffold blocks a central entrance`)
      }
    }
  }
})

test("scaffolding stays inside the plot and rises with the materials in", () => {
  for (const size of [2, 3]) {
    const plot = size * 8 * U + 1e-9
    const top = (asset: InkAsset) => Math.max(...asset.strokes.flatMap((s) => s.points.map((p) => p[2])))
    const some = scaffoldAsset(size, 32, 0.2), most = scaffoldAsset(size, 32, 0.9)
    for (const asset of [some, most]) {
      valid(asset)
      assert.ok(Math.max(...asset.strokes.flatMap((s) => s.points.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))))) <= plot)
    }
    assert.ok(most.strokes.length > some.strokes.length, "more boards as more comes in")
    assert.ok(top(most) >= top(some))
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
