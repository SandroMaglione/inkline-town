/**
 * Town models for what the town gained with desirability, services,
 * and decay: parks (ground and furnishings, laid cell by cell) and ruins.
 * They are built from the same primitives as everything else so they
 * have complete rotatable geometry in the same pale ink palette.
 */
import type { ParkCell } from "../appeal.ts"
import { props, type GroundId, type PropId } from "../content.ts"
import { cellOf, DIRS, key } from "../grid.ts"
import { U } from "../iso.ts"
import { hash } from "./land.ts"
import { human } from "./dimensions.ts"
import { Drawing, palette, square, type Vertex } from "./primitives.ts"

const green = 0xd8e6c9
const leaves = 0xa9c79a
const stone = 0xe4e6e0
const water = 0xc9dde6

export function flowerBed(d: Drawing, u: number, v: number, width = 3, color = 0xc78374) {
  d.box(u, v, width * U, 1.2 * U, 0, 2, 0xbac9a4, 0xe4d7bd, 0xd0c2a8, 1)
  for (let i = -1; i <= 1; i++) {
    const x = u + i * width * U * 0.65
    d.ellipsoid(x, v, 3, U, U, 1.2, leaves, 0, undefined, 8)
    d.ellipsoid(x, v, 4.2, 0.6 * U, 0.6 * U, 0.7, color, 0.5, undefined, 8)
  }
}
export function bench(d: Drawing, u: number, v: number) {
  for (const x of [-2.5, 2.5]) d.box(u + x * U, v, 0.4 * U, 1.2 * U, 0, human.seat, palette.ink, palette.ink, palette.ink, 0.75)
  for (const y of [-0.7, 0.7]) d.box(u, v + y * U, 3.5 * U, 0.55 * U, human.seat, .65, 0xe9d2a8, 0xd0b58c, 0xb08a5e, 0.75)
  for (const z of [7, 9]) d.box(u, v - 1.3 * U, 3.5 * U, 0.35 * U, z, .65, 0xe9d2a8, 0xd0b58c, 0xb08a5e, 0.75)
}
/** Raised staggered setts share a pitch across neighbouring road cells. */
export function setts(d: Drawing, x: number, y: number, half: number, z: number) {
  const pitch = 0.125
  for (let row = Math.floor((y - half) / pitch); row < Math.ceil((y + half) / pitch); row++) {
    const shift = Math.abs(row % 2) * pitch / 2
    for (let col = Math.floor((x - half - shift) / pitch); col < Math.ceil((x + half - shift) / pitch); col++) {
      const l = Math.max(x - half, col * pitch + shift), r = Math.min(x + half, (col + 1) * pitch + shift),
        b = Math.max(y - half, row * pitch), t = Math.min(y + half, (row + 1) * pitch)
      if (r - l < 0.02 || t - b < 0.02) continue
      const shade = (row * 7 + col * 3) % 4 === 0 ? 0xdce0d8 : 0xe7e9e2
      d.box((l + r) / 2, (b + t) / 2, (r - l) / 2 - 0.005, (t - b) / 2 - 0.005, z, 0.22, shade, 0xc6ccc3, 0xbfc6bc, 0.5, 0xa0aaa0)
    }
  }
}

const figure = (d: Drawing, u: number, v: number) => {
  d.box(u, v, 2.4 * U, 2.4 * U, 1.5, 6.5, stone, 0xd5d9d0, 0xbec5bb, 1)
  const ring=(width:number,depth:number,z:number):Vertex[]=>[[u-width,v-depth,z],[u+width,v-depth,z],[u+width,v+depth,z],[u-width,v+depth,z]]
  const bottom=ring(1.4*U,U,8), shoulders=ring(2.1*U,1.1*U,12.5)
  for(let i=0;i<4;i++)d.face([bottom[i]!,bottom[(i+1)%4]!,shoulders[(i+1)%4]!,shoulders[i]!],i<2?0xc9d2c7:0xe2e6dc,1)
  d.face(shoulders,0xe2e6dc,1)
  d.cylinder(u,v,0.45*U,12.5,1.3,0xc9d2c7,0xc9d2c7,0,8)
  d.ellipsoid(u,v,16.5,U,0.9*U,3,0xc9d2c7,0.8,0xe2e6dc,8)
}

