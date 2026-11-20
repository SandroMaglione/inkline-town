/**
 * What an upgrade does, for a mayor to weigh before paying for it: each
 * thing about the building it changes, from what it is now to what it
 * will be (see `asUpgraded`). The changes are data (what changes, from
 * what to what); the page's language words each ("upkeep 6 → 12 coins a
 * minute": `view.upgrade` in `i18n`), and the upgrade tool's tooltip and
 * the building's panel both read them, so the mayor is told the same
 * thing wherever they look.
 */
import { asUpgraded, nextUpgrade, upgradeAt, type GoodId, type Kind } from "../content/index.ts"
import { shippedRules, type Rules } from "./config.ts"

/**
 * One thing an upgrade changes, from what it is to what it will be:
 * - `output`: what it makes a minute, and the seconds a job takes;
 * - `workers`, `holds` (of each good), `carriers`, `firefighters`;
 * - `reach`: the road cells its walker goes; `calls`: the seconds between its walkers;
 * - `deep`: it cuts worked-out rock at full pace;
 * - `admin`: the share of the town hall's administration it saves, in percent;
 * - `appeal`: the desirability it gives nearby (`from`: `null` when it gave none), and how far out, when that changes too;
 * - `upkeep`: coins a minute.
 */
export type Change =
  | { readonly _tag: "output"; readonly good: GoodId; readonly from: number; readonly to: number; readonly secondsFrom: number; readonly secondsTo: number }
  | { readonly _tag: "workers"; readonly from: number; readonly to: number }
  | { readonly _tag: "holds"; readonly from: number; readonly to: number }
  | { readonly _tag: "carriers"; readonly from: number; readonly to: number }
  | { readonly _tag: "firefighters"; readonly from: number; readonly to: number }
  | { readonly _tag: "reach"; readonly from: number; readonly to: number }
  | { readonly _tag: "upkeep"; readonly from: number; readonly to: number }
  | { readonly _tag: "calls"; readonly from: number; readonly to: number }
  | { readonly _tag: "deep" }
  | { readonly _tag: "admin"; readonly from: number; readonly to: number }
  | { readonly _tag: "appeal"; readonly from: number | null; readonly to: number; readonly reach: number | null }

/** What changes from `level` to the next, a change each; empty when there is no next. */
export const upgradeChanges = (kind: Kind, level: number, rules: Rules = shippedRules): ReadonlyArray<Change> => {
  const up = nextUpgrade(kind, level)
  if (!up) return []
  const now = asUpgraded(kind, level), then = asUpgraded(kind, level + 1), out: Array<Change> = []
  if (now.recipe && then.recipe && now.recipe.seconds !== then.recipe.seconds) {
    const per = (k: Kind) => Math.round((60 / k.recipe!.seconds) * k.recipe!.batch)
    out.push({ _tag: "output", good: now.recipe.output, from: per(now), to: per(then), secondsFrom: now.recipe.seconds, secondsTo: then.recipe.seconds })
  }
  if (now.workers !== then.workers) out.push({ _tag: "workers", from: now.workers, to: then.workers })
  if (now.holds && then.holds && now.holds.cap !== then.holds.cap) out.push({ _tag: "holds", from: now.holds.cap, to: then.holds.cap })
  if (now.carriers !== then.carriers) out.push({ _tag: "carriers", from: now.carriers ?? 0, to: then.carriers ?? 0 })
  if (now.service && then.service) {
    if (now.service.range !== then.service.range) out.push({ _tag: "reach", from: now.service.range, to: then.service.range })
    if (now.service.seconds !== then.service.seconds) out.push({ _tag: "calls", from: now.service.seconds, to: then.service.seconds })
  }
  const crewsNow = upgradeAt(kind, level)?.crews ?? (kind.service?.service === "fire" ? rules.risk.fire.crews : undefined)
  if (up.crews !== undefined && up.crews !== crewsNow) out.push({ _tag: "firefighters", from: crewsNow ?? 0, to: up.crews })
  if (up.deep && !upgradeAt(kind, level)?.deep) out.push({ _tag: "deep" })
  if (up.admin !== undefined) out.push({ _tag: "admin", from: Math.round((upgradeAt(kind, level)?.admin ?? 0) * 100), to: Math.round(up.admin * 100) })
  const a = now.appeal, b = then.appeal
  if (b && (!a || a.value !== b.value || a.reach !== b.reach)) out.push({ _tag: "appeal", from: a ? a.value : null, to: b.value, reach: !a || a.reach !== b.reach ? b.reach : null })
  if (now.upkeep !== then.upkeep) out.push({ _tag: "upkeep", from: now.upkeep, to: then.upkeep })
  return out
}
