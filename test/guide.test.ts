/**
 * The mayor's guide (`src/rules/guide.ts`): it teaches a course in order,
 * chapter by chapter, and never falls silent before the town is complete;
 * signs from the town go ahead of the course once it is founded; it puts
 * away what the town has already done (shown or not); it says what opens a
 * building the town cannot build yet; and its words fit a finger as well as
 * a mouse.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { amounts, kinds, type KindId } from "../src/content.ts"
import { courseCount, courseSteps, guideDone, guideStep, guideSteps, lockedNote, PLANKS_LOW, STONE_LOW, upcoming, type GuideFacts } from "../src/rules/guide.ts"

const fresh: GuideFacts = {
  homes: 0,
  builtHomes: 0,
  residents: 0,
  citizens: 0,
  finerHomes: 0,
  placed: new Set(),
  standing: new Set(),
  stock: amounts({ planks: 40, stone: 16, tools: 10, fish: 20 }),
  sick: 0,
  burning: 0,
  winter: false,
  winterIn: null,
  worn: false,
  poorStreet: false,
  crown: { open: false, met: 0 },
  net: 10,
  approval: 0,
  trading: false,
  buysTools: false,
  taxed: false,
  most: 40,
  sawTown: false,
  sawHome: false,
  sawBuilding: false,
  roadToWater: false,
  rank: 0,
  upgraded: new Set(),
  coins: 1900,
  unreached: 0,
  risk: { fire: false, health: false, order: false },
  fewTrees: false
}
const town = (over: Partial<GuideFacts>, built: ReadonlyArray<KindId> = []): GuideFacts => ({
  ...fresh,
  placed: new Set(built),
  standing: new Set(built),
  builtHomes: over.homes ?? 0,
  ...over
})
const none = new Set<string>()
/** What the guide says next for a town, with what it has done put away. */
const next = (facts: GuideFacts, pace: { readonly shown?: string | null; readonly quiet?: boolean } = { quiet: true }, skipped: ReadonlyArray<string> = []) =>
  guideStep(facts, new Set([...guideDone(facts, none), ...skipped]), pace)?.id
const founding = courseSteps.filter((s) => s.chapter === "Founding")
/** A town through the Founding chapter. */
const founded = (over: Partial<GuideFacts> = {}, built: ReadonlyArray<KindId> = []) =>
  town({ homes: 10, residents: 30, roadToWater: true, sawBuilding: true, sawTown: true, ...over }, ["fishery", "lumberjack", "sawmill", ...built])

const low = amounts({ planks: PLANKS_LOW - 5, stone: 16, tools: 10, fish: 20 })

test("a new town is founded in order: homes, a road to the water, a fishery, its panel, planks (once low), the goal, ten homes", () => {
  assert.deepEqual(
    founding.map((s) => s.id),
    ["homes", "road", "fishery", "look", "lumberjack", "sawmill", "term", "grow"]
  )
  assert.equal(guideStep(fresh, none)?.id, "homes")
  assert.equal(next(town({ homes: 4, residents: 8 })), "road", "no quiet in the opening")
  assert.equal(next(town({ homes: 4, residents: 8, roadToWater: true })), "fishery")
  assert.equal(next(town({ homes: 4, residents: 8, roadToWater: true }, ["fishery"])), "look")
  assert.equal(next(town({ homes: 4, residents: 8, roadToWater: true, sawBuilding: true, stock: low }, ["fishery"])), "lumberjack")
  assert.equal(next(town({ homes: 4, residents: 8, roadToWater: true, sawBuilding: true }, ["fishery", "lumberjack"])), "sawmill", "a lumberjack wants its sawmill")
  assert.equal(next(town({ homes: 4, residents: 8, roadToWater: true, sawBuilding: true }, ["fishery", "lumberjack", "sawmill"])), "term")
  assert.equal(next(town({ homes: 4, residents: 8, roadToWater: true, sawBuilding: true, sawTown: true }, ["fishery", "lumberjack", "sawmill"])), "grow")
  assert.ok(guideDone(founded(), none).includes("grow"))
  assert.deepEqual(courseCount(founding[2]!), { at: 3, of: 8 })
})

