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

export const goodIds = ["wood", "planks", "stone", "ore", "tools", "fish", "wheat", "flour", "bread", "wool", "cloth"] as const
export type GoodId = (typeof goodIds)[number]

/** Each good's crate label colour (the only colour a good has), and what traders pay for one. */
export const goods: Readonly<Record<GoodId, { readonly title: string; readonly color: number; readonly price: number }>> = {
  wood: { title: "wood", color: 0x8a6a45, price: 1 },
  planks: { title: "planks", color: 0xd27a34, price: 3 },
  stone: { title: "stone", color: 0x8f9891, price: 2 },
  ore: { title: "ore", color: 0x5a6479, price: 3 },
  tools: { title: "tools", color: 0x3d4943, price: 10 },
  fish: { title: "fish", color: 0x2f8c87, price: 2 },
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
export const none: Amounts = { wood: 0, planks: 0, stone: 0, ore: 0, tools: 0, fish: 0, wheat: 0, flour: 0, bread: 0, wool: 0, cloth: 0 }
export const amounts = (some: Partial<Record<GoodId, number>>): Amounts => ({ ...none, ...some })
export const total = (a: Amounts): number => goodIds.reduce((sum, g) => sum + a[g], 0)
/** Amounts made good by good. */
export const each = (f: (good: GoodId) => number): Amounts => {
  const out: Record<GoodId, number> = { ...none }
  for (const g of goodIds) out[g] = f(g)
  return out
}

/** Goods a market walker hands out to homes. */
export const provisions: ReadonlyArray<GoodId> = ["fish", "bread", "cloth"]
/** Goods the top bar shows, in order. */
export const shownGoods: ReadonlyArray<GoodId> = ["wood", "planks", "stone", "tools", "fish", "bread", "cloth"]

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
export type ServiceId = "goods" | "faith"

export type Topper = "none" | "chimney" | "flag" | "cupola" | "sails" | "crates"

export const kindIds = [
  "townhall", "warehouse", "lumberjack", "forester", "quarry", "mine", "fishery", "sawmill",
  "smithy", "farm", "mill", "bakery", "sheep", "weaver", "market", "chapel"
] as const
export type KindId = (typeof kindIds)[number]

export interface Kind {
  readonly id: KindId
  readonly title: string
  readonly blurb: string
  readonly category: Category
  /** Cells a side. */
  readonly size: 2 | 3
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
}

const free = { residents: 0, citizens: 0 }

// Each flat-roofed kind's `half` splits evenly into its bays (2 × half / bays
// is whole), so every window and topper sits on whole units.
export const kinds: Readonly<Record<KindId, Kind>> = {
  townhall: {
    id: "townhall", title: "Town hall", blurb: "the heart of the town: storage, taxes, and a walker with provisions",
    category: "storage", size: 3, half: 20, stories: 2, roof: "flat", bays: 2, window: 8, topper: "flag",
    cost: { coins: 0, materials: {} }, upkeep: 0, workers: 0, unlock: free, buildable: false,
    holds: { accepts: "all", cap: 100 }, carriers: 6,
    service: { service: "goods", seconds: 8, range: 20 }
  },
  warehouse: {
    id: "warehouse", title: "Warehouse", blurb: "stores goods nearer where they are made and used",
    category: "storage", size: 3, half: 18, stories: 1, roof: "flat", bays: 3, window: 6, topper: "crates",
    cost: { coins: 150, materials: { planks: 8, stone: 4 } }, upkeep: 6, workers: 2, unlock: free, buildable: true,
    holds: { accepts: "all", cap: 50 }, carriers: 4
  },
  lumberjack: {
    id: "lumberjack", title: "Lumberjack", blurb: "fells grown trees nearby for wood",
    category: "gathering", size: 2, half: 10, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 50, materials: { planks: 2 } }, upkeep: 3, workers: 2, unlock: free, buildable: true,
    recipe: { input: null, inputs: 0, output: "wood", batch: 1, seconds: 6 }, gathers: { source: "tree", radius: 4 }, carriers: 2
  },
  forester: {
    id: "forester", title: "Forester", blurb: "plants trees on free ground nearby",
    category: "gathering", size: 2, half: 9, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 40, materials: { planks: 2 } }, upkeep: 2, workers: 1, unlock: free, buildable: true,
    plants: { what: "tree", radius: 3, seconds: 6, max: 20 }
  },
  quarry: {
    id: "quarry", title: "Quarry", blurb: "cuts stone from rocks nearby",
    category: "gathering", size: 2, half: 10, stories: 1, roof: "flat", bays: 2, window: 6, topper: "none",
    cost: { coins: 80, materials: { planks: 4 } }, upkeep: 5, workers: 3, unlock: free, buildable: true,
    recipe: { input: null, inputs: 0, output: "stone", batch: 1, seconds: 8 }, gathers: { source: "stone", radius: 3 }, carriers: 2
  },
  mine: {
    id: "mine", title: "Mine", blurb: "digs ore from a deposit nearby",
    category: "gathering", size: 2, half: 10, stories: 1, roof: "flat", bays: 2, window: 6, topper: "chimney",
    cost: { coins: 200, materials: { planks: 6, stone: 4 } }, upkeep: 10, workers: 4, unlock: { residents: 0, citizens: 10 }, buildable: true,
    recipe: { input: null, inputs: 0, output: "ore", batch: 1, seconds: 10 }, gathers: { source: "ore", radius: 3 }, carriers: 2
  },
  fishery: {
    id: "fishery", title: "Fishery", blurb: "catches fish; needs water within two cells",
    category: "food", size: 2, half: 10, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 60, materials: { planks: 3 } }, upkeep: 3, workers: 2, unlock: free, buildable: true,
    recipe: { input: null, inputs: 0, output: "fish", batch: 1, seconds: 4 }, gathers: { source: "water", radius: 2 }, carriers: 2
  },
  sawmill: {
    id: "sawmill", title: "Sawmill", blurb: "saws wood into planks",
    category: "crafts", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "chimney",
    cost: { coins: 100, materials: { planks: 2, stone: 2 } }, upkeep: 6, workers: 2, unlock: free, buildable: true,
    recipe: { input: "wood", inputs: 1, output: "planks", batch: 1, seconds: 5 }, holds: { accepts: ["wood", "planks"], cap: 8 }, carriers: 2
  },
  smithy: {
    id: "smithy", title: "Smithy", blurb: "forges ore into tools",
    category: "crafts", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "chimney",
    cost: { coins: 250, materials: { planks: 4, stone: 6 } }, upkeep: 12, workers: 3, unlock: { residents: 0, citizens: 10 }, buildable: true,
    recipe: { input: "ore", inputs: 1, output: "tools", batch: 1, seconds: 10 }, holds: { accepts: ["ore", "tools"], cap: 8 }, carriers: 2
  },
  farm: {
    id: "farm", title: "Farm", blurb: "sows fields around it and harvests the wheat",
    category: "food", size: 3, half: 12, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 120, materials: { planks: 4 } }, upkeep: 5, workers: 2, unlock: { residents: 30, citizens: 0 }, buildable: true,
    recipe: { input: null, inputs: 0, output: "wheat", batch: 1, seconds: 4 }, gathers: { source: "field", radius: 2 },
    plants: { what: "field", radius: 2, seconds: 3, max: 8 }, carriers: 2
  },
  mill: {
    id: "mill", title: "Mill", blurb: "grinds wheat into flour",
    category: "food", size: 2, half: 8, stories: 2, roof: "flat", bays: 2, window: 4, topper: "sails",
    cost: { coins: 150, materials: { planks: 6, stone: 2, tools: 2 } }, upkeep: 8, workers: 2, unlock: { residents: 30, citizens: 0 }, buildable: true,
    recipe: { input: "wheat", inputs: 1, output: "flour", batch: 1, seconds: 6 }, holds: { accepts: ["wheat", "flour"], cap: 8 }, carriers: 2
  },
  bakery: {
    id: "bakery", title: "Bakery", blurb: "bakes flour into bread",
    category: "food", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "chimney",
    cost: { coins: 150, materials: { planks: 4, stone: 4, tools: 2 } }, upkeep: 8, workers: 2, unlock: { residents: 30, citizens: 0 }, buildable: true,
    recipe: { input: "flour", inputs: 1, output: "bread", batch: 2, seconds: 6 }, holds: { accepts: ["flour", "bread"], cap: 8 }, carriers: 2
  },
  sheep: {
    id: "sheep", title: "Sheep farm", blurb: "shears sheep for wool",
    category: "crafts", size: 3, half: 12, stories: 1, roof: "gable", bays: 2, window: 4, topper: "none",
    cost: { coins: 100, materials: { planks: 4 } }, upkeep: 5, workers: 2, unlock: { residents: 15, citizens: 0 }, buildable: true,
    recipe: { input: null, inputs: 0, output: "wool", batch: 1, seconds: 8 }, carriers: 2
  },
  weaver: {
    id: "weaver", title: "Weaver", blurb: "weaves wool into cloth",
    category: "crafts", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "none",
    cost: { coins: 150, materials: { planks: 4, stone: 2, tools: 2 } }, upkeep: 8, workers: 2, unlock: { residents: 15, citizens: 0 }, buildable: true,
    recipe: { input: "wool", inputs: 1, output: "cloth", batch: 1, seconds: 8 }, holds: { accepts: ["wool", "cloth"], cap: 8 }, carriers: 2
  },
  market: {
    id: "market", title: "Market", blurb: "a walker carries fish, bread, and cloth to the homes it passes",
    category: "services", size: 2, half: 12, stories: 1, roof: "flat", bays: 2, window: 6, topper: "flag",
    cost: { coins: 120, materials: { planks: 6, stone: 2 } }, upkeep: 6, workers: 2, unlock: free, buildable: true,
    holds: { accepts: ["fish", "bread", "cloth"], cap: 12 },
    service: { service: "goods", seconds: 6, range: 18 }
  },
  chapel: {
    id: "chapel", title: "Chapel", blurb: "a walker brings faith to the homes it passes",
    category: "services", size: 2, half: 12, stories: 2, roof: "flat", bays: 2, window: 6, topper: "cupola",
    cost: { coins: 200, materials: { planks: 6, stone: 6 } }, upkeep: 10, workers: 1, unlock: { residents: 15, citizens: 0 }, buildable: true,
    service: { service: "faith", seconds: 8, range: 22 }
  }
}

