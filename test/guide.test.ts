/**
 * The mayor's guide (`src/game/rules/guide.ts`): it teaches a course in order,
 * chapter by chapter, and never falls silent before the town is complete;
 * signs from the town go ahead of the course once it is founded; it puts
 * away what the town has already done (shown or not); it says what opens a
 * building the town cannot build yet; and its words (each language's, in
 * `src/i18n/<locale>/guide.ts`: the rules say everything as data) fit a
 * finger as well as a mouse, and name what they name as tokens the game
 * knows. What the guide says is checked word for word in English; that it
 * says it well-formed, short, and with the same chips, in every language.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { amounts, kindIds, kinds, type KindId } from "../src/game/content/index.ts"
import {
  chapters, courseCount, courseSteps, guideDone, guideStep, guideStepIds, guideSteps, lockedNote, PLANKS_LOW, STONE_LOW, upcoming,
  type GuideFacts, type GuideLocked, type GuideSoon, type GuideStep, type GuideWaiting
} from "../src/game/rules/guide.ts"
import { en, load, locales, plain, say, type Catalog } from "../src/i18n/index.ts"
import { parse } from "../src/i18n/token.ts"

/** Every language the game speaks: what holds of the guide's words holds of each. */
const catalogs: ReadonlyArray<Catalog> = await Promise.all(locales.map(load))
/**
 * How long a text may run in a language: English sets the limit (what fits a phone's peek), and another
 * language may take a third more (Italian says the same in more letters), no further.
 */
const limit = (t: Catalog, english: number) => (t.locale === en.locale ? english : Math.floor((english * 4) / 3))
/**
 * How much room a text takes, in the columns of the page's monospace: a letter one, and a character of a
 * script set twice as wide (kana, kanji, hangul, full-width forms) two. So a limit means the same space on
 * a phone in every script.
 */
const columns = (text: string): number => [...text].reduce((n, character) => n + (/[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(character) ? 2 : 1), 0)
/** Where a sentence ends: a full stop, a question or an exclamation before a space or the end; or its like in a script that sets no space after it (。！？). */
const sentenceEnds = /[.!?](\s|$)|[。！？]/g
/** How many times a message leaves a word to the device ({tap|click}). */
const deviceChoices = (text: string): number => text.match(/\{[^{}|]*\|[^{}|]*\}/g)?.length ?? 0

const words = en.guide
/** A guide message as the mayor reads it: each chip by its word. */
const read = (message: string) => plain(en, message)
/** What a step says is under way, what keeps the town from it, and what comes next, in English as it is read (`null`: nothing). */
const waitingOf = (step: GuideStep, f: GuideFacts) => {
  const under = step.waiting?.(f) ?? null
  return under && read(say(words.waiting, under))
}
const lockedOf = (step: GuideStep, f: GuideFacts) => {
  const lock = lockedNote(step, f)
  return lock && read(say(words.locked, lock))
}
const upcomingOf = (f: GuideFacts, done: ReadonlySet<string>) => {
  const soon = upcoming(f, done)
  return soon && read(say(words.upcoming, soon))
}
/** A step by its id. */
const stepOf = (id: string) => guideSteps.find((s) => s.id === id)!

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
const founding = courseSteps.filter((s) => s.chapter === "founding")
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
  assert.match(lockedOf(stepOf("wheat"), short)!, /The farm opens at 60 residents \(45 now\)/)
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
  assert.deepEqual(upcoming(plenty, new Set(guideDone(plenty, none))), { _tag: "lumberjack", below: PLANKS_LOW, now: 31 })
  assert.equal(upcomingOf(plenty, new Set(guideDone(plenty, none))), `Next: a lumberjack and a sawmill, once planks fall below ${PLANKS_LOW} (31 now).`)
  // A laid lumberjack stays asked for while it goes up, whatever the planks.
  const laying = { ...plenty, placed: new Set<KindId>(["fishery", "lumberjack"]) }
  assert.equal(next(laying), "lumberjack")
  // The quarry waits for stone; the market for homes beyond the walkers; the smithy for tools.
  assert.equal(upcomingOf(founded(), new Set(guideDone(founded(), none))), `Next: a quarry, once stone falls below ${STONE_LOW} (16 now).`)
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
  assert.deepEqual(lockedNote(stepOf("chapel"), poor), { _tag: "coins", kind: "chapel", cost: 200, now: 120 })
  assert.match(lockedOf(stepOf("chapel"), poor)!, /Save up: the chapel costs 200 coins \(120 now\)/)
  // The sheep farm (100) can be paid for, the weaver (150) not yet: the cloth step asks, the cheaper first.
  assert.equal(lockedNote(stepOf("cloth"), poor), null)
})

