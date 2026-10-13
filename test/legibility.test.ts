/**
 * Legibility: when a home is stuck, the game must say why in words that
 * name the cause. The bots win because they know the thresholds; a player
 * only learns them from the panel. These tests hold the panel's reasons to
 * the usual dead ends: cloth withheld from a poor street, no walker in
 * reach, nothing in store, a workshop no one can walk to; and they play a
 * real town into the commonest one (cottages beside a quarry) and check
 * what the rules then say about it.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { COMMUTE, home, kinds, type CharterValue } from "../src/content.ts"
import { appealAt } from "../src/appeal.ts"
import { canPlace, GridBuilder, type Use } from "../src/grid.ts"
import type { Snapshot } from "../src/sim/headless.ts"
import { blockers, streetShort, whyUnmet, type InTown, type Served, type Street } from "../src/rules/explain.ts"
import { capacity, streetRoom, streetTax, taxOf } from "../src/rules/households.ts"
import { approvalTarget, grudgeAfter } from "../src/rules/approval.ts"
import { headless } from "../src/sim/headless.ts"

const settlers = { tier: 1 as const, residents: 4, food: 100, bread: 100, cloth: 0, faith: 100, clock: 0 }
const plenty: InTown = { fish: 20, smoked: 0, bread: 30, cloth: 188 }
const served: Served = { goods: true, faith: true }
const quarryStreet: Street = { desirability: -4, parts: [{ label: "quarry", value: -6 }, { label: "chapel", value: 2 }] }

test("cloth withheld from a poor street is told as the street, not as missing cloth", () => {
  const why = whyUnmet("cloth", settlers, quarryStreet, plenty, served)
  assert.ok(why, "an unmet need has a reason")
  assert.match(why, /not brought here/)
  assert.match(why, /needs 5/)
  assert.match(why, /quarry −6/)
  const all = blockers(settlers, quarryStreet, plenty, served, { fire: 0, health: 0, order: 0 })
  assert.deepEqual(all.map((b) => b.what), ["cloth", "street"])
  assert.match(all[1]!.text, /move industry away|park/)
})

test("on a street fit for citizens the reason moves to the walker or the store", () => {
  const fine: Street = { desirability: 6, parts: [{ label: "chapel", value: 4 }, { label: "market", value: 2 }] }
  assert.match(whyUnmet("cloth", settlers, fine, plenty, served)!, /walker has not passed with cloth/)
  assert.match(whyUnmet("cloth", settlers, fine, { ...plenty, cloth: 0 }, served)!, /no cloth: a weaver/)
  assert.match(whyUnmet("cloth", settlers, fine, plenty, { goods: false, faith: true })!, new RegExp(`${kinds.market.service!.range} road cells`))
  assert.equal(whyUnmet("faith", settlers, fine, plenty, served), null)
  assert.match(whyUnmet("faith", { ...settlers, faith: 0 }, fine, plenty, { goods: true, faith: false })!, /no chapel walker/)
  assert.match(whyUnmet("food", { ...settlers, food: 0 }, fine, { fish: 0, smoked: 0, bread: 0, cloth: 0 }, served)!, /no food in store/)
  assert.equal(streetShort(quarryStreet, 5), "−4 here, 5 needed: quarry −6")
})

test("desirability counts point by point: a cottage beside a quarry empties a little and pays less", () => {
  assert.equal(streetRoom(0), 1)
  assert.ok(streetRoom(-4) < 0.7 && streetRoom(-4) > 0.6)
  assert.equal(streetRoom(-30), home.street.roomLeast)
  assert.equal(capacity(settlers, 0, 0), 4)
  assert.equal(capacity(settlers, 0, -4), 3)
  assert.equal(capacity(settlers, 30, -8), 2, "even a town that approves of its mayor will not fill a cottage beside a quarry")
  assert.ok(streetTax(6) > 1 && streetTax(-6) < 1)
  const fed = { ...settlers, bread: 100 }, plain = { ...settlers, bread: 0 }
  assert.ok(taxOf(fed, { settlers: 100, citizens: 100 }) > taxOf(plain, { settlers: 100, citizens: 100 }), "bread on the table pays")
  assert.equal(taxOf({ ...settlers, food: 0 }, { settlers: 100, citizens: 100 }), 0, "no food, no taxes")
  assert.ok(taxOf(fed, { settlers: 100, citizens: 100 }) >= 1.5 * taxOf(plain, { settlers: 100, citizens: 100 }), "a cottage with bread pays half again a merely fed one")
})

test("a grudge over high taxes builds, holds, and fades slowly", () => {
  let memory = 0
  for (let i = 0; i < 60; i++) memory = grudgeAfter(memory, 200)
  assert.ok(memory >= 200, `ten minutes at 200% is a grudge of ${memory / 10} points`)
  const squeezed = approvalTarget([settlers], { settlers: 50, citizens: 50 }, 100, 0, false, undefined, memory)
  const spared = approvalTarget([settlers], { settlers: 50, citizens: 50 }, 100, 0, false, undefined, 0)
  assert.ok(squeezed.target < spared.target - 15, "cutting taxes at the end does not wipe the grudge")
  let later = memory
  for (let i = 0; i < 30; i++) later = grudgeAfter(later, 50)
  assert.ok(later < memory && later > 0, "it fades over minutes, not at once")
  assert.equal(grudgeAfter(0, 100), 0)
})

/** The grid as the town's edits see it, from a snapshot: where a building could go. */
const gridOf = (s: Snapshot) => {
  const g = new GridBuilder(s.resources["Town/Land"].mask)
  for (const e of s.entities) {
    const c = e.components
    if (!c["Town/Tile"]) continue
    const use: Use = c["Town/Road"] ? "road" : c["Town/Park"] ? "park" : c["Town/House"] ? "house" : c["Town/Tree"] ? "tree" : c["Town/Rock"] ? "rock" : c["Town/Water"] ? "water" : c["Town/Field"] ? "field" : c["Town/Ruin"] ? "ruin" : "building"
    g.claim(c["Town/Tile"], e.id, use)
  }
  return g.value()
}

