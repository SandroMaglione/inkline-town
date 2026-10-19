/** Services: the buildings that send a walker down the roads to the homes along the way. */
import { free, type Kinds } from "./kind.ts"

export const services = {
  market: {
    id: "market", title: "Market", blurb: "a walker carries fish, bread, cloth, and furniture to the homes it passes",
    category: "services", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "flag",
    cost: { coins: 120, materials: { planks: 6, stone: 2 } }, upkeep: 6, workers: 2, crew: "citizens", unlock: free, buildable: true,
    holds: { accepts: ["fish", "smoked", "bread", "cloth", "furniture"], cap: 12 },
    service: { service: "goods", seconds: 6, range: 18 }, appeal: { value: 2, reach: 3, full: 2 },
    upgrade: {
      title: "Market hall", blurb: "a covered hall: its walker goes further, more often, and the street around it is finer", rank: 2,
      cost: { coins: 400, materials: { planks: 6, stone: 12, tools: 2 } }, upkeep: 12,
      service: { seconds: 4, range: 26 }, appeal: { value: 4, reach: 4, full: 2 }
    }
  },
  chapel: {
    id: "chapel", title: "Chapel", blurb: "a walker brings faith to the homes it passes",
    category: "services", size: 2, half: 12, stories: 2, roof: "flat", bays: 2, window: 6, topper: "cupola",
    cost: { coins: 200, materials: { planks: 6, stone: 6 } }, upkeep: 10, workers: 1, crew: "citizens", unlock: { residents: 40, citizens: 0 }, buildable: true,
    service: { service: "faith", seconds: 8, range: 22 }, appeal: { value: 4, reach: 4, full: 2 },
    upgrade: {
      title: "Church", blurb: "a church with a tower: its priest walks further, more often, and the streets around it are the finest", rank: 2,
      cost: { coins: 700, materials: { planks: 8, stone: 20, tools: 3 } }, upkeep: 18,
      service: { seconds: 6, range: 30 }, appeal: { value: 6, reach: 5, full: 3 }
    }
  },
  firewatch: {
    id: "firewatch", title: "Fire watch", blurb: "a watchman checks homes and workshops along the way for fire; firefighters run to any blaze",
    category: "services", size: 2, half: 9, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 70, materials: { planks: 3 } }, upkeep: 3, workers: 2, crew: "settlers", unlock: free, buildable: true,
    service: { service: "fire", seconds: 7, range: 30 },
    upgrade: {
      title: "Fire brigade", blurb: "a bell tower and a pump: its watchman walks further, more often, and four firefighters run instead of two", rank: 2,
      cost: { coins: 200, materials: { planks: 6, stone: 6, tools: 1 } }, upkeep: 5, service: { seconds: 5, range: 36 }, crews: 4
    }
  },
  healer: {
    id: "healer", title: "Healer", blurb: "a physician calls on the homes along the way and cures the sick",
    category: "services", size: 2, half: 10, stories: 1, roof: "flat", bays: 2, window: 4, topper: "none",
    cost: { coins: 110, materials: { planks: 4, stone: 2 } }, upkeep: 4, workers: 1, crew: "citizens", unlock: { residents: 30, citizens: 0 }, buildable: true,
    service: { service: "health", seconds: 8, range: 30 }, appeal: { value: 1, reach: 2 }
  },
  hospital: {
    id: "hospital", title: "Hospital", blurb: "physicians call more often and walk further",
    category: "services", size: 3, half: 16, stories: 2, roof: "flat", bays: 2, window: 6, topper: "cupola",
    cost: { coins: 400, materials: { planks: 10, stone: 10, tools: 2 } }, upkeep: 10, workers: 4, crew: "citizens", unlock: { residents: 0, citizens: 40 }, buildable: true,
    service: { service: "health", seconds: 4, range: 40 }, appeal: { value: 2, reach: 3, full: 2 }
  },
  watchhouse: {
    id: "watchhouse", title: "Watch house", blurb: "a constable walks the streets, keeping order in the homes along the way",
    category: "services", size: 2, half: 10, stories: 1, roof: "flat", bays: 2, window: 4, topper: "flag",
    cost: { coins: 100, materials: { planks: 4, stone: 2 } }, upkeep: 3, workers: 2, crew: "settlers", unlock: { residents: 40, citizens: 0 }, buildable: true,
    service: { service: "order", seconds: 8, range: 30 }
  },
  builder: {
    id: "builder", title: "Builder's yard", blurb: "a builder mends the homes and buildings along the way, with planks and stone",
    category: "services", size: 2, half: 10, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 90, materials: { planks: 4 } }, upkeep: 3, workers: 2, crew: "settlers", unlock: free, buildable: true,
    holds: { accepts: ["planks", "stone"], cap: 6 },
    service: { service: "repair", seconds: 8, range: 20 }, appeal: { value: -2, reach: 2 }
  }
} satisfies Kinds
