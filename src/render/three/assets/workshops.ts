import { buildStages } from "../../art.ts"
import { kinds, type KindId } from "../../../game/content/index.ts"
import { U } from "../../../game/world/iso.ts"
import { rockOutcrop } from "./land.ts"
import { Drawing, palette, pale, type InkAsset, type Side, type Vertex } from "./primitives.ts"
import type { BuildingOptions } from "./buildings.ts"

export const workshopIds = ["mine", "smithy", "sawmill"] as const
export type WorkshopId = typeof workshopIds[number]
export const isWorkshop = (id: KindId): id is WorkshopId => workshopIds.some(kind => kind === id)
export const wood = [0xe9d2a8, 0xd0b58c, 0xb08a5e] as const
export const stone = [0xeeefea, 0xdcded7, 0xc9ccc4] as const
export const iron = [0xa4ada6, 0x79847d, 0x5a645e] as const
const floorScale = 32 * Math.SQRT2, heightScale = 1 / Math.cos(Math.PI / 6)

/** Local +v is the open working face. Orient it towards a connected road. */
export function workshopPoint(point: Vertex, doors?: BuildingOptions["doors"]): Vertex {
  const side = (["left", "right", "backLeft", "backRight"] as const).find(side => doors?.[side]) ?? "left"
  const [u, v, z] = point
  switch (side) {
    case "right": return [v, -u, z]
    case "backLeft": return [-u, -v, z]
    case "backRight": return [-v, u, z]
    default: return point
  }
}

export function workshopSmokeOrigin(id: WorkshopId, doors?: BuildingOptions["doors"]): Vertex | null {
  return id === "smithy" ? workshopPoint([-6 * U, 2 * U, 49.3], doors) : null
}

export function orient(asset: InkAsset, doors?: BuildingOptions["doors"]) {
  for (const face of asset.faces) face.points = face.points.map(p => workshopPoint(p, doors))
  for (const stroke of asset.strokes) stroke.points = stroke.points.map(p => workshopPoint(p, doors))
  return asset
}

export function block(d: Drawing, u: number, v: number, a: number, b: number, z: number, h: number, colors: readonly [number, number, number] = wood, width = 0.8) {
  d.box(u, v, a, b, z, h, ...colors, width)
}

/** Square-section structural member. Width is in rendered world units. */
export function beam(d: Drawing, from: Vertex, to: Vertex, width = 1.5, colors: readonly [number, number, number] = wood) {
  const a = [from[0] * floorScale, from[1] * floorScale, from[2] * heightScale],
    b = [to[0] * floorScale, to[1] * floorScale, to[2] * heightScale]
  const delta = b.map((n, i) => n - a[i]!), length = Math.hypot(...delta)
  if (length < 0.001) return
  const direction = delta.map(n => n / length)
  const cross = (x: number[], y: number[]) => [x[1]! * y[2]! - x[2]! * y[1]!, x[2]! * y[0]! - x[0]! * y[2]!, x[0]! * y[1]! - x[1]! * y[0]!]
  const normal = cross(direction, Math.abs(direction[2]!) > 0.9 ? [1, 0, 0] : [0, 0, 1]), norm = Math.hypot(...normal)
  const x = normal.map(n => n / norm * width / 2), y = cross(direction, x)
  const ring = (center: number[]) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]): Vertex => {
    const p = center.map((n, i) => n + sx! * x[i]! + sy! * y[i]!)
    return [p[0]! / floorScale, p[1]! / floorScale, p[2]! / heightScale]
  })
  const lower = ring(a), upper = ring(b)
  for (let i = 0; i < 4; i++) d.face([lower[i]!, lower[(i + 1) % 4]!, upper[(i + 1) % 4]!, upper[i]!], colors[i % 3]!, 0.65)
  d.face([...lower].reverse(), colors[2], 0.65)
  d.face(upper, colors[0], 0.65)
}

export function post(d: Drawing, u: number, v: number, height: number, bottom = 2) {
  block(d, u, v, 0.8 * U, 0.8 * U, 0, bottom, stone)
  if (height > bottom) block(d, u, v, 0.55 * U, 0.55 * U, bottom, height - bottom)
}

