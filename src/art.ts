/**
 * The yard's look: pale line-drawn buildings on plates, hatched conveyor
 * belts with square joints, cardboard crates with coloured labels, and
 * monospace name tags. Everything is drawn with Pixi graphics in world
 * pixels, measured in units (see `iso.ts`): floor lengths are whole units,
 * heights whole pixels, and lines one of two weights.
 *
 * The measures that have to agree:
 * - a belt is 8 units wide and runs down the middle of a cell;
 * - it meets a factory at the middle of a side, where a door 10 units wide
 *   (the belt and a unit of frame either side) stands centred on it;
 * - a crate is 6 units wide: a unit of belt shows either side;
 * - a factory's 3×3 plate is a unit inside its footprint.
 */
import { Container, Graphics, Text, TextStyle } from "pixi.js"

import { flat, FOOTPRINT, GRID, toScreen, U, type Point } from "./iso.ts"
import { kinds, type Kind, type KindId } from "./kinds.ts"
import type { Status, WorkValue } from "./schema.ts"

export const ink = 0x3d4943
const plateFill = 0xf5f6f2
const roofFill = 0xf7f8f4
const leftFill = 0xe9ebe5
const rightFill = 0xdde0d9
const beltFill = 0xe6e8e2
const hatch = 0xb4b9b1

/** Outlines. */
const LINE = 1.5
/** Everything inside an outline: seams, slats, windows, hatching. */
const DETAIL = 1

const STORY = 32
const CHIMNEY = 24
const PLATE = 23 * U
const BELT = 4 * U
const JOINT = 5 * U
const JOINT_INNER = 2 * U
const DOOR = 5 * U
const DOOR_HEIGHT = 16
const AWNING = 6 * U
const AWNING_DEPTH = 3 * U
const CHIMNEY_HALF = 2 * U
const CRATE = 3 * U
const CRATE_HEIGHT = 12
const HATCH_GAP = 3 * U
export const BELT_SPEED = 2.2

