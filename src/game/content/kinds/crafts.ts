/** Crafts: the workshops that turn wood, ore, and wool into planks, tools, cloth, and furniture. */
import { free, type Kinds } from "./kind.ts"

export const crafts = {
  sawmill: {
    id: "sawmill", title: "Sawmill", blurb: "saws wood into planks",
    category: "crafts", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "chimney",
    cost: { coins: 100, materials: { planks: 2, stone: 2 } }, upkeep: 6, workers: 2, crew: "citizens", unlock: free, buildable: true,
    recipe: { input: "wood", inputs: 1, output: "planks", batch: 1, seconds: 5 }, holds: { accepts: ["wood", "planks"], cap: 8 }, carriers: 2,
    wear: 60, appeal: { value: -4, reach: 3 }
  },
  smithy: {
    id: "smithy", title: "Smithy", blurb: "forges ore into tools",
    category: "crafts", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "chimney",
    cost: { coins: 250, materials: { planks: 4, stone: 6 } }, upkeep: 12, workers: 3, crew: "citizens", unlock: { residents: 0, citizens: 10 }, buildable: true,
    recipe: { input: "ore", inputs: 1, output: "tools", batch: 1, seconds: 10 }, holds: { accepts: ["ore", "tools"], cap: 8 }, carriers: 2,
    hot: true, appeal: { value: -8, reach: 4 }
  },
  sheep: {
    id: "sheep", title: "Sheep farm", blurb: "shears sheep for wool",
    category: "crafts", size: 3, half: 12, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 100, materials: { planks: 4 } }, upkeep: 5, workers: 2, crew: "settlers", unlock: { residents: 40, citizens: 0 }, buildable: true,
    recipe: { input: null, inputs: 0, output: "wool", batch: 1, seconds: 6 }, carriers: 2, appeal: { value: -2, reach: 2 }
  },
  weaver: {
    id: "weaver", title: "Weaver", blurb: "weaves wool into cloth",
    category: "crafts", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "none",
    cost: { coins: 150, materials: { planks: 4, stone: 2, tools: 1 } }, upkeep: 8, workers: 2, crew: "citizens", unlock: { residents: 40, citizens: 0 }, buildable: true,
    recipe: { input: "wool", inputs: 1, output: "cloth", batch: 1, seconds: 6 }, holds: { accepts: ["wool", "cloth"], cap: 8 }, carriers: 2,
    wear: 60, appeal: { value: -2, reach: 2 }
  },
  carpenter: {
    id: "carpenter", title: "Carpenter", blurb: "makes furniture from planks, for the burghers' townhouses",
    category: "crafts", size: 2, half: 12, stories: 1, roof: "gable", bays: 2, window: 4, topper: "chimney",
    cost: { coins: 160, materials: { planks: 4, stone: 2, tools: 1 } }, upkeep: 8, workers: 2, crew: "citizens", unlock: { residents: 0, citizens: 20 }, buildable: true,
    recipe: { input: "planks", inputs: 2, output: "furniture", batch: 1, seconds: 8 }, holds: { accepts: ["planks", "furniture"], cap: 8 }, carriers: 2,
    wear: 60, appeal: { value: -2, reach: 2 }
  }
} satisfies Kinds
