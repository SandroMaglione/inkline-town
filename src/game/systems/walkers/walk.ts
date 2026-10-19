import { transport } from "../../rules/config.ts"
import { isRoad, key } from "../../world/grid.ts"
import { Game, Rules, Grid, Rescue, Route, Time } from "../../schema.ts"
import { CELL_STEPS } from "../shared.ts"
import { paced } from "../work/index.ts"

/** Steps a walker takes each tick: 1.25 cells a second. */
const WALK = transport.walk
/** Firefighters run to a blaze. */
const RUN = transport.run

/**
 * Every walker steps along its route (a firefighter on the way to a blaze
 * runs, and anyone on a paved street goes `pavedPace` as fast); one whose
 * next cell is no longer road is lost.
 */
export const Walk = Game.System(
  "Town/Walk",
  {
    queries: { walkers: Game.Query({ selection: { route: Game.Query.write(Route), rescue: Game.Query.optional(Rescue) } }) },
    resources: { grid: Game.System.readResource(Grid), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.despawns(Route))
  },
  ({ queries, resources, commands, services }) => {
    const grid = resources.grid.get()
    const tick = resources.time.get().step
    const quicker = services.rules.pavedPace - 1
    for (const { entity, data } of queries.walkers.each()) {
      const route = data.route.get()
      const last = route.cells.length - 1
      if (route.index >= last) continue
      const next = route.cells[route.index + 1]!
      if (!isRoad(grid, next.x, next.y)) {
        commands.despawn(entity)
        continue
      }
      const running = data.rescue.present && !data.rescue.get().back
      const paved = !running && quicker > 0 && (grid.paved?.has(key(next.x, next.y)) ?? false) && paced(quicker, tick)
      const step = route.step + (running ? RUN : WALK) + (paved ? 1 : 0)
      if (step < CELL_STEPS) data.route.set({ ...route, step })
      else {
        const index = route.index + 1
        data.route.set({ ...route, index, step: index >= last ? 0 : step - CELL_STEPS })
      }
    }
  }
)
