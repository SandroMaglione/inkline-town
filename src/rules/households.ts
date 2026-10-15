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
export const rateOf = (rates: Rates, tier: Tier) => (tier === 1 ? rates.settlers : rates.citizens)

/** How approval (-100 → 100) sits with a home: a third as many residents at its worst, half again at its best. */
export const appealOf = (approval: number): number => (approval < 0 ? 1 + approval / 150 : 1 + approval / 200)

/** The share of its residents a home keeps on a street of this desirability: all at 0 and above, fewer below, point by point. */
export const streetRoom = (desirability: number, rules: Rules = shippedRules): number =>
  Math.max(rules.home.street.roomLeast, Math.min(1, 1 + desirability / rules.home.street.room))
/** What a street does to a home's taxes: more on a fine street, less on a poor one, within a quarter either way. */
export const streetTax = (desirability: number, rules: Rules = shippedRules): number =>
  Math.max(1 - rules.home.street.taxMost, Math.min(1 + rules.home.street.taxMost, 1 + desirability / rules.home.street.tax))

/**
 * The share of its residents a home keeps at a tax rate: all at 100% and
 * below; above it fewer, faster the higher it goes (see `home.taxFlight`),
 * settlers more than citizens. This is besides what taxes do to approval.
 */
export const taxRoom = (rate: number, tier: Tier, rules: Rules = shippedRules): number => {
  const x = Math.max(0, rate - 100) / 100, f = rules.home.taxFlight
  return Math.max(0, 1 - (tier === 1 ? 1 : f.citizens) * (f.linear * x + f.square * x * x))
}

/**
 * Residents a home holds at its tier and satisfaction: half when nothing is
 * met, all when everything is; fewer when the town disapproves of its
 * mayor, and up to all of them when it approves, needs or not. A poor
 * street (desirability below 0) holds fewer, point by point (see
 * `streetRoom`): a cottage beside a quarry loses a resident at once. Taxes
 * above 100% (`rate`, its tier's) send some away (see `taxRoom`).
 */
