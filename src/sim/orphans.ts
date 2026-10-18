/**
 * A walker or a field is spawned already belonging to the building that sent
 * or sowed it. When that building went in the same step (burnt down while
 * sending its firefighters, say), the belonging fails and the newcomer would
 * stay behind with no home: it goes too, as it would have with its building.
 */
import { Field, Game, Route, FieldOf, WalkerOf } from "../schema.ts"

export const DropOrphans = Game.System(
  "Town/DropOrphans",
  {
    queries: {
      walkers: Game.Query({ selection: { route: Game.Query.read(Route) } }),
      fields: Game.Query({ selection: { field: Game.Query.read(Field) } })
    },
    relationFailures: {
      walkers: Game.System.readRelationFailures(WalkerOf),
      fields: Game.System.readRelationFailures(FieldOf)
    },
    commands: Game.System.commands(Game.System.despawns(Route, Field))
  },
  ({ queries, relationFailures, commands }) => {
    for (const failure of relationFailures.walkers.all()) {
      if (failure.operation !== "relate") continue
      const walker = queries.walkers.get(failure.source)
      if (walker.ok) commands.despawn(walker.value.entity)
    }
    for (const failure of relationFailures.fields.all()) {
      if (failure.operation !== "relate") continue
      const field = queries.fields.get(failure.source)
      if (field.ok) commands.despawn(field.value.entity)
    }
  }
)
