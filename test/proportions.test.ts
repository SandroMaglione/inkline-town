import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { home, kindIds } from "../src/game/content/index.ts"
import { assetById } from "../src/render/pixi3d/assets/assets.ts"
import { house } from "../src/render/pixi3d/assets/homes.ts"
import { human, residentialHeight } from "../src/render/pixi3d/assets/dimensions.ts"
import { sides, type InkAsset } from "../src/render/pixi3d/assets/primitives.ts"
import { buildingAsset, buildingTop, noDoors } from "../src/render/pixi3d/models.ts"
import { architectureIds, proportionModels } from "../src/labs/model-review/proportion-models.ts"
import { vertex3 } from "../src/render/pixi3d/assets/space.ts"
import { length, sub } from "../src/render/pixi3d/mesh/vec3.ts"
import { assertNear } from "./near.ts"

const baseline=JSON.parse(gunzipSync(readFileSync(new URL("../public/model-review/proportions-before.json.gz",import.meta.url))).toString()) as {revision:string;models:InkAsset[];walker:InkAsset}
const points=(a:InkAsset)=>[...a.faces,...a.strokes].flatMap(f=>f.points)
const top=(a:InkAsset)=>Math.max(...points(a).map(p=>p[2]))
const walker=assetById.get("settler-cap")!

test("every comparison uses the approved frozen baseline and the exact unchanged walker",()=>{
  assert.equal(baseline.revision,"a2845b4f537dcb2998a58b7fae26783d7de4a1ec")
  const current=proportionModels()
  assert.equal(architectureIds.length,36)
  assert.equal(current.length,45)
  assert.deepEqual(new Set(current.map(a=>a.id)),new Set(baseline.models.map(a=>a.id)))
  for(const a of current)assert.equal(a.footprint,baseline.models.find(b=>a.id===b.id)!.footprint,`${a.id}: plot changed`)
  assertNear(walker.faces,baseline.walker.faces,"walker.faces")
  assertNear(walker.strokes,baseline.walker.strokes,"walker.strokes")
})

test("all home tiers have door and floor clearance for a walker in every orientation",()=>{
  for(const tier of [1,2,3] as const){
    assert.equal(home.tiers[tier].height,residentialHeight(tier),"Construction and surface bounds must use the actual residential eave")
    assert.ok(human.floor>=top(walker)+4)
    for(const side of sides){
      const a=house(tier,.28,"home",{doors:{...noDoors,[side]:true}})
      const door=a.faces.find(f=>f.color===0xb59b77)!
      assert.ok(door)
      const height=Math.max(...door.points.map(p=>p[2]))-Math.min(...door.points.map(p=>p[2]))
      assert.ok(height>=top(walker)+2,`${tier}/${side}: person cannot pass through the door`)
      const width=length(sub(vertex3(door.points[0]!),vertex3(door.points[1]!)))
      assert.ok(width>6,`${tier}/${side}: door narrower than the walker`)
      assert.ok(top(a)>top(baseline.models.find(b=>b.id===({1:"cottage",2:"citizen",3:"townhouse"} as const)[tier])!))
    }
  }
})

test("markers clear revised roofs and tall machinery in every building orientation",()=>{
  for(const kind of kindIds)for(const side of sides)for(const level of kind==="townhall"?[0,1,2]:[0,1]){
    const a=buildingAsset(kind,1,null,{...noDoors,[side]:true},1,{},level)
    assert.ok(buildingTop(kind,level)+.1>=top(a),`${kind}/${side}/${level}: marker clips roof`)
  }
})

test("the generic goods crate is smaller than the person who handles it",()=>{
  const crate=assetById.get("crate-wood")!
  assert.ok(top(crate)<top(walker)/2)
  const world=points(crate).map(vertex3)
  const width=Math.max(...world.map(p=>p[0]))-Math.min(...world.map(p=>p[0]))
  assert.ok(width<top(walker)/Math.cos(Math.PI/6))
})
