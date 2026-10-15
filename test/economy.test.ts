/**
 * The economy's rules that must hold however the numbers are tuned: no
 * piece a mayor can lay down gives back far more than its kind usually
 * does for what it costs, and nothing comes for free. The figures come
 * from `src/rules/worth.ts`; the bands are the design's, so a change to
 * one number that opens a hole a player could play over and over fails
 * here.
 *
 * A rule the shipped game breaks is marked `todo` with what breaks it: the
 * suite stays green, and `node --test` lists each one, so this file is
 * also the list of holes still open. Once a hole is closed, drop its
 * `todo` and the rule holds from then on.
 */
import assert from "node:assert/strict"
import { test } from "node:test"
import { amounts, type GoodId, type GroundId, type KindId, type Need, type PropId } from "../src/content.ts"
import { appealGrid, parkSources, parksOf, type ParkCell } from "../src/appeal.ts"
import { shippedRules } from "../src/rules/config.ts"
import { moreAdmin, tierFor } from "../src/rules/households.ts"
import { chainWorth, crownMargin, dominates, homes, median, openingKit, producers, producerWorth, services, upgradeWorths } from "../src/rules/worth.ts"
import { district } from "../tools/balance/scenario.ts"
import { component, fixture } from "../tools/balance/verify/fixture.ts"

const rules = shippedRules
/** Fails with every offender listed, not just the first. */
const none = (offenders: ReadonlyArray<string>, rule: string) => assert.deepEqual(offenders, [], `${rule}:\n  ${offenders.join("\n  ")}`)
const round = (n: number) => Math.round(n * 100) / 100

// ── Producers ─────────────────────────────────────────────────────────────

/** A producer adds between half and twice what producers usually add for each coin of upkeep. */
const PRODUCER_BAND = [0.5, 2] as const

test("every producer adds about what producers usually do for its upkeep", () => {
  const all = producers(rules), usual = median(all.map((p) => p.perUpkeep))
  none(all.filter((p) => p.perUpkeep < usual * PRODUCER_BAND[0] || p.perUpkeep > usual * PRODUCER_BAND[1])
    .map((p) => `${p.id}: adds ${round(p.adds)}/min for ${p.upkeep} upkeep, ×${round(p.perUpkeep / usual)} of the usual ${round(usual)}`), "producer outside the band")
})

// ── Food ──────────────────────────────────────────────────────────────────

const foods: ReadonlyArray<GoodId> = ["fish", "smoked", "bread"]
/** Goods that meet the same need cost within this many times one another to keep making. */
const SUBSTITUTES = 3

test("no way of making a food is cheaper on every count than another that meets the same needs", () => {
  const chains = foods.map((g) => chainWorth(g, rules))
  const same = (a: ReadonlyArray<Need>, b: ReadonlyArray<Need>) => a.length === b.length && a.every((n) => b.includes(n))
  none(chains.flatMap((a) => chains.filter((b) => a !== b && same(a.meets, b.meets) && dominates(a, b)).map((b) => `${a.good} dominates ${b.good}`)), "dominated food")
})

test("foods that all meet a need cost within a few times one another to keep making", () => {
  const chains = foods.map((g) => chainWorth(g, rules))
  const out: Array<string> = []
  for (const need of ["food"] as const) {
    const meeting = chains.filter((c) => c.meets.includes(need))
    const cheap = meeting.reduce((a, b) => (a.upkeep <= b.upkeep ? a : b))
    for (const c of meeting) if (c.upkeep > cheap.upkeep * SUBSTITUTES) out.push(`${need}: ${c.good} ${round(c.upkeep)}/unit upkeep vs ${cheap.good} ${round(cheap.upkeep)}`)
  }
  none(out, "substitutes too far apart")
})

test("a tier's staple is needed to keep the tier: a citizens' home fed fish instead of bread steps down", () => {
  const fish = { tier: 2 as const, food: 100, bread: 0, cloth: 100, faith: 100, furniture: 0 }
  assert.equal(tierFor(fish, rules.home.tiers[3].appeal, { fire: 0, health: 0, order: 0 }, rules), 1)
})

