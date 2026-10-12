/**
 * The town's look: pale line-drawn buildings and homes on plates, paved
 * roads with square joints, trees, rocks, fields and water drawn in the same
 * ink, cardboard crates with coloured labels, and small walkers. Everything
 * is drawn with Pixi graphics in world pixels, measured in units (see
 * `iso.ts`): floor lengths are whole units, heights whole pixels, and lines
 * one of two weights.
 *
 * Colour is kept for meaning: awnings by what a building is for, crate
 * labels by good, a home's door, the red of a problem marker.
 *
 * The measures that have to agree:
 * - a road is 12 units wide and runs down the middle of a cell;
 * - a building's door is 10 units wide, centred on a side where a road
 *   meets it;
 * - a plate is a unit inside its footprint;
 * - a crate is 6 units wide, a carried one 4.
 */
import { Container, Graphics } from "pixi.js"

import { categoryColor, GROWN, home, kinds, ROCK_AMOUNT, type Kind, type KindId, type Tier } from "./content.ts"
import { cellOf, DIRS, key } from "./grid.ts"
import { flat, GRID, toScreen, U, type Point } from "./iso.ts"

export const ink = 0x3d4943
const plateFill = 0xf5f6f2
const roofFill = 0xf7f8f4
const leftFill = 0xe9ebe5
const rightFill = 0xdde0d9
const roadFill = 0xe6e8e2
const marking = 0xb4b9b1
const leafFill = 0xe7ece0
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
const plate = (g: Graphics, half: number, alpha = 1, marked = 1, filled = true) => {
  g.poly(flat(square(0, 0, half * (0.8 + 0.2 * marked))))
    .fill({ color: plateFill, alpha: filled ? alpha : 0 })
    .stroke({ color: ink, width: LINE, alpha: alpha * marked, join: "round" })
}

/** Half a plate's width for a footprint `size` cells a side: a unit inside it. */
const plateHalf = (size: number) => (size * 8 - 1) * U

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

/** A small window, a unit either side of `along`, `z` to `z + 5` px up a wall. */
const window_ = (g: Graphics, side: Side, a: number, along: number, z: number) => {
  const p = onWall(side, a)
  outline(g, [p(along - U, 0, z), p(along + U, 0, z), p(along + U, 0, z + 5), p(along - U, 0, z + 5)], DETAIL)
}

// ── Buildings ─────────────────────────────────────────────────────────────

/** Height of a kind's walls at full size. */
export const heightOf = (kind: Kind) => (kind.roof === "gable" ? HUT : kind.stories * STORY)
/** Height of a kind's building at full size, roof and topper included. */
export const topOf = (kind: Kind) =>
  heightOf(kind) + (kind.roof === "gable" ? HUT_ROOF : kind.topper === "none" ? 0 : kind.topper === "sails" ? 20 : CHIMNEY)

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

/**
 * A building, `build` 0 → 1 of the way up (see `buildStages`); `door` 0
 * (shut) → 1 (open); `wave` drives flags and sails.
 */
