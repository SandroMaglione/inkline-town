import { samplePark, parkAsset } from "../asset-lab/town-props.ts"
import { groundAsset } from "../render3d/models.ts"
import { parksOf } from "../appeal.ts"
import { key } from "../grid.ts"
import type { InkAsset, Vertex } from "../asset-lab/primitives.ts"

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
    note:"Twenty-five cells of lawn, flower beds, gravel walks and paved squares, with two street entrances, three lamps, a fountain and a stone bust.",
    faces:[...park.faces,...roads.faces].map(f=>({...f,points:f.points.map(shift)})),
    strokes:[...park.strokes,...roads.strokes].map(s=>({...s,points:s.points.map(shift)})),
    fountains:(park.fountains??[]).map(f=>({...f,origin:shift(f.origin)}))
  }
}
