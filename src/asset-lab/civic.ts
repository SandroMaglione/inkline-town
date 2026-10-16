import { U } from "../iso.ts"
import { Drawing, mix, pale, sides, type Side, type Vertex } from "./primitives.ts"
import { beam, block, orient, roof, stone } from "./workshops.ts"
import type { BuildingOptions } from "./buildings.ts"

const violet = 0x806397, blue = 0x66859e, gold = [0xe8d5a2, 0xc8ad6d, 0xa78b4e] as const
export const civicEave = (level: number) => level >= 2 ? 80 : 64

function hip(d: Drawing, u: number, v: number, a: number, z: number, rise: number, color: number) {
  const ring: Vertex[] = [[u-a,v-a,z],[u+a,v-a,z],[u+a,v+a,z],[u-a,v+a,z]]
  for (let i=0;i<4;i++) d.face([ring[i]!,ring[(i+1)%4]!,[u,v,z+rise]],pale(color,i>=2?0.6:0.42),0.8)
}

/** Continuous curved panels avoid a stair-stepped highlight on the large dome. */
function dome(d:Drawing) {
  const first=d.asset.faces.length,n=48,rows=12
  const p=(j:number,i:number):Vertex=>{
    const phi=j/rows*Math.PI/2,theta=i/n*Math.PI*2
    return[Math.cos(theta)*Math.cos(phi)*8.8*U,Math.sin(theta)*Math.cos(phi)*8.8*U,94+Math.sin(phi)*26]
  }
  for(let i=0;i<n;i++) {
    const theta=(i+.5)/n*Math.PI*2
    const light=.2+.75*Math.max(0,-.6*Math.cos(theta)+.8*Math.sin(theta))
    const color=mix(pale(blue,.18),pale(blue,.65),light)
    for(let j=0;j<rows;j++)d.face(j===rows-1?[p(j,i),p(j,i+1),p(j+1,i)]:[p(j,i),p(j,i+1),p(j+1,i+1),p(j+1,i)],color,0)
  }
  const ring=Array.from({length:n},(_,i)=>p(0,i))
  d.face([...ring].reverse(),pale(blue,.18),0)
  d.volume(first,.8)
  d.line([...ring,ring[0]!],.8)
}

/** An arched, recessed pane with its stone surround and a rooted mullion. */
function window(d: Drawing, side: Side, a: number, along: number, z: number, width=1.7*U, height=14) {
  const p=(s:number,h:number,out=0.025)=>d.wall(side,a,along+s,h,out)
  d.face([p(-width-.45*U,z-1),p(width+.45*U,z-1),p(width+.45*U,z+height-3),p(0,z+height+1),p(-width-.45*U,z+height-3)],stone[1],0.65)
  d.face([p(-width,z,.04),p(width,z,.04),p(width,z+height-4,.04),p(0,z+height-1,.04),p(-width,z+height-4,.04)],0xd8e3e7,0.65)
  d.line([p(0,z,.05),p(0,z+height-1,.05)],.65)
  d.line([p(-width,z+height*.45,.05),p(width,z+height*.45,.05)],.55)
  beam(d,p(-width-.6*U,z-1,.06),p(width+.6*U,z-1,.06),1,stone)
}

function banner(d: Drawing, u: number, v: number, z: number, color: number) {
  beam(d,[u,v-.8*U,z+1],[u,v+1.8*U,z+1],.8,gold)
  d.face([[u-1.3*U,v+1.8*U,z],[u+1.3*U,v+1.8*U,z],[u+1.3*U,v+1.8*U,z-14],[u,v+1.8*U,z-17],[u-1.3*U,v+1.8*U,z-14]],color,.7)
  d.face([[u,v+1.82*U,z-4],[u+.65*U,v+1.82*U,z-7],[u,v+1.82*U,z-10],[u-.65*U,v+1.82*U,z-7]],gold[0],.5)
}

function entrance(d: Drawing, v: number, half: number, height: number) {
  const p=(u:number,z:number):Vertex=>[u,v+.02,z]
  block(d,0,v+U,half+2*U,U,0,2,stone)
  d.face([p(-half,2),p(half,2),p(half,height),p(0,height+4),p(-half,height)],0xbda683,.8)
  for (const u of [-half-.6*U,half+.6*U]) block(d,u,v+.5*U,.6*U,.5*U,2,height,stone)
  for (const sign of [-1,1]) {
    const x=sign*.7*U
    d.line([p(x,10),p(x,13)],1,gold[2])
  }
  d.line([p(0,2),p(0,height+4)],.7)
  for (const z of [7,height-4]) d.line([p(-half,z),p(half,z)],.6,0x8a6a45)
}

