import { every } from "../../content/index.ts"
import { Charter, Field, Game, Rules, Time, Tree } from "../../schema.ts"
import { elapsed, seasonAt } from "../shared.ts"

/** Trees and fields grow until they are ready; fields not in winter. */
export const Grow = Game.System(
  "Town/Grow",
  {
    queries: {
      trees: Game.Query({ selection: { tree: Game.Query.write(Tree) } }),
      fields: Game.Query({ selection: { field: Game.Query.write(Field) } })
    },
    resources: { time: Game.System.readResource(Time), charter: Game.System.readResource(Charter) },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules
    const { grown: GROWN, growTicks: GROW_TICKS } = rules

    if (!every(resources.time.get(), GROW_TICKS)) return
    const trees = queries.trees.data
    for (const entity of queries.trees.each()) {
      const growth = trees.tree.get(entity).growth
      if (growth < GROWN.tree) trees.tree.set(entity, { growth: Math.min(GROWN.tree, growth + GROW_TICKS) })
    }
    if (seasonAt(elapsed(resources.time.get(), resources.charter.get()), resources.charter.get(), rules).winter) return
    const fields = queries.fields.data
    for (const entity of queries.fields.each()) {
      const growth = fields.field.get(entity).growth
      if (growth < GROWN.field) fields.field.set(entity, { growth: Math.min(GROWN.field, growth + GROW_TICKS) })
    }
  }
)
