/**
 * The town's look: pale line-drawn buildings and homes on plates, paved
 * roads with square joints, trees, rocks, fields and water drawn in the same
 * ink, cardboard crates with coloured labels, and small walkers. Everything
 * is drawn with Pixi graphics in world pixels, measured in units (see
 * `iso.ts`): floor lengths are whole units, heights whole pixels, and lines
 * one of two weights.
 *
 * Colour is kept for meaning: each building is dressed in the colour of
 * what it makes or does (its awnings, roof, trim, and the things in its
 * yard), crate labels by good, a home's roof, the red of a problem marker.
 * Trees, rocks, water, and roads vary by cell, so the land is never a
 * pattern; the same cell always looks the same.
 *
 * The measures that have to agree:
 * - a road is 12 units wide and runs down the middle of a cell;
 * - a building's door is 10 units wide, centred on a side where a road
 *   meets it;
 * - a plate is a unit inside its footprint;
 * - a crate is 6 units wide, a carried one 4.
 */
import { Container, Graphics } from "pixi.js"
import type { SurfaceState } from "./render3d/surface-state.ts"

import { goods, GROWN, home, kinds, ROCK_AMOUNT, type GoodId, type GroundId, type Kind, type KindId, type PropId, type Tier } from "./content.ts"
import { cellOf, DIRS, key } from "./grid.ts"
import { flat, GRID, toScreen, U, type Point } from "./iso.ts"

export const ink = 0x3d4943
const plateFill = 0xf5f6f2
const roofFill = 0xf7f8f4
const leftFill = 0xe9ebe5
const rightFill = 0xdde0d9
const roadFill = 0xe6e8e2
const marking = 0xb4b9b1
const waterFill = 0xdfe8e6
const soilFill = 0xece8dc
const ripe = 0xcdb46a
const alarm = 0xc4523f

/** Outlines. */
const LINE = 1.5
/** Everything inside an outline: seams, slats, windows, markings. */
const DETAIL = 1

const STORY = 32
const HUT = 20
const HUT_ROOF = 14
const CHIMNEY = 24
const DOOR = 5 * U
const DOOR_HEIGHT = 16
const AWNING = 6 * U
const AWNING_DEPTH = 3 * U
const CHIMNEY_HALF = 2 * U
const CUPOLA_HALF = 3 * U
const CUPOLA = 10
const CUPOLA_CAP = 8
const CRATE = 3 * U
const CRATE_HEIGHT = 12
/** Half a road's width. */
const ROAD = 6 * U
const HOUSE_DOOR = 2 * U
const HOUSE_DOOR_HEIGHT = 9
const HOUSE_ROOF = 8

export type Emphasis = "normal" | "danger"

/** The layers of the town, back to front. */
export interface Stage {
  readonly world: Container
  readonly floor: Graphics
  readonly ground: Graphics
  readonly plates: Container
  readonly roads: Graphics
  readonly preview: Container
  readonly objects: Container
  readonly labels: Container
  readonly overlay: Graphics
  readonly ghost: Graphics
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const smooth = (t: number) => {
  const u = clamp01(t)
  return u * u * (3 - 2 * u)
}

/**
 * How far along each stage of putting a building up is, from `build` 0 → 1:
 * the plate is marked out, a wire frame rises, the walls grow up inside it,
 * then the door, windows, and roof are fitted.
 */
export const buildStages = (build: number) => ({
  plate: smooth(build / 0.12),
  frame: smooth((build - 0.1) / 0.25),
  walls: smooth((build - 0.38) / 0.37),
  fit: smooth((build - 0.78) / 0.22)
})

/** A stable number from 0 to 1 for a cell, so the land varies without being random each frame. */
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// ── Shapes ────────────────────────────────────────────────────────────────

/** A point around a footprint's centre (u, v in cells, z in pixels). */
const at = (u: number, v: number, z: number): Point => toScreen(u, v, z)

const quad = (g: Graphics, points: ReadonlyArray<Point>, fill: number, alpha = 1) =>
  g.poly(flat(points)).fill({ color: fill, alpha }).stroke({ color: ink, width: LINE, join: "round" })

const outline = (g: Graphics, points: ReadonlyArray<Point>, width = LINE, color = ink, alpha = 1) =>
  g.poly(flat(points)).stroke({ color, width, alpha, join: "round" })

const line = (g: Graphics, a: Point, b: Point, width = LINE, color = ink, alpha = 1) =>
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha, cap: "round" })

/** A square on the floor (or at height `z`), centred on (u, v). */
const square = (u: number, v: number, half: number, z = 0): Array<Point> => [
  at(u - half, v - half, z),
  at(u + half, v - half, z),
  at(u + half, v + half, z),
  at(u - half, v + half, z)
]

/** A plate, `half` from its centre; while it is marked out, only its outline, growing. */
export const plate = (g: Graphics, half: number, alpha = 1, marked = 1, filled = true) => {
  g.poly(flat(square(0, 0, half * (0.8 + 0.2 * marked))))
    .fill({ color: plateFill, alpha: filled ? alpha : 0 })
    .stroke({ color: ink, width: LINE, alpha: alpha * marked, join: "round" })
}

/** Half a plate's width for a footprint `size` cells a side: a unit inside it. */
export const plateHalf = (size: number) => (size * 8 - 1) * U

/** The wire frame of a box, `h` pixels tall: every edge, the hidden ones too. */
const drawFrame = (g: Graphics, a: number, h: number) => {
  const base = square(0, 0, a)
  for (const c of base) line(g, c, { x: c.x, y: c.y - h }, DETAIL)
  outline(g, square(0, 0, a, h), DETAIL)
}

/** A point on one of the two walls facing the viewer: "right" faces +x (u = a), "left" faces +y (v = a). */
type Side = "right" | "left"
const onWall = (side: Side, a: number) => (along: number, out: number, z: number) =>
  side === "right" ? at(a + out, along, z) : at(along, a + out, z)

/** The two walls facing the viewer, `a` from the centre and `H` tall. */
const walls = (g: Graphics, a: number, H: number) => {
  quad(g, [at(-a, a, 0), at(a, a, 0), at(a, a, H), at(-a, a, H)], leftFill)
  quad(g, [at(a, -a, 0), at(a, a, 0), at(a, a, H), at(a, -a, H)], rightFill)
}

/** A roof's two slopes: the one facing the viewer, and the one in shade. */
interface RoofColors {
  readonly face: number
  readonly shade: number
}
const paleRoof: RoofColors = { face: roofFill, shade: rightFill }

/**
 * A gabled roof on walls `a` from the centre and `H` tall, rising `rise` px
 * to a ridge along x (its gable end on the +x wall) or along y (on the +y
 * wall). `chimney` puts a chimney on the slope in shade.
 */
const gable = (g: Graphics, a: number, H: number, rise: number, ridgeAlong: "x" | "y" = "x", colors: RoofColors = paleRoof, chimney = false) => {
  const ridge = H + rise
  const stack = () => {
    if (!chimney || rise < 4) return
    const c = U
    const u = ridgeAlong === "x" ? -a / 2 : -a / 2
    const v = ridgeAlong === "x" ? -a / 2 : a / 2
    roofBox(g, u, v, c, H + Math.round(rise / 2), ridge + 4)
    quad(g, square(u, v, c, ridge + 4), roofFill)
  }
  if (ridgeAlong === "x") {
    quad(g, [at(-a, -a, H), at(a, -a, H), at(a, 0, ridge), at(-a, 0, ridge)], colors.shade)
    stack()
    quad(g, [at(a, -a, H), at(a, a, H), at(a, 0, ridge)], rightFill)
    quad(g, [at(-a, a, H), at(a, a, H), at(a, 0, ridge), at(-a, 0, ridge)], colors.face)
  } else {
    quad(g, [at(-a, -a, H), at(-a, a, H), at(0, a, ridge), at(0, -a, ridge)], colors.shade)
    stack()
    quad(g, [at(-a, a, H), at(a, a, H), at(0, a, ridge)], leftFill)
    quad(g, [at(a, -a, H), at(a, a, H), at(0, a, ridge), at(0, -a, ridge)], colors.face)
  }
}

/** A small glazed window, a unit either side of `along`, `z` to `z + 5` px up a wall. */
const window_ = (g: Graphics, side: Side, a: number, along: number, z: number, glass = 0xdbe6ea) => {
  const p = onWall(side, a)
  g.poly(flat([p(along - U, 0, z), p(along + U, 0, z), p(along + U, 0, z + 5), p(along - U, 0, z + 5)])).fill({ color: glass }).stroke({ color: ink, width: DETAIL, join: "round" })
}

// ── Buildings ─────────────────────────────────────────────────────────────

/** Height of a kind's walls at full size. */
export const heightOf = (kind: Kind) => (kind.roof === "gable" ? HUT : kind.stories * STORY)
/** Height of a kind's building at full size, roof and topper included. */
export const topOf = (kind: Kind) =>
  heightOf(kind) + (kind.roof === "gable" ? HUT_ROOF : kind.topper === "none" ? 0 : kind.topper === "sails" ? 24 : CHIMNEY)

/** The centres of a flat roof's bays, back row first, in cells. */
const bays = (kind: Kind): Array<{ readonly u: number; readonly v: number; readonly index: number }> => {
  const pitch = (2 * kind.half) / kind.bays
  const out = []
  for (let row = 0; row < kind.bays; row++) {
    for (let col = 0; col < kind.bays; col++) {
      out.push({ u: (-kind.half + pitch * (col + 0.5)) * U, v: (-kind.half + pitch * (row + 0.5)) * U, index: row * kind.bays + col })
    }
  }
  return out
}

/** The topper stands in the back bay; a flag in the right-hand one. */
const backBay = (kind: Kind) => bays(kind)[0]!
const flagBay = (kind: Kind) => bays(kind)[kind.bays - 1]!

/** A loading door on a wall, centred on it as the entrance is, with its awning. */
const drawDoor = (g: Graphics, side: Side, a: number, H: number, fit: number, door: number, color: number) => {
  const p = onWall(side, a)
  const top = Math.round(Math.min(DOOR_HEIGHT, H - 8) * smooth((fit - 0.15) / 0.35))
  if (top <= 0) return
  const open = Math.round(top * door * 0.75)
  const frame = [p(-DOOR, 0, 0), p(DOOR, 0, 0), p(DOOR, 0, top), p(-DOOR, 0, top)]
  g.poly(flat(frame)).fill({ color: 0x8f9891 })
  g.poly(flat([p(-DOOR, 0, open), p(DOOR, 0, open), p(DOOR, 0, top), p(-DOOR, 0, top)])).fill({ color: 0xeef0ea })
  for (let z = top - 3; z > open; z -= 3) line(g, p(-DOOR, 0, z), p(DOOR, 0, z), DETAIL, 0x9aa29b)
  outline(g, frame)
  if (fit > 0.5) {
    const out = AWNING_DEPTH * smooth((fit - 0.5) / 0.3)
    quad(g, [p(-AWNING, 0, top + 4), p(AWNING, 0, top + 4), p(AWNING, out, top + 2), p(-AWNING, out, top + 2)], color)
  }
}

/** Vertical seams on a wall: framing the door when it has one, else one down the middle. */
const drawSeams = (g: Graphics, side: Side, a: number, H: number, door: boolean) => {
  const p = onWall(side, a)
  const seams = door ? [-(a - 4 * U), a - 4 * U] : [0]
  for (const s of seams) line(g, p(s, 0, 0), p(s, 0, H), DETAIL, ink, 0.5)
}

/**
 * Windows down a flat-roofed building's wall, on every floor: beside the
 * door when there is room, else two along it. A chapel's are tall and pointed.
 */
const drawWallWindows = (g: Graphics, side: Side, a: number, H: number, door: boolean, stories: number, glass: number, pointed: boolean) => {
  const p = onWall(side, a)
  const along = door ? (a >= 12 * U ? [-(a - 3 * U), a - 3 * U] : []) : [-Math.round(a / U / 2) * U, Math.round(a / U / 2) * U]
  const tall = pointed ? 14 : 8
  for (let floor = 0; floor < stories; floor++) {
    const z = floor * STORY + (pointed ? 9 : 12)
    if (z + tall + 4 > H) continue
    for (const s of along) {
      const w = U
      const shape = pointed
        ? [p(s - w, 0, z), p(s + w, 0, z), p(s + w, 0, z + tall - 3), p(s, 0, z + tall), p(s - w, 0, z + tall - 3)]
        : [p(s - w, 0, z), p(s + w, 0, z), p(s + w, 0, z + tall), p(s - w, 0, z + tall)]
      g.poly(flat(shape)).fill({ color: glass }).stroke({ color: ink, width: DETAIL, join: "round" })
      line(g, p(s - w - 0.5 * U, 0, z), p(s + w + 0.5 * U, 0, z), DETAIL)
    }
  }
}

