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
    for (const { data } of queries.trees.each()) {
      const growth = data.tree.get().growth
      if (growth < GROWN.tree) data.tree.set({ growth: Math.min(GROWN.tree, growth + GROW_TICKS) })
    }
    if (seasonAt(elapsed(resources.time.get(), resources.charter.get()), resources.charter.get(), rules).winter) return
    for (const { data } of queries.fields.each()) {
      const growth = data.field.get().growth
      if (growth < GROWN.field) data.field.set({ growth: Math.min(GROWN.field, growth + GROW_TICKS) })
    }
  }
)
