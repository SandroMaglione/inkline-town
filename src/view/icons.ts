/**
 * Every icon the view can name. The view says which icon a line or a tool
 * shows; each UI draws them its own way (the page: `ui/dom/kit/icons.ts`,
 * which must draw every one).
 */
import type { GoodId } from "../game/content/index.ts"

export const iconIds = [
  "coins", "settlers", "citizens", "people", "jobs", "approval", "clock", "winter", "summer", "crown", "hint", "caution", "locate", "warning", "goal",
  "faith", "food", "trade", "treasury", "taxes", "chronicle", "select", "road", "homes", "build", "bulldoze", "town", "pause", "play", "save", "load",
  "newTown", "close", "more", "layers", "share", "picture", "link", "info", "upkeep", "burghers", "decor", "pave", "fire", "health", "order", "repair",
  "appeal", "condition", "view", "workers"
] as const
/** An icon: one of the town's own, or a good's. */
export type IconName = (typeof iconIds)[number] | GoodId
