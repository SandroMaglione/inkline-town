import { approvalTarget, nextApproval } from "../rules/approval.ts"
import { shippedRules } from "../rules/config.ts"
/**
 * The term in office: the seasons turn, the crown asks for goods, the
 * town's approval follows how it is treated, the town's history is kept,
 * and the term ends: complete, lost, or run out.
 */
import { crown, HISTORY_TICKS, ticks, WINTER_WARNING, type GoodId } from "../content.ts"
import * as Random from "@typeonce/bevy-ts-math/Random"
import { Building, Census, Charter, Chronicle, Crown, Fate, Game, Rules, History, House, Inventory, Ledger, Mood, Pantry, Policy, Recipe, Rising, Rng, Site, Stock, Storage, Time, Treasury } from "../schema.ts"
import { elapsed, seasonAt, termTicks, write } from "./shared.ts"

// ── Time ──────────────────────────────────────────────────────────────────

/**
 * Winter comes and goes, and the chronicle says so. A minute before it
 * comes, the almanac warns the town how hard it will be, and how long the
 * food in store would last.
 */
export const Seasons = Game.System(
  "Town/Seasons",
  {
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      stock: Game.System.readResource(Stock),
      pantry: Game.System.readResource(Pantry),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ resources, services }) => {
    const rules = services.rules
    const { winters } = rules

    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    if (t <= 0) return
    const now = seasonAt(t, charter, rules)
    const before = seasonAt(t - 1, charter, rules)
    if (now.winter && !before.winter) {
      const w = now.severity ?? "normal"
      write(
        resources.chronicle,
        t,
        `A ${winters[w].title} winter, year ${now.year}: the fields lie still and fisheries catch ${Math.round(winters[w].fishing * 100)}%${winters[w].heating ? "; homes burn fires to keep warm" : ""}.`
      )
    }
    if (!now.winter && before.winter) write(resources.chronicle, t, `Spring of year ${now.year}.`)
    if (!now.winter && now.coming !== null && now.left === WINTER_WARNING) {
      const w = winters[now.coming]
      const eats = resources.pantry.get().eatenLast
      write(
        resources.chronicle,
        t,
        `Winter in a minute, and the almanac says it will be ${w.title}: ${larder(resources.stock.get())} food in store; the town eats ${eats} a minute.`,
        true
      )
    }
  }
)

// ── The crown ─────────────────────────────────────────────────────────────

/** Steps between the crown's requests. */
export const crownGap = (charter: { readonly term: number }, rules = shippedRules) => Math.round(termTicks(charter, rules) / (rules.crown.perTerm + 1))

/**
 * Every so often the crown asks for something the town makes, and that
 * keeps (never fish or bread): a share of
 * what its workshops and gatherers could make in the time given, larger the
 * later in the term it is. A request not sent in time is a fine and a snub
 * the town's approval remembers.
 */