export function roof(d: Drawing, a: number, b: number, v: number, z: number, rise: number, color: number, offsetU = 0) {
  const startFace = d.asset.faces.length, startStroke = d.asset.strokes.length
  d.face([[-a, v - b, z], [-a, v + b, z], [0, v + b, z + rise], [0, v - b, z + rise]], pale(color, 0.74), 1)
  d.face([[a, v - b, z], [a, v + b, z], [0, v + b, z + rise], [0, v - b, z + rise]], pale(color, 0.58), 1)
  for (const sign of [-1, 1]) d.face([[-a, v + sign * b, z], [a, v + sign * b, z], [0, v + sign * b, z + rise]], palette.roof, 1)
  d.face([[-a, v - b, z], [a, v - b, z], [a, v + b, z], [-a, v + b, z]], palette.left, 0)
  if (offsetU) {
    const shift = ([u, v, z]: Vertex): Vertex => [u + offsetU, v, z]
    for (const f of d.asset.faces.slice(startFace)) f.points = f.points.map(shift)
    for (const s of d.asset.strokes.slice(startStroke)) s.points = s.points.map(shift)
  }
}

/** Wheel with a horizontal axle, with real thickness and an open centre. */
export function wheel(d: Drawing, u: number, v: number, z: number, radius: number, spokes = true) {
  const n = 20, point = (i: number, r: number, x: number): Vertex => {
    const t = i / n * Math.PI * 2
    return [u + x, v + Math.cos(t) * r / floorScale, z + Math.sin(t) * r / heightScale]
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    for (const x of [-0.2 * U, 0.2 * U]) d.face([point(i, radius, x), point(j, radius, x), point(j, radius * 0.77, x), point(i, radius * 0.77, x)], iron[1], 0)
    d.face([point(i, radius, -0.2 * U), point(j, radius, -0.2 * U), point(j, radius, 0.2 * U), point(i, radius, 0.2 * U)], iron[2], 0)
  }
  const rim = Array.from({ length: n + 1 }, (_, i) => point(i, radius, 0.2 * U))
  d.line(rim, 0.7)
  if (spokes) for (let i = 0; i < 4; i++) beam(d, [u, v, z], point(i * n / 4, radius * 0.9, 0), 0.9, iron)
  block(d, u, v, 0.35 * U, 0.35 * U, z - 0.6, 1.2, iron, 0.6)
}

export function makeWorkshop(id: WorkshopId, options: BuildingOptions = {}) {
  const notes = {
    mine: "Timber headframe and recessed adit, with rails, ore cart and an open sorting yard. The 2×2 plot stays unchanged.",
    smithy: "An open-sided forge shed: stone hearth, tapered smoke hood, horned anvil and tool bench. The 2×2 plot stays unchanged.",
    sawmill: "An open saw yard with a roofed frame saw, flywheel, log supports and separate plank stacks. The 2×2 plot stays unchanged."
  }
  const d = new Drawing(id, kinds[id].title, notes[id]), fit = Math.max(0, Math.min(1, options.fit ?? 1))
  d.asset.category = "buildings"
  d.asset.reference = { type: "building", kind: id }
  d.asset.footprint = kinds[id].size
  if (options.plate !== false) d.plate(kinds[id].size)
  block(d, 0, 0, 13.5 * U, 13.5 * U, 0, 1, stone, 0)
  if (id === "mine") mine(d, fit)
  else if (id === "smithy") smithy(d, fit, options.open ?? 0)
  else sawmill(d, fit)
  const asset = orient(d.asset, options.doors)
  const origin = workshopSmokeOrigin(id, options.doors)
  if (origin && options.motion !== false && fit > 0.75) asset.smokeEffect = { origin }
  return asset
}

