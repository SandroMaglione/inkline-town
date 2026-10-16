import { U } from "../iso.ts"
import { Drawing, mix, type Vertex } from "./primitives.ts"
import { beam, block, iron, stone, wood } from "./workshops.ts"
import { human } from "./dimensions.ts"

const brass=[0xd7c99d,0xb6a779,0x8f8461] as const
const carved=[0xe7e9df,0xcbd2c5,0xaeb9ac] as const

/** A closed turned profile, including hollow bowls. Rims are drawn separately;
 * the curved body gets a continuous silhouette instead of a wire cage. */
function turned(d:Drawing,u:number,v:number,profile:ReadonlyArray<readonly[number,number]>,colors:readonly[number,number,number]=stone,n=32,width=.55){
  const first=d.asset.faces.length
  const p=(i:number,r:number,z:number):Vertex=>[u+Math.cos(i*Math.PI*2/n)*r*U,v+Math.sin(i*Math.PI*2/n)*r*U,z]
  for(let j=0;j<profile.length-1;j++){
    const [r,z]=profile[j]!,[next,h]=profile[j+1]!
    for(let i=0;i<n;i++){
      const light=.3+.6*Math.max(0,Math.cos((i+.5)*Math.PI*2/n-2.3))
      const color=z===h?colors[0]:mix(colors[2],colors[0],light)
      d.face(r===0?[p(i,0,z),p(i,next,h),p(i+1,next,h)]:next===0?[p(i,r,z),p(i+1,r,z),p(i,0,h)]:[p(i,r,z),p(i+1,r,z),p(i+1,next,h),p(i,next,h)],color,0)
    }
  }
  if(width>0)d.volume(first,width)
}
const rim=(d:Drawing,u:number,v:number,r:number,z:number,width=.5,color=0x687466)=>d.line(Array.from({length:33},(_,i):Vertex=>[u+Math.cos(i*Math.PI/16)*r*U,v+Math.sin(i*Math.PI/16)*r*U,z]),width,color)

export function parkBench(d:Drawing,u:number,v:number){
  // Two braced cast-iron frames support the seat and sloping back.
  for(const x of [-2.65,2.65]){
    for(const y of [-.8,.85]){
      block(d,u+x*U,v+y*U,.22*U,.35*U,0,.35,iron,.4)
      beam(d,[u+x*U,v+y*U,.35],[u+x*U,v+y*.7*U,human.seat],.65,iron)
    }
    beam(d,[u+x*U,v-1.1*U,4.2],[u+x*U,v+1.2*U,4.2],.7,iron)
    beam(d,[u+x*U,v-.7*U,3.5],[u+x*U,v-1.65*U,9.7],.6,iron)
    // Armrest has a supported rise and a small, gently curved top.
    const arm:Vertex[]=[[u+x*U,v+1.05*U,4.7],[u+x*U,v+1.05*U,6.5],[u+x*U,v+.7*U,6.9],[u+x*U,v-1.2*U,6.9]]
    for(let i=0;i<arm.length-1;i++)beam(d,arm[i]!,arm[i+1]!,.55,iron)
  }
  beam(d,[u-2.65*U,v,2],[u+2.65*U,v,2],.65,iron)
  for(const y of [-.9,-.3,.3,.9]){
    block(d,u,v+y*U,3.5*U,.25*U,human.seat,.65,wood,.45)
    for(const x of [-2.65,2.65])d.cylinder(u+x*U,v+y*U,.065*U,5.16,.08,iron[1],iron[0],0,6)
  }
  for(const z of [6.3,7.7,9.1]){
    const back=-1.1-(z-5)*.12
    block(d,u,v+back*U,3.5*U,.16*U,z,.7,wood,.45)
    for(const x of [-2.65,2.65])block(d,u+x*U,v+(back+.17)*U,.06*U,.035*U,z+.25,.15,iron,.15)
  }
}