/** A small box on the roof, `c` from its centre (u, v), from `base` up to `top`. */
const roofBox = (g: Graphics, u: number, v: number, c: number, base: number, top: number) => {
  quad(g, [at(u - c, v + c, base), at(u + c, v + c, base), at(u + c, v + c, top), at(u - c, v + c, top)], leftFill)
  quad(g, [at(u + c, v - c, base), at(u + c, v + c, base), at(u + c, v + c, top), at(u + c, v - c, top)], rightFill)
}

/** Which walls facing the viewer have a door: where a road meets the building. */
export interface Doors {
  readonly right: boolean
  readonly left: boolean
}

// ── Solids for props ──

/** Screen pixels a unit along the floor spans. */
const PX = Math.sqrt(5)

/** A point on an upright plane through (u, v, z) across `axis`: `s` px along the floor (towards +v across "u", +u across "v"), `t` px up. */
const upright = (axis: "u" | "v", u: number, v: number, z: number) => (s: number, t: number): Point =>
  axis === "u" ? at(u, v + (s / PX) * U, z + t) : at(u + (s / PX) * U, v, z + t)

/** A circle `r` px across on an upright plane (see `upright`). */
const ring = (axis: "u" | "v", u: number, v: number, z: number, r: number, n = 18): Array<Point> => {
  const p = upright(axis, u, v, z)
  return Array.from({ length: n }, (_, i) => p(Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r))
}

/** The convex hull of some points (monotone chain). */
const hull = (points: ReadonlyArray<Point>): Array<Point> => {
  const sorted = [...points].sort((p, q) => p.x - q.x || p.y - q.y)
  const cross = (o: Point, p: Point, q: Point) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x)
  const half = (list: ReadonlyArray<Point>) => {
    const out: Array<Point> = []
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

/** An ellipse's points: a circle `r` units across on the floor at (cx, cy) on screen, from angle `from` to `to`. */
const floorArc = (cx: number, cy: number, r: number, from: number, to: number, n = 12): Array<Point> =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / n
    return { x: cx + Math.cos(t) * (r / U) * 2 * Math.SQRT2, y: cy + Math.sin(t) * (r / U) * Math.SQRT2 }
  })

/** A box `su` × `sv` from its centre (u, v), `h` px tall from `z`. */
const box = (g: Graphics, u: number, v: number, su: number, sv: number, z: number, h: number, top = roofFill, left = leftFill, right = rightFill, width = LINE) => {
  const face = (points: ReadonlyArray<Point>, fill: number) => g.poly(flat(points)).fill({ color: fill }).stroke({ color: ink, width, join: "round" })
  face([at(u - su, v + sv, z), at(u + su, v + sv, z), at(u + su, v + sv, z + h), at(u - su, v + sv, z + h)], left)
  face([at(u + su, v - sv, z), at(u + su, v + sv, z), at(u + su, v + sv, z + h), at(u + su, v - sv, z + h)], right)
  face([at(u - su, v - sv, z + h), at(u + su, v - sv, z + h), at(u + su, v + sv, z + h), at(u - su, v + sv, z + h)], top)
}

/** A standing cylinder `r` units across at (u, v), `h` px tall from `z`; `cap` puts a pointed roof on it. */
const cylinder = (g: Graphics, u: number, v: number, r: number, z: number, h: number, side: number, top: number, cap?: number) => {
  const base = at(u, v, z)
  const rx = (r / U) * 2 * Math.SQRT2
  const lid = base.y - h
  g.poly(flat([{ x: base.x - rx, y: lid }, ...floorArc(base.x, base.y, r, Math.PI, 0), { x: base.x + rx, y: lid }]))
    .fill({ color: side }).stroke({ color: ink, width: LINE, join: "round" })
  if (cap === undefined) {
    g.poly(flat(floorArc(base.x, lid, r, 0, Math.PI * 2, 20))).fill({ color: top }).stroke({ color: ink, width: LINE })
    return
  }
  g.poly(flat([...floorArc(base.x, lid, r, 0, Math.PI), { x: base.x, y: lid - cap }]))
    .fill({ color: top }).stroke({ color: ink, width: LINE, join: "round" })
}

/** A cylinder lying along `axis` (a log, a bale), `r` px thick, from `from` to `to` units along it, at `across` and resting on `z`. */
const log = (g: Graphics, axis: "u" | "v", across: number, from: number, to: number, z: number, r: number, side: number, end: number) => {
  const ends = (along: number) => (axis === "u" ? ring("u", along, across, z + r, r) : ring("v", across, along, z + r, r))
  g.poly(flat(hull([...ends(from), ...ends(to)]))).fill({ color: side }).stroke({ color: ink, width: DETAIL, join: "round" })
  g.poly(flat(ends(to))).fill({ color: end }).stroke({ color: ink, width: DETAIL })
  const c = axis === "u" ? at(to, across, z + r) : at(across, to, z + r)
  g.circle(c.x, c.y, Math.max(0.6, r * 0.35)).stroke({ color: ink, width: DETAIL, alpha: 0.45 })
}

/** A post `h` px tall. */
const post = (g: Graphics, u: number, v: number, h: number, z = 0) => line(g, at(u, v, z), at(u, v, z + h), LINE)

/** A sack of flour or grain, standing at (u, v). */
const sack = (g: Graphics, u: number, v: number, fill = 0xf2ecdc, z = 0) => {
  const c = at(u, v, z)
  g.roundRect(c.x - 3, c.y - 7, 6, 7, 2.5).fill({ color: fill }).stroke({ color: ink, width: DETAIL })
  line(g, { x: c.x - 1.5, y: c.y - 5.5 }, { x: c.x + 1.5, y: c.y - 5.5 }, DETAIL, ink, 0.6)
}

/** A small round bush. */
const bush = (g: Graphics, u: number, v: number, r: number, leaves: Leaves) => {
  const c = at(u, v, 0)
  g.circle(c.x, c.y - r, r).fill({ color: leaves.shade }).stroke({ color: ink, width: DETAIL })
  g.circle(c.x - r * 0.25, c.y - r * 1.25, r * 0.65).fill({ color: leaves.light })
}

/** A sheep: a woolly body, a dark head, four legs. */
const sheepAt = (g: Graphics, u: number, v: number, facing: 1 | -1) => {
  const c = at(u, v, 0)
  for (const dx of [-2, 2]) line(g, { x: c.x + dx, y: c.y - 2 }, { x: c.x + dx, y: c.y }, DETAIL)
  g.ellipse(c.x, c.y - 4.5, 4.5, 3).fill({ color: 0xf8f8f4 }).stroke({ color: ink, width: DETAIL })
  g.circle(c.x + facing * 4.5, c.y - 5.5, 1.6).fill({ color: ink })
}

/** A small banner of cloth hung on a line between two posts across `axis`, in turn coloured. */
const clothLine = (g: Graphics, u: number, v0: number, v1: number, colors: ReadonlyArray<number>) => {
  post(g, u, v0, 11)
  post(g, u, v1, 11)
  line(g, at(u, v0, 11), at(u, v1, 11), DETAIL)
  const n = colors.length
  const step = (v1 - v0) / n
  colors.forEach((color, i) => {
    const s = v0 + step * i + U * 0.4
    const e = v0 + step * (i + 1) - U * 0.4
    quad(g, [at(u, s, 10.5), at(u, e, 10.5), at(u, e, 4 + (i % 2)), at(u, s, 4 + (i % 2))], color)
  })
}

// ── How each kind is dressed ──

/** A colour `t` of the way to `to`. */
const mix = (from: number, to: number, t: number) => {
  const c = (shift: number) => Math.round(((from >> shift) & 0xff) * (1 - t) + ((to >> shift) & 0xff) * t)
  return (c(16) << 16) | (c(8) << 8) | c(0)
}
const pale = (color: number, t = 0.7) => mix(color, 0xffffff, t)
const roofOf = (color: number): RoofColors => ({ face: pale(color, 0.7), shade: pale(color, 0.52) })

const glassCool = 0xdbe6ea
const glassWarm = 0xf3dca6

interface Dress {
  /** Awnings, the roof's trim, flags. */
  readonly accent: number
  /** A gabled kind's roof. */
  readonly roof?: RoofColors
  readonly glass?: number
  readonly flag?: number
  /** What stands around it on its plate, drawn once it is fitted out: `a` the walls' half width, `p` the plate's. */
  readonly yard?: (g: Graphics, a: number, p: number, kind: Kind) => void
}

/** Where things stand on a plate: in the front corner, and in the strips beside the back of each wall facing the viewer. */
const corner = (a: number, p: number) => (a + p) / 2

