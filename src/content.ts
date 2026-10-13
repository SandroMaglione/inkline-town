/**
 * What the town is made of, as plain data: goods, the buildings that
 * gather, make, store, and hand them out, and the tiers of homes. Costs,
 * upkeep, and taxes are in coins; durations in seconds, turned into whole
 * simulation steps by `ticks`. `archetypes.ts` turns each entry into the
 * components an entity is spawned with; nothing here knows about the ECS.
 */

/** The simulation's fixed step. */
export const STEP_SECONDS = 1 / 60
export const ticks = (seconds: number): number => Math.round(seconds / STEP_SECONDS)

// ── Goods ─────────────────────────────────────────────────────────────────

export const goodIds = ["wood", "planks", "stone", "ore", "tools", "fish", "smoked", "wheat", "flour", "bread", "wool", "cloth"] as const
export type GoodId = (typeof goodIds)[number]

/** Each good's crate label colour (the only colour a good has), and what traders pay for one. */
export const goods: Readonly<Record<GoodId, { readonly title: string; readonly color: number; readonly price: number }>> = {
  wood: { title: "wood", color: 0x8a6a45, price: 1 },
  planks: { title: "planks", color: 0xd27a34, price: 3 },
  stone: { title: "stone", color: 0x8f9891, price: 2 },
  ore: { title: "ore", color: 0x5a6479, price: 3 },
  tools: { title: "tools", color: 0x3d4943, price: 10 },
  fish: { title: "fish", color: 0x2f8c87, price: 2 },
  smoked: { title: "smoked fish", color: 0x9a5b3a, price: 4 },
  wheat: { title: "wheat", color: 0xd6ae2e, price: 1 },
  flour: { title: "flour", color: 0xc9b48a, price: 2 },
  bread: { title: "bread", color: 0xc4523f, price: 4 },
  wool: { title: "wool", color: 0xa7ada4, price: 2 },
  cloth: { title: "cloth", color: 0x8a58a8, price: 6 }
}

/**
 * Trade: at every collection, traders buy what the town sells beyond the
 * reserve it keeps, up to `TRADE_LOAD` of each good.
 */
export const TRADE_LOAD = 12
export const RESERVES = [10, 25, 50, 100] as const
/** A new town sells its surplus wood, wheat, and wool. Stone is finite: it is not sold until the town says so. */
export const trade = { sells: ["wood", "wheat", "wool"] as ReadonlyArray<GoodId>, reserve: 25 }

export type Amounts = Readonly<Record<GoodId, number>>
export const none: Amounts = { wood: 0, planks: 0, stone: 0, ore: 0, tools: 0, fish: 0, smoked: 0, wheat: 0, flour: 0, bread: 0, wool: 0, cloth: 0 }
export const amounts = (some: Partial<Record<GoodId, number>>): Amounts => ({ ...none, ...some })
export const total = (a: Amounts): number => goodIds.reduce((sum, g) => sum + a[g], 0)
/** Amounts made good by good. */
export const each = (f: (good: GoodId) => number): Amounts => {
  const out: Record<GoodId, number> = { ...none }
  for (const g of goodIds) out[g] = f(g)
  return out
}

/** Goods a market walker hands out to homes. */
export const provisions: ReadonlyArray<GoodId> = ["fish", "smoked", "bread", "cloth"]
/** Goods the top bar shows, in order. */
export const shownGoods: ReadonlyArray<GoodId> = ["wood", "planks", "stone", "tools", "fish", "smoked", "bread", "cloth"]
/** Goods that are food in store (see `larder`). */
export const foods: ReadonlyArray<GoodId> = ["fish", "smoked", "bread"]

/**
 * Food spoils in store: about how many seconds a fish or a loaf keeps. A
 * granary keeps it `KEEPS` times as long; smoked fish, wheat, and flour keep.
 * Every `SPOIL_TICKS`, each shelf loses its share of what it holds.
 */
export const spoils: Partial<Record<GoodId, number>> = { fish: 180, bread: 300 }
export const SPOIL_TICKS = 600

// ── Buildings ─────────────────────────────────────────────────────────────

export type Category = "storage" | "gathering" | "crafts" | "food" | "services"
export const categoryOrder: ReadonlyArray<Category> = ["storage", "gathering", "crafts", "food", "services"]

