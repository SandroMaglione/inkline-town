/**
 * The simulation, one fixed step at a time. Nothing here touches the
 * renderer, so it runs headless too.
 */
import { Game, Time } from "../schema.ts"
import { ApplyEdits } from "./edits.ts"
import { Deliver, Dispatch } from "./logistics.ts"
import { Collect, Households, TakeCensus } from "./town.ts"
import { SendWalkers, Walk, Wander } from "./walkers.ts"
import { AssignStaff, CountStock, Grow, IndexGrid, Plant, Raise, Spread, Work } from "./work.ts"

export const AdvanceTime = Game.System(
  "Town/AdvanceTime",
  { resources: { time: Game.System.writeResource(Time) } },
  ({ resources }) => {
    resources.time.update((t) => ({ tick: t.tick + 1 }))
  }
)

export const simulate = Game.Schedule(
  AdvanceTime,
  // Edits see the stock as the last step left it, and index the grid themselves.
  ApplyEdits,
  Game.Schedule.applyDeferred(),
  IndexGrid,
  Raise,
  AssignStaff,
  Grow,
  Work,
  Plant,
  Spread,
  Dispatch,
  SendWalkers,
  Game.Schedule.applyDeferred(),
  Walk,
  Deliver,
  Wander,
  Game.Schedule.applyDeferred(),
  Households,
  Collect,
  CountStock,
  TakeCensus
)

export { CELL_STEPS } from "./shared.ts"
export { SITE_SHARE } from "./work.ts"
export { unlocked } from "./edits.ts"
export { capacity, met, satisfaction, taxOf } from "./town.ts"
