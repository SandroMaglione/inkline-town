/**
 * Model-based tests: generate sequences of what a mayor can do (lay roads
 * and homes, build, bulldoze, set taxes and trade, pause, answer the crown,
 * save and load, wait), run them on the real simulation, and after every
 * command check what must always be true of a town. A failure is shrunk to
 * the shortest sequence that still breaks the rule, and printed with its
 * replay so it can be run again.
 *
 *   pnpm test
 *   RUNS=200 node --test test/model.test.ts     more runs
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { Arbitrary, Data, Effect, Schema } from "effect"

import {
  CONDITION_MAX, crown, goodIds, groundIds, home, kindOrder, kinds, landIds, market, propIds, ranks, RESERVE_MAX, RISK_MAX, TAX_STEPS, TRADE_LOAD, type CharterValue
} from "../src/content.ts"
import { canPlace, cellsOf, DIRS, entrances, GridBuilder, isRoad, key, type Use } from "../src/grid.ts"
import { GRID, inside, type Point } from "../src/iso.ts"
import { load, memoryStorage, save, Storage, World } from "../src/save.ts"
import { headless, type Headless, type Snapshot } from "../src/sim/headless.ts"
import type { Edit } from "../src/ui.ts"

const RUNS = Number(process.env.RUNS ?? 25)
/** How large generated scenarios grow: at this size, sequences run to their full length. */
const SIZE = 50

// ── What a mayor can do ───────────────────────────────────────────────────

const between = (minimum: number, maximum: number) => Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum, maximum })))
/** Cells around the town hall (which stands at 30–32), where most of the town goes. */
const Cell = between(18, 44)

/**
 * Which of the places a command could go it picks: the town's own choices
 * (free cells beside a road, spots with a road at a door, what stands) are
 * found when the command runs, so most commands do something.
 */
const Pick = between(0, 999)
const Direction = Schema.Literals(["+x", "+y", "-x", "-y"])

const Command = Schema.Union([
  Schema.TaggedStruct("Wait", { seconds: between(1, 60) }),
  // Long stretches too, so towns live through winters and the crown's requests.
  Schema.TaggedStruct("Season", { minutes: between(1, 6) }),
  // A road out from one of the town's road cells.
  Schema.TaggedStruct("Road", { pick: Pick, toward: Direction, length: between(1, 10) }),
  // Paving a stretch of road (or whatever lies along it).
  Schema.TaggedStruct("Pave", { pick: Pick, toward: Direction, length: between(1, 8) }),
  // A patch of park ground from a free cell, and a furnishing anywhere at all (on park or not).
  Schema.TaggedStruct("Park", { pick: Pick, ground: Schema.Literals(groundIds), width: between(1, 4), depth: between(1, 4) }),
  Schema.TaggedStruct("Furnish", { prop: Schema.Literals(propIds), x: Cell, y: Cell }),
  // A row of homes from a free cell beside a road.
  Schema.TaggedStruct("Homes", { pick: Pick, toward: Direction, length: between(1, 6) }),
  // A building on a spot with room and a road at one of its doors.
  Schema.TaggedStruct("Build", { kind: Schema.Literals(kindOrder), pick: Pick }),
  // Anywhere at all, valid or not.
  Schema.TaggedStruct("BuildAnywhere", { kind: Schema.Literals(kindOrder), x: Cell, y: Cell }),
  // One of the buildings, homes, or roads that stand.
  Schema.TaggedStruct("Remove", { pick: Pick, what: Schema.Literals(["building", "house", "road", "park"]) }),
  Schema.TaggedStruct("Tax", { tier: Schema.Literals(["settlers", "citizens"]), rate: between(TAX_STEPS[0], TAX_STEPS.at(-1)!) }),
  Schema.TaggedStruct("Trade", { good: Schema.Literals(goodIds), mode: Schema.Literals(["sell", "buy", "none"]), amount: between(0, TRADE_LOAD) }),
  Schema.TaggedStruct("Reserve", { amount: between(0, RESERVE_MAX) }),
  Schema.TaggedStruct("Pause", { pick: Pick, on: Schema.Boolean }),
  Schema.TaggedStruct("Deliver", {}),
  // Once a term has run out, another.
  Schema.TaggedStruct("NextTerm", {}),
  // A building upgraded where it stands, ready or not.
  Schema.TaggedStruct("Upgrade", { pick: Pick }),
  Schema.TaggedStruct("SaveAndLoad", {}),
  // Not a lever the page has: fortune, good or bad, so runs reach debt and plenty.
  Schema.TaggedStruct("Windfall", { coins: between(-4000, 6000) }),
  // The rest of the term, at once.
  Schema.TaggedStruct("ToTheEnd", {})
])
type Command = typeof Command.Type

