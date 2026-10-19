import { samplePark, parkAsset } from "../../render/three/assets/town-props.ts"
import { groundAsset } from "../../render/three/models.ts"
import { parksOf } from "../../game/world/appeal.ts"
import { key } from "../../game/world/grid.ts"
import type { InkAsset, Vertex } from "../../render/three/assets/primitives.ts"

// Place actual park cells beside two road entrances, inside the game's grid.
export const parkCells=samplePark.map(c=>({...c,x:c.x+28,y:c.y+28}))
export const parkRoads=new Set([27,33].flatMap(y=>Array.from({length:7},(_,i)=>key(27+i,y))))
export const parkSummary=parksOf(parkCells,(x,y)=>parkRoads.has(key(x,y)))[0]!

export function builtPark(): InkAsset {
  const park=parkAsset(new Map(parkCells.map(c=>[key(c.x,c.y),c])),parkRoads)
  const roads=groundAsset(parkRoads,new Set())
  const shift=([u,v,z]:Vertex):Vertex=>[u-30.5,v-30.5,z]
  return {
    id:"park-built",title:"A park built cell by cell",category:"land",footprint:7,
    note:"Twenty-five cells of planted lawn, flower beds, edged gravel walks and flagstone squares, with two street entrances, three lanterns, seating, a tiered fountain and a simple stone bust.",
    faces:[...park.faces,...roads.faces].map(f=>({...f,points:f.points.map(shift)})),
    strokes:[...park.strokes,...roads.strokes].map(s=>({...s,points:s.points.map(shift)})),
    fountains:(park.fountains??[]).map(f=>({...f,origin:shift(f.origin)}))
  }
}
