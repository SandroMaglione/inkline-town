import { buildStages } from "../art.ts"
import { kinds, type KindId } from "../content.ts"
import { U } from "../iso.ts"
import { Drawing, palette, pale, type Side, type Vertex } from "./primitives.ts"
import type { BuildingOptions } from "./buildings.ts"
import { beam, block, iron, orient, post, roof, stone, wheel, wood, workshopPoint } from "./workshops.ts"

export const tradeYardIds = ["warehouse", "fishery", "bakery", "weaver"] as const
export type TradeYardId = typeof tradeYardIds[number]
export const isTradeYard = (id: KindId): id is TradeYardId => tradeYardIds.some(kind => kind === id)
export const tradeNotes = {
  warehouse: "Braced loading doors open onto a raised cargo apron, with ground-level crates, steps and a timber hoist.",
  fishery: "A teal-roofed fishing hut with a framed net, fish-sorting bench and water barrel, all on dry ground.",
  bakery: "A masonry barrel oven opens into a sheltered bread counter, with flour barrels and a projecting loaf sign.",
  weaver: "An open weaving bay with a treadle loom, tensioned warp, violet cloth and a rack of thread spools."
}

type Wall = (along: number, height: number, out?: number) => Vertex

/** Paired timber leaves slide clear of the opening, with bracing attached to each leaf. */
function loadingDoors(d: Drawing, p: Wall, half: number, bottom: number, height: number, open: number, grille = false) {
  d.face([p(-half, bottom), p(half, bottom), p(half, bottom + height), p(-half, bottom + height)], 0x68726c, 0)
  for (const sign of [-1, 1]) {
    const shift = sign * Math.max(0, Math.min(1, open)) * half * 0.65
    const left = (sign < 0 ? -half : 0) + shift, right = left + half
    const at = (s: number, z: number) => p(s, z, 0.035)
    d.face([at(left, bottom), at(right, bottom), at(right, bottom + height), at(left, bottom + height)], wood[1], 0.9)
    for (const z of [bottom + 2, bottom + height - 2]) beam(d, at(left, z), at(right, z), 0.8)
    beam(d, at(left + 0.3 * U, bottom + 2), at(right - 0.3 * U, bottom + height - 2), 0.8)
    for (const x of [1, 2]) d.line([at(left + half * x / 3, bottom), at(left + half * x / 3, bottom + height)], 0.45, 0x987a54)
    const handle = sign < 0 ? right - 0.5 * U : left + 0.5 * U
    d.line([p(handle, bottom + 8, 0.05), p(handle, bottom + 11, 0.05)], 1, iron[2])
    if (grille) {
      const center = (left + right) / 2, z = bottom + height - 7
      d.face([p(center - U, z, 0.055), p(center + U, z, 0.055), p(center + U, z + 4, 0.055), p(center - U, z + 4, 0.055)], 0x4f5a53, 0.7)
      for (const x of [-0.6, 0, 0.6]) d.line([p(center + x * U, z, 0.06), p(center + x * U, z + 4, 0.06)], 0.65, iron[0])
    }
  }
}

export function tradeEntrance(d: Drawing, id: "mill" | "watchhouse", side: Side, a: number, fit: number, open: number) {
  const p: Wall = (s, z, out = 0.02) => d.wall(side, a, s, z * fit, out)
  const half = (id === "mill" ? 3.5 : 3) * U, height = id === "mill" ? 23 : 20
  loadingDoors(d, p, half, 1, height, open * (id === "mill" ? 1 : 0.25), id === "watchhouse")
  for (const sign of [-1, 1]) beam(d, p(sign * (half + 0.6 * U), 0, 0.5 * U), p(sign * (half + 0.6 * U), height + 2, 0.5 * U), 1.6, id === "mill" ? wood : stone)
  beam(d, p(-half - 1.3 * U, height + 2, 0.5 * U), p(half + 1.3 * U, height + 2, 0.5 * U), 1.8, id === "mill" ? wood : stone)
  beam(d, p(-half - U, 0.5, 0.6 * U), p(half + U, 0.5, 0.6 * U), 1.2, stone)
}

