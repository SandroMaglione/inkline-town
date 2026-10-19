/**
 * Running the town: building and collecting, administration, approval,
 * the crown, the market, the end states, and the ranks the town rises
 * through.
 */
import { Clock } from "@typeonce/ritmo"
import { step } from "./clock.ts"

/** How long anything takes to go up once its materials are in. */
export const BUILD_TICKS = Clock.steps(Clock.duration(step, 2.4))
/** Taxes are collected and upkeep paid this often. */
export const LEDGER_TICKS = Clock.steps(Clock.duration(step, 10))
export const ROAD_COST = 2

/** Tax rates the town can set, in percent of the usual. */
export const TAX_STEPS = [50, 75, 100, 125, 150, 200] as const

/**
 * Running a town costs more the bigger it gets, and it is reckoned by the
 * person, not the roof: the town hall's administration costs `perResident`
 * coins a minute a resident, and a further (residents / `growth`) a
 * resident. Each more resident costs `perResident` + 2·residents /
 * `growth`: about half a settler's taxes at 320 residents (a medium
 * town's goal), and all of them by about 580, so past there a town grows by
 * finer homes; and a citizens' home of eight costs twice a cottage of
 * four, so finer homes are not had for nothing either.
 */
export const admin = { perResident: 0.125, growth: 490 }

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
  reward: 1.3,
  fine: 1,
  bonus: 25,
  /** How long the crown remembers a missed request, in minutes. */
  memory: 4,
  /** Requests missed in a row before the crown dismisses the mayor. */
  patience: 3
}

/**
 * The market: each good's price moves with what the town trades. Selling
 * drives it down `perUnit` points a unit, buying up `perBought`. A cheap
 * price drifts back by a tenth of the gap every collection, a dear one by
 * only 1/`calms` of it: traders top up a shortfall, but a town that lives
 * on bought food pays more for it every minute. Buying costs half again
 * the price.
 */
export const market = { floor: 30, ceiling: 250, perUnit: 1, perBought: 3, markup: 1.5, calms: 30 }

/** A paused building pays this share of its upkeep. */
export const PAUSED_UPKEEP = 0.25

/**
 * Pulling down a standing building or home: a `fee` of what it cost in
 * coins, and `back` of its materials (rounded down) carried back into
 * storage. A site not yet going up is cancelled instead: its coins and
 * whatever was brought to it come back in full.
 */
export const salvage = { fee: 0.1, back: 0.5 }

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
  /** The town rank's goals besides residents and coins: a share of them citizens, and approval (see `ranks`). */
  citizens: 0.3,
  approval: 15
}

/**
 * The town's ranks, from the hamlet it is founded as. It rises to the next
 * once every goal of that rank has held for `fate.hold` minutes together:
 * `residents` and `income` (out of debt) as shares of its land's goal
 * (see `sizes`), a share of the residents `citizens` (those in townhouses
 * count), a share `burghers`, approval, and (a city) a town hall upgraded
 * `hall` times, a guildhall. A rank is never lost, and the crown sends
 * `reward` coins on reaching it. The town rank is the old "complete" town;
 * nothing ends when a rank is reached.
 */
export const ranks: ReadonlyArray<{
  readonly title: string
  readonly residents: number
  readonly income: number
  readonly citizens: number
  readonly burghers: number
  readonly approval: number
  readonly hall: number
  readonly reward: number
}> = [
  { title: "hamlet", residents: 0, income: 0, citizens: 0, burghers: 0, approval: 0, hall: 0, reward: 0 },
  { title: "village", residents: 0.35, income: 0.3, citizens: 0.1, burghers: 0, approval: 0, hall: 0, reward: 300 },
  { title: "town", residents: 1, income: 1, citizens: fate.citizens, burghers: 0, approval: fate.approval, hall: 0, reward: 800 },
  { title: "city", residents: 1.5, income: 1.5, citizens: 0.5, burghers: 0.15, approval: 25, hall: 1, reward: 1500 }
]
/** The rank the old "complete" town is: the goals a balance run plays for. */
export const TOWN_RANK = 2

/** The town's history: a sample this often. */
export const HISTORY_TICKS = Clock.steps(Clock.duration(step, 15))
