/** Storage: where the town keeps its goods, nearer where they are made and used. */
import { free, type Kinds } from "./kind.ts"

export const storage = {
  warehouse: {
    id: "warehouse", title: "Warehouse", blurb: "stores goods nearer where they are made and used",
    category: "storage", size: 3, half: 18, stories: 1, roof: "flat", bays: 3, window: 6, topper: "crates",
    cost: { coins: 150, materials: { planks: 8, stone: 4 } }, upkeep: 6, workers: 2, crew: "settlers", unlock: free, buildable: true,
    holds: { accepts: "all", cap: 50 }, carriers: 4, appeal: { value: -2, reach: 2 },
    upgrade: {
      title: "Depot", blurb: "a loading yard and a hoist: it holds more than twice as much, and sends two more carriers", rank: 1,
      cost: { coins: 200, materials: { planks: 10, stone: 10 } }, upkeep: 10, cap: 120, carriers: 6
    }
  },
  granary: {
    id: "granary", title: "Granary", blurb: "stores food, and keeps fish and bread five times as long",
    category: "storage", size: 2, half: 11, stories: 2, roof: "flat", bays: 2, window: 4, topper: "none",
    cost: { coins: 120, materials: { planks: 6, stone: 2 } }, upkeep: 4, workers: 1, crew: "settlers", unlock: { residents: 20, citizens: 0 }, buildable: true,
    holds: { accepts: ["fish", "smoked", "bread", "wheat", "flour"], cap: 60 }, carriers: 3, keeps: 5, appeal: { value: -2, reach: 2 }
  }
} satisfies Kinds
