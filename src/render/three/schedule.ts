/**
 * The renderer's schedule, run once a frame after the view's: the land, the
 * entities' views, the ground layers, the map view, animation, the
 * townsfolk, and the preview, in that order.
 */
import { Game } from "../../game/schema.ts"
import { Animate } from "./draw/animate.ts"
import { DrawGround } from "./draw/ground.ts"
import { DrawLand } from "./draw/land.ts"
import { DrawOverlay } from "./draw/overlay.ts"
import { DrawPreview } from "./draw/preview.ts"
import { Stroll } from "./draw/stroll.ts"
import { RenderBuildings, RenderFields, RenderHouses, RenderRocks, RenderRuins, RenderTrees, RenderWalkers } from "./sync.ts"

export const draw = Game.Schedule(
  DrawLand,
  RenderBuildings,
  RenderHouses,
  RenderWalkers,
  RenderTrees,
  RenderRocks,
  RenderFields,
  RenderRuins,
  DrawGround,
  DrawOverlay,
  Animate,
  Stroll,
  DrawPreview
)