test("fisheries sharing one stretch of water share its catch", () => {
  const base = district("shared-water", [1, 1, 1, 1], ["fishery", "fishery"], false, rules)
  const [a, b] = base.buildings.filter((x) => x.kind === "fishery")
  // One cell of water, within reach of both.
  const water = { x: b!.tile.x, y: a!.tile.y + a!.tile.size + 1, size: 1 }
  const scenario = { ...base, homes: base.homes.map((h) => ({ ...h, food: 10_000_000 })), land: [{ tile: water, type: "water" as const, amount: 1, growth: 0 }] }
  const town = fixture(scenario, rules)
  for (let s = 0; s < 60; s++) {
    town.change((snap) => { for (const f of [a!, b!]) component(snap, f.id, "Town/Inventory").stock.fish = 0 })
    town.run(1)
  }
  const made = [a!, b!].map((f) => component(town.snapshot(), f.id, "Town/Recipe").made as number)
  // One cell gives a catch, then rests: a minute holds two catches at most, whoever makes them.
  const most = Math.floor(60 / (rules.restockTicks * rules.stepSeconds)) + 1
  assert(made[0]! + made[1]! <= most, `two fisheries on one cell of water caught ${made.join(" + ")}; the water gives ${most} a minute`)
})

// ── Homes ─────────────────────────────────────────────────────────────────

/** Minutes of what it adds that laying a home, or raising it a tier, should cost at least. */
const HOME_PAYBACK = 2

test("a home, and each tier it rises to, costs a few minutes of what it brings in", () => {
  none(homes(rules).filter((h) => h.payback < HOME_PAYBACK)
    .map((h) => `tier ${h.tier}: costs ${h.cost}, adds ${round(h.gain)}/min, pays back in ${round(h.payback)} min`), "home too cheap")
})

/** A finer home's people stop paying their way at most this many times further on than settlers. */
const ADMIN_SPREAD = 3

test("administration is charged by the resident, so finer homes pay for their people", () => {
  const [cottage, citizens] = homes(rules)
  // A citizens' home of eight costs the town hall twice what a cottage of four does.
  const at = 300, cost = (n: number) => moreAdmin(at, n, rules)
  assert(Math.abs(cost(citizens!.residents) / cost(cottage!.residents) - citizens!.residents / cottage!.residents) < 0.05)
  none(homes(rules).slice(1).filter((h) => h.breakEven > cottage!.breakEven * ADMIN_SPREAD)
    .map((h) => `tier ${h.tier}: pays its way to resident ${h.breakEven}, settlers to ${cottage!.breakEven}`), "administration too light")
})

// ── The opening ───────────────────────────────────────────────────────────

/** The share of the first citizens' buildings a new town's treasury pays for, at most (it cannot buy them all at once); and the homes they need, at least. */
const OPENING_SHARE = 1
const OPENING_HOMES = 15

test("a new town's treasury pays for only part of the first citizens' buildings", () => {
  const kit = openingKit(10, rules)
  none((Object.entries(rules.lands) as Array<[string, { coins: number }]>).filter(([, l]) => l.coins > kit.cost * OPENING_SHARE)
    .map(([id, l]) => `${id}: ${l.coins} coins for a ${kit.cost}-coin kit (${kit.kinds.join(", ")}), ${Math.round((l.coins / kit.cost) * 100)}%`), "opening paid for")
})

test("the first citizens' buildings open only once the town has grown", () => {
  const kit = openingKit(10, rules)
  assert(kit.unlockHomes >= OPENING_HOMES, `the ${kit.kinds.join(", ")} all open at ${kit.unlockHomes} cottages`)
})

// ── The crown ─────────────────────────────────────────────────────────────

test("answering the crown with bought goods pays no more than its thanks", () => {
  // The bonus is the crown's thanks for answering at all; the goods themselves are paid about what they cost to buy.
  const goods = (Object.keys(rules.goods) as Array<GoodId>).filter((g) => rules.spoils[g] === undefined)
  none(goods.flatMap((g) => [10, 20, 30].map((n) => crownMargin(g, n, rules))).filter((m) => m.margin > rules.crown.bonus)
    .map((m) => `${m.amount} ${m.good}: reward ${m.reward}, bought for ${m.bought}, +${m.margin}`), "crown pays for bought goods")
})

