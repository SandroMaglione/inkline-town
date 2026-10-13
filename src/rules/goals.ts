import { shippedRules, type Rules } from "./config.ts"

/** Food in storage: what would carry the town through a winter. */
export const larder = (stock: { readonly fish: number; readonly smoked: number; readonly bread: number }) => stock.fish + stock.smoked + stock.bread

/** Each goal the town must hold to be complete, met or not. */
export const goalsOf = (
  charter: { readonly size: keyof Rules["sizes"] },
  s: { readonly settlers: number; readonly citizens: number; readonly coins: number; readonly net: number; readonly approval: number },
  rules: Rules = shippedRules
) => {
  const goal = rules.sizes[charter.size].goal
  const residents = s.settlers + s.citizens
  return [
    { id: "residents", text: `${goal.residents} residents`, value: `${residents}`, met: residents >= goal.residents },
    { id: "citizens", text: `${Math.round(rules.fate.citizens * 100)}% of them citizens`, value: `${residents > 0 ? Math.round((s.citizens / residents) * 100) : 0}%`, met: residents > 0 && s.citizens >= residents * rules.fate.citizens },
    { id: "approval", text: `approval ${rules.fate.approval} or more`, value: `${s.approval}`, met: s.approval >= rules.fate.approval },
    { id: "coins", text: `${goal.coins} coins, not losing any`, value: `${s.coins}`, met: s.coins >= goal.coins && s.net >= 0 }
  ] as const
}

/** The town's score at the end of its term. */
export const scoreOf = (s: { readonly settlers: number; readonly citizens: number; readonly coins: number; readonly approval: number; readonly met: number; readonly missed: number }, won: boolean, minutesLeft: number) =>
  Math.max(0, Math.round(s.settlers + 3 * s.citizens + Math.max(0, s.coins) / 20 + 2 * s.approval + 40 * s.met - 40 * s.missed + (won ? 500 + 20 * minutesLeft : 0)))
