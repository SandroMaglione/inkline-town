import { shippedRules, type Rules } from "./rules/config.ts"
/**
 * A new town's land, from its charter: an island-like stretch of land of
 * the charter's size, its coast wandering in and out and a few capes
 * reaching out; lakes, forests and single trees, outcrops of stone and
 * deposits of ore, as many as the land's richness gives; and a clearing in
 * the middle where the town hall stands, ringed by a road (the mayor lays
 * the rest).
 * Pure: the same charter always makes the same land.
 */
import { Ops } from "@typeonce/ritmo-math"
import * as Random from "@typeonce/ritmo-math/Random"

import { GROWN, type CharterValue } from "./content.ts"
import { DIRS, key } from "./grid.ts"
import { GRID, inside, type Point } from "./iso.ts"

export interface Land {
  /** "1" for land, "0" for open water, by `key`. */
  readonly mask: string
  readonly cells: number
  readonly hall: Point
  readonly roads: ReadonlyArray<Point>
  readonly water: ReadonlyArray<Point>
  readonly trees: ReadonlyArray<{ readonly cell: Point; readonly growth: number }>
  readonly rocks: ReadonlyArray<{ readonly cell: Point; readonly ore: boolean; readonly amount: number }>
}

/** The clearing around the town hall that nothing natural grows in. */
const CLEARING = 7

/** The angle from `a` to `b`, -π → π. */
const turn = (a: number, b: number) => Ops.atan2(Ops.sin(b - a), Ops.cos(b - a))

/**
 * The shape of the land: a circle of the size's radius whose edge swells
 * and dips in a few long waves, with capes reaching out at random angles
 * and a ragged shoreline; then tidied so it is one piece with no holes and
 * no lone cells.
 */
const shape = (random: Random.Random, radius: number): Array<boolean> => {
  const centre = GRID / 2
  const waves = [2, 3, 4, 5].map((k) => ({ k, size: random.range(0, 0.1), phase: random.range(0, Math.PI * 2) }))
  const capes = Array.from({ length: random.integer(2, 6) }, () => ({
    at: random.range(0, Math.PI * 2),
    size: random.range(0.2, 0.5),
    width: random.range(0.1, 0.28)
  }))
  const edge = (angle: number) =>
    radius *
    (1 +
      waves.reduce((sum, w) => sum + w.size * Ops.sin(w.k * angle + w.phase), 0) +
      capes.reduce((sum, c) => sum + c.size * Ops.exp(-((turn(c.at, angle) / c.width) ** 2)), 0))

  let land = new Array<boolean>(GRID * GRID).fill(false)
  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const dx = x + 0.5 - centre
      const dy = y + 0.5 - centre
      land[key(x, y)] = Ops.hypot(dx, dy) < edge(Ops.atan2(dy, dx)) + random.range(-0.8, 0.8)
    }
  }
  // Smooth the shore: a cell mostly surrounded by water floods, a cove mostly surrounded by land fills.
  const neighbours = (cells: ReadonlyArray<boolean>, x: number, y: number) =>
    DIRS.filter((d) => inside(x + d.x, y + d.y) && cells[key(x + d.x, y + d.y)]).length
  for (let pass = 0; pass < 2; pass++) {
    const next = [...land]
    for (let y = 1; y < GRID - 1; y++) {
      for (let x = 1; x < GRID - 1; x++) {
        const n = neighbours(land, x, y)
        if (land[key(x, y)] && n <= 1) next[key(x, y)] = false
        else if (!land[key(x, y)] && n >= 3) next[key(x, y)] = true
      }
    }
    land = next
  }
  // One piece: what the middle can walk to. Water it can't reach from the open sea is filled in.
  const flood = (start: Point, on: (k: number) => boolean) => {
    const seen = new Set<number>([key(start.x, start.y)])
    const queue = [start]
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head]!
      for (const d of DIRS) {
        const n = { x: c.x + d.x, y: c.y + d.y }
        const k = key(n.x, n.y)
        if (!inside(n.x, n.y) || seen.has(k) || !on(k)) continue
        seen.add(k)
        queue.push(n)
      }
    }
    return seen
  }
  const main = flood({ x: centre, y: centre }, (k) => land[k]!)
  const sea = flood({ x: 0, y: 0 }, (k) => !main.has(k))
  return land.map((_, k) => main.has(k) || !sea.has(k))
}

