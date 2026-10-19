/**
 * The land: the charter a new town is founded on (its size, its land, its
 * term), what the land yields and how fast it grows back, and its winters.
 */
import { Clock } from "@typeonce/ritmo"
import { step } from "./clock.ts"
import { amounts, type Amounts } from "./goods.ts"

/** Trees and fields are ready to harvest once this grown. */
export const GROWN = { tree: Clock.steps(Clock.duration(step, 40)), field: Clock.steps(Clock.duration(step, 20)) }
/** The most a rock holds (see `lands` for how much each starts with). */
export const ROCK_AMOUNT = 40
/**
 * A rock quarried down to nothing stays as a worked face: it gives one more
 * stone (or ore) this often, so a quarry or mine beside it keeps going at
 * about a third of its pace instead of stopping for good.
 */
export const FACE_TICKS = Clock.steps(Clock.duration(step, 90))
/**
 * A cell of water fished rests this long before it gives another catch,
 * so a fishery needs a good stretch of shore to itself to work at full
 * pace, and fisheries crowded on one lake share its fish.
 */
export const RESTOCK_TICKS = Clock.steps(Clock.duration(step, 40))

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
 * a town (see `ranks`: a village needs less of both, a city more): its
 * residents, and its income, coins a minute after upkeep and
 * administration. Income, not coins held: a treasury is for spending.
 */
export const sizes: Readonly<Record<SizeId, {
  readonly title: string
  readonly radius: number
  readonly goal: { readonly residents: number; readonly income: number }
}>> = {
  small: { title: "small", radius: 14, goal: { residents: 180, income: 100 } },
  medium: { title: "medium", radius: 19, goal: { residents: 320, income: 150 } },
  large: { title: "large", radius: 25, goal: { residents: 520, income: 200 } }
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
    forests: 7, stone: 4.5, ore: 3, rock: 40, lakes: 2, coins: 1250,
    stock: amounts({ wood: 15, planks: 50, stone: 24, tools: 10, fish: 30 })
  },
  fair: {
    title: "fair", blurb: "enough of everything, if it is not wasted",
    forests: 5.5, stone: 3, ore: 2, rock: 32, lakes: 2, coins: 1100,
    stock: amounts({ wood: 10, planks: 40, stone: 16, tools: 10, fish: 20 })
  },
  harsh: {
    title: "harsh", blurb: "thin woods, little stone, one deposit of ore, one lake",
    forests: 4, stone: 2, ore: 1, rock: 24, lakes: 1, coins: 950,
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

// ── Seasons ───────────────────────────────────────────────────────────────

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
export const WINTER_WARNING = Clock.steps(Clock.duration(step, 60))
