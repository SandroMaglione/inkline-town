/**
 * The town's numbers for the top bar and the panels: money, people, the
 * season and the almanac, the crown, the term, the goods' flow, history, and
 * what the alerts, the upgrades, and the guide say.
 */
import { amounts, crown as crownRules, fate, goodIds, ranks, TAX_STEPS } from "../game/content/index.ts"
import { approvalTarget } from "../game/rules/approval.ts"
import { suppliedTaxOf, taxOutlook, type TaxedHome } from "../game/rules/households.ts"
import { elapsed, goalsOf, larder, seasonAt, steadyNet, termTicks, winterOf } from "../game/schedule.ts"
import { appealAt } from "../game/world/appeal.ts"
import type { Alert, Stats } from "./contracts.ts"
import type { BuildingRow, Frame } from "./frame.ts"

/** What the numbers are reckoned from, shared with the guide. */
export const numbersOf = (frame: Frame) => {
  const { houses, rates, cells } = frame
  const ledger = frame.world.ledger
  const charter = frame.world.charter
  const t = elapsed(frame.world.time, charter)
  let suppliedTaxes = 0
  for (const { data } of houses) {
    if (data.site.present || data.rising.present || data.burning.present) continue
    const tile = data.tile.get()
    suppliedTaxes += suppliedTaxOf(data.house.get(), rates, undefined, appealAt(cells, tile.x, tile.y))
  }
  const coins = frame.world.treasury.coins
  const net = ledger.taxes + ledger.trade - ledger.upkeep - ledger.admin
  const mood = frame.world.mood
  const crown = frame.world.crown
  // What the homes would pay at each step of each tier's rate, once settled there (see `taxOutlook`).
  const taxed: Array<TaxedHome> = []
  for (const { data } of houses) {
    if (data.site.present || data.rising.present || data.burning.present || data.closed.present) continue
    const tile = data.tile.get()
    taxed.push({ ...data.house.get(), desirability: appealAt(cells, tile.x, tile.y), paying: true })
  }
  const f = frame.world.fate
  const pantry = frame.world.pantry
  const season = seasonAt(Math.min(Math.max(0, t), f.began + termTicks(charter) - 1), charter)
  const approvalAt = (r: { readonly settlers: number; readonly citizens: number }, memory: number) =>
    approvalTarget(taxed, r, coins, crown.snubs.length, season.winter, undefined, memory).target
  const outlookOf = (tier: "settlers" | "citizens") => taxed.some((h) => (h.tier === 1) === (tier === "settlers"))
    ? TAX_STEPS.map((rate) => ({ rate, taxes: Math.round(taxOutlook(taxed, rates, tier, rate, approvalAt)) }))
    : []
  const seconds = (steps: number) => Math.max(0, Math.ceil(steps / 60))
  const danger = (since: number, minutes: number) => (since < 0 ? null : seconds(since + minutes * 3600 - t))
  // The winter after the coming one, for the almanac.
  const comingYear = season.winter || winterOf(charter, season.year) === null ? season.year + 1 : season.year
  return { ledger, charter, t, suppliedTaxes, coins, net, mood, crown, f, pantry, season, outlookOf, seconds, danger, comingYear }
}
export type Numbers = ReturnType<typeof numbersOf>

/** The rest of what `Stats` shows, reckoned elsewhere. */
interface Said {
  readonly alerts: ReadonlyArray<Alert>
  readonly shortStaffed: Stats["shortStaffed"]
  readonly upgrades: Stats["upgrades"]
  readonly guide: Stats["guide"]
  readonly hallRow: BuildingRow | undefined
}

export const statsOf = (frame: Frame, numbers: Numbers, { alerts, shortStaffed, upgrades, guide, hallRow }: Said): Stats => {
  const { houses, rates } = frame
  const census = frame.world.census
  const stock = frame.world.stock
  const { ledger, charter, t, suppliedTaxes, coins, net, mood, crown, f, pantry, season, outlookOf, seconds, danger, comingYear } = numbers
  const flowNow = frame.world.flow.last
  const flowHeld = frame.world.flow.held
  return {
    coins,
    taxes: ledger.taxes,
    suppliedTaxes: Math.round(suppliedTaxes),
    taxOutlook: { settlers: outlookOf("settlers"), citizens: outlookOf("citizens") },
    trade: ledger.trade,
    upkeep: ledger.upkeep,
    admin: ledger.admin,
    net,
    homes: census.homes,
    needs: { food: census.food, bread: census.bread, cloth: census.cloth, faith: census.faith, furniture: census.furniture },
    townhouses: houses.filter(({ data }) => data.house.get().tier === 3).length,
    policy: rates,
    stock,
    prices: frame.world.market.prices,
    settlers: census.settlers,
    citizens: census.citizens,
    burghers: census.burghers,
    jobs: census.jobs,
    employed: census.employed,
    shortStaffed,
    charter: { size: charter.size, term: charter.term, land: charter.land, seed: charter.seed },
    minute: t / 3600,
    season: {
      year: season.year,
      winter: season.winter,
      left: seconds(season.left),
      severity: season.severity,
      coming: season.coming,
      after: winterOf(charter, comingYear + 1)
    },
    mood: {
      approval: mood.approval,
      target: mood.target,
      parts: [
        { label: "mood of the town", value: mood.base },
        { label: "needs met", value: mood.needs },
        { label: "taxes now", value: mood.taxes },
        { label: "a grudge over taxes past", value: mood.grudge },
        { label: "unpaid wages", value: mood.debt },
        { label: "the crown's displeasure", value: mood.crown },
        { label: "a hungry winter", value: mood.winter }
      ].filter((p) => p.value !== 0)
    },
    crown: {
      open: crown.open,
      good: crown.good,
      amount: crown.amount,
      left: seconds(crown.due - t),
      reward: crown.reward,
      met: crown.met,
      missed: crown.missed,
      streak: crown.streak,
      patience: crownRules.patience,
      next: seconds(crown.next - t)
    },
    fate: {
      state: f.state,
      reason: f.reason,
      at: f.at / 3600,
      term: f.term,
      began: f.began / 3600,
      rank: f.rank,
      rankTitle: ranks[f.rank]?.title ?? "",
      nextTitle: f.rank + 1 < ranks.length ? ranks[f.rank + 1]!.title : null,
      score: f.score,
      bankrupt: danger(f.debtSince, fate.debt),
      revolt: danger(f.revoltSince, fate.revolt),
      rises: danger(f.goalSince, fate.hold),
      peak: f.peak
    },
    goals: goalsOf(
      charter,
      { settlers: census.settlers, citizens: census.citizens, burghers: census.burghers, coins, net: steadyNet(frame.world.history.samples, net), approval: mood.approval,
        hall: hallRow ? hallRow.data.upgraded.value()?.level ?? 0 : 0 },
      undefined,
      f.rank
    ),
    larder: larder(stock),
    flow: flowNow === null ? null : { ...flowNow, elsewhere: amounts(Object.fromEntries(goodIds.map((g) => [g, Math.max(0, flowHeld[g] - stock[g])]))) },
    eaten: pantry.eatenLast,
    rotted: pantry.rottedLast,
    sick: census.sick,
    burning: census.burning,
    history: frame.world.history.samples,
    chronicle: frame.world.chronicle.lines,
    alerts,
    upgrades,
    guide
  }
}
