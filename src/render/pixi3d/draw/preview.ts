import { Game } from "../../../game/schema.ts"
import { Clock, Shown } from "../../../view/services.ts"
import { StageService } from "../services.ts"

/** Ghosts, the road being dragged, and outlines, redrawn every frame. */
export const DrawPreview = Game.System(
  "Town/DrawPreview",
  { services: { shown: Game.System.service(Shown), stage: Game.System.service(StageService), clock: Game.System.service(Clock) } },
  ({ services }) => {
    services.stage.setPreview(services.shown.scene.preview, services.clock.elapsed)
  }
)
