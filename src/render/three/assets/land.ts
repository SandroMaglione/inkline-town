import { Drawing, palette, square, type Vertex } from "./primitives.ts"
import { U } from "../../../game/world/iso.ts"

export const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const leaves = [
  { light: 0xe4ecd6, shade: 0xc6d4b2 },
  { light: 0xdde8cf, shade: 0xbccfa8 },
  { light: 0xe8ecd2, shade: 0xccd5ae },
  { light: 0xdbe6d4, shade: 0xb8cbb2 },
  { light: 0xefe7c9, shade: 0xd7c99c }
]
export function makeTree(
  type: "fir" | "broadleaf" | "poplar",
  grown: number,
  id: string,
  options?: { x: number; y: number; segments?: number }
) {
  let x = 0,
    y = 0
  for (let i = 0; i < 1000; i++) {
    const h = hash(i * 3, i * 7),
      found = h < 0.45 ? "fir" : h > 0.88 ? "poplar" : "broadleaf"
    if (found === type && (type !== "broadleaf" || h > 0.6)) {
      x = i * 3
      y = i * 7
      break
    }
  }
  if (options) {
    x = options.x
    y = options.y
  }
  const h = hash(x, y),
    h2 = hash(y * 3 + 17, x * 5 + 7),
    h3 = hash(x * 11 + 101, y * 13 + 3)
  const s = (grown >= 1 ? 1 : grown >= 0.5 ? 0.75 : 0.5) * (0.85 + h2 * 0.3),
    ox = Math.round((h3 - 0.5) * 12),
    oy = Math.round((h2 - 0.5) * 5)
  const u = ox / 64 + oy / 32,
    v = -ox / 64 + oy / 32,
    trunk = Math.round(6 * s)
  const d = new Drawing(
    id,
    `${type === "broadleaf" ? "Broadleaf" : type === "poplar" ? "Poplar" : "Fir"} · ${grown >= 1 ? "grown" : grown >= 0.5 ? "young" : "sapling"}`,
    "Seeded tree shape, original leaf colours and growth stages, built as a complete volume."
  )
  d.asset.category = "land"
  d.asset.reference = { type: "tree", x, y, grown }
  d.asset.footprint = 1
  d.face(
    Array.from({ length: 32 }, (_, i): Vertex => {
      const t = (i / 32) * Math.PI * 2,
        sx = ox + 3 * s + 9 * s * Math.cos(t),
        sy = oy + 3.5 * s * Math.sin(t)
      return [sx / 64 + sy / 32, -sx / 64 + sy / 32, -0.02]
    }),
    0xe3e6de,
    0
  )
  if (type === "fir") {
    d.fir(u, v, 0, s, h2 < 0.5 ? 2 : 3)
    if (h3 >= 0.5) for (const face of d.asset.faces) {
      if (face.color === 0xd9e5d7) face.color = 0xd3e0d3
      else if (face.color === 0xb3c7b4) face.color = 0xa9bfab
    }
    return d.asset
  }
  d.line(
    [
      [u, v, 0],
      [u, v, trunk]
    ],
    1.5,
    0x6b5a45
  )
  const color = leaves[Math.floor(h2 * 97) % leaves.length]!
  const lobe = (sx: number, sy: number, rx: number, ry: number, forward = 0) => {
    const du = (sx - ox) / 64,
      dv = -(sx - ox) / 64,
      z = oy - sy
    d.ellipsoid(
      u + du + (forward * 0.6123724) / 45.2548,
      v + dv + (forward * 0.6123724) / 45.2548,
      z + forward * 0.5 * 0.8660254,
      rx / 45.2548,
      rx / 45.2548,
      Math.sqrt(Math.max(1, ry * ry - rx * rx * 0.25)),
      color.shade,
      1.5,
      color.light,
      options?.segments ?? 48
    )
  }
  if (type === "poplar") lobe(ox, oy - trunk - 10 * s, 4.5 * s, 11 * s)
  else {
    const r = 7 * s,
      cy = oy - trunk - r
    if (s >= 0.75 && h > 0.6) {
      lobe(ox - r * 0.6, cy + r * 0.25, r * 0.7, r * 0.7)
      lobe(ox + r * 0.65, cy + r * 0.3, r * 0.65, r * 0.65)
    }
    const forward = s >= 0.75 && h > 0.6 ? r * 0.75 : 0
    lobe(ox, cy, r, r * 0.95, forward)
    // Lay the original twig stroke on the curved front surface, rather
    // than hiding it inside the canopy volume.
    const branch = Array.from({ length: 12 }, (_, i): Vertex => {
      const t = i / 11,
        sx = r * (-0.35 + 0.4 * t),
        sy = r * (0.15 - 0.45 * t),
        q = [sx / Math.SQRT2 + sy * 0.353553, -sy * 0.8660254, -sx / Math.SQRT2 + sy * 0.353553],
        direction = [0.6123724, 0.5, 0.6123724],
        radii = [r, r * 0.932738, r]
      let A = 0,
        B = 0,
        C = -1
      for (let j = 0; j < 3; j++) {
        A += (direction[j]! / radii[j]!) ** 2
        B += (2 * q[j]! * direction[j]!) / radii[j]! ** 2
        C += (q[j]! / radii[j]!) ** 2
      }
      const depth = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A) + 0.15 + forward
      return [
        u + (q[0]! + depth * direction[0]!) / 45.2548,
        v + (q[2]! + depth * direction[2]!) / 45.2548,
        trunk + r + (q[1]! + depth * direction[1]!) * 0.8660254
      ]
    })
    d.line(branch, 1, palette.ink, 0.35)
  }
  return d.asset
}