export function leaf(d:Drawing,u:number,v:number,z:number,angle:number,length=1.2){
  const dx=Math.cos(angle)*length*U,dy=Math.sin(angle)*length*U
  const a:Vertex=[u,v,z],tip:Vertex=[u+dx,v+dy,z+.7],mid:Vertex=[u+dx*.55,v+dy*.55,z+.65]
  d.face([a,[mid[0]-dy*.28,mid[1]+dx*.28,z+.25],tip,mid],0xa8c195,0)
  d.face([a,mid,tip,[mid[0]+dy*.28,mid[1]-dx*.28,z+.25]],0x829e76,0)
}
export function blossom(d:Drawing,u:number,v:number,z:number,color:number,angle=0){
  const h=2.3+(Math.sin(angle*3)+1)*.35
  d.line([[u,v,z],[u,v,z+h]],.35,0x809e70)
  leaf(d,u,v,z+.4,angle,1.1);leaf(d,u,v,z+1,angle+2.5,.8)
  for(let i=0;i<5;i++){
    const a=angle+i*Math.PI*2/5
    d.ellipsoid(u+Math.cos(a)*.42*U,v+Math.sin(a)*.42*U,z+h,.38*U,.38*U,.25,color,0,undefined,6)
  }
  d.ellipsoid(u,v,z+h+.12,.22*U,.22*U,.2,0xd6b66b,0,undefined,6)
}
export function plantedBorder(d:Drawing,u:number,v:number,width=3,color=0xc78374){
  block(d,u,v,width*U,1.3*U,0,.65,[0xa79d84,0xa79d84,0x958b76],0)
  for(const y of [-1.3,1.3])block(d,u,v+y*U,(width+.25)*U,.22*U,0,1.1,stone,.4)
  for(const x of [-width,width])block(d,u+x*U,v,.25*U,1.3*U,0,1.1,stone,.4)
  for(let i=-1;i<=1;i++){
    const x=u+i*width*.62*U
    blossom(d,x,v+Math.sin(i*2)*.3*U,.65,color,i*1.7+1)
    leaf(d,x,v,.7,i+3,1.2)
  }
}

export function parkLamp(d:Drawing,u:number,v:number){
  block(d,u,v,1.25*U,1.25*U,0,.6,stone,.5)
  turned(d,u,v,[[0,.6],[.9,.6],[.9,1],[.65,1.3],[.58,3],[.38,3.5],[.3,5],[.24,21.5],[.48,22],[.48,22.6],[0,22.6]],iron,16,.45)
  for(const x of [-.85,.85])for(const y of [-.85,.85])d.cylinder(u+x*U,v+y*U,.1*U,.6,.2,iron[2],brass[1],0,6)
  // Fluted sleeve, collar and four glass panes beneath a solid weather cap.
  for(let i=0;i<8;i++){
    const t=i*Math.PI/4
    beam(d,[u+Math.cos(t)*.58*U,v+Math.sin(t)*.58*U,1.3],[u+Math.cos(t)*.38*U,v+Math.sin(t)*.38*U,3.5],.18,iron)
  }
  block(d,u,v,1.25*U,1.25*U,22.6,.5,iron,.45)
  const bottom=1.03*U,top=1.38*U,z=23.1,H=28.7
  const ring=(a:number,h:number):Vertex[]=>[[u-a,v-a,h],[u+a,v-a,h],[u+a,v+a,h],[u-a,v+a,h]]
  const lower=ring(bottom,z),upper=ring(top,H)
  for(let i=0;i<4;i++){
    const j=(i+1)%4
    d.face([lower[i]!,lower[j]!,upper[j]!,upper[i]!],i<2?0xe5dbb3:0xf3ebcc,0)
    beam(d,lower[i]!,upper[i]!,.4,iron)
    beam(d,upper[i]!,upper[j]!,.45,iron)
    const a=lower[i]!,b=lower[j]!,c=upper[i]!,e=upper[j]!
    d.line([[(a[0]+b[0])/2,(a[1]+b[1])/2,z],[(c[0]+e[0])/2,(c[1]+e[1])/2,H]],.3,0x7a8473)
  }
  block(d,u,v,.33*U,.33*U,23.1,1.6,brass,.25)
  d.ellipsoid(u,v,25.2,.3*U,.3*U,.9,0xf9f0cf,0,undefined,10)
  const eave=ring(1.7*U,29),peak:Vertex=[u,v,31.2]
  for(let i=0;i<4;i++)d.face([eave[i]!,eave[(i+1)%4]!,peak],iron[i%3]!,0)
  d.line([...eave,eave[0]!],.5)
  d.ellipsoid(u,v,31.5,.23*U,.23*U,.5,brass[1],.3,undefined,10)
}

