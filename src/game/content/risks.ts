/** Risks: fire, sickness, and disorder in homes and buildings, and the wear that runs them down. */
import { Clock } from "@typeonce/ritmo"
import { step } from "./clock.ts"

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
    burns: Clock.steps(Clock.duration(step, 20)),
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
    lasts: Clock.steps(Clock.duration(step, 60)),
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
  every: Clock.steps(Clock.duration(step, 4)),
  /** Below this, a builder mends it as they pass (after about 23 minutes without repair). */
  mend: 650,
  /** Below this, it works at half pace, and its fire risk rises. */
  worn: 500
}