/** Awnings are coloured by what a building is for. */
export const categoryColor: Readonly<Record<Category, number>> = {
  storage: 0x8a58a8,
  gathering: 0x6e8f36,
  crafts: 0xd27a34,
  food: 0xd6ae2e,
  services: 0x3d6db5
}
export const homeColor = 0xc4523f

/** What a gatherer takes from the land around it. */
export type Source = "tree" | "stone" | "ore" | "field" | "water"
export const serviceIds = ["goods", "faith", "fire", "health", "order", "repair"] as const
export type ServiceId = (typeof serviceIds)[number]
/** Native crews: surplus citizens can also do rough work; settlers learn skilled jobs as apprentices. */
export type Crew = "settlers" | "citizens"

export type Topper = "none" | "chimney" | "flag" | "cupola" | "sails" | "crates"

export const kindIds = [
  "townhall", "warehouse", "lumberjack", "forester", "quarry", "mine", "fishery", "sawmill",
  "smithy", "farm", "mill", "bakery", "sheep", "weaver", "market", "chapel",
  "granary", "smokehouse", "firewatch", "healer", "hospital", "watchhouse", "builder"
] as const
export type KindId = (typeof kindIds)[number]

export interface Kind {
  readonly id: KindId
  readonly title: string
  readonly blurb: string
  readonly category: Category
  /** Cells a side. */
  readonly size: 1 | 2 | 3
  // ── Look (see `art.ts`) ──
  /** Half the building's width, in units: its walls stand this far from its centre. */
  readonly half: number
  readonly stories: 1 | 2
  readonly roof: "flat" | "gable"
  /** A flat roof is split into bays × bays squares, each `window` units across but the topper's. */
  readonly bays: 2 | 3
  readonly window: number
  readonly topper: Topper
  // ── Economy ──
  readonly cost: { readonly coins: number; readonly materials: Partial<Record<GoodId, number>> }
  /** Coins a minute while it stands. */
  readonly upkeep: number
  readonly workers: number
  /** Who works it: settlers, or citizens (settlers stand in as apprentices, at a slower pace). */
  readonly crew: Crew
  /** Residents (and of them citizens) the town needs before it can be built. */
  readonly unlock: { readonly residents: number; readonly citizens: number }
  /** In the build menu (the town hall is not). */
  readonly buildable: boolean
  // ── Roles: each one present becomes a component ──
  /** Turns `inputs` of `input` (or nothing, or the land) into `batch` of `output` per job. */
  readonly recipe?: { readonly input: GoodId | null; readonly inputs: number; readonly output: GoodId; readonly batch: number; readonly seconds: number }
  /** A gatherer's job needs this within `radius` cells of its footprint. */
  readonly gathers?: { readonly source: Source; readonly radius: number }
  /** Plants trees or fields within `radius`, one every `seconds`, up to `max` at once. */
  readonly plants?: { readonly what: "tree" | "field"; readonly radius: number; readonly seconds: number; readonly max: number }
  /** Holds goods: every good (storage), or just some (a market). */
  readonly holds?: { readonly accepts: ReadonlyArray<GoodId> | "all"; readonly cap: number }
  /** Carriers it sends out at once. */
  readonly carriers?: number
  /** Sends a walker down the roads every `seconds`, `range` cells out. */
  readonly service?: { readonly service: ServiceId; readonly seconds: number; readonly range: number }
  // ── Its neighbourhood ──
  /** What it does to the desirability of the cells around it, fading out to `reach` cells (see `appeal.ts`). */
  readonly appeal?: { readonly value: number; readonly reach: number }
  /** Uses up a tool every `wear` jobs, and works at half pace without one. */
  readonly wear?: number
  /** Ovens and forges: a fire risk to itself and to homes beside it. */
  readonly hot?: boolean
  /** Dust: a health risk to homes nearby. */
  readonly dusty?: boolean
  /** A storage that keeps food this many times longer. */
  readonly keeps?: number
}

const free = { residents: 0, citizens: 0 }

