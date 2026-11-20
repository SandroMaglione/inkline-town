/** Storage: where the town keeps its goods, nearer where they are made and used. */
import { free, type Kinds } from "./kind.ts"

export const storage = {
  warehouse: {
    id: "warehouse",
    category: "storage", size: 3, half: 18, stories: 1, roof: "flat", bays: 3, window: 6, topper: "crates",
    cost: { coins: 150, materials: { planks: 8, stone: 4 } }, upkeep: 6, workers: 2, crew: "settlers", unlock: free, buildable: true,
    holds: { accepts: "all", cap: 50 }, carriers: 4, appeal: { value: -2, reach: 2 },
    upgrade: {
      rank: 1,
      cost: { coins: 200, materials: { planks: 10, stone: 10 } }, upkeep: 10, cap: 120, carriers: 6
    }
  },
  granary: {
    id: "granary",
    category: "storage", size: 2, half: 11, stories: 2, roof: "flat", bays: 2, window: 4, topper: "none",
    cost: { coins: 120, materials: { planks: 6, stone: 2 } }, upkeep: 4, workers: 1, crew: "settlers", unlock: { residents: 20, citizens: 0 }, buildable: true,
    holds: { accepts: ["fish", "smoked", "bread", "wheat", "flour"], cap: 60 }, carriers: 3, keeps: 5, appeal: { value: -2, reach: 2 }
  }
} satisfies Kinds