/** A simple stone basin. Running water is supplied by the shared effects renderer. */
function fountain(d: Drawing, u: number, v: number) {
  const n=16, outer=5.5*U, inner=4.5*U
  const ring=(r:number,z:number)=>Array.from({length:n},(_,i):Vertex=>[u+Math.cos(i*Math.PI*2/n)*r,v+Math.sin(i*Math.PI*2/n)*r,z])
  d.cylinder(u,v,5.8*U,0,1,0xd5d9d0,stone,1,n)
  const low=ring(outer,1),rim=ring(outer,4),inside=ring(inner,4),bed=ring(inner,1)
  for(let i=0;i<n;i++){
    const j=(i+1)%n
    d.face([low[i]!,low[j]!,rim[j]!,rim[i]!],0xd5d9d0,0)
    d.face([rim[i]!,rim[j]!,inside[j]!,inside[i]!],stone,0)
    d.face([inside[i]!,inside[j]!,bed[j]!,bed[i]!],0xbec5bb,0)
  }
  // Only the basin rims carry ink; water has no drawn guide curves.
  d.line([...rim,rim[0]!],1)
  d.line([...inside,inside[0]!],0.75)
  d.cylinder(u,v,4.4*U,2.6,0.15,water,0xd8e8ee,0,n)
  d.cylinder(u,v,U,2.75,7.5,0xd5d9d0,stone,1,8)
  d.cylinder(u,v,1.5*U,10.25,0.75,0xd5d9d0,stone,0.75,8)
  ;(d.asset.fountains??=[]).push({origin:[u,v,0],radius:4.4*U,level:2.75,nozzle:11})
}

/** An iron lamp post with a lantern. */
function lamp(d: Drawing, u: number, v: number) {
  d.cylinder(u, v, 1.2 * U, 0, 1.5, 0x8d9589, 0xaeb5ab, 1, 8)
  d.cylinder(u, v, 0.35 * U, 1.5, 15, palette.ink, palette.ink, 0.75, 6)
  d.box(u, v, 1.1 * U, 1.1 * U, 16.5, 4, 0xf6e6a8, 0xf1d98a, 0xe2c46e, 1)
  d.box(u, v, 1.5 * U, 1.5 * U, 20.5, 1.2, 0x5b665f, 0x46514b, 0x3d4943, 1)
  d.cylinder(u, v, 0.4 * U, 21.7, 1.5, palette.ink, palette.ink, 0.75, 6)
}

/** A park's furnishing on a cell centred on (u, v). */
export function parkProp(d: Drawing, prop: PropId, u: number, v: number) {
  if (prop === "lamp") lamp(d, u + 4 * U, v - 4 * U)
  else if (prop === "statue") {
    d.box(u, v, 3.8 * U, 3.8 * U, 0, 1.5, 0xe9ebe5, 0xd5d9d0, 0xbec5bb, 1)
    figure(d, u, v)
  } else fountain(d, u, v)
}

const lawn = 0xdce8cd
const lawnDark = 0xd3e1c2
const gravel = 0xece4d3

/**
 * Parks laid on the ground, cell by cell (by `key`): lawn with its blades,
 * flower beds, gravel walks that join their neighbours (and the roads they
 * meet), paved squares, a stone kerb where the park ends, and each cell's
 * furnishing. `roads` lets a walk run out to the street.
 */