/**
 * How often a mayor does each thing: mostly building, then waiting; the
 * policy levers now and then; running the term out rarely.
 */
const weights: Readonly<Record<Command["_tag"], number>> = {
  Build: 20, Homes: 15, Road: 12, Pave: 3, Park: 4, Furnish: 4, Season: 10, Wait: 8, Trade: 5, Tax: 4, Remove: 4, Pause: 4, Deliver: 4, SaveAndLoad: 3,
  Windfall: 3, Reserve: 2, BuildAnywhere: 2, NextTerm: 2, Upgrade: 2, ToTheEnd: 1
}
const table = Object.entries(weights).flatMap(([tag, n]) => Array.from({ length: n }, () => tag as Command["_tag"]))
const command = Arbitrary.flatMap(Arbitrary.schema(between(0, table.length - 1)), (i) =>
  Arbitrary.schema(Command.members.find((m) => m.fields._tag.schema.literal === table[i])!))

const Charter = Schema.Struct({
  size: Schema.Literals(["small", "medium"]),
  term: Schema.Literals([45, 60]),
  land: Schema.Literals(landIds),
  seed: between(0, 100_000)
})

const Scenario = Schema.Struct({ charter: Charter, commands: Schema.Array(Command) })
const scenarios = Arbitrary.all({
  charter: Arbitrary.schema(Charter),
  commands: Arbitrary.array(command as Arbitrary.Arbitrary<Command>, { maxLength: 60 })
})

const steps = { "+x": { x: 1, y: 0 }, "+y": { x: 0, y: 1 }, "-x": { x: -1, y: 0 }, "-y": { x: 0, y: -1 } } as const
const line = (from: Point, length: number, toward: keyof typeof steps) =>
  Array.from({ length }, (_, i) => ({ x: from.x + steps[toward].x * i, y: from.y + steps[toward].y * i }))

/** The town as the commands see it: what stands where, and the places each could go. */
const look = (s: Snapshot) => {
  const builder = new GridBuilder(s.resources["Town/Land"].mask)
  const standing: Array<{ id: number; what: "building" | "house" | "road" | "park"; tile: Point & { size: number } }> = []
  for (const e of s.entities) {
    const tile = e.components["Town/Tile"]
    if (!tile) continue
    const c = e.components
    const use: Use = c["Town/Road"] ? "road" : c["Town/Park"] ? "park" : c["Town/House"] ? "house" : c["Town/Tree"] ? "tree" : c["Town/Rock"] ? "rock" : c["Town/Water"] ? "water" : c["Town/Field"] ? "field" : c["Town/Ruin"] ? "ruin" : "building"
    builder.claim(tile, e.id, use)
    if (use === "building" || use === "house" || use === "road" || use === "park") standing.push({ id: e.id, what: use, tile })
    // A ruin is cleared like a building.
    if (use === "ruin") standing.push({ id: e.id, what: "building", tile })
  }
  const grid = builder.value()
  const cells = (f: (x: number, y: number) => boolean) => {
    const out: Array<Point> = []
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (f(x, y)) out.push({ x, y })
    return out
  }
  const besideRoad = (x: number, y: number) => DIRS.some((d) => isRoad(grid, x + d.x, y + d.y))
  return {
    standing,
    roads: () => cells((x, y) => isRoad(grid, x, y)),
    free: () => cells((x, y) => canPlace(grid, { x, y, size: 1 }) && besideRoad(x, y)),
    spots: (size: number) => cells((x, y) => canPlace(grid, { x, y, size }) && entrances({ x, y, size }).some((c) => isRoad(grid, c.x, c.y)))
  }
}
const pick = <A>(options: ReadonlyArray<A>, n: number): A | undefined => (options.length === 0 ? undefined : options[n % options.length])