/** The layers of the yard, back to front. */
export interface Stage {
  readonly world: Container
  readonly plates: Container
  readonly belts: Container
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
 * then the door, windows, and chimney are fitted.
 */
export const buildStages = (build: number) => ({
  plate: smooth(build / 0.12),
  frame: smooth((build - 0.1) / 0.25),
  walls: smooth((build - 0.38) / 0.37),
  fit: smooth((build - 0.78) / 0.22)
})

// ── Buildings ─────────────────────────────────────────────────────────────

/** Height of a kind's building at full size. */
export const heightOf = (kind: Kind) => kind.stories * STORY

/** A point of a building, around the centre of its footprint (u, v in cells, z in pixels). */
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

/** The plate a building stands on; while it is marked out, only its outline, growing. */
export const drawPlate = (g: Graphics, alpha = 1, marked = 1, filled = true) => {
  g.poly(flat(square(0, 0, PLATE * (0.8 + 0.2 * marked))))
    .fill({ color: plateFill, alpha: filled ? alpha : 0 })
    .stroke({ color: ink, width: LINE, alpha: alpha * marked, join: "round" })
}

/** The wire frame of a box, `h` pixels tall: every edge, the hidden ones too. */
const drawFrame = (g: Graphics, a: number, h: number) => {
  const base = square(0, 0, a)
  for (const c of base) line(g, c, { x: c.x, y: c.y - h }, DETAIL)
  outline(g, square(0, 0, a, h), DETAIL)
}

/** The centres of a roof's bays, back row first, in cells. */
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

/** The chimney stands in the back bay; a depot's flag in the right-hand one. */
const chimneyBay = (kind: Kind) => bays(kind)[0]!
const flagBay = (kind: Kind) => bays(kind)[kind.bays - 1]!

/**
 * A loading door on a wall: `side` "right" is the wall facing down-right
 * (u = a), "left" the one facing down-left (v = a). Centred on the wall, as
 * the belt that meets it is.
 */
const drawDoor = (g: Graphics, side: "right" | "left", a: number, H: number, fit: number, door: number, color: number) => {
  // On the right wall, points run along v; on the left wall, along u.
  const p = (along: number, out: number, z: number) => (side === "right" ? at(a + out, along, z) : at(along, a + out, z))
  const top = Math.round(Math.min(DOOR_HEIGHT, H - 8) * smooth((fit - 0.15) / 0.35))
  if (top <= 0) return
  const open = Math.round(top * door * 0.75)
  const frame = [p(-DOOR, 0, 0), p(DOOR, 0, 0), p(DOOR, 0, top), p(-DOOR, 0, top)]
  g.poly(flat(frame)).fill({ color: 0x8f9891 })
  g.poly(flat([p(-DOOR, 0, open), p(DOOR, 0, open), p(DOOR, 0, top), p(-DOOR, 0, top)])).fill({ color: 0xeef0ea })
  for (let z = top - 3; z > open; z -= 3) line(g, p(-DOOR, 0, z), p(DOOR, 0, z), DETAIL, 0x9aa29b)
  outline(g, frame)
  // The awning above it, folding out as the door is fitted.
  if (fit > 0.5) {
    const out = AWNING_DEPTH * smooth((fit - 0.5) / 0.3)
    quad(g, [p(-AWNING, 0, top + 4), p(AWNING, 0, top + 4), p(AWNING, out, top + 2), p(-AWNING, out, top + 2)], color)
  }
}

/** Vertical seams on a wall: framing the door when it has one, else one down the middle. */
const drawSeams = (g: Graphics, side: "right" | "left", a: number, H: number, door: boolean) => {
  const p = (along: number, z: number) => (side === "right" ? at(a, along, z) : at(along, a, z))
  const seams = door ? [-(a - 4 * U), a - 4 * U] : [0]
  for (const s of seams) line(g, p(s, 0), p(s, H), DETAIL, ink, 0.5)
}

/**
 * A building, `build` 0 → 1 of the way up (see `buildStages`); `door` 0
 * (shut) → 1 (open), `color` its awning's, `leftDoor` whether a belt meets
 * its left wall too (the right wall always has one).
 */
export const drawBuilding = (g: Graphics, kind: Kind, color: number, build: number, door: number, wave: number, leftDoor = false) => {
  const a = kind.half * U
  const full = heightOf(kind)
  const stage = buildStages(build)
  if (stage.frame <= 0) return
  if (stage.walls < 1) drawFrame(g, a, Math.round(full * stage.frame))
  if (stage.walls <= 0) return
  const H = Math.max(2, Math.round(full * stage.walls))

  // Walls: the one facing down-left, then the one facing down-right.
  quad(g, [at(-a, a, 0), at(a, a, 0), at(a, a, H), at(-a, a, H)], leftFill)
  quad(g, [at(a, -a, 0), at(a, a, 0), at(a, a, H), at(a, -a, H)], rightFill)
  drawSeams(g, "left", a, H, leftDoor)
  drawSeams(g, "right", a, H, true)
  if (kind.stories === 2 && H > STORY) {
    line(g, at(-a, a, STORY), at(a, a, STORY), DETAIL, ink, 0.7)
    line(g, at(a, -a, STORY), at(a, a, STORY), DETAIL, ink, 0.7)
  }

  if (stage.fit > 0.15) {
    drawDoor(g, "right", a, H, stage.fit, door, color)
    if (leftDoor) drawDoor(g, "left", a, H, stage.fit, door, color)
  }

  // Roof (the top of the walls while they rise) and its windows, one by one.
  quad(g, square(0, 0, a, H), roofFill)
  if (stage.fit > 0.4) {
    const all = bays(kind).filter((bay) => bay.index !== 0 && !(kind.flag && bay.index === kind.bays - 1))
    const shown = Math.ceil(all.length * smooth((stage.fit - 0.4) / 0.4))
    for (const bay of all.slice(0, shown)) outline(g, square(bay.u, bay.v, (kind.window / 2) * U, H))
  }

  // The chimney, rising last.
  if (stage.fit > 0) {
    const { u, v } = chimneyBay(kind)
    const c = CHIMNEY_HALF
    const top = H + Math.round(CHIMNEY * stage.fit)
    quad(g, [at(u - c, v + c, H), at(u + c, v + c, H), at(u + c, v + c, top), at(u - c, v + c, top)], leftFill)
    quad(g, [at(u + c, v - c, H), at(u + c, v + c, H), at(u + c, v + c, top), at(u + c, v - c, top)], rightFill)
    quad(g, square(u, v, c, top), roofFill)
  }

  // A depot flies a flag in its right-hand bay.
  if (kind.flag && stage.fit > 0.9) {
    const { u, v } = flagBay(kind)
    const base = at(u, v, H)
    const tip = { x: base.x, y: base.y - 24 }
    line(g, base, tip, LINE)
    const flutter = Math.round(Math.sin(wave) * 2)
    g.poly([tip.x, tip.y, tip.x - 10, tip.y + 4 + flutter, tip.x, tip.y + 8]).fill({ color: ink })
  }
}

/** Where a building's chimney puffs from, around its footprint's centre. */
export const chimneyTop = (kind: Kind): Point => {
  const { u, v } = chimneyBay(kind)
  return at(u, v, heightOf(kind) + CHIMNEY + 4)
}

const statusColor: Readonly<Record<Status, number>> = {
  building: 0xb9beb5,
  idle: 0xb9beb5,
  working: 0x4f8a3e,
  starved: 0xd6ae2e,
  blocked: 0xc4523f
}

const labelStyle = new TextStyle({
  fontFamily: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace",
  fontSize: 13,
  fill: ink
})

interface Ring {
  age: number
}

/**
 * A factory as drawn: its plate on the floor, its building among the other
 * objects (sorted by depth), and its name tag above everything.
 */
export class FactoryView extends Container {
  private readonly kind: Kind
  private readonly color: number
  private readonly plate = new Graphics()
  private readonly building = new Graphics()
  private readonly smoke = new Graphics()
  private readonly tag = new Container()
  private readonly tagBox = new Graphics()
  private readonly tagDot = new Graphics()
  private readonly tagText: Text
  private readonly rings: Array<Ring> = []
  private puff = 0
  private door = 0
  private drawn = ""
  private wave = 0