export function millHoist(d: Drawing, a: number) {
  const u = -4.5 * U, front = 13 * U
  beam(d, [u, a, 36], [u, front, 36], 1.8)
  beam(d, [u, a, 27], [u, front, 35], 1.2)
  wheel(d, u, front - 1.25 * U, 34.5, 1.75)
  d.line([[u, front, 34.5], [u, front, 12]], 0.6, 0x8a6a45)
  d.sack(u, front, 5)
  d.line([[u - U, front, 11], [u, front, 12], [u + U, front, 11]], 0.65, 0x8a6a45)
  d.sack(-11 * U, 7 * U)
}

export function tradeSmokeOrigin(id: TradeYardId, doors?: BuildingOptions["doors"]): Vertex | null {
  return id === "bakery" ? workshopPoint([-8 * U, -2 * U, 43.3], doors) : null
}

export function makeTradeYard(id: TradeYardId, options: BuildingOptions = {}) {
  const d = new Drawing(id, kinds[id].title, tradeNotes[id]), fit = Math.max(0, Math.min(1, options.fit ?? 1))
  d.asset.category = "buildings"; d.asset.reference = { type: "building", kind: id }; d.asset.footprint = kinds[id].size
  if (options.plate !== false) d.plate(kinds[id].size)
  const half = (id === "warehouse" ? 21 : 13.5) * U
  block(d, 0, 0, half, half, 0, 1, stone, 0)
  if (id === "warehouse") warehouse(d, fit, options.open ?? 0)
  else if (id === "fishery") fishery(d, fit)
  else if (id === "bakery") bakery(d, fit, options.open ?? 0)
  else weaver(d, fit)
  const asset = orient(d.asset, options.doors), origin = tradeSmokeOrigin(id, options.doors)
  if (origin && options.motion !== false && fit > 0.75) asset.smokeEffect = { origin }
  return asset
}

function warehouse(d: Drawing, fit: number, open: number) {
  block(d, 0, -19 * U, 19 * U, 0.65 * U, 1, 27, stone)
  for (const u of [-19 * U, 19 * U]) block(d, u, -7 * U, 0.65 * U, 12 * U, 1, 27, stone)
  for (const u of [-13 * U, 13 * U]) block(d, u, 5 * U, 6 * U, 0.65 * U, 1, 27, stone)
  block(d, 0, 5 * U, 6 * U, 0.65 * U, 26, 2, stone)
  if (fit > 0) roof(d, 20.5 * U, 13.5 * U, -7 * U, 28, 9 * fit, 0x8a58a8)
  if (fit <= 0.4) return
  const p: Wall = (s, z, out = 0.02) => [s, 5.7 * U + out, z]
  loadingDoors(d, p, 6 * U, 4, 22, open)
  for (const u of [-6.7 * U, 6.7 * U]) beam(d, [u, 5.9 * U, 3], [u, 5.9 * U, 27], 1.4)
  beam(d, [-11 * U, 5.9 * U, 27], [11 * U, 5.9 * U, 27], 1.2, iron)
  block(d, 0, 10.5 * U, 18 * U, 5 * U, 1, 3, stone)
  block(d, 0, 17 * U, 5 * U, 1.5 * U, 1, 1.5, stone)
  // A clear central approach, with cargo kept on the loading platform beside it.
  if (fit <= 0.75) return
  d.crate(11 * U, 9 * U, 4, 0x8a58a8, 2.5 * U, 8)
  d.crate(15 * U, 12 * U, 4, 0xd27a34, 1.5 * U, 6)
  d.barrel(-10 * U, 9 * U, 1.8 * U, 4, 8)
  d.crate(-10 * U, -9 * U, 1, 0x2f8c87, 2 * U, 7)
  post(d, -15 * U, 9 * U, 40)
  beam(d, [-15 * U, 9 * U, 39], [-15 * U, 17 * U, 39], 1.4)
  beam(d, [-15 * U, 9 * U, 28], [-15 * U, 15 * U, 38], 1.2)
  wheel(d, -15 * U, 15 * U, 37.5, 1.4)
  d.line([[-15 * U, 16 * U, 37.5], [-15 * U, 16 * U, 13]], 0.75, 0x8a6a45)
  d.crate(-15 * U, 16 * U, 5, 0x2f8c87, 1.7 * U, 6)
  d.line([[-16.7 * U, 16 * U, 11], [-15 * U, 16 * U, 13], [-13.3 * U, 16 * U, 11]], 0.75, 0x8a6a45)
}

