import { Game, Grid, Land } from "../../../game/schema.ts"
import { HouseRead } from "../../../view/frame.ts"
import { Clock, Shown } from "../../../view/services.ts"
import { StageService } from "../services.ts"
import { Townsfolk } from "../townsfolk.ts"

/** Residents out walking (see `townsfolk.ts`), on the town's time: still while it waits. */
let townsfolk: { readonly folk: Townsfolk; land: string; generation: number; stage: unknown } | null = null
export const Stroll = Game.System(
  "Town/Stroll",
  {
    queries: { houses: HouseRead },
    resources: { grid: Game.System.readResource(Grid), land: Game.System.readResource(Land) },
    services: { shown: Game.System.service(Shown), clock: Game.System.service(Clock), stage: Game.System.service(StageService) }
  },
  ({ queries, resources, services }) => {
    if (townsfolk?.stage !== services.stage) {
      townsfolk?.folk.clear()
      townsfolk = { folk: new Townsfolk(services.stage), land: "", generation: -1, stage: services.stage }
    }
    const mask = resources.land.get().mask
    if (mask !== townsfolk.land || townsfolk.generation !== services.stage.generation) {
      townsfolk.generation = services.stage.generation
      townsfolk.land = mask
      townsfolk.folk.clear()
    }
    const { data } = queries.houses
    const homes = queries.houses
      .each()
      .filter((entity) => !data.site.get(entity) && !data.rising.get(entity))
      .map((entity) => ({ ...data.tile.get(entity), tier: data.house.get(entity).tier, residents: data.house.get(entity).residents }))
    townsfolk.folk.step(services.clock.deltaSeconds * services.shown.scene.pace, homes, resources.grid.get())
  }
)
