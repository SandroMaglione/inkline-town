import { every } from "../../content/index.ts"
import { wildTreeSpots, canSeedTree } from "../../rules/land.ts"
import * as Random from "@typeonce/ritmo/Random"
import { treeDraft } from "../../world/archetypes.ts"
import { Game, Rules, Grid, Rng, Tile, Time, Tree } from "../../schema.ts"

/**
 * Wild forests regrow: now and then a grown tree seeds an empty cell beside
 * it, but only one that already has two trees around it, so forests fill
 * back in and creep at their edges without seeding the open town. A cleared
 * patch needs a forester.
 */
export const Spread = Game.System(
  "Town/Spread",
  {
    queries: { trees: Game.Query({ selection: { tile: Game.Query.read(Tile), tree: Game.Query.read(Tree) } }) },
    resources: { grid: Game.System.readResource(Grid), rng: Game.System.writeResource(Rng), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.spawns(Tree))
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { grown: GROWN, spreadTicks: SPREAD_TICKS } = rules

    if (!every(resources.time.get(), SPREAD_TICKS)) return
    const grid = resources.grid.get()
    const random = Random.draw(resources.rng)
    const grown = queries.trees.each().filter(({ data }) => data.tree.get().growth >= GROWN.tree)
    const parent = random.pick(grown)
    if (parent) {
      const t = parent.data.tile.get()
      const spot = random.pick(wildTreeSpots(grid, t))
      if (spot && canSeedTree(grid, spot)) commands.spawn(treeDraft(spot, 0))
    }
  }
)
