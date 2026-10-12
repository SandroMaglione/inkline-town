/** Queries and small helpers the simulation's systems share. */
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
