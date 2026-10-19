/** Gathering: what the town takes from the land around it, and the forester who plants trees back. */
import { free, type Kinds } from "./kind.ts"

export const gathering = {
  lumberjack: {
    id: "lumberjack", title: "Lumberjack", blurb: "fells grown trees nearby for wood",
    category: "gathering", size: 2, half: 10, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 50, materials: { planks: 2 } }, upkeep: 3, workers: 2, crew: "settlers", unlock: free, buildable: true,
    recipe: { input: null, inputs: 0, output: "wood", batch: 1, seconds: 6 }, gathers: { source: "tree", radius: 4 }, carriers: 2,
    wear: 60, appeal: { value: -2, reach: 2 }
  },
  forester: {
    id: "forester", title: "Forester", blurb: "plants trees on free ground nearby",
    category: "gathering", size: 2, half: 9, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 40, materials: { planks: 2 } }, upkeep: 2, workers: 1, crew: "settlers", unlock: free, buildable: true,
    plants: { what: "tree", radius: 3, seconds: 6, max: 20 }
  },
  quarry: {
    id: "quarry", title: "Quarry", blurb: "cuts stone from rocks nearby",
    category: "gathering", size: 2, half: 10, stories: 1, roof: "flat", bays: 2, window: 6, topper: "none",
    cost: { coins: 80, materials: { planks: 4 } }, upkeep: 5, workers: 3, crew: "settlers", unlock: free, buildable: true,
    recipe: { input: null, inputs: 0, output: "stone", batch: 1, seconds: 8 }, gathers: { source: "stone", radius: 3 }, carriers: 2,
    wear: 50, dusty: true, appeal: { value: -8, reach: 4 },
    upgrade: {
      title: "Masonry", blurb: "a derrick and a mason's shed: it goes on cutting worked-out rock at full pace, not a third of it; a dustier neighbour", rank: 2,
      cost: { coins: 200, materials: { planks: 6, tools: 2 } }, upkeep: 8, deep: true, appeal: { value: -10, reach: 4 }
    }
  },
  mine: {
    id: "mine", title: "Mine", blurb: "digs ore from a deposit nearby",
    category: "gathering", size: 2, half: 10, stories: 1, roof: "flat", bays: 2, window: 6, topper: "chimney",
    cost: { coins: 200, materials: { planks: 6, stone: 4 } }, upkeep: 6, workers: 4, crew: "settlers", unlock: { residents: 0, citizens: 10 }, buildable: true,
    recipe: { input: null, inputs: 0, output: "ore", batch: 1, seconds: 10 }, gathers: { source: "ore", radius: 3 }, carriers: 2,
    wear: 50, dusty: true, appeal: { value: -8, reach: 4 }
  }
} satisfies Kinds