  constructor(kindId: KindId, name: string, color: number, stage: Stage) {
    super()
    this.color = color
    this.kind = kinds[kindId]
    this.addChild(this.building, this.smoke)
    this.tagText = new Text({ text: name, style: labelStyle, resolution: 3 })
    this.tagText.anchor.set(0, 0.5)
    this.tag.addChild(this.tagBox, this.tagDot, this.tagText)
    stage.plates.addChild(this.plate)
    stage.labels.addChild(this.tag)
    this.layoutTag()
  }

  /** The tag, in whole pixels: 8 px of padding, an 8 px status square, 6 px before the name. */
  private layoutTag() {
    const pad = 8
    const dot = 8
    const gap = 6
    const width = 2 * Math.ceil((pad + dot + gap + this.tagText.width + pad) / 2)
    const height = 22
    this.tagBox.clear()
      .roundRect(-width / 2 + 0.5, -height / 2 + 0.5, width - 1, height - 1, 3)
      .fill({ color: 0xf6f7f3 })
      .stroke({ color: 0xbfc5bc, width: 1 })
    this.tagDot.position.set(-width / 2 + pad + dot / 2, 0)
    this.tagText.position.set(-width / 2 + pad + dot + gap, 0)
  }

  /** Puts it on the grid by its footprint's top cell. */
  place(x: number, y: number) {
    const centre = toScreen(x + FOOTPRINT / 2, y + FOOTPRINT / 2)
    this.position.set(centre.x, centre.y)
    this.plate.position.set(centre.x, centre.y)
    this.zIndex = x + y + FOOTPRINT
    this.tag.position.set(centre.x, centre.y - heightOf(this.kind) - CHIMNEY - 24)
  }

