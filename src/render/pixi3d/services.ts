/**
 * The Three.js renderer's host services: its scene, and a registry of views
 * for each kind of entity it mirrors (see `sync.ts`).
 */
import { Descriptor } from "@typeonce/ritmo"
import type { NodeRegistry } from "@typeonce/ritmo-render"

import type { GameScene } from "./scene.ts"
import type { BuildingView, FieldView, HouseView, RockView, RuinView, TreeView, WalkerView } from "./views.ts"

export const StageService = Descriptor.Service<GameScene>()("Town/Stage")
export const BuildingNodes = Descriptor.Service<NodeRegistry.NodeRegistry<BuildingView>>()("Town/BuildingNodes")
export const HouseNodes = Descriptor.Service<NodeRegistry.NodeRegistry<HouseView>>()("Town/HouseNodes")
export const WalkerNodes = Descriptor.Service<NodeRegistry.NodeRegistry<WalkerView>>()("Town/WalkerNodes")
export const TreeNodes = Descriptor.Service<NodeRegistry.NodeRegistry<TreeView>>()("Town/TreeNodes")
export const RockNodes = Descriptor.Service<NodeRegistry.NodeRegistry<RockView>>()("Town/RockNodes")
export const FieldNodes = Descriptor.Service<NodeRegistry.NodeRegistry<FieldView>>()("Town/FieldNodes")
export const RuinNodes = Descriptor.Service<NodeRegistry.NodeRegistry<RuinView>>()("Town/RuinNodes")