const dresses: Readonly<Record<KindId, Dress>> = {
  townhall: {
    accent: 0x8a58a8, flag: 0xc4523f, glass: glassWarm,
    yard: (g, a) => {
      for (const axis of ["u", "v"] as const) {
        const face = ring(axis, axis === "u" ? a : 0, axis === "u" ? 0 : a, STORY + 18, 5)
        g.poly(flat(face)).fill({ color: 0xfaf8ee }).stroke({ color: ink, width: DETAIL })
        const c = axis === "u" ? at(a, 0, STORY + 18) : at(0, a, STORY + 18)
        line(g, c, { x: c.x, y: c.y - 3.5 }, DETAIL)
        line(g, c, { x: c.x + (axis === "u" ? 2.5 : -2.5), y: c.y + 0.5 }, DETAIL)
      }
    }
  },
  warehouse: {
    accent: 0x8a58a8,
    yard: (g, a, p) => {
      const c = corner(a, p)
      drawCrate(g, 0x2f8c87, 1.6 * U, 6, 0, c, c - 1.5 * U)
      drawCrate(g, 0xd27a34, 1.6 * U, 6, 0, c, c + 1.5 * U)
      cylinder(g, c, -a - 2 * U, 1.5 * U, 0, 8, 0xc79a5b, 0xe9c48a)
    }
  },
  lumberjack: {
    accent: 0x8a6a45, roof: roofOf(0x8a6a45),
    yard: (g, a, p) => {
      const c = corner(a, p)
      for (const [du, z] of [[-1.6, 0], [0, 0], [1.6, 0], [-0.8, 2.6], [0.8, 2.6]] as const) {
        log(g, "v", c + du * U, a + 0.5 * U, p - 0.5 * U, z, 1.6, 0xb08a5e, 0xe9d2a8)
      }
      cylinder(g, c, -a - 1.5 * U, 1.3 * U, 0, 3, 0xb08a5e, 0xe9d2a8)
      const top = at(c, -a - 1.5 * U, 3)
      line(g, { x: top.x - 1, y: top.y - 1 }, { x: top.x + 3, y: top.y - 7 }, LINE, 0x7d6140)
      g.poly([top.x + 1.5, top.y - 7, top.x + 5, top.y - 8, top.x + 4, top.y - 5]).fill({ color: 0x8f9891 }).stroke({ color: ink, width: DETAIL })
    }
  },
  forester: {
    accent: 0x6e8f36, roof: roofOf(0x6e8f36),
    yard: (g, a, p) => {
      const c = corner(a, p)
      for (const [u, v, s] of [[c, c, 0.8], [c, -a - 2 * U, 0.6], [-a - 2 * U, c, 0.55]] as const) {
        const base = at(u, v, 0)
        cylinder(g, u, v, 1.2 * U, 0, 3, 0xd5a86c, 0x7d6140)
        fir(g, base.x, base.y - 3, s, 2, firLeaves)
      }
    }
  },
  quarry: {
    accent: 0x8f9891,
    yard: (g, a, p) => {
      const c = corner(a, p)
      const stone = { top: 0xeeefea, left: 0xdcded7, right: 0xc9ccc4 }
      box(g, c - 1 * U, c - 1 * U, 1.2 * U, 1.2 * U, 0, 5, stone.top, stone.left, stone.right)
      box(g, c + 1.2 * U, c - 0.8 * U, 1.2 * U, 1.2 * U, 0, 5, stone.top, stone.left, stone.right)
      box(g, c - 0.5 * U, c + 1.4 * U, 1.2 * U, 1.2 * U, 0, 5, stone.top, stone.left, stone.right)
      box(g, c, c, 1.2 * U, 1.2 * U, 5, 5, stone.top, stone.left, stone.right)
      // A hoist: an A-frame with a hanging hook.
      const f = -a - 2.5 * U
      const top = at(c, f, 16)
      line(g, at(c - 1.5 * U, f, 0), top, LINE)
      line(g, at(c + 1.5 * U, f, 0), top, LINE)
      line(g, top, { x: top.x, y: top.y + 8 }, DETAIL)
      box(g, c, f, U, U, 4, 4, stone.top, stone.left, stone.right)
    }
  },
  mine: {
    accent: 0x5a6479, glass: 0xd5dae4,
    yard: (g, a, p) => {
      const c = corner(a, p)
      // Rails and an ore cart.
      for (const du of [-1, 1]) line(g, at(c + du * U, a + 0.5 * U, 0), at(c + du * U, p - 0.2 * U, 0), DETAIL, ink, 0.6)
      box(g, c, c, 1.6 * U, 2 * U, 2, 5, 0x6c7488, 0xd5dae4, 0xbcc3d1)
      for (const [dx, dy] of [[-2, 0], [1, -1], [3, 1]] as const) {
        const top = at(c, c, 8)
        g.circle(top.x + dx, top.y + dy, 1.5).fill({ color: 0x5a6479 }).stroke({ color: ink, width: DETAIL })
      }
      for (const dv of [-1.2, 1.2]) {
        const w = at(c + 1.6 * U, c + dv * U, 1.5)
        g.circle(w.x, w.y, 1.5).fill({ color: ink })
      }
      // A heap of ore by the wall.
      const h = at(c, -a - 2 * U, 0)
      g.poly([h.x - 9, h.y, h.x - 2, h.y - 6, h.x + 2, h.y - 5, h.x + 8, h.y]).fill({ color: 0xbcc3d1 }).stroke({ color: ink, width: DETAIL, join: "round" })
      for (const [dx, dy] of [[-3, -2], [1, -3], [4, -1]] as const) g.rect(h.x + dx, h.y + dy, 2, 2).fill({ color: 0x5a6479 })
    }
  },
  fishery: {
    accent: 0x2f8c87, roof: roofOf(0x2f8c87),
    yard: (g, a, p) => {
      const c = corner(a, p)
      cylinder(g, c, c, 1.5 * U, 0, 7, 0xc79a5b, 0x9fc9c4)
      // A drying rack, fish hanging from it.
      const u = c
      const v0 = -a - 4 * U
      const v1 = -a + 3 * U
      post(g, u, v0, 11)
      post(g, u, v1, 11)
      line(g, at(u, v0, 11), at(u, v1, 11), DETAIL)
      for (let i = 1; i <= 3; i++) {
        const t = at(u, v0 + ((v1 - v0) * i) / 4, 11)
        line(g, t, { x: t.x, y: t.y + 2 }, DETAIL)
        g.poly([t.x, t.y + 2, t.x + 1.8, t.y + 5, t.x, t.y + 8, t.x - 1.8, t.y + 5]).fill({ color: 0x2f8c87 }).stroke({ color: ink, width: DETAIL })
      }
    }
  },
  sawmill: {
    accent: 0xd27a34, glass: glassCool,
    yard: (g, a, p) => {
      const c = corner(a, p)
      // Planks stacked by one wall, a log waiting by the other.
      for (let i = 0; i < 3; i++) box(g, c, -a + 1.5 * U, 1.1 * U, 3 * U, i * 2.5, 2.5, 0xf0c59a, 0xe2a873, 0xd2945c, DETAIL)
      log(g, "u", c, -a - 3 * U, -a + 4 * U, 0, 2, 0xb08a5e, 0xe9d2a8)
    }
  },
  smithy: {
    accent: 0xb04a39, glass: glassWarm,
    yard: (g, a, p) => {
      const c = corner(a, p)
      // An anvil on a block.
      cylinder(g, c, c, 1 * U, 0, 3, 0xb08a5e, 0xe9d2a8)
      box(g, c, c, 0.6 * U, 1.4 * U, 3, 3, 0x6d7671, 0x5a625e, 0x4b524e)
      // A heap of coal by the wall.
      const h = at(c, -a - 2 * U, 0)
      g.poly([h.x - 7, h.y, h.x - 1, h.y - 5, h.x + 6, h.y]).fill({ color: 0x5a625e }).stroke({ color: ink, width: DETAIL, join: "round" })
    }
  },
  farm: {
    accent: 0xd6ae2e, roof: roofOf(0xc4523f),
    yard: (g, a, p) => {
      const c = corner(a, p)
      // A silo by the wall, hay bales in the front corner.
      cylinder(g, c + U, -a - 3 * U, 3.5 * U, 0, 28, 0xeeeae0, pale(0xc4523f, 0.6), 9)
      line(g, at(c + U, -a - 3 * U, 10), at(c + U, -a - 3 * U, 10), DETAIL)
      log(g, "u", c - 2.5 * U, a + 2 * U, a + 7 * U, 0, 3, 0xe9cf7c, 0xf3e3a8)
      log(g, "u", c + 2.5 * U, a + 2 * U, a + 7 * U, 0, 3, 0xe9cf7c, 0xf3e3a8)
      log(g, "u", c, a + 2 * U, a + 7 * U, 5, 3, 0xe9cf7c, 0xf3e3a8)
    }
  },
  mill: {
    accent: 0xc9b48a, roof: roofOf(0x8a6a45), glass: glassCool,
    yard: (g, a, p) => {
      const c = corner(a, p)
      sack(g, c - U, c + U)
      sack(g, c + 1.5 * U, c - U)
      sack(g, c + 0.5 * U, c + 2.5 * U)
    }
  },
  bakery: {
    accent: 0xc4523f, glass: glassWarm,
    yard: (g, a, p) => {
      const c = corner(a, p)
      sack(g, c, -a - 1 * U)
      sack(g, c, -a + 2 * U)
      // A sign with a loaf on it.
      const s = at(c, c, 0)
      line(g, s, { x: s.x, y: s.y - 12 }, LINE)
      g.roundRect(s.x - 4, s.y - 17, 8, 6, 1).fill({ color: 0xfaf3e3 }).stroke({ color: ink, width: DETAIL })
      g.ellipse(s.x, s.y - 14, 2.6, 1.6).fill({ color: 0xc4523f })
    }
  },
  sheep: {
    accent: 0xb5654a, roof: roofOf(0xb5654a),
    yard: (g, a, p) => {
      // A pen in the front corner: its back rails, the sheep, its front rails.
      const s = a + U
      const e = p - U
      const rails = (points: ReadonlyArray<readonly [number, number]>) => {
        for (const [u, v] of points) post(g, u, v, 6)
        for (let i = 1; i < points.length; i++) {
          for (const z of [2.5, 5.5]) line(g, at(points[i - 1]![0], points[i - 1]![1], z), at(points[i]![0], points[i]![1], z), DETAIL)
        }
      }
      rails([[s, e], [s, s], [e, s]])
      sheepAt(g, s + 3 * U, s + 4 * U, 1)
      sheepAt(g, s + 6 * U, s + 2.5 * U, -1)
      sheepAt(g, s + 5.5 * U, s + 6.5 * U, 1)
      rails([[s, e], [e, e], [e, s]])
      cylinder(g, corner(a, p), -a - 3 * U, 2 * U, 0, 5, 0xe9cf7c, 0xf3e3a8)
    }
  },
  weaver: {
    accent: 0x8a58a8, glass: glassCool,
    yard: (g, a, p) => {
      const c = corner(a, p)
      clothLine(g, c, -a - 2.5 * U, -a + 5 * U, [0x8a58a8, 0xd6ae2e, 0x3d6db5])
      sack(g, c, c, 0xeceee8)
    }
  },
  market: {
    accent: 0x3d6db5, flag: 0x3d6db5,
    yard: (g, a, p) => {
      const c = corner(a, p)
      // A stall with a striped canopy by one wall, crates by the other.
      const u0 = c - 1.2 * U
      const u1 = c + 1.2 * U
      const v0 = -a - 2.5 * U
      const v1 = -a + 4.5 * U
      for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]] as const) post(g, u, v, 11)
      box(g, c, (v0 + v1) / 2, 1.2 * U, (v1 - v0) / 2, 0, 4, 0xe9c48a, 0xd5a86c, 0xc79a5b)
      const strips = 5
      for (let i = 0; i < strips; i++) {
        const s = v0 + ((v1 - v0) * i) / strips
        const e = v0 + ((v1 - v0) * (i + 1)) / strips
        quad(g, [at(u0, s, 12), at(u0, e, 12), at(u1 + U, e, 9), at(u1 + U, s, 9)], i % 2 === 0 ? 0xc4523f : 0xf7f3ea)
      }
      drawCrate(g, 0x2f8c87, 1.2 * U, 5, 0, -a - 2 * U, c)
      drawCrate(g, 0xc4523f, 1.2 * U, 5, 0, -a + 1.5 * U, c)
      drawCrate(g, 0x8a58a8, 1.2 * U, 5, 5, -a - 0.2 * U, c)
    }
  },
  chapel: {
    accent: 0x3d6db5, glass: 0xc9d6ee,
    yard: (g, a, p) => {
      const c = corner(a, p)
      bush(g, c, c, 4.5, broadLeaves[0]!)
      bush(g, c, -a - 1 * U, 4, broadLeaves[1]!)
      bush(g, -a - 1 * U, c, 4, broadLeaves[2]!)
    }
  },
  // New kinds: plain dresses in their colour until they get drawings of their own.
  granary: { accent: 0xd6ae2e },
  smokehouse: { accent: 0x9a5b3a, roof: roofOf(0x9a5b3a) },
  firewatch: { accent: 0xc4523f, roof: roofOf(0xc4523f) },
  healer: { accent: 0x4f9a8a },
  hospital: { accent: 0x4f9a8a, glass: glassCool },
  watchhouse: { accent: 0x3d4f6e, flag: 0x3d4f6e },
  builder: { accent: 0x8a6a45, roof: roofOf(0xb08a5a) }
}

/**
 * A building, `build` 0 → 1 of the way up (see `buildStages`); `door` 0
 * (shut) → 1 (open); `wave` drives flags and sails. `plain` draws it bare
 * and grey, as a ghost.
 */
/**
 * A piece of park for the build menu, on a cell of its ground: lawn, a
 * flower bed, a gravel walk, a paved square, or a furnishing (a lamp on
 * lawn, a statue or a fountain on a square).
 */
export const drawParkPiece = (g: Graphics, what: GroundId | PropId) => {
  const p = plateHalf(1)
  const green = 0xd8e6c9
  const stone = 0xe4e6e0
  quad(g, square(0, 0, p), what === "square" || what === "statue" || what === "fountain" ? stone : green)
  const tree = (u: number, v: number, r = 6) => {
    const c = at(u, v, 0)
    line(g, c, { x: c.x, y: c.y - 4 }, LINE, 0x6b5a45)
    g.ellipse(c.x, c.y - 4 - r, r, r).fill({ color: 0xa9c79a }).stroke({ color: ink, width: DETAIL })
  }
  switch (what) {
    case "lawn":
      for (const [u, v] of [[-0.2, -0.1], [0.15, 0.2], [0.25, -0.25], [-0.25, 0.25]]) {
        const c = at(u!, v!, 0)
        line(g, { x: c.x - 1.5, y: c.y }, { x: c.x, y: c.y - 3 }, DETAIL, 0x8fae80)
        line(g, { x: c.x + 1.5, y: c.y }, { x: c.x, y: c.y - 3 }, DETAIL, 0x8fae80)
      }
      return
    case "flowers":
      quad(g, square(0, 0, p * 0.65), 0xd9c7a6)
      for (const [i, [u, v]] of [[-0.2, -0.2], [0.2, -0.2], [0, 0], [-0.2, 0.2], [0.2, 0.2]].entries())
        g.circle(at(u!, v!, 0).x, at(u!, v!, 0).y - 1.5, 2.2).fill({ color: [0xc78374, 0xd6ba69, 0xb29ac2, 0xe0a0a8][i % 4]! })
      return
    case "path":
      quad(g, [at(-0.5, -0.2, 0), at(0.5, -0.2, 0), at(0.5, 0.2, 0), at(-0.5, 0.2, 0)], 0xece4d3)
      return
    case "square":
      for (const u of [-0.25, 0, 0.25]) line(g, at(u, -0.45, 0), at(u, 0.45, 0), DETAIL, 0xc6ccc3)
      for (const v of [-0.25, 0, 0.25]) line(g, at(-0.45, v, 0), at(0.45, v, 0), DETAIL, 0xc6ccc3)
      return
    case "lamp": {
      line(g, at(0, 0, 0), at(0, 0, 18), LINE)
      g.rect(at(0, 0, 22).x - 2.5, at(0, 0, 22).y, 5, 5).fill({ color: 0xf6e6a8 }).stroke({ color: ink, width: DETAIL })
      return
    }
    case "fountain":
      cylinder(g, 0, 0, 5 * U, 0, 4, 0xdfe3dc, 0xc9dde6)
      cylinder(g, 0, 0, 1.2 * U, 4, 8, 0xdfe3dc, 0xeef0ea)
      return
    case "statue":
      cylinder(g, 0, 0, 2.5 * U, 0, 6, 0xdfe3dc, stone)
      cylinder(g, 0, 0, 1.2 * U, 6, 16, 0xc9ccc4, 0xb9beb5)
      return
  }
}

