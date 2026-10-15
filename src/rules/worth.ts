/**
 * What everything a mayor can lay down is worth: what it costs, what it
 * costs to keep, and what it gives back, all in coins at the traders'
 * usual prices, so a fishery, a citizens' home, a fire watch, and a
 * fountain can be weighed on one scale. A piece that gives back far more
 * than its kind usually does, for what it costs, is a hole a player will
 * find and play over and over: `test/economy.test.ts` holds the shipped
 * rules (or any candidate rules) to the bands these figures should keep.
 * Plain functions over the rules: nothing here knows the ECS.
 */
import { amounts, asUpgraded, foods, goodIds, upgradeAt, type GoodId, type Kind, type KindId, type Need, type Tier } from "../content.ts"
import { shippedRules, type Rules } from "./config.ts"
import { adminOf, mealsOf, moreAdmin, taxOf } from "./households.ts"
import { tradeCollection } from "./trade.ts"

const kindIds = (rules: Rules) => Object.keys(rules.kinds) as Array<KindId>

/** Coins and materials as coins: materials at the traders' usual price. */
export const costWorth = (cost: Kind["cost"], rules: Rules = shippedRules): number =>
  cost.coins + (Object.entries(cost.materials) as Array<[GoodId, number]>).reduce((n, [g, k]) => n + k * rules.goods[g].price, 0)

