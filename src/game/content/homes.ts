/** Homes: their tiers, what their residents need, what a street does to them, and the crews they work in. */
import { Clock } from "@typeonce/ritmo"
import { step } from "./clock.ts"
import type { Crew, Kind } from "./kinds/index.ts"

export type Tier = 1 | 2 | 3
export const tierIds: ReadonlyArray<Tier> = [1, 2, 3]
/** What a home can be short of. Settlers need food (fish, smoked fish, or bread); citizens bread, cloth, and faith; burghers furniture besides. */
export type Need = "food" | "bread" | "cloth" | "faith" | "furniture"

/** A tier of homes (see `home.tiers`). */
interface HomeTier {
  readonly title: string
  readonly residents: number
  readonly tax: number
  readonly height: number
  readonly needs: ReadonlyArray<Need>
  /** The desirability a home of this tier needs around it (see `appeal.ts`). */
  readonly appeal: number
  /**
   * What rebuilding a home into this tier costs, paid at once from the
   * treasury and the store when it is ready to rise, as paving is: a home
   * that cannot be paid for waits at its tier. A home that steps down
   * keeps its rebuilding, and rises back into it for nothing.
   */
  readonly rise: Kind["cost"]
}

export const home = {
  /** Half the house's width, in units: a 1×1 cell is 8 units from centre to edge. */
  half: 5,
  cost: { coins: 15, materials: { planks: 1 } } as Kind["cost"],
  tiers: {
    1: { title: "settlers", residents: 4, tax: 2.5, height: 24, needs: ["food"], appeal: -100, rise: { coins: 0, materials: {} } },
    2: { title: "citizens", residents: 8, tax: 5, height: 46, needs: ["bread", "cloth", "faith"], appeal: 5, rise: { coins: 35, materials: { planks: 4, stone: 2 } } },
    3: { title: "burghers", residents: 12, tax: 7, height: 68, needs: ["bread", "cloth", "faith", "furniture"], appeal: 12, rise: { coins: 45, materials: { planks: 4, stone: 4, tools: 1, furniture: 2 } } }
  } satisfies Record<Tier, HomeTier> as Readonly<Record<Tier, HomeTier>>,
  /** A resident moves in (or out) this often. */
  settle: Clock.steps(Clock.duration(step, 3)),
  /** How long each need stays met after a walker's visit: cloth and faith last longer than a meal. */
  lasts: { food: Clock.steps(Clock.duration(step, 90)), bread: Clock.steps(Clock.duration(step, 120)), cloth: Clock.steps(Clock.duration(step, 240)), faith: Clock.steps(Clock.duration(step, 180)), furniture: Clock.steps(Clock.duration(step, 300)) } satisfies Record<Need, number> as Readonly<Record<Need, number>>,
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
  breadBonus: 0.5,
  /**
   * The need a finer home cannot be without: a citizens' home or a
   * townhouse out of bread goes back to settlers, however much fish it
   * eats (cloth or faith alone may lapse a while).
   */
  staple: "bread" as Need,
  /**
   * A walker's visit feeds a home one fish or loaf for every `perMeal`
   * residents (rounded up): a cottage one, a citizens' home two, a
   * townhouse three. Food demand grows with the people, not the roofs.
   */
  perMeal: 4,
  /**
   * Taxes above 100% drive people away directly, besides what they do to
   * approval: at x = (rate − 100) / 100, a home holds 1 − `linear`·x −
   * `square`·x² of its residents (settlers: 80% at 150%, half at 200%);
   * citizens and burghers mind `citizens` as much. So squeezing harder
   * empties the homes it squeezes, and the most a rate can bring in
   * comes well before the top of the slider.
   */
  taxFlight: { linear: 0.3, square: 0.2, citizens: 0.6 }
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

export const needTitle: Readonly<Record<Need, string>> = { food: "food", bread: "bread", cloth: "cloth", faith: "faith", furniture: "furniture" }
