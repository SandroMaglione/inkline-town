/**
 * What the town is made of, as plain data: goods, the buildings that
 * gather, make, store, and hand them out, and the tiers of homes. Costs,
 * upkeep, and taxes are in coins; durations in seconds, turned into whole
 * simulation steps by `Clock.duration` (literals) and `stepsOf` (data).
 * `archetypes.ts` turns each entry into the components an entity is spawned
 * with; nothing here knows about the ECS beyond its clock's step.
 *
 * Each closed set lives in its own module beside this one (the building
 * kinds one file per category, in `kinds/`); this file only gathers them,
 * so everything is still imported from here.
 */
export { every, periodOf, step, stepsOf } from "./clock.ts"
export {
  amounts, each, foods, goodIds, goods, none, provisions, RESERVE_MAX, shownGoods, SPOIL_TICKS, spoils, total, trade, TRADE_LOAD,
  type Amounts, type GoodId
} from "./goods.ts"
export {
  asUpgraded, builtCost, categoryColor, categoryOrder, homeColor, kindIds, kindOrder, kinds, nextUpgrade, serviceIds, upgradeAt, upkeepOf, WORKS_TICKS, worksNeeded,
  type Category, type Crew, type Kind, type KindId, type Level, type ServiceId, type Source, type Topper, type Upgrade
} from "./kinds/index.ts"
export { anA, costText } from "./text.ts"
export { groundIds, grounds, park, propIds, props, type GroundId, type ParkPiece, type PropId } from "./parks.ts"
export { APPRENTICE, COMMUTE, crewOf, home, needTitle, tierHome, tierIds, TOOL_STOCK, type Need, type Tier } from "./homes.ts"
export { appeal, PAVE_COST, PAVED_PACE } from "./streets.ts"
export { condition, CONDITION_MAX, risk, RISK_MAX } from "./risks.ts"
export {
  defaultCharter, FACE_TICKS, GROWN, landIds, lands, RESTOCK_TICKS, ROCK_AMOUNT, sizeIds, sizes, TERMS, WINTER_SHARE, WINTER_WARNING, winterIds, winters, YEARS_PER_TERM,
  type CharterValue, type LandId, type SizeId, type WinterId
} from "./lands.ts"
export { admin, BUILD_TICKS, crown, fate, HISTORY_TICKS, LEDGER_TICKS, market, mood, PAUSED_UPKEEP, ranks, ROAD_COST, salvage, TAX_STEPS, TOWN_RANK } from "./town.ts"