export const generate = (charter: CharterValue, rules: Rules = shippedRules): Land => {
  const random = Random.make(charter.seed)
  const richness = rules.lands[charter.land]
  const ground = shape(random, rules.sizes[charter.size].radius)
  const cells = ground.filter(Boolean).length
  const per = (perThousand: number) => Math.max(1, Math.round((cells / 1000) * perThousand))

  const taken = new Set<number>()
  const centre = { x: GRID / 2, y: GRID / 2 }
  const hall = { x: centre.x - 2, y: centre.y - 2 }
  const near = (c: Point, r: number) => Ops.hypot(c.x + 0.5 - centre.x, c.y + 0.5 - centre.y) < r
  const onLand = (c: Point) => inside(c.x, c.y) && ground[key(c.x, c.y)]!
  const free = (c: Point) => onLand(c) && !taken.has(key(c.x, c.y)) && !near(c, CLEARING)
  const take = (c: Point) => taken.add(key(c.x, c.y))
  /** A random cell of land at least `from` cells from the middle. */
  const somewhere = (from: number): Point => {
    for (let tries = 0; tries < 200; tries++) {
      const c = { x: random.integer(1, GRID - 1), y: random.integer(1, GRID - 1) }
      if (free(c) && !near(c, from)) return c
    }
    return { x: random.integer(1, GRID - 1), y: random.integer(1, GRID - 1) }
  }

  // The town hall and a ring road around it. The ground a cell or two out from each side is cleared too, but no road
  // leads out: where the town grows is the mayor's first choice.
  for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) take({ x: hall.x + dx, y: hall.y + dy })
  const roads: Array<Point> = []
  for (let x = hall.x - 1; x <= hall.x + 3; x++) {
    for (let y = hall.y - 1; y <= hall.y + 3; y++) {
      if (x === hall.x - 1 || x === hall.x + 3 || y === hall.y - 1 || y === hall.y + 3) roads.push({ x, y })
    }
  }
  roads.forEach(take)
  for (let i = 2; i <= 3; i++) [{ x: hall.x + 2 + i, y: hall.y + 1 }, { x: hall.x + 1, y: hall.y + 2 + i }, { x: hall.x - i, y: hall.y + 1 }, { x: hall.x + 1, y: hall.y - i }].forEach(take)

  // Lakes, the first not too far from the town.
  const water: Array<Point> = []
  const scale = Math.sqrt(cells / 1000)
  for (let l = 0; l < richness.lakes; l++) {
    const at = somewhere(CLEARING + 3 + (l === 0 ? 0 : 4))
    const rx = Math.max(2, Math.round(random.range(2.5, 5) * scale))
    const ry = Math.max(2, Math.round(random.range(2, 4.5) * scale))
    for (let y = at.y - ry - 1; y <= at.y + ry + 1; y++) {
      for (let x = at.x - rx - 1; x <= at.x + rx + 1; x++) {
        const c = { x, y }
        const d = ((x - at.x) / rx) ** 2 + ((y - at.y) / ry) ** 2
        if (d < 1 + random.range(-0.2, 0.2) && free(c)) {
          water.push(c)
          take(c)
        }
      }
    }
  }

  // Forests, then trees on their own.
  const trees: Array<{ cell: Point; growth: number }> = []
  const plant = (c: Point) => {
    if (!free(c)) return
    trees.push({ cell: c, growth: random.next() < 0.8 ? GROWN.tree : random.integer(0, GROWN.tree) })
    take(c)
  }
  for (let f = 0; f < per(richness.forests); f++) {
    const at = somewhere(CLEARING + 3)
    const count = random.integer(16, 30)
    let placed = 0
    for (let tries = 0; placed < count && tries < count * 4; tries++) {
      const spread = Math.sqrt(random.next()) * 4
      const angle = random.range(0, Math.PI * 2)
      const c = { x: Math.round(at.x + Ops.cos(angle) * spread), y: Math.round(at.y + Ops.sin(angle) * spread) }
      if (!free(c)) continue
      plant(c)
      placed += 1
    }
  }
  for (let i = 0; i < Math.round(cells / 45); i++) plant({ x: random.integer(0, GRID), y: random.integer(0, GRID) })

  // Outcrops of stone, and deposits of ore.
  const rocks: Array<{ cell: Point; ore: boolean; amount: number }> = []
  const outcrop = (ore: boolean) => {
    const at = somewhere(CLEARING + 1)
    const count = random.integer(3, 7)
    for (let i = 0; i < count; i++) {
      const c = { x: at.x + random.integer(-1, 2), y: at.y + random.integer(-1, 2) }
      if (!free(c)) continue
      rocks.push({ cell: c, ore, amount: richness.rock })
      take(c)
    }
  }
  for (let i = 0; i < per(richness.stone); i++) outcrop(false)
  for (let i = 0; i < per(richness.ore); i++) outcrop(true)

  return { mask: ground.map((g) => (g ? "1" : "0")).join(""), cells, hall, roads, water, trees, rocks }
}