export const drawBuilding = (g: Graphics, kind: Kind, build: number, door: number, wave: number, doors: Doors, plain = false) => {
  const dress: Dress = plain ? { accent: 0xb9beb5 } : dresses[kind.id]
  const color = dress.accent
  const a = kind.half * U
  const full = heightOf(kind)
  const stage = buildStages(build)
  if (stage.frame <= 0) return
  if (stage.walls < 1) drawFrame(g, a, Math.round(full * stage.frame))
  if (stage.walls <= 0) return
  const H = Math.max(2, Math.round(full * stage.walls))
  const glass = dress.glass ?? glassCool

  walls(g, a, H)
  const flatRoof = kind.roof !== "gable"
  if (!flatRoof) {
    drawSeams(g, "left", a, H, doors.left)
    drawSeams(g, "right", a, H, doors.right)
  }
  if (kind.stories === 2 && H > STORY) {
    line(g, at(-a, a, STORY), at(a, a, STORY), DETAIL, ink, 0.7)
    line(g, at(a, -a, STORY), at(a, a, STORY), DETAIL, ink, 0.7)
  }
  if (flatRoof && stage.fit > 0.4) {
    drawWallWindows(g, "right", a, H, doors.right, kind.stories, glass, kind.id === "chapel")
    drawWallWindows(g, "left", a, H, doors.left, kind.stories, glass, kind.id === "chapel")
  }
  if (stage.fit > 0.15) {
    if (doors.right) drawDoor(g, "right", a, H, stage.fit, door, color)
    if (doors.left) drawDoor(g, "left", a, H, stage.fit, door, color)
  }

  if (kind.roof === "gable") {
    if (stage.fit > 0.4) {
      if (!doors.right) window_(g, "right", a, 0, 6, glass)
      if (!doors.left) window_(g, "left", a, 0, 6, glass)
    }
    gable(g, a, H, Math.round(HUT_ROOF * stage.fit), "x", dress.roof ?? paleRoof)
  } else {
    // A flat roof (the top of the walls while they rise), a band of colour under its edge, and its skylights, one by one.
    if (stage.fit > 0.3 && H > 6) {
      const band = (side: Side) => {
        const p = onWall(side, a)
        g.poly(flat([p(-a, 0, H - 3), p(a, 0, H - 3), p(a, 0, H), p(-a, 0, H)])).fill({ color: pale(color, 0.35) })
        line(g, p(-a, 0, H - 3), p(a, 0, H - 3), DETAIL, ink, 0.6)
      }
      band("right")
      band("left")
    }
    quad(g, square(0, 0, a, H), roofFill)
    if (kind.id === "mill" && stage.fit > 0) {
      // A pointed cap instead of skylights.
      const apex = at(0, 0, H + Math.round(16 * stage.fit))
      const roof = dress.roof ?? paleRoof
      quad(g, [at(a, -a, H), at(a, a, H), apex], roof.shade)
      quad(g, [at(-a, a, H), at(a, a, H), apex], roof.face)
    }
    const flag = kind.topper === "flag"
    const usesBack = kind.topper !== "none" && kind.topper !== "flag" && kind.topper !== "sails"
    if (stage.fit > 0.4 && kind.id !== "mill") {
      const all = bays(kind).filter((bay) => !(usesBack && bay.index === 0) && !(flag && bay.index === kind.bays - 1))
      const shown = Math.ceil(all.length * smooth((stage.fit - 0.4) / 0.4))
      for (const bay of all.slice(0, shown)) {
        const pane = square(bay.u, bay.v, (kind.window / 2) * U, H)
        g.poly(flat(pane)).fill({ color: glass }).stroke({ color: ink, width: LINE, join: "round" })
        line(g, pane[0]!, pane[2]!, DETAIL, ink, 0.25)
      }
    }
  }

  if (stage.fit > 0) {
    const { u, v } = backBay(kind)
    if (kind.topper === "cupola") {
      const c = CUPOLA_HALF
      const top = H + Math.round(CUPOLA * stage.fit)
      const apex = top + Math.round(CUPOLA_CAP * stage.fit)
      roofBox(g, u, v, c, H, top)
      outline(g, [at(u - U, v + c, top - 7), at(u + U, v + c, top - 7), at(u + U, v + c, top - 2), at(u - U, v + c, top - 2)], DETAIL)
      outline(g, [at(u + c, v - U, top - 7), at(u + c, v + U, top - 7), at(u + c, v + U, top - 2), at(u + c, v - U, top - 2)], DETAIL)
      const cap = plain ? paleRoof : roofOf(color)
      quad(g, [at(u - c, v + c, top), at(u + c, v + c, top), at(u, v, apex)], cap.face)
      quad(g, [at(u + c, v - c, top), at(u + c, v + c, top), at(u, v, apex)], cap.shade)
      if (stage.fit > 0.9) {
        const tip = at(u, v, apex)
        line(g, tip, { x: tip.x, y: tip.y - 7 }, LINE)
        line(g, { x: tip.x - 2.5, y: tip.y - 5 }, { x: tip.x + 2.5, y: tip.y - 5 }, LINE)
      }
    } else if (kind.topper === "chimney") {
      const top = H + Math.round(CHIMNEY * stage.fit)
      roofBox(g, u, v, CHIMNEY_HALF, H, top)
      quad(g, square(u, v, CHIMNEY_HALF, top), roofFill)
      if (!plain) g.poly(flat(square(u, v, CHIMNEY_HALF - 0.5 * U, top))).fill({ color: ink, alpha: 0.55 })
    } else if (kind.topper === "crates") {
      // Crates stacked on the roof's back bay, labelled with what is stored.
      if (stage.fit > 0.5) {
        const labels = plain ? [0x8f9891, 0x8f9891, 0x8f9891] : [0xd27a34, 0x2f8c87, 0x8a58a8]
        drawCrate(g, labels[0]!, CRATE, CRATE_HEIGHT, H, u, v)
        drawCrate(g, labels[1]!, CRATE, CRATE_HEIGHT, H, u + 7 * U, v)
        drawCrate(g, labels[2]!, CRATE, CRATE_HEIGHT, H + CRATE_HEIGHT, u + 3 * U, v)
      }
    } else if (kind.topper === "sails" && stage.fit > 0.6) {
      // Four lattice sails turning with `wave` on the upright plane in front of the wall facing +x.
      const out = a + 3 * U
      const hubZ = H - 6
      line(g, at(a, 0, hubZ), at(out, 0, hubZ), LINE)
      const p = upright("u", out, 0, hubZ)
      for (let i = 0; i < 4; i++) {
        const turn = wave * 0.6 + (i * Math.PI) / 2
        const d = { s: Math.cos(turn), t: Math.sin(turn) }
        const n = { s: -d.t, t: d.s }
        const along = (r: number, w: number) => p(d.s * r + n.s * w, d.t * r + n.t * w)
        line(g, along(0, 0), along(26, 0), LINE)
        const sail = [along(8, 0.5), along(26, 0.5), along(26, 6), along(8, 6)]
        g.poly(flat(sail)).fill({ color: plain ? roofFill : 0xf6f1e4 }).stroke({ color: ink, width: DETAIL, join: "round" })
        for (const r of [14, 20]) line(g, along(r, 0.5), along(r, 6), DETAIL, ink, 0.6)
        line(g, along(8, 3.2), along(26, 3.2), DETAIL, ink, 0.4)
      }
      const hub = p(0, 0)
      g.circle(hub.x, hub.y, 2.2).fill({ color: roofFill }).stroke({ color: ink, width: DETAIL })
    }
  }

  if (kind.topper === "flag" && stage.fit > 0.9) {
    const { u, v } = flagBay(kind)
    const base = at(u, v, H)
    const tip = { x: base.x, y: base.y - 24 }
    line(g, base, tip, LINE)
    const flutter = Math.round(Math.sin(wave) * 2)
    g.poly([tip.x, tip.y, tip.x - 11, tip.y + 4 + flutter, tip.x, tip.y + 8])
      .fill({ color: plain ? ink : dress.flag ?? ink }).stroke({ color: ink, width: DETAIL, join: "round" })
  }

  if (!plain && dress.yard && stage.fit > 0.6) dress.yard(g, a, plateHalf(kind.size), kind)
}

/** Where a building's chimney puffs from, around its footprint's centre. */
export const chimneyTop = (kind: Kind): Point => {
  const { u, v } = backBay(kind)
  return at(u, v, heightOf(kind) + CHIMNEY + 4)
}

/** A small red-edged marker with an exclamation mark: something keeps this building from working. */
const drawMarker = (g: Graphics) => {
  g.roundRect(-7.5, -7.5, 15, 15, 2).fill({ color: 0xf6f7f3 }).stroke({ color: alarm, width: 1 })
  g.rect(-1, -4.5, 2, 6).fill({ color: alarm })
  g.rect(-1, 2.5, 2, 2).fill({ color: alarm })
}

/**
 * A construction site on a plate `half` from its centre: a stake at each
 * corner with a line strung between them, and crates of materials piling
 * up at the front as `share` (0 → 1) of them arrives.
 */
export const drawSite = (g: Graphics, half: number, share: number) => {
  const s = half - U
  const tops = square(0, 0, s, 6)
  outline(g, tops, DETAIL, ink, 0.45)
  for (const [u, v] of [[-s, -s], [s, -s], [s, s], [-s, s]] as const) line(g, at(u, v, 0), at(u, v, 7), LINE)
  const crates = Math.min(3, Math.ceil(share * 3))
  const spots: ReadonlyArray<readonly [number, number, number]> = [[s - 3 * U, s - 3 * U, 0], [s - 3 * U, s - 8 * U, 0], [s - 3 * U, s - 5.5 * U, 5]]
  for (let i = 0; i < crates; i++) {
    const [u, v, z] = spots[i]!
    drawCrate(g, 0x8f9891, 2 * U, 5, z, u, v)
  }
}

/** What a building view shows each frame. */
export interface BuildingLook {
  readonly effects?: Partial<SurfaceState>
  /** A sign over it, and whether it is on fire. */
  readonly alert?: Alert | null
  readonly burning?: boolean
  readonly worn?: boolean
  readonly working: boolean
  /** Something keeps it from working: show the marker. */
  readonly problem: boolean
  /** 0 → 1 while it goes up. */
  readonly build: number
  /** Jobs finished, or walkers sent: each new one bounces the building. */
  readonly beat: number
  readonly doors: Doors
  /** While a site: the share of its materials in, else `null`. */
  readonly site: number | null
  /** A map view's colour washed over it, when one is shown. */
  readonly tint?: number | undefined
}

/** A building as drawn: its plate on the floor, its body among the other objects, and its problem marker above everything. */
export class BuildingView extends Container {
  private readonly kind: Kind
  private readonly plate = new Graphics()
  private readonly body = new Graphics()
  private readonly smoke = new Graphics()
  private readonly marker = new Graphics()
  private readonly rings: Array<{ age: number }> = []
  private puff = 0
  private door = 0
  private drawn = ""
  private wave = 0
  private pulse = 0
  private beat = -1

  constructor(kindId: KindId, stage: Stage) {
    super()
    this.kind = kinds[kindId]
    this.addChild(this.body, this.smoke)
    drawMarker(this.marker)
    this.marker.visible = false
    stage.plates.addChild(this.plate)
    stage.labels.addChild(this.marker)
  }

  /** Puts it on the grid by its footprint's top cell. */
  place(x: number, y: number) {
    const s = this.kind.size
    const centre = toScreen(x + s / 2, y + s / 2)
    this.position.set(centre.x, centre.y)
    this.plate.position.set(centre.x, centre.y)
    this.zIndex = x + y + s
    this.marker.position.set(centre.x, centre.y - topOf(this.kind) - 14)
  }