/** The median of some numbers: what a kind usually does. */
export const median = (xs: ReadonlyArray<number>): number => {
  const s = [...xs].sort((a, b) => a - b), mid = Math.floor(s.length / 2)
  return s.length === 0 ? 0 : s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

// ── Producers ─────────────────────────────────────────────────────────────

export interface ProducerWorth {
  readonly id: KindId
  /** One-off: coins and materials. */
  readonly cost: number
  /** Coins a minute. */
  readonly upkeep: number
  /** Coins a minute of value added: its output less its input and the tools it wears, with a full crew and a tool. */
  readonly adds: number
  /** What it adds for each coin of upkeep. */
  readonly perUpkeep: number
  /** Minutes until what it adds, less its upkeep, has paid for it. */
  readonly payback: number
}

/** Jobs a minute a maker does with a full crew, a tool, and good repair. */
export const jobsPerMinute = (kind: Kind): number => (kind.recipe ? 60 / kind.recipe.seconds : 0)

export const producerWorth = (id: KindId, rules: Rules = shippedRules, level = 0): ProducerWorth => {
  const kind = asUpgraded(rules.kinds[id], level), r = kind.recipe!, jobs = jobsPerMinute(kind)
  const out = jobs * r.batch * rules.goods[r.output].price
  const inp = r.input ? jobs * r.inputs * rules.goods[r.input].price : 0
  const tools = kind.wear ? (jobs / kind.wear) * rules.goods.tools.price : 0
  const adds = out - inp - tools, cost = costWorth(kind.cost, rules)
  return { id, cost, upkeep: kind.upkeep, adds, perUpkeep: adds / kind.upkeep, payback: adds > kind.upkeep ? cost / (adds - kind.upkeep) : Infinity }
}

export const producers = (rules: Rules = shippedRules): Array<ProducerWorth> =>
  kindIds(rules).filter((id) => rules.kinds[id].recipe && rules.kinds[id].buildable).map((id) => producerWorth(id, rules))

// ── Chains: what a unit of a good a minute takes, from the land up ──────

const needIds: ReadonlyArray<Need> = ["food", "bread", "cloth", "faith", "furniture"]

/** The needs a good meets when a walker hands it to a home: every food meets food; a good named for a need meets it. */
export const meets = (good: GoodId): ReadonlyArray<Need> => [
  ...(foods.includes(good) ? ["food" as const] : []),
  ...(needIds as ReadonlyArray<string>).filter((n) => n !== "food" && n === good) as Array<Need>
]

export interface ChainWorth {
  readonly good: GoodId
  /** The buildings it takes, as fractions of one, to make one a minute. */
  readonly buildings: Readonly<Partial<Record<KindId, number>>>
  /** Per unit a minute: one-off cost, upkeep, workers, and tools worn a minute. */
  readonly cost: number
  readonly upkeep: number
  readonly workers: number
  readonly tools: number
  /** What it makes in a normal winter, as a share of the summer. */
  readonly winter: number
  /** Seconds a unit keeps in store (`Infinity`: it keeps). */
  readonly keeps: number
  readonly meets: ReadonlyArray<Need>
}

/** The maker of a good: the building whose recipe turns out the most of it. */
const makerOf = (good: GoodId, rules: Rules): KindId | undefined =>
  kindIds(rules).filter((id) => rules.kinds[id].buildable && rules.kinds[id].recipe?.output === good)
    .sort((a, b) => rules.kinds[b].recipe!.batch * jobsPerMinute(rules.kinds[b]) - rules.kinds[a].recipe!.batch * jobsPerMinute(rules.kinds[a]))[0]

export const chainWorth = (good: GoodId, rules: Rules = shippedRules): ChainWorth => {
  const buildings: Partial<Record<KindId, number>> = {}
  let winter = 1
  const need = (g: GoodId, perMinute: number) => {
    const id = makerOf(g, rules)
    if (!id) throw new Error(`Nothing makes ${g}`)
    const kind = rules.kinds[id], r = kind.recipe!, count = perMinute / (r.batch * jobsPerMinute(kind))
    buildings[id] = (buildings[id] ?? 0) + count
    if (kind.gathers?.source === "water") winter = Math.min(winter, rules.winters.normal.fishing)
    if (kind.gathers?.source === "field") winter = 0
    if (r.input) need(r.input, count * jobsPerMinute(kind) * r.inputs)
  }
  need(good, 1)
  const sum = (f: (k: Kind) => number) => (Object.entries(buildings) as Array<[KindId, number]>).reduce((n, [id, c]) => n + c * f(rules.kinds[id]), 0)
  return {
    good, buildings, winter,
    cost: sum((k) => costWorth(k.cost, rules)), upkeep: sum((k) => k.upkeep), workers: sum((k) => k.workers),
    tools: sum((k) => (k.wear ? jobsPerMinute(k) / k.wear : 0)),
    keeps: rules.spoils[good] ?? Infinity,
    meets: meets(good)
  }
}

/** The ways of making `a` that are at least as cheap as making `b` on every count, and cheaper on one: `a` dominates `b`. */
export const dominates = (a: ChainWorth, b: ChainWorth): boolean => {
  const costs = [[a.cost, b.cost], [a.upkeep, b.upkeep], [a.workers, b.workers], [a.tools, b.tools]] as const
  const gains = [[a.winter, b.winter], [a.keeps, b.keeps]] as const
  const noWorse = costs.every(([x, y]) => x <= y) && gains.every(([x, y]) => x >= y)
  return noWorse && (costs.some(([x, y]) => x < y) || gains.some(([x, y]) => x > y))
}

// ── Homes ─────────────────────────────────────────────────────────────────

export interface HomeWorth {
  readonly tier: Tier
  readonly residents: number
  /** Coins a minute at 100%, every need met, on a plain street. */
  readonly tax: number
  /** Coins a minute of goods it eats and wears out, at the usual price. */
  readonly eats: number
  readonly net: number
  /** What it cost to lay (tier 1), or to rise to this tier from the one below. */
  readonly cost: number
  /** What it gains over the tier below, a minute. */
  readonly gain: number
  /** Minutes the gain takes to pay for the cost. */
  readonly payback: number
  /** The resident, counting from none, whose administration costs more than a resident of this tier pays. */
  readonly breakEven: number
}

/** What a home rises to a tier for (see `home.tiers`), as coins. */
export const promotionCost = (tier: Tier, rules: Rules = shippedRules): number => costWorth(rules.home.tiers[tier].rise as Kind["cost"], rules)

export const homeWorth = (tier: Tier, rules: Rules = shippedRules): HomeWorth => {
  const t = rules.home.tiers[tier], residents = t.residents
  const needs = { food: 1, bread: tier >= 2 ? 1 : 0, cloth: tier >= 2 ? 1 : 0, faith: tier >= 2 ? 1 : 0, furniture: tier >= 3 ? 1 : 0 }
  const tax = taxOf({ tier, residents, ...needs }, { settlers: 100, citizens: 100 }, rules)
  const seconds = (ticks: number) => ticks * rules.stepSeconds
  const meals = mealsOf({ residents }, rules) * 60 / seconds(rules.home.lasts.food)
  const staple = tier >= 2 ? rules.goods.bread.price : rules.goods.fish.price
  const eats = meals * staple + (tier >= 2 ? (60 / seconds(rules.home.lasts.cloth)) * rules.goods.cloth.price : 0)
    + (tier >= 3 ? (60 / seconds(rules.home.lasts.furniture)) * rules.goods.furniture.price : 0)
  const below = tier > 1 ? homeWorth((tier - 1) as Tier, rules) : null
  const cost = tier === 1 ? costWorth(rules.home.cost as Kind["cost"], rules) : promotionCost(tier, rules)
  const net = tax - eats, gain = below ? net - below.net : net
  let breakEven = 0
  while (breakEven < 100_000 && moreAdmin(breakEven, 1, rules) < net / residents) breakEven++
  return { tier, residents, tax, eats, net, cost, gain, payback: gain > 0 ? cost / gain : Infinity, breakEven }
}

export const homes = (rules: Rules = shippedRules): Array<HomeWorth> => ([1, 2, 3] as const).map((t) => homeWorth(t, rules))

// ── The opening ───────────────────────────────────────────────────────────

/**
 * What it takes to found a town and raise its first citizens: `homes`
 * cottages, a maker of every good a citizen needs and of every good
 * those makers are built from, back to the land (but not those that wait
 * for citizens, like the smithy), and a building for every service a
 * citizen needs (the chapel).
 */
export const openingKit = (homesLaid = 10, rules: Rules = shippedRules) => {
  const kit = new Set<KindId>()
  const open = (k: Kind) => k.unlock.citizens === 0 && k.buildable
  const add = (good: GoodId) => {
    const id = makerOf(good, rules)
    if (!id || kit.has(id) || !open(rules.kinds[id])) return
    kit.add(id)
    const r = rules.kinds[id].recipe!
    if (r.input) add(r.input)
    for (const g of Object.keys(rules.kinds[id].cost.materials) as Array<GoodId>) add(g)
  }
  add("fish")
  for (const g of goodIds) if (meets(g).some((n) => rules.home.tiers[2].needs.includes(n) && n !== "food")) add(g)
  add("planks"); add("stone")
  for (const need of rules.home.tiers[2].needs) {
    const service = kindIds(rules).find((id) => rules.kinds[id].service?.service === need && open(rules.kinds[id]))
    if (service) kit.add(service)
  }
  const kinds = [...kit]
  const cost = kinds.reduce((n, id) => n + rules.kinds[id].cost.coins, 0) + homesLaid * rules.home.cost.coins
  const unlockHomes = Math.ceil(Math.max(...kinds.map((id) => rules.kinds[id].unlock.residents)) / rules.home.tiers[1].residents)
  return { kinds, cost, upkeep: kinds.reduce((n, id) => n + rules.kinds[id].upkeep, 0), unlockHomes }
}

// ── The crown ─────────────────────────────────────────────────────────────

/** Coins to buy `amount` of a good from traders, one collection at a time, at prices that climb as the town buys. */
export const buyCost = (good: GoodId, amount: number, rules: Rules = shippedRules): number => {
  let prices = amounts(Object.fromEntries(goodIds.map((g) => [g, 100]))), held = 0, spent = 0
  for (let i = 0; i < 1000 && held < amount; i++) {
    const shelf = { stock: amounts({ [good]: held }), accepts: goodIds, cap: 100_000 }
    const r = tradeCollection([shelf], { sells: [], buys: [good], reserve: amount }, prices, 1_000_000, rules)
    spent += 1_000_000 - r.coins; held = r.stores[0]!.stock[good]; prices = r.prices
  }
  return spent
}

/** What answering a request for `amount` of a good with goods bought for it leaves the town: the reward less the buying. */
export const crownMargin = (good: GoodId, amount: number, rules: Rules = shippedRules) => {
  const reward = Math.round(amount * rules.goods[good].price * rules.crown.reward) + rules.crown.bonus
  const bought = buyCost(good, amount, rules)
  return { good, amount, reward, bought, margin: reward - bought }
}

// ── Services ──────────────────────────────────────────────────────────────

export interface ServiceWorth {
  readonly id: string
  readonly service: string
  readonly cost: number
  readonly upkeep: number
  /** Road cells walked a minute: its range times its walks a minute. */
  readonly reach: number
  readonly perUpkeep: number
}

/** Every service building, and each upgrade of one as its own entry. */
export const services = (rules: Rules = shippedRules): Array<ServiceWorth> =>
  kindIds(rules).flatMap((id) => {
    const base = rules.kinds[id]
    if (!base.service || !base.buildable) return []
    const out: Array<ServiceWorth> = []
    let cost = costWorth(base.cost, rules)
    for (let level = 0; level <= 2; level++) {
      if (level > 0 && !upgradeAt(base, level)) break
      if (level > 0) cost += costWorth(upgradeAt(base, level)!.cost, rules)
      const k = asUpgraded(base, level), reach = (k.service!.range * 60) / k.service!.seconds
      out.push({ id: level === 0 ? id : `${id}+${upgradeAt(base, level)!.title.toLowerCase()}`, service: k.service!.service, cost, upkeep: k.upkeep, reach, perUpkeep: reach / k.upkeep })
    }
    return out
  })

// ── Upgrades ──────────────────────────────────────────────────────────────

export interface UpgradeWorth {
  readonly id: string
  readonly title: string
  /** One-off: coins and materials. */
  readonly cost: number
  /** Coins a minute more it costs to keep. */
  readonly upkeep: number
  /** Coins a minute more it earns or saves (`null`: nothing the ledger can price, a walker or shelves). */
  readonly gain: number | null
  /** Minutes until what it earns, less its upkeep, has paid for it (`Infinity`: never). */
  readonly payback: number | null
}

/**
 * What each upgrade earns over what it was, at the usual prices: a
 * workshop's value added, a masonry's from a third of its pace to all of
 * it, a guildhall's or a city hall's administration saved for a town at its
 * land's goal for that rank. A walker or shelves it cannot price.
 */
export const upgradeWorths = (rules: Rules = shippedRules, size: keyof Rules["sizes"] = "medium"): Array<UpgradeWorth> =>
  [...kindIds(rules)].flatMap((id) => {
    const base = rules.kinds[id], out: Array<UpgradeWorth> = []
    for (let level = 1; level <= 2; level++) {
      const up = upgradeAt(base, level)
      if (!up) break
      const before = asUpgraded(base, level - 1), cost = costWorth(up.cost, rules), upkeep = up.upkeep - before.upkeep
      let gain: number | null = null
      if (up.deep && base.recipe) gain = producerWorth(id, rules, level).adds * (2 / 3)
      else if (base.recipe && base.buildable) gain = producerWorth(id, rules, level).adds - producerWorth(id, rules, level - 1).adds
      else if (up.admin !== undefined) {
        const goal = rules.sizes[size].goal.residents * (rules.ranks[up.rank + 1]?.residents ?? 1)
        gain = adminOf(goal, rules) * (up.admin - (upgradeAt(base, level - 1)?.admin ?? 0))
      }
      out.push({ id: `${id}:${level}`, title: up.title, cost, upkeep, gain, payback: gain === null ? null : gain > upkeep ? cost / (gain - upkeep) : Infinity })
    }
    return out
  })
