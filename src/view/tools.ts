/**
 * Everything the player can pick, defined once: the map tools, the two
 * panels, the clock, and the map views. Each UI builds its tool bar, binds
 * the keys, and turns a message's "[homes]" or "[view:fire]" into a chip from
 * these tables; adding one here is the whole change, but for its words:
 * what each is called and says on hover is the language's (`i18n`:
 * `commands`, `toolbar`, `mapViews`), which does not compile until it
 * names every one.
 */
import type { Tool, View } from "./contracts.ts"
import type { IconName } from "./icons.ts"

/** What picking a command does: picks a map tool, opens a panel, or works the clock. */
export type Action = { readonly tool: Tool } | { readonly menu: "build" | "town" } | { readonly clock: "speed" | "pause" }

export interface Command {
  readonly icon: IconName
  /** Its key, as a keyboard shows it ("S", "space"); none for the speed. */
  readonly key?: string
  readonly action: Action
}

export const commands = {
  select: { icon: "select", key: "S", action: { tool: "select" } },
  road: { icon: "road", key: "R", action: { tool: "road" } },
  pave: { icon: "pave", key: "P", action: { tool: "pave" } },
  homes: { icon: "homes", key: "H", action: { tool: "home" } },
  build: { icon: "build", key: "B", action: { menu: "build" } },
  bulldoze: { icon: "bulldoze", key: "X", action: { tool: "bulldoze" } },
  town: { icon: "town", key: "T", action: { menu: "town" } },
  speed: { icon: "clock", action: { clock: "speed" } },
  pause: { icon: "pause", key: "space", action: { clock: "pause" } }
} as const satisfies Record<string, Command>
export type CommandId = keyof typeof commands

/** The tool bar's tools, in order. */
export const toolbar = ["select", "road", "pave", "homes", "build", "bulldoze"] as const satisfies ReadonlyArray<CommandId>
export type ToolbarId = (typeof toolbar)[number]

export interface MapView {
  readonly icon: IconName
  readonly key: string
}

/** The map views, in order: the list and the "[view:…]" chips both come from here. */
export const mapViews = {
  appeal: { icon: "appeal", key: "D" },
  workers: { icon: "workers", key: "W" },
  fire: { icon: "fire", key: "F" },
  health: { icon: "health", key: "A" },
  order: { icon: "order", key: "O" },
  condition: { icon: "condition", key: "C" }
} as const satisfies Record<Exclude<View, "none">, MapView>
export type MapViewId = keyof typeof mapViews

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
