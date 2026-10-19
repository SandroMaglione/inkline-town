import { shippedRules } from "../../rules/config.ts"
import { stepsOf, type GoodId } from "../../content/index.ts"
import * as Random from "@typeonce/ritmo-math/Random"
import { Building, Charter, Chronicle, Crown, Fate, Game, Rules, Inventory, Recipe, Rising, Rng, Site, Storage, Time, Treasury } from "../../schema.ts"
import { elapsed, termTicks, write } from "../shared.ts"

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
    const remembered = c.snubs.filter((at) => t - at < stepsOf(crown.memory * 60))
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
    const good = Random.draw(resources.rng).pick(options)!
    // Larger the later in this term it is: a new term starts the crown small again.
    const progress = Math.min(1, Math.max(0, t - resources.fate.get().began) / termTicks(charter, rules))
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
