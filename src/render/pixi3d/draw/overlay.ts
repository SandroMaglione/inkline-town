import { Game } from "../../../game/schema.ts"
import { Shown } from "../../../view/services.ts"
import { StageService } from "../services.ts"

/** The map view, washed over the town. */
export const DrawOverlay = Game.System(
  "Town/DrawOverlay",
  { services: { shown: Game.System.service(Shown), stage: Game.System.service(StageService) } },
  ({ services }) => {
    services.stage.setOverlay(services.shown.scene.overlay.key, services.shown.scene.overlay.cells)
  }
)