function guildhall(d: Drawing) {
  block(d,0,0,18*U,16*U,0,64,stone,1.4)
  block(d,0,0,18.5*U,16.5*U,0,3,stone)
  // Broad roof ridges run along the hall, with a projecting clock tower.
  roof(d,19*U,17*U,0,64,23,violet)
  for (const side of sides) {
    const a=(side==="left"||side==="backLeft"?16:18)*U
    for (const s of [-11*U,11*U]) {
      window(d,side,a,s,12,1.8*U,15)
      window(d,side,a,s,41,1.8*U,16)
    }
    const p=(s:number,z:number)=>d.wall(side,a,s,z,.04)
    beam(d,p(-a,33),p(a,33),1.6,stone)
    beam(d,p(-a,61),p(a,61),1.8,stone)
  }
  for (const u of [-17*U,17*U]) for (const v of [-15*U,15*U]) block(d,u,v,.75*U,.75*U,0,64,stone)
  // The tower has a foundation, an entrance and a sheltered balcony.
  const v=12.5*U,a=5*U
  block(d,0,v,a,a,0,108,stone,1.3)
  block(d,0,v,5.6*U,5.6*U,79,2.5,stone)
  block(d,0,v,5.6*U,5.6*U,106,2,stone)
  for (const side of sides) {
    const p=(s:number,z:number):Vertex=>{
      const q=d.wall(side,a,s,z,.025);return [q[0],q[1]+v,q[2]]
    }
    // Floor coordinates and pixel-authored heights have different world scales.
    // A 3U horizontal radius needs 3√6 height units to be circular on the wall.
    const radius=3*Math.sqrt(6)
    const clock=(angle:number,r=1)=>p(Math.cos(angle)*3*U*r,94+Math.sin(angle)*radius*r)
    const ring=Array.from({length:33},(_,i)=>clock(i*Math.PI/16))
    d.face(ring,0xf7f5e9,.9)
    d.line([clock(Math.PI/2,.8),p(0,94),clock(0,.73)],1)
    for (const t of [0,Math.PI/2,Math.PI,3*Math.PI/2]) d.line([clock(t,.84),clock(t,.94)],.65)
  }
  hip(d,0,v,6.3*U,108,23,violet)
  d.cylinder(0,v,.45*U,130,6,gold[1],gold[0],.65,12)
  entrance(d,17.5*U,3*U,25)
  for (const u of [-5.5*U,5.5*U]) {
    block(d,u,20.5*U,.65*U,.65*U,2,30,stone)
    beam(d,[u,17.5*U,24],[u,20.5*U,31],1.2,stone)
  }
  block(d,0,19*U,6.3*U,2.2*U,31,1.8,stone)
  for (const u of [-5.5,-3.3,-1.1,1.1,3.3,5.5]) block(d,u*U,21*U,.2*U,.2*U,33,6,stone,.55)
  beam(d,[-6*U,21*U,39],[6*U,21*U,39],.9,stone)
  window(d,"left",17.55*U,0,33,2.2*U,26)
  banner(d,-7.5*U,16.1*U,55,violet)
  banner(d,7.5*U,16.1*U,55,violet)
  // Roof dormers break up the rear ridge as well as the street silhouette.
  for (const sign of [-1,1]) for (const y of [-9*U,2*U]) {
    block(d,sign*10*U,y,2*U,2*U,72,8,stone)
    hip(d,sign*10*U,y,2.7*U,80,6,violet)
  }
}

