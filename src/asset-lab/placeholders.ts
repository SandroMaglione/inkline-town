/**
 * Placeholder models for what the town gained with desirability, services,
 * and decay: ornaments (garden, park, fountain, statue, plaza), ruins, the
 * signs that go up over a home at risk, and flames. They are built from the
 * same primitives as everything else so they sit in the drawing, but they
 * are simple stand-ins until each gets a proper model.
 */
import { kinds, type KindId } from "../content.ts"
import { U } from "../iso.ts"
import { Drawing, palette, square, type Vertex } from "./primitives.ts"

const green = 0xd8e6c9
const leaves = 0xa9c79a
const stone = 0xe4e6e0
const water = 0xc9dde6

const tree = (d: Drawing, u: number, v: number, size = 1) => {
  d.line([[u, v, 0], [u, v, 5 * size]], 1.5, 0x6b5a45)
  d.ellipsoid(u, v, 5 * size + 6 * size, (5 * size) / 64, (5 * size) / 64, 6 * size, leaves, 1)
}

const figure = (d: Drawing, u: number, v: number, z: number) => {
  d.box(u, v, 2.5 * U, 2.5 * U, z - 6, 6, stone, 0xdcded7, 0xc9ccc4)
  d.cylinder(u, v, 0.9 * U, z, 11, 0xb9beb5, 0xc9ccc4, 1, 10)
  d.ellipsoid(u, v, z + 13, 0.9 * U, 0.9 * U, 2.2, 0xc9ccc4, 1, undefined, 10)
}

/** An ornament of `id`, `size` cells a side, on its plate. */
export function makeDecor(id: KindId) {
  const kind = kinds[id],
    p = (kind.size * 8 - 1) * U
  const d = new Drawing(id, kind.title, "Placeholder ornament: simple shapes standing in until it has a model of its own.")
  d.asset.category = "buildings"
  d.asset.reference = { type: "building", kind: id }
  d.asset.footprint = kind.size
  d.face(square(0, 0, p, -0.15), id === "plaza" || id === "statue" || id === "fountain" ? stone : green)
  if (id === "garden") {
    tree(d, -p / 2, -p / 2, 0.7)
    tree(d, p / 2, p / 2, 0.8)
    for (const [u, v, c] of [[p / 2, -p / 2, 0xe89a7c], [-p / 2, p / 2, 0xe3c25a], [0, 0, 0xc9a0d6]] as const) d.box(u, v, 1.5 * U, 1.5 * U, 0, 2, c, c, c, 1)
  } else if (id === "park") {
    tree(d, -p / 2, -p / 2, 1.1)
    tree(d, p / 2, -p / 3, 0.9)
    tree(d, -p / 3, p / 2, 1)
    d.line([[-p, p / 6, 0.02], [p, -p / 6, 0.02]], 3, 0xe6e8e2)
    d.box(p / 2, p / 2, 3 * U, U, 0, 3, 0xd5a86c, 0xc79a5b, 0xb08a5a, 1)
  } else if (id === "fountain") {
    d.cylinder(0, 0, 5.5 * U, 0, 4, 0xdfe3dc, water, 1, 16)
    d.cylinder(0, 0, 1.2 * U, 4, 7, 0xdfe3dc, stone, 1, 10)
    d.cylinder(0, 0, 2.5 * U, 11, 2, 0xdfe3dc, water, 1, 12)
  } else if (id === "statue") {
    figure(d, 0, 0, 6)
  } else if (id === "plaza") {
    for (let i = -2; i <= 2; i++) {
      d.line([[-p, (i * p) / 3, 0.02], [p, (i * p) / 3, 0.02]], 1, 0xc9ccc4)
      d.line([[(i * p) / 3, -p, 0.02], [(i * p) / 3, p, 0.02]], 1, 0xc9ccc4)
    }
    figure(d, 0, 0, 6)
    tree(d, -p * 0.75, -p * 0.75, 0.7)
    tree(d, p * 0.75, p * 0.75, 0.7)
  }
  return d.asset
}