  update(look: BuildingLook, dt: number, emphasis: Emphasis) {
    if (this.beat >= 0 && look.beat > this.beat) this.pulse = 1
    this.beat = look.beat
    this.pulse = Math.max(0, this.pulse - dt * 3)
    const opening = look.working || this.pulse > 0.2 ? 1 : 0
    this.door += (opening - this.door) * Math.min(1, dt * 6)
    const moving = this.kind.topper === "flag" || (this.kind.topper === "sails" && look.working)
    if (moving) this.wave += dt * (look.working ? 6 : 3)

    // Redrawn only when something it shows moved by a whole pixel's worth.
    const motion = this.kind.topper === "flag" ? Math.round(Math.sin(this.wave) * 2) : this.kind.topper === "sails" ? Math.round(this.wave * 20) : 0
    const key = `${look.build.toFixed(3)}|${Math.round(this.door * 12)}|${look.doors.right}|${look.doors.left}|${motion}|${look.site?.toFixed(2)}`
    if (key !== this.drawn) {
      this.drawn = key
      this.body.clear()
      if (look.site !== null) drawSite(this.body, plateHalf(this.kind.size), look.site)
      drawBuilding(this.body, this.kind, look.build, this.door, this.wave, look.doors)
      const stage = buildStages(look.build)
      this.plate.clear()
      plate(this.plate, plateHalf(this.kind.size), 1, stage.plate, stage.walls > 0)
    }

    // A small bounce when a job finishes; at rest it is exactly its drawn size.
    this.body.scale.set(1 + this.pulse * 0.04, 1 - this.pulse * 0.06)

    // Smoke rings from a chimney, while working.
    this.puff -= dt
    if (look.working && this.kind.topper === "chimney" && this.puff <= 0) {
      this.rings.push({ age: 0 })
      this.puff = 0.7
    }
    const top = chimneyTop(this.kind)
    this.smoke.clear()
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i]!
      ring.age += dt / 1.8
      if (ring.age >= 1) {
        this.rings.splice(i, 1)
        continue
      }
      const t = ring.age
      this.smoke.circle(top.x + Math.sin(t * 5) * 1.5, top.y - t * 34, 4 + t * 7).stroke({ color: ink, width: DETAIL, alpha: (1 - t) * 0.55 })
    }

    this.marker.visible = look.problem && look.build >= 1
    this.body.tint = emphasis === "danger" ? 0xf3b5aa : 0xffffff
  }

  override destroy(options?: Parameters<Container["destroy"]>[0]) {
    this.plate.destroy()
    this.marker.destroy()
    super.destroy(options)
  }
}

// ── Homes ─────────────────────────────────────────────────────────────────

/** A home's full height, roof included. */
export const homeHeight = (tier: Tier) => home.tiers[tier].height + HOUSE_ROOF + (tier >= 2 ? 2 : 0)

/** Roof colours homes are built with: muted terracotta, slate, thatch, and moss; and the colour the household wears out walking. */
const homeRoofs: ReadonlyArray<{ readonly roof: RoofColors; readonly cloth: number }> = [
  { roof: { face: 0xe6c3b2, shade: 0xd3ab98 }, cloth: 0xb5654a },
  { roof: { face: 0xc9d2da, shade: 0xb3bec8 }, cloth: 0x5f7896 },
  { roof: { face: 0xe4dab8, shade: 0xd1c59f }, cloth: 0xb8954a },
  { roof: { face: 0xd0d9c5, shade: 0xbac5ae }, cloth: 0x6e8f56 }
]

/** How a home is built, from a number 0 → 1 fixed for its cell: roof colour, which way its ridge runs, a chimney. */
export interface HomeVariant {
  readonly roof: RoofColors
  /** What its residents wear (see `residentDress`). */
  readonly cloth: number
  readonly ridge: "x" | "y"
  readonly chimney: boolean
}
export const homeVariant = (n: number): HomeVariant => ({
  ...homeRoofs[Math.floor(n * homeRoofs.length) % homeRoofs.length]!,
  ridge: Math.floor(n * 97) % 2 === 0 ? "x" : "y",
  chimney: Math.floor(n * 31) % 3 !== 0
})
/** The look of the home on cell (x, y). */
export const homeAt = (x: number, y: number): HomeVariant => homeVariant(hash(x, y))
const plainHome: HomeVariant = { roof: paleRoof, cloth: 0x8f9891, ridge: "x", chimney: false }

/**
 * A home, `build` 0 → 1 of the way up: walls, a door on each wall a road
 * meets with an awning in its roof's colour, windows on the rest, and a
 * gabled roof. A citizens' home is wider, with a second story and a window
 * either side on every floor.
 */
export const drawHouse = (g: Graphics, tier: Tier, build: number, doors: Doors, variant: HomeVariant = plainHome) => {
  const a = (tier >= 2 ? home.half + 1 : home.half) * U
  const full = home.tiers[tier].height
  const stage = buildStages(build)
  if (stage.frame <= 0) return
  if (stage.walls < 1) drawFrame(g, a, Math.round(full * stage.frame))
  if (stage.walls <= 0) return
  const H = Math.max(2, Math.round(full * stage.walls))

  walls(g, a, H)
  const floors = tier === 3 ? [0, 12, 24] : tier === 2 ? [0, 12] : [0]
  for (const z of tier === 3 ? [13, 25] : tier === 2 ? [13] : []) {
    if (H <= z) continue
    line(g, at(-a, a, z), at(a, a, z), DETAIL, ink, 0.7)
    line(g, at(a, -a, z), at(a, a, z), DETAIL, ink, 0.7)
  }
  if (stage.fit > 0.15) {
    for (const side of ["right", "left"] as const) {
      const p = onWall(side, a)
      floors.forEach((floor, index) => {
        const door = index === 0 && doors[side]
        if (door) {
          const top = Math.round(HOUSE_DOOR_HEIGHT * smooth((stage.fit - 0.15) / 0.35))
          if (top <= 0) return
          quad(g, [p(-HOUSE_DOOR, 0, 0), p(HOUSE_DOOR, 0, 0), p(HOUSE_DOOR, 0, top), p(-HOUSE_DOOR, 0, top)], 0x8f9891)
          if (stage.fit > 0.5) {
            const out = 2 * U * smooth((stage.fit - 0.5) / 0.3)
            quad(g, [p(-3 * U, 0, top + 3), p(3 * U, 0, top + 3), p(3 * U, out, top + 1), p(-3 * U, out, top + 1)], variant.roof.shade)
          }
        }
        if (floor + 10 > H) return
        if (tier >= 2) {
          for (const along of [-3 * U, 3 * U]) if (!(door && Math.abs(along) < HOUSE_DOOR + 2 * U)) window_(g, side, a, along, floor + 5)
        } else if (!door) window_(g, side, a, 0, floor + 5)
      })
    }
  }
  gable(g, a, H, Math.round((HOUSE_ROOF + (tier >= 2 ? 2 : 0)) * stage.fit), variant.ridge, variant.roof, variant.chimney || tier >= 2)
}

/** What a home view shows each frame. */
export interface HouseLook {
  readonly effects?: Partial<SurfaceState>
  readonly tier: Tier
  readonly build: number
  readonly doors: Doors
  /** While a site: the share of its materials in, else `null`. */
  readonly site: number | null
  /** A sign over it: the risk most at hand, or that it is sick. */
  readonly alert?: Alert | null
  readonly burning?: boolean
  /** Run down (see `condition.worn`). */
  readonly worn?: boolean
  /** Its neighbourhood: poor, plain, or fine (see `HouseView`). */
  readonly band?: "poor" | "plain" | "fine"
  /** Closed by the town: it stands empty, shuttered and greyed. */
  readonly closed?: boolean
  /** A map view's colour washed over it, when one is shown. */
  readonly tint?: number | undefined
}

/** A sign that goes up over a home or building at risk. */
export type Alert = "fire" | "health" | "order" | "sick" | "worn"

export class HouseView extends Container {
  private readonly plate = new Graphics()
  private readonly body = new Graphics()
  private drawn = ""
  private variant: HomeVariant = plainHome

  constructor(stage: Stage) {
    super()
    this.addChild(this.body)
    stage.plates.addChild(this.plate)
  }

  place(x: number, y: number) {
    const centre = toScreen(x + 0.5, y + 0.5)
    this.position.set(centre.x, centre.y)
    this.plate.position.set(centre.x, centre.y)
    this.zIndex = x + y + 1
    this.variant = homeAt(x, y)
    this.drawn = ""
  }

  update(look: HouseLook, emphasis: Emphasis) {
    const key = `${look.tier}|${look.build.toFixed(3)}|${look.doors.right}|${look.doors.left}|${look.site?.toFixed(2)}`
    if (key !== this.drawn) {
      this.drawn = key
      this.body.clear()
      if (look.site !== null) drawSite(this.body, plateHalf(1), look.site)
      drawHouse(this.body, look.tier, look.build, look.doors, this.variant)
      const stage = buildStages(look.build)
      this.plate.clear()
      plate(this.plate, plateHalf(1), 1, stage.plate, stage.walls > 0)
    }
    this.body.tint = emphasis === "danger" ? 0xf3b5aa : 0xffffff
  }

  override destroy(options?: Parameters<Container["destroy"]>[0]) {
    this.plate.destroy()
    super.destroy(options)
  }
}

// ── The land ──────────────────────────────────────────────────────────────

/** Leaves in light (the side the sun is on) and shade. */
interface Leaves {
  readonly light: number
  readonly shade: number
}
const broadLeaves: ReadonlyArray<Leaves> = [
  { light: 0xe4ecd6, shade: 0xc6d4b2 },
  { light: 0xdde8cf, shade: 0xbccfa8 },
  { light: 0xe8ecd2, shade: 0xccd5ae },
  { light: 0xdbe6d4, shade: 0xb8cbb2 },
  { light: 0xefe7c9, shade: 0xd7c99c }
]
const firLeaves: Leaves = { light: 0xd9e5d7, shade: 0xb3c7b4 }
const firLeavesDeep: Leaves = { light: 0xd3e0d3, shade: 0xa9bfab }

/** A fir of `tiers` stacked cones, lit from the left, its foot at (x, y) on screen, `size` × full grown. */
const fir = (g: Graphics, x: number, y: number, size: number, tiers: number, leaves: Leaves) => {
  const tall = 24 * size
  const w = 8 * size
  const step = tall / (tiers + 1)
  for (let i = 0; i < tiers; i++) {
    const base = y - i * step
    const top = base - step * 2
    const half = w * (1 - i * 0.22)
    const notch = base + 1.5 * size
    g.poly([x - half, base, x, top, x, notch]).fill({ color: leaves.light })
    g.poly([x, top, x + half, base, x, notch]).fill({ color: leaves.shade })
    g.poly([x - half, base, x, top, x + half, base, x, notch]).stroke({ color: ink, width: LINE, join: "round" })
  }
}

/** A round crown lobe, `r` px, shaded below and to the right. */
const lobe = (g: Graphics, x: number, y: number, rx: number, ry: number, leaves: Leaves) => {
  g.ellipse(x, y, rx, ry).fill({ color: leaves.shade }).stroke({ color: ink, width: LINE })
  g.ellipse(x - rx * 0.22, y - ry * 0.24, rx * 0.7, ry * 0.68).fill({ color: leaves.light })
}

/**
 * A tree, `grown` 0 → 1: a fir of two or three tiers, a broadleaf of one to
 * three lobes, or a slender poplar, each a little larger or smaller, placed
 * and tinted by its cell, with a shadow at its foot. It grows in three
 * whole steps.
 */
export const drawTree = (g: Graphics, x: number, y: number, grown: number) => {
  const h = hash(x, y)
  const h2 = hash(y * 3 + 17, x * 5 + 7)
  const h3 = hash(x * 11 + 101, y * 13 + 3)
  const size = (grown >= 1 ? 1 : grown >= 0.5 ? 0.75 : 0.5) * (0.85 + h2 * 0.3)
  const ox = Math.round((h3 - 0.5) * 12)
  const oy = Math.round((h2 - 0.5) * 5)
  g.ellipse(ox + 3 * size, oy, 9 * size, 3.5 * size).fill({ color: ink, alpha: 0.07 })
  const trunk = Math.round(6 * size)
  line(g, { x: ox, y: oy }, { x: ox, y: oy - trunk }, LINE, 0x6b5a45)
  if (h < 0.45) {
    fir(g, ox, oy - trunk + 2, size, h2 < 0.5 ? 2 : 3, h3 < 0.5 ? firLeaves : firLeavesDeep)
    return
  }
  const leaves = broadLeaves[Math.floor(h2 * 97) % broadLeaves.length]!
  if (h > 0.88) {
    // A poplar: tall and narrow.
    lobe(g, ox, oy - trunk - 10 * size, 4.5 * size, 11 * size, leaves)
    return
  }
  const r = 7 * size
  const cy = oy - trunk - r
  if (size >= 0.75 && h > 0.6) {
    lobe(g, ox - r * 0.6, cy + r * 0.25, r * 0.7, r * 0.7, leaves)
    lobe(g, ox + r * 0.65, cy + r * 0.3, r * 0.65, r * 0.65, leaves)
  }
  lobe(g, ox, cy, r, r * 0.95, leaves)
  line(g, { x: ox - r * 0.35, y: cy + r * 0.15 }, { x: ox + r * 0.05, y: cy - r * 0.3 }, DETAIL, ink, 0.35)
}

export class TreeView extends Graphics {
  private stage = -1
  private x0 = 0
  private y0 = 0

  place(x: number, y: number) {
    this.x0 = x
    this.y0 = y
    const s = toScreen(x + 0.5, y + 0.5)
    this.position.set(s.x, s.y)
    this.zIndex = x + y + 1
  }

  update(growth: number, emphasis: Emphasis) {
    const grown = growth / GROWN.tree
    const stage = grown >= 1 ? 2 : grown >= 0.5 ? 1 : 0
    if (stage !== this.stage) {
      this.stage = stage
      this.clear()
      drawTree(this, this.x0, this.y0, grown)
    }
    this.tint = emphasis === "danger" ? 0xf3b5aa : 0xffffff
  }
}

