import { seasonAt, elapsed, termTicks } from "../../../game/schedule.ts"
import { Charter, Fate, Game, Land, Time } from "../../../game/schema.ts"
import { StageService } from "../services.ts"

/** The land, redrawn when a new town is founded (or one loaded), and frosted through winter. */
export const DrawLand = Game.System(
  "Town/DrawLand",
  {
    resources: { land: Game.System.readResource(Land), time: Game.System.readResource(Time), charter: Game.System.readResource(Charter), fate: Game.System.readResource(Fate) },
    services: { stage: Game.System.service(StageService) }
  },
  ({ resources, services }) => {
    const mask = resources.land.get().mask
    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    services.stage.setLand(mask, t > 0 && seasonAt(Math.min(t, resources.fate.get().began + termTicks(charter) - 1), charter).winter)
  }
)
