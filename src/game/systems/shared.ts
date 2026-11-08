/** Queries and small helpers the simulation's systems share. */
import type { EntityProving } from "@typeonce/ritmo/Query"

import { doors, type TileLike, type Use } from "../world/grid.ts"
import { Field, Game, House, Park, Paved, Road, Rock, Ruin, Tile, Tree, Water, type GridValue } from "../schema.ts"
import type { Point } from "../world/iso.ts"

/** Every tile, with enough to tell what it is. */
export const TileRead = Game.Query({
  selection: {
    tile: Game.Query.read(Tile),
    road: Game.Query.optional(Road),
    paved: Game.Query.optional(Paved),
    park: Game.Query.optional(Park),
    house: Game.Query.optional(House),
    tree: Game.Query.optional(Tree),
    rock: Game.Query.optional(Rock),
    water: Game.Query.optional(Water),
    field: Game.Query.optional(Field),
    ruin: Game.Query.optional(Ruin)
  }
})

export const useOf = (entity: EntityProving<never>, data: { readonly [K in "road" | "park" | "house" | "tree" | "rock" | "water" | "field" | "ruin"]: { has(entity: EntityProving<never>): boolean } }): Use =>
  data.road.has(entity) ? "road"
  : data.park.has(entity) ? "park"
  : data.house.has(entity) ? "house"
  : data.tree.has(entity) ? "tree"
  : data.rock.has(entity) ? "rock"
  : data.water.has(entity) ? "water"
  : data.field.has(entity) ? "field"
  : data.ruin.has(entity) ? "ruin"
  : "building"

export const connected = (grid: GridValue, tile: TileLike): boolean => doors(grid, tile).length > 0

import { transport } from "../rules/config.ts"
export const CELL_STEPS = transport.cellSteps
export { elapsed, termTicks, yearTicks, winterOf, rollWinters, seasonAt, type Almanac } from "../rules/seasons.ts"

// ── The chronicle ─────────────────────────────────────────────────────────

type Lines = ReadonlyArray<{ readonly tick: number; readonly text: string; readonly alarm: boolean; readonly at: Point | null }>
/** A line in the chronicle; an `alarm` is also news the page announces; `at` is where it happened, when it was somewhere. */
export const write = (
  chronicle: { update: (f: (c: { readonly lines: Lines }) => { lines: Lines }) => void },
  tick: number,
  text: string,
  alarm = false,
  at: Point | null = null
) => chronicle.update((c) => ({ lines: [...c.lines, { tick, text, alarm, at: at ? { x: at.x, y: at.y } : null }].slice(-200) }))