interface StoneFills {
  readonly top: number
  readonly left: number
  readonly right: number
}
const stoneFills: StoneFills = { top: 0xeeefe9, left: 0xdfe1da, right: 0xcbcfc7 }
const oreFills: StoneFills = { top: 0xe8ebf0, left: 0xd5dae3, right: 0xbcc3d0 }

/** A faceted boulder `s` from its centre at (u, v), `tall` px high, its top cut in by `k` and `j` (0 → 1). */
const boulder = (g: Graphics, u: number, v: number, s: number, tall: number, k: number, j: number, fills: StoneFills) => {
  quad(g, [at(u - s, v + s, 0), at(u + s, v + s, 0), at(u + s, v + s * k, tall), at(u - s * j, v + s * k, tall)], fills.left)
  quad(g, [at(u + s, v - s, 0), at(u + s, v + s, 0), at(u + s, v + s * k, tall), at(u + s * k, v - s * j, tall)], fills.right)
  quad(g, [at(u - s * j, v - s * j, tall), at(u + s * k, v - s * j, tall), at(u + s, v + s * k, tall), at(u - s * j, v + s * k, tall)], fills.top)
}

/**
 * A rock: one to three faceted boulders, shaped by its cell, smaller as it is
 * quarried, with pebbles around; ore is bluish with dark flecks.
 */
export const drawRock = (g: Graphics, x: number, y: number, ore: boolean, left: number) => {
  const h = hash(x, y)
  const h2 = hash(x * 7 + 3, y * 5 + 11)
  const h3 = hash(y * 17 + 5, x * 3 + 29)
  const full = left > ROCK_AMOUNT / 2
  const fills = ore ? oreFills : stoneFills
  const s = (full ? 5 : 4) * U * (0.85 + h2 * 0.3)
  const tall = Math.round((full ? 10 : 7) * (0.8 + h3 * 0.4))
  const u = (h - 0.5) * 4 * U
  const v = (h3 - 0.5) * 3 * U
  const c = at(u, v, 0)
  g.ellipse(c.x + 3, c.y + 1, (s / U) * 3.2, (s / U) * 1.3).fill({ color: ink, alpha: 0.06 })
  // A smaller boulder behind, then the main one, then one in front.
  if (h2 > 0.35) boulder(g, u - s * 0.9, v - s * 1.1, s * 0.55, Math.round(tall * 0.6), 0.3 + h * 0.3, 0.5, fills)
  boulder(g, u, v, s, tall, 0.3 + h2 * 0.3, 0.5 + h3 * 0.2, fills)
  if (full && h3 > 0.5) boulder(g, u + s * 0.9, v + s * 1.2, s * 0.4, Math.round(tall * 0.45), 0.4, 0.6, fills)
  for (let i = 0; i < 3; i++) {
    const p = at(u + (hash(x + i, y * 3) - 0.5) * 14 * U, v + s + (hash(y + i, x * 5) * 3 + 1) * U, 0)
    g.circle(p.x, p.y, 0.9).fill({ color: ink, alpha: 0.35 })
  }
  if (ore) {
    for (const [du, dv, z] of [[-0.3, 1, 3], [0.2, 1, 6], [1, 0.1, 4], [1, -0.5, 7]] as const) {
      const p = du === 1 ? at(u + s, v + dv * s, z * (tall / 10)) : at(u + du * s, v + s, z * (tall / 10))
      g.rect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2).fill({ color: 0x4a5368 })
    }
    const p = at(u - s * 0.2, v + s * 0.1, tall)
    g.poly([p.x, p.y - 4, p.x + 1.5, p.y, p.x - 1.5, p.y]).fill({ color: 0x8fa3c8 }).stroke({ color: ink, width: DETAIL })
  }
}

export class RockView extends Graphics {
  private drawn = ""
  private x0 = 0
  private y0 = 0

  place(x: number, y: number) {
    this.x0 = x
    this.y0 = y
    const s = toScreen(x + 0.5, y + 0.5)
    this.position.set(s.x, s.y)
    this.zIndex = x + y + 1
  }

  update(ore: boolean, amount: number) {
    const key = `${ore}|${amount > ROCK_AMOUNT / 2}`
    if (key !== this.drawn) {
      this.drawn = key
      this.clear()
      drawRock(this, this.x0, this.y0, ore, amount)
    }
  }
}

/** A field: soil with three furrows, sprouting as it grows and golden when ripe. */
export const drawField = (g: Graphics, grown: number) => {
  const s = 7 * U
  g.poly(flat(square(0, 0, s))).fill({ color: soilFill }).stroke({ color: ink, width: DETAIL, alpha: 0.6 })
  const stage = grown >= 1 ? 3 : Math.floor(grown * 3)
  for (const v of [-4 * U, 0, 4 * U]) {
    line(g, at(-s + U, v, 0), at(s - U, v, 0), DETAIL, ink, 0.35)
    if (stage === 0) continue
    for (let u = -s + 2 * U; u <= s - 2 * U; u += 2 * U) {
      const p = at(u, v, 0)
      const h = stage + 1
      g.moveTo(p.x, p.y).lineTo(p.x, p.y - h)
    }
    g.stroke({ color: stage === 3 ? ripe : ink, width: DETAIL, alpha: stage === 3 ? 1 : 0.6 })
  }
}

export class FieldView extends Graphics {
  private stage = -1

  place(x: number, y: number) {
    const s = toScreen(x + 0.5, y + 0.5)
    this.position.set(s.x, s.y)
  }

  update(growth: number) {
    const grown = growth / GROWN.field
    const stage = grown >= 1 ? 3 : Math.floor(grown * 3)
    if (stage !== this.stage) {
      this.stage = stage
      this.clear()
      drawField(this, grown)
    }
  }
}

/**
 * Water on a set of cells (by `key`): paler in the shallows and deeper away
 * from the shore, an ink shoreline where it meets land, and ripples and
 * glints scattered by cell.
 */
export const drawWater = (g: Graphics, cells: ReadonlySet<number>) => {
  const wet = (x: number, y: number) => cells.has(key(x, y))
  for (const k of cells) {
    const c = cellOf(k)
    const near = DIRS.every((d) => wet(c.x + d.x, c.y + d.y))
    const far = near && DIRS.every((d) => wet(c.x + 2 * d.x, c.y + 2 * d.y) && wet(c.x + d.x + d.y, c.y + d.y - d.x))
    const fill = far ? 0xdae5e2 : near ? 0xdee8e5 : 0xe2ebe8
    g.poly(flat([toScreen(c.x, c.y), toScreen(c.x + 1, c.y), toScreen(c.x + 1, c.y + 1), toScreen(c.x, c.y + 1)])).fill({ color: fill })
  }
  for (const k of cells) {
    const c = cellOf(k)
    const h = hash(c.x, c.y)
    const waves = h < 0.22 ? 1 : h < 0.34 ? 2 : 0
    for (let i = 0; i < waves; i++) {
      const p = toScreen(c.x + 0.2 + hash(c.x + i * 7, c.y * 3) * 0.6, c.y + 0.2 + hash(c.y + i * 5, c.x * 7) * 0.6)
      const w = 3 + Math.round(hash(c.x * 3 + i, c.y) * 2)
      g.moveTo(p.x - 2 * w, p.y).quadraticCurveTo(p.x - w, p.y - 2, p.x, p.y).quadraticCurveTo(p.x + w, p.y - 2, p.x + 2 * w, p.y)
    }
  }
  g.stroke({ color: 0x9fb3b0, width: DETAIL, cap: "round" })
  for (const k of cells) {
    const c = cellOf(k)
    if (hash(c.y * 13 + 1, c.x * 31 + 7) > 0.08) continue
    const p = toScreen(c.x + 0.5, c.y + 0.5)
    g.moveTo(p.x - 2.5, p.y).lineTo(p.x + 2.5, p.y).moveTo(p.x, p.y - 1.5).lineTo(p.x, p.y + 1.5)
  }
  g.stroke({ color: 0xffffff, width: DETAIL, alpha: 0.9 })
  for (const k of cells) {
    const c = cellOf(k)
    const edges: ReadonlyArray<readonly [Point, Point, Point]> = [
      [DIRS[0]!, { x: c.x + 1, y: c.y }, { x: c.x + 1, y: c.y + 1 }],
      [DIRS[1]!, { x: c.x, y: c.y + 1 }, { x: c.x + 1, y: c.y + 1 }],
      [DIRS[2]!, { x: c.x, y: c.y }, { x: c.x, y: c.y + 1 }],
      [DIRS[3]!, { x: c.x, y: c.y }, { x: c.x + 1, y: c.y }]
    ]
    for (const [d, p, q] of edges) {
      const n = { x: c.x + d.x, y: c.y + d.y }
      const inside = n.x >= 0 && n.y >= 0 && n.x < GRID && n.y < GRID
      if (inside && !cells.has(key(n.x, n.y))) {
        const a = toScreen(p.x, p.y)
        const b = toScreen(q.x, q.y)
        g.moveTo(a.x, a.y).lineTo(b.x, b.y)
      }
    }
  }
  g.stroke({ color: ink, width: LINE, alpha: 0.7, cap: "square" })
}

// ── Roads ─────────────────────────────────────────────────────────────────

/**
 * Roads on a set of cells (by `key`): each cell is a square of paving at its
 * centre with an arm to every neighbour that is road too, kerbs along the
 * outside, and a dashed line down the middle of each arm. Arms meet their
 * neighbours' at the cell edge, so a run of road reads as one strip with
 * square joints. The paving's tone, and the odd worn stone in it, vary by cell.
 */
export const drawRoads = (g: Graphics, cells: ReadonlySet<number>, alpha = 1, kerb = ink) => {
  const w = ROAD
  const edge = 8 * U
  const kerbs: Array<readonly [Point, Point]> = []
  const dashes: Array<readonly [Point, Point]> = []
  const stones: Array<readonly [Point, Point]> = []
  for (const k of cells) {
    const c = cellOf(k)
    const cx = c.x + 0.5
    const cy = c.y + 0.5
    const p = (u: number, v: number) => toScreen(cx + u, cy + v)
    const h = hash(c.x, c.y)
    const fill = alpha < 1 ? roadFill : h < 0.3 ? 0xe2e4dd : h > 0.85 ? 0xe9eae4 : roadFill
    g.poly(flat([p(-w, -w), p(w, -w), p(w, w), p(-w, w)])).fill({ color: fill, alpha })
    for (const d of DIRS) {
      const n = { x: -d.y, y: d.x }
      const q = (along: number, across: number) => p(d.x * along + n.x * across, d.y * along + n.y * across)
      if (cells.has(key(c.x + d.x, c.y + d.y))) {
        g.poly(flat([q(w, -w), q(edge, -w), q(edge, w), q(w, w)])).fill({ color: fill, alpha })
        kerbs.push([q(w, -w), q(edge, -w)], [q(w, w), q(edge, w)])
        dashes.push([q(U, 0), q(3 * U, 0)], [q(5 * U, 0), q(7 * U, 0)])
      } else kerbs.push([q(w, -w), q(w, w)])
    }
    if (alpha === 1 && hash(c.y * 7 + 3, c.x * 11 + 5) < 0.55) {
      // A worn paving stone or two: a short tick off the middle line.
      for (let i = 0; i < 2; i++) {
        const su = (hash(c.x + i * 13, c.y) < 0.5 ? -1 : 1) * (2.5 + hash(c.x, c.y + i * 13) * 2) * U
        const sv = (hash(c.y + i * 7, c.x) < 0.5 ? -1 : 1) * (2.5 + hash(c.y, c.x + i * 7) * 2) * U
        stones.push(i === 0 ? [p(su, sv), p(su + U, sv)] : [p(su, sv), p(su, sv + U)])
      }
    }
  }
  for (const [a, b] of stones) g.moveTo(a.x, a.y).lineTo(b.x, b.y)
  g.stroke({ color: marking, width: DETAIL, alpha: 0.8 })
  for (const [a, b] of dashes) g.moveTo(a.x, a.y).lineTo(b.x, b.y)
  g.stroke({ color: marking, width: DETAIL, alpha })
  for (const [a, b] of kerbs) g.moveTo(a.x, a.y).lineTo(b.x, b.y)
  g.stroke({ color: kerb, width: LINE, alpha, cap: "square" })
}

// ── Crates and walkers ────────────────────────────────────────────────────