export const Requests = Game.System(
  "Town/Requests",
  {
    queries: {
      makers: Game.Query({ selection: { recipe: Game.Query.read(Recipe) }, with: [Building], without: [Site, Rising] }),
      stores: Game.Query({ selection: { inventory: Game.Query.read(Inventory) }, with: [Storage], without: [Site, Rising] })
    },
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      fate: Game.System.readResource(Fate),
      crown: Game.System.writeResource(Crown),
      treasury: Game.System.writeResource(Treasury),
      rng: Game.System.writeResource(Rng),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules
    const { goods, crown, spoils } = rules

    if (resources.fate.get().state !== "playing") return
    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    const c = resources.crown.get()
    const remembered = c.snubs.filter((at) => t - at < ticks(crown.memory * 60))
    if (remembered.length !== c.snubs.length) resources.crown.set({ ...c, snubs: remembered })

    if (c.open && t >= c.due) {
      const fine = Math.round(((c.reward - crown.bonus) / crown.reward) * crown.fine) + crown.bonus
      resources.treasury.update((tr) => ({ coins: tr.coins - fine }))
      resources.crown.set({ ...c, open: false, missed: c.missed + 1, streak: c.streak + 1, snubs: [...remembered, t] })
      write(resources.chronicle, t, `The crown's request for ${c.amount} ${goods[c.good].title} went unanswered: a fine of ${fine} coins.`, true)
      return
    }
    if (c.open || t < c.next) return
    // Something the town makes, sized to what it makes of it: from a third of
    // what it can make in the time given, early in the term, to most of it.
    // The crown waits until the town makes anything.
    const rates = new Map<GoodId, number>()
    for (const { data } of queries.makers.each()) {
      const r = data.recipe.get()
      rates.set(r.output, (rates.get(r.output) ?? 0) + (r.batch * 3600) / r.period)
    }
    // Only what keeps: fish and bread would rot on the way.
    const options = [...rates.keys()].filter((g) => spoils[g] === undefined).sort()
    if (options.length === 0) return
    const random = Random.make(resources.rng.get())
    const good = random.pick(options)!
    resources.rng.set(random.state)
    const progress = Math.min(1, t / termTicks(charter, rules))
    const window = (crownGap(charter, rules) * crown.window) / 3600
    const share = crown.share[0] + (crown.share[1] - crown.share[0]) * progress
    // Never more than the town could keep in store.
    const room = queries.stores.each().reduce((sum, { data }) => sum + data.inventory.get().cap, 0)
    const amount = Math.max(4, Math.min(Math.round(room * crown.room), Math.round(rates.get(good)! * window * share)))
    const reward = Math.round(amount * goods[good].price * crown.reward) + crown.bonus
    const gap = crownGap(charter, rules)
    const due = t + Math.round(gap * crown.window)
    resources.crown.set({ ...c, snubs: remembered, open: true, good, amount, issued: t, due, reward, next: t + gap })
    write(resources.chronicle, t, `The crown asks for ${amount} ${goods[good].title} within ${Math.round(((due - t) / 3600) * 10) / 10} minutes, for ${reward} coins.`, true)
  }
)

// ── Approval ──────────────────────────────────────────────────────────────

/**
 * What the town makes of how it is run, every collection: its needs, its
 * taxes, unpaid wages, snubs from the crown, a hungry winter. Approval
 * moves towards that a few points at a time.
 */
export const Approve = Game.System(
  "Town/Approve",
  {
    queries: { homes: Game.Query({ selection: { house: Game.Query.read(House) }, without: [Site, Rising] }) },
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      policy: Game.System.readResource(Policy),
      treasury: Game.System.readResource(Treasury),
      crown: Game.System.readResource(Crown),
      mood: Game.System.writeResource(Mood)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules

    const t = elapsed(resources.time.get(), resources.charter.get())
    if (t % ticks(10) !== 0) return
    const policy = resources.policy.get()
    const m = resources.mood.get()
    const parts = approvalTarget(queries.homes.each().map(({ data }) => data.house.get()), policy,
      resources.treasury.get().coins, resources.crown.get().snubs.length, seasonAt(t, resources.charter.get(), rules).winter, rules, m.memory)
    resources.mood.set({ approval: nextApproval(m.approval, parts.target, rules), ...parts })

  }
)

// ── The end of the term ───────────────────────────────────────────────────

/** The fate of a town just founded. */
export const foundedFate = () => ({
  state: "playing" as const,
  reason: "",
  at: 0,
  governing: false,
  won: -1,
  debtSince: -1,
  revoltSince: -1,
  goalSince: -1,
  peak: 0,
  score: 0
})

import { goalsOf, larder, scoreOf, steadyNet } from "../rules/goals.ts"
export { goalsOf, larder, scoreOf, steadyNet } from "../rules/goals.ts"

/**
 * Once a second: does the term end? It is lost to bankruptcy (in debt too
 * long), revolt (approval too low too long), abandonment (the town
 * emptied), or dismissal (the crown's requests missed too many times in a
 * row); won once every goal has held long enough; and over when the
 * term runs out. Dangers write to the chronicle as they begin.
 */