  /** Follows the factory's work: rising, doors, smoke, bounce, and status. */
  update(work: WorkValue, dt: number, emphasis: "normal" | "dim" | "focus" | "danger", leftDoor: boolean) {
    const build = Math.min(1, work.built)
    const opening = work.status === "working" || work.pulse > 0.2 ? 1 : 0
    this.door += (opening - this.door) * Math.min(1, dt * 6)
    this.wave += dt * (this.kind.flag && work.status === "working" ? 9 : 3)

    // Redrawn only when something it shows moved by a whole pixel's worth.
    const key = `${build.toFixed(3)}|${Math.round(this.door * 12)}|${leftDoor}|${this.kind.flag ? Math.round(Math.sin(this.wave) * 2) : ""}`
    if (key !== this.drawn) {
      this.drawn = key
      this.building.clear()
      drawBuilding(this.building, this.kind, this.color, build, this.door, this.wave, leftDoor)
      const stage = buildStages(build)
      this.plate.clear()
      drawPlate(this.plate, 1, stage.plate, stage.walls > 0)
    }

    // A small bounce when a job finishes; at rest it is exactly its drawn size.
    const p = work.pulse
    this.building.scale.set(1 + p * 0.04, 1 - p * 0.06)

    // Smoke rings, while working.
    this.puff -= dt
    if (work.status === "working" && this.puff <= 0) {
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
      this.smoke.circle(top.x + Math.sin(t * 5) * 1.5, top.y - t * 34, 4 + t * 7)
        .stroke({ color: ink, width: DETAIL, alpha: (1 - t) * 0.55 })
    }

    // The tag's status square: filled while it has something to say, hollow when idle.
    const blink = work.status === "blocked" ? 0.55 + 0.45 * Math.sin(this.wave * 3) : 1
    this.tagDot.clear()
    if (work.status === "idle" || work.status === "building") this.tagDot.rect(-3.5, -3.5, 7, 7).stroke({ color: 0x9aa09a, width: 1 })
    else this.tagDot.rect(-4, -4, 8, 8).fill({ color: statusColor[work.status], alpha: blink })

    const alpha = emphasis === "dim" ? 0.28 : 1
    this.alpha = alpha
    this.plate.alpha = alpha
    this.tag.alpha = (emphasis === "dim" ? 0.4 : 1) * buildStages(build).walls
    this.building.tint = emphasis === "danger" ? 0xf3b5aa : 0xffffff
    this.tagBox.tint = emphasis === "focus" ? 0xdfe6dc : 0xffffff
  }

  override destroy(options?: Parameters<Container["destroy"]>[0]) {
    this.plate.destroy()
    this.tag.destroy({ children: true })
    super.destroy(options)
  }
}

// ── Belts ─────────────────────────────────────────────────────────────────

const along = (a: Point, b: Point) => {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const d = length === 0 ? { x: 1, y: 0 } : { x: (b.x - a.x) / length, y: (b.y - a.y) / length }
  return { length, d, p: { x: -d.y, y: d.x } }
}

/** A straight run of belt from `a` to `b`, `half` either side of the centre line. */
const strip = (a: Point, b: Point, half: number): [Point, Point, Point, Point] => {
  const { p } = along(a, b)
  return [
    toScreen(a.x + p.x * half, a.y + p.y * half),
    toScreen(b.x + p.x * half, b.y + p.y * half),
    toScreen(b.x - p.x * half, b.y - p.y * half),
    toScreen(a.x - p.x * half, a.y - p.y * half)
  ]
}

/** A square on the floor in grid coordinates. */
const tile = (c: Point, half: number): Array<Point> => [
  toScreen(c.x - half, c.y - half),
  toScreen(c.x + half, c.y - half),
  toScreen(c.x + half, c.y + half),
  toScreen(c.x - half, c.y + half)
]

/** A belt's surface. */
export const drawBeltBase = (g: Graphics, points: ReadonlyArray<Point>, alpha = 1) => {
  for (let i = 1; i < points.length; i++) g.poly(flat(strip(points[i - 1]!, points[i]!, BELT))).fill({ color: beltFill, alpha })
}

/** A belt's rails, square ends, and square joints at the turns. */
export const drawBeltRails = (g: Graphics, points: ReadonlyArray<Point>, alpha = 1, color = ink) => {
  for (let i = 1; i < points.length; i++) {
    const [p0, p1, p2, p3] = strip(points[i - 1]!, points[i]!, BELT)
    line(g, p0, p1, LINE, color, alpha)
    line(g, p3, p2, LINE, color, alpha)
  }
  const first = strip(points[0]!, points[1]!, BELT)
  line(g, first[0], first[3], LINE, color, alpha)
  const last = strip(points[points.length - 2]!, points[points.length - 1]!, BELT)
  line(g, last[1], last[2], LINE, color, alpha)
  for (let i = 1; i < points.length - 1; i++) {
    const c = points[i]!
    g.poly(flat(tile(c, JOINT))).fill({ color: beltFill, alpha }).stroke({ color, width: LINE, alpha, join: "round" })
    g.poly(flat(tile(c, JOINT_INNER))).stroke({ color, width: DETAIL, alpha: alpha * 0.8, join: "round" })
  }
}

/** The hatching across a belt, rail to rail, scrolled by `offset` (cells) towards its end. */
export const drawBeltHatch = (g: Graphics, points: ReadonlyArray<Point>, offset: number, alpha = 1) => {
  let start = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const { length, d, p } = along(a, points[i]!)
    let s = (((offset - start) % HATCH_GAP) + HATCH_GAP) % HATCH_GAP
    for (; s < length; s += HATCH_GAP) {
      const c = { x: a.x + d.x * s, y: a.y + d.y * s }
      const l = toScreen(c.x + p.x * BELT, c.y + p.y * BELT)
      const r = toScreen(c.x - p.x * BELT, c.y - p.y * BELT)
      g.moveTo(l.x, l.y).lineTo(r.x, r.y)
    }
    start += length
  }
  g.stroke({ color: hatch, width: DETAIL, alpha })
}