export function parkAsset(cells: ReadonlyMap<number, ParkCell>, roads: ReadonlySet<number> = new Set(), preview = false) {
  const d = new Drawing("parks", "Parks", "")
  const z = preview ? 0.17 : -0.12
  const isPark = (x: number, y: number) => cells.has(key(x, y))
  const walk = (x: number, y: number) => {
    const c = cells.get(key(x, y))
    return c !== undefined && (c.ground === "path" || c.ground === "square")
  }
  for (const [k, c] of cells) {
    const { x, y } = cellOf(k), u = x + 0.5, v = y + 0.5
    const h = hash(x, y)
    if (c.ground === "square") setts(d, u, v, 0.5, z)
    else d.face(square(u, v, 0.5, z), h < 0.5 ? lawn : lawnDark, 0)
    if (c.ground === "lawn" || c.ground === "flowers")
      for (let i = 0; i < 4; i++) {
        const a = u - 0.35 + hash(x * 5 + i, y * 3) * 0.7, b = v - 0.35 + hash(y * 7 + i, x * 2) * 0.7
        d.line([[a - 0.03, b, z + 0.02], [a, b, z + 2], [a + 0.03, b, z + 0.02]], 0.75, 0xa9c79a)
      }
    if (c.ground === "flowers") {
      d.face(square(u, v, 0.34, z + 0.03), 0xd9c7a6, 1, 0xb6a27f)
      const colors = [0xc78374, 0xd6ba69, 0xb29ac2, 0xe0a0a8]
      for (let i = 0; i < 9; i++) {
        const a = u + ((i % 3) - 1) * 0.2, b = v + (Math.floor(i / 3) - 1) * 0.2
        d.ellipsoid(a, b, 1.2, 1.1 * U, 1.1 * U, 1.3, 0xa9c79a, 0, undefined, 8)
        d.ellipsoid(a, b, 2.4, 0.7 * U, 0.7 * U, 0.8, colors[(i + Math.floor(h * 4)) % 4]!, 0.5, undefined, 8)
      }
    }
    if (c.ground === "path") {
      // A walk: a square in the middle, and a strip out to each walk or road beside it.
      const w = 0.2
      d.face(square(u, v, w, z + 0.02), gravel, 0)
      const out: Array<Vertex> = []
      for (const { x: dx, y: dy } of DIRS) {
        const joined = walk(x + dx, y + dy) || roads.has(key(x + dx, y + dy))
        const q = (along: number, across: number): Vertex => [u + dx * along - dy * across, v + dy * along + dx * across, z + 0.03]
        if (joined) {
          const end=roads.has(key(x+dx,y+dy))?0.625:0.5
          d.face([q(w, -w), q(end, -w), q(end, w), q(w, w)], gravel, 0)
          d.line([q(w, -w), q(end, -w)], 1, 0xc2b79f)
          d.line([q(w, w), q(end, w)], 1, 0xc2b79f)
        } else d.line([q(w, -w), q(w, w)], 1, 0xc2b79f)
        out.push(q(0.1 + hash(x * 3 + dx, y * 3 + dy) * 0.08, 0.05))
      }
      for (const p of out) d.line([p, [p[0] + 0.02, p[1], p[2]]], 1, 0xb8ad95)
    }
    // A low stone kerb where the park ends.
    for (const { x: dx, y: dy } of DIRS) {
      if (isPark(x + dx, y + dy)) continue
      if ((c.ground==="path"||c.ground==="square")&&roads.has(key(x+dx,y+dy))) continue
      const q = (along: number, across: number): Vertex => [u + dx * along - dy * across, v + dy * along + dx * across, z]
      const centre = q(0.47, 0)
      d.box(centre[0], centre[1], dx ? 0.03 : 0.5, dy ? 0.03 : 0.5, z, 1.2, 0xeceee8, 0xd7dbd2, 0xc9cec4, 0.75)
    }
    if (c.prop !== "none") parkProp(d, c.prop, u, v)
  }
  return d.asset
}

/** One furnishing on a cell of lawn (or square), for the catalogue and the build menu. */
export function makeParkProp(prop: PropId) {
  const ground: GroundId = prop === "statue" || prop === "fountain" ? "square" : "lawn"
  const asset = parkAsset(new Map([[key(0, 0), { x: 0, y: 0, ground, prop }]]))
  const shift = ([u, v, z]: Vertex): Vertex => [u - 0.5, v - 0.5, z]
  asset.faces.forEach((f) => { f.points = f.points.map(shift) })
  asset.strokes.forEach((s) => { s.points = s.points.map(shift) })
  asset.fountains?.forEach(f=>{f.origin=shift(f.origin)})
  asset.id = `park-${prop}`
  asset.title = `Park · ${props[prop].title.toLowerCase()}`
  asset.note = prop==="statue"?"A simple stone bust on a plain pedestal, readable at the town's scale.":prop==="fountain"?"A stone basin with running water and soft surface ripples.":props[prop].blurb
  asset.category = "land"
  asset.reference = { type: "none" }
  asset.footprint = 1
  return asset
}

/** A small park laid out the way a player would: lawn, walks, flower beds, lamps, a fountain, and a statue. */
export const samplePark: ReadonlyArray<ParkCell> = (() => {
  const plan = [
    "FLPLF",
    "LAPAL",
    "PPWPP",
    "LAPSL",
    "FLPLF"
  ]
  const out: Array<ParkCell> = []
  plan.forEach((row, y) => [...row].forEach((ch, x) => {
    const ground: GroundId = ch === "P" || ch === "A" ? "path" : ch === "S" || ch === "W" ? "square" : ch === "F" ? "flowers" : "lawn"
    const prop: PropId | "none" = ch === "A" ? "lamp" : ch === "S" ? "statue" : ch === "W" ? "fountain" : "none"
    out.push({ x, y, ground, prop })
  }))
  return out
})()