/** Layered angular rock, shared by natural deposits and the quarry face. */
/** Stone is pale and rounded; ore is dark slate, with rust-red veins and sharp shards, so the two read apart at a glance. */
const stoneColors = { top: 0xeeefe8, left: 0xdcded4, right: 0xc1c7b9 }
const oreColors = { top: 0xa9aebb, left: 0x8d93a3, right: 0x737a8c }
const RUST = 0xc7825c

export function rockOutcrop(d: Drawing, u: number, v: number, radius: number, height: number, ore: boolean, variant = 0) {
  const start=d.asset.faces.length,n=7, turn=variant*0.29
  const colors=ore?oreColors:stoneColors
  const ring=(scale:number,z:number,layer:number)=>Array.from({length:n},(_,i):Vertex=>{
    const t=i*Math.PI*2/n+turn,rough=0.66+hash(i+variant*7,variant+3)*0.34
    const shift=layer===3?-radius*0.17:0
    return [u+Math.cos(t)*radius*scale*rough+shift,v+Math.sin(t)*radius*scale*rough,z===0?0:z*(0.7+hash(i+3,variant+2)*0.3)]
  })
  const rings=[ring(1,0,0),ring(0.95,height*0.32,1),ring(0.78,height*0.65,2),ring(0.51,height,3)]
  for(let j=0;j<3;j++)for(let i=0;i<n;i++){
    const a=rings[j]![i]!,b=rings[j]![(i+1)%n]!,c=rings[j+1]![(i+1)%n]!,e=rings[j+1]![i]!
    d.face([a,b,c,e],ore&&j===1&&(i+variant)%5===0?RUST:i<4?colors.right:colors.left,0)
  }
  const summit:Vertex=[u-radius*0.19,v+radius*0.09,height*1.06]
  for(let i=0;i<n;i++)d.face([rings[3]![i]!,rings[3]![(i+1)%n]!,summit],i%3===0?colors.left:colors.top,0)
  d.face([...rings[0]!].reverse(),colors.left,0)
  d.volume(start,0.8)
}

/** A crystal of ore: a leaning, five-sided spike with a rust-red face. */
export function oreShard(d: Drawing, u: number, v: number, radius: number, height: number, variant = 0) {
  const start=d.asset.faces.length,n=5,turn=hash(variant,11)*Math.PI*2
  const lean:[number,number]=[(hash(variant,5)-0.5)*radius*1.4,(hash(variant,7)-0.5)*radius*1.4]
  const base=Array.from({length:n},(_,i):Vertex=>{
    const t=i*Math.PI*2/n+turn,r=radius*(0.75+hash(i,variant+1)*0.25)
    return [u+Math.cos(t)*r,v+Math.sin(t)*r,0]
  })
  const neck=base.map(([x,y]):Vertex=>[x+(u+lean[0]-x)*0.35+lean[0]*0.5,y+(v+lean[1]-y)*0.35+lean[1]*0.5,height*0.62])
  const tip:Vertex=[u+lean[0]*1.3,v+lean[1]*1.3,height]
  for(let i=0;i<n;i++){
    const j=(i+1)%n,side=i===variant%n?RUST:i<2?oreColors.right:oreColors.left
    d.face([base[i]!,base[j]!,neck[j]!,neck[i]!],side,0)
    d.face([neck[i]!,neck[j]!,tip],i===(variant+2)%n?RUST:oreColors.top,0)
  }
  d.volume(start,0.8)
}

