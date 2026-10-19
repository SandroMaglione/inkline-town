/**
 * The town that goes on: ranks as milestones, terms that follow one
 * another, worked faces that never run dry, and buildings upgraded where
 * they stand. Each check runs the real simulation, headless, for seconds
 * of game time, from a town put into the situation through its snapshot.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { amounts, FACE_TICKS, goodIds, kinds, ranks, stepsOf, YEARS_PER_TERM } from "../src/game/content/index.ts"
import { canPlace, GridBuilder } from "../src/game/world/grid.ts"
import { goalsOf, nextRank, scoreOf } from "../src/game/rules/goals.ts"
import { headless, type Snapshot } from "../src/game/headless.ts"

const charter = { size: "small", term: 45, land: "fair", seed: 11 } as const

/** A standing market on free ground beside the town hall's ring road, as a snapshot is changed. */
const market = (s: Snapshot) => {
  const grid = new GridBuilder(s.resources["Town/Land"].mask)
  for (const e of s.entities) {
    const tile = e.components["Town/Tile"]
    if (tile) grid.claim(tile, e.id, e.components["Town/Road"] ? "road" : "building")
  }
  const hall = s.entities.find((e) => e.components["Town/TownHall"])!.components["Town/Tile"]
  const spots = [{ x: hall.x + 4, y: hall.y }, { x: hall.x - 4, y: hall.y }, { x: hall.x, y: hall.y + 4 }, { x: hall.x, y: hall.y - 4 }]
  const at = spots.find((c) => canPlace(grid.value(), { ...c, size: 2 }))!
  const m = kinds.market
  s.entities.push({
    id: s.nextEntity++,
    components: {
      "Town/Tile": { ...at, size: 2 },
      "Town/Building": { kind: "market" },
      "Town/Status": "idle",
      "Town/Staff": { needed: 0, assigned: 0, apprentices: 0, nearby: 0 },
      "Town/Service": { service: "goods", interval: stepsOf(m.service!.seconds), cooldown: 0, range: m.service!.range },
      "Town/Inventory": { stock: amounts({}), accepts: ["fish", "smoked", "bread", "cloth"], cap: m.holds!.cap }
    }
  })
  return at
}

const stockOf = (s: Snapshot, good: (typeof goodIds)[number]) =>
  s.entities.reduce((n, e) => n + (e.components["Town/Storage"] ? e.components["Town/Inventory"].stock[good] : 0), 0)

test("each rank asks more than the last, and the city asks for burghers", () => {
  const town = { settlers: 0, citizens: 0, burghers: 0, coins: 0, net: 0, approval: 0 }
  const village = goalsOf(charter, town, undefined, 0)
  const towns = goalsOf(charter, town, undefined, 1)
  const city = goalsOf(charter, town, undefined, 2)
  const residents = (goals: ReadonlyArray<{ id: string; target: number }>) => goals.find((g) => g.id === "residents")!.target
  assert(residents(village) < residents(towns) && residents(towns) < residents(city))
  assert.equal(village.some((g) => g.id === "burghers"), false)
  assert.equal(city.some((g) => g.id === "burghers"), true)
  // The town rank is the old complete town; the top rank sees its own goals.
  assert.equal(residents(towns), 180)
  assert.equal(nextRank(ranks.length - 1), ranks.length - 1)
  assert.deepEqual(goalsOf(charter, town, undefined, 3), city)
  // Each asks an income, not coins held; the city asks for a guildhall too, and a guildhall meets it.
  const income = (goals: ReadonlyArray<{ id: string; target: number }>) => goals.find((g) => g.id === "income")!.target
  assert.equal(income(towns), 100)
  assert(income(village) < income(towns) && income(towns) < income(city))
  assert.equal(towns.some((g) => g.id === "hall"), false)
  assert.equal(city.find((g) => g.id === "hall")?.met, false)
  assert.equal(goalsOf(charter, { ...town, hall: 1 }, undefined, 2).find((g) => g.id === "hall")?.met, true)
  assert.equal(goalsOf(charter, { ...town, coins: 1_000_000 }, undefined, 1).find((g) => g.id === "income")?.met, false, "a hoard is not an income")
  // A rank counts for more than its people.
  const s = { settlers: 100, citizens: 50, burghers: 10, net: 150, approval: 20, met: 2, missed: 0 }
  assert(scoreOf(s, 2) > scoreOf(s, 1))
})

