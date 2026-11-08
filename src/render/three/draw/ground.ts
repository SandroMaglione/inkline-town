import { Game, Park, Paved, Road, Tile, Water } from "../../../game/schema.ts"
import { key, type TileLike } from "../../../game/world/grid.ts"
import { ParkRead } from "../../../view/frame.ts"
import { StageService } from "../services.ts"

/** Roads, water, and parks, each redrawn as one layer whenever one is laid or anything is removed. */
export const DrawGround = Game.System(
  "Town/DrawGround",
  {
    queries: {
      roads: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road] }),
      paved: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road, Paved] }),
      water: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Water] }),
      parks: ParkRead,
      /** A tile laid, a road paved, or a park relaid. */
      laid: Game.Query({ selection: {}, filters: [Game.Query.anyOf(Game.Query.added(Tile), Game.Query.added(Paved), Game.Query.changed(Park))] })
    },
    despawned: { entities: Game.System.readDespawned() },
    services: { stage: Game.System.service(StageService) }
  },
  ({ queries, despawned, services }) => {
    const dirty = services.stage.groundDirty
    if (!dirty && queries.laid.each().length === 0 && despawned.entities.all().length === 0) return
    const cellsOf = <E>(query: { each(): ReadonlyArray<E>; readonly data: { readonly tile: { get(entity: E): TileLike } } }) =>
      new Set(query.each().map((entity) => key(query.data.tile.get(entity).x, query.data.tile.get(entity).y)))
    const roads = cellsOf(queries.roads)
    services.stage.setGround(roads, cellsOf(queries.water), cellsOf(queries.paved))
    const parks = queries.parks.data
    services.stage.setParks(new Map(queries.parks.each().map((entity) => [key(parks.tile.get(entity).x, parks.tile.get(entity).y), { ...parks.tile.get(entity), ...parks.park.get(entity) }])), roads)
  }
)
