import type { GoodId } from "../content/index.ts"
import { shippedRules, type Rules } from "./config.ts"

/** Expected loss before the runtime's seeded stochastic rounding. */
export const spoilExpectation = (stock: number, good: GoodId, keeps: number, rules: Rules = shippedRules): number => {
  const life = rules.spoils[good]
  return life === undefined || stock <= 0 ? 0 : stock * rules.spoilTicks * rules.stepSeconds / (life * keeps)
}
