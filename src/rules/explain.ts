/**
 * Why a home is short of something, in a line that names the cause and
 * what to do about it. The panel reads these out, and the legibility test
 * checks that the usual dead ends (cloth withheld from a poor street, no
 * market in reach, nothing in store) are each told plainly. Plain
 * functions over plain facts: nothing here knows the ECS.
 */
import type { Need, Tier } from "../content.ts"
import { shippedRules, type Rules } from "./config.ts"
import { kept as keptBy, met, wantsBurgherGoods, wantsCitizenGoods, type Needs } from "./households.ts"

export interface Part {
  readonly label: string
  readonly value: number
}
/** A street as a home sees it: its desirability, and what makes it (strongest first). */
export interface Street {
  readonly desirability: number
  readonly parts: ReadonlyArray<Part>
}
/** What the town has of each provision: in storage and on market shelves together. */
export interface InTown {
  readonly fish: number
  readonly smoked: number
  readonly bread: number
  readonly cloth: number
  readonly furniture: number
}
/** Whether a walker of each kind can reach the home at all: a market's (or the town hall's) with provisions, and a chapel's. */
export interface Served {
  readonly goods: boolean
  readonly faith: boolean
}

export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

/** What counts most against a street, for a cause in a line: "quarry −6, warehouse −2". */
export const against = (parts: ReadonlyArray<Part>, most = 2): string =>
  parts.filter((p) => p.value < 0).slice(0, most).map((p) => `${p.label} ${signed(p.value)}`).join(", ")

/** A street against what the next tier needs: "−4 here, 5 needed: quarry −6". */
export const streetShort = (street: Street, needed: number): string => {
  const why = against(street.parts)
  return `${signed(street.desirability)} here, ${needed} needed${why ? `: ${why}` : ""}`
}

/** What would lift a street: the things a mayor can do. */
export const streetAdvice = (street: Street): string =>
  street.parts.some((p) => p.value < 0)
    ? "move industry away, or add a park, a chapel, or paving"
    : "a park, a chapel, or a paved street beside it"

const noWalker = (what: "market" | "chapel", rules: Rules) =>
  what === "market"
    ? `no market walker reaches this street: a market's walks ${rules.kinds.market.service!.range} road cells, the town hall's ${rules.kinds.townhall.service!.range}`
    : `no chapel walker reaches this street: a chapel's walks ${rules.kinds.chapel.service!.range} road cells`

/**
 * Why a need is unmet, as a cause and a cure, or `null` when it is met.
 * Cloth is the one a town is most often puzzled by: it is only brought to
 * a street fit for citizens, however much is in store.
 */
export const whyUnmet = (need: Need, h: Needs, street: Street, inTown: InTown, served: Served, rules: Rules = shippedRules): string | null => {
  if (met(h, need)) return null
  const needed = rules.home.tiers[2].appeal
  switch (need) {
    case "cloth": {
      if (!wantsCitizenGoods(h, street.desirability, rules))
        return `cloth is not brought here: the street is at ${signed(street.desirability)} and needs ${needed}${against(street.parts) ? ` (${against(street.parts)})` : ""}`
      if (!served.goods) return noWalker("market", rules)
      if (inTown.cloth === 0) return "the town has no cloth: a weaver makes it from a sheep farm's wool"
      return "the market's walker has not passed with cloth lately"
    }
    case "bread": {
      if (!served.goods) return noWalker("market", rules)
      if (inTown.bread === 0) return "the town has no bread: a farm's wheat goes to a mill, and its flour to a bakery"
      return "the market's walker has not passed with bread lately"
    }
    case "food": {
      if (!served.goods) return noWalker("market", rules)
      if (inTown.fish + inTown.smoked + inTown.bread === 0) return "the town has no food in store: a fishery by the water is the quickest"
      return "the market's walker has not passed lately"
    }
    case "faith": {
      if (!served.faith) return noWalker("chapel", rules)
      return "the chapel's walker has not passed lately"
    }
    case "furniture": {
      if (!wantsBurgherGoods(h, street.desirability, rules))
        return `furniture is not brought here: the street is at ${signed(street.desirability)} and a townhouse needs ${rules.home.tiers[3].appeal}${against(street.parts) ? ` (${against(street.parts)})` : ""}`
      if (!served.goods) return noWalker("market", rules)
      if (inTown.furniture === 0) return "the town has no furniture: a carpenter makes it from planks"
      return "the market's walker has not passed with furniture lately"
    }
  }
}

export interface Blocker {
  readonly what: Need | "street" | "services"
  readonly text: string
}

/**
 * Everything keeping a home from the next tier, a line each: unmet needs
 * with their causes, a street too poor, and (for a townhouse) services not
 * all calling. Empty when nothing stands in the way.
 */
export const blockers = (
  h: Needs,
  street: Street,
  inTown: InTown,
  served: Served,
  risk: { readonly fire: number; readonly health: number; readonly order: number } | undefined,
  rules: Rules = shippedRules
): ReadonlyArray<Blocker> => {
  if (h.tier >= 3) return []
  const next = (h.tier + 1) as Tier
  const out: Array<Blocker> = []
  for (const need of rules.home.tiers[next].needs) {
    const why = whyUnmet(need, h, street, inTown, served, rules)
    if (why) out.push({ what: need, text: why })
  }
  if (street.desirability < rules.home.tiers[next].appeal) out.push({ what: "street", text: `the street is ${streetShort(street, rules.home.tiers[next].appeal)} · ${streetAdvice(street)}` })
  if (next === 3 && (!risk || !keptBy(risk, rules))) {
    const high = risk ? (["fire", "health", "order"] as const).filter((r) => risk[r] >= rules.risk.kept) : ["fire", "health", "order"]
    out.push({ what: "services", text: `${high.join(", ")} not kept down: a fire watch, a healer, and a watch house must all call here` })
  }
  return out
}
