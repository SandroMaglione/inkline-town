import { GridBuilder, key, roadPrint } from "../../world/grid.ts"
import { Game, Grid, Land, Paved, Tile } from "../../schema.ts"
import { TileRead, useOf } from "../shared.ts"

/**
 * What stands where on the land, for every system after it this step.
 * Tiles never move, so the grid is only rebuilt when one is laid or one of
 * those standing on it goes (a load spawns the whole world again, so it is
 * rebuilt then too).
 */
export const IndexGrid = Game.System(
  "Town/IndexGrid",
  {
    queries: {
      tiles: TileRead,
      /** A tile laid, or a road just paved: the grid's paved cells change without any tile coming or going. */
      laid: Game.Query({ selection: {}, filters: [Game.Query.anyOf(Game.Query.added(Tile), Game.Query.added(Paved))] })
    },
    despawned: { entities: Game.System.readDespawned() },
    resources: { land: Game.System.readResource(Land), grid: Game.System.writeResource(Grid) }
  },
  ({ queries, despawned, resources }) => {
    const known = resources.grid.get().tiles
    const changed = known === undefined || queries.laid.each().length > 0 || despawned.entities.all().some((id) => known.has(id))
    if (!changed) return
    const grid = new GridBuilder(resources.land.get().mask)
    const tiles = new Set<number>()
    const paved = new Set<number>()
    for (const { entity, data } of queries.tiles.each()) {
      const t = data.tile.get()
      grid.claim(t, entity.id, useOf(data))
      tiles.add(entity.id)
      if (data.road.present && data.paved.present) paved.add(key(t.x, t.y))
    }
    const value = grid.value()
    resources.grid.set({ ...value, roads: roadPrint(value), tiles, paved })
  }
)
