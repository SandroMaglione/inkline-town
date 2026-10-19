/** Food: the catch and the harvest, and the workshops that smoke, grind, and bake them. */
import { free, type Kinds } from "./kind.ts"

export const food = {
  fishery: {
    id: "fishery", title: "Fishery", blurb: "catches fish; needs its own stretch of water within two cells",
    category: "food", size: 2, half: 10, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 60, materials: { planks: 3 } }, upkeep: 5, workers: 2, crew: "settlers", unlock: free, buildable: true,
    recipe: { input: null, inputs: 0, output: "fish", batch: 1, seconds: 4 }, gathers: { source: "water", radius: 2 }, carriers: 2,
    appeal: { value: -2, reach: 2 }
  },
  smokehouse: {
    id: "smokehouse", title: "Smokehouse", blurb: "smokes fish, which then keeps all winter",
    category: "food", size: 2, half: 10, stories: 1, roof: "gable", bays: 2, window: 4, topper: "chimney",
    cost: { coins: 90, materials: { planks: 4, stone: 1 } }, upkeep: 4, workers: 2, crew: "settlers", unlock: { residents: 20, citizens: 0 }, buildable: true,
    recipe: { input: "fish", inputs: 1, output: "smoked", batch: 1, seconds: 5 }, holds: { accepts: ["fish", "smoked"], cap: 8 }, carriers: 2,
    wear: 60, hot: true, appeal: { value: -4, reach: 3 }
  },
  farm: {
    id: "farm", title: "Farm", blurb: "sows fields around it and harvests the wheat",
    category: "food", size: 3, half: 12, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 120, materials: { planks: 4 } }, upkeep: 5, workers: 2, crew: "settlers", unlock: { residents: 60, citizens: 0 }, buildable: true,
    recipe: { input: null, inputs: 0, output: "wheat", batch: 1, seconds: 4 }, gathers: { source: "field", radius: 2 },
    plants: { what: "field", radius: 2, seconds: 3, max: 8 }, carriers: 2, appeal: { value: -2, reach: 2 },
    upgrade: {
      title: "Estate", blurb: "a barn and a dovecote: a third hand reaps the same fields half again as fast", rank: 2,
      cost: { coins: 250, materials: { planks: 8, stone: 6, tools: 1 } }, upkeep: 7, workers: 3, seconds: 2.5
    }
  },
  mill: {
    id: "mill", title: "Mill", blurb: "grinds wheat into flour",
    category: "food", size: 2, half: 8, stories: 2, roof: "flat", bays: 2, window: 4, topper: "sails",
    cost: { coins: 150, materials: { planks: 6, stone: 2, tools: 1 } }, upkeep: 8, workers: 2, crew: "citizens", unlock: { residents: 60, citizens: 0 }, buildable: true,
    recipe: { input: "wheat", inputs: 1, output: "flour", batch: 1, seconds: 6 }, holds: { accepts: ["wheat", "flour"], cap: 8 }, carriers: 2,
    wear: 60, appeal: { value: -4, reach: 3 }
  },
  bakery: {
    id: "bakery", title: "Bakery", blurb: "bakes flour into bread",
    category: "food", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "chimney",
    cost: { coins: 150, materials: { planks: 4, stone: 4, tools: 1 } }, upkeep: 8, workers: 2, crew: "citizens", unlock: { residents: 60, citizens: 0 }, buildable: true,
    recipe: { input: "flour", inputs: 1, output: "bread", batch: 2, seconds: 6 }, holds: { accepts: ["flour", "bread"], cap: 8 }, carriers: 2,
    wear: 60, hot: true, appeal: { value: -4, reach: 3 },
    upgrade: {
      title: "Ovenworks", blurb: "a second oven and a third baker: bread every four seconds instead of six", rank: 2,
      cost: { coins: 300, materials: { planks: 6, stone: 10, tools: 2 } }, upkeep: 13, workers: 3, seconds: 4
    }
  }
} satisfies Kinds
