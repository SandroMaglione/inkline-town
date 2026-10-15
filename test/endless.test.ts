/**
 * The town that goes on: ranks as milestones, terms that follow one
 * another, worked faces that never run dry, and buildings upgraded where
 * they stand. Each check runs the real simulation, headless, for seconds
 * of game time, from a town put into the situation through its snapshot.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { amounts, FACE_TICKS, goodIds, kinds, ranks, ticks, YEARS_PER_TERM } from "../src/content.ts"
import { canPlace, GridBuilder } from "../src/grid.ts"
import { goalsOf, nextRank, scoreOf } from "../src/rules/goals.ts"
import { headless, type Snapshot } from "../src/sim/headless.ts"

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
      "Town/Service": { service: "goods", interval: ticks(m.service!.seconds), cooldown: 0, range: m.service!.range },
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
  // A rank counts for more than its people.
  const s = { settlers: 100, citizens: 50, burghers: 10, coins: 2000, approval: 20, met: 2, missed: 0 }
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

test("a market is upgraded to a market hall once the town is a town, and not before", () => {
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
  assert(toasts.some((m) => m.includes("needs the town to be a town")), toasts.join(" | "))

  t.change((s) => {
    s.resources["Town/Fate"].rank = 2
  })
  const stone = stockOf(t.snapshot(), "stone")
  t.edit({ type: "upgrade", cell })
  t.run(1)
  const s = t.snapshot()
  const hall = s.entities.find((e) => e.components["Town/Building"]?.kind === "market")!
  const up = kinds.market.upgrade!
  assert.equal("Town/Upgraded" in hall.components, true)
  assert.equal(hall.components["Town/Service"].range, up.service!.range)
  assert.equal(hall.components["Town/Service"].interval, ticks(up.service!.seconds))
  assert.equal(stockOf(s, "stone"), stone - up.cost.materials.stone!)
  assert(s.resources["Town/Chronicle"].lines.some((l: { text: string }) => l.text === "The market is now a market hall."))
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