/** A command as the edits the page would push (or, for the rest, what it does to the town). */
const apply = (town: Headless, command: Command): string | null => {
  const edit = (...edits: ReadonlyArray<Edit>) => town.edit(...edits)
  switch (command._tag) {
    case "Wait":
      town.run(command.seconds)
      return null
    case "Season":
      town.run(command.minutes * 60)
      return null
    case "ToTheEnd": {
      const s = town.snapshot()
      const charter = s.resources["Town/Charter"]
      const began = s.resources["Town/Fate"].began
      town.run(Math.max(0, charter.founded + began + charter.term * 3600 - s.resources["Town/Time"].step) / 60 + 2)
      return null
    }
    case "Road": {
      const from = pick(look(town.snapshot()).roads(), command.pick)
      if (from) edit({ type: "roads", cells: line(from, command.length + 1, command.toward).slice(1) })
      break
    }
    case "Pave": {
      const from = pick(look(town.snapshot()).roads(), command.pick)
      if (from) edit({ type: "pave", cells: line(from, command.length, command.toward) })
      break
    }
    case "Park": {
      const from = pick(look(town.snapshot()).free(), command.pick)
      const cells: Array<Point> = []
      if (from) for (let dy = 0; dy < command.depth; dy++) for (let dx = 0; dx < command.width; dx++) if (inside(from.x + dx, from.y + dy)) cells.push({ x: from.x + dx, y: from.y + dy })
      if (from) edit({ type: "ground", ground: command.ground, cells })
      break
    }
    case "Furnish":
      edit({ type: "prop", prop: command.prop, cell: { x: command.x, y: command.y } })
      break
    case "Homes": {
      const from = pick(look(town.snapshot()).free(), command.pick)
      if (from) edit({ type: "homes", cells: line(from, command.length, command.toward) })
      break
    }
    case "Build": {
      const spot = pick(look(town.snapshot()).spots(kinds[command.kind].size), command.pick)
      if (spot) edit({ type: "building", kind: command.kind, cell: spot, open: false })
      break
    }
    case "BuildAnywhere":
      edit({ type: "building", kind: command.kind, cell: { x: command.x, y: command.y }, open: false })
      break
    case "Remove": {
      const target = pick(look(town.snapshot()).standing.filter((t) => t.what === command.what), command.pick)
      if (target) edit({ type: "remove", cell: { x: target.tile.x, y: target.tile.y } })
      break
    }
    case "Tax":
      edit({ type: "tax", tier: command.tier, rate: command.rate })
      break
    case "Trade":
      edit({ type: "trade", good: command.good, mode: command.mode, amount: command.amount })
      break
    case "Reserve":
      edit({ type: "reserve", amount: command.amount })
      break
    case "Pause": {
      const target = pick(look(town.snapshot()).standing.filter((t) => t.what === "building"), command.pick)
      if (target) edit({ type: "pause", cell: { x: target.tile.x, y: target.tile.y }, on: command.on })
      break
    }
    case "Deliver":
      edit({ type: "deliver" })
      break
    case "NextTerm":
      edit({ type: "nextTerm" })
      break
    case "Upgrade": {
      const target = pick(look(town.snapshot()).standing.filter((t) => t.what === "building"), command.pick)
      if (target) edit({ type: "upgrade", cell: { x: target.tile.x, y: target.tile.y } })
      break
    }
    case "SaveAndLoad": {
      // Through the page's own saving and loading: a save loads back to exactly what was saved.
      const world: World["Service"] = {
        snapshot: () => town.snapshot(),
        restore: (data) => {
          town.restore(data as Snapshot)
          return null
        },
        title: () => "a town under test"
      }
      const saved = town.snapshot()
      const result = Effect.runSync(Effect.result(Effect.andThen(save("manual"), load("manual")).pipe(
        Effect.provideService(Storage, memoryStorage()),
        Effect.provideService(World, world)
      )))
      if (result._tag === "Failure") return `saving and loading failed: ${result.failure._tag}`
      return JSON.stringify(saved) === JSON.stringify(town.snapshot()) ? null : "a saved town did not load back the same"
    }
    case "Windfall":
      town.change((s) => {
        s.resources["Town/Treasury"].coins += command.coins
      })
      break
  }
  // Edits apply on the next step; give the town a second.
  town.run(1)
  return null
}

