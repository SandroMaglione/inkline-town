import * as Random from "@typeonce/ritmo/Random"
import { fieldDraft, treeDraft } from "../../world/archetypes.ts"
import { around, key, useAt } from "../../world/grid.ts"
import { Field, FieldOf, Game, Rules, Grid, Paused, Planter, Recipe, Rising, Rng, Site, Staff, Status, Tile, Time, Tree, type Status as StatusValue } from "../../schema.ts"
import { connected } from "../shared.ts"

/** A forester plants trees and a farm sows fields on free ground within reach, one at a time. */
export const Plant = Game.System(
  "Town/Plant",
  {
    queries: {
      planters: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          staff: Game.Query.read(Staff),
          planter: Game.Query.write(Planter),
          status: Game.Query.write(Status),
          recipe: Game.Query.optional(Recipe),
          paused: Game.Query.optional(Paused)
        },
        without: [Site, Rising]
      })
    },
    resources: { grid: Game.System.readResource(Grid), rng: Game.System.writeResource(Rng), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.spawns(Tree, Field), Game.System.relates(FieldOf))
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { staffTicks: STAFF_TICKS } = rules

    const grid = resources.grid.get()
    const random = Random.draw(resources.rng)
    const sown = new Set<number>()
    const tick = resources.time.get().step
    for (const { entity, data } of queries.planters.each()) {
      const tile = data.tile.get()
      const staff = data.staff.get()
      const planter = data.planter.get()
      // While it waits to plant again, it only counts down (and looks around twice a second for its status).
      if (planter.cooldown > 1 && tick % STAFF_TICKS !== 0) {
        data.planter.set({ ...planter, cooldown: planter.cooldown - 1 })
        continue
      }
      const open = connected(grid, tile)
      const reach = around(tile, planter.radius)
      const grown = reach.filter((c) => useAt(grid, c.x, c.y) === planter.what).length
      const spots = reach.filter((c) => useAt(grid, c.x, c.y) === "empty" && !sown.has(key(c.x, c.y)))
      // A forester has no recipe of its own: its status is its planting.
      if (!data.recipe.value()) {
        const status: StatusValue = data.paused.present ? "paused" : !open ? "unconnected" : staff.assigned === 0 ? "unstaffed" : grown < planter.max && spots.length > 0 ? "working" : "idle"
        if (data.status.get() !== status) data.status.set(status)
      }
      const cooldown = Math.max(0, planter.cooldown - 1)
      if (cooldown > 0 || !open || staff.assigned === 0 || grown >= planter.max || spots.length === 0) {
        if (cooldown !== planter.cooldown) data.planter.set({ ...planter, cooldown })
        continue
      }
      const spot = random.pick(spots)!
      sown.add(key(spot.x, spot.y))
      if (planter.what === "tree") commands.spawn(treeDraft(spot, 0))
      else commands.spawn(Game.Command.relate(fieldDraft(spot), FieldOf, entity.id))
      data.planter.set({ ...planter, cooldown: planter.interval })
    }
  }
)