export const Judge = Game.System(
  "Town/Judge",
  {
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      census: Game.System.readResource(Census),
      treasury: Game.System.readResource(Treasury),
      ledger: Game.System.readResource(Ledger),
      mood: Game.System.readResource(Mood),
      crown: Game.System.readResource(Crown),
      history: Game.System.readResource(History),
      fate: Game.System.writeResource(Fate),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ resources, services }) => {
    const rules = services.rules
    const { crown, fate } = rules

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
    const minutes = (n: number) => ticks(n * 60)
    const left = Math.max(0, Math.round((termTicks(charter, rules) - t) / 3600))
    const score = (won: boolean) => scoreOf({ ...census, coins, approval, met: crownNow.met, missed: crownNow.missed }, won, left)

    const next = { ...f, peak: Math.max(f.peak, residents) }
    for (const mark of [50, 100, 250, 500]) if (f.peak < mark && residents >= mark) note(`${mark} residents.`)

    // Dangers.
    if (coins < 0) {
      if (f.debtSince < 0) note("The treasury is empty: wages go unpaid.", true)
      next.debtSince = f.debtSince < 0 ? t : f.debtSince
    } else next.debtSince = -1
    if (approval <= fate.revoltAt) {
      if (f.revoltSince < 0) note("The town is in uproar.", true)
      next.revoltSince = f.revoltSince < 0 ? t : f.revoltSince
    } else next.revoltSince = -1

    const end = (state: "won" | "lost" | "over", reason: string) => {
      note(reason)
      resources.fate.set({ ...next, state, reason, at: t, score: score(state === "won" || f.governing) })
    }
    if (next.debtSince >= 0 && t - next.debtSince >= minutes(fate.debt)) return end("lost", "Bankrupt: the crown has taken the treasury out of the mayor's hands.")
    if (next.revoltSince >= 0 && t - next.revoltSince >= minutes(fate.revolt)) return end("lost", "Revolt: the town has turned the mayor out.")
    if (next.peak >= fate.peak && residents < next.peak * fate.abandon) return end("lost", "Abandoned: the people have left the town.")
    if (crownNow.streak >= crown.patience) return end("lost", `Dismissed: the crown has replaced a mayor who left ${crown.patience} of its requests unanswered.`)
    if (t >= termTicks(charter, rules)) {
      return end("over", f.governing ? "The term is over: the town stood complete to the end." : "The term is over.")
    }

    // Goals.
    if (!f.governing) {
      const goals = goalsOf(charter, { ...census, coins, net, approval }, rules)
      if (goals.every((g) => g.met)) {
        if (f.goalSince < 0) note("Every goal is met: the town needs only to hold them.")
        next.goalSince = f.goalSince < 0 ? t : f.goalSince
        if (t - next.goalSince >= minutes(fate.hold)) return end("won", "The town is complete.")
      } else next.goalSince = -1
    }
    resources.fate.set(next)
  }
)

/** A sample of the town every `HISTORY_TICKS`. */
export const Record = Game.System(
  "Town/Record",
  {
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      census: Game.System.readResource(Census),
      treasury: Game.System.readResource(Treasury),
      ledger: Game.System.readResource(Ledger),
      mood: Game.System.readResource(Mood),
      fate: Game.System.readResource(Fate),
      history: Game.System.writeResource(History)
    }
  },
  ({ resources }) => {
    const t = elapsed(resources.time.get(), resources.charter.get())
    if (t <= 0 || t % HISTORY_TICKS !== 0) return
    const f = resources.fate.get()
    if (f.state !== "playing") return
    const census = resources.census.get()
    const ledger = resources.ledger.get()
    const sample = {
      tick: t,
      coins: resources.treasury.get().coins,
      residents: census.settlers + census.citizens,
      citizens: census.citizens,
      approval: resources.mood.get().approval,
      net: ledger.taxes + ledger.trade - ledger.upkeep - ledger.admin
    }
    resources.history.update((h) => ({ samples: [...h.samples, sample].slice(-1000) }))
  }
)