// ── What must always be true ──────────────────────────────────────────────

/** What the checks remember from one command to the next. */
interface Memory {
  readonly tick: number
  readonly state: string
  readonly met: number
  readonly missed: number
  readonly peak: number
  readonly samples: number
  readonly term: number
  readonly rank: number
}

const remember = (s: Snapshot): Memory => ({
  tick: s.resources["Town/Time"].step,
  state: s.resources["Town/Fate"].state,
  met: s.resources["Town/Crown"].met,
  missed: s.resources["Town/Crown"].missed,
  peak: s.resources["Town/Fate"].peak,
  samples: s.resources["Town/History"].samples.length,
  term: s.resources["Town/Fate"].term,
  rank: s.resources["Town/Fate"].rank
})

/** Every rule a town breaks, as a line each. */
const broken = (s: Snapshot, before: Memory | null, last: Command): Array<string> => {
  const out: Array<string> = []
  const fail = (rule: string) => out.push(rule)
  const r = s.resources
  const mask: string = r["Town/Land"].mask
  const ids = new Set(s.entities.map((e) => e.id))

  // The land: every tile on it, none overlapping.
  const taken = new Map<number, number>()
  for (const e of s.entities) {
    const tile = e.components["Town/Tile"]
    if (!tile) continue
    for (const c of cellsOf(tile)) {
      if (!inside(c.x, c.y) || mask[key(c.x, c.y)] !== "1") fail(`entity ${e.id} stands off the land at ${c.x},${c.y}`)
      const k = key(c.x, c.y)
      if (taken.has(k)) fail(`entities ${taken.get(k)} and ${e.id} overlap at ${c.x},${c.y}`)
      taken.set(k, e.id)
    }
  }

  // Goods: never negative, never more than a shelf holds.
  for (const e of s.entities) {
    const inv = e.components["Town/Inventory"]
    if (!inv) continue
    for (const g of goodIds) {
      const n = inv.stock[g]
      if (n < 0) fail(`entity ${e.id} holds ${n} ${g}`)
      if (n > inv.cap) fail(`entity ${e.id} holds ${n} ${g}, more than its ${inv.cap}`)
      if (n > 0 && !inv.accepts.includes(g)) fail(`entity ${e.id} holds ${g}, which it does not take`)
    }
  }

  // Homes and work: residents within what a home holds, workers within who lives here.
  let residents = 0
  let settlers = 0
  let citizens = 0
  for (const e of s.entities) {
    const h = e.components["Town/House"]
    if (!h) continue
    if (![1, 2, 3].includes(h.tier)) fail(`home ${e.id} is of tier ${h.tier}`)
    if (h.residents < 0 || h.residents > home.tiers[h.tier as 1 | 2 | 3].residents) fail(`home ${e.id} has ${h.residents} residents at tier ${h.tier}`)
    residents += h.residents
    if (h.tier === 1) settlers += h.residents
    else citizens += h.residents
  }
  let assigned = 0
  for (const e of s.entities) {
    const staff = e.components["Town/Staff"]
    if (!staff) continue
    if (staff.assigned < 0 || staff.assigned > staff.needed) fail(`building ${e.id} has ${staff.assigned} of ${staff.needed} workers`)
    if (staff.apprentices < 0 || staff.apprentices > staff.assigned) fail(`building ${e.id} has ${staff.apprentices} apprentices of ${staff.assigned} workers`)
    // Citizens never do settlers' work: only a citizens' workplace takes apprentices.
    const kind = e.components["Town/Building"]?.kind as keyof typeof kinds | undefined
    if (kind && kinds[kind].crew === "settlers" && staff.apprentices > 0) fail(`${kind} ${e.id} has apprentices`)
    assigned += staff.assigned
  }
  // Risks and wear stay within their bounds; ruins and parks neither burn nor wear.
  for (const e of s.entities) {
    const r = e.components["Town/Risk"]
    if (r) for (const k of ["fire", "health", "order"] as const) if (r[k] < 0 || r[k] > RISK_MAX) fail(`entity ${e.id} has ${k} risk ${r[k]}`)
    const c = e.components["Town/Condition"]
    if (c && (c.value < 0 || c.value > CONDITION_MAX)) fail(`entity ${e.id} is in condition ${c.value}`)
    if (e.components["Town/Sick"] && !e.components["Town/House"]) fail(`entity ${e.id} is sick but no home`)
    if (e.components["Town/Ruin"] && (e.components["Town/House"] || e.components["Town/Building"])) fail(`ruin ${e.id} still stands`)
    // A cell of park is only park: nothing else stands on it, and nothing burns or wears there.
    if (e.components["Town/Park"] && (e.components["Town/Road"] || e.components["Town/House"] || e.components["Town/Building"] || e.components["Town/Risk"])) fail(`park ${e.id} is something else too`)
  }
  // Rocks are quarried down to a worked face, never below; only a building with an upgrade has one.
  for (const e of s.entities) {
    const rock = e.components["Town/Rock"]
    if (rock && rock.amount < 0) fail(`rock ${e.id} holds ${rock.amount}`)
    const kind = e.components["Town/Building"]?.kind as keyof typeof kinds | undefined
    if ("Town/Upgraded" in e.components && (!kind || !kinds[kind].upgrade)) fail(`entity ${e.id} is upgraded but has no upgrade`)
  }
  if (r["Town/Fate"].rank < 0 || r["Town/Fate"].rank >= ranks.length) fail(`the town is of rank ${r["Town/Fate"].rank}`)
  const cells = r["Town/Appeal"].cells as Array<number>
  if (cells.length !== 0 && cells.length !== GRID * GRID) fail(`desirability for ${cells.length} cells`)
  if (assigned > residents) fail(`${assigned} at work but only ${residents} residents`)
  const census = r["Town/Census"]
  if (census.settlers !== settlers || census.citizens !== citizens) fail(`census says ${census.settlers}/${census.citizens}, homes ${settlers}/${citizens}`)
  const burning = s.entities.filter((e) => e.components["Town/Burning"]).length
  if (census.burning !== burning) fail(`census says ${census.burning} on fire, ${burning} are`)

  // Walkers belong to a building that still stands.
  for (const [target, sources] of s.relations["Town/WalkerOf"] ?? []) {
    if (!ids.has(target)) fail(`walkers ${sources.join(", ")} belong to a building that is gone`)
  }
  for (const e of s.entities) {
    const tile = s.entities.find((b) => b.id === e.components["Town/Errand"]?.target)
    if (e.components["Town/Errand"] && !e.components["Town/Errand"].back && !tile) fail(`carrier ${e.id} is carrying to a building that is gone`)
  }

  // The town's figures stay within their bounds.
  const mood = r["Town/Mood"]
  if (mood.approval < -100 || mood.approval > 100) fail(`approval ${mood.approval}`)
  for (const g of goodIds) {
    const p = r["Town/Market"].prices[g]
    if (p < market.floor || p > market.ceiling) fail(`${g} at ${p}%`)
  }
  if (!Number.isInteger(r["Town/Treasury"].coins)) fail(`coins ${r["Town/Treasury"].coins}`)
  const c = r["Town/Crown"]
  if (c.streak > crown.patience) fail(`the crown has been snubbed ${c.streak} times in a row`)
  if (c.open && c.amount <= 0) fail(`the crown asks for ${c.amount}`)

  // Over time: the clock, the record, and the crown's tally only go forward.
  const now = remember(s)
  if (before) {
    if (now.tick < before.tick) fail(`time went back from ${before.tick} to ${now.tick}`)
    if (now.met < before.met || now.missed < before.missed) fail("the crown's tally went down")
    if (now.peak < before.peak) fail("the peak went down")
    // A long reign thins its older history only as a new term begins.
    if (now.samples < before.samples && last._tag !== "NextTerm") fail("the history lost samples")
    if (now.rank < before.rank) fail(`the town fell from rank ${before.rank} to ${now.rank}`)
    // A term ends once: a lost one stays lost; an over one goes on only as the next term, by choosing it.
    const moved = `${before.state}→${now.state}`
    const allowed = ["playing→playing", "playing→lost", "playing→over", "lost→lost", "over→over"]
    const next = moved === "over→playing" && last._tag === "NextTerm" && now.term === before.term + 1
    if (!allowed.includes(moved) && !next) fail(`the term went ${moved}`)
    if (now.term !== before.term && !next) fail(`the term went from ${before.term} to ${now.term}`)
  }
  const samples = r["Town/History"].samples as Array<{ tick: number }>
  if (samples.some((p, i) => i > 0 && p.tick <= samples[i - 1]!.tick)) fail("history out of order")
  return out
}