test("after ten homes the course goes on to citizens, never falling silent, a building the town can build first", () => {
  // Ten homes stand, and quiet or not, the guide has the next step. Stone in store: no quarry yet.
  assert.equal(next(founded()), "cloth")
  assert.equal(next(founded({ stock: amounts({ planks: 30, stone: STONE_LOW - 2 }) })), "quarry", "a quarry once stone runs low")
  // Cloth and faith open at 40 residents, bread at 60: with 45, cloth comes first.
  const some = founded({ residents: 45 }, ["quarry"])
  assert.equal(next(some), "cloth")
  assert.equal(next(founded({ residents: 45 }, ["quarry", "sheep", "weaver"])), "chapel")
  // Bread cannot be made yet: the step says what opens it.
  const short = founded({ residents: 45 }, ["quarry", "sheep", "weaver", "chapel"])
  assert.equal(next(short), "wheat")
  assert.match(lockedNote(guideSteps.find((s) => s.id === "wheat")!, short)!, /opens at 60 residents \(45 now\)/)
  assert.equal(next(founded({ residents: 60 }, ["quarry", "sheep", "weaver", "chapel", "farm", "mill"])), "bakery")
  const supplied = founded({ residents: 70 }, ["quarry", "sheep", "weaver", "chapel", "farm", "mill", "bakery"])
  assert.equal(next(supplied), "citizens")
  assert.equal(next({ ...supplied, finerHomes: 1, sawTown: false }, { quiet: true }, founding.map((s) => s.id)), "goals")
  // The last word: the ranks, up to a city.
  assert.equal(next({ ...supplied, finerHomes: 1 }), "ranks")
  assert.equal(next({ ...supplied, finerHomes: 1, rank: 2 }), "ranks")
  assert.equal(next({ ...supplied, finerHomes: 1, rank: 3 }), undefined)
})

test("the course never asks for a building before the town needs it, and says what comes next", () => {
  // Plenty of planks: past the lumberjack and sawmill to the goal, saying when they come.
  const plenty = town({ homes: 4, residents: 8, roadToWater: true, sawBuilding: true, stock: amounts({ planks: 31, stone: 16 }) }, ["fishery"])
  assert.equal(next(plenty), "term")
  assert.equal(upcoming(plenty, new Set(guideDone(plenty, none))), `Next: a lumberjack and a sawmill, once planks fall below ${PLANKS_LOW} (31 now).`)
  // A laid lumberjack stays asked for while it goes up, whatever the planks.
  const laying = { ...plenty, placed: new Set<KindId>(["fishery", "lumberjack"]) }
  assert.equal(next(laying), "lumberjack")
  // The quarry waits for stone; the market for homes beyond the walkers; the smithy for tools.
  assert.equal(upcoming(founded(), new Set(guideDone(founded(), none))), `Next: a quarry, once stone falls below ${STONE_LOW} (16 now).`)
  assert.notEqual(next(founded({ residents: 60 }), {}), "market")
  assert.equal(next(founded({ unreached: 3 }), {}), "market")
  // A town rank town with a market: upgrade it rather than build another.
  assert.equal(next(founded({ unreached: 3, rank: 2 }, ["market"]), {}), "markethall")
  assert.notEqual(next(founded({ unreached: 3, rank: 1 }, ["market"]), {}), "markethall", "not before the town rank")
  assert.notEqual(next(founded({ citizens: 12, residents: 80 }, ["quarry", "sheep", "weaver", "chapel", "farm", "mill", "bakery"]), {}), "smithy")
  assert.equal(next(founded({ citizens: 12, residents: 80, stock: amounts({ tools: 3, planks: 40, stone: 20 }) }, ["quarry", "sheep", "weaver", "chapel", "farm", "mill", "bakery"]), {}), "smithy")
})