export class BeltView extends Container {
  private readonly base = new Graphics()
  private readonly hatching = new Graphics()
  private readonly rails = new Graphics()
  private readonly points: ReadonlyArray<Point>

  constructor(points: ReadonlyArray<Point>) {
    super()
    this.points = points
    drawBeltBase(this.base, points)
    drawBeltRails(this.rails, points)
    this.addChild(this.base, this.hatching, this.rails)
  }

  update(time: number, emphasis: "normal" | "dim" | "focus" | "danger") {
    this.hatching.clear()
    drawBeltHatch(this.hatching, this.points, time * BELT_SPEED)
    this.alpha = emphasis === "dim" ? 0.25 : 1
    this.tint = emphasis === "danger" ? 0xf3b5aa : 0xffffff
  }
}

// ── Crates ────────────────────────────────────────────────────────────────

/** A crate, 6 units square and 12 px tall, sitting on its belt. */
export const drawCrate = (g: Graphics, label: number) => {
  const s = CRATE
  const h = CRATE_HEIGHT
  const edge = 0x7d6140
  const face = (points: ReadonlyArray<Point>, fill: number) =>
    g.poly(flat(points)).fill({ color: fill }).stroke({ color: edge, width: DETAIL, join: "round" })
  face([at(-s, s, 0), at(s, s, 0), at(s, s, h), at(-s, s, h)], 0xe9c48a)
  face([at(s, -s, 0), at(s, s, 0), at(s, s, h), at(s, -s, h)], 0xd5a86c)
  face(square(0, 0, s, h), 0xf4dcab)
  // Tape across the lid, a unit wide, and the label of the factory that made it.
  g.poly(flat([at(-s, -0.5 * U, h), at(s, -0.5 * U, h), at(s, 0.5 * U, h), at(-s, 0.5 * U, h)])).fill({ color: 0xc79a5b })
  g.poly(flat([at(-2 * U, s, 3), at(U, s, 3), at(U, s, 8), at(-2 * U, s, 8)])).fill({ color: label })
}

export class CrateView extends Graphics {
  constructor(label: number) {
    super()
    drawCrate(this, label)
  }

  place(x: number, y: number) {
    const s = toScreen(x, y)
    this.position.set(s.x, s.y)
    this.zIndex = x + y
  }
}

// ── The floor ─────────────────────────────────────────────────────────────

/** The grid: a faint line between every two cells, and the yard's edge. */
export const drawFloor = (g: Graphics) => {
  for (let i = 1; i < GRID; i++) {
    const a = toScreen(i, 0)
    const b = toScreen(i, GRID)
    const c = toScreen(0, i)
    const d = toScreen(GRID, i)
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).moveTo(c.x, c.y).lineTo(d.x, d.y)
  }
  g.stroke({ color: 0xd9ddd3, width: DETAIL })
  outline(g, [toScreen(0, 0), toScreen(GRID, 0), toScreen(GRID, GRID), toScreen(0, GRID)], LINE, 0xb9bfb4)
}

/**
 * A plot on the floor: under the pointer (`hover`), picked for building
 * (`picked`, with corner ticks that breathe with `time`), or with no room
 * (`blocked`).
 */
export const drawPlot = (g: Graphics, x: number, y: number, look: "hover" | "picked" | "blocked", time = 0) => {
  const n = FOOTPRINT
  const corners = [toScreen(x, y), toScreen(x + n, y), toScreen(x + n, y + n), toScreen(x, y + n)]
  if (look === "hover") {
    g.poly(flat(corners)).fill({ color: ink, alpha: 0.04 }).stroke({ color: ink, width: DETAIL, alpha: 0.35 })
    return
  }
  const color = look === "blocked" ? 0xc4523f : ink
  g.poly(flat(corners)).fill({ color, alpha: 0.07 }).stroke({ color, width: LINE, alpha: 0.85 })
  // Corner ticks a unit outside the plot, 4 units long (breathing by a unit).
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
