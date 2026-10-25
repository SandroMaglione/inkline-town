/**
 * The simulation, one fixed step at a time. Nothing here touches the
 * renderer, so it runs headless too.
 */
import { Clock } from "@typeonce/ritmo"
import * as Random from "@typeonce/ritmo/Random"
import { amounts, defaultCharter, goodIds, step, TRADE_LOAD } from "./content/index.ts"
import { Game, Time } from "./schema.ts"
import { ApplyEdits } from "./systems/edits/index.ts"
import { Deliver, Dispatch } from "./systems/logistics/index.ts"
import { Decay } from "./systems/decay/index.ts"
import { Appraise, Douse, Hazards } from "./systems/hazards/index.ts"
import { DropOrphans } from "./systems/orphans/index.ts"
import { Approve, foundedFate, Judge, Record, Requests, Seasons } from "./systems/term/index.ts"
import { Collect, Households, TakeCensus } from "./systems/town/index.ts"
import { SendWalkers, Walk, Wander } from "./systems/walkers/index.ts"
import { AssignStaff, CountStock, Grow, IndexGrid, Plant, Raise, Spread, Work } from "./systems/work/index.ts"

export const AdvanceTime = Clock.system(Game, { name: "Town/AdvanceTime", resource: Time })

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
  // Walkers and fields whose building went before they joined it go now.
  DropOrphans,
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

/**
 * The player's edits, applied without a step of time: for edits that may come
 * while the town waits (paused, founding, or a term over) and must not move it
 * on, such as the guide's.
 */
export const settle = Game.Schedule(ApplyEdits, Game.Schedule.applyDeferred())

/** The world's resources before any town is founded (a `newTown` edit fills them in). */
export const blankResources = () => ({
  Time: Clock.start(step),
  Rng: Random.seed(0x5eed),
  Treasury: { coins: 0 },
  Ledger: { taxes: 0, trade: 0, upkeep: 0, admin: 0 },
  Census: { homes: 0, settlers: 0, citizens: 0, burghers: 0, jobs: 0, employed: 0, food: 0, bread: 0, cloth: 0, faith: 0, furniture: 0, sick: 0, burning: 0 },
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
  Stock: amounts({}),
  Handed: { log: [] },
  Flow: { town: "", since: 0, start: null, made: amounts({}), traded: amounts({}), held: amounts({}), coins: { start: 0, made: 0, traded: 0, seen: 0, booked: 0 }, slices: [], last: null }
})

export { CELL_STEPS, elapsed, seasonAt, termTicks, winterOf } from "./systems/shared.ts"
export { SITE_SHARE } from "./systems/work/index.ts"
export { lockReason, unlocked, upgradeBlock } from "./systems/edits/index.ts"
export { adminOf, askOf, capacity, kept, met, priceOf, satisfaction, taxOf, tierFor } from "./systems/town/index.ts"
export { crownGap, goalsOf, larder, steadyNet } from "./systems/term/index.ts"