export function makeSamplePark() {
  const asset = parkAsset(new Map(samplePark.map((c) => [key(c.x, c.y), c])))
  const shift = ([u, v, z]: Vertex): Vertex => [u - 2.5, v - 2.5, z]
  asset.faces.forEach((f) => { f.points = f.points.map(shift) })
  asset.strokes.forEach((s) => { s.points = s.points.map(shift) })
  asset.fountains?.forEach(f=>{f.origin=shift(f.origin)})
  asset.id = "park-sample"
  asset.title = "Park · laid out"
  asset.note = "A five-by-five park built piece by piece: lawn, a cross of walks, flower beds in the corners, lamps, a fountain, and a statue on paved squares."
  asset.category = "land"
  asset.reference = { type: "none" }
  asset.footprint = 5
  return asset
}

/** What is left of a home or building: charred, tumbled down, or boarded up. */
export function makeRuin(size: number, cause: "burnt" | "collapsed" | "derelict") {
  const d = new Drawing(`ruin-${cause}-${size}`, `Ruin · ${cause}`, "Exposed masonry, fallen rafters, roof tiles and weeds; each cause leaves a different silhouette.")
  d.asset.category = "construction"
  d.asset.reference = { type: "none" }
  d.asset.footprint = size
  const p = (size * 8 - 1) * U,
    a = p - 2 * U
  const wall = cause === "burnt" ? 0x9c9b90 : cause === "collapsed" ? 0xe2ddd0 : 0xd9d4c7
  d.face(square(0, 0, p, -0.15), cause === "burnt" ? 0xb9b5ab : 0xe9e6dd)
  if (cause === "derelict") {
    d.box(0, 0, a, a, 0, 16, 0xe3ddcf, wall, 0xc4c8bb)
    d.gable(a, 16, 5, "x", 0xd5cbb3, 0xb9b09a, false)
    for (const side of ["right", "left", "backRight", "backLeft"] as const) {
      d.window(side, a, 0, 5, 6, 0x7f8982)
      for (const z of [5, 8]) d.line([d.wall(side, a, -2 * U, z, 0.02), d.wall(side, a, 2 * U, z + 1, 0.02)], 2, 0xb08a5e)
      d.line([d.wall(side, a, -a / 2, 14, 0.02), d.wall(side, a, -a / 3, 10, 0.02), d.wall(side, a, -a / 2, 7, 0.02)], 1, 0x8d9589)
    }
    for (const x of [-a, a]) for (const j of [-1, 0, 1]) d.line([[x, a / 2, 0], [x + j * U, a / 2, 3 + Math.abs(j)]], 0.75, 0x95ab81)
    return d.asset
  }
  const pieces: ReadonlyArray<readonly [number, number, number]> = [[-a, -a, 7], [a * 0.3, -a, 4], [-a, a * 0.2, 5], [a * 0.6, a * 0.6, 3]]
  for (const [u, v, h] of pieces) d.box(u + U, v + U, 1.2 * U * size, 1.2 * U * size, 0, h, wall, wall, 0xc4bfb2, 1)
  for (const side of [-1, 1]) {
    d.face([[-a, side * a, 0], [a, side * a, 0], [a, side * a, 4], [a * 0.4, side * a, 4], [a * 0.4, side * a, 9], [0, side * a, 7], [-a / 3, side * a, 13], [-a, side * a, 10]], wall, 1.5)
    for (const z of [3, 6]) d.line([[-a, side * (a + 0.005), z], [0, side * (a + 0.005), z]], 0.75, 0xa6ad9f)
  }
  d.box(-a * 0.65, -a * 0.5, U, U, 0, cause === "burnt" ? 20 : 11, 0xdbd6c8, wall, 0xa6aa9c, 1)
  for (let i = 0; i < 6; i++) {
    const x = -a * 0.7 + (i % 3) * a * 0.65, y = -a * 0.2 + Math.floor(i / 3) * a * 0.7
    d.face([[x, y, 3], [x + 2 * U, y, 2], [x + 2 * U, y + U, 1], [x, y + U, 2]], cause === "burnt" ? 0x818577 : 0xc3a18f, 0.75)
  }
  if (cause === "burnt") for (let i = 0; i < 3; i++) d.line([[-a + i * a * 0.6, -a * 0.5, 0.5], [-a + i * a * 0.7 + a * 0.4, a * 0.4, 3]], 2, 0x3d4943)
  else for (let i = 0; i < 4; i++) d.box(-a * 0.2 + i * U * 2, a * 0.1, U, U, 0, 1.5, wall, wall, wall, 1)
  return d.asset
}

