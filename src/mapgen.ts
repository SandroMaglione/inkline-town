/**
 * A new town's land, from a seed: a lake by one edge, a few forests and
 * single trees, outcrops of stone and a deposit of ore, and a clearing in
 * the middle where the town hall stands, ringed by a road with a stub
 * out from each side.
 * Pure: the same seed always makes the same land.
 */
import * as Random from "@typeonce/bevy-ts-math/Random"

import { GROWN } from "./content.ts"
import { key } from "./grid.ts"
import { GRID, inside, type Point } from "./iso.ts"

export interface Land {
  readonly hall: Point
  readonly roads: ReadonlyArray<Point>
  readonly water: ReadonlyArray<Point>
  readonly trees: ReadonlyArray<{ readonly cell: Point; readonly growth: number }>
  readonly rocks: ReadonlyArray<{ readonly cell: Point; readonly ore: boolean }>
}

export const generate = (seed: number): Land => {
  const random = Random.make(seed)
  const taken = new Set<number>()
  const centre = { x: GRID / 2, y: GRID / 2 }
  const hall = { x: centre.x - 2, y: centre.y - 2 }
  const clearing = 7
  const near = (c: Point, r: number) => Math.hypot(c.x + 0.5 - centre.x, c.y + 0.5 - centre.y) < r
  const free = (c: Point) => inside(c.x, c.y) && !taken.has(key(c.x, c.y)) && !near(c, clearing)
  const take = (c: Point) => taken.add(key(c.x, c.y))

  // The town hall, a ring road around it, and a stub out from the middle of each side.
  for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) take({ x: hall.x + dx, y: hall.y + dy })
  const roads: Array<Point> = []
  for (let x = hall.x - 1; x <= hall.x + 3; x++) {
    for (let y = hall.y - 1; y <= hall.y + 3; y++) {
      if (x === hall.x - 1 || x === hall.x + 3 || y === hall.y - 1 || y === hall.y + 3) roads.push({ x, y })
    }
  }
  for (let i = 2; i <= 3; i++) {
    roads.push({ x: hall.x + 2 + i, y: hall.y + 1 }, { x: hall.x + 1, y: hall.y + 2 + i }, { x: hall.x - i, y: hall.y + 1 }, { x: hall.x + 1, y: hall.y - i })
  }
  roads.forEach(take)

  // A lake against one edge.
  const water: Array<Point> = []
  const side = random.integer(0, 4)
  const along = random.integer(6, GRID - 6)
  const lake = [
    { x: GRID - 2, y: along },
    { x: along, y: GRID - 2 },
    { x: 1, y: along },
    { x: along, y: 1 }
  ][side]!
  const rx = random.integer(4, 7)
  const ry = random.integer(3, 6)
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const d = ((x - lake.x) / rx) ** 2 + ((y - lake.y) / ry) ** 2
      const c = { x, y }
      if (d < 1 + random.range(-0.2, 0.2) && free(c)) {
        water.push(c)
        take(c)
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
  for (let f = 0; f < 6; f++) {
    let at = { x: random.integer(2, GRID - 2), y: random.integer(2, GRID - 2) }
    for (let tries = 0; tries < 20 && near(at, clearing + 3); tries++) at = { x: random.integer(2, GRID - 2), y: random.integer(2, GRID - 2) }
    const count = random.integer(18, 30)
    let placed = 0
    for (let tries = 0; placed < count && tries < count * 4; tries++) {
      const spread = Math.sqrt(random.next()) * 4
      const turn = random.range(0, Math.PI * 2)
      const c = { x: Math.round(at.x + Math.cos(turn) * spread), y: Math.round(at.y + Math.sin(turn) * spread) }
      if (!free(c)) continue
      plant(c)
      placed += 1
    }
  }
  for (let i = 0; i < 24; i++) plant({ x: random.integer(0, GRID), y: random.integer(0, GRID) })

  // Outcrops of stone, and a deposit of ore.
  const rocks: Array<{ cell: Point; ore: boolean }> = []
  const outcrop = (ore: boolean) => {
    for (let tries = 0; tries < 20; tries++) {
      const at = { x: random.integer(2, GRID - 2), y: random.integer(2, GRID - 2) }
      if (!free(at) || near(at, clearing + 1)) continue
      const count = random.integer(3, 6)
      for (let i = 0; i < count; i++) {
        const c = { x: at.x + random.integer(-1, 2), y: at.y + random.integer(-1, 2) }
        if (!free(c)) continue
        rocks.push({ cell: c, ore })
        take(c)
      }
      return
    }
  }
  outcrop(false)
  outcrop(false)
  outcrop(false)
  outcrop(true)
  outcrop(true)

  return { hall, roads, water, trees, rocks }
}
