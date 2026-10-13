import type { KindId, Tier } from "../content.ts"
import type { TileLike } from "../grid.ts"
import { shippedRules, type Rules } from "./config.ts"

export const near = (a: TileLike, b: TileLike, r: number) =>
  Math.max(a.x - (b.x + b.size - 1), b.x - (a.x + a.size - 1), a.y - (b.y + b.size - 1), b.y - (a.y + a.size - 1)) <= r
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
export const paceAt = (x: number, y: number, rules: Rules = shippedRules) => rules.risk.pace[0] + (rules.risk.pace[1] - rules.risk.pace[0]) * hash(x, y)
export interface RiskInputs {
  readonly tile: TileLike; readonly condition: number; readonly desirability: number; readonly approval: number
  readonly heating: boolean; readonly hotNearby: number; readonly dusty: boolean; readonly water: boolean
  readonly house?: { readonly tier: Tier; readonly residents: number; readonly food: number }
  readonly kind?: KindId
}
/** Integer meter increments at the game's one-second hazard checkpoint. */
export const riskIncrements = (input: RiskInputs, rules: Rules = shippedRules) => {
  const { risk, home } = rules, { house: h } = input
  const worn = input.condition < rules.condition.worn, squalid = input.desirability < 0
  let fire = 0, health = 0, order = 0
  if (h) {
    const max = home.tiers[h.tier].residents, crowded = h.residents >= max * 0.75
    fire = (h.tier === 1 ? risk.fire.wooden : risk.fire.stone) + Math.min(2, input.hotNearby) * risk.fire.near +
      (crowded ? risk.fire.crowded : 0) + (worn ? risk.fire.worn : 0) + (input.heating ? risk.fire.winter : 0)
    health = risk.health.base + (h.food <= 0 ? risk.health.hungry : 0) + (crowded ? risk.health.crowded : 0) +
      (squalid ? risk.health.squalid : 0) + (input.dusty ? risk.health.dust : 0) + (input.water ? risk.health.water : 0)
    order = risk.order.base + (input.approval < 0 ? Math.round((-input.approval / 50) * risk.order.unrest) : 0) +
      (squalid ? risk.order.squalid : 0) + (h.residents < max / 2 ? risk.order.vacant : 0) + (h.tier === 3 ? risk.order.wealth : 0)
  } else if (input.kind) fire = risk.fire.building + (rules.kinds[input.kind].hot ? risk.fire.hot : 0) + (worn ? risk.fire.worn : 0)
  const pace = paceAt(input.tile.x, input.tile.y, rules)
  return { fire: Math.round(fire * pace), health: Math.round(health * pace), order: Math.round(order * pace) }
}