export const drawBuilding = (g: Graphics, kind: Kind, build: number, door: number, wave: number, doors: Doors, color = categoryColor[kind.category]) => {
  const a = kind.half * U
  const full = heightOf(kind)
  const stage = buildStages(build)
  if (stage.frame <= 0) return
  if (stage.walls < 1) drawFrame(g, a, Math.round(full * stage.frame))
  if (stage.walls <= 0) return
  const H = Math.max(2, Math.round(full * stage.walls))

  walls(g, a, H)
  drawSeams(g, "left", a, H, doors.left)
  drawSeams(g, "right", a, H, doors.right)
  if (kind.stories === 2 && H > STORY) {
    line(g, at(-a, a, STORY), at(a, a, STORY), DETAIL, ink, 0.7)
    line(g, at(a, -a, STORY), at(a, a, STORY), DETAIL, ink, 0.7)
  }
  if (stage.fit > 0.15) {
    if (doors.right) drawDoor(g, "right", a, H, stage.fit, door, color)
    if (doors.left) drawDoor(g, "left", a, H, stage.fit, door, color)
  }

  if (kind.roof === "gable") {
    if (stage.fit > 0.4) {
      if (!doors.right) window_(g, "right", a, 0, 6)
      if (!doors.left) window_(g, "left", a, 0, 6)
    }
    gable(g, a, H, Math.round(HUT_ROOF * stage.fit))
    return
  }

  // A flat roof (the top of the walls while they rise) and its windows, one by one.
  quad(g, square(0, 0, a, H), roofFill)
  const flag = kind.topper === "flag"
  const usesBack = kind.topper !== "none" && kind.topper !== "flag" && kind.topper !== "sails"
  if (stage.fit > 0.4) {
    const all = bays(kind).filter((bay) => !(usesBack && bay.index === 0) && !(flag && bay.index === kind.bays - 1))
    const shown = Math.ceil(all.length * smooth((stage.fit - 0.4) / 0.4))
    for (const bay of all.slice(0, shown)) outline(g, square(bay.u, bay.v, (kind.window / 2) * U, H))
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
      quad(g, [at(u - c, v + c, top), at(u + c, v + c, top), at(u, v, apex)], leftFill)
      quad(g, [at(u + c, v - c, top), at(u + c, v + c, top), at(u, v, apex)], rightFill)
    } else if (kind.topper === "chimney") {
      const top = H + Math.round(CHIMNEY * stage.fit)
      roofBox(g, u, v, CHIMNEY_HALF, H, top)
      quad(g, square(u, v, CHIMNEY_HALF, top), roofFill)
    } else if (kind.topper === "crates") {
      // Crates stacked on the roof's back bay.
      if (stage.fit > 0.5) {
        drawCrate(g, 0x8f9891, CRATE, CRATE_HEIGHT, H, u, v)
        drawCrate(g, 0x8f9891, CRATE, CRATE_HEIGHT, H, u + 7 * U, v)
        drawCrate(g, 0x8f9891, CRATE, CRATE_HEIGHT, H + CRATE_HEIGHT, u + 3 * U, v)
      }
    } else if (kind.topper === "sails" && stage.fit > 0.6) {
      // Four sails on the wall facing +x, turning with `wave`.
      const hub = at(a + U, 0, H - 8)
      for (let i = 0; i < 4; i++) {
        const turn = wave * 0.6 + (i * Math.PI) / 2
        const d = { x: Math.cos(turn), y: Math.sin(turn) }
        const n = { x: -d.y, y: d.x }
        const tip = { x: hub.x + d.x * 22, y: hub.y + d.y * 22 }
        line(g, hub, tip, LINE)
        outline(g, [
          { x: hub.x + d.x * 8, y: hub.y + d.y * 8 },
          { x: tip.x, y: tip.y },
          { x: tip.x + n.x * 4, y: tip.y + n.y * 4 },
          { x: hub.x + d.x * 8 + n.x * 4, y: hub.y + d.y * 8 + n.y * 4 }
        ], DETAIL)
      }
      g.circle(hub.x, hub.y, 2).fill({ color: roofFill }).stroke({ color: ink, width: DETAIL })
    }
  }

  if (flag && stage.fit > 0.9) {
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
export const homeHeight = (tier: Tier) => home.tiers[tier].height + HOUSE_ROOF + (tier === 2 ? 2 : 0)

/** Roof colours homes are built with: muted terracotta, slate, thatch, and moss. */
const homeRoofs: ReadonlyArray<RoofColors> = [
  { face: 0xe6c3b2, shade: 0xd3ab98 },
  { face: 0xc9d2da, shade: 0xb3bec8 },
  { face: 0xe4dab8, shade: 0xd1c59f },
  { face: 0xd0d9c5, shade: 0xbac5ae }
]

/** How a home is built, from a number 0 → 1 fixed for its cell: roof colour, which way its ridge runs, a chimney. */
export interface HomeVariant {
  readonly roof: RoofColors
  readonly ridge: "x" | "y"
  readonly chimney: boolean
}
export const homeVariant = (n: number): HomeVariant => ({
  roof: homeRoofs[Math.floor(n * homeRoofs.length) % homeRoofs.length]!,
  ridge: Math.floor(n * 97) % 2 === 0 ? "x" : "y",
  chimney: Math.floor(n * 31) % 3 !== 0
})
const plainHome: HomeVariant = { roof: paleRoof, ridge: "x", chimney: false }

/**
 * A home, `build` 0 → 1 of the way up: walls, a door on each wall a road
 * meets with an awning in its roof's colour, windows on the rest, and a
 * gabled roof. A citizens' home is wider, with a second story and a window
 * either side on every floor.
 */
export const drawHouse = (g: Graphics, tier: Tier, build: number, doors: Doors, variant: HomeVariant = plainHome) => {
  const a = (tier === 2 ? home.half + 1 : home.half) * U
  const full = home.tiers[tier].height
  const stage = buildStages(build)
  if (stage.frame <= 0) return
  if (stage.walls < 1) drawFrame(g, a, Math.round(full * stage.frame))
  if (stage.walls <= 0) return
  const H = Math.max(2, Math.round(full * stage.walls))

  walls(g, a, H)
  const floors = tier === 2 ? [0, 12] : [0]
  if (tier === 2 && H > 13) {
    line(g, at(-a, a, 13), at(a, a, 13), DETAIL, ink, 0.7)
    line(g, at(a, -a, 13), at(a, a, 13), DETAIL, ink, 0.7)
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
        if (tier === 2) {
          for (const along of [-3 * U, 3 * U]) if (!(door && Math.abs(along) < HOUSE_DOOR + 2 * U)) window_(g, side, a, along, floor + 5)
        } else if (!door) window_(g, side, a, 0, floor + 5)
      })
    }
  }
  gable(g, a, H, Math.round((HOUSE_ROOF + (tier === 2 ? 2 : 0)) * stage.fit), variant.ridge, variant.roof, variant.chimney || tier === 2)
}