test("a step the treasury cannot pay for says to save up, and gives way to one it can", () => {
  const poor = founded({ residents: 45, coins: 120 }, [])
  const chapel = guideSteps.find((s) => s.id === "chapel")!
  assert.match(lockedNote(chapel, poor)!, /Save up: the chapel costs 200 coins \(120 now\)/)
  // The sheep farm (100) can be paid for, the weaver (150) not yet: the cloth step asks, the cheaper first.
  assert.equal(lockedNote(guideSteps.find((s) => s.id === "cloth")!, poor), null)
})

test("every course step is one thing to do and one reason, short enough for a phone", () => {
  for (const step of courseSteps) {
    assert.ok(step.action.length <= 110, `${step.id}: the action fits a phone's peek`)
    assert.equal(step.action.match(/[.!?](\s|$)/g)?.length, 1, `${step.id}: the action is one sentence`)
    assert.ok(step.why.length <= 180, `${step.id}: the reason is short`)
  }
})

test("no step names a key: tools are chips, and words fit both a finger and a mouse", () => {
  for (const step of guideSteps) {
    for (const text of [step.action, step.why, step.goal, step.waiting?.(fresh) ?? "", lockedNote(step, fresh) ?? ""]) {
      assert.doesNotMatch(text, /\([A-Z]\)|\bpress [A-Z]\b|\bEsc\b/i, `${step.id}: no keys`)
      assert.doesNotMatch(text.replace(/\{[^}]*\}/g, ""), /\bclick/i, `${step.id}: "click" only as {tap|click}`)
      for (const [, tool] of text.matchAll(/\[([a-z:]+)\]/g)) {
        assert.ok(
          ["select", "road", "pave", "homes", "build", "bulldoze", "town", "speed", "pause"].includes(tool!) || /^view:(appeal|workers|fire|health|order|condition)$/.test(tool!),
          `${step.id}: [${tool}] is a tool`
        )
      }
    }
  }
})

test("a step under way says what the town is doing about it", () => {
  const homes = guideSteps.find((s) => s.id === "homes")!
  assert.equal(homes.waiting!(fresh), null, "nothing laid: nothing under way")
  assert.match(homes.waiting!(town({ homes: 4, builtHomes: 0 }))!, /planks/)
  assert.match(homes.waiting!(town({ homes: 4, builtHomes: 0, stock: amounts({ planks: 0 }) }))!, /no(ne| planks)/)
  const fishery = guideSteps.find((s) => s.id === "fishery")!
  const laid = { ...town({ homes: 4, residents: 8 }), placed: new Set<KindId>(["fishery"]) }
  assert.equal(guideStep(laid, new Set(["homes", "road"]))?.id, "fishery", "a laid fishery is not done until it stands")
  assert.match(fishery.waiting!(laid)!, /building site/)
  assert.equal(fishery.waiting!(town({ homes: 4 }, ["fishery"])), null, "standing: no longer under way")
})

test("a mayor who already knows the game is not walked through it", () => {
  const experienced = founded({ residents: 40 }, ["quarry"])
  const put = new Set(guideDone(experienced, none))
  for (const step of founding) assert.ok(put.has(step.id), step.id)
  assert.ok(put.has("quarry"))
  // A skipped step stays away, and the next comes.
  assert.equal(guideStep(fresh, new Set(["homes"]))?.id, "road")
})

test("the founding goes on past a step that cannot apply yet", () => {
  // The fishery was skipped: no panel to look at, so on to the lumberjack.
  assert.equal(next(town({ homes: 4, residents: 8, roadToWater: true, stock: low }), {}, ["fishery"]), "lumberjack")
})

test("signs wait while the town is founded, then go ahead of the course", () => {
  const fire = { fire: true, health: false, order: false }
  assert.equal(next(town({ homes: 4, residents: 8, risk: fire })), "road", "founding first")
  assert.equal(next(founded({ risk: fire }), {}), "firewatch")
  assert.equal(next(founded({ fewTrees: true }), {}), "forester")
  // While the guide keeps quiet, the course speaks instead.
  assert.equal(next(founded({ fewTrees: true }), { quiet: true }), "cloth")
})