// Each flat-roofed kind's `half` splits evenly into its bays (2 × half / bays
// is whole), so every window and topper sits on whole units.
export const kinds: Readonly<Record<KindId, Kind>> = {
  townhall: {
    id: "townhall", title: "Town hall", blurb: "the heart of the town: storage, taxes, and a walker with provisions",
    category: "storage", size: 3, half: 20, stories: 2, roof: "flat", bays: 2, window: 8, topper: "flag",
    cost: { coins: 0, materials: {} }, upkeep: 0, workers: 0, crew: "settlers", unlock: free, buildable: false,
    holds: { accepts: "all", cap: 100 }, carriers: 6,
    service: { service: "goods", seconds: 8, range: 20 }, appeal: { value: 4, reach: 3 }
  },
  warehouse: {
    id: "warehouse", title: "Warehouse", blurb: "stores goods nearer where they are made and used",
    category: "storage", size: 3, half: 18, stories: 1, roof: "flat", bays: 3, window: 6, topper: "crates",
    cost: { coins: 150, materials: { planks: 8, stone: 4 } }, upkeep: 6, workers: 2, crew: "settlers", unlock: free, buildable: true,
    holds: { accepts: "all", cap: 50 }, carriers: 4, appeal: { value: -2, reach: 2 }
  },
  granary: {
    id: "granary", title: "Granary", blurb: "stores food, and keeps fish and bread five times as long",
    category: "storage", size: 2, half: 11, stories: 2, roof: "flat", bays: 2, window: 4, topper: "none",
    cost: { coins: 120, materials: { planks: 6, stone: 2 } }, upkeep: 4, workers: 1, crew: "settlers", unlock: { residents: 20, citizens: 0 }, buildable: true,
    holds: { accepts: ["fish", "smoked", "bread", "wheat", "flour"], cap: 60 }, carriers: 3, keeps: 5, appeal: { value: -2, reach: 2 }
  },
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
    wear: 50, dusty: true, appeal: { value: -8, reach: 4 }
  },
  mine: {
    id: "mine", title: "Mine", blurb: "digs ore from a deposit nearby",
    category: "gathering", size: 2, half: 10, stories: 1, roof: "flat", bays: 2, window: 6, topper: "chimney",
    cost: { coins: 200, materials: { planks: 6, stone: 4 } }, upkeep: 10, workers: 4, crew: "settlers", unlock: { residents: 0, citizens: 10 }, buildable: true,
    recipe: { input: null, inputs: 0, output: "ore", batch: 1, seconds: 10 }, gathers: { source: "ore", radius: 3 }, carriers: 2,
    wear: 50, dusty: true, appeal: { value: -8, reach: 4 }
  },
  fishery: {
    id: "fishery", title: "Fishery", blurb: "catches fish; needs water within two cells",
    category: "food", size: 2, half: 10, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 60, materials: { planks: 3 } }, upkeep: 3, workers: 2, crew: "settlers", unlock: free, buildable: true,
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
  farm: {
    id: "farm", title: "Farm", blurb: "sows fields around it and harvests the wheat",
    category: "food", size: 3, half: 12, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 120, materials: { planks: 4 } }, upkeep: 5, workers: 2, crew: "settlers", unlock: { residents: 30, citizens: 0 }, buildable: true,
    recipe: { input: null, inputs: 0, output: "wheat", batch: 1, seconds: 4 }, gathers: { source: "field", radius: 2 },
    plants: { what: "field", radius: 2, seconds: 3, max: 8 }, carriers: 2, appeal: { value: -2, reach: 2 }
  },
  mill: {
    id: "mill", title: "Mill", blurb: "grinds wheat into flour",
    category: "food", size: 2, half: 8, stories: 2, roof: "flat", bays: 2, window: 4, topper: "sails",
    cost: { coins: 150, materials: { planks: 6, stone: 2, tools: 1 } }, upkeep: 8, workers: 2, crew: "citizens", unlock: { residents: 30, citizens: 0 }, buildable: true,
    recipe: { input: "wheat", inputs: 1, output: "flour", batch: 1, seconds: 6 }, holds: { accepts: ["wheat", "flour"], cap: 8 }, carriers: 2,
    wear: 60, appeal: { value: -4, reach: 3 }
  },
  bakery: {
    id: "bakery", title: "Bakery", blurb: "bakes flour into bread",
    category: "food", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "chimney",
    cost: { coins: 150, materials: { planks: 4, stone: 4, tools: 1 } }, upkeep: 8, workers: 2, crew: "citizens", unlock: { residents: 30, citizens: 0 }, buildable: true,
    recipe: { input: "flour", inputs: 1, output: "bread", batch: 2, seconds: 6 }, holds: { accepts: ["flour", "bread"], cap: 8 }, carriers: 2,
    wear: 60, hot: true, appeal: { value: -4, reach: 3 }
  },
  sheep: {
    id: "sheep", title: "Sheep farm", blurb: "shears sheep for wool",
    category: "crafts", size: 3, half: 12, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 100, materials: { planks: 4 } }, upkeep: 5, workers: 2, crew: "settlers", unlock: { residents: 15, citizens: 0 }, buildable: true,
    recipe: { input: null, inputs: 0, output: "wool", batch: 1, seconds: 6 }, carriers: 2, appeal: { value: -2, reach: 2 }
  },
  weaver: {
    id: "weaver", title: "Weaver", blurb: "weaves wool into cloth",
    category: "crafts", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "none",
    cost: { coins: 150, materials: { planks: 4, stone: 2, tools: 1 } }, upkeep: 8, workers: 2, crew: "citizens", unlock: { residents: 15, citizens: 0 }, buildable: true,
    recipe: { input: "wool", inputs: 1, output: "cloth", batch: 1, seconds: 6 }, holds: { accepts: ["wool", "cloth"], cap: 8 }, carriers: 2,
    wear: 60, appeal: { value: -2, reach: 2 }
  },
  market: {
    id: "market", title: "Market", blurb: "a walker carries fish, bread, and cloth to the homes it passes",
    category: "services", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "flag",
    cost: { coins: 120, materials: { planks: 6, stone: 2 } }, upkeep: 6, workers: 2, crew: "citizens", unlock: free, buildable: true,
    holds: { accepts: ["fish", "smoked", "bread", "cloth"], cap: 12 },
    service: { service: "goods", seconds: 6, range: 18 }, appeal: { value: 2, reach: 3 }
  },
  chapel: {
    id: "chapel", title: "Chapel", blurb: "a walker brings faith to the homes it passes",
    category: "services", size: 2, half: 12, stories: 2, roof: "flat", bays: 2, window: 6, topper: "cupola",
    cost: { coins: 200, materials: { planks: 6, stone: 6 } }, upkeep: 10, workers: 1, crew: "citizens", unlock: { residents: 15, citizens: 0 }, buildable: true,
    service: { service: "faith", seconds: 8, range: 22 }, appeal: { value: 4, reach: 3 }
  },
  firewatch: {
    id: "firewatch", title: "Fire watch", blurb: "a watchman checks homes and workshops along the way for fire; firefighters run to any blaze",
    category: "services", size: 2, half: 9, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 70, materials: { planks: 3 } }, upkeep: 3, workers: 2, crew: "settlers", unlock: free, buildable: true,
    service: { service: "fire", seconds: 7, range: 30 }
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
    cost: { coins: 400, materials: { planks: 10, stone: 10, tools: 2 } }, upkeep: 16, workers: 4, crew: "citizens", unlock: { residents: 0, citizens: 40 }, buildable: true,
    service: { service: "health", seconds: 4, range: 40 }, appeal: { value: 2, reach: 3 }
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
}