/** What is left of a home or building: charred, tumbled down, or boarded up. */
export function makeRuin(size: number, cause: "burnt" | "collapsed" | "derelict") {
  const d = new Drawing(`ruin-${cause}-${size}`, `Ruin · ${cause}`, "Placeholder ruin: broken walls on a cleared plate, until it has a model of its own.")
  d.asset.category = "construction"
  d.asset.reference = { type: "none" }
  d.asset.footprint = size
  const p = (size * 8 - 1) * U,
    a = p - 2 * U
  const wall = cause === "burnt" ? 0x77736b : cause === "collapsed" ? 0xe2ddd0 : 0xd9d4c7
  d.face(square(0, 0, p, -0.15), cause === "burnt" ? 0xb9b5ab : 0xe9e6dd)
  if (cause === "derelict") {
    d.box(0, 0, a, a, 0, 9, 0xcfcabd, wall, 0xc4bfb2)
    for (const s of [-1, 1]) d.line([[a + 0.004, s * a * 0.4, 2], [a + 0.004, -s * a * 0.4, 7]], 1.5, 0x8a6a45)
    return d.asset
  }
  const pieces: ReadonlyArray<readonly [number, number, number]> = [[-a, -a, 7], [a * 0.3, -a, 4], [-a, a * 0.2, 5], [a * 0.6, a * 0.6, 3]]
  for (const [u, v, h] of pieces) d.box(u + U, v + U, 1.2 * U * size, 1.2 * U * size, 0, h, wall, wall, 0xc4bfb2, 1)
  if (cause === "burnt") for (let i = 0; i < 3; i++) d.line([[-a + i * a * 0.6, -a * 0.5, 0.5], [-a + i * a * 0.7 + a * 0.4, a * 0.4, 3]], 2, 0x3d4943)
  else for (let i = 0; i < 4; i++) d.box(-a * 0.2 + i * U * 2, a * 0.1, U, U, 0, 1.5, wall, wall, wall, 1)
  return d.asset
}

export type WarningKind = "fire" | "health" | "order" | "sick" | "worn"

/** A sign over a home at risk, facing the camera: a smoke wisp, a pale face, a broken window, a sick face, a cracked wall. */
export function makeWarning(kind: WarningKind) {
  const d = new Drawing(`warning-${kind}`, `Warning · ${kind}`, "Placeholder sign over a home or building at risk.")
  d.asset.category = "construction"
  d.asset.reference = { type: "none" }
  d.asset.footprint = 1
  const at = (x: number, z: number): Vertex => [x / 64, -x / 64, z]
  const edge = kind === "fire" ? 0xc4523f : kind === "health" || kind === "sick" ? 0x4f9a6a : kind === "order" ? 0x3d4f6e : 0x8a6a45
  d.face([at(-7, 0), at(7, 0), at(7, 14), at(-7, 14)], 0xf6f7f3, 1, edge)
  if (kind === "fire") {
    d.line([at(-1, 2), at(-3, 5), at(0, 8), at(-2, 11), at(1, 13)], 1.5, 0x77817a)
    d.line([at(3, 3), at(2, 6), at(4, 9)], 1, 0x9aa29b)
  } else if (kind === "health" || kind === "sick") {
    const ring = Array.from({ length: 16 }, (_, i): Vertex => at(Math.cos((i / 16) * Math.PI * 2) * 4.5, 7 + Math.sin((i / 16) * Math.PI * 2) * 4.5))
    d.face(ring, kind === "sick" ? 0xc9dfb4 : 0xf1f0e6, 1)
    d.face([at(-2.2, 8), at(-1.2, 8), at(-1.2, 9), at(-2.2, 9)], palette.ink, 0)
    d.face([at(1.2, 8), at(2.2, 8), at(2.2, 9), at(1.2, 9)], palette.ink, 0)
    d.line([at(-2, 4.5), at(0, 5.5), at(2, 4.5)], 1)
  } else if (kind === "order") {
    d.face([at(-4, 3), at(4, 3), at(4, 11), at(-4, 11)], 0xdbe6ea, 1)
    d.line([at(0, 3), at(0, 11)], 1)
    d.line([at(-4, 7), at(4, 7)], 1)
    d.line([at(-3, 10), at(1, 6), at(-1, 5), at(3, 3.5)], 1.5, 0xc4523f)
  } else {
    d.line([at(-4, 12), at(-1, 8), at(-3, 6), at(1, 2)], 1.5, 0x8a6a45)
    d.line([at(2, 12), at(4, 9)], 1, 0x8a6a45)
  }
  return d.asset
}

/** Flames over a burning home or building, facing the camera; `phase` 0 or 1 flickers them. */
export function makeFlames(phase: number) {
  const d = new Drawing(`flames-${phase}`, "Flames", "Placeholder flames over a burning home or building.")
  d.asset.category = "construction"
  d.asset.reference = { type: "none" }
  d.asset.footprint = 1
  const at = (x: number, z: number): Vertex => [x / 64, -x / 64, z]
  const tongue = (x: number, w: number, h: number, color: number) =>
    d.face([at(x - w, 0), at(x - w * 0.4, h * 0.55), at(x + (phase ? w * 0.3 : -w * 0.3), h), at(x + w * 0.5, h * 0.5), at(x + w, 0)], color, 1, 0xc4523f)
  tongue(-5, 4, phase ? 14 : 12, 0xf0a868)
  tongue(4, 4, phase ? 11 : 15, 0xf0a868)
  tongue(0, 5, phase ? 20 : 18, 0xf3c76b)
  return d.asset
}
