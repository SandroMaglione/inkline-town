/**
 * Town models for what the town gained with desirability, services,
 * and decay: ornaments (garden, park, fountain, statue, plaza) and ruins.
 * They are built from the same primitives as everything else so they
 * have complete rotatable geometry in the same pale ink palette.
 */
import { kinds, type KindId } from "../content.ts"
import { U } from "../iso.ts"
import { Drawing, palette, square, type Vertex } from "./primitives.ts"

const green = 0xd8e6c9
const leaves = 0xa9c79a
const stone = 0xe4e6e0
const water = 0xc9dde6

const tree = (d: Drawing, u: number, v: number, size = 1) => {
  d.cylinder(u, v, 0.5 * U * size, 0, 8 * size, 0xb08a5e, 0xb08a5e, 1, 8)
  for (const [x, y, z, r] of [[-2, 0, 11, 4], [2, 1, 13, 4.5], [0, -2, 16, 3.5]] as const)
    d.ellipsoid(u + x * U * size, v + y * U * size, z * size, r * U * size, r * U * size, r * size, 0xb7cbaa, 1, 0xe2ead4, 12)
}

export function flowerBed(d: Drawing, u: number, v: number, width = 3, color = 0xc78374) {
  d.box(u, v, width * U, 1.2 * U, 0, 2, 0xbac9a4, 0xe4d7bd, 0xd0c2a8, 1)
  for (let i = -1; i <= 1; i++) {
    const x = u + i * width * U * 0.65
    d.ellipsoid(x, v, 3, U, U, 1.2, leaves, 0, undefined, 8)
    d.ellipsoid(x, v, 4.2, 0.6 * U, 0.6 * U, 0.7, color, 0.5, undefined, 8)
  }
}
export function bench(d: Drawing, u: number, v: number) {
  for (const x of [-2.5, 2.5]) d.box(u + x * U, v, 0.4 * U, 1.2 * U, 0, 4, palette.ink, palette.ink, palette.ink, 0.75)
  for (const y of [-0.7, 0.7]) d.box(u, v + y * U, 3.5 * U, 0.55 * U, 4, 1, 0xe9d2a8, 0xd0b58c, 0xb08a5e, 0.75)
  for (const z of [6, 8]) d.box(u, v - 1.3 * U, 3.5 * U, 0.35 * U, z, 1, 0xe9d2a8, 0xd0b58c, 0xb08a5e, 0.75)
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

const figure = (d: Drawing, u: number, v: number, z: number) => {
  d.box(u, v, 3.3 * U, 3.3 * U, z - 6, 2)
  d.box(u, v, 2.5 * U, 2.5 * U, z - 4, 7, stone, 0xd5d9d0, 0xbec5bb)
  d.face([[u + 2.51 * U, v - U, z - 2], [u + 2.51 * U, v + U, z - 2], [u + 2.51 * U, v + U, z + 1], [u + 2.51 * U, v - U, z + 1]], 0xc1af81, 0.75)
  for (const x of [-0.7, 0.7]) d.cylinder(u + x * U, v, 0.55 * U, z + 3, 5, 0xaebbb0, 0xc9d2c7, 0.75, 8)
  d.ellipsoid(u, v, z + 11, 1.7 * U, 1.3 * U, 4, 0xaebbb0, 1, 0xc9d2c7, 12)
  d.ellipsoid(u, v, z + 16.3, 1.1 * U, 1.1 * U, 1.8, 0xc9d2c7, 1, undefined, 12)
  d.cylinder(u, v, 1.7 * U, z + 17.2, 0.5, 0xaebbb0, 0xc9d2c7, 0.75, 12)
  d.line([[u - 1.2 * U, v, z + 13], [u - 2.4 * U, v, z + 10], [u - 2.4 * U, v, z + 7]], 2, 0xaebbb0)
  d.box(u - 2.4 * U, v, U, 0.5 * U, z + 6, 3, 0xc9d2c7, 0xaebbb0, 0x9daa9f, 1)
  d.line([[u + 1.2 * U, v, z + 13], [u + 2.8 * U, v, z + 14], [u + 2.8 * U, v, z + 20]], 2, 0xaebbb0)
  d.face([[u + 2.8 * U, v, z + 19], [u + 5 * U, v, z + 17], [u + 2.8 * U, v, z + 16]], 0xc9d2c7, 1)
}

/** An ornament of `id`, `size` cells a side, on its plate. */
export function makeDecor(id: KindId) {
  const kind = kinds[id],
    p = (kind.size * 8 - 1) * U
  const d = new Drawing(id, kind.title, "Planting beds, carved stone and timber furniture in the town's pale ink palette.")
  d.asset.category = "buildings"
  d.asset.reference = { type: "building", kind: id }
  d.asset.footprint = kind.size
  d.face(square(0, 0, p, -0.15), id === "plaza" || id === "statue" || id === "fountain" ? stone : green)
  if (id === "garden") {
    d.box(0, 0, p, U, 0, 0.3, 0xeee9de, 0xe3ddcf, 0xd5d0c4, 0.75)
    tree(d, -p / 2, -p / 2, 0.7)
    tree(d, p / 2, p / 2, 0.8)
    flowerBed(d, p / 2, -p / 2, 2, 0xc78374)
    flowerBed(d, -p / 2, p / 2, 2, 0xd6ba69)
  } else if (id === "park") {
    tree(d, -p / 2, -p / 2, 1.1)
    tree(d, p / 2, -p / 3, 0.9)
    tree(d, -p / 3, p / 2, 1)
    d.box(0, 0, p, U, 0, 0.3, 0xeee9de, 0xe3ddcf, 0xd5d0c4, 0.75)
    bench(d, p / 2, p / 2)
    flowerBed(d, p / 2, p * 0.8, 3, 0xb29ac2)
  } else if (id === "fountain") {
    d.cylinder(0, 0, 5.5 * U, 0, 4, 0xdfe3dc, water, 1, 16)
    d.cylinder(0, 0, 1.2 * U, 4, 7, 0xdfe3dc, stone, 1, 10)
    d.cylinder(0, 0, 2.5 * U, 11, 2, 0xdfe3dc, water, 1, 12)
    d.cylinder(0, 0, 4.6 * U, 4.03, 0.2, water, 0xd8e8ee, 0.75, 24)
    d.ellipsoid(0, 0, 15, U, U, 1.8, stone, 1, undefined, 12)
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2
      d.line(Array.from({ length: 9 }, (_, j): Vertex => { const t = j / 8; return [Math.cos(a) * (1 + 3 * t) * U, Math.sin(a) * (1 + 3 * t) * U, 13 + 2 * Math.sin(t * Math.PI) - 8 * t] }), 1, 0x8faebd)
    }
    for (const r of [2.5, 3.5]) d.line(Array.from({ length: 25 }, (_, i): Vertex => [Math.cos(i * Math.PI / 12) * r * U, Math.sin(i * Math.PI / 12) * r * U, 4.3]), 0.75, 0xa9c5d0)
  } else if (id === "statue") {
    setts(d, 0, 0, p - 0.02, 0)
    figure(d, 0, 0, 6)
  } else if (id === "plaza") {
    setts(d, 0, 0, p - 0.02, 0)
    figure(d, 0, 0, 6)
    tree(d, -p * 0.75, -p * 0.75, 0.7)
    tree(d, p * 0.75, p * 0.75, 0.7)
    bench(d, p * 0.6, -p * 0.7)
    bench(d, -p * 0.6, p * 0.7)
  }
  if (id === "garden" || id === "park") for (const y of [-p + U, p - U]) {
    for (let x = -p + U; x <= p - U; x += 2 * U) d.box(x, y, 0.25 * U, 0.25 * U, 0, 5, 0xe9d2a8, 0xd0b58c, 0xb08a5e, 0.75)
    d.line([[-p + U, y, 3], [p - U, y, 3]], 1, 0xb08a5e)
  }
  return d.asset
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

