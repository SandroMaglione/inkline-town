/**
 * Why a home is short of something: the cause, and what to build about it.
 * The causes are data (which cause, with its numbers); the page's language
 * puts each into a line that names it and says what to do (`view.cause` in
 * `i18n`), the panel reads those out, and the legibility test checks that
 * the usual dead ends (cloth withheld from a poor street, no market in
 * reach, nothing in store) are each told plainly. Plain functions over
 * plain facts: nothing here knows the ECS, or a language.
 */
import type { KindId, Need, Tier } from "../content/index.ts"
import type { AppealPart } from "../world/appeal.ts"
import { shippedRules, type Rules } from "./config.ts"
import { kept as keptBy, met, wantsBurgherGoods, wantsCitizenGoods, type Needs } from "./households.ts"

/** A street as a home sees it: its desirability, and what makes it (strongest first). */
export interface Street {
  readonly desirability: number
  readonly parts: ReadonlyArray<AppealPart>
}
/** What the town has of each provision: in storage and on market shelves together. */
export interface InTown {
  readonly fish: number
  readonly smoked: number
  readonly bread: number
  readonly cloth: number
  readonly furniture: number
}
/** Whether a walker of each kind can reach the home at all: a market's (or the town hall's) with provisions, and a chapel's. */
export interface Served {
  readonly goods: boolean
  readonly faith: boolean
}

/** What counts most against a street, for a cause in a line: the quarry −6, the warehouse −2. */
export const against = (parts: ReadonlyArray<AppealPart>, most = 2): ReadonlyArray<AppealPart> => parts.filter((p) => p.value < 0).slice(0, most)

/** Whether anything drags a street down (then the advice is to move it away), or it only lacks what would lift it. */
export const draggedDown = (street: Street): boolean => street.parts.some((p) => p.value < 0)

/** The risks a home's services keep down. */
export type RiskId = "fire" | "health" | "order"

/**
 * Why something is so, and what to build about it (`build`: the chain that
 * makes it, first link first; the panel offers the first one the town
 * lacks). Each cause carries the numbers its line is told with:
 * - `noWalker`: no market's (or chapel's) walker reaches the street; how far one walks, and (a market) how far the town hall's does.
 * - `tooPoor`: the good is not brought to a street below `needed`.
 * - `noneInTown`: the town has none of it.
 * - `notLately`: it is all there, and the walker has only not passed lately: nothing to do but wait.
 * - `unkept`: the risks (`high`) a townhouse's services are not keeping down.
 */
export type Cause =
  | { readonly _tag: "noWalker"; readonly service: "market" | "chapel"; readonly range: number; readonly hallRange: number; readonly build: ReadonlyArray<KindId> }
  | { readonly _tag: "tooPoor"; readonly need: "cloth" | "furniture"; readonly needed: number; readonly desirability: number }
  | { readonly _tag: "noneInTown"; readonly need: Exclude<Need, "faith">; readonly build: ReadonlyArray<KindId> }
  | { readonly _tag: "notLately"; readonly need: Need }
  | { readonly _tag: "unkept"; readonly high: ReadonlyArray<RiskId>; readonly build: ReadonlyArray<KindId> }

/** What a cause would have the town build, if anything. */
export const buildFor = (c: Cause): ReadonlyArray<KindId> | undefined => ("build" in c ? c.build : undefined)

/** No walker reaches the home. */
const noWalker = (service: "market" | "chapel", rules: Rules): Cause => ({
  _tag: "noWalker",
  service,
  range: rules.kinds[service].service!.range,
  hallRange: rules.kinds.townhall.service!.range,
  build: [service]
})

/**
 * Why a need is unmet, as a cause and a cure, or `null` when it is met.
 * Cloth is the one a town is most often puzzled by: it is only brought to
 * a street fit for citizens, however much is in store.
 */
export const causeOf = (need: Need, h: Needs, street: Street, inTown: InTown, served: Served, rules: Rules = shippedRules): Cause | null => {
  if (met(h, need)) return null
  switch (need) {
    case "cloth": {
      if (!wantsCitizenGoods(h, street.desirability, rules)) return { _tag: "tooPoor", need, needed: rules.home.tiers[2].appeal, desirability: street.desirability }
      if (!served.goods) return noWalker("market", rules)
      if (inTown.cloth === 0) return { _tag: "noneInTown", need, build: ["sheep", "weaver"] }
      return { _tag: "notLately", need }
    }
    case "bread": {
      if (!served.goods) return noWalker("market", rules)
      if (inTown.bread === 0) return { _tag: "noneInTown", need, build: ["farm", "mill", "bakery"] }
      return { _tag: "notLately", need }
    }
    case "food": {
      if (!served.goods) return noWalker("market", rules)
      if (inTown.fish + inTown.smoked + inTown.bread === 0) return { _tag: "noneInTown", need, build: ["fishery"] }
      return { _tag: "notLately", need }
    }
    case "faith": {
      if (!served.faith) return noWalker("chapel", rules)
      return { _tag: "notLately", need }
    }
    case "furniture": {
      if (!wantsBurgherGoods(h, street.desirability, rules)) return { _tag: "tooPoor", need, needed: rules.home.tiers[3].appeal, desirability: street.desirability }
      if (!served.goods) return noWalker("market", rules)
      if (inTown.furniture === 0) return { _tag: "noneInTown", need, build: ["sawmill", "carpenter"] }
      return { _tag: "notLately", need }
    }
  }
}

/** The services a townhouse wants calling that are not keeping its risks down, as a cause. */
export const servicesCause = (risk: { readonly fire: number; readonly health: number; readonly order: number } | undefined, rules: Rules = shippedRules): Cause | null => {
  if (risk && keptBy(risk, rules)) return null
  const high = (["fire", "health", "order"] as const).filter((r) => !risk || risk[r] >= rules.risk.kept)
  const by = { fire: "firewatch", health: "healer", order: "watchhouse" } as const
  return { _tag: "unkept", high, build: high.map((r) => by[r]) }
}

/**
 * Something keeping a home from the next tier: an unmet need or services
 * not all calling, with its cause; or a street too poor (`needed`: the
 * desirability the next tier asks).
 */
export type Blocker =
  | { readonly what: Need | "services"; readonly cause: Cause }
  | { readonly what: "street"; readonly street: Street; readonly needed: number }

/**
 * Everything keeping a home from the next tier, each with its cause: unmet
 * needs, a street too poor, and (for a townhouse) services not all
 * calling. Empty when nothing stands in the way.
 */
export const blockers = (
  h: Needs,
  street: Street,
  inTown: InTown,
  served: Served,
  risk: { readonly fire: number; readonly health: number; readonly order: number } | undefined,
  rules: Rules = shippedRules
): ReadonlyArray<Blocker> => {
  if (h.tier >= 3) return []
  const next = (h.tier + 1) as Tier
  const out: Array<Blocker> = []
  for (const need of rules.home.tiers[next].needs) {
    const cause = causeOf(need, h, street, inTown, served, rules)
    if (cause) out.push({ what: need, cause })
  }
  if (street.desirability < rules.home.tiers[next].appeal) out.push({ what: "street", street, needed: rules.home.tiers[next].appeal })
  const services = next === 3 ? servicesCause(risk, rules) : null
  if (services) out.push({ what: "services", cause: services })
  return out
}
