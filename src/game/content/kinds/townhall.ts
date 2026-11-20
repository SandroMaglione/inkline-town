/** The town hall: the heart of the town, founded with it and never built. */
import { free, type Kinds } from "./kind.ts"

export const townHall = {
  townhall: {
    id: "townhall",
    category: "storage", size: 3, half: 20, stories: 2, roof: "flat", bays: 2, window: 8, topper: "flag",
    cost: { coins: 0, materials: {} }, upkeep: 0, workers: 0, crew: "settlers", unlock: free, buildable: false,
    holds: { accepts: "all", cap: 100 }, carriers: 6,
    service: { service: "goods", seconds: 8, range: 20 }, appeal: { value: 4, reach: 4, full: 2 },
    upgrade: {
      rank: 1,
      cost: { coins: 500, materials: { planks: 30, stone: 40, tools: 6 } }, upkeep: 8,
      cap: 200, carriers: 8, service: { seconds: 6, range: 26 }, appeal: { value: 6, reach: 5, full: 2 }, admin: 0.1,
      next: {
        rank: 2,
        cost: { coins: 1200, materials: { planks: 50, stone: 80, tools: 15, cloth: 20 } }, upkeep: 16,
        cap: 300, carriers: 10, service: { seconds: 5, range: 32 }, appeal: { value: 8, reach: 6, full: 3 }, admin: 0.2
      }
    }
  }
} satisfies Kinds
