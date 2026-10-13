import type { GoodId, Need, Tier } from "../content.ts"
import { shippedRules, type Rules } from "./config.ts"

export interface Needs {
  readonly tier: Tier
  readonly food: number
  readonly bread: number
  readonly cloth: number
  readonly faith: number
}

export const met = (h: Needs, need: Need): boolean => h[need] > 0

/** The share of its tier's needs a home has met, 0 → 1. */
export const satisfaction = (h: Needs, tier: Tier = h.tier, rules: Rules = shippedRules): number => {
  const needs = rules.home.tiers[tier].needs
  return needs.filter((n) => met(h, n)).length / needs.length
}

export interface Rates {
  readonly settlers: number
  readonly citizens: number
}
const rateOf = (rates: Rates, tier: Tier) => (tier === 1 ? rates.settlers : rates.citizens)

/** How approval (-100 → 100) sits with a home: a third as many residents at its worst, half again at its best. */
export const appealOf = (approval: number): number => (approval < 0 ? 1 + approval / 150 : 1 + approval / 200)

/**
 * Residents a home holds at its tier and satisfaction: half when nothing is
 * met, all when everything is; fewer when the town disapproves of its
 * mayor, and up to all of them when it approves, needs or not. Nobody
 * wants to live where it is squalid (desirability `rules.home.squalid` or less):
 * such a home holds fewer.
 */
export const capacity = (h: Needs, approval: number, desirability = 0, rules: Rules = shippedRules): number => {
  const max = rules.home.tiers[h.tier].residents
  const squalor = desirability <= rules.home.squalid ? rules.home.crowded : 1
  return Math.max(1, Math.min(max, Math.round(max * (0.5 + 0.5 * satisfaction(h, h.tier, rules)) * appealOf(approval) * squalor)))
}

/** Whether every risk meter of a home is kept low: a service walker of each kind passes it. */
export const kept = (r: { readonly fire: number; readonly health: number; readonly order: number }, rules: Rules = shippedRules) =>
  r.fire < rules.risk.kept && r.health < rules.risk.kept && r.order < rules.risk.kept

/**
 * The tier a home settles into: settlers whose every citizens' need is met,
 * on a street desirable enough, become citizens; citizens with a street
 * nicer still and all three services calling become burghers in a
 * townhouse. A home that loses more than one of its needs, or whose street
 * falls below its tier, steps back down.
 */
export const tierFor = (h: Needs, desirability: number, r: { readonly fire: number; readonly health: number; readonly order: number }, rules: Rules = shippedRules): Tier => {
  const fits = (tier: Tier) => desirability >= rules.home.tiers[tier].appeal
  if (h.tier === 1) return satisfaction(h, 2, rules) === 1 && fits(2) ? 2 : 1
  if (satisfaction(h, h.tier, rules) < 2 / 3 || !fits(2)) return 1
  if (h.tier === 2) return satisfaction(h, 3, rules) === 1 && fits(3) && kept(r, rules) ? 3 : 2
  return fits(3) && kept(r, rules) ? 3 : 2
}

/** Coins a minute the town hall's administration costs for `homes` homes. */
export const adminOf = (homes: number, rules: Rules = shippedRules): number => Math.round(homes * (rules.admin.perHome + homes / rules.admin.growth))

/** What traders pay for one of a good now, and what they ask for one. */
export const priceOf = (good: GoodId, percent: number, rules: Rules = shippedRules) => (rules.goods[good].price * percent) / 100
export const askOf = (good: GoodId, percent: number, rules: Rules = shippedRules) => Math.ceil(priceOf(good, percent, rules) * rules.market.markup)

/** Coins a home pays a minute. */
export const taxOf = (h: Needs & { readonly residents: number }, rates: Rates, rules: Rules = shippedRules): number =>
  h.residents * rules.home.tiers[h.tier].tax * (rateOf(rates, h.tier) / 100) * (0.25 + 0.75 * satisfaction(h, h.tier, rules))

export const lowNeed = (left: number, need: Need, rules: Rules = shippedRules) => left < rules.home.lasts[need] / 2
export const mealDecay = (tick: number, winter: boolean) => winter && tick % 2 === 0 ? 2 : 1
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
export const ageNeeds = <T extends Needs & { readonly clock: number }>(h: T, eat: number): Mutable<T> => ({
  ...h, clock: h.clock + 1, food: Math.max(0, h.food - eat), bread: Math.max(0, h.bread - eat),
  cloth: Math.max(0, h.cloth - 1), faith: Math.max(0, h.faith - 1)
})

/** One goods visit. Bread is preferred for food even at a settlers' home. */
export const serveGoods = <T extends Needs>(house: T, available: Readonly<Record<GoodId, number>>, rules: Rules = shippedRules) => {
  const h = { ...house } as Mutable<T>, basket = { ...available }
  let eaten = 0
  if ((lowNeed(h.food, "food", rules) || (h.tier >= 2 && lowNeed(h.bread, "bread", rules))) && basket.bread > 0) {
    basket.bread -= 1; h.food = rules.home.lasts.food; h.bread = rules.home.lasts.bread; eaten += 1
  } else if (lowNeed(h.food, "food", rules) && (basket.fish > 0 || basket.smoked > 0)) {
    const g = basket.fish > 0 ? "fish" : "smoked"
    basket[g] -= 1; h.food = rules.home.lasts.food; eaten += 1
  }
  if (lowNeed(h.cloth, "cloth", rules) && basket.cloth > 0) {
    basket.cloth -= 1; h.cloth = rules.home.lasts.cloth
  }
  return { house: h, basket, eaten }
}

/** Actual collection rounding, not rounded ledger display values. */
export const baseCollection = (taxes: number, upkeep: number, homes: number, rules: Rules = shippedRules) => {
  const share = rules.ledgerTicks * rules.stepSeconds / 60
  const admin = adminOf(homes, rules)
  return { admin, delta: Math.round(taxes * share) - Math.round((upkeep + admin) * share) }
}