export const kindOrder: ReadonlyArray<KindId> = [
  "warehouse", "lumberjack", "forester", "quarry", "mine", "sawmill", "smithy", "sheep", "weaver",
  "fishery", "farm", "mill", "bakery", "market", "chapel"
]

export const costText = (cost: Kind["cost"]): string =>
  [cost.coins > 0 ? `${cost.coins} coins` : "", ...Object.entries(cost.materials).map(([g, n]) => `${n} ${g}`)].filter((s) => s !== "").join(" · ")

// ── Homes ─────────────────────────────────────────────────────────────────

export type Tier = 1 | 2
/** What a home can be short of. Settlers need food (fish or bread); citizens bread, cloth, and faith. */
export type Need = "food" | "bread" | "cloth" | "faith"

export const home = {
  /** Half the house's width, in units: a 1×1 cell is 8 units from centre to edge. */
  half: 5,
  cost: { coins: 10, materials: { planks: 1 } } as Kind["cost"],
  tiers: {
    1: { title: "settlers", residents: 4, tax: 1.8, height: 14, needs: ["food"] },
    2: { title: "citizens", residents: 8, tax: 3.6, height: 26, needs: ["bread", "cloth", "faith"] }
  } as Readonly<Record<Tier, { readonly title: string; readonly residents: number; readonly tax: number; readonly height: number; readonly needs: ReadonlyArray<Need> }>>,
  /** A resident moves in (or out) this often. */
  settle: ticks(3),
  /** How long each need stays met after a walker's visit: cloth and faith last longer than a meal. */
  lasts: { food: ticks(60), bread: ticks(90), cloth: ticks(180), faith: ticks(150) } as Readonly<Record<Need, number>>
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
    forests: 7, stone: 4.5, ore: 3, rock: 40, lakes: 2, coins: 2000,
    stock: amounts({ wood: 15, planks: 50, stone: 24, tools: 10, fish: 30 })
  },
  fair: {
    title: "fair", blurb: "enough of everything, if it is not wasted",
    forests: 5.5, stone: 3, ore: 2, rock: 32, lakes: 2, coins: 1500,
    stock: amounts({ wood: 10, planks: 40, stone: 16, tools: 8, fish: 20 })
  },
  harsh: {
    title: "harsh", blurb: "thin woods, little stone, one deposit of ore, one lake",
    forests: 4, stone: 2, ore: 1, rock: 24, lakes: 1, coins: 1100,
    stock: amounts({ wood: 10, planks: 30, stone: 12, tools: 6, fish: 15 })
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
 * Running a town costs more the bigger it gets: the town hall's
 * administration costs `perHome` coins a minute a home, and a further
 * (homes / `growth`) a home, so a large town of poor homes cannot pay
 * its way.
 */
export const admin = { perHome: 0.5, growth: 200 }

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
  step: 2
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
