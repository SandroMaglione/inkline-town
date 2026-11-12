/**
 * The world's entities mirrored into the Three.js scene: a view for each
 * building, home, walker, tree, rock, ruin, and field, made when it appears,
 * placed on its tile, and removed when it goes (see `@typeonce/ritmo-render`).
 *
 * A node is made again whenever its renderable takes a new value, so homes,
 * trees, rocks, and fields (whose components change as they fill, grow, and
 * are worked) are keyed by their `Tile`, which never changes, and selected
 * by their own component; `Animate` draws what changes on them each frame.
 */
import { RenderSync } from "@typeonce/ritmo-render"

import { Building, Field, Figure, Game, House, Rock, Ruin, Tile, Tree } from "../../game/schema.ts"
import { BuildingNodes, FieldNodes, HouseNodes, RockNodes, RuinNodes, StageService, TreeNodes, WalkerNodes } from "./services.ts"
import { BuildingView, FieldView, HouseView, RockView, RuinView, TreeView, WalkerView } from "./views.ts"

export const RenderBuildings = RenderSync.system(Game, {
  name: "Town/RenderBuildings",
  renderable: Building,
  transform: Tile,
  registry: BuildingNodes,
  services: { stage: StageService },
  create: ({ renderable, services, entity }) => new BuildingView(renderable.kind, services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderHouses = RenderSync.system(Game, {
  name: "Town/RenderHouses",
  renderable: Tile,
  select: { house: Game.Query.read(House) },
  transform: Tile,
  registry: HouseNodes,
  services: { stage: StageService },
  create: ({ services, entity }) => new HouseView(services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderWalkers = RenderSync.system(Game, {
  name: "Town/RenderWalkers",
  renderable: Figure,
  registry: WalkerNodes,
  services: { stage: StageService },
  create: ({ renderable, services, entity }) => WalkerView.forFigure(renderable.role, renderable.color, services.stage, entity),
  apply: () => {}
})

export const RenderTrees = RenderSync.system(Game, {
  name: "Town/RenderTrees",
  renderable: Tile,
  select: { tree: Game.Query.read(Tree) },
  transform: Tile,
  registry: TreeNodes,
  services: { stage: StageService },
  create: ({ services, entity }) => new TreeView(services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderRocks = RenderSync.system(Game, {
  name: "Town/RenderRocks",
  renderable: Tile,
  select: { rock: Game.Query.read(Rock) },
  transform: Tile,
  registry: RockNodes,
  services: { stage: StageService },
  create: ({ services, entity }) => new RockView(services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderRuins = RenderSync.system(Game, {
  name: "Town/RenderRuins",
  renderable: Ruin,
  transform: Tile,
  registry: RuinNodes,
  services: { stage: StageService },
  create: ({ renderable, services, entity }) => new RuinView(renderable.cause, services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y, transform.size)
})

export const RenderFields = RenderSync.system(Game, {
  name: "Town/RenderFields",
  renderable: Tile,
  select: { field: Game.Query.read(Field) },
  transform: Tile,
  registry: FieldNodes,
  services: { stage: StageService },
  create: ({ services, entity }) => new FieldView(services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})