/** A crate, `s` from its centre at (u, v) and `h` px tall, standing `z` px up, with a label in its good's colour. */
export const drawCrate = (g: Graphics, label: number, s = CRATE, h = CRATE_HEIGHT, z = 0, u = 0, v = 0) => {
  const edge = 0x7d6140
  const face = (points: ReadonlyArray<Point>, fill: number) =>
    g.poly(flat(points)).fill({ color: fill }).stroke({ color: edge, width: DETAIL, join: "round" })
  face([at(u - s, v + s, z), at(u + s, v + s, z), at(u + s, v + s, z + h), at(u - s, v + s, z + h)], 0xe9c48a)
  face([at(u + s, v - s, z), at(u + s, v + s, z), at(u + s, v + s, z + h), at(u + s, v - s, z + h)], 0xd5a86c)
  face(square(u, v, s, z + h), 0xf4dcab)
  g.poly(flat([at(u - s, v - 0.5 * U, z + h), at(u + s, v - 0.5 * U, z + h), at(u + s, v + 0.5 * U, z + h), at(u - s, v + 0.5 * U, z + h)])).fill({ color: 0xc79a5b })
  const lh = Math.max(2, Math.round(h * 0.4))
  const lz = z + Math.round((h - lh) / 2)
  g.poly(flat([at(u - s + U, v + s, lz), at(u + s - U, v + s, lz), at(u + s - U, v + s, lz + lh), at(u - s + U, v + s, lz + lh)])).fill({ color: label })
}

/** What a figure wears: coat, the trim on its hat, skin, a hat, and whether the coat is long (a citizen's, a cleric's robe). */
export interface PersonDress {
  readonly coat: number
  readonly trim: number
  readonly skin: number
  readonly hat: "none" | "cap" | "brim" | "top" | "hood" | "bonnet"
  readonly long: boolean
}

/** What a figure has with it. */
export type Load =
  | { readonly kind: "none" }
  | { readonly kind: "service"; readonly role: "watchman" | "firefighter" | "physician" | "constable" | "builder" }
  /** A carrier's cart: `good` on it, `count` of it (none on the way back). */
  | { readonly kind: "cart"; readonly good: GoodId; readonly count: number }
  /** A market walker's basket of provisions. */
  | { readonly kind: "basket"; readonly goods: ReadonlyArray<GoodId> }
  /** A chapel walker's bell. */
  | { readonly kind: "bell" }

/** How a cart is built: one wheel at the front (a barrow) or two at the sides, its wood, spoked wheels or solid. */
export interface CartLook {
  readonly wheels: 1 | 2
  readonly wood: { readonly top: number; readonly left: number; readonly right: number }
  readonly spokes: boolean
}

const skins = [0xf3dfcb, 0xe8c7a6, 0xd3a681, 0xae8160, 0x8d644a] as const
const workCoats = [0x8a6a45, 0x6e8f36, 0x5a6479, 0xb5654a, 0x7d8f9b, 0x9a7b56, 0x587a6e] as const
const cartWoods = [
  { top: 0xc79a5b, left: 0xe9c48a, right: 0xd5a86c },
  { top: 0xa98457, left: 0xd2b088, right: 0xbd9871 },
  { top: 0x8fa37c, left: 0xc3d1b2, right: 0xaebf9c },
  { top: 0x8a9bb8, left: 0xc4cfe0, right: 0xadbbd1 },
  { top: 0xb87a68, left: 0xe2b4a6, right: 0xcf9c8d }
] as const

const pick = <T>(list: ReadonlyArray<T>, n: number): T => list[Math.floor(n * 9973) % list.length]!

/** A carrier: work clothes and a cap, pushing a cart built by `n` (0 → 1). */
export const carrierDress = (n: number): PersonDress => ({
  coat: pick(workCoats, n), trim: pick(workCoats, n * 7 + 0.3), skin: pick(skins, n * 13 + 0.1), hat: n < 0.6 ? "cap" : n < 0.8 ? "brim" : "none", long: false
})
export const cartLook = (n: number): CartLook => ({ wheels: n < 0.3 ? 1 : 2, wood: pick(cartWoods, n * 3 + 0.2), spokes: n * 17 % 1 < 0.6 })
/** A service walker in its building's colour: a market's with a cap, a chapel's in a hooded robe. */
export const serviceDress = (color: number, n: number, faith: boolean): PersonDress => ({
  coat: faith ? mix(color, ink, 0.35) : color, trim: faith ? color : 0xf7f8f4, skin: pick(skins, n * 13 + 0.1), hat: faith ? "hood" : "cap", long: faith
})
/**
 * A resident out for a walk, dressed in their household's colour (see
 * `HomeVariant`): settlers plainly, in caps and bonnets; citizens in long
 * deeper-coloured coats and hats.
 */
export const residentDress = (cloth: number, tier: Tier, n: number): PersonDress => ({
  coat: tier >= 2 ? mix(cloth, ink, tier === 3 ? 0.35 : 0.2) : mix(cloth, 0xffffff, 0.15),
  trim: tier >= 2 ? ink : mix(cloth, 0xffffff, 0.55),
  skin: pick(skins, n * 13 + 0.1),
  hat: tier === 3 ? "top" : tier === 2 ? (n < 0.5 ? "top" : "brim") : n < 0.35 ? "bonnet" : n < 0.6 ? "cap" : "none",
  long: tier >= 2 || n > 0.85
})

/** Where a point on a cart is: `a` along the way it goes, `c` across it, from the cart's centre (u, v). */
const cartPoint = (u: number, v: number, d: Point) => (a: number, c: number, z: number) => at(u + d.x * a - d.y * c, v + d.y * a + d.x * c, z)

/** A box on a cart, `ha` along and `hc` across from (a, c). */
const cartBox = (g: Graphics, u: number, v: number, d: Point, a: number, c: number, ha: number, hc: number, z: number, h: number, fills: { readonly top: number; readonly left: number; readonly right: number }, width = DETAIL) => {
  const cu = u + d.x * a - d.y * c
  const cv = v + d.y * a + d.x * c
  const along = d.x !== 0
  box(g, cu, cv, along ? ha : hc, along ? hc : ha, z, h, fills.top, fills.left, fills.right, width)
}

/** A log (or a sheaf, a bolt of cloth) lying along a cart, `c` across it. */
const cartLog = (g: Graphics, u: number, v: number, d: Point, c: number, half: number, z: number, r: number, side: number, end: number) => {
  if (d.x !== 0) log(g, "u", v + d.x * c, u - half, u + half, z, r, side, end)
  else log(g, "v", u - d.y * c, v - half, v + half, z, r, side, end)
}

const wicker = { top: 0xc9a46a, left: 0xe3c592, right: 0xd2b07a }

/** What is on a cart, `z` px up: each good its own way, more of it for a bigger load. */
export const drawCargo = (g: Graphics, u: number, v: number, d: Point, good: GoodId, count: number, z: number) => {
  const n = count >= 4 ? 3 : count >= 2 ? 2 : 1
  const p = cartPoint(u, v, d)
  switch (good) {
    case "wood": {
      const rows: ReadonlyArray<ReadonlyArray<number>> = [[-0.9, 0, 0.9], [-0.45, 0.45], [0]]
      rows.slice(0, n).forEach((row, i) => row.forEach((c) => cartLog(g, u, v, d, c * U, 2.2 * U, z + i * 2, 1.15, 0xb08a5e, 0xe9d2a8)))
      return
    }
    case "wheat":
    case "cloth":
    case "wool": {
      const fills = good === "wheat" ? [0xe9cf7c, 0xf3e3a8] : good === "cloth" ? [0x8a58a8, 0xc7aed6] : [0xf4f4ef, 0xffffff]
      const rows: ReadonlyArray<ReadonlyArray<number>> = [[-0.75, 0.75], [0]]
      rows.slice(0, Math.min(2, n)).forEach((row, i) => row.forEach((c, j) => {
        const side = good === "cloth" && j === 1 ? 0x3d6db5 : fills[0]!
        cartLog(g, u, v, d, c * U, (good === "wool" ? 1.4 : 2) * U, z + i * 2.6, good === "wool" ? 1.9 : 1.5, side, fills[1]!)
      }))
      if (n === 3 && good !== "wool") cartLog(g, u, v, d, 0, 1.4 * U, z + 5, 1.3, fills[0]!, fills[1]!)
      return
    }
    case "planks": {
      for (let i = 0; i < n + 1; i++) cartBox(g, u, v, d, 0, 0, 2.4 * U, 1.1 * U, z + i * 1.5, 1.5, { top: 0xf0c59a, left: 0xe2a873, right: 0xd2945c })
      return
    }
    case "stone":
    case "ore": {
      const fills = good === "stone" ? stoneFills : oreFills
      const spots: ReadonlyArray<readonly [number, number, number]> = [[-1, -0.5, 0], [1, 0.5, 0], [0, 0, 3]]
      for (const [a, c, dz] of spots.slice(0, n)) cartBox(g, u, v, d, a * U, c * U, 0.8 * U, 0.8 * U, z + dz, 3, fills)
      if (good === "ore") {
        const top = p(0, 0, z + (n >= 3 ? 6 : 3))
        g.circle(top.x - 1, top.y, 1).fill({ color: 0x4a5368 })
        g.circle(top.x + 1.5, top.y + 0.5, 0.8).fill({ color: 0x4a5368 })
      }
      return
    }
    case "fish":
    case "smoked":
    case "bread": {
      cartBox(g, u, v, d, 0, 0, 1.6 * U, 1.1 * U, z, 3, wicker)
      for (let i = 0; i < n + 1; i++) {
        const t = p(((i - n / 2) * 0.9) * U, (i % 2 === 0 ? -0.3 : 0.3) * U, z + 3)
        if (good !== "bread") g.poly([t.x - 2.2, t.y, t.x, t.y - 1.4, t.x + 2.2, t.y, t.x, t.y + 1.2]).fill({ color: good === "fish" ? 0x2f8c87 : 0x9a5b3a }).stroke({ color: ink, width: 0.75 })
        else g.ellipse(t.x, t.y - 0.6, 1.8, 1.2).fill({ color: 0xd98a6a }).stroke({ color: ink, width: 0.75 })
      }
      return
    }
    case "flour": {
      const spots = [-1, 1, 0]
      spots.slice(0, n).forEach((a, i) => sack(g, u + d.x * a * U, v + d.y * a * U, 0xf2ecdc, z + (i === 2 ? 4 : 0)))
      return
    }
    default: {
      drawCrate(g, goods[good].color, 1.6 * U, 4, z, u, v)
      if (good === "tools") {
        const t = p(0, 0, z + 4)
        line(g, t, { x: t.x + 2, y: t.y - 5 }, LINE, 0x8a6a45)
        g.rect(t.x + 0.5, t.y - 6.5, 3, 1.6).fill({ color: 0x8f9891 }).stroke({ color: ink, width: 0.75 })
      }
    }
  }
}

/** A wheel `r` px across, upright along the way the cart goes, its spokes turned by `roll`. */
const wheel = (g: Graphics, u: number, v: number, d: Point, r: number, roll: number, look: CartLook) => {
  const axis = d.x !== 0 ? "v" : "u"
  g.poly(flat(ring(axis, u, v, r, r, 14))).fill({ color: look.spokes ? 0xf2efe6 : look.wood.right }).stroke({ color: ink, width: DETAIL })
  const p = upright(axis, u, v, r)
  if (look.spokes) {
    for (let k = 0; k < 2; k++) {
      const t = roll + (k * Math.PI) / 2
      line(g, p(Math.cos(t) * r, Math.sin(t) * r), p(-Math.cos(t) * r, -Math.sin(t) * r), 0.75)
    }
  }
  const hub = p(0, 0)
  g.circle(hub.x, hub.y, 0.8).fill({ color: ink })
}

/** A handcart or barrow ahead of a carrier, with its load. */
const drawCart = (g: Graphics, look: CartLook, load: Load, d: Point, roll: number) => {
  const u = d.x * CART_AHEAD
  const v = d.y * CART_AHEAD
  const p = cartPoint(u, v, d)
  const L = 2.4 * U
  const W = 1.6 * U
  const bed = 5
  // The near side is the one towards the viewer: +u or +v.
  const nearSide = d.x !== 0 ? (d.x > 0 ? 1 : -1) : d.y > 0 ? -1 : 1
  const wheelAt = (c: number) => ({ u: u - d.y * c, v: v + d.x * c })
  const drawWheel = (c: number, a = 0) => {
    const w = wheelAt(c)
    wheel(g, w.u + d.x * a, w.v + d.y * a, d, 2.6, roll, look)
  }
  const frontAway = toScreen(d.x, d.y).y < 0
  if (look.wheels === 2) drawWheel(-nearSide * (W + 0.4 * U))
  else if (frontAway) drawWheel(0, L + 0.5 * U)
  // Legs under a barrow's back, then the bed and its sides.
  if (look.wheels === 1) for (const c of [-W * 0.6, W * 0.6]) line(g, p(-L + U, c, 0), p(-L + U, c, bed - 1), DETAIL)
  cartBox(g, u, v, d, 0, 0, L, W, bed - 2, 2.5, look.wood, DETAIL)
  if (load.kind === "cart" && load.count > 0) drawCargo(g, u, v, d, load.good, load.count, bed + 0.5)
  if (look.wheels === 2) drawWheel(nearSide * (W + 0.4 * U))
  else if (!frontAway) drawWheel(0, L + 0.5 * U)
}