test("every course step is one thing to do and one reason, short enough for a phone, in every language", () => {
  for (const t of catalogs) {
    for (const step of courseSteps) {
      const { action, why } = t.guide.steps[step.id]
      const said = plain(t, action)
      assert.ok(columns(said) <= limit(t, 110), `${t.locale} ${step.id}: the action fits a phone's peek (${columns(said)})`)
      assert.equal(said.match(sentenceEnds)?.length, 1, `${t.locale} ${step.id}: the action is one sentence`)
      assert.ok(columns(plain(t, why)) <= limit(t, 180), `${t.locale} ${step.id}: the reason is short (${columns(plain(t, why))})`)
    }
  }
})

/** Every message the guide can show in a language: each step's words, and what it says of a town under way, locked, or waiting. */
const everyMessage = (t: Catalog): Array<readonly [string, string]> => {
  const words = t.guide
  const waitings: ReadonlyArray<GuideWaiting> = [{ _tag: "homesNoPlanks" }, { _tag: "homesRising" }, { _tag: "siteNoPlanks" }, { _tag: "siteRising" }, { _tag: "homesLaid" }]
  const lockeds: ReadonlyArray<GuideLocked> = kindIds.flatMap((kind): Array<GuideLocked> => [
    { _tag: "residents", kind, needs: 60, now: 45 },
    { _tag: "citizens", kind, needs: 10, now: 4 },
    { _tag: "coins", kind, cost: 200, now: 120 }
  ])
  const soons: ReadonlyArray<GuideSoon> = [{ _tag: "lumberjack", below: PLANKS_LOW, now: 31 }, { _tag: "sawmill", below: PLANKS_LOW, now: 31 }, { _tag: "quarry", below: STONE_LOW, now: 16 }]
  return [
    ...guideSteps.flatMap((step) => {
      const { action, why, goal } = words.steps[step.id]
      return [[`${step.id}: action`, action], [`${step.id}: why`, why], [`${step.id}: goal`, goal]] as const
    }),
    ...waitings.map((w) => [`waiting: ${w._tag}`, say(words.waiting, w)] as const),
    ...lockeds.map((l) => [`locked: ${l._tag} ${l.kind}`, say(words.locked, l)] as const),
    ...soons.map((soon) => [`upcoming: ${soon._tag}`, say(words.upcoming, soon)] as const)
  ]
}

test("no step names a key: tools are chips, and words fit both a finger and a mouse, in every language", () => {
  const english = new Map(everyMessage(en))
  for (const t of catalogs) {
    for (const [what, text] of everyMessage(t)) {
      assert.doesNotMatch(text, /\b(press|premi) [A-Z]\b|\bEsc\b/i, `${t.locale} ${what}: no keys`)
      assert.ok(parse(text).every((part) => part.type !== "key"), `${t.locale} ${what}: no keys`)
      // What a mouse does ("click", "clicca") is only ever said beside what a finger does, as {tap|click}.
      assert.doesNotMatch(text.replace(/\{[^}]*\}/g, ""), /\bclic/i, `${t.locale} ${what}: "click" only as {tap|click}`)
      // And whatever a language calls the two, it leaves the word to the device wherever English does.
      assert.equal(deviceChoices(text), deviceChoices(english.get(what) ?? ""), `${t.locale} ${what}: a finger's word and a mouse's, as often as English`)
    }
  }
})