export const capacity = (h: Needs, approval: number, desirability = 0, rules: Rules = shippedRules, rate = 100): number => {
  const max = rules.home.tiers[h.tier].residents
  return Math.max(1, Math.min(max, Math.round(max * (0.5 + 0.5 * satisfaction(h, h.tier, rules)) * appealOf(approval) * streetRoom(desirability, rules) * taxRoom(rate, h.tier, rules))))
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
/** What `more` homes add to the administration of a town of `homes`, coins a minute (not rounded). */
export const moreAdmin = (homes: number, more = 1, rules: Rules = shippedRules): number => {
  const cost = (n: number) => n * (rules.admin.perHome + n / rules.admin.growth)
  return cost(homes + more) - cost(homes)
}

/** What traders pay for one of a good now, and what they ask for one. */
export const priceOf = (good: GoodId, percent: number, rules: Rules = shippedRules) => (rules.goods[good].price * percent) / 100
export const askOf = (good: GoodId, percent: number, rules: Rules = shippedRules) => Math.ceil(priceOf(good, percent, rules) * rules.market.markup)

/** A settlers' cottage with bread on the table pays `home.breadBonus` more. */
export const breadBonus = (h: Needs, rules: Rules = shippedRules): number => (h.tier === 1 && met(h, "bread") ? 1 + rules.home.breadBonus : 1)

/**
 * Coins a home pays a minute: by its tier, the rate, the share of its needs
 * met, its street, and (for settlers) bread. A hungry home pays nothing:
 * no food, no taxes.
 */
export const taxOf = (h: Needs & { readonly residents: number }, rates: Rates, rules: Rules = shippedRules, desirability = 0): number =>
  h.food > 0
    ? h.residents * rules.home.tiers[h.tier].tax * (rateOf(rates, h.tier) / 100) * satisfaction(h, h.tier, rules) * streetTax(desirability, rules) * breadBonus(h, rules)
    : 0
/** What the same home would pay with every need met and bread on the table: the money a town leaves on the table. */
export const suppliedTaxOf = (h: Needs & { readonly residents: number }, rates: Rates, rules: Rules = shippedRules, desirability = 0): number =>
  taxOf({ ...h, food: 1, bread: 1, cloth: 1, faith: 1 }, rates, rules, desirability)

export const refreshLevel = (need: Need, rules: Rules = shippedRules) => rules.home.lasts[need] / 2
export const lowNeed = (left: number, need: Need, rules: Rules = shippedRules) => left < refreshLevel(need, rules)
export const mealDecay = (tick: number, winter: boolean) => winter && tick % 2 === 0 ? 2 : 1
/** Mean of the same two-tick meal cadence, for rate-based consumers. */
export const mealRate = (winter: boolean) => (mealDecay(0, winter) + mealDecay(1, winter)) / 2
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
export const ageNeeds = <T extends Needs & { readonly clock: number }>(h: T, eat: number): Mutable<T> => ({
  ...h, clock: h.clock + 1, food: Math.max(0, h.food - eat), bread: Math.max(0, h.bread - eat),
  cloth: Math.max(0, h.cloth - 1), faith: Math.max(0, h.faith - 1)
})

/** Citizen goods also reach settlers whose neighbourhood permits promotion. */
export const wantsCitizenGoods = (house: Needs, desirability: number, rules: Rules = shippedRules) =>
  house.tier >= 2 || desirability >= rules.home.tiers[2].appeal

/** Fish or loaves a home eats at a visit: one for every `home.perMeal` residents, rounded up, and at least one. */
export const mealsOf = (h: { readonly residents: number }, rules: Rules = shippedRules): number => Math.max(1, Math.ceil(h.residents / rules.home.perMeal))

/**
 * What a walker hands a home from its basket: a meal for its residents
 * (see `mealsOf`), of one food or, when the basket runs short, of two.
 * Citizens (and settlers on a street fit for citizens) take bread first,
 * and fish for what bread is missing; other settlers eat fish, or bread
 * when there is no fish, and take loaves besides when their bread has run
 * out, since a cottage with bread pays more (see `breadBonus`), but only
 * from the basket's surplus (more than half of it left), so the citizens
 * further along the walk are not left without. A home fed only part of
 * its meal is fed for that part of the time. Cloth goes only where
 * citizens could live.
 */
export const serveGoods = <T extends Needs & { readonly residents: number }>(house: T, available: Readonly<Record<GoodId, number>>, rules: Rules = shippedRules, desirability = 0) => {
  const h = { ...house } as Mutable<T>, basket = { ...available }
  const citizens = wantsCitizenGoods(h, desirability, rules), meals = mealsOf(h, rules)
  /** Up to `n` from the basket, of these goods in turn: how many it took. */
  const take = (goods: ReadonlyArray<GoodId>, n: number) => {
    let got = 0
    for (const g of goods) {
      const k = Math.min(n - got, basket[g])
      basket[g] -= k; got += k
    }
    return got
  }
  const lasts = (need: Need, part: number) => Math.round(rules.home.lasts[need] * part / meals)
  let eaten = 0
  const fed = (loaves: number, fish: number) => {
    h.food = lasts("food", loaves + fish); if (loaves > 0) h.bread = lasts("bread", loaves); eaten += loaves + fish
  }
  if (citizens && (lowNeed(h.food, "food", rules) || lowNeed(h.bread, "bread", rules)) && basket.bread > 0) {
    const loaves = take(["bread"], meals)
    fed(loaves, take(["fish", "smoked"], meals - loaves))
  } else if (lowNeed(h.food, "food", rules) && (basket.fish > 0 || basket.smoked > 0)) {
    const fish = take(["fish", "smoked"], meals)
    fed(take(["bread"], meals - fish), fish)
  } else if ((lowNeed(h.food, "food", rules) || (!citizens && lowNeed(h.bread, "bread", rules) && basket.bread > rules.transport.basket / 2)) && basket.bread > 0) {
    fed(take(["bread"], meals), 0)
  }
  if (citizens && lowNeed(h.cloth, "cloth", rules) && basket.cloth > 0) {
    basket.cloth -= 1; h.cloth = rules.home.lasts.cloth
  }
  return { house: h, basket, eaten }
}

/**
 * What the town's homes would pay a minute, once settled, if `tier`'s rate
 * were `rate` and stayed there: their residents then are what that rate
 * and the approval it brings let them hold (see `capacity`), with their
 * needs as they are now. Approval is its target at that rate, with the
 * grudge a rate above `mood.grudge.above` builds up to in the end.
 */
export interface TaxedHome extends Needs { readonly residents: number; readonly desirability: number; readonly paying: boolean }
export const taxOutlook = (homes: ReadonlyArray<TaxedHome>, rates: Rates, tier: "settlers" | "citizens", rate: number,
  approvalAt: (rates: Rates, memory: number) => number, rules: Rules = shippedRules): number => {
  const policy = { ...rates, [tier]: rate }
  const people = homes.reduce((n, h) => n + h.residents, 0)
  const mean = people > 0 ? homes.reduce((n, h) => n + h.residents * rateOf(policy, h.tier), 0) / people : rate
  const approval = approvalAt(policy, mean > rules.mood.grudge.above ? rules.mood.grudge.most : 0)
  return homes.reduce((sum, h) => {
    if (!h.paying) return sum
    const residents = capacity(h, approval, h.desirability, rules, rateOf(policy, h.tier))
    return sum + taxOf({ ...h, residents }, policy, rules, h.desirability)
  }, 0)
}

/** Actual collection rounding, not rounded ledger display values. */
export const baseCollection = (taxes: number, upkeep: number, homes: number, rules: Rules = shippedRules) => {
  const share = rules.ledgerTicks * rules.stepSeconds / 60
  const admin = adminOf(homes, rules)
  return { admin, delta: Math.round(taxes * share) - Math.round((upkeep + admin) * share) }
}