function bench(d: Drawing, u: number, v: number, a: number, b: number, z = 7) {
  for (const x of [-a + 0.5 * U, a - 0.5 * U]) for (const y of [-b + 0.5 * U, b - 0.5 * U]) block(d, u + x, v + y, 0.35 * U, 0.35 * U, 1, z - 1)
  block(d, u, v, a, b, z, 1)
}

function fishery(d: Drawing, fit: number) {
  block(d, -5 * U, -6 * U, 7 * U, 6 * U, 1, 23, stone)
  if (fit > 0) roof(d, 8 * U, 7 * U, -6 * U, 24, 10 * fit, 0x2f8c87, -5 * U)
  if (fit <= 0.4) return
  loadingDoors(d, (s, z, out = 0.02) => [s - 5 * U, out, z], 2.5 * U, 1, 20, 0)
  d.face([[2.03 * U, -10 * U, 8], [2.03 * U, -5 * U, 8], [2.03 * U, -5 * U, 14], [2.03 * U, -10 * U, 14]], palette.glass, 0.8)
  for (const v of [-11 * U, U]) post(d, 10 * U, v, 21)
  beam(d, [10 * U, -11 * U, 20], [10 * U, U, 20], 1.5)
  beam(d, [10 * U, -11 * U, 3], [10 * U, U, 3], 1.1)
  // The mesh is tied to its frame at every edge, and reads from both sides.
  for (let i = 0; i <= 8; i++) {
    const v = (-11 + 12 * i / 8) * U
    d.line([[10 * U, v, 3], [10 * U, v, 20]], 0.45, 0x6e9b91, 0.85)
  }
  for (let i = 0; i <= 6; i++) d.line([[10 * U, -11 * U, 3 + 17 * i / 6], [10 * U, U, 3 + 17 * i / 6]], 0.45, 0x6e9b91, 0.85)
  if (fit <= 0.75) return
  bench(d, -5 * U, 8 * U, 5 * U, 2.6 * U)
  for (const u of [-8, -5, -2]) {
    d.ellipsoid(u * U, 8 * U, 8.6, 0.7 * U, 1.8 * U, 0.65, 0x97b7ad, 0.55, 0xc8d8cb, 12)
    d.face([[(u - 0.8) * U, 10.5 * U, 8.2], [(u + 0.8) * U, 10.5 * U, 8.2], [u * U, 9.5 * U, 8.7]], 0x789c93, 0.6)
  }
  d.barrel(9 * U, 9 * U, 2 * U, 1, 7, 0xa8c7c1)
  d.crate(5 * U, -6 * U, 1, 0x2f8c87, 1.5 * U, 5)
}

function oven(d: Drawing, u: number, v: number, warm: boolean) {
  block(d, u, v, 4.5 * U, 4 * U, 1, 5, stone)
  const p = (t: number, inside: boolean, back: boolean): Vertex => [u + Math.cos(t) * (inside ? 3 : 4.3) * U, v + (back ? -3 : 4) * U, 12 + Math.sin(t) * (inside ? 4.8 : 6.5)]
  for (let i = 0; i < 12; i++) {
    const t = i * Math.PI / 12, n = (i + 1) * Math.PI / 12
    d.face([p(t, false, false), p(n, false, false), p(n, true, false), p(t, true, false)], 0xe3d1b5, 0.65)
    d.face([p(t, false, false), p(n, false, false), p(n, false, true), p(t, false, true)], pale(0xc9b48a, 0.6), 0.35)
    d.face([p(t, true, false), p(n, true, false), p(n, true, true), p(t, true, true)], 0x8d8576, 0.3)
  }
  for (const x of [-3.65 * U, 3.65 * U]) block(d, u + x, v + 0.5 * U, 0.65 * U, 3.5 * U, 6, 6, stone)
  const back: Vertex[] = [[u - 4.3 * U, v - 3 * U, 6], [u + 4.3 * U, v - 3 * U, 6], ...Array.from({ length: 13 }, (_, i) => p(i * Math.PI / 12, false, true))]
  d.face(back, palette.right, 0.8)
  d.face([[u - 3 * U, v - 2.95 * U, 6], [u + 3 * U, v - 2.95 * U, 6], ...Array.from({ length: 13 }, (_, i): Vertex => { const q = p(i * Math.PI / 12, true, true); return [q[0], q[1] + 0.05 * U, q[2]] })], 0x51554c, 0)
  block(d, u, v + 0.5 * U, 3 * U, 3.5 * U, 6, 0.2, [warm ? 0xd6aa67 : 0x947c5c, 0x947c5c, 0x947c5c], 0)
}