test("every guide message names what it names as tokens the game knows, in every language", () => {
  for (const t of catalogs) {
    for (const [what, text] of everyMessage(t)) {
      assert.ok(plain(t, text).trim() !== "", `${t.locale} ${what}: says something`)
      // Read as words, with the device's choice made: whatever is still in brackets or braces is a token nothing knows (a misspelt tool, a building that is not one).
      const said = plain(t, text).replace(/\{([^{}|]*)\|([^{}|]*)\}/g, "$2")
      assert.doesNotMatch(said, /[[\]{}]/, `${t.locale} ${what}: every token is one the game knows`)
    }
    // The chapters and the steps are all worded, and nothing is worded that is not a step.
    assert.deepEqual(Object.keys(t.guide.chapters).sort(), [...chapters].sort(), t.locale)
    assert.deepEqual(Object.keys(t.guide.steps).sort(), [...guideStepIds].sort(), t.locale)
  }
})

test("every language names the same things in each step as English does: the same buildings, goods, tools, and map views", () => {
  /** What a message names beyond words, whatever the order a language says it in: each token's kind and id, sorted. */
  const named = (text: string) =>
    parse(text)
      .flatMap((part) => (part.type === "kind" ? [`kind:${part.kind}`] : part.type === "good" ? [`good:${part.good}`] : part.type === "command" ? [`command:${part.command}`] : part.type === "view" ? [`view:${part.view}`] : []))
      .sort()
  const english = new Map(everyMessage(en))
  for (const t of catalogs) for (const [what, text] of everyMessage(t)) assert.deepEqual(named(text), named(english.get(what)!), `${t.locale} ${what}`)
})

test("a step under way says what the town is doing about it", () => {
  const homes = stepOf("homes")
  assert.equal(waitingOf(homes, fresh), null, "nothing laid: nothing under way")
  assert.match(waitingOf(homes, town({ homes: 4, builtHomes: 0 }))!, /planks/)
  assert.match(waitingOf(homes, town({ homes: 4, builtHomes: 0, stock: amounts({ planks: 0 }) }))!, /no(ne| planks)/)
  const fishery = stepOf("fishery")
  const laid = { ...town({ homes: 4, residents: 8 }), placed: new Set<KindId>(["fishery"]) }
  assert.equal(guideStep(laid, new Set(["homes", "road"]))?.id, "fishery", "a laid fishery is not done until it stands")
  assert.match(waitingOf(fishery, laid)!, /building site/)
  assert.equal(waitingOf(fishery, town({ homes: 4 }, ["fishery"])), null, "standing: no longer under way")
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
      for (const t of catalogs) assert.ok(parse(t.guide.steps[step.id].action).some((part) => part.type === "kind" && part.kind === kind), `${t.locale}: ${step.id} names the ${kind} as a chip`)
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

test("every step says what closes it, in every language", () => {
  for (const t of catalogs) {
    for (const step of guideSteps) {
      const goal = plain(t, t.guide.steps[step.id].goal)
      assert.ok(goal.length > 0 && columns(goal) <= limit(t, 80), `${t.locale} ${step.id} (${columns(goal)})`)
    }
  }
})

test("every step can be done, and a town that has done them all is told nothing", () => {
  const all = guideSteps.map((s) => s.id)
  assert.equal(new Set(all).size, all.length, "step ids are unique")
  assert.deepEqual([...all].sort(), [...guideStepIds].sort(), "every id is a step")
  const finished = town(
    {
      homes: 200, residents: 400, citizens: 200, finerHomes: 30, crown: { open: true, met: 3 }, trading: true, taxed: true, sawTown: true, sawHome: true, sawBuilding: true,
      roadToWater: true, rank: 3, upgraded: new Set<KindId>(["market"]), unreached: 5, winter: true, worn: true, poorStreet: true, approval: 40, net: -5, most: 120, stock: amounts({ tools: 0 })
    },
    ["fishery", "lumberjack", "sawmill", "forester", "quarry", "granary", "firewatch", "builder", "market", "sheep", "weaver", "chapel", "farm", "mill", "bakery", "healer", "watchhouse", "mine", "smithy", "carpenter"]
  )
  assert.deepEqual(guideDone(finished, none).sort(), [...all].sort())
  assert.equal(guideStep(finished, none), null)
})
