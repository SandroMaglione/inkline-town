/** Queries and small helpers the simulation's systems share. */
import { doors, type TileLike, type Use } from "../grid.ts"
import { Field, Game, House, Park, Road, Rock, Ruin, Tile, Tree, Water, type GridValue } from "../schema.ts"

/** Every tile, with enough to tell what it is. */
export const TileRead = Game.Query({
  selection: {
    tile: Game.Query.read(Tile),
    road: Game.Query.optional(Road),
    park: Game.Query.optional(Park),
    house: Game.Query.optional(House),
    tree: Game.Query.optional(Tree),
    rock: Game.Query.optional(Rock),
    water: Game.Query.optional(Water),
    field: Game.Query.optional(Field),
    ruin: Game.Query.optional(Ruin)
  }
})

export const useOf = (data: {
  readonly road: { readonly present: boolean }
  readonly park: { readonly present: boolean }
  readonly house: { readonly present: boolean }
  readonly tree: { readonly present: boolean }
  readonly rock: { readonly present: boolean }
  readonly water: { readonly present: boolean }
  readonly field: { readonly present: boolean }
  readonly ruin: { readonly present: boolean }
}): Use =>
  data.road.present ? "road"
  : data.park.present ? "park"
  : data.house.present ? "house"
  : data.tree.present ? "tree"
  : data.rock.present ? "rock"
  : data.water.present ? "water"
  : data.field.present ? "field"
  : data.ruin.present ? "ruin"
  : "building"

export const connected = (grid: GridValue, tile: TileLike): boolean => doors(grid, tile).length > 0

import { transport } from "../rules/config.ts"
export const CELL_STEPS = transport.cellSteps
export { elapsed, termTicks, yearTicks, winterOf, rollWinters, seasonAt, type Almanac } from "../rules/seasons.ts"

// ── The chronicle ─────────────────────────────────────────────────────────

type Lines = ReadonlyArray<{ readonly tick: number; readonly text: string; readonly alarm: boolean }>
/** A line in the chronicle; an `alarm` is also news the page announces. */
export const write = (
  chronicle: { update: (f: (c: { readonly lines: Lines }) => { lines: Lines }) => void },
  tick: number,
  text: string,
  alarm = false
) => chronicle.update((c) => ({ lines: [...c.lines, { tick, text, alarm }].slice(-200) }))
