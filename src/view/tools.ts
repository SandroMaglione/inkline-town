/**
 * Everything the player can pick, defined once: the map tools, the two
 * panels, the clock, and the map views. Each UI builds its tool bar, binds
 * the keys, and turns a message's "[homes]" or "[view:fire]" into a chip from
 * these tables; adding one here is the whole change.
 */
import { costText, home, PAVE_COST, PAVED_PACE, ROAD_COST } from "../game/content/index.ts"
import type { Tool, View } from "./contracts.ts"
import type { IconName } from "./icons.ts"

/** What picking a command does: picks a map tool, opens a panel, or works the clock. */
export type Action = { readonly tool: Tool } | { readonly menu: "build" | "town" } | { readonly clock: "speed" | "pause" }

export interface Command {
  readonly label: string
  readonly icon: IconName
  /** Its key, as a keyboard shows it ("S", "space"); none for the speed. */
  readonly key?: string
  /** What it does, in a line: a chip's tooltip. */
  readonly title: string
  readonly action: Action
}

export const commands = {
  select: { label: "select", icon: "select", key: "S", title: "Select: pick a building or home to see what it does", action: { tool: "select" } },
  road: { label: "road", icon: "road", key: "R", title: "Road: drag to lay one", action: { tool: "road" } },
  pave: { label: "pave", icon: "pave", key: "P", title: "Pave: drag along a road to pave it", action: { tool: "pave" } },
  homes: { label: "homes", icon: "homes", key: "H", title: "Homes: drag along a road to lay a row", action: { tool: "home" } },
  build: { label: "build", icon: "build", key: "B", title: "Open the build menu", action: { menu: "build" } },
  bulldoze: { label: "bulldoze", icon: "bulldoze", key: "X", title: "Bulldoze: remove what stands on a cell", action: { tool: "bulldoze" } },
  town: { label: "town", icon: "town", key: "T", title: "Open the town panel: goals, taxes, and trade", action: { menu: "town" } },
  speed: { label: "speed", icon: "clock", title: "Run time faster: 1×, 2×, 4×", action: { clock: "speed" } },
  pause: { label: "pause", icon: "pause", key: "space", title: "Pause the town, or run it again", action: { clock: "pause" } }
} as const satisfies Record<string, Command>
export type CommandId = keyof typeof commands

/** The tool bar's tools, in order, with what each says on hover there. */
export const toolbar: ReadonlyArray<{ readonly id: CommandId; readonly tip: string }> = [
  { id: "select", tip: "Click a building or home to see what it does · drag to pan · wheel to zoom" },
  { id: "road", tip: `Drag to lay a road · ${ROAD_COST} coins a cell` },
  {
    id: "pave",
    tip: `Drag along a road to pave it: carriers and walkers go ${PAVED_PACE}× as fast on it, and homes beside it like it · ${PAVE_COST.coins} coins and ${PAVE_COST.stone} stone a cell`
  },
  { id: "homes", tip: `Drag to lay a row of homes along a road · ${costText(home.cost)} each` },
  { id: "build", tip: "Choose a building, then click to place it · Esc to stop" },
  { id: "bulldoze", tip: "Click a building, home, road, tree, or field to remove it" }
]

export interface MapView {
  readonly label: string
  readonly icon: IconName
  readonly key: string
}

/** The map views, in order: the list and the "[view:…]" chips both come from here. */
export const mapViews = {
  appeal: { label: "desirability", icon: "appeal", key: "D" },
  workers: { label: "workers", icon: "workers", key: "W" },
  fire: { label: "fire", icon: "fire", key: "F" },
  health: { label: "health", icon: "health", key: "A" },
  order: { label: "order", icon: "order", key: "O" },
  condition: { label: "condition", icon: "condition", key: "C" }
} as const satisfies Record<Exclude<View, "none">, MapView>
export type MapViewId = keyof typeof mapViews

/** What a map view's chip says: "fire map", and what it colours the map by. */
const viewTitles: Readonly<Record<MapViewId, string>> = {
  appeal: "Colour the map by desirability",
  workers: "Colour the map by workers",
  fire: "Colour the map by fire risk",
  health: "Colour the map by health risk",
  order: "Colour the map by the risk of theft",
  condition: "Colour the map by the condition of buildings"
}

/** A reference a message can name in brackets: a command ("[homes]") or a map view ("[view:fire]"). */
export type Ref = { readonly command: CommandId } | { readonly view: MapViewId }

const isView = (name: string): name is MapViewId => name in mapViews
const isCommand = (name: string): name is CommandId => name in commands

export const refOf = (name: string): Ref | null => {
  if (name.startsWith("view:")) {
    const view = name.slice(5)
    return isView(view) ? { view } : null
  }
  return isCommand(name) ? { command: name } : null
}

/** How a reference shows as a chip: its label, icon, key, and tooltip. */
export const refLook = (ref: Ref): { readonly label: string; readonly icon: IconName; readonly key: string | undefined; readonly title: string } => {
  if ("view" in ref) {
    const v = mapViews[ref.view]
    return { label: `${v.label} map`, icon: v.icon, key: v.key, title: viewTitles[ref.view] }
  }
  const c: Command = commands[ref.command]
  return { label: c.label, icon: c.icon, key: c.key, title: c.title }
}