function mine(d: Drawing, fit: number) {
  // The adit is a real recess between two rock cheeks, not a dark door painted on a box.
  rockOutcrop(d, -9 * U, -6 * U, 4.5 * U, 27, true, 1)
  rockOutcrop(d, 9 * U, -6 * U, 4.5 * U, 31, true, 3)
  block(d, 0, -11 * U, 5 * U, U, 1, 27, stone)
  d.face([[-4 * U, -10 * U, 1.02], [4 * U, -10 * U, 1.02], [4 * U, -10 * U, 24], [-4 * U, -10 * U, 24]], 0x57615d, 0)
  for (const u of [-4.5 * U, 4.5 * U]) {
    block(d, u, -5 * U, 0.7 * U, 6 * U, 1, 24, stone)
    post(d, u, U, 25)
  }
  block(d, 0, -5 * U, 5.2 * U, 6 * U, 25, 3, stone)
  block(d, 0, 1.1 * U, 5.6 * U, U, 25, 3)
  // Four load-bearing posts, cross-bracing, pulley and a rope down to the shaft.
  for (const u of [-6 * U, 6 * U]) for (const v of [-10 * U, -3 * U]) post(d, u, v, 49)
  for (const v of [-10 * U, -3 * U]) {
    beam(d, [-6 * U, v, 49], [6 * U, v, 49], 2.3)
    beam(d, [-6 * U, v, 29], [6 * U, v, 45], 1.4)
  }
  for (const u of [-6 * U, 6 * U]) {
    beam(d, [u, -10 * U, 49], [u, -3 * U, 49], 1.8)
    beam(d, [u, -10 * U, 31], [u, -3 * U, 46], 1.4)
  }
  if (fit > 0) roof(d, 7.5 * U, 4.8 * U, -6.5 * U, 50, 6 * fit, 0x5a6479)
  if (fit <= 0.4) return
  beam(d, [-6 * U, -6.5 * U, 45], [6 * U, -6.5 * U, 45], 1.2, iron)
  wheel(d, 0, -6.5 * U, 45, 2.7)
  d.line([[0, -5.5 * U, 45], [0, -5.5 * U, 3]], 0.65, 0x68726c)
  block(d, 0, -5.5 * U, 1.2 * U, 1.2 * U, 1, 3, iron)
  for (const v of [-8, -5, -2, 1, 4, 7, 10, 13]) block(d, 0, v * U, 3.5 * U, 0.5 * U, 1, 0.8, wood, 0.6)
  for (const u of [-2 * U, 2 * U]) beam(d, [u, -9 * U, 2], [u, 14 * U, 2], 0.85, iron)
  if (fit <= 0.75) return
  const cv = 7.5 * U
  for (const u of [-2.9 * U, 2.9 * U]) for (const v of [cv - 2 * U, cv + 2 * U]) wheel(d, u, v, 3, 1.8, false)
  block(d, 0, cv, 3.1 * U, 3 * U, 4, 1, iron)
  // Four separate sides leave the ore cart visibly open at the top.
  for (const u of [-3.1 * U, 3.1 * U]) block(d, u, cv, 0.3 * U, 3.1 * U, 5, 5, iron)
  for (const v of [cv - 3 * U, cv + 3 * U]) block(d, 0, v, 3.1 * U, 0.3 * U, 5, 5, iron)
  for (const [u, v] of [[-1, 0], [1, 1], [0, -1.5]]) d.ellipsoid(u! * U, cv + v! * U, 8.5, 1.5 * U, 1.5 * U, 2, 0x737a8c, 0.7, 0xa9aebb, 8)
  block(d, 10 * U, 8 * U, 2.5 * U, 3.5 * U, 1, 2, wood)
  for (const u of [8 * U, 12 * U]) block(d, u, 8 * U, 0.4 * U, 3.5 * U, 3, 5)
  for (const v of [4.5 * U, 11.5 * U]) block(d, 10 * U, v, 2.5 * U, 0.4 * U, 3, 5)
  d.ellipsoid(10 * U, 8 * U, 5.5, 1.7 * U, 2.7 * U, 2.5, 0x737a8c, 0.7, 0xa9aebb, 8)
  // Pickaxe on a timber-supported rack beside the sorting bin.
  post(d, -11 * U, 8 * U, 10)
  beam(d, [-11 * U, 8 * U, 5], [-8 * U, 8 * U, 13], 1.1)
  beam(d, [-10 * U, 8 * U, 12], [-6 * U, 8 * U, 13], 1.3, iron)
}

