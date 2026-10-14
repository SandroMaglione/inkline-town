/**
 * The simulation, one fixed step at a time. Nothing here touches the
 * renderer, so it runs headless too.
 */
import { amounts, defaultCharter, goodIds, TRADE_LOAD } from "../content.ts"
import { Game, Time } from "../schema.ts"
import { ApplyEdits } from "./edits.ts"
import { Deliver, Dispatch } from "./logistics.ts"
import { Decay } from "./decay.ts"
import { Appraise, Douse, Hazards } from "./hazards.ts"
import { Approve, foundedFate, Judge, Record, Requests, Seasons } from "./term.ts"
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
  Appraise,
  Seasons,
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
  Douse,
  Game.Schedule.applyDeferred(),
  Households,
  Hazards,
  Game.Schedule.applyDeferred(),
  Decay,
  Game.Schedule.applyDeferred(),
  Collect,
  CountStock,
  TakeCensus,
  Requests,
  Approve,
  Judge,
  Record
)

/** The world's resources before any town is founded (a `newTown` edit fills them in). */
export const blankResources = () => ({
  Time: { tick: 0 },
  Rng: 0x5eed,
  Treasury: { coins: 0 },
  Ledger: { taxes: 0, trade: 0, upkeep: 0, admin: 0 },
  Census: { homes: 0, settlers: 0, citizens: 0, burghers: 0, jobs: 0, employed: 0, food: 0, bread: 0, cloth: 0, faith: 0, sick: 0, burning: 0 },
  Policy: { settlers: 100, citizens: 100, sells: [], buys: [], reserve: 25, loads: amounts(Object.fromEntries(goodIds.map((g) => [g, TRADE_LOAD]))) },
  Charter: { ...defaultCharter(0), founded: 0, winters: [] as Array<"none" | "mild" | "normal" | "hard"> },
  Land: { mask: "", cells: 0 },
  Market: { prices: amounts({}) },
  Mood: { approval: 0, target: 0, base: 0, needs: 0, taxes: 0, debt: 0, crown: 0, winter: 0, grudge: 0, memory: 0 },
  Crown: { open: false, good: "wood" as const, amount: 0, issued: 0, due: 0, reward: 0, next: 0, met: 0, missed: 0, streak: 0, snubs: [] },
  Fate: foundedFate(),
  History: { samples: [] },
  Chronicle: { lines: [] },
  Guide: { done: [] as Array<string>, off: false },
  Appeal: { cells: [] },
  Pantry: { eaten: 0, rotted: 0, eatenLast: 0, rottedLast: 0, warned: -1_000_000 },
  Fires: { fires: [], next: 1 },
  Grid: { owner: [], use: [] },
  Stock: amounts({})
})

export { CELL_STEPS, elapsed, seasonAt, termTicks, winterOf } from "./shared.ts"
export { SITE_SHARE } from "./work.ts"
export { lockReason, unlocked } from "./edits.ts"
export { adminOf, askOf, capacity, kept, met, priceOf, satisfaction, taxOf, tierFor } from "./town.ts"
export { crownGap, goalsOf, larder, steadyNet } from "./term.ts"