export const kindOrder: ReadonlyArray<KindId> = [
  "warehouse", "granary", "lumberjack", "forester", "quarry", "mine", "sawmill", "smithy", "sheep", "weaver",
  "fishery", "smokehouse", "farm", "mill", "bakery", "market", "chapel", "firewatch", "healer", "hospital", "watchhouse", "builder"
]

export const costText = (cost: Kind["cost"]): string =>
  [cost.coins > 0 ? `${cost.coins} coins` : "", ...Object.entries(cost.materials).map(([g, n]) => `${n} ${g}`)].filter((s) => s !== "").join(" · ")

// ── Parks ─────────────────────────────────────────────────────────────────

/**
 * A park is laid out cell by cell: ground painted on empty land (lawn,
 * flower beds, gravel paths, a paved square), and on any of its cells one
 * furnishing (a lamp, a fountain, a statue). Cells of ground that touch
 * make one park, and the whole park is what the street around it feels
 * (see `parkSources` in `appeal.ts`): its `beauty` adds up from its
 * ground, its furnishings, and its entrances (a walk or a square beside a
 * road), and that is the desirability it gives the cells around it, out to
 * a reach that grows with its size. Nobody walks through it: it is not a
 * road.
 */
export const groundIds = ["lawn", "flowers", "path", "square"] as const
export type GroundId = (typeof groundIds)[number]
export const propIds = ["lamp", "fountain", "statue"] as const
export type PropId = (typeof propIds)[number]

