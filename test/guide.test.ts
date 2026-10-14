/**
 * The mayor's guide (`src/rules/guide.ts`): it starts at the first step,
 * goes in order of priority, puts away what the town has already done
 * (shown or not), and never tells the mayor to build what the town cannot
 * build yet.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { amounts, kinds, type KindId } from "../src/content.ts"
import { guideDone, guideStep, guideSteps, type GuideFacts } from "../src/rules/guide.ts"

const fresh: GuideFacts = {
  homes: 0,
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
  taxed: false,
  most: 40,
  sawTown: false,
  risk: { fire: false, health: false, order: false },
  fewTrees: false
}
const town = (over: Partial<GuideFacts>, built: ReadonlyArray<KindId> = []): GuideFacts => ({
  ...fresh,
  placed: new Set(built),
  standing: new Set(built),
  ...over
})
const none = new Set<string>()

test("a new town is told to lay homes, then to feed them", () => {
  assert.equal(guideStep(fresh, none)?.id, "homes")
  assert.equal(guideStep(town({ homes: 6, residents: 12 }), new Set(["homes"]))?.id, "fishery")
  assert.equal(guideStep(town({ homes: 6, residents: 12 }, ["fishery"]), new Set(["homes", "fishery"]))?.id, "planks")
})

test("what the town has done is put away, shown or not", () => {
  const experienced = town({ homes: 20, residents: 60, citizens: 0 }, ["fishery", "lumberjack", "sawmill", "forester", "quarry", "firewatch"])
  const put = guideDone(experienced, none)
  for (const id of ["homes", "fishery", "planks", "forester", "quarry", "firewatch"]) assert.ok(put.includes(id), id)
  const next = guideStep(experienced, new Set(put))
  assert.ok(next && !put.includes(next.id), "the next step is one not yet done")
})

test("steps wait for the town to need them, not for the last one to be done", () => {
  const founded = town({ homes: 4, residents: 8 }, ["fishery", "lumberjack", "sawmill"])
  const put = new Set(guideDone(founded, none))
  // Planks in hand, stone in hand, the woods full, no risk: nothing to say.
  assert.equal(guideStep(founded, put), null)
  assert.equal(guideStep(town({ homes: 4, residents: 8, fewTrees: true }, ["fishery", "lumberjack", "sawmill"]), put)?.id, "forester")
  assert.equal(guideStep(town({ homes: 4, residents: 8, stock: amounts({ planks: 40, stone: 6 }) }, ["fishery", "lumberjack", "sawmill"]), put)?.id, "quarry")
})

test("after a step the guide keeps quiet, but not through a fire or the crown's request", () => {
  const facts = town({ homes: 8, residents: 16, fewTrees: true }, ["fishery", "lumberjack", "sawmill"])
  const put = new Set(guideDone(facts, none))
  assert.equal(guideStep(facts, put, { quiet: true }), null)
  assert.equal(guideStep({ ...facts, burning: 1 }, put, { quiet: true })?.id, "firewatch")
  assert.equal(guideStep({ ...facts, crown: { open: true, met: 0 } }, put, { quiet: true })?.id, "crown")
})

test("a step once shown stays until it is done, even if its sign fades", () => {
  const built: ReadonlyArray<KindId> = ["fishery", "lumberjack", "sawmill"]
  const put = new Set(["homes", "fishery", "planks"])
  const low = town({ homes: 4, residents: 8, stock: amounts({ planks: 40, stone: 6 }) }, built)
  assert.equal(guideStep(low, put)?.id, "quarry")
  const bought = town({ homes: 4, residents: 8, stock: amounts({ planks: 40, stone: 30 }) }, built)
  assert.equal(guideStep(bought, put), null)
  assert.equal(guideStep(bought, put, { shown: "quarry" })?.id, "quarry")
})

test("a step the mayor skipped stays away", () => {
  assert.notEqual(guideStep(fresh, new Set(["homes"]))?.id, "homes")
})

test("the crown's deadline goes ahead of a chain that takes minutes", () => {
  const facts = town({ homes: 20, residents: 40, crown: { open: true, met: 0 } }, ["fishery"])
  assert.equal(guideStep(facts, new Set(guideDone(facts, none)))?.id, "crown")
})

test("winter is foretold before it comes, and not long before", () => {
  const ready = new Set(["homes", "fishery"])
  const built: ReadonlyArray<KindId> = ["fishery", "lumberjack", "sawmill", "forester", "quarry"]
  assert.notEqual(guideStep(town({ homes: 10, residents: 30, winterIn: 400 }, built), ready)?.id, "winter")
  assert.equal(guideStep(town({ homes: 10, residents: 30, winterIn: 90 }, built), ready)?.id, "winter")
  assert.equal(guideStep(town({ homes: 10, residents: 30, winter: true, winterIn: 300 }, built), ready)?.id, "winter")
})

test("a town that runs short of tools before its workshops is told to keep them", () => {
  const facts = town({ homes: 12, residents: 30, stock: amounts({ tools: 2, planks: 30, stone: 10 }) }, ["fishery", "sheep"])
  assert.equal(guideStep(facts, new Set(guideDone(facts, none)))?.id, "tools")
})

test("the guide never asks for a building before the town can build it", () => {
  // Each step that names buildings, and what it asks for.
  const asks: Record<string, ReadonlyArray<KindId>> = {
    fishery: ["fishery"],
    winter: ["granary", "smokehouse"],
    planks: ["lumberjack", "sawmill"],
    forester: ["forester"],
    quarry: ["quarry"],
    firewatch: ["firewatch"],
    builder: ["builder"],
    market: ["market"],
    cloth: ["sheep", "weaver", "chapel"],
    bread: ["farm", "mill", "bakery"],
    healer: ["healer"],
    watchhouse: ["watchhouse"],
    smithy: ["mine", "smithy"]
  }
  // Whatever else is true, a town just short of each unlock.
  const everything = (residents: number, citizens: number) =>
    town({ homes: 30, residents, citizens, winter: true, winterIn: 60, worn: true, sick: 3, burning: 1, risk: { fire: true, health: true, order: true }, fewTrees: true }, ["fishery", "lumberjack", "sawmill"])
  for (const step of guideSteps) {
    for (const kind of asks[step.id] ?? []) {
      const { residents, citizens } = kinds[kind].unlock
      if (residents > 0) assert.equal(step.when(everything(residents - 1, citizens)), false, `${step.id} asks for a ${kind} before ${residents} residents`)
      if (citizens > 0) assert.equal(step.when(everything(residents + 200, citizens - 1)), false, `${step.id} asks for a ${kind} before ${citizens} citizens`)
      assert.ok(kinds[kind].buildable, `${kind} can be built`)
      assert.match(step.text.toLowerCase(), new RegExp(kinds[kind].title.toLowerCase()), `${step.id} names the ${kind}, so it becomes a chip`)
    }
  }
})

test("every step can be done, and a town that has done them all is told nothing", () => {
  const all = guideSteps.flatMap((s) => [s.id])
  assert.equal(new Set(all).size, all.length, "step ids are unique")
  const finished = town(
    {
      homes: 200, residents: 400, citizens: 200, finerHomes: 30, crown: { open: true, met: 3 }, trading: true, taxed: true, sawTown: true,
      winter: true, worn: true, poorStreet: true, approval: 40, net: -5, most: 120, stock: amounts({ tools: 0 })
    },
    ["fishery", "lumberjack", "sawmill", "forester", "quarry", "granary", "firewatch", "builder", "market", "sheep", "weaver", "chapel", "farm", "mill", "bakery", "healer", "watchhouse", "mine", "smithy"]
  )
  assert.deepEqual(guideDone(finished, none).sort(), [...all].sort())
  assert.equal(guideStep(finished, none), null)
})
