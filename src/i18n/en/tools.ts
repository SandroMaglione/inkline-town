/**
 * English for what the player can pick (`view/tools.ts`): what each tool,
 * panel, and map view is called, what its chip says on hover, and what the
 * tool bar says of each tool.
 */
import { home, PAVE_COST, PAVED_PACE, ROAD_COST } from "../../game/content/index.ts"
import type { CommandId, MapViewId, ToolbarId } from "../../view/tools.ts"
import * as token from "../token.ts"
import { cost } from "./said.ts"

/** A command: its label on a button or a chip, and what it does, in a line. */
export const commands = {
  select: { label: "select", title: "Select: pick a building or home to see what it does" },
  road: { label: "road", title: "Road: drag to lay one" },
  pave: { label: "pave", title: "Pave: drag along a road to pave it" },
  homes: { label: "homes", title: "Homes: drag along a road to lay a row" },
  build: { label: "build", title: "Open the build menu" },
  bulldoze: { label: "bulldoze", title: "Bulldoze: remove what stands on a cell" },
  town: { label: "town", title: "Open the town panel: goals, taxes, and trade" },
  speed: { label: "speed", title: "Run time faster: 1×, 2×, 4×" },
  pause: { label: "pause", title: "Pause the town, or run it again" }
} satisfies Record<CommandId, { readonly label: string; readonly title: string }>

/** What the tool bar says of each tool on hover. */
export const toolbar = {
  select: "Click a building or home to see what it does · drag to pan · wheel to zoom",
  road: `Drag to lay a road · ${token.coins(ROAD_COST)} a cell`,
  pave: `Drag along a road to pave it: carriers and walkers go ${PAVED_PACE}× as fast on it, and homes beside it like it · ${token.coins(PAVE_COST.coins)} and ${token.amount("stone", PAVE_COST.stone)} a cell`,
  homes: `Drag to lay a row of homes along a road · ${cost(home.cost)} each`,
  build: "Choose a building, then click to place it · Esc to stop",
  bulldoze: "Click a building, home, road, tree, or field to remove it"
} satisfies Record<ToolbarId, string>

/** A map view: what it is called in the list, on a chip ("fire map"), and what it colours the map by. */
export const mapViews = {
  appeal: { label: "desirability", chip: "desirability map", title: "Colour the map by desirability" },
  workers: { label: "workers", chip: "workers map", title: "Colour the map by workers" },
  fire: { label: "fire", chip: "fire map", title: "Colour the map by fire risk" },
  health: { label: "health", chip: "health map", title: "Colour the map by health risk" },
  order: { label: "order", chip: "order map", title: "Colour the map by the risk of theft" },
  condition: { label: "condition", chip: "condition map", title: "Colour the map by the condition of buildings" }
} satisfies Record<MapViewId, { readonly label: string; readonly chip: string; readonly title: string }>
