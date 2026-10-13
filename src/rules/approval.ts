import { shippedRules, type Rules } from "./config.ts"
import { satisfaction, type Needs, type Rates } from "./households.ts"

export const approvalTarget = (homes: ReadonlyArray<Needs & { readonly residents: number }>, policy: Rates, coins: number, snubs: number, winter: boolean, rules: Rules = shippedRules) => {
  const people = homes.reduce((n, h) => n + h.residents, 0)
  const pleased = homes.reduce((n, h) => n + h.residents * satisfaction(h, h.tier, rules), 0)
  const taxed = homes.reduce((n, h) => n + h.residents * (h.tier === 1 ? policy.settlers : policy.citizens), 0)
  const fed = homes.filter((h) => h.food > 0).length
  const share = people > 0 ? pleased / people : 0.5, rate = people > 0 ? taxed / people : 100
  const needs = Math.round(rules.mood.needs[0] + (rules.mood.needs[1] - rules.mood.needs[0]) * share)
  const taxes = Math.round((100 - rate) * rules.mood.perTaxPoint), debt = coins < 0 ? rules.mood.debt : 0
  const crown = snubs * rules.mood.snub, hunger = winter && homes.length > 0 && fed / homes.length < 0.5 ? rules.mood.winterHunger : 0
  return { target: Math.max(-100, Math.min(100, rules.mood.base + needs + taxes + debt + crown + hunger)), base: rules.mood.base, needs, taxes, debt, crown, winter: hunger }
}
export const nextApproval = (approval: number, target: number, rules: Rules = shippedRules) =>
  approval + Math.max(-rules.mood.step, Math.min(rules.mood.step, target - approval))
