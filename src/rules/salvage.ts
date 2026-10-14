import type { GoodId, Kind } from "../content.ts"
import { shippedRules, type Rules } from "./config.ts"

/** What pulling something down costs, and what comes back into storage. */
export interface Salvage {
  /** Coins it costs (negative: coins back, for a cancelled site). */
  readonly fee: number
  readonly back: Partial<Record<GoodId, number>>
}

/**
 * Pulling down what was built at `cost`: a standing one costs a share of its
 * coins and gives back part of its materials (see `salvage` in content); a
 * site still owed materials (`owed`) is cancelled, and its coins and what
 * was already brought to it come back whole.
 */
export const salvageOf = (cost: Kind["cost"], owed: Partial<Record<GoodId, number>> | null = null, rules: Rules = shippedRules): Salvage => {
  const back: Partial<Record<GoodId, number>> = {}
  for (const [g, n] of Object.entries(cost.materials) as Array<[GoodId, number]>) {
    const k = owed ? n - (owed[g] ?? 0) : Math.floor(n * rules.salvage.back)
    if (k > 0) back[g] = k
  }
  return { fee: owed ? -cost.coins : Math.ceil(cost.coins * rules.salvage.fee), back }
}

/** "−25 coins · 2 planks, 3 stone back", for the bulldozer's tooltip and the toast. */
export const salvageText = (s: Salvage): string => {
  const goods = Object.entries(s.back).map(([g, n]) => `${n} ${g}`).join(", ")
  const coins = s.fee > 0 ? `−${s.fee} coins` : s.fee < 0 ? `+${-s.fee} coins` : ""
  return [coins, goods ? `${goods} back` : ""].filter((p) => p !== "").join(" · ")
}