class Broken extends Data.TaggedError("Broken")<{ readonly step: number; readonly command: Command; readonly rules: ReadonlyArray<string> }> {}

/** Plays a scenario, failing at the first command after which the town breaks a rule. */
const play = (scenario: typeof Scenario.Type) =>
  Effect.gen(function* () {
    const town = headless(scenario.charter as CharterValue)
    let memory: Memory | null = null
    let index = 0
    if (process.env.VERBOSE) console.log(`${scenario.charter.size} ${scenario.charter.land} ${scenario.commands.length} commands, ${scenario.commands.reduce((t, c) => t + (c._tag === "Wait" ? c.seconds : c._tag === "Season" ? c.minutes * 60 : 1), 0)} s${scenario.commands.some((c) => c._tag === "ToTheEnd") ? " and to the end" : ""}`)
    for (const command of scenario.commands) {
      const problem = apply(town, command)
      const s = town.snapshot()
      const rules = [...(problem ? [problem] : []), ...broken(s, memory, command)]
      if (rules.length > 0) return yield* Effect.fail(new Broken({ step: index, command, rules }))
      memory = remember(s)
      index += 1
    }
    if (process.env.VERBOSE) {
      const s = town.snapshot()
      const count = (c: string) => s.entities.filter((e) => e.components[c]).length
      console.log(`  → ${count("Town/Building")} buildings, ${count("Town/House")} homes, ${s.resources["Town/Census"].settlers + s.resources["Town/Census"].citizens} residents, ${s.resources["Town/Treasury"].coins} coins, ${s.resources["Town/Fate"].state}`)
    }
    return true
  })