function smithy(d: Drawing, fit: number, open: number) {
  block(d, -5.5 * U, -12 * U, 6.5 * U, 0.7 * U, 1, 26, stone)
  block(d, -12 * U, -5.5 * U, 0.7 * U, 6.5 * U, 1, 26, stone)
  for (const u of [-12 * U, U]) post(d, u, U, 27)
  post(d, U, -12 * U, 27)
  beam(d, [-12 * U, U, 26], [U, U, 26], 1.6)
  beam(d, [-12 * U, U, 20], [-8 * U, U, 26], 1.3)
  beam(d, [U, U, 20], [-3 * U, U, 26], 1.3)
  if (fit > 0) roof(d, 8 * U, 8 * U, -5.5 * U, 27, 9 * fit, 0xb04a39, -5.5 * U)
  const u = -6 * U, v = 2 * U
  block(d, u, v, 4 * U, 4 * U, 1, 7, stone)
  block(d, u, v - 3.2 * U, 4 * U, 0.8 * U, 8, 13, stone)
  for (const x of [u - 3.3 * U, u + 3.3 * U]) block(d, x, v, 0.7 * U, 3 * U, 8, 13, stone)
  d.face([[u - 2.6 * U, v - 2.3 * U, 8], [u + 2.6 * U, v - 2.3 * U, 8], [u + 2.6 * U, v - 2.3 * U, 17], [u - 2.6 * U, v - 2.3 * U, 17]], 0x4b524e, 0)
  if (fit > 0.15) {
    const base = [[-4, -4], [4, -4], [4, 4], [-4, 4]], top = [[-2, -2], [2, -2], [2, 2], [-2, 2]]
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      const p = (xy: number[], z: number): Vertex => [u + xy[0]! * U, v + xy[1]! * U, z]
      d.face([p(base[i]!, 21), p(base[j]!, 21), p(top[j]!, 29), p(top[i]!, 29)], i % 2 ? 0x9da69b : 0xc4cbc0, 0.8)
    }
    block(d, u, v, 1.7 * U, 1.7 * U, 29, 20 * fit, stone)
    block(d, u, v, 2 * U, 2 * U, 29 + 20 * fit - 2, 2, stone)
    d.face([[u - 1.2 * U, v - 1.2 * U, 29 + 20 * fit + 0.02], [u + 1.2 * U, v - 1.2 * U, 29 + 20 * fit + 0.02], [u + 1.2 * U, v + 1.2 * U, 29 + 20 * fit + 0.02], [u - 1.2 * U, v + 1.2 * U, 29 + 20 * fit + 0.02]], 0x68726c, 0)
  }
  if (fit <= 0.75) return
  block(d, u, v, 2.4 * U, 2.8 * U, 8, 0.4, [open > 0.25 ? 0xd8aa5e : 0x8a7860, 0x8a7860, 0x6d7469], 0)
  // A wide horn and narrow waist keep the anvil legible from the street.
  d.cylinder(5 * U, 5 * U, 2.3 * U, 1, 5, wood[2], wood[0], 0.8, 12)
  block(d, 5 * U, 5 * U, 2.2 * U, 1.4 * U, 6, 1, iron)
  block(d, 5 * U, 5 * U, U, 0.8 * U, 7, 2.5, iron)
  const plan = [[-2.5, -1.2], [1.7, -1.2], [4.5, 0], [1.7, 1.2], [-2.5, 1.2]]
  const ring = (z: number) => plan.map(([x, y]): Vertex => [(5 + x!) * U, (5 + y!) * U, z])
  const bottom = ring(9.5), upper = ring(11.3)
  for (let i = 0; i < plan.length; i++) d.face([bottom[i]!, bottom[(i + 1) % plan.length]!, upper[(i + 1) % plan.length]!, upper[i]!], iron[1], 0.7)
  d.face(upper, iron[0], 0.8)
  workbench(d, -6 * U, 9 * U)
  beam(d, [-7 * U, 9 * U, 7], [-4 * U, 9 * U, 7], 1.1)
  block(d, -4 * U, 9 * U, 0.7 * U, 1.3 * U, 6.6, 1.8, iron)
  d.barrel(10 * U, -7 * U, 1.5 * U, 1, 6, 0x68726c)
}

function workbench(d: Drawing, u: number, v: number) {
  for (const x of [-2.5 * U, 2.5 * U]) for (const y of [-U, U]) block(d, u + x, v + y, 0.35 * U, 0.35 * U, 1, 6)
  block(d, u, v, 3.2 * U, 1.7 * U, 7, 1)
}

