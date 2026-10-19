import { crown, stepsOf } from "../../content/index.ts"
import { Census, Charter, Chronicle, Crown, Fate, Game, Rules, History, Ledger, Mood, Time, Treasury, TownHall, Upgraded } from "../../schema.ts"
import { elapsed, termTicks, write } from "../shared.ts"
import { goalsOf, nextRank, scoreOf, steadyNet } from "../../rules/goals.ts"

/** The fate of a town just founded: its first term, a hamlet. */
export const foundedFate = () => ({
  state: "playing" as const,
  reason: "",
  at: 0,
  term: 1,
  began: 0,
  rank: 0,
  debtSince: -1,
  revoltSince: -1,
  goalSince: -1,
  peak: 0,
  score: 0
})

/**
 * Once a second: does the term end, or the town rise? The term is lost to
 * bankruptcy (in debt too long), revolt (approval too low too long),
 * abandonment (the town emptied), or dismissal (the crown's requests
 * missed too many times in a row); and over when it runs out, when the
 * mayor may stand for another. The town rises a rank once every goal of
 * the next has held long enough, and the crown sends a reward; nothing
 * ends. Dangers write to the chronicle as they begin.
 */
export const Judge = Game.System(
  "Town/Judge",
  {
    queries: { halls: Game.Query({ selection: { upgraded: Game.Query.optional(Upgraded) }, with: [TownHall] }) },
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      census: Game.System.readResource(Census),
      treasury: Game.System.writeResource(Treasury),
      ledger: Game.System.readResource(Ledger),
      mood: Game.System.readResource(Mood),
      crown: Game.System.readResource(Crown),
      history: Game.System.readResource(History),
      fate: Game.System.writeResource(Fate),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules
    const { crown, fate, ranks } = rules
    // The town hall's upgrades: a city asks for a guildhall.
    const hallRow = queries.halls.each()[0]
    const hall = hallRow ? hallRow.data.upgraded.value()?.level ?? 0 : 0

    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    if (t <= 0 || t % 60 !== 0) return
    const f = resources.fate.get()
    if (f.state !== "playing") return
    const census = resources.census.get()
    const coins = resources.treasury.get().coins
    const ledger = resources.ledger.get()
    const approval = resources.mood.get().approval
    const crownNow = resources.crown.get()
    const residents = census.settlers + census.citizens
    const net = steadyNet(resources.history.get().samples, ledger.taxes + ledger.trade - ledger.upkeep - ledger.admin)
    const note = (text: string, alarm = false) => write(resources.chronicle, t, text, alarm)
    const minutes = (n: number) => stepsOf(n * 60)

    const next = { ...f, peak: Math.max(f.peak, residents) }
    for (const mark of [50, 100, 250, 500, 1000]) if (f.peak < mark && residents >= mark) note(`${mark} residents.`)

    // Dangers.
    if (coins < 0) {
      if (f.debtSince < 0) note("The treasury is empty: wages go unpaid.", true)
      next.debtSince = f.debtSince < 0 ? t : f.debtSince
    } else next.debtSince = -1
    if (approval <= fate.revoltAt) {
      if (f.revoltSince < 0) note("The town is in uproar.", true)
      next.revoltSince = f.revoltSince < 0 ? t : f.revoltSince
    } else next.revoltSince = -1

    const end = (state: "lost" | "over", reason: string) => {
      note(reason)
      resources.fate.set({ ...next, state, reason, at: t, score: scoreOf({ ...census, net, approval, met: crownNow.met, missed: crownNow.missed, hall }, next.rank) })
    }
    if (next.debtSince >= 0 && t - next.debtSince >= minutes(fate.debt)) return end("lost", "Bankrupt: the crown has taken the treasury out of the mayor's hands.")
    if (next.revoltSince >= 0 && t - next.revoltSince >= minutes(fate.revolt)) return end("lost", "Revolt: the town has turned the mayor out.")
    if (next.peak >= fate.peak && residents < next.peak * fate.abandon) return end("lost", "Abandoned: the people have left the town.")
    if (crownNow.streak >= crown.patience) return end("lost", `Dismissed: the crown has replaced a mayor who left ${crown.patience} of its requests unanswered.`)
    if (t - f.began >= termTicks(charter, rules)) {
      return end("over", `Term ${f.term} is over; the ${ranks[f.rank]!.title} stands.`)
    }

    // The next rank.
    if (nextRank(f.rank, rules) > f.rank) {
      const goals = goalsOf(charter, { ...census, coins, net, approval, hall }, rules, f.rank)
      if (goals.every((g) => g.met)) {
        const to = ranks[f.rank + 1]!
        if (f.goalSince < 0) note(`Every goal of a ${to.title} is met: the town needs only to hold them.`)
        next.goalSince = f.goalSince < 0 ? t : f.goalSince
        if (t - next.goalSince >= minutes(fate.hold)) {
          next.rank = f.rank + 1
          next.goalSince = -1
          resources.treasury.update((tr) => ({ coins: tr.coins + to.reward }))
          note(`The town is now a ${to.title}: the crown sends ${to.reward} coins.`, true)
        }
      } else next.goalSince = -1
    }
    resources.fate.set(next)
  }
)