export interface ParkPiece {
  readonly title: string
  readonly blurb: string
  readonly cost: Kind["cost"]
  /** Coins a minute. */
  readonly upkeep: number
  /** What it adds to its park's beauty. */
  readonly beauty: number
  readonly unlock: { readonly residents: number; readonly citizens: number }
}

export const grounds: Readonly<Record<GroundId, ParkPiece>> = {
  lawn: { title: "Lawn", blurb: "grass to lay a park out on", cost: { coins: 2, materials: {} }, upkeep: 0.05, beauty: 0.25, unlock: free },
  flowers: { title: "Flower bed", blurb: "planted borders: prettier than lawn", cost: { coins: 5, materials: {} }, upkeep: 0.15, beauty: 0.75, unlock: free },
  path: { title: "Gravel path", blurb: "a walk through the park", cost: { coins: 3, materials: {} }, upkeep: 0.05, beauty: 0.25, unlock: free },
  square: { title: "Paved square", blurb: "stone setts, for a statue or a fountain to stand on", cost: { coins: 3, materials: { stone: 1 } }, upkeep: 0.05, beauty: 0.25, unlock: free }
}

export const props: Readonly<Record<PropId, ParkPiece>> = {
  lamp: { title: "Lamp", blurb: "an iron lamp post along the walk", cost: { coins: 12, materials: { tools: 1 } }, upkeep: 0.2, beauty: 1.5, unlock: free },
  fountain: { title: "Fountain", blurb: "a stone basin of fresh water", cost: { coins: 70, materials: { stone: 3 } }, upkeep: 2, beauty: 4, unlock: { residents: 30, citizens: 0 } },
  statue: { title: "Statue", blurb: "a founder in stone, the pride of the park", cost: { coins: 160, materials: { stone: 6 } }, upkeep: 3, beauty: 5, unlock: { residents: 0, citizens: 20 } }
}

/** How a park's beauty adds up (see `parkSources`). */
export const park = {
  /** Ground counts for this much beauty at most, however big the park. */
  groundMost: 4,
  /** One furnishing counts for every this many cells: a park crowded with benches is no nicer. */
  cellsPerProp: 2,
  /** Each furnishing of a kind after the first counts this share of the one before. */
  repeat: 0.5,
  /** A walk or a square beside a road is a way in from the street: each adds this, up to `entrances` of them. */
  entrance: 1.5,
  entrances: 2,
  /** The most a park gives the streets around it. */
  most: 15,
  /** How far it reaches: `reach[0]` cells, and one more for every `reach[1]` cells of park, up to `reach[2]`. */
  reach: [2, 6, 5] as const
}

// ── Homes ─────────────────────────────────────────────────────────────────

export type Tier = 1 | 2 | 3
export const tierIds: ReadonlyArray<Tier> = [1, 2, 3]
/** What a home can be short of. Settlers need food (fish, smoked fish, or bread); citizens and burghers bread, cloth, and faith. */
export type Need = "food" | "bread" | "cloth" | "faith"

export const home = {
  /** Half the house's width, in units: a 1×1 cell is 8 units from centre to edge. */
  half: 5,
  cost: { coins: 10, materials: { planks: 1 } } as Kind["cost"],
  tiers: {
    1: { title: "settlers", residents: 4, tax: 2.5, height: 14, needs: ["food"], appeal: -100 },
    2: { title: "citizens", residents: 8, tax: 5, height: 26, needs: ["bread", "cloth", "faith"], appeal: 5 },
    3: { title: "burghers", residents: 12, tax: 6.5, height: 38, needs: ["bread", "cloth", "faith"], appeal: 15 }
  } as Readonly<Record<Tier, {
    readonly title: string
    readonly residents: number
    readonly tax: number
    readonly height: number
    readonly needs: ReadonlyArray<Need>
    /** The desirability a home of this tier needs around it (see `appeal.ts`). */
    readonly appeal: number
  }>>,
  /** A resident moves in (or out) this often. */
  settle: ticks(3),
  /** How long each need stays met after a walker's visit: cloth and faith last longer than a meal. */
  lasts: { food: ticks(90), bread: ticks(120), cloth: ticks(240), faith: ticks(180) } as Readonly<Record<Need, number>>,
  /** Where nobody wants to live: the desirability the map's legend calls squalid. */
  squalid: -5,
  /**
   * What a street does to a home, point by point of desirability (see
   * `streetRoom` and `streetTax`): a home holds (1 + d / `room`) of its
   * residents, never fewer than `roomLeast`; and pays (1 + d / `tax`),
   * within `taxMost` either way. So a cottage beside a quarry empties a
   * little and pays less, long before anything is squalid.
   */
  street: { room: 12, roomLeast: 0.5, tax: 40, taxMost: 0.25 },
  /** A settlers' cottage with bread on the table pays this much more: bread is worth baking before anyone is a citizen. */
  breadBonus: 0.5
}

