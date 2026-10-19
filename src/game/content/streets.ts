/** Desirability the land and the town give, and what paving a street costs and does. */
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
  /** A citizens' home and a townhouse lift the homes beside them (never themselves), all told up to `homesMost`. */
  citizens: { value: 1, reach: 1 },
  burghers: { value: 2, reach: 1 },
  homesMost: 3,
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
