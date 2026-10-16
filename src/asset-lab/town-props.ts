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
import { founderStatue, parkBench, parkFountain, parkLamp, plantedBorder } from "./park-furnishings.ts"
import { flowerPlot, gravelWalk, parkPaving, turf } from "./park-ground.ts"
import { Drawing, square, type Vertex } from "./primitives.ts"

/** Shared seating and planted borders also serve the healer and hospital. */
export const flowerBed = plantedBorder
export const bench = parkBench
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

/** A park furnishing occupies its original single cell. */
export function parkProp(d: Drawing, prop: PropId, u: number, v: number) {
  if (prop === "lamp") parkLamp(d, u + 4 * U, v - 4 * U)
  else if (prop === "statue") founderStatue(d, u, v)
  else parkFountain(d, u, v)
}

const lawn = 0xdce8cd
const lawnDark = 0xd3e1c2

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
    if (c.ground === "square") parkPaving(d, u, v, z)
    else d.face(square(u, v, 0.5, z), h < 0.5 ? lawn : lawnDark, 0)
    if (c.ground === "lawn" || c.ground === "flowers") turf(d,u,v,z,x,y)
    if (c.ground === "flowers") flowerPlot(d,u,v,z,x,y)
    if (c.ground === "path") {
      const joins=DIRS.map(({x:dx,y:dy})=>({dx,dy,end:walk(x+dx,y+dy)?0.5:roads.has(key(x+dx,y+dy))?0.625:0}))
      gravelWalk(d,u,v,z,joins,x,y)
    }
    if (c.ground === "lawn" && c.prop === "none" && h < .42) {
      const front=DIRS.find(({x:dx,y:dy})=>walk(x+dx,y+dy)||roads.has(key(x+dx,y+dy)))
      if(front){
        const faces=d.asset.faces.length,strokes=d.asset.strokes.length
        bench(d,0,0)
        const turn=([a,b,H]:Vertex):Vertex=>[u+front.y*a+front.x*b,v-front.x*a+front.y*b,H]
        for(const f of d.asset.faces.slice(faces))f.points=f.points.map(turn)
        for(const s of d.asset.strokes.slice(strokes))s.points=s.points.map(turn)
      }
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
  asset.note = prop==="statue"?"A simple stone bust with broad carved shoulders, a plain head and a stepped pedestal.":prop==="fountain"?"A moulded stone basin with jointed coping, a fluted stem, upper bowl and running water.":props[prop].blurb
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

