import type { WinterId } from "../content.ts"
import { ruleTicks, shippedRules, type Rules } from "./config.ts"

// ── Time ──────────────────────────────────────────────────────────────────

/** Steps since the town was founded. */
export const elapsed = (time: { readonly tick: number }, charter: { readonly founded: number }) => time.tick - charter.founded
export const termTicks = (charter: { readonly term: number }, rules: Rules = shippedRules) => ruleTicks(charter.term * 60, rules)
export const yearTicks = (charter: { readonly term: number }, rules: Rules = shippedRules) => Math.round(termTicks(charter, rules) / rules.yearsPerTerm)

/** A charter's winters: the first year has none. */
export type Almanac = ReadonlyArray<WinterId | "none">
export interface Seasoned {
  readonly term: number
  readonly winters?: Almanac
}

/** The winter that ends year `year` (from 1), or `null` for none: the first year's, and any past the terms rolled so far. */
export const winterOf = (charter: Seasoned, year: number, rules: Rules = shippedRules): WinterId | null => {
  if (year <= 1 || year > Math.max(rules.yearsPerTerm, charter.winters?.length ?? 0)) return null
  const w = charter.winters?.[year - 1]
  return w === undefined ? "normal" : w === "none" ? null : w
}

/** Rolls a term's winters from a random number in 0 → 1 a year: the first term's first year is `spared`, a later term's is not. */
export const rollWinters = (next: () => number, rules: Rules = shippedRules, spared = true): Array<WinterId | "none"> =>
  Array.from({ length: rules.yearsPerTerm }, (_, i) => {
    if (i === 0 && spared) return "none"
    const r = next()
    return r < rules.winters.mild.chance ? "mild" : r < rules.winters.mild.chance + rules.winters.normal.chance ? "normal" : "hard"
  })

/**
 * The season `t` steps into a term: which year, whether it is winter (and
 * which), how long until that changes, and the next winter the almanac
 * foresees. The first year is spared its winter: a new town has a year to
 * find its feet. A hard winter starts earlier in its year and lasts half
 * as long again.
 */
export const seasonAt = (t: number, charter: Seasoned, rules: Rules = shippedRules) => {
  const year = yearTicks(charter, rules)
  const into = t % year
  const number = Math.floor(t / year) + 1
  const thawOf = (n: number) => {
    const w = winterOf(charter, n, rules)
    return w === null ? year : Math.round(year * (1 - rules.winters[w].share))
  }
  const thaw = thawOf(number)
  const winter = into >= thaw
  // The next winter to come: this year's, if it is still ahead, or the next's.
  const ahead = !winter && winterOf(charter, number, rules) !== null ? number : number + 1
  const left = winter ? year - into : ahead === number ? thaw - into : year - into + thawOf(number + 1)
  return {
    year: number,
    winter,
    /** This winter's severity, while it lasts. */
    severity: winter ? winterOf(charter, number, rules) : null,
    /** The coming winter's severity, or `null` when the term ends first. */
    coming: winterOf(charter, ahead, rules),
    left
  }
}
