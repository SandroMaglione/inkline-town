/**
 * Every building kind, gathered from its category's file into the one
 * table the game reads. A new kind is added to `kindIds` and to its
 * category's file; `all` and `kinds` below then refuse to compile until
 * it is in one of those files and listed here too.
 */
import { crafts } from "./crafts.ts"
import { food } from "./food.ts"
import { gathering } from "./gathering.ts"
import type { Kind, KindId } from "./kind.ts"
import { services } from "./services.ts"
import { storage } from "./storage.ts"
import { townHall } from "./townhall.ts"

export * from "./kind.ts"

/** Every category's kinds together: each id must be in one of the files. */
const all = { ...townHall, ...storage, ...gathering, ...crafts, ...food, ...services } satisfies Record<KindId, Kind>
const {
  townhall, warehouse, granary, lumberjack, forester, quarry, mine, fishery, smokehouse, sawmill, smithy,
  farm, mill, bakery, sheep, weaver, carpenter, market, chapel, firewatch, healer, hospital, watchhouse, builder
} = all

// Each flat-roofed kind's `half` splits evenly into its bays (2 × half / bays
// is whole), so every window and topper sits on whole units. Listed in the
// order the kinds have always been in (what `Object.keys` sees, and so what
// the rules and a replay see), not by category.
export const kinds: Readonly<Record<KindId, Kind>> = {
  townhall, warehouse, granary, lumberjack, forester, quarry, mine, fishery, smokehouse, sawmill, smithy,
  farm, mill, bakery, sheep, weaver, carpenter, market, chapel, firewatch, healer, hospital, watchhouse, builder
}

export const kindOrder: ReadonlyArray<KindId> = [
  "warehouse", "granary", "lumberjack", "forester", "quarry", "mine", "sawmill", "smithy", "sheep", "weaver", "carpenter",
  "fishery", "smokehouse", "farm", "mill", "bakery", "market", "chapel", "firewatch", "healer", "hospital", "watchhouse", "builder"
]