function bakery(d: Drawing, fit: number, open: number) {
  block(d, 0, -7 * U, 12 * U, 6 * U, 1, 25, stone)
  if (fit > 0) roof(d, 13 * U, 7 * U, -7 * U, 26, 9 * fit, 0xc4523f)
  if (fit <= 0.4) return
  loadingDoors(d, (s, z, out = 0.02) => [s + 7 * U, -U + out, z], 2.5 * U, 1, 20, open * 0.5)
  oven(d, -6 * U, 2 * U, open > 0.25)
  const flueTop = 18 + 25 * fit
  block(d, -8 * U, -2 * U, 1.6 * U, 1.6 * U, 18, 25 * fit, stone)
  block(d, -8 * U, -2 * U, 2 * U, 2 * U, flueTop - 2, 2, stone)
  d.face([[-9.2 * U, -3.2 * U, flueTop + 0.02], [-6.8 * U, -3.2 * U, flueTop + 0.02], [-6.8 * U, -0.8 * U, flueTop + 0.02], [-9.2 * U, -0.8 * U, flueTop + 0.02]], 0x68726c, 0)
  if (fit <= 0.75) return
  bench(d, 6 * U, 8 * U, 5.2 * U, 2.3 * U)
  for (const u of [1 * U, 11 * U]) post(d, u, 10.8 * U, 21)
  const top: Vertex[] = [[0, -0.8 * U, 24], [12 * U, -0.8 * U, 24], [12 * U, 11 * U, 21], [0, 11 * U, 21]]
  d.face(top, pale(0xc4523f, 0.68), 0.8)
  beam(d, [0, 11 * U, 21], [12 * U, 11 * U, 21], 1)
  for (const u of [3, 6, 9]) for (const v of [7, 9]) {
    d.ellipsoid(u * U, v * U, 8.8, U, 0.65 * U, 0.9, 0xd0a369, 0.45, 0xebce96, 12)
    d.line([[(u - 0.3) * U, (v - 0.4) * U, 9.4], [(u + 0.3) * U, (v + 0.4) * U, 9.4]], 0.4, 0xa5804f)
  }
  d.barrel(-11 * U, 10 * U, U, 1, 7, 0xf1e9d5)
  d.barrel(-8 * U, 11 * U, U, 1, 6)
  beam(d, [9 * U, -U, 29], [9 * U, 3 * U, 29], 0.9, iron)
  d.line([[9 * U, 2.5 * U, 29], [9 * U, 2.5 * U, 27]], 0.55)
  d.ellipsoid(9 * U, 2.5 * U, 26, 2 * U, 0.55 * U, 1.3, 0xc5985f, 0.65, 0xebce96, 16)
  for (const u of [8, 9, 10]) d.line([[u * U, 2.95 * U, 26], [(u + 0.3) * U, 2.95 * U, 27]], 0.45, 0x9c7546)
}