/** A hat on a head at (0, y). */
const drawHat = (g: Graphics, dress: PersonDress, y: number, facing: number) => {
  switch (dress.hat) {
    case "cap":
      g.poly([-2.4, y + 0.2, -2.2, y - 1.4, -1, y - 2.4, 1, y - 2.4, 2.2, y - 1.4, 2.4, y + 0.2]).fill({ color: dress.trim === 0xf7f8f4 ? dress.coat : dress.trim }).stroke({ color: ink, width: 0.75 })
      line(g, { x: 0, y: y + 0.1 }, { x: facing * 3.4, y: y + 0.4 }, 1, ink)
      return
    case "brim":
      g.roundRect(-1.8, y - 3.4, 3.6, 3, 1).fill({ color: dress.trim }).stroke({ color: ink, width: 0.75 })
      g.ellipse(0, y, 3.6, 1).fill({ color: dress.trim }).stroke({ color: ink, width: 0.75 })
      return
    case "top":
      g.rect(-1.7, y - 4.6, 3.4, 4.4).fill({ color: ink })
      g.rect(-1.7, y - 1.6, 3.4, 0.8).fill({ color: dress.coat })
      line(g, { x: -3, y: y - 0.1 }, { x: 3, y: y - 0.1 }, 1.2)
      return
    case "bonnet":
      g.poly([-2.8, y + 1.6, -2.6, y - 1.2, -1, y - 2.6, 1.4, y - 2.4, 2.8, y - 0.6, facing * 2.8, y + 1.6]).fill({ color: dress.trim }).stroke({ color: ink, width: 0.75 })
      return
    case "hood":
      g.poly([-2.9, y + 3.2, -2.9, y - 0.6, -1.4, y - 2.8, 1.4, y - 2.8, 2.9, y - 0.6, 2.9, y + 3.2]).fill({ color: dress.coat }).stroke({ color: ink, width: 0.75 })
      g.circle(facing * 0.6, y + 0.6, 1.5).fill({ color: dress.skin })
      return
    default:
  }
}

/**
 * A figure on two stepping legs, facing `dir` (a grid step), dressed in
 * `dress`, with what it has with it: a cart ahead of it (`cart`), a basket at
 * its side, or a bell. `roll` turns a cart's wheels.
 */
export const drawWalker = (g: Graphics, dress: PersonDress, load: Load, cart: CartLook | null, dir: Point, phase: number, roll = 0, part: "all" | "figure" | "cart" = "all") => {
  const d = dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir
  const front = toScreen(d.x * 5 * U, d.y * 5 * U)
  const facing = front.x >= 0 ? 1 : -1
  const away = front.y < 0
  const figure = () => {
    const swing = phase === 0 ? 1 : -1
    g.ellipse(0.5, 0, 3.2, 1.1).fill({ color: ink, alpha: 0.1 })
    line(g, { x: -1, y: -5 }, { x: -1 + swing, y: 0 }, DETAIL)
    line(g, { x: 1, y: -5 }, { x: 1 - swing, y: 0 }, DETAIL)
    if (dress.long) g.poly([-2.6, -10.5, 2.6, -10.5, 3.2, -3, -3.2, -3]).fill({ color: dress.coat }).stroke({ color: ink, width: DETAIL, join: "round" })
    else g.roundRect(-2.5, -11, 5, 7, 2).fill({ color: dress.coat }).stroke({ color: ink, width: DETAIL })
    // An arm swinging, unless both hands are on a cart.
    if (!cart) line(g, { x: -facing * 1.8, y: -9.5 }, { x: -facing * 1.8 + swing * 1.2, y: -6 }, DETAIL)
    g.circle(0, -13.5, 2.2).fill({ color: dress.skin }).stroke({ color: ink, width: DETAIL })
    if (away && dress.hat !== "hood") g.circle(0, -13.8, 1.9).fill({ color: mix(dress.skin, ink, 0.55) })
    drawHat(g, dress, -15, facing)
    if (load.kind === "basket") {
      const side = -facing
      const bx = side * 4.5
      g.poly([bx - 2.2, -8.5, bx + 2.2, -8.5, bx + 1.6, -5, bx - 1.6, -5]).fill({ color: wicker.left }).stroke({ color: ink, width: DETAIL })
      g.moveTo(bx - 1.8, -8.5).quadraticCurveTo(bx, -12, bx + 1.8, -8.5).stroke({ color: ink, width: 0.75 })
      load.goods.slice(0, 3).forEach((good, i) => g.circle(bx - 1.2 + i * 1.2, -9, 0.9).fill({ color: goods[good].color }))
    } else if (load.kind === "bell") {
      const bx = facing * 3.6
      line(g, { x: facing * 1.8, y: -9 }, { x: bx, y: -7.5 }, DETAIL)
      g.poly([bx - 1.3, -5, bx - 0.8, -7.5, bx + 0.8, -7.5, bx + 1.3, -5]).fill({ color: 0xe3c25a }).stroke({ color: ink, width: 0.75 })
    }
  }
  if (!cart || part === "figure") return figure()
  const handles = () => {
    const ahead = { x: front.x * 0.62, y: front.y * 0.62 }
    line(g, { x: front.x * 0.2, y: front.y * 0.2 - 7 }, { x: ahead.x, y: ahead.y - 4 }, DETAIL)
  }
  if (part === "cart") {
    handles()
    drawCart(g, cart, load, d, roll)
    return
  }
  if (away) {
    drawCart(g, cart, load, d, roll)
    handles()
    figure()
  } else {
    figure()
    handles()
    drawCart(g, cart, load, d, roll)
  }
}

const loadKey = (load: Load) =>
  load.kind === "cart" ? `${load.good}${load.count}` : load.kind === "basket" ? load.goods.join(",") : load.kind

let walkers = 0

/** How far ahead of its pusher a cart stands, in cells. */
const CART_AHEAD = 5.5 * U

/**
 * A figure as drawn, redrawn when its stride, heading, load, or wheels
 * change. A carrier's cart is drawn apart from it and sorted on its own
 * place on the road, so figures meeting or passing it overlap the right way.
 */
export class WalkerView extends Graphics {
  private readonly dress: PersonDress
  private readonly cart: CartLook | null
  private readonly cartView: Graphics | null
  private faithDress: PersonDress | null = null
  private drawn = ""

  constructor(dress: PersonDress, cart: CartLook | null) {
    super()
    this.dress = dress
    this.cart = cart
    this.cartView = cart ? new Graphics() : null
  }

  /** A walker the town sent out: a carrier with a cart, or a service walker in its building's colour. */
  static forFigure(role: "carrier" | "walker", color: number): WalkerView {
    const n = hash(walkers++, 7)
    if (role === "carrier") return new WalkerView(carrierDress(n), cartLook(hash(walkers, 31)))
    const view = new WalkerView(serviceDress(color, n, false), null)
    view.faithDress = serviceDress(color, n, true)
    return view
  }

  /** Puts it on the floor at grid point (x, y), facing `dir`. */
  update(x: number, y: number, dir: Point, phase: number, load: Load) {
    const roll = this.cart ? Math.round((x + y) * 6) % 3 : 0
    const key = `${dir.x},${dir.y}|${phase}|${loadKey(load)}|${roll}`
    const dress = load.kind === "bell" && this.faithDress ? this.faithDress : this.dress
    if (key !== this.drawn) {
      this.drawn = key
      this.clear()
      drawWalker(this, dress, load, this.cart, dir, phase, 0, "figure")
      if (this.cartView) {
        this.cartView.clear()
        drawWalker(this.cartView, dress, load, this.cart, dir, phase, (roll * Math.PI) / 6, "cart")
      }
    }
    const s = toScreen(x, y)
    this.position.set(s.x, s.y)
    this.zIndex = x + y
    if (this.cartView) {
      if (this.cartView.parent !== this.parent) this.parent?.addChild(this.cartView)
      const d = dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir
      this.cartView.position.set(s.x, s.y)
      this.cartView.zIndex = x + y + (d.x + d.y) * CART_AHEAD
      this.cartView.alpha = this.alpha
    }
  }

  override destroy(options?: Parameters<Graphics["destroy"]>[0]) {
    this.cartView?.destroy()
    super.destroy(options)
  }
}

// ── The floor ─────────────────────────────────────────────────────────────

/** The open water the land stands in: the page's background. */
export const seaFill = 0xe2e9e6
const landFill = 0xf0f2ec

/**
 * The land (`mask`: "1" for land, by `key`): pale ground, a faint line
 * between every two cells of it, and an ink coastline.
 */
export const drawFloor = (g: Graphics, mask: string) => {
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID && mask[key(x, y)] === "1"
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!land(x, y)) continue
      g.poly(flat([toScreen(x, y), toScreen(x + 1, y), toScreen(x + 1, y + 1), toScreen(x, y + 1)])).fill({ color: landFill })
    }
  }
  // Grid lines: each cell's far edges, where its neighbour is land too.
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!land(x, y)) continue
      if (land(x + 1, y)) {
        const a = toScreen(x + 1, y)
        const b = toScreen(x + 1, y + 1)
        g.moveTo(a.x, a.y).lineTo(b.x, b.y)
      }
      if (land(x, y + 1)) {
        const a = toScreen(x, y + 1)
        const b = toScreen(x + 1, y + 1)
        g.moveTo(a.x, a.y).lineTo(b.x, b.y)
      }
    }
  }
  g.stroke({ color: 0xe0e3db, width: DETAIL })
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!land(x, y)) continue
      const edges: ReadonlyArray<readonly [Point, Point, Point]> = [
        [DIRS[0]!, { x: x + 1, y }, { x: x + 1, y: y + 1 }],
        [DIRS[1]!, { x, y: y + 1 }, { x: x + 1, y: y + 1 }],
        [DIRS[2]!, { x, y }, { x, y: y + 1 }],
        [DIRS[3]!, { x, y }, { x: x + 1, y }]
      ]
      for (const [d, p, q] of edges) {
        if (land(x + d.x, y + d.y)) continue
        const a = toScreen(p.x, p.y)
        const b = toScreen(q.x, q.y)
        g.moveTo(a.x, a.y).lineTo(b.x, b.y)
      }
    }
  }
  g.stroke({ color: ink, width: LINE, alpha: 0.75, cap: "square" })
}

/**
 * An outline on the floor, `n` cells a side: under the pointer (`hover`),
 * picked (`picked`, with corner ticks that breathe with `time`), with no
 * room (`blocked`), or the reach of a building's work (`reach`).
 */
export const drawPlot = (g: Graphics, x: number, y: number, n: number, look: "hover" | "picked" | "blocked" | "reach", time = 0) => {
  const corners = [toScreen(x, y), toScreen(x + n, y), toScreen(x + n, y + n), toScreen(x, y + n)]
  if (look === "hover" || look === "reach") {
    g.poly(flat(corners)).fill({ color: ink, alpha: look === "reach" ? 0.03 : 0.04 }).stroke({ color: ink, width: DETAIL, alpha: look === "reach" ? 0.45 : 0.35 })
    return
  }
  const color = look === "blocked" ? alarm : ink
  g.poly(flat(corners)).fill({ color, alpha: 0.07 }).stroke({ color, width: LINE, alpha: 0.85 })
  const reach = (4 + Math.sin(time * 4)) * U
  const ticks: ReadonlyArray<readonly [number, number, number, number]> = [[x, y, 1, 1], [x + n, y, -1, 1], [x + n, y + n, -1, -1], [x, y + n, 1, -1]]
  for (const [cx, cy, sx, sy] of ticks) {
    const ox = cx - sx * U
    const oy = cy - sy * U
    const a = toScreen(ox + sx * reach, oy)
    const o = toScreen(ox, oy)
    const b = toScreen(ox, oy + sy * reach)
    g.moveTo(a.x, a.y).lineTo(o.x, o.y).lineTo(b.x, b.y)
  }
  g.stroke({ color, width: LINE, alpha: 0.9, join: "round" })
}

/** The ghost of a building or a home about to be placed, drawn into `g` around the centre of its footprint. */
export const drawGhost = (g: Graphics, what: KindId | "home", x: number, y: number) => {
  const size = what === "home" ? 1 : kinds[what].size
  const centre = toScreen(x + size / 2, y + size / 2)
  g.translateTransform(centre.x, centre.y)
  if (what === "home") drawHouse(g, 1, 1, { right: false, left: false })
  else drawBuilding(g, kinds[what], 1, 0, 0, { right: false, left: false }, true)
  g.resetTransform()
}
