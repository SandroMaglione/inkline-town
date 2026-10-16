import { U } from "../iso.ts"
import { Drawing, type Vertex } from "./primitives.ts"
import { beam as solidBeam, block as solidBlock, stone, wood } from "./workshops.ts"
import { human } from "./dimensions.ts"

// Repeated scaffold members retain solid faces, with one ink edge per edge.
// Outlining every face separately would duplicate the same lines many times.
function block(d:Drawing,u:number,v:number,a:number,b:number,z:number,h:number,colors:readonly[number,number,number]=wood,width=.5) {
  solidBlock(d,u,v,a,b,z,h,colors,0)
  const ring:Vertex[]=[[u-a,v-b,z+h],[u+a,v-b,z+h],[u+a,v+b,z+h],[u-a,v+b,z+h]]
  d.line([...ring,ring[0]!],width)
  for(const [x,y]of ring)d.line([[x,y,z],[x,y,z+h]],width)
}
function beam(d:Drawing,a:Vertex,b:Vertex,width=.65) {
  const first=d.asset.faces.length,lines=d.asset.strokes.length
  solidBeam(d,a,b,width)
  d.asset.strokes.length=lines
  for(const f of d.asset.faces.slice(first,first+4))d.line([f.points[0]!,f.points[3]!],.5)
}
function post(d:Drawing,u:number,v:number,top:number,bottom:number) {
  block(d,u,v,.8*U,.8*U,0,bottom,stone)
  if(top>bottom)block(d,u,v,.4*U,.4*U,bottom,top-bottom)
}

/** One reusable perimeter scaffold. It knows no building kinds or meshes.
 * Open central bays preserve access on every side, regardless of road layout. */
export function scaffoldAsset(size: number, height: number, share: number) {
  const d=new Drawing("scaffold","Building works","Modular timber scaffold with working platforms, access ladder, canvas screens and delivered supplies.")
  const progress=Math.max(0,Math.min(1,share)),s=(size*8-1.8)*U,inner=s-.8*U
  const rise=5+(Math.max(8,height)+5)*progress
  const n=Math.max(4,Math.ceil(2*s/(6*U)/2)*2)
  const stations=Array.from({length:n+1},(_,i)=>-s+2*s*i/n).filter(x=>Math.abs(x)>U)
  const levels:number[]=[]
  const deck=Math.max(2,rise-6)
  for(let z=deck-human.floor;z>=8;z-=human.floor)levels.unshift(z)
  levels.push(deck)
  const platformLevels=levels.slice(-2)
  for(let side=0;side<4;side++) {
    const p=(along:number,out:number,z:number):Vertex=>{
      switch(side){case 0:return[along,out,z];case 1:return[out,-along,z];case 2:return[-along,-out,z];default:return[-out,along,z]}
    }
    for(const x of stations) {
      const outer=p(x,s,0),inside=p(x,inner,0)
      post(d,outer[0],outer[1],rise,.5)
      // Inner standards give the boards two solid supports.
      block(d,inside[0],inside[1],.22*U,.22*U,.5,Math.max(.1,rise-.5),wood,.5)
      for(const z of levels)beam(d,p(x,inner,z),p(x,s,z),.65)
    }
    for(let i=0;i<stations.length-1;i++) {
      const a=stations[i]!,b=stations[i+1]!,gate=a<0&&b>0
      for(const z of levels) {
        if(gate&&z<24)continue
        beam(d,p(a,s,z),p(b,s,z),.7)
        beam(d,p(a,inner,z),p(b,inner,z),.65)
        if(platformLevels.includes(z)) {
          // Two actual boards, with a narrow seam and a protective top rail.
          for(const t of [.23,.67]) {
            const q=p((a+b)/2,inner+t*U,z+.15)
            block(d,q[0],q[1],(side%2?.18*U:(b-a)/2),(side%2?(b-a)/2:.18*U),z+.15,.5,wood,.45)
          }
          beam(d,p(a,s,z+8),p(b,s,z+8),.55)
          for(const x of [a,b])beam(d,p(x,s,z),p(x,s,z+8),.5)
        }
      }
      // Diagonal braces stay away from the entrances.
      if(!gate)beam(d,p(a,s,.6),p(b,s,Math.min(rise-1,20)),.65)
    }
    // A canvas panel is tied into one outer bay. It reads as active work at low progress.
    const a=stations[0]!,b=stations[1]!,z=Math.min(8,rise-1)
    if(z>3)d.face([p(a+.3*U,s+.025*U,1.5),p(b-.3*U,s+.025*U,1.5),p(b-.3*U,s+.025*U,z),p(a+.3*U,s+.025*U,z)],0xd6c39a,.5)
  }
  // The ladder rests on a rear bay and meets the highest working platform.
  const a=-s*.8,b=-s*.57
  for(const offset of [-.8*U,.8*U])beam(d,[a+offset,-s,0],[b+offset,-s,deck+.8],.6)
  for(let z=2;z<deck;z+=2.5) {
    const x=a+(b-a)*z/(deck+.8)
    beam(d,[x-.8*U,-s,z],[x+.8*U,-s,z],.5)
  }
  // Compact corner piles work even when the building fills most of its plot.
  const c=s-1.4*U
  for(let i=0;i<Math.ceil(progress*4);i++)d.crate(c,c,1+i*3.2,0x8f9891,.85*U,3.2)
  for(let i=0;i<Math.ceil(progress*3);i++)block(d,-c,c,1.7*U,.4*U,1+i*.65,.5,wood,.4)
  d.asset.category="construction";d.asset.footprint=size
  return d.asset
}