const report = <A, E>(result: Arbitrary.CheckResult<A, E>) => Arbitrary.formatCheckFailure(result) ?? ""

test("a town keeps its rules whatever its mayor does", { timeout: 30 * 60_000 }, async () => {
  const result = await Effect.runPromise(Arbitrary.checkEffect(scenarios, play, { runs: RUNS, size: SIZE, seed: process.env.SEED ?? 1 }))
  const rules = result._tag === "Falsified" && result.failure._tag === "PropertyError"
    ? `\nAfter command ${result.failure.error.step} (${JSON.stringify(result.failure.error.command)}):\n  ${result.failure.error.rules.join("\n  ")}`
    : ""
  assert.equal(result._tag, "Passed", report(result) + rules)
})

test("the same charter and the same commands make the same town", { timeout: 30 * 60_000 }, async () => {
  const result = await Effect.runPromise(
    Arbitrary.checkEffect(
      scenarios,
      (scenario) => {
        const once = headless(scenario.charter as CharterValue)
        const twice = headless(scenario.charter as CharterValue)
        for (const command of scenario.commands) {
          apply(once, command)
          apply(twice, command)
        }
        return JSON.stringify(once.snapshot()) === JSON.stringify(twice.snapshot())
      },
      { runs: Math.max(3, Math.round(RUNS / 5)), size: SIZE, seed: process.env.SEED ?? 2 }
    )
  )
  assert.equal(result._tag, "Passed", report(result))
})