/**
 * A deposit of stone or ore, over `w` × `h` cells (a big outcrop is drawn
 * once over the cells it spans). Stone is a heap of rounded boulders; ore is
 * slate rubble with shards standing out of it.
 */
export function makeRock(ore: boolean, stage: boolean | "worked", variant = 0, w = 1, h = 1) {
  const name=ore?"Ore":"Stone"
  const size=w*h>1?`-${w}x${h}`:""
  const state=stage==="worked"?"worked":stage?"full":"quarried",full=stage===true
  const d=new Drawing(`${ore?"ore":"stone"}-${state}${size}`,`${name} · ${state==="worked"?"worked face":state}${size?` · ${w}×${h}`:""}`,state==="worked"
    ?"Quarried down to a worked face: a low mound with a square-cut bench, squared blocks and spoil. It still gives a little, slowly; the bulldozer clears it."
    :"A clustered deposit with clean shaded facets and seeded silhouettes. Stone is pale rounded boulders; ore is dark slate with rust-red shards.")
  d.asset.category="land";d.asset.reference={type:"rock",x:ore?5:0,y:ore?3:0,ore,amount:state==="worked"?1:full?40:10};d.asset.footprint=Math.max(w,h)
  const A=w*8*U,B=h*8*U,small=Math.min(w,h),grow=1+(small-1)*0.55
  if(state==="worked"){workedFace(d,ore,variant,A,B,grow);return d.asset}
  // The big rock in the middle, then smaller ones around it, inside the footprint.
  const spots:Array<[number,number,number]>=[[0.06,-0.02,1]]
  const around=2+w*h
  for(let i=0;i<around;i++){
    const t=i*Math.PI*2/around+hash(variant,i)*0.9
    spots.push([Math.cos(t)*(0.5+hash(i,variant)*0.2),Math.sin(t)*(0.5+hash(variant,i+3)*0.2),0.45+hash(i+5,variant)*0.25])
  }
  spots.forEach(([fu,fv,scale],i)=>{
    const u=fu*(A-3*U),v=fv*(B-3*U),r=(full?4.4:3.6)*U*grow*scale
    const z=(full?11+(variant%3)*1.5:5)*grow*scale
    if(!ore)rockOutcrop(d,u,v,r,z,false,variant+i*2)
    else if(i===0||i%2===1){
      rockOutcrop(d,u,v,r*0.9,z*0.4,true,variant+i*2)
      if(full||i===0)for(let k=0;k<(i===0?3:1);k++)oreShard(d,u+(k-1)*r*0.45,v+(k%2)*r*0.3-r*0.15,r*0.38,z*(1.35-k*0.2),variant+i*3+k)
    }else oreShard(d,u,v,r*0.4,z*(full?1:0.6),variant+i*3)
  })
  for(const [fu,fv] of [[-0.55,0.62],[-0.2,0.85],[0.7,-0.5]] as const)rockOutcrop(d,fu*(A-U),fv*(B-U),0.7*U,1.8,ore,variant+Math.round(fu*10))
  return d.asset
}

/**
 * A deposit quarried down: a low, rough mound where the boulders stood,
 * with a square-cut bench standing in it, and a cut block or
 * two set down beside it. Ore keeps its slate and a rust seam along the
 * cut. Nothing stands proud, so it reads apart from a half-quarried rock.
 */
function workedFace(d: Drawing, ore: boolean, variant: number, A: number, B: number, grow: number) {
  const c=ore?oreColors:stoneColors
  const benches=Math.max(1,Math.round((A*B)/(64*U*U)))
  for(let i=0;i<benches;i++){
    const t=i*2.4+variant*0.7,far=benches>1?0.45:0
    const u=Math.cos(t)*(A-5*U)*far+(hash(variant,i)-0.5)*U,v=Math.sin(t)*(B-5*U)*far+(hash(i,variant+4)-0.5)*U
    const a=(3+hash(i+2,variant)*0.6)*U*grow,b=(2.4+hash(variant+1,i)*0.6)*U*grow
    // The rough mound that is left, low to the ground.
    rockOutcrop(d,u,v,a*1.05,2.6*grow,ore,variant+i*5)
    // The bench: cut square, the stone's own colour on its sawn faces.
    const su=u+a*0.15,sv=v-b*0.1,sa=a*0.55,sb=b*0.6,h=4.4*Math.sqrt(grow)
    let start=d.asset.faces.length
    d.box(su,sv,sa,sb,0,h,c.top,c.left,c.right,0.8)
    d.volume(start,0.6)
    if(ore){
      d.face([[su+sa+0.015,sv-sb,h*0.45],[su+sa+0.015,sv+sb,h*0.45],[su+sa+0.015,sv+sb,h*0.6],[su+sa+0.015,sv-sb,h*0.6]],RUST,0)
      d.face([[su-sa,sv+sb+0.015,h*0.45],[su+sa,sv+sb+0.015,h*0.45],[su+sa,sv+sb+0.015,h*0.6],[su-sa,sv+sb+0.015,h*0.6]],RUST,0)
    }
    // A cut block or two set down beside the mound.
    for(let k=0;k<2;k++){
      const s=(0.7+hash(k+i,variant+9)*0.3)*U,bu=u+(k?-0.45:0.5)*a,bv=v+(k?1:-1)*(b+s+0.4*U)
      start=d.asset.faces.length
      d.box(bu,bv,s*1.3,s,0,1.7,c.top,c.left,c.right,0.8)
      d.volume(start,0.6)
    }
  }
  // Spoil: small chips of what was cut.
  for(const [fu,fv] of [[-0.6,0.55],[0.6,-0.45],[-0.75,-0.2]] as const)rockOutcrop(d,fu*(A-1.5*U),fv*(B-1.5*U),0.55*U,1,ore,variant+Math.round(fv*10))
}

