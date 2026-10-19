import { assetById } from "../../render/three/assets/assets.ts"
import { Drawing, type InkAsset, type Vertex } from "../../render/three/assets/primitives.ts"
import { bench, flowerBed, parkAsset } from "../../render/three/assets/town-props.ts"
import { builtPark } from "../park-lab/park.ts"
import { key } from "../../game/world/grid.ts"
import type { GroundId } from "../../game/content/index.ts"

export function parkReviewModels(): InkAsset[] {
  const models=["park-lamp","park-statue","park-fountain"].map(id=>assetById.get(id)!)
  for(const [id,title,draw] of [["park-bench","Park bench",bench],["park-border","Planted border",flowerBed]] as const){
    const d=new Drawing(id,title,"Shared park furnishing, at the unchanged walker scale.")
    draw(d,0,0);d.asset.category="land";d.asset.footprint=1;models.push(d.asset)
  }
  for(const [ground,title] of [["lawn","Lawn & seating"],["flowers","Flower bed"],["path","Gravel path"],["square","Paved square"]] as const satisfies ReadonlyArray<readonly[GroundId,string]>){
    const cells=new Map([[key(0,0),{x:0,y:0,ground,prop:"none" as const}]])
    const roads=ground==="path"||ground==="lawn"?new Set([key(0,1)]):new Set<number>()
    const asset=parkAsset(cells,roads),shift=([u,v,z]:Vertex):Vertex=>[u-.5,v-.5,z]
    models.push({...asset,id:`park-${ground}`,title,footprint:1,faces:asset.faces.map(f=>({...f,points:f.points.map(shift)})),strokes:asset.strokes.map(s=>({...s,points:s.points.map(shift)}))})
  }
  const join=parkAsset(new Map([[key(0,0),{x:0,y:0,ground:"path",prop:"none"}]]),new Set([key(-1,0),key(1,0),key(0,-1),key(0,1)]))
  const shift=([u,v,z]:Vertex):Vertex=>[u-.5,v-.5,z]
  models.push({...join,id:"park-junction",title:"Joined walks",footprint:1,faces:join.faces.map(f=>({...f,points:f.points.map(shift)})),strokes:join.strokes.map(s=>({...s,points:s.points.map(shift)}))})
  models.push(assetById.get("park-sample")!,builtPark())
  return models
}