export function founderStatue(d:Drawing,u:number,v:number){
  // A quiet civic bust: the interest comes from its proportions and planes.
  for(const [half,z,h] of [[4,0,.7],[3.5,.7,.6],[2.65,1.3,7.2],[3.05,8.5,.65]])block(d,u,v,half!*U,half!*U,z!,h!,stone,.55)
  block(d,u,v,1.65*U,1.05*U,9.15,.6,carved,.4)
  const first=d.asset.faces.length,n=8
  const ring=(width:number,depth:number,h:number)=>Array.from({length:n},(_,i):Vertex=>[u+Math.cos(i*Math.PI*2/n)*width*U,v+Math.sin(i*Math.PI*2/n)*depth*U,h])
  const rings=[ring(1.35,.75,9.75),ring(2.85,1.1,14.6),ring(2.55,1.05,16),ring(.65,.6,17.3)]
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){
    const next=(i+1)%n
    const color=mix(carved[2],carved[0],.3+.6*Math.max(0,Math.cos((i+.5)*Math.PI*2/n-2.3)))
    d.face([rings[j]![i]!,rings[j]![next]!,rings[j+1]![next]!,rings[j+1]![i]!],color,0)
  }
  d.face([...rings[0]!].reverse(),carved[1],0);d.face(rings.at(-1)!,carved[0],0);d.volume(first,.55)
  d.cylinder(u,v,.55*U,17.3,1.25,carved[1],carved[0],0,12)
  d.ellipsoid(u,v,20.5,1.05*U,.9*U,2.35,carved[1],.55,carved[0],12)
}

export function parkFountain(d:Drawing,u:number,v:number){
  // Concave bowls use explicit rings: the renderer's convex silhouette hull
  // would cover their open interiors with ink.
  turned(d,u,v,[[0,0],[6.3,0],[6.3,.55],[6.6,.75],[6.6,1.2],[6.1,1.5],[6.05,4],[6.4,4.35],[6.4,4.9],[5.25,4.9],[5.1,4.35],[4.95,1.65],[0,1.65]],stone,32,0)
  rim(d,u,v,6.6,1.2,.5);rim(d,u,v,6.4,4.9,.6);rim(d,u,v,5.25,4.9,.5)
  // Coping joints cross the actual rim, without outlining every curved panel.
  for(let i=0;i<16;i++){
    const t=i*Math.PI/8,c=Math.cos(t),s=Math.sin(t)
    d.line([[u+c*5.25*U,v+s*5.25*U,4.92],[u+c*6.4*U,v+s*6.4*U,4.92]],.35,0x9eaa9b)
  }
  d.cylinder(u,v,5.02*U,2.8,.12,0xb6ced1,0xd2e2df,0,32)
  turned(d,u,v,[[0,1.65],[1.8,1.65],[1.8,2.2],[1.25,2.6],[.8,3.2],[.65,7.7],[1.1,8.1],[1.1,8.6],[0,8.6]],carved,24,.5)
  for(let i=0;i<8;i++){
    const t=i*Math.PI/4
    beam(d,[u+Math.cos(t)*.72*U,v+Math.sin(t)*.72*U,3.3],[u+Math.cos(t)*.62*U,v+Math.sin(t)*.62*U,7.6],.18,carved)
  }
  turned(d,u,v,[[0,8.4],[1,8.4],[1.4,9],[2.15,9.7],[2.5,10.5],[2.5,11],[2.18,11],[1.95,10.35],[.8,9.6],[0,9.6]],stone,32,0)
  rim(d,u,v,2.5,11,.5);rim(d,u,v,2.18,11,.4)
  turned(d,u,v,[[0,9.5],[.5,9.5],[.5,11.8],[.75,12.1],[.75,12.5],[.3,13],[0,13]],brass,16,.35)
  ;(d.asset.fountains??=[]).push({origin:[u,v,0],radius:5.02*U,level:2.8,nozzle:13})
}