/** What a tier's homes are called, and what its residents are. */
export const tierHome: Readonly<Record<Tier, string>> = { 1: "settlers' cottage", 2: "citizens' home", 3: "townhouse" }

/** Which crew a tier's residents work in. */
export const crewOf = (tier: Tier): Crew => (tier === 1 ? "settlers" : "citizens")

/** Road cells a resident walks to work, at most (see `AssignStaff`). */
export const COMMUTE = 15
/** An apprentice (a settler in a citizens' job) works at this share of the pace. */
export const APPRENTICE = 0.75
/** Tools a workshop that wears them keeps on hand. */
export const TOOL_STOCK = 1

// ── Desirability ──────────────────────────────────────────────────────────

/**
 * What the land and the town do to the cells around them, besides the
 * buildings' own (`Kind.appeal`). Water and woods count once, however many
 * are near; so do paved streets.
 */
export const appeal = {
  water: { value: 2, reach: 2 },
  forest: { value: 2, reach: 2 },
  paved: { value: 1, reach: 1 },
  ruin: { value: -3, reach: 2 },
  worn: { value: -2, reach: 1 },
  /** Desirability is reckoned this often. */
  every: 30,
  /** And kept within these bounds. */
  floor: -30,
  ceiling: 40
}

/** Paving a road cell: coins and stone, the stone taken from storage at once. */
export const PAVE_COST = { coins: 3, stone: 1 }
/** Carriers and walkers move this much faster along a paved street (see `Walk`). */
export const PAVED_PACE = 1.5

// ── Risks ─────────────────────────────────────────────────────────────────

/**
 * Every home has three risk meters, 0 → `RISK_MAX`, and every building a
 * fire meter. Each rises a little every second, faster for the reasons
 * below (points a second); the matching service walker passing resets it.
 * Over `warn` a sign goes up over the home; at the top, disaster.
 */
export const RISK_MAX = 10_000
export const risk = {
  /** Past this, a sign goes up and the map views turn red: half way, so there is time to act. */
  warn: 5000,
  /** The three services' walkers keep a burghers' home: its meters must stay under this. */
  kept: 5000,
  /** Each home and building rises at its own pace, between these shares of the usual (fixed by where it stands), so a street does not all go up at once. */
  pace: [0.75, 1.25] as const,
  fire: {
    /** Settlers' cottages are wooden. */
    wooden: 6,
    stone: 4,
    building: 2,
    /** A bakery's oven, a smithy's forge: in itself, and to each home within `reach`. */
    hot: 10,
    near: 6,
    reach: 2,
    crowded: 3,
    worn: 6,
    /** Heating through a hard winter. */
    winter: 6,
    /** How long a blaze burns before the house is lost. */
    burns: ticks(20),
    /** A burning house sets a neighbour alight, each second: this chance, and up to `spread` more for a neighbour at the top of its own meter. */
    catches: 0.03,
    spread: 0.12,
    /** Firefighters a fire watch may have out at once. */
    crews: 2
  },
  health: {
    base: 3,
    hungry: 6,
    crowded: 3,
    squalid: 4,
    /** A quarry's or a mine's dust, within `reach`. */
    dust: 6,
    reach: 3,
    /** Still water within two cells. */
    water: 3,
    /** How long a sickness lasts if no physician comes; meanwhile the home holds `sickly` as many. */
    lasts: ticks(60),
    sickly: 0.5,
    /** Each second, the chance it reaches a home within two cells: raising its risk by `contagion` (a home a physician calls on shrugs it off). */
    spreads: 0.04,
    contagion: 3000
  },
  order: {
    base: 3,
    /** For every 50 points of approval below nothing. */
    unrest: 8,
    squalid: 4,
    /** A home standing half empty. */
    vacant: 4,
    /** A burghers' home is worth robbing. */
    wealth: 3,
    /** A theft takes this many coins and this share of the treasury, or goods instead when it is empty. */
    coins: 10,
    share: 0.02,
    most: 80,
    goods: 4,
    /** After a theft its meter falls only to here; reaching the top again, the home empties and is left derelict. */
    after: 3000
  }
}