// ── Services ──────────────────────────────────────────────────────────────

test("a bigger building for a service walks at least as far for its upkeep as a smaller one", () => {
  const all = services(rules), out: Array<string> = []
  for (const big of all) for (const small of all)
    if (big.service === small.service && big.cost > small.cost && big.perUpkeep < small.perUpkeep)
      out.push(`${big.id} ${round(big.perUpkeep)} cells/upkeep < ${small.id} ${round(small.perUpkeep)}`)
  none(out, "a dearer service building does less a coin")
})

// ── Upgrades ──────────────────────────────────────────────────────────────

/** Minutes an upgrade that earns should take to pay for itself: never at once, and within a term. */
const UPGRADE_PAYBACK = [2, 45] as const

test("every upgrade that earns pays for itself within a term, never at once", () => {
  none(upgradeWorths(rules).filter((u) => u.payback !== null && (u.payback < UPGRADE_PAYBACK[0] || u.payback > UPGRADE_PAYBACK[1]))
    .map((u) => `${u.title}: costs ${u.cost}, earns ${round(u.gain!)}/min for ${u.upkeep} more upkeep, pays back in ${round(u.payback!)} min`), "upgrade out of the band")
})

test("an upgraded producer still adds about what producers usually do for its upkeep", () => {
  const usual = median(producers(rules).map((p) => p.perUpkeep))
  const upgraded = (Object.keys(rules.kinds) as Array<KindId>).filter((id) => rules.kinds[id].recipe && rules.kinds[id].upgrade && !rules.kinds[id].upgrade!.deep)
  none(upgraded.map((id) => producerWorth(id, rules, 1)).filter((p) => p.perUpkeep < usual * PRODUCER_BAND[0] || p.perUpkeep > usual * PRODUCER_BAND[1])
    .map((p) => `${p.id} upgraded: ×${round(p.perUpkeep / usual)} of the usual`), "upgraded producer outside the band")
})

// ── Parks ─────────────────────────────────────────────────────────────────

/** The most a park of one cell gives: no more than a street or a little more. */
const ONE_CELL_MOST = 2
const road = (_x: number, y: number) => y === 0

test("a park of one cell gives little, whatever stands on it", () => {
  const out: Array<string> = []
  for (const ground of ["lawn", "flowers", "path", "square"] as Array<GroundId>)
    for (const prop of ["none", "lamp", "fountain", "statue"] as Array<PropId | "none">) {
      const [park] = parksOf([{ x: 5, y: 1, ground, prop }], road, rules)
      if (park && park.value > ONE_CELL_MOST) out.push(`${ground} + ${prop}: ${park.value}`)
    }
  none(out, "one-cell park too fine")
})

test("cells laid as separate parks give a street no more than the same cells as one", () => {
  const out: Array<string> = []
  /** The finest desirability any cell gets from these park cells. */
  const finest = (cells: ReadonlyArray<ParkCell>) => Math.max(...appealGrid(parkSources(cells, road, rules), rules))
  for (const n of [2, 3, 4, 5, 6])
    for (const prop of ["none", "lamp"] as const) {
      // A diagonal of cells (each its own park) against a row of them (one park), both beside the road.
      const apart = Array.from({ length: n }, (_, i) => ({ x: 10 + 2 * i, y: 1 + (i % 2), ground: "path" as const, prop }))
      const joined = Array.from({ length: n }, (_, i) => ({ x: 10 + i, y: 1, ground: "path" as const, prop }))
      if (finest(apart) > finest(joined)) out.push(`${n} paths${prop === "none" ? "" : ` with ${prop}s`}: ${finest(apart)} apart, ${finest(joined)} as one`)
    }
  none(out, "splitting a park pays")
})

// ── The ledger itself ─────────────────────────────────────────────────────

test("the ledger's figures follow the rules it is given", () => {
  assert.equal(chainWorth("fish", rules).buildings.fishery, 1 / 15)
  const dearer = { ...rules, kinds: { ...rules.kinds, fishery: { ...rules.kinds.fishery, upkeep: 9 } } }
  assert(chainWorth("fish", dearer).upkeep > chainWorth("fish", rules).upkeep)
  assert.equal(amounts({}).fish, 0)
})