function sawmill(d: Drawing, fit: number) {
  block(d, 0, -12 * U, 12 * U, 0.6 * U, 1, 29, stone)
  for (const u of [-12 * U, 12 * U]) {
    post(d, u, -12 * U, 30)
    post(d, u, 4 * U, 26)
    beam(d, [u, -12 * U, 30], [u, 4 * U, 26], 1.4)
    beam(d, [u, 4 * U, 20], [u, -U, 27.25], 1.2)
  }
  beam(d, [-12 * U, 4 * U, 26], [12 * U, 4 * U, 26], 1.5)
  if (fit > 0) {
    const top: Vertex[] = [[-13.5 * U, -13 * U, 30.7], [13.5 * U, -13 * U, 30.7], [13.5 * U, 5 * U, 26.3], [-13.5 * U, 5 * U, 26.3]]
    const bottom = top.map(([u, v, z]): Vertex => [u, v, z - 0.8])
    d.face(top, pale(0x8a6a45, 0.76), 1)
    d.face([...bottom].reverse(), pale(0x8a6a45, 0.65), 0)
    for (let i = 0; i < 4; i++) d.face([bottom[i]!, bottom[(i + 1) % 4]!, top[(i + 1) % 4]!, top[i]!], pale(0x8a6a45, 0.58), 0.6)
    block(d, 0, 4.8 * U, 13.5 * U, 0.35 * U, 25, 1.3, [pale(0xd27a34, 0.4), pale(0xd27a34, 0.4), pale(0xd27a34, 0.25)])
  }
  // The cutting frame stands in the open bay. Logs run through its centre.
  for (const u of [-4 * U, 4 * U]) {
    post(d, u, 3 * U, 25)
    beam(d, [u, 3 * U, 4], [u, -2 * U, 1], 1.5)
  }
  block(d, 0, 3 * U, 5 * U, 0.6 * U, 23, 2)
  block(d, 0, 3 * U, 5 * U, 0.7 * U, 7, 1.5)
  if (fit <= 0.4) return
  for (const v of [-6 * U, 10 * U]) {
    for (const u of [-2.2 * U, 2.2 * U]) post(d, u, v, 6)
    block(d, 0, v, 3 * U, 0.8 * U, 6, 1.2)
  }
  d.log("v", 0, -9 * U, 13 * U, 7, 2.8, 0xb08a5e, 0xe9d2a8)
  // The blade lands in its upper and lower guide beams; it cuts into the supported log.
  block(d, 0, 3 * U, 0.35 * U, 0.18 * U, 8.5, 14.5, iron, 0.6)
  for (let z = 10; z < 23; z += 2) d.face([[-0.35 * U, 3.2 * U, z], [0.6 * U, 3.2 * U, z + 0.6], [-0.35 * U, 3.2 * U, z + 1.2]], iron[1], 0)
  beam(d, [4 * U, 3 * U, 10], [7 * U, 3 * U, 10], 1.5, iron)
  wheel(d, 7 * U, 3 * U, 10, 5.5)
  if (fit <= 0.75) return
  for (const [u, z] of [[8, 1], [11, 1], [9.5, 5]]) d.log("v", u! * U, 6 * U, 13 * U, z!, 2, wood[2], wood[0])
  for (let i = 0; i < 4; i++) block(d, -8 * U, 8.5 * U, 2.5 * U, 5 * U, 1 + i * 1.8, 1.4, [0xf0c59a, 0xe2a873, 0xd2945c], 0.7)
  workbench(d, -7 * U, -7 * U)
  beam(d, [-8 * U, -7 * U, 7], [-5 * U, -7 * U, 7], 0.9, iron)
}

