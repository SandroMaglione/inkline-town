import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import * as THREE from "three"
import { assetById } from "../src/asset-lab/assets.ts"
import { Drawing, type InkAsset } from "../src/asset-lab/primitives.ts"
import { parkAsset, parkProp } from "../src/asset-lab/town-props.ts"
import { parkReviewModels } from "../src/model-review/park-models.ts"
import { human } from "../src/asset-lab/dimensions.ts"
import { DIRS, key } from "../src/grid.ts"
import { assertNear } from "./near.ts"

const baseline=JSON.parse(gunzipSync(readFileSync(new URL("../public/model-review/parks-before.json.gz",import.meta.url))).toString()) as {revision:string;models:InkAsset[];walker:InkAsset}
const points=(a:InkAsset)=>[...a.faces,...a.strokes].flatMap(f=>f.points)
const top=(a:InkAsset)=>Math.max(...points(a).map(p=>p[2]))

test("park comparisons retain the approved originals, plots and unchanged person",()=>{
  assert.equal(baseline.revision,"f4df9d5f9e1ff74552e5a29a3366ec9f541bb3bd")
  const current=parkReviewModels()
  assert.equal(current.length,12)
  assert.deepEqual(current.map(a=>[a.id,a.footprint]),baseline.models.map(a=>[a.id,a.footprint]))
  assertNear(assetById.get("settler-cap")!.faces,baseline.walker.faces,"walker.faces")
  assertNear(assetById.get("settler-cap")!.strokes,baseline.walker.strokes,"walker.strokes")
})

test("furnishings stay within one cell and use the town's human scale",()=>{
  for(const prop of ["lamp","statue","fountain"] as const){
    const d=new Drawing(prop,prop,"");parkProp(d,prop,0,0)
    assert.ok(points(d.asset).every(([u,v,z])=>Math.abs(u)<=.5&&Math.abs(v)<=.5&&z>=0),`${prop}: outside plot or underground`)
  }
  const walkerHeight=top(assetById.get("settler-cap")!)
  assert.ok(top(assetById.get("park-lamp")!)>walkerHeight*1.7)
  assert.ok(top(assetById.get("park-lamp")!)<walkerHeight*2.1)
  const bench=parkReviewModels().find(a=>a.id==="park-bench")!
  assert.ok(top(bench)<walkerHeight*.65,"Bench back must sit below a standing adult's shoulders")
  assert.ok(bench.faces.some(f=>f.points.every(p=>Math.abs(p[2]-human.seat-.65)<1e-8)),"Seat surface must retain the shared human seat height")
  const fountain=assetById.get("park-fountain")!,emitter=fountain.fountains![0]!
  assert.ok(emitter.level>0&&emitter.level<5,"Water must sit below the basin coping")
  assert.ok(emitter.nozzle>11&&emitter.nozzle<walkerHeight,"Nozzle clears the upper bowl and stays below a person's head")
  assert.ok(emitter.radius<.5,"Water must stay inside its cell")
})

test("all path and square approaches leave a person-wide opening to every joined road",()=>{
  const roads=new Set(DIRS.map(({x,y})=>key(x,y)))
  for(const ground of ["path","square"] as const){
    const a=parkAsset(new Map([[key(0,0),{x:0,y:0,ground,prop:"none"}]]),roads)
    for(const {x,y} of DIRS)for(const offset of [-.07,0,.07]){
      const origin=new THREE.Vector3(.5-y*offset,.5+x*offset,1),ray=new THREE.Ray(origin,new THREE.Vector3(x,y,0))
      for(const f of a.faces)for(let i=1;i<f.points.length-1;i++){
        const hit=ray.intersectTriangle(new THREE.Vector3(...f.points[0]!),new THREE.Vector3(...f.points[i]!),new THREE.Vector3(...f.points[i+1]!),false,new THREE.Vector3())
        assert.ok(!hit||hit.distanceTo(origin)>.65,`${ground}/${x},${y}: road approach blocked`)
      }
    }
  }
})