/** How well kept a building or home is, 0 → `CONDITION_MAX`. */
export const CONDITION_MAX = 1000
export const condition = {
  /** A point lost every `every` steps: from new to run down in about 33 minutes, and fallen down in 67, unmended. */
  every: ticks(4),
  /** Below this, a builder mends it as they pass (after about 23 minutes without repair). */
  mend: 650,
  /** Below this, it works at half pace, and its fire risk rises. */
  worn: 500
}

/** Tax rates the town can set, in percent of the usual. */
export const TAX_STEPS = [50, 75, 100, 125, 150, 200] as const

export const needTitle: Readonly<Record<Need, string>> = { food: "food", bread: "bread", cloth: "cloth", faith: "faith" }

// ── The town ──────────────────────────────────────────────────────────────

/** How long anything takes to go up once its materials are in. */
export const BUILD_TICKS = ticks(2.4)
/** Taxes are collected and upkeep paid this often. */
export const LEDGER_TICKS = ticks(10)
export const ROAD_COST = 2
/** Trees and fields are ready to harvest once this grown. */
export const GROWN = { tree: ticks(40), field: ticks(20) }
/** The most a rock holds (see `lands` for how much each starts with). */
export const ROCK_AMOUNT = 40

// ── The charter: what a new town is founded on ────────────────────────────

export const sizeIds = ["small", "medium", "large"] as const
export type SizeId = (typeof sizeIds)[number]
export const landIds = ["rich", "fair", "harsh"] as const
export type LandId = (typeof landIds)[number]
/** How long a term in office runs, in minutes of game time. */
export const TERMS = [45, 60, 90] as const

/**
 * Sizes of land: its rough radius in cells (the coast wanders in and out of
 * it, with capes reaching further), and what the town must reach to be
 * complete (see `Fate`).
 */
export const sizes: Readonly<Record<SizeId, {
  readonly title: string
  readonly radius: number
  readonly goal: { readonly residents: number; readonly coins: number }
}>> = {
  small: { title: "small", radius: 14, goal: { residents: 180, coins: 2500 } },
  medium: { title: "medium", radius: 19, goal: { residents: 320, coins: 4000 } },
  large: { title: "large", radius: 25, goal: { residents: 520, coins: 5000 } }
}

/**
 * How generous the land is: forests, outcrops of stone, deposits of ore
 * (each per thousand cells of land), how much each rock holds, lakes, and
 * what the town starts with.
 */
export const lands: Readonly<Record<LandId, {
  readonly title: string
  readonly blurb: string
  readonly forests: number
  readonly stone: number
  readonly ore: number
  readonly rock: number
  readonly lakes: number
  readonly coins: number
  readonly stock: Amounts
}>> = {
  rich: {
    title: "rich", blurb: "deep forests, plenty of stone and ore, two lakes, a full treasury",
    forests: 7, stone: 4.5, ore: 3, rock: 40, lakes: 2, coins: 2400,
    stock: amounts({ wood: 15, planks: 50, stone: 24, tools: 10, fish: 30 })
  },
  fair: {
    title: "fair", blurb: "enough of everything, if it is not wasted",
    forests: 5.5, stone: 3, ore: 2, rock: 32, lakes: 2, coins: 1900,
    stock: amounts({ wood: 10, planks: 40, stone: 16, tools: 10, fish: 20 })
  },
  harsh: {
    title: "harsh", blurb: "thin woods, little stone, one deposit of ore, one lake",
    forests: 4, stone: 2, ore: 1, rock: 24, lakes: 1, coins: 1500,
    stock: amounts({ wood: 10, planks: 30, stone: 12, tools: 8, fish: 15 })
  }
}

export interface CharterValue {
  readonly size: SizeId
  readonly term: number
  readonly land: LandId
  readonly seed: number
}
export const defaultCharter = (seed: number): CharterValue => ({ size: "medium", term: 60, land: "fair", seed })

// ── Pressure ──────────────────────────────────────────────────────────────

/**
 * Seasons: a term is six years; the last part of each but the first is
 * winter, when fields do not grow, fisheries catch half as much, and homes
 * eat faster.
 */