test("after a step the guide keeps quiet about signs, but not through a fire or the crown's request", () => {
  const facts = founded({ fewTrees: true })
  assert.notEqual(next(facts, { quiet: true }), "forester")
  assert.equal(next({ ...facts, burning: 1 }, { quiet: true }), "firewatch")
  assert.equal(next({ ...facts, crown: { open: true, met: 0 } }, { quiet: true }), "crown")
})

test("a sign once shown stays until it is done, even if it fades", () => {
  const thinning = founded({ fewTrees: true })
  assert.equal(next(thinning, {}), "forester")
  const planted = { ...thinning, fewTrees: false }
  assert.equal(next(planted, {}), "cloth")
  assert.equal(next(planted, { shown: "forester" }), "forester")
})

test("the crown's deadline goes ahead of everything", () => {
  assert.equal(next(town({ homes: 2, residents: 8, crown: { open: true, met: 0 } })), "crown")
})

test("winter is foretold before it comes, and not long before", () => {
  assert.notEqual(next(founded({ winterIn: 400 })), "winter")
  assert.equal(next(founded({ winterIn: 90 })), "winter")
  assert.equal(next(founded({ winter: true, winterIn: 300 })), "winter")
})

test("a town that runs short of tools before its workshops is told to keep them", () => {
  assert.equal(next(founded({ stock: amounts({ tools: 2, planks: 30, stone: 10 }) }, ["sheep"]), {}), "tools")
})

test("the guide never sends the mayor to place a building the town cannot build yet", () => {
  // Whatever else is true, a town just short of each unlock.
  const everything = (residents: number, citizens: number) =>
    founded({ homes: 30, residents, citizens, winter: true, winterIn: 60, worn: true, sick: 3, burning: 1, risk: { fire: true, health: true, order: true }, fewTrees: true, poorStreet: true, unreached: 5, stock: amounts({ tools: 1 }) })
  for (const step of guideSteps) {
    for (const kind of step.asks ?? []) {
      const { residents, citizens } = kinds[kind].unlock
      assert.ok(kinds[kind].buildable, `${kind} can be built`)
      assert.match(step.action.toLowerCase(), new RegExp(kinds[kind].title.toLowerCase()), `${step.id} names the ${kind}, so it becomes a chip`)
      // Short of the unlock: either the step does not apply, or it says what opens it.
      for (const short of [residents > 0 ? everything(residents - 1, citizens) : null, citizens > 0 ? everything(residents + 200, citizens - 1) : null]) {
        if (!short) continue
        if (!step.when(short)) continue
        // A step asking for one of several (a granary or a smokehouse) is fine while one of them is open.
        const any = step.asks!.some((k) => kinds[k].unlock.residents <= short.residents && kinds[k].unlock.citizens <= short.citizens)
        assert.ok(step.course ? lockedNote(step, short) !== null : any, `${step.id} asks for a ${kind} before it opens, and says nothing`)
      }
    }
  }
})

test("every step says what closes it", () => {
  for (const step of guideSteps) assert.ok(step.goal.length > 0 && step.goal.length <= 80, step.id)
})

test("every step can be done, and a town that has done them all is told nothing", () => {
  const all = guideSteps.map((s) => s.id)
  assert.equal(new Set(all).size, all.length, "step ids are unique")
  const finished = town(
    {
      homes: 200, residents: 400, citizens: 200, finerHomes: 30, crown: { open: true, met: 3 }, trading: true, taxed: true, sawTown: true, sawHome: true, sawBuilding: true,
      roadToWater: true, rank: 3, upgraded: new Set<KindId>(["market"]), unreached: 5, winter: true, worn: true, poorStreet: true, approval: 40, net: -5, most: 120, stock: amounts({ tools: 0 })
    },
    ["fishery", "lumberjack", "sawmill", "forester", "quarry", "granary", "firewatch", "builder", "market", "sheep", "weaver", "chapel", "farm", "mill", "bakery", "healer", "watchhouse", "mine", "smithy"]
  )
  assert.deepEqual(guideDone(finished, none).sort(), [...all].sort())
  assert.equal(guideStep(finished, none), null)
})