/** The open yard is assembled as posts and a rear wall, rather than a temporary solid cube. */
export function workshopConstruction(id: WorkshopId, build: number, share: number | null, doors: BuildingOptions["doors"]) {
  const d = new Drawing(id, `${kinds[id].title} · construction`, "Open workshop frame and supplied materials.")
  d.asset.footprint = 2
  const stage = buildStages(build)
  if (share !== null) {
    const half = 14 * U
    for (const u of [-half, half]) for (const v of [-half, half]) d.line([[u, v, 0], [u, v, 6]], 1)
    for (let i = 0; i < Math.ceil(share * 3); i++) d.crate((9 - i * 3) * U, 10 * U, 0, 0x8f9891)
  }
  if (stage.walls > 0) block(d, 0, 0, 13.5 * U, 13.5 * U, 0, Math.max(0.1, stage.walls), stone, 0)
  if (stage.frame > 0) {
    const height = (id === "mine" ? 49 : id === "smithy" ? 27 : 30) * stage.frame
    const us = id === "mine" ? [-6 * U, 6 * U] : [-12 * U, id === "smithy" ? U : 12 * U]
    const vs = id === "mine" ? [-10 * U, -3 * U] : [-12 * U, id === "sawmill" ? 4 * U : U]
    for (const u of us) for (const v of vs) {
      beam(d, [u, v, 0], [u, v, height], 1.4)
    }
    beam(d, [us[0]!, vs[0]!, height], [us[1]!, vs[0]!, height], 1.4)
  }
  if (stage.walls > 0) {
    const height = Math.max(0.1, (id === "mine" ? 27 : id === "smithy" ? 26 : 29) * stage.walls)
    block(d, id === "smithy" ? -5.5 * U : 0, -12 * U, (id === "smithy" ? 6.5 : 12) * U, 0.6 * U, 1, height, stone)
    if (id === "smithy") block(d, -12 * U, -5.5 * U, 0.6 * U, 6.5 * U, 1, height, stone)
  }
  return orient(d.asset, doors)
}

/** A civic entry uses a framed timber double door and a supported pediment, not a shop awning. */
export function townHallEntrance(d: Drawing, side: Side, a: number, fit: number, open: number) {
  const wall = (s: number, z: number, out = 0.01) => d.wall(side, a, s, z * fit, out)
  const box = (s: number, out: number, half: number, depth: number, z: number, h: number, colors: readonly [number, number, number] = stone) => {
    const [u, v] = d.wall(side, a, s, 0, out)
    block(d, u, v, side === "right" || side === "backRight" ? depth : half, side === "right" || side === "backRight" ? half : depth, z * fit, h * fit, colors)
  }
  box(0, 1.4 * U, 5.4 * U, 1.4 * U, 0, 1.2)
  box(0, 0.9 * U, 4.8 * U, 0.9 * U, 1.2, 1.2)
  d.face([wall(-3.2 * U, 2.4), wall(3.2 * U, 2.4), wall(3.2 * U, 22), wall(-3.2 * U, 22)], 0x68726c, 0.8)
  const angle = Math.max(0, Math.min(1, open)) * Math.PI / 9
  for (const sign of [-1, 1]) {
    const leaf = (inner: boolean, z: number) => wall(sign * (3 * U - (inner ? 3 * U * Math.cos(angle) : 0)), z, 0.025 + (inner ? 3 * U * Math.sin(angle) : 0))
    d.face([leaf(false, 2.4), leaf(true, 2.4), leaf(true, 21.5), leaf(false, 21.5)], 0xbda683, 0.8)
    const handle = sign * (3 * U - 2.4 * U * Math.cos(angle))
    d.line([wall(handle, 10, 0.04 + 2.4 * U * Math.sin(angle)), wall(handle, 12, 0.04 + 2.4 * U * Math.sin(angle))], 0.8, 0x7d6140)
    box(sign * 4.2 * U, 0.7 * U, 0.7 * U, 0.7 * U, 2.4, 20)
    box(sign * 4.2 * U, 0.7 * U, U, 0.9 * U, 21.4, 1.8)
  }
  box(0, 0.7 * U, 5.3 * U, 0.9 * U, 23.2, 1.8)
  const back = [wall(-5.3 * U, 25, 0.01), wall(5.3 * U, 25, 0.01), wall(0, 29, 0.01)],
    front = [wall(-5.3 * U, 25, 1.6 * U), wall(5.3 * U, 25, 1.6 * U), wall(0, 29, 1.6 * U)]
  d.face(front, palette.roof, 0.8)
  for (let i = 0; i < 3; i++) d.face([back[i]!, back[(i + 1) % 3]!, front[(i + 1) % 3]!, front[i]!], palette.left, 0.8)
}