function cityhall(d: Drawing) {
  // A taller central hall and lower wings replace the single flat block.
  block(d,0,0,10*U,16*U,0,80,stone,1.4)
  for (const u of [-15*U,15*U]) {
    block(d,u,0,5*U,15*U,0,50,stone,1.2)
    block(d,u,0,5.5*U,15.5*U,47,3,stone)
    roof(d,5.5*U,15.5*U,0,50,10,blue,u)
    for (const v of [-11*U,11*U]) {
      block(d,u,v,4.2*U,4.2*U,0,60,stone,1.2)
      block(d,u,v,4.7*U,4.7*U,58,2,stone)
      hip(d,u,v,5*U,60,12,blue)
      d.cylinder(u,v,.45*U,71.5,3.5,gold[1],gold[0],.5,10)
    }
  }
  block(d,0,0,10.7*U,16.7*U,76,4,stone)
  for (const side of sides) {
    const front=side==="left"||side==="backLeft",a=(front?16:20)*U
    for (const s of front?[-15*U,15*U]:[-10*U,0,10*U]) for (const z of [12,35]) window(d,side,front?15.2*U:a,s,z,1.4*U,11)
    if (front) {
      for (const s of [-6*U,0,6*U]) window(d,side,a,s,53,1.5*U,17)
      const p=(s:number,z:number)=>d.wall(side,a,s,z,.04)
      beam(d,p(-10*U,49),p(10*U,49),1.4,stone)
    }
  }
  for (const u of [-9*U,9*U]) for (const v of [-15.5*U,15.5*U]) block(d,u,v,.65*U,.65*U,0,76,stone)
  // A wide ceremonial stair leads into the columned portico.
  for (let i=0;i<4;i++) block(d,0,(21-i*.7)*U,(11-i*.45)*U,(1.5+i*.15)*U,i,1,stone)
  entrance(d,16*U,3.4*U,27)
  for (const u of [-8*U,-4*U,4*U,8*U]) {
    block(d,u,20*U,.85*U,.85*U,4,2,stone)
    d.cylinder(u,20*U,.52*U,6,29,stone[1],stone[0],.7,16)
    block(d,u,20*U,1.05*U,1.05*U,35,2,stone)
  }
  block(d,0,18.7*U,10*U,2.4*U,37,3,stone)
  const back:Vertex[]=[[-10*U,16.3*U,40],[10*U,16.3*U,40],[0,16.3*U,48]],
    front:Vertex[]=[[-10*U,21.1*U,40],[10*U,21.1*U,40],[0,21.1*U,48]]
  d.face(front,stone[0],.8)
  for(let i=0;i<3;i++)d.face([back[i]!,back[(i+1)%3]!,front[(i+1)%3]!,front[i]!],stone[1],.8)
  // A gilt civic crest sits in the pediment instead of a text label.
  d.face([[-1.4*U,21.12*U,42.5],[1.4*U,21.12*U,42.5],[U,21.12*U,45.5],[-U,21.12*U,45.5]],gold[1],.6)
  banner(d,-8.7*U,16.2*U,70,blue)
  banner(d,8.7*U,16.2*U,70,blue)
  // An arcaded drum, broad dome and lantern crown the central block.
  d.cylinder(0,0,8.2*U,80,14,stone[1],stone[0],.8,32)
  for (let i=0;i<12;i++) {
    const t=i*Math.PI/6,c=Math.cos(t),s=Math.sin(t),r=8.24*U,w=1.1*U
    const p=(x:number,z:number):Vertex=>[c*r-s*x,s*r+c*x,z]
    d.face([p(-w,83),p(w,83),p(w,89),p(0,92),p(-w,89)],0xd8e3e7,.65)
    d.line([p(0,83),p(0,92)],.6)
  }
  dome(d)
  // Curved ribs are rooted at the drum and meet beneath the lantern.
  for(let i=0;i<8;i++) {
    const t=i*Math.PI/4
    d.line(Array.from({length:17},(_,j):Vertex=>{const a=j*Math.PI/32;return[Math.cos(t)*Math.cos(a)*8.82*U,Math.sin(t)*Math.cos(a)*8.82*U,94+Math.sin(a)*26.05]}),.6,pale(blue,.1))
  }
  block(d,0,0,2*U,2*U,118,14,stone)
  for(const side of sides)window(d,side,2.03*U,0,121,.7*U,7)
  hip(d,0,0,2.7*U,132,8,blue)
  d.cylinder(0,0,.4*U,139.5,7,gold[1],gold[0],.6,12)
}

export function civicBuilding(level: number, options: BuildingOptions = {}) {
  const city=level>=2,d=new Drawing(city?"cityhall":"guildhall",city?"City hall":"Guildhall",city?"A domed civic palace with lower wings, corner pavilions, a ceremonial stair and columned portico.":"A steep-roofed guild house with a tall clock tower, stone balcony, dormers and hanging guild banners.")
  d.asset.category="buildings";d.asset.reference={type:"building",kind:"townhall"};d.asset.footprint=3
  if(options.plate!==false)d.plate(3)
  if(city)cityhall(d);else guildhall(d)
  return orient(d.asset,options.doors)
}