export const YEARS_PER_TERM = 6
export const WINTER_SHARE = 0.3

/**
 * Each year's winter is mild, normal, or hard, rolled from the seed when the
 * town is founded (see `Charter.winters`): how much of the year it takes,
 * what fisheries catch, and whether homes heat (a fire risk).
 */
export const winterIds = ["mild", "normal", "hard"] as const
export type WinterId = (typeof winterIds)[number]
export const winters: Readonly<Record<WinterId, { readonly title: string; readonly share: number; readonly fishing: number; readonly heating: boolean; readonly chance: number }>> = {
  mild: { title: "mild", share: WINTER_SHARE, fishing: 0.75, heating: false, chance: 0.3 },
  normal: { title: "normal", share: WINTER_SHARE, fishing: 0.5, heating: false, chance: 0.45 },
  hard: { title: "hard", share: WINTER_SHARE * 1.5, fishing: 0.4, heating: true, chance: 0.25 }
}
/** The almanac warns of winter this many steps before it comes. */
export const WINTER_WARNING = ticks(60)

/**
 * Running a town costs more the bigger it gets: the town hall's
 * administration costs `perHome` coins a minute a home, and a further
 * (homes / `growth`) a home, so a large town of poor homes cannot pay
 * its way.
 */
export const admin = { perHome: 0.4, growth: 120 }

/**
 * Approval, -100 → +100: where the town's mood is heading, and how fast it
 * gets there (points every collection). Homes hold more residents when it
 * is high and fewer when it is low (see `capacity`).
 */
export const mood = {
  base: 10,
  /** At no needs met to every need met. */
  needs: [-35, 30] as const,
  /** Points for each percent the average tax rate is below (or above) 100%. */
  perTaxPoint: 0.6,
  debt: -20,
  /** Per unanswered crown request, while the crown remembers it. */
  snub: -20,
  winterHunger: -10,
  step: 2,
  /**
   * A grudge: taxes above `above` percent are remembered. Every collection
   * adds (rate − above) × `perPoint` tenths of a point to the town's memory,
   * up to `most`; at or below it the memory fades by `decay` tenths. The
   * grudge takes that many points off approval, so a term of 200% cannot be
   * undone by cutting taxes in the last three minutes.
   */
  grudge: { above: 125, perPoint: 0.05, decay: 5, most: 300 }
}

/**
 * Crown requests: every so often the crown asks for goods within a time.
 * Requests grow as the term goes on. Sending them earns coins; missing one
 * costs a fine and the crown's goodwill for a while.
 */
export const crown = {
  /** Requests in a term. */
  perTerm: 9,
  /** Share of the gap between requests the town has to answer one. */
  window: 0.6,
  /**
   * How much it asks for: this share of what the town could make of the
   * good in the time given, from the start of the term to its end.
   */
  share: [0.25, 0.6] as const,
  /** Nor more than this share of what the town's storage holds of one good. */
  room: 0.6,
  /** Reward as a multiple of what the goods would fetch from traders, plus a bonus; the fine is the goods' worth plus the bonus. */
  reward: 2,
  fine: 1,
  bonus: 50,
  /** How long the crown remembers a missed request, in minutes. */
  memory: 4,
  /** Requests missed in a row before the crown dismisses the mayor. */
  patience: 3
}

/**
 * The market: each good's price moves with what the town trades. Selling
 * drives it down, buying up; it drifts back by a tenth of the gap every
 * collection. Buying costs half again the price.
 */
export const market = { floor: 30, ceiling: 250, perUnit: 1, markup: 1.5 }

/** A paused building pays this share of its upkeep. */
export const PAUSED_UPKEEP = 0.25

/** How long each end state's danger has to last, in minutes, before the term ends with it. */
export const fate = {
  /** Victory: every goal held this long. */
  hold: 2,
  /** Bankruptcy: in debt this long without a break. */
  debt: 3,
  /** Revolt: approval at or below `revolt` this long. */
  revolt: 2,
  revoltAt: -50,
  /** Abandonment: residents below this share of their peak, once the peak reached `peak`. */
  abandon: 0.15,
  peak: 40,
  /** The goals besides residents and coins: a share of them citizens, and approval. */
  citizens: 0.3,
  approval: 15
}

/** The town's history: a sample this often. */
export const HISTORY_TICKS = ticks(15)