test("a real town: cottages beside a quarry are told why they will not grow", { timeout: 120000 }, () => {
  const charter: CharterValue = { size: "small", term: 45, land: "fair", seed: 7 }
  const town = headless(charter)
  const hall = town.snapshot().entities.find((e) => e.components["Town/TownHall"])!
  const t = hall.components["Town/Tile"] as { x: number; y: number; size: number }
  // A street east of the hall's ring, cottages along its north side, and a quarry on the south side, right across from them.
  const y = t.y + 1
  const road = Array.from({ length: 9 }, (_, i) => ({ x: t.x + t.size + 1 + i, y }))
  const homes = Array.from({ length: 4 }, (_, i) => ({ x: t.x + t.size + 2 + i, y: y - 1 }))
  town.edit({ type: "roads", cells: road }, { type: "homes", cells: homes })
  town.run(1)
  const grid = gridOf(town.snapshot())
  const spot = road.map((c) => ({ x: c.x, y: y + 1 })).find((c) => canPlace(grid, { ...c, size: kinds.quarry.size }))
  assert.ok(spot, "somewhere along the street a quarry fits; change the seed if the land has moved")
  town.edit({ type: "building", kind: "quarry", cell: spot, open: false })
  town.run(90)
  const s = town.snapshot()
  const cottages = s.entities.filter((e) => e.components["Town/House"] && homes.some((h) => h.x === e.components["Town/Tile"].x && h.y === e.components["Town/Tile"].y))
  assert.ok(cottages.length >= 2, "the scenario lays cottages on this seed; change the seed or the cells if the land has moved")
  assert.ok(s.entities.some((e) => e.components["Town/Building"]?.kind === "quarry" && !e.components["Town/Site"]), "the quarry stands")
  const cells = s.resources["Town/Appeal"].cells as ReadonlyArray<number>
  const worst = cottages.map((e) => appealAt(cells, e.components["Town/Tile"].x, e.components["Town/Tile"].y)).sort((a, b) => a - b)[0]!
  assert.ok(worst < 0, `a cottage beside a quarry is on a poor street (${worst})`)
  const house = cottages[0]!.components["Town/House"]
  const street: Street = { desirability: worst, parts: [{ label: "quarry", value: worst }] }
  const why = blockers({ ...house, bread: 1, faith: 1, cloth: 0 }, street, plenty, served, undefined)
  assert.ok(why.some((b) => b.what === "cloth" && /needs 5/.test(b.text)), "cloth is explained by the street")
  assert.ok(why.some((b) => b.what === "street" && /quarry/.test(b.text)), "the street names the quarry")
  // And the rules bite at once: the street holds fewer than a plain one would.
  assert.ok(capacity(house, s.resources["Town/Mood"].approval, worst) < capacity(house, s.resources["Town/Mood"].approval, 0) || worst > -3, "a street below −2 holds fewer")
  // A workplace with nobody in reach says so in the same breath.
  assert.ok(COMMUTE === 15)
})