export function makeField(stage: 0 | 1 | 2 | 3) {
  const d = new Drawing(
    `field-${stage}`,
    `Field · ${["sown", "sprouting", "growing", "ripe"][stage]}`,
    "The original soil, three furrows and four crop stages."
  )
  d.asset.category = "land"
  d.asset.reference = { type: "field", grown: stage / 3 }
  d.asset.footprint = 1
  const s = 7 * U
  d.face(square(0, 0, s, -0.1), 0xece8dc, 1)
  for (const v of [-4 * U, 0, 4 * U]) {
    d.line(
      [
        [-s + U, v, 0],
        [s - U, v, 0]
      ],
      1,
      palette.ink,
      0.35
    )
    if (stage)
      for (let u = -s + 2 * U; u <= s - 2 * U; u += 2 * U)
        d.line(
          [
            [u, v, 0],
            [u, v, stage + 1]
          ],
          1,
          stage === 3 ? 0xcdb46a : palette.ink,
          stage === 3 ? 1 : 0.6
        )
  }
  return d.asset
}

export function makeRoadPatch() {
  const d = new Drawing("roads", "Road junction", "Twelve-unit paving, kerbs, worn stones and dashed markings, with clean junctions.")
  d.asset.category = "land"
  d.asset.reference = { type: "roads" }
  d.asset.footprint = 3
  for (const [x, y] of [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ]) {
    d.face(square(x!, y!, 0.375, -0.1), 0xe6e8e2, 0)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const q = (a: number, c: number): Vertex => [x! + dx! * a - dy! * c, y! + dy! * a + dx! * c, 0]
      if (x! + dx! === 0 || y! + dy! === 0) {
        if (Math.abs(x! + dx!) + Math.abs(y! + dy!) <= 1) {
          d.face([q(0.375, -0.375), q(0.5, -0.375), q(0.5, 0.375), q(0.375, 0.375)], 0xe6e8e2, 0)
          d.line([q(0.375, -0.375), q(0.5, -0.375)], 1.5)
          d.line([q(0.375, 0.375), q(0.5, 0.375)], 1.5)
          d.line([q(0.0625, 0), q(0.1875, 0)], 1, 0xb4b9b1)
          continue
        }
      }
      d.line([q(0.375, -0.375), q(0.375, 0.375)], 1.5)
    }
  }
  return d.asset
}
export function makeWater() {
  const d = new Drawing("water", "Water & shore", "Flat pale water, ink waves, shore edges and white glints.")
  d.asset.category = "land"
  d.asset.reference = { type: "water" }
  d.asset.footprint = 3
  d.face(square(0, 0, 1.5, -0.2), 0xdfe8e6, 1)
  for (const [u, v] of [
    [-0.8, -0.7],
    [0.6, -0.2],
    [-0.4, 0.9]
  ])
    d.line(
      [
        [u! - 0.15, v!, 0],
        [u! - 0.05, v! - 0.04, 0],
        [u! + 0.05, v!, 0],
        [u! + 0.15, v! - 0.04, 0]
      ],
      1,
      0x9fb3b0
    )
  d.line(
    [
      [0.72, 0.9, 0],
      [0.88, 0.9, 0]
    ],
    1,
    0xffffff
  )
  d.line(
    [
      [0.8, 0.82, 0],
      [0.8, 0.98, 0]
    ],
    1,
    0xffffff
  )
  return d.asset
}