test("a rock quarried down stays as a worked face, and gives one more now and then", () => {
  const t = headless(charter)
  t.run(1)
  const rocks = t.snapshot().entities.filter((e) => e.components["Town/Rock"]).length
  assert(rocks > 0)
  t.change((s) => {
    for (const e of s.entities) if (e.components["Town/Rock"]) e.components["Town/Rock"].amount = 0
  })
  t.run(FACE_TICKS / 60 + 1)
  const after = t.snapshot().entities.filter((e) => e.components["Town/Rock"])
  assert.equal(after.length, rocks)
  assert(after.every((e) => e.components["Town/Rock"].amount === 1))
})

test("a market is upgraded to a market hall once the town is a town, and not before: paid now, built as carriers bring its materials", () => {
  const toasts: Array<string> = []
  const t = headless(charter, { toast: (m) => toasts.push(m) })
  t.run(1)
  let cell = { x: 0, y: 0 }
  t.change((s) => {
    cell = market(s)
  })
  t.edit({ type: "upgrade", cell })
  t.run(1)
  const hamlet = t.snapshot().entities.find((e) => e.components["Town/Building"]?.kind === "market")!
  assert.equal("Town/Upgraded" in hamlet.components, false)
  assert.equal("Town/Works" in hamlet.components, false)
  assert(toasts.some((m) => m.includes("needs the town to be a town")), toasts.join(" | "))

  t.change((s) => {
    s.resources["Town/Fate"].rank = 2
  })
  const up = kinds.market.upgrade!
  const coins = t.snapshot().resources["Town/Treasury"].coins, stone = stockOf(t.snapshot(), "stone")
  t.edit({ type: "upgrade", cell })
  t.run(1)
  const begun = t.snapshot(), works = begun.entities.find((e) => e.components["Town/Building"]?.kind === "market")!
  // The coins go at once; the materials are owed and then worked in, and the market works on meanwhile.
  assert(begun.resources["Town/Treasury"].coins <= coins - up.cost.coins)
  assert("Town/Works" in works.components, toasts.join(" | "))
  assert.equal(works.components["Town/Works"].total, Object.values(up.cost.materials).reduce((n, k) => n + k!, 0))
  assert.equal("Town/Upgraded" in works.components, false)
  assert.equal(works.components["Town/Service"].range, kinds.market.service!.range)
  assert(begun.resources["Town/Chronicle"].lines.some((l: { text: string }) => l.text === "Works begin on the market: it is to be a market hall."))
  t.run(90)
  const s = t.snapshot()
  const hall = s.entities.find((e) => e.components["Town/Building"]?.kind === "market")!
  assert.equal("Town/Works" in hall.components, false, JSON.stringify(hall.components["Town/Works"]))
  assert.deepEqual(hall.components["Town/Upgraded"], { level: 1 })
  assert.equal(hall.components["Town/Service"].range, up.service!.range)
  assert.equal(hall.components["Town/Service"].interval, stepsOf(up.service!.seconds))
  assert(stockOf(s, "stone") <= stone - up.cost.materials.stone!)
  assert(s.resources["Town/Chronicle"].lines.some((l: { text: string }) => l.text === "The market is now a market hall."))
})

test("the town hall becomes a guildhall from its own stores, and the guildhall a city hall", () => {
  const t = headless(charter)
  t.run(1)
  const hallOf = (s: Snapshot) => s.entities.find((e) => e.components["Town/TownHall"])!
  let cell = { x: 0, y: 0 }
  t.change((s) => {
    s.resources["Town/Fate"].rank = 2
    s.resources["Town/Treasury"].coins = 5000
    const hall = hallOf(s)
    cell = hall.components["Town/Tile"]
    hall.components["Town/Inventory"].stock = { ...hall.components["Town/Inventory"].stock, planks: 90, stone: 140, tools: 30, cloth: 30 }
  })
  t.edit({ type: "upgrade", cell })
  t.run(150)
  const guild = hallOf(t.snapshot())
  assert.deepEqual(guild.components["Town/Upgraded"], { level: 1 }, JSON.stringify(guild.components["Town/Works"]))
  assert.equal(guild.components["Town/Inventory"].cap, kinds.townhall.upgrade!.cap)
  assert.equal(guild.components["Town/Carriers"].count, kinds.townhall.upgrade!.carriers)
  t.edit({ type: "upgrade", cell })
  t.run(300)
  const city = hallOf(t.snapshot())
  assert.deepEqual(city.components["Town/Upgraded"], { level: 2 }, JSON.stringify(city.components["Town/Works"]))
  assert.equal(city.components["Town/Inventory"].cap, kinds.townhall.upgrade!.next!.cap)
})

