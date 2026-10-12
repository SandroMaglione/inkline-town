/** Queries and small helpers the simulation's systems share. */
import { ticks, WINTER_SHARE, YEARS_PER_TERM } from "../content.ts"
import { doors, type TileLike, type Use } from "../grid.ts"
import { Field, Game, House, Road, Rock, Tile, Tree, Water, type GridValue } from "../schema.ts"

/** Every tile, with enough to tell what it is. */
export const TileRead = Game.Query({
  selection: {
    tile: Game.Query.read(Tile),
    road: Game.Query.optional(Road),
    house: Game.Query.optional(House),
    tree: Game.Query.optional(Tree),
    rock: Game.Query.optional(Rock),
    water: Game.Query.optional(Water),
    field: Game.Query.optional(Field)
  }
})

export const useOf = (data: {
  readonly road: { readonly present: boolean }
  readonly house: { readonly present: boolean }
  readonly tree: { readonly present: boolean }
  readonly rock: { readonly present: boolean }
  readonly water: { readonly present: boolean }
  readonly field: { readonly present: boolean }
}): Use =>
  data.road.present ? "road"
  : data.house.present ? "house"
  : data.tree.present ? "tree"
  : data.rock.present ? "rock"
  : data.water.present ? "water"
  : data.field.present ? "field"
  : "building"

export const connected = (grid: GridValue, tile: TileLike): boolean => doors(grid, tile).length > 0

/** A walker's steps from one cell's centre to the next: three to a unit, so it moves on the lattice. */
export const CELL_STEPS = 48

// ── Time ──────────────────────────────────────────────────────────────────

/** Steps since the town was founded. */
export const elapsed = (time: { readonly tick: number }, charter: { readonly founded: number }) => time.tick - charter.founded
export const termTicks = (charter: { readonly term: number }) => ticks(charter.term * 60)
export const yearTicks = (charter: { readonly term: number }) => Math.round(termTicks(charter) / YEARS_PER_TERM)

/**
 * The season `t` steps into a term: which year, whether it is winter, and
 * how long until that changes. The first year is spared its winter: a new
 * town has a year to find its feet.
 */
export const seasonAt = (t: number, charter: { readonly term: number }) => {
  const year = yearTicks(charter)
  const into = t % year
  const thaw = Math.round(year * (1 - WINTER_SHARE))
  const number = Math.floor(t / year) + 1
  const winter = number > 1 && into >= thaw
  const left = winter ? year - into : number === 1 ? year + thaw - into : into >= thaw ? year + thaw - into : thaw - into
  return { year: number, winter, left }
}

