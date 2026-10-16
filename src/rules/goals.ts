import { upgradeAt } from "../content.ts"
import { shippedRules, type Rules } from "./config.ts"

/** Food in storage: what would carry the town through a winter. */
export const larder = (stock: { readonly fish: number; readonly smoked: number; readonly bread: number }) => stock.fish + stock.smoked + stock.bread

/**
 * Coins a minute as the goals judge it: the last minute of the town's
 * history averaged with the ledger now, so one bulk purchase does not flip
 * "not losing any" off for ten seconds. With no history yet, the ledger.
 */
export const steadyNet = (samples: ReadonlyArray<{ readonly net: number }>, now: number, last = 4): number => {
  const recent = samples.slice(-last).map((s) => s.net)
  return Math.round(recent.concat(now).reduce((n, v) => n + v, 0) / (recent.length + 1))
}

/** The rank a town reaches next: the one after `rank`, or the last when it has reached the top. */
export const nextRank = (rank: number, rules: Rules = shippedRules) => Math.min(rank + 1, rules.ranks.length - 1)

/**
 * What the next rank asks of the town (see `ranks`), each goal met or not:
 * by default the town rank's, the goals a town founded as a village
 * plays for. A town at the top rank sees its own.
 */
export const goalsOf = (
  charter: { readonly size: keyof Rules["sizes"] },
  s: { readonly settlers: number; readonly citizens: number; readonly burghers?: number; readonly coins: number; readonly net: number; readonly approval: number; readonly hall?: number },
  rules: Rules = shippedRules,
  rank = 1
) => {
  const land = rules.sizes[charter.size].goal, r = rules.ranks[nextRank(rank, rules)]!
  const residents = s.settlers + s.citizens, burghers = s.burghers ?? 0, hall = s.hall ?? 0
  const wanted = { residents: Math.round((land.residents * r.residents) / 10) * 10, income: Math.round((land.income * r.income) / 5) * 5 }
  const hallTitle = (upgradeAt(rules.kinds.townhall, r.hall)?.title ?? "town hall").toLowerCase()
  const share = (n: number) => (residents > 0 ? Math.round((n / residents) * 100) : 0)
  return [
    { id: "residents", target: wanted.residents, text: `${wanted.residents} residents`, value: `${residents}`, met: residents >= wanted.residents },
    ...(r.citizens > 0
      ? [{ id: "citizens", target: Math.round(r.citizens * 100), text: `${Math.round(r.citizens * 100)}% of them citizens`, value: `${share(s.citizens)}%`, met: residents > 0 && s.citizens >= residents * r.citizens }]
      : []),
    ...(r.burghers > 0
      ? [{ id: "burghers", target: Math.round(r.burghers * 100), text: `${Math.round(r.burghers * 100)}% of them burghers`, value: `${share(burghers)}%`, met: residents > 0 && burghers >= residents * r.burghers }]
      : []),
    { id: "approval", target: r.approval, text: `approval ${r.approval} or more`, value: `${s.approval}`, met: s.approval >= r.approval },
    { id: "income", target: wanted.income, text: `${wanted.income} coins a minute, out of debt`, value: `${s.net}`, met: s.net >= wanted.income && s.coins >= 0 },
    ...(r.hall > 0
      ? [{ id: "hall", target: r.hall, text: `a ${hallTitle}`, value: hall >= r.hall ? "built" : "not yet", met: hall >= r.hall }]
      : [])
  ]
}

/**
 * A term's score: its people (citizens three times, burghers four), its income,
 * approval, the crown's requests met and missed, its town hall's upgrades, and the rank the town
 * stands at.
 */
export const scoreOf = (
  s: { readonly settlers: number; readonly citizens: number; readonly burghers?: number; readonly net: number; readonly approval: number; readonly met: number; readonly missed: number; readonly hall?: number },
  rank: number
) =>
  Math.max(0, Math.round(s.settlers + 3 * s.citizens + (s.burghers ?? 0) + 2 * Math.max(0, s.net) + 2 * s.approval + 40 * s.met - 40 * s.missed + 100 * (s.hall ?? 0) + 250 * rank))