test("once a term runs out, the next one carries on the same town", () => {
  const t = headless(charter)
  t.run(1)
  const end = charter.term * 3600
  t.change((s) => {
    s.resources["Town/Fate"] = { ...s.resources["Town/Fate"], state: "over", reason: "Term 1 is over.", at: end, rank: 1 }
    s.resources["Town/Crown"].open = true
  })
  const before = t.snapshot()
  t.edit({ type: "nextTerm" })
  t.run(1)
  const s = t.snapshot()
  const f = s.resources["Town/Fate"]
  assert.equal(f.state, "playing")
  assert.equal(f.term, 2)
  assert.equal(f.began, end)
  assert.equal(f.rank, 1)
  // The same town: its buildings and homes stand; its treasury is its own.
  assert.equal(s.entities.filter((e) => e.components["Town/Building"]).length, before.entities.filter((e) => e.components["Town/Building"]).length)
  // Winters for the new term's years, the first of them not spared.
  const winters = s.resources["Town/Charter"].winters
  assert.equal(winters.length, 2 * YEARS_PER_TERM)
  assert.notEqual(winters[YEARS_PER_TERM], "none")
  // The crown starts over: an open request lapses, and the next comes a while into the term.
  assert.equal(s.resources["Town/Crown"].open, false)
  assert(s.resources["Town/Crown"].next > end)
  assert(s.resources["Town/Chronicle"].lines.some((l: { text: string }) => l.text.startsWith("Term 2:")))
})

test("a long reign: five terms follow one another, each judged on its own, and the save stays in bounds", () => {
  const t = headless(charter)
  t.run(16)
  const term = charter.term * 3600
  const sample = t.snapshot().resources["Town/History"].samples.at(-1)
  assert(sample, "a sample of the town's history")
  for (let n = 1; n <= 5; n++) {
    // The term's history, as a long term would leave it, and the crown's tally from it; then its last seconds.
    t.change((s) => {
      const f = s.resources["Town/Fate"]
      const samples = s.resources["Town/History"].samples
      for (let i = 1; i <= 400; i++) samples.push({ ...sample, tick: f.began + Math.round((i * term) / 401) })
      s.resources["Town/Crown"] = { ...s.resources["Town/Crown"], met: 3, missed: 2, streak: 2 }
      s.resources["Town/Time"].step = s.resources["Town/Charter"].founded + f.began + term - 120
      s.resources["Town/Treasury"].coins = 5000
    })
    t.run(3)
    const over = t.snapshot().resources["Town/Fate"]
    assert.equal(over.state, "over", `term ${n} runs out on time`)
    assert.equal(over.term, n)
    assert.equal(over.began, (n - 1) * term)
    assert.match(over.reason, new RegExp(`^Term ${n} is over`))
    t.edit({ type: "nextTerm" })
    t.run(1)
    const s = t.snapshot()
    // The crown's tally starts again, so a term is scored on its own requests and no mayor starts one near dismissal.
    assert.deepEqual([s.resources["Town/Crown"].met, s.resources["Town/Crown"].missed, s.resources["Town/Crown"].streak], [0, 0, 0])
    assert.equal(s.resources["Town/Fate"].term, n + 1)
  }
  const s = t.snapshot()
  const samples: ReadonlyArray<{ tick: number }> = s.resources["Town/History"].samples
  // Older history thins (past 1200 samples), the term just played stays whole, and the samples stay in order.
  assert(samples.length < 5 * 400, `history thinned: ${samples.length} samples`)
  assert.equal(samples.filter((p) => p.tick >= 4 * term).length >= 400, true)
  assert(samples.every((p, i) => i === 0 || p.tick >= samples[i - 1]!.tick))
  assert(s.resources["Town/Chronicle"].lines.length <= 200)
  assert.equal(s.resources["Town/Charter"].winters.length, 6 * YEARS_PER_TERM)
  const size = JSON.stringify(s).length
  assert(size < 600_000, `save size ${size}`)
})