function weaver(d: Drawing, fit: number) {
  block(d, 0, -12 * U, 12 * U, 0.65 * U, 1, 25, stone)
  block(d, -12 * U, -6 * U, 0.65 * U, 6 * U, 1, 25, stone)
  block(d, 6 * U, -9 * U, 6 * U, 3 * U, 1, 25, stone)
  for (const u of [-12 * U, 12 * U]) post(d, u, U, 26)
  beam(d, [-12 * U, U, 26], [12 * U, U, 26], 1.4)
  if (fit > 0) roof(d, 13.5 * U, 7.5 * U, -6 * U, 26, 8 * fit, 0x8a58a8)
  if (fit <= 0.4) return
  loadingDoors(d, (s, z, out = 0.02) => [s + 6 * U, -6 * U + out, z], 2.5 * U, 1, 20, 0)
  for (const u of [-4 * U, 4 * U]) {
    post(d, u, 4 * U, 22)
    post(d, u, -U, 19)
    beam(d, [u, -U, 19], [u, 7 * U, 8], 1.1)
    beam(d, [u, 4 * U, 2], [u, 8 * U, 2], 1.2)
  }
  for (const [v, z] of [[-1, 19], [4, 22], [7, 8]]) beam(d, [-4 * U, v! * U, z!], [4 * U, v! * U, z!], 1.5)
  if (fit <= 0.75) return
  d.face([[-3 * U, 2 * U, 14.875], [3 * U, 2 * U, 14.875], [3 * U, 7 * U, 8], [-3 * U, 7 * U, 8]], 0xb7a4ca, 0.7)
  for (let i = 0; i <= 12; i++) {
    const u = (-3 + i / 2) * U
    d.line([[u, -U, 19], [u, 2 * U, 14.875]], 0.45, 0xd7ccb4)
    d.line([[u, 2 * U, 14.9], [u, 7 * U, 8.03]], 0.3, 0xe4d9eb)
  }
  // Beater, heddle rail and treadles all connect to the loom frame.
  for (const u of [-3.5 * U, 3.5 * U]) beam(d, [u, 4 * U, 10], [u, 4 * U, 21], 0.8)
  for (const z of [10, 21]) beam(d, [-3.5 * U, 4 * U, z], [3.5 * U, 4 * U, z], 0.8)
  beam(d, [-4 * U, 2 * U, 16], [4 * U, 2 * U, 16], 0.9)
  for (const u of [-U, U]) beam(d, [u, -U, 4], [u, 7 * U, 1.5], 1.1)
  d.cylinder(-8 * U, 8 * U, 1.6 * U, 1, 5, wood[2], wood[0], 0.7, 12)
  bench(d, 9 * U, 7 * U, 2.7 * U, 3 * U)
  for (const [v, color] of [[5, 0x8a58a8], [7, 0xc9ad5d], [9, 0x7097b5]] as const) {
    d.cylinder(9 * U, v * U, U, 8, 0.7, wood[2], wood[0], 0.6, 12)
    d.cylinder(9 * U, v * U, 0.65 * U, 8.7, 2.2, pale(color, 0.2), pale(color, 0.5), 0.4, 12)
    d.cylinder(9 * U, v * U, U, 10.9, 0.5, wood[2], wood[0], 0.6, 12)
  }
}

/** Early construction keeps the work apron open instead of filling the plot with a cube. */
export function tradeConstruction(id: TradeYardId, build: number, share: number | null, doors: BuildingOptions["doors"]) {
  const d = new Drawing(id, `${kinds[id].title} · construction`, "Store walls and an open work apron."), stage = buildStages(build)
  const half = (id === "warehouse" ? 21 : 13.5) * U, height = id === "fishery" ? 24 : id === "warehouse" ? 28 : 26
  d.asset.footprint = kinds[id].size
  if (share !== null) for (let i = 0; i < Math.ceil(share * 3); i++) d.crate(half - 2 * U - i * 3 * U, half - 2 * U, 0, 0x8f9891)
  if (stage.walls > 0) {
    block(d, 0, 0, half, half, 0, Math.max(0.1, stage.walls), stone, 0)
    const rear = id === "warehouse" ? -19 * U : -12 * U
    block(d, 0, rear, half - U, 0.6 * U, 1, Math.max(0.1, height * stage.walls), stone)
  }
  if (stage.frame > 0) {
    const rear = id === "warehouse" ? -19 * U : -12 * U, front = id === "warehouse" ? 5 * U : 0
    for (const u of [-half + U, half - U]) for (const v of [rear, front]) post(d, u, v, Math.max(2.1, height * stage.frame))
  }
  return orient(d.asset, doors)
}