/** What a home view shows each frame. */
export interface HouseLook {
  readonly tier: Tier
  readonly build: number
  readonly doors: Doors
  /** While a site: the share of its materials in, else `null`. */
  readonly site: number | null
}

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
    this.variant = homeVariant(hash(x, y))
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

/**
 * A tree, `grown` 0 → 1: a trunk and a crown, a pointed fir or a round
 * broadleaf depending on its cell. It grows in three whole-pixel steps.
 */
export const drawTree = (g: Graphics, x: number, y: number, grown: number) => {
  const h = hash(x, y)
  const size = grown >= 1 ? 1 : grown >= 0.5 ? 0.75 : 0.5
  const trunk = Math.round(6 * size)
  const ox = Math.round((h - 0.5) * 8)
  line(g, { x: ox, y: 0 }, { x: ox, y: -trunk }, LINE)
  if (h < 0.55) {
    const w = Math.round(7 * size)
    const tall = Math.round(22 * size)
    g.poly([ox - w, -trunk, ox, -trunk - tall, ox + w, -trunk]).fill({ color: leafFill }).stroke({ color: ink, width: LINE, join: "round" })
    line(g, { x: ox - Math.round(w * 0.6), y: -trunk - Math.round(tall * 0.4) }, { x: ox + Math.round(w * 0.6), y: -trunk - Math.round(tall * 0.4) }, DETAIL, ink, 0.5)
  } else {
    const r = Math.round(7 * size)
    g.circle(ox, -trunk - r, r).fill({ color: leafFill }).stroke({ color: ink, width: LINE })
    line(g, { x: ox - Math.round(r * 0.4), y: -trunk - r + 1 }, { x: ox + Math.round(r * 0.2), y: -trunk - r - Math.round(r * 0.5) }, DETAIL, ink, 0.4)
  }
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

/** A rock: a low faceted boulder, smaller as it is quarried; an ore rock has dark flecks. */
export const drawRock = (g: Graphics, x: number, y: number, ore: boolean, left: number) => {
  const h = hash(x, y)
  const s = left > ROCK_AMOUNT / 2 ? 5 * U : 4 * U
  const tall = left > ROCK_AMOUNT / 2 ? 10 : 7
  const u = (h - 0.5) * 4 * U
  quad(g, [at(u - s, s, 0), at(u + s, s, 0), at(u + s, s * 0.4, tall), at(u - s * 0.6, s * 0.4, tall)], leftFill)
  quad(g, [at(u + s, -s, 0), at(u + s, s, 0), at(u + s, s * 0.4, tall), at(u + s * 0.4, -s * 0.6, tall)], rightFill)
  quad(g, [at(u - s * 0.6, -s * 0.6, tall), at(u + s * 0.4, -s * 0.6, tall), at(u + s, s * 0.4, tall), at(u - s * 0.6, s * 0.4, tall)], roofFill)
  if (ore) {
    for (const [du, dv, z] of [[-0.3, 1, 3], [0.2, 1, 6], [1, 0.1, 4]] as const) {
      const p = du === 1 ? at(u + s, dv * s, z) : at(u + du * s, s, z)
      g.rect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2).fill({ color: ink })
    }
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

/** Water on a set of cells (by `key`): pale fill, an ink shoreline where it meets land, and a few ripples. */
export const drawWater = (g: Graphics, cells: ReadonlySet<number>) => {
  for (const k of cells) {
    const c = cellOf(k)
    g.poly(flat([toScreen(c.x, c.y), toScreen(c.x + 1, c.y), toScreen(c.x + 1, c.y + 1), toScreen(c.x, c.y + 1)])).fill({ color: waterFill })
  }
  for (const k of cells) {
    const c = cellOf(k)
    if (hash(c.x, c.y) < 0.3) {
      const a = toScreen(c.x + 0.3, c.y + 0.5)
      const b = toScreen(c.x + 0.6, c.y + 0.5)
      g.moveTo(a.x, a.y).lineTo(b.x, b.y)
    }
  }
  g.stroke({ color: 0x9fb3b0, width: DETAIL })
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
 * square joints.
 */
export const drawRoads = (g: Graphics, cells: ReadonlySet<number>, alpha = 1, kerb = ink) => {
  const w = ROAD
  const edge = 8 * U
  const kerbs: Array<readonly [Point, Point]> = []
  const dashes: Array<readonly [Point, Point]> = []
  for (const k of cells) {
    const c = cellOf(k)
    const cx = c.x + 0.5
    const cy = c.y + 0.5
    const p = (u: number, v: number) => toScreen(cx + u, cy + v)
    g.poly(flat([p(-w, -w), p(w, -w), p(w, w), p(-w, w)])).fill({ color: roadFill, alpha })
    for (const d of DIRS) {
      const n = { x: -d.y, y: d.x }
      const q = (along: number, across: number) => p(d.x * along + n.x * across, d.y * along + n.y * across)
      if (cells.has(key(c.x + d.x, c.y + d.y))) {
        g.poly(flat([q(w, -w), q(edge, -w), q(edge, w), q(w, w)])).fill({ color: roadFill, alpha })
        kerbs.push([q(w, -w), q(edge, -w)], [q(w, w), q(edge, w)])
        dashes.push([q(U, 0), q(3 * U, 0)], [q(5 * U, 0), q(7 * U, 0)])
      } else kerbs.push([q(w, -w), q(w, w)])
    }
  }
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

/**
 * A walker: a small pale figure on two stepping legs, facing `dir` (a grid
 * step). A service walker's head is in its building's colour, and a
 * provisions walker carries a basket at its side. A carrier's head is pale;
 * it pushes a handcart ahead of it, with a crate labelled with its good on
 * the way out.
 */
export const drawWalker = (g: Graphics, role: "carrier" | "walker", color: number, cargo: boolean, dir: Point, phase: number) => {
  const d = dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir
  const ahead = { u: d.x * 5 * U, v: d.y * 5 * U }
  const front = toScreen(ahead.u, ahead.v)
  const figure = () => {
    const swing = phase === 0 ? 1 : -1
    line(g, { x: -1, y: -5 }, { x: -1 + swing, y: 0 }, DETAIL)
    line(g, { x: 1, y: -5 }, { x: 1 - swing, y: 0 }, DETAIL)
    g.roundRect(-2.5, -11, 5, 7, 2).fill({ color: plateFill }).stroke({ color: ink, width: DETAIL })
    g.circle(0, -13.5, 2.2).fill({ color: role === "walker" ? color : plateFill }).stroke({ color: ink, width: DETAIL })
    if (role === "walker" && cargo) {
      const side = front.x >= 0 ? -1 : 1
      g.rect(side * 4 - 1.5, -8, 3, 3).fill({ color: 0xe9c48a }).stroke({ color: 0x7d6140, width: DETAIL })
    }
  }
  const cart = () => {
    // Handles from the walker's hands to the cart, a wheel, and the bed or the crate on it.
    line(g, { x: front.x * 0.3, y: front.y * 0.3 - 7 }, { x: front.x * 0.7, y: front.y * 0.7 - 4 }, DETAIL)
    g.circle(front.x, front.y - 1, 1.5).fill({ color: ink })
    if (cargo) drawCrate(g, color, 2 * U, 5, 2, ahead.u, ahead.v)
    else quad(g, square(ahead.u, ahead.v, 2 * U, 2), roofFill)
  }
  if (role === "carrier" && front.y < 0) {
    cart()
    figure()
  } else {
    figure()
    if (role === "carrier") cart()
  }
}

export class WalkerView extends Graphics {
  private readonly role: "carrier" | "walker"
  private readonly color: number
  private drawn = ""

  constructor(role: "carrier" | "walker", color: number) {
    super()
    this.role = role
    this.color = color
  }

  /** Puts it on the floor at grid point (x, y), facing `dir`, redrawing when its stride, heading, or load changes. */
  update(x: number, y: number, dir: Point, phase: number, cargo: boolean) {
    const key = `${dir.x},${dir.y}|${phase}|${cargo}`
    if (key !== this.drawn) {
      this.drawn = key
      this.clear()
      drawWalker(this, this.role, this.color, cargo, dir, phase)
    }
    const s = toScreen(x, y)
    this.position.set(s.x, s.y)
    this.zIndex = x + y
  }
}

// ── The floor ─────────────────────────────────────────────────────────────

/** The grid: a faint line between every two cells, and the map's edge. */
export const drawFloor = (g: Graphics) => {
  for (let i = 1; i < GRID; i++) {
    const a = toScreen(i, 0)
    const b = toScreen(i, GRID)
    const c = toScreen(0, i)
    const d = toScreen(GRID, i)
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).moveTo(c.x, c.y).lineTo(d.x, d.y)
  }
  g.stroke({ color: 0xe0e3db, width: DETAIL })
  outline(g, [toScreen(0, 0), toScreen(GRID, 0), toScreen(GRID, GRID), toScreen(0, GRID)], LINE, 0xb9bfb4)
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
  else drawBuilding(g, kinds[what], 1, 0, 0, { right: false, left: false }, 0xb9beb5)
  g.resetTransform()
}