test("the bulldozer clears a worked face, but not a rock still standing", () => {
  const toasts: Array<string> = []
  const t = headless(charter, { toast: (m) => toasts.push(m) })
  t.run(1)
  const rocks = t.snapshot().entities.filter((e) => e.components["Town/Rock"])
  const [worked, standing] = [rocks[0]!, rocks[1]!]
  t.change((s) => {
    s.entities.find((e) => e.id === worked.id)!.components["Town/Rock"].amount = 0
    s.entities.find((e) => e.id === standing.id)!.components["Town/Rock"].amount = 12
  })
  t.edit({ type: "remove", cell: worked.components["Town/Tile"] }, { type: "remove", cell: standing.components["Town/Tile"] })
  t.run(1)
  const left = new Set(t.snapshot().entities.map((e) => e.id))
  assert.equal(left.has(worked.id), false)
  assert.equal(left.has(standing.id), true)
  assert(toasts.some((m) => m.startsWith("Quarry it down first")), toasts.join(" | "))
})

test("pulling down a market hall gives back part of the upgrade too", () => {
  const t = headless(charter)
  t.run(1)
  let cell = { x: 0, y: 0 }
  t.change((s) => {
    cell = market(s)
    s.resources["Town/Fate"].rank = 2
  })
  t.edit({ type: "upgrade", cell })
  t.run(90)
  assert.deepEqual(t.snapshot().entities.find((e) => e.components["Town/Building"]?.kind === "market")!.components["Town/Upgraded"], { level: 1 })
  const stone = stockOf(t.snapshot(), "stone")
  t.edit({ type: "remove", cell })
  t.run(1)
  const back = stockOf(t.snapshot(), "stone") - stone
  const base = kinds.market.cost.materials.stone!, up = kinds.market.upgrade!.cost.materials.stone!
  assert(back > Math.floor(base / 2), `${back} stone back, more than the market's own share`)
  assert(back <= base + up)
})

test("pulling down a building with works under way gives back the works' coins and what was brought, as a cancelled site does", () => {
  const t = headless(charter)
  t.run(1)
  let cell = { x: 0, y: 0 }
  t.change((s) => {
    cell = market(s)
    s.resources["Town/Fate"].rank = 2
  })
  t.edit({ type: "upgrade", cell })
  t.run(1)
  const begun = t.snapshot(), works = begun.entities.find((e) => e.components["Town/Building"]?.kind === "market")!.components["Town/Works"]
  assert(works, "the works began")
  const coins = begun.resources["Town/Treasury"].coins, stone = stockOf(begun, "stone")
  const up = kinds.market.upgrade!
  const brought = up.cost.materials.stone! - works.owed.stone
  t.edit({ type: "remove", cell })
  t.run(1)
  const after = t.snapshot()
  assert.equal(after.entities.some((e) => e.components["Town/Building"]?.kind === "market"), false)
  // The market's own fee is a small share of its coins: the works' coins come back whole on top.
  assert(after.resources["Town/Treasury"].coins >= coins + up.cost.coins - kinds.market.cost.coins, `${after.resources["Town/Treasury"].coins} from ${coins}`)
  assert(stockOf(after, "stone") >= stone + brought)
})

test("two clicks to upgrade the same building in one step begin one works, and pay once", () => {
  const t = headless(charter)
  t.run(1)
  let cell = { x: 0, y: 0 }
  t.change((s) => {
    cell = market(s)
    s.resources["Town/Fate"].rank = 2
    s.resources["Town/Treasury"].coins = 2000
  })
  t.edit({ type: "upgrade", cell }, { type: "upgrade", cell })
  t.run(1)
  const s = t.snapshot()
  assert("Town/Works" in s.entities.find((e) => e.components["Town/Building"]?.kind === "market")!.components)
  assert(s.resources["Town/Treasury"].coins > 2000 - 2 * kinds.market.upgrade!.cost.coins, String(s.resources["Town/Treasury"].coins))
})
