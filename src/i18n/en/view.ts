/**
 * English for what the view reads off the town (`src/view`): the panels of
 * a building, a home, a park, and a ruin; why something is not working and
 * what to do about it; the alerts; the tooltip under the pointer; the map
 * views' legends; and what an upgrade changes.
 *
 * Two kinds of entry. Where the game's rules name a cause as data (a home's
 * unmet need, a building's problem, what an upgrade changes, what a street
 * is made of), there is a table with one function for each tag (`satisfies
 * Wording<…>`), so a new cause does not compile until it is worded. Where
 * the view only has numbers to say, it calls a function here with them.
 *
 * What a line names beyond words is a token (`../token.ts`), by where the
 * page shows it: a row's value and note, the tooltip, and a stroke show
 * amounts as icons; what to do about something (`fix`) and the alerts show
 * buildings, goods, and tools as chips besides; everything else (labels,
 * headings, a problem in a line) is plain words.
 */
import { COMMUTE, home, type Crew, type GoodId, type GroundId, type Kind, type KindId, type Need, type PropId, type Tier } from "../../game/content/index.ts"
import type { Cause, RiskId, Street } from "../../game/rules/explain.ts"
import type { GoalId } from "../../game/rules/goals.ts"
import type { Salvage } from "../../game/rules/salvage.ts"
import type { Change } from "../../game/rules/upgrades.ts"
import type { Lock } from "../../game/said.ts"
import type { Status } from "../../game/schema.ts"
import type { AppealLabel, AppealPart, ParkLabel } from "../../game/world/appeal.ts"
import type { Problem } from "../../view/facts.ts"
import type { PlaceProblem } from "../../view/interaction/placing.ts"
import type { LegendKeys } from "../../view/overlay.ts"
import type { WantedReason } from "../../view/upgrades.ts"
import * as token from "../token.ts"
import { say, type Wording } from "../wording.ts"
import { a, capital, count, noun, signed } from "./grammar.ts"
import { built, goods, grounds, needs, props, tiers } from "./nouns.ts"
import { cost, lock, needsRank, salvage } from "./said.ts"

const homes = noun("home"), cells = noun("cell"), roadCells = noun("road cell"), residents = noun("resident")
const kindName = (id: KindId, level = 0) => built(id, level).noun.one
/** A building as a chip, by the word given (a plural, an upgrade's name) or its plain name. */
const chip = (id: KindId, shown?: string) => token.kind(id, shown)
const town = token.command("town")
/** Who works a building, as its homes are called. */
const crewPeople = (crew: Crew) => tiers[crew === "citizens" ? 2 : 1].people
/** A span of seconds, to a tenth: "4.5 s". */
const seconds = (s: number) => `${Math.round(s * 10) / 10} s`

/** What a cause or a problem says: why, and (when there is something to do) what. */
interface Told {
  readonly why: string
  readonly fix?: string
}
/** A building's problem: in a word or two, why in a line, and what to do. */
interface ToldProblem extends Told {
  readonly label: string
}
/** One thing an upgrade changes, as a row: what, from what to what, and what qualifies it. */
interface Gain {
  readonly label: string
  readonly value?: string
  readonly note?: string
}

// ── Streets: what makes one, and what would lift it ───────────────────────

/** What a source of desirability is called in a street's readout. */
const source = {
  kind: (l) => kindName(l.kind, l.level),
  homes: () => "fine homes beside it",
  water: () => "water",
  woods: () => "woods",
  paved: () => "paved street",
  ruin: () => "ruin",
  worn: () => "a run-down home",
  park: () => "park"
} satisfies Wording<AppealLabel>

/** What counts most against a street, in a line: "quarry −6, warehouse −2". */
const against = (parts: ReadonlyArray<AppealPart>, most = 2): string =>
  parts.filter((p) => p.value < 0).slice(0, most).map((p) => `${say(source, p.label)} ${signed(p.value)}`).join(", ")

const street = {
  source,
  against,
  /** A street against what the next tier needs: "−4 here, 5 needed: quarry −6". */
  short: (s: Street, needed: number): string => {
    const why = against(s.parts)
    return `${signed(s.desirability)} here, ${needed} needed${why ? `: ${why}` : ""}`
  },
  /** What would lift a street: the things a mayor can do (`dragged`: something drags it down). Buildings as chips. */
  advice: (dragged: boolean): string =>
    dragged ? `move industry away, or add a park, a ${chip("chapel")}, or paving` : `a park, a ${chip("chapel")}, or a paved street beside it`
}

// ── Why a home lacks something ────────────────────────────────────────────

const notLately = {
  food: "the market's walker has not passed lately",
  bread: "the market's walker has not passed with bread lately",
  cloth: "the market's walker has not passed with cloth lately",
  faith: "the chapel's walker has not passed lately",
  furniture: "the market's walker has not passed with furniture lately"
} satisfies Record<Need, string>

const noneInTown = {
  food: { why: "the town has no food in store", fix: `build a ${chip("fishery")} by the water: it is the quickest` },
  bread: { why: "the town has no bread", fix: `build a ${chip("bakery")}: a ${chip("farm")}'s ${token.good("wheat")} goes to a ${chip("mill")}, and its ${token.good("flour")} to a ${chip("bakery")}` },
  cloth: { why: "the town has no cloth", fix: `build a ${chip("weaver")}: it weaves a ${chip("sheep")}'s ${token.good("wool")}` },
  furniture: { why: "the town has no furniture", fix: `build a ${chip("carpenter")}: it makes ${token.good("furniture")} from ${token.good("planks")}` }
} satisfies Record<Exclude<Need, "faith">, Told>

const risks = { fire: "fire", health: "health", order: "order" } satisfies Record<RiskId, string>

/** Why a need is unmet, and what to do about it: the cause in a line, the cure with its buildings as chips. */
const cause: Wording<Cause, Told> = {
  noWalker: (c) =>
    c.service === "market"
      ? { why: "no market walker reaches this street", fix: `build a ${chip("market")}: its walker walks ${c.range} road cells, the ${chip("townhall")}'s ${c.hallRange}` }
      : { why: "no chapel walker reaches this street", fix: `build a ${chip("chapel")}: its walker walks ${c.range} road cells` },
  tooPoor: (c) => ({
    why: `${needs[c.need]} is not brought here: only to a street of ${c.needed} or more, and this one is ${signed(c.desirability)}`,
    fix: "raise the street (see street)"
  }),
  noneInTown: (c) => noneInTown[c.need],
  notLately: (c) => ({ why: notLately[c.need] }),
  unkept: (c) => ({
    why: `${c.high.map((r) => risks[r]).join(", ")} not kept down`,
    fix: `a ${chip("firewatch")}, a ${chip("healer")}, and a ${chip("watchhouse")} must all call here`
  })
}

// ── Why a building is not working ─────────────────────────────────────────

const sources = { stone: "stone", ore: "ore", field: "ripe fields" } as const

/** Why a building is not working: in a word or two, why in a line, and what to do (its buildings and goods as chips). */
const problem: Wording<Problem, ToldProblem> = {
  unconnected: () => ({ label: "no road", why: "it needs a road at the middle of one of its sides", fix: "lay a road along one of its sides" }),
  noWorkersNear: (p) => ({
    label: "no workers",
    why: `no ${p.crew === "citizens" ? "citizens' (or settlers') homes" : "settlers' cottages"} within ${COMMUTE} road cells`,
    fix: "lay homes nearer, or a road to homes nearby"
  }),
  workersTaken: () => ({ label: "no workers", why: "every one nearby already has a job", fix: `lay more homes within ${COMMUTE} road cells` }),
  full: () => ({ label: "full", why: "nowhere to take what it makes", fix: `build a ${chip("warehouse")} nearby, or sell the surplus in the ${town} panel` }),
  paused: () => ({ label: "paused", why: "no workers, a quarter of its upkeep", fix: "resume work below" }),
  fishedOut: (p) => ({
    label: "no fish",
    why: `the water in reach is fished out: each stretch rests ${p.seconds} s after a catch`,
    fix: `give it a longer shore of its own, or fewer ${chip("fishery", built("fishery").noun.other)} on this water`
  }),
  noWater: (p) => ({ label: "no water", why: `no water within ${p.radius} cells`, fix: "rebuild it by the shore" }),
  workedOut: (p) => ({
    label: "worked out",
    why: `the worked faces in reach give a little ${goods[p.source].other} now and then`,
    fix: `build it by fresh rock, or buy ${token.good(p.source)} in the ${town} panel`
  }),
  growing: (p) => ({ label: "waiting", why: `the ${p.source === "tree" ? "trees" : "fields"} in reach are still growing` }),
  noTrees: (p) => ({ label: "no trees", why: `no grown trees within ${p.radius} cells`, fix: `build a ${chip("forester")} nearby: it replants` }),
  noSource: (p) => ({ label: `no ${sources[p.source]}`, why: `no ${sources[p.source]} within ${p.radius} cells`, fix: "rebuild it nearer" }),
  noInput: (p) => ({
    label: `no ${goods[p.good].other}`,
    why: `waiting for ${goods[p.good].other}`,
    fix: p.maker ? `build a ${chip(p.maker)}, or buy ${token.good(p.good)} in the ${town} panel` : `buy ${token.good(p.good)} in the ${town} panel`
  }),
  nothingToHandOut: () => ({ label: "nothing to hand out", why: "no fish, bread, or cloth here", fix: "fill the store: it takes from storage" }),
  noPlanks: () => ({ label: "no planks", why: "nothing to mend with", fix: `build a ${chip("sawmill")}` }),
  waiting: () => ({ label: "waiting", why: "waiting" }),
  onFire: () => ({ label: "on fire!", why: "its crew has fled", fix: `a ${chip("firewatch")}'s watchmen put fires out` })
}

// ── Upgrades ──────────────────────────────────────────────────────────────

/** What an upgrade changes, a row each: what, from what to what, and (after a comma, in a line) what qualifies it. */
const change: Wording<Change, Gain> = {
  output: (c) => ({ label: goods[c.good].other, value: `${c.from} → ${c.to} a minute (a job every ${seconds(c.secondsFrom)} → ${seconds(c.secondsTo)})` }),
  workers: (c) => ({ label: "workers", value: `${c.from} → ${c.to}` }),
  holds: (c) => ({ label: "holds", value: `${c.from} → ${c.to} of each good` }),
  carriers: (c) => ({ label: "carriers", value: `${c.from} → ${c.to}` }),
  firefighters: (c) => ({ label: "firefighters", value: `${c.from} → ${c.to}` }),
  reach: (c) => ({ label: "walker reaches", value: `${c.from} → ${c.to} road cells` }),
  calls: (c) => ({ label: "a walker every", value: `${seconds(c.from)} → ${seconds(c.to)}` }),
  deep: () => ({ label: "cuts worked-out rock at full pace, not a third" }),
  admin: (c) => ({ label: "administration", value: `${c.from}% → ${c.to}% less` }),
  appeal: (c) => ({
    label: "desirability nearby",
    value: `${c.from === null ? "0" : signed(c.from)} → ${signed(c.to)}`,
    ...(c.reach === null ? {} : { note: `out to ${c.reach} cells` })
  }),
  upkeep: (c) => ({ label: "upkeep", value: `${c.from} → ${token.rate(c.to)}` })
}

/** Why the town needs an upgrade now. In an alert its buildings and goods are chips; in a panel it is said in words. */
const wanted = {
  nextRank: "the next rank asks for it",
  shelvesFull: "its shelves are full",
  rockWorked: "it has worked its rock down",
  millsWait: `the ${chip("mill", built("mill").noun.other)} wait on ${token.good("wheat")}`,
  breadShort: `homes go without ${token.good("bread")} while it works flat out`,
  unreached: "homes lie beyond every food walker",
  beyondPriest: "homes lie beyond its priest",
  fireRisk: "homes on its streets are at high fire risk"
} satisfies Record<WantedReason, string>

const upgrade = {
  change,
  /** A change in one line: "desirability nearby +4 → +6, out to 6 cells". */
  line: (g: Gain): string => `${[g.label, ...(g.value === undefined ? [] : [g.value])].join(" ")}${g.note === undefined ? "" : `, ${g.note}`}`,
  /** What starting an upgrade costs: coins now, and the materials carriers then bring. */
  price: (c: Kind["cost"]): string => {
    const carried = cost({ coins: 0, materials: c.materials })
    return `${token.coins(c.coins)} now${carried ? ` · carriers bring ${carried}` : ""}`
  },
  /** The treasury lacks this much of what it costs to begin. */
  short: (n: number): string => `${token.coins(n)} short`,
  wanted,
  /** The first upgrade the town needs, in the ticker: why, what becomes what, and how to begin. */
  hint: (h: { readonly reason: WantedReason; readonly kind: KindId; readonly level: number }): string =>
    `${wanted[h.reason]}: the ${chip(h.kind, kindName(h.kind, h.level))} can become ${a(kindName(h.kind, h.level + 1))}. ${token.device("Tap", "Click")} it, under its gold arrow, to begin`,
  /** The upgrade tool's tooltip. */
  path: (kind: KindId, level: number): string => `${kindName(kind, level)} → ${kindName(kind, level + 1)}`,
  underWay: "under way: carriers are bringing its materials",
  begin: "click to begin: it goes on working meanwhile",
  pick: (kind: KindId): string => `upgrade: pick ${a(kindName(kind))} · Esc to stop`,
  /** The gestures' answers. */
  pickOne: "Pick a building to upgrade",
  already: (kind: KindId): string => `The ${kindName(kind)} is already being upgraded`,
  /** An upgrade under way, in the building's panel. */
  becoming: (kind: KindId, level: number): string => `becoming ${a(kindName(kind, level))}`,
  built: "built",
  stillBring: (left: string): string => `carriers still bring ${left}; it works on meanwhile`,
  allIn: "every material is in; the builders are working it in, and it works on meanwhile"
}

// ── Placing ───────────────────────────────────────────────────────────────

const gathered = { tree: "trees", stone: "pale stone rocks", ore: "dark ore rocks", water: "water" } as const

const place = {
  /** What is wrong with a building where it would stand. */
  problem: {
    noRoad: () => "needs a road at the middle of one side",
    nothingNear: (p) => `no ${gathered[p.source]} within ${p.radius} cells`
  } satisfies Wording<PlaceProblem>,
  /** A building refused where it was put down: "A fishery needs a road at the middle of one side". */
  refused: (kind: KindId, why: string): string => `${capital(a(kindName(kind)))} ${why}`
}

// ── Map views ─────────────────────────────────────────────────────────────

/** Each map view's legend: its heading, what each colour means, and how the reading works. */
const legend = {
  appeal: {
    title: "desirability",
    keys: {
      townhouses: `${home.tiers[3].appeal}+: townhouses`,
      citizens: `${home.tiers[2].appeal}+: citizens`,
      settlers: "0 to 4: settlers only",
      fewer: "below 0: fewer people, less tax",
      squalid: `${home.squalid} or less: squalid`
    },
    note: "Every point counts: a cottage holds fewer and pays less for each point below 0, and pays more above it. Industry pushes homes away; parks (the more they hold, the further they reach), a chapel, a market, and paved streets draw them in."
  },
  workers: {
    title: "workers",
    keys: { staffed: "fully staffed", short: "short of workers", none: "no workers", settlers: "settlers' homes", citizens: "citizens' homes" },
    note: `Residents walk at most ${COMMUTE} road cells to work. Select a workplace to see its reach and the homes inside it.`
  },
  fire: {
    title: "fire",
    keys: { good: "watched", fair: "rising", bad: "at risk, or burning" },
    note: "Buildings take the colour too. A fire watch's watchman resets the risk of every home and workshop along the way; vermilion means past half way, so there is still time. Wooden cottages, ovens, forges, and crowding raise it."
  },
  health: {
    title: "health",
    keys: { good: "visited", fair: "rising", bad: "at risk, or sick" },
    note: "A healer's physician resets the risk and cures the sick. Hunger, crowding, squalor, quarry dust, and still water raise it."
  },
  order: {
    title: "order",
    keys: { good: "kept", fair: "rising", bad: "thieves about" },
    note: "A watch house's constable keeps order. Low approval, squalor, and homes not full raise it; theft first, then the home is left derelict."
  },
  condition: {
    title: "condition",
    keys: { good: "well kept", fair: "needs mending", bad: "run down: half pace" },
    note: "A builder's yard mends what its builder passes with planks and stone. At nothing it falls down."
  }
} satisfies { readonly [V in keyof LegendKeys]: { readonly title: string; readonly keys: Readonly<Record<LegendKeys[V], string>>; readonly note: string } }

// ── Parks and ruins ───────────────────────────────────────────────────────

/** What a park does for the streets around it. */
const parkWorth = (value: number, reach: number): string => `desirability ${signed(value)} out to ${reach} cells`
/** What became of a ruin, in a word. */
const ruinCause = { burnt: "burnt", collapsed: "collapsed", derelict: "derelict" }

// ── The catalog's part ────────────────────────────────────────────────────

export const view = {
  /** What a building is doing, in a word. */
  status: {
    building: "building", idle: "idle", working: "working", starved: "starved", blocked: "blocked", unstaffed: "unstaffed", unconnected: "unconnected", paused: "paused"
  } satisfies Record<Status, string>,
  street,
  cause,
  /** A cause in one line: "why: what to do". */
  causeLine: (told: Told): string => (told.fix === undefined ? told.why : `${told.why}: ${told.fix}`),
  problem,
  /** A problem in one line, for the panel's header and the tooltip: "no road: it needs a road at the middle of one of its sides". */
  problemLine: (told: ToldProblem): string => `${told.label}: ${told.why}`,
  upgrade,
  place,
  legend,
  /** How a risk reads: "ok", "40%", or "high, 85%". */
  risk: { ok: "ok", some: (percent: number): string => `${percent}%`, high: (percent: number): string => `high, ${percent}%` },
  /** What pulling something down (or cancelling a site) costs and gives back: "pull down: −25 coins · 2 planks, 3 stone back". */
  salvage: (s: { readonly cancelled: boolean; readonly salvage: Salvage }): string => {
    const said = salvage(s.salvage)
    return `${s.cancelled ? "cancel" : "pull down"}${said ? `: ${said}` : ""}`
  },

  /** What moves the town's approval, a row each. */
  mood: {
    base: "mood of the town",
    needs: "needs met",
    taxes: "taxes now",
    grudge: "a grudge over taxes past",
    debt: "unpaid wages",
    crown: "the crown's displeasure",
    winter: "a hungry winter"
  },

  /** What the next rank asks: each goal, and how the town stands against it. */
  goal: {
    text: {
      residents: (target) => `${target} residents`,
      citizens: (target) => `${target}% of them citizens`,
      burghers: (target) => `${target}% of them burghers`,
      approval: (target) => `approval ${target} or more`,
      income: (target) => `${target} coins a minute, out of debt`,
      hall: (target) => a(kindName("townhall", target))
    } satisfies Record<GoalId, (target: number) => string>,
    value: {
      residents: (value) => `${value}`,
      citizens: (value) => `${value}%`,
      burghers: (value) => `${value}%`,
      approval: (value) => `${value}`,
      income: (value) => `${value}`,
      hall: (value, target) => (value >= target ? "built" : "not yet")
    } satisfies Record<GoalId, (value: number, target: number) => string>
  },

  /** What needs looking at now, in the ticker: buildings, goods, and tools as chips; amounts in words. */
  alerts: {
    fire: (burning: number, watched: boolean): string =>
      `${burning} on fire: ${watched ? `the ${chip("firewatch")}'s firefighters are on their way` : `build a ${chip("firewatch")} nearby, whose firefighters put fires out`}`,
    sick: (sick: number, healed: boolean): string =>
      `${count(sick, homes)} sick, holding half as many people: ${healed ? `a ${chip("healer")} within reach of its road cures it` : `build a ${chip("healer")} among the homes`}`,
    /** Workshops idle for want of their input, by kind: "idle: the mill needs wheat ×2. …". */
    idle: (waiting: ReadonlyArray<{ readonly kind: KindId; readonly good: GoodId; readonly n: number }>): string =>
      `idle: the ${waiting.map((w) => `${chip(w.kind)} needs ${token.good(w.good)}${w.n > 1 ? ` ×${w.n}` : ""}`).join(", ")}. Build more of what makes it, or buy it in the ${town} panel`,
    /** Workplaces no home can reach, by kind. */
    remote: (remote: ReadonlyArray<{ readonly kind: KindId; readonly n: number }>): string =>
      `no workers for the ${remote.map((w) => `${chip(w.kind)}${w.n > 1 ? ` ×${w.n}` : ""}`).join(", ")}: lay ${token.command("homes")} within ${COMMUTE} road cells of it, or a road to homes nearby`,
    hungry: `no food in store, so homes go hungry and pay no taxes: build another ${chip("fishery")}, or buy ${token.good("fish")} in the ${town} panel`
  },

  /** A building's panel. */
  building: {
    beingBuilt: "being built",
    waitingFor: "waiting for",
    carriersBring: "carriers bring them from storage: buy what the town lacks in the town panel",
    builders: "builders",
    atWork: "at work",
    workers: "workers",
    staffed: (assigned: number, needed: number): string => `${assigned} of ${needed}`,
    nobodyNear: (crew: Crew): string => `no ${crewPeople(crew)} live within ${COMMUTE} road cells: lay homes nearer`,
    allTaken: `everyone nearby has a job: lay more homes within ${COMMUTE} road cells`,
    apprentices: "settlers stand in for citizens, at three-quarters pace",
    makes: "makes",
    /** What it makes: from what, into what (each with its icon), or what alone. */
    recipe: (input: GoodId | null, output: GoodId): string => (input ? `${token.good(input)} → ${token.good(output)}` : goods[output].other),
    walkersOut: "walkers out",
    handedOut: "handed out, last minute",
    handedTo: (n: number): string => `to ${count(n, homes)} on its walks`,
    nothing: "nothing",
    nobodyNeeded: "no home on its walks needed what it had",
    shelf: "on the shelf now",
    holds: "holds",
    tools: "tools",
    none: "none",
    noTools: "half pace until one comes: a smithy makes them, or buy them in the town panel",
    upkeep: "upkeep",
    upkeepValue: (coins: number): string => token.rate(coins),
    condition: "condition",
    runDown: "half pace, and it may fall: a builder's yard mends it",
    wearing: "a builder's yard mends it as its builder passes",
    fireRisk: "fire risk",
    fireCure: "a fire watch's watchman lowers it as he passes",
    appeal: "desirability nearby",
    work: "at work",
    running: "running it",
    /** Behind the ⓘ of "running it": a sentence for each thing that costs or risks something. */
    help: {
      upkeep: "Upkeep is paid every minute it stands, a quarter of it while paused.",
      condition: "Everything wears down; a builder's yard mends it.",
      hot: "An oven or a forge: a fire risk to itself and to homes within 2 cells.",
      appeal: (reach: number, worse: boolean): string =>
        `It changes how nice the streets are out to ${reach} cells${worse ? ": homes close by hold fewer people and pay less" : ""}.`
    }
  },

  /** A home's panel. */
  house: {
    household: "household",
    beingBuilt: "being built",
    builders: "builders",
    waitingPlank: "waiting for its plank",
    closed: "closed",
    empty: "empty",
    closedNote: "it pays no taxes and costs the town hall nothing: reopen it and settlers move back in",
    /** Why it holds fewer than it could. */
    fewer: {
      sick: "half as many while it is sick",
      disapproval: "fewer while the town disapproves of its mayor",
      street: (advice: string): string => `fewer on a poor street: ${advice}`,
      taxed: (rate: number): string => `fewer while taxed at ${rate}%: some move away`,
      needs: "fewer until every need is met"
    },
    onFire: "on fire",
    fled: "everyone fled",
    sick: "sick",
    halved: "half as many",
    sickNote: "it passes in a minute, or when a healer's physician calls",
    residents: "residents",
    living: (n: number, room: number): string => `${n} of ${room}`,
    pays: "pays",
    paying: (coins: number): string => token.rate(coins),
    hungry: "hungry",
    hungryNote: "hungry: no food, no taxes",
    could: (coins: number): string => `${token.rate(coins)} with every need met`,
    worksAt: "works at",
    workplace: (kind: KindId): string => kindName(kind),
    nothingNearby: "nothing nearby",
    needs: "needs",
    met: "✓",
    missing: "missing",
    /** What a need is wanted for: the tier it would raise the home to. */
    forTier: (tier: Tier): string => `for ${tiers[tier].people}`,
    street: "street",
    streetOf: (desirability: number, needed: number): string => `${signed(desirability)} of ${needed}`,
    desirability: (d: number): string => signed(d),
    services: "services",
    rebuilding: "rebuilding",
    rebuilt: "done ✓",
    shortOf: (short: Kind["cost"]): string =>
      `the town is short of ${[...(short.coins > 0 ? [token.coins(short.coins)] : []), ...(Object.entries(short.materials) as Array<[GoodId, number]>).map(([g, n]) => token.amount(g, n))].join(", ")}`,
    waitsForStore: `it waits at its tier until the store holds it: make it, or buy it in the ${town} panel`,
    rebuiltAlready: "rebuilt already: it rises back for nothing",
    readyFor: (tier: Tier): string => `ready for ${tiers[tier].people}`,
    readyNote: "it grows as the next resident moves in, and pays for its rebuilding then",
    safety: "risks and wear",
    risks: "risks",
    allLow: "all low",
    riskOf: { fire: "fire risk", health: "health risk", order: "theft risk" } satisfies Record<RiskId, string>,
    cure: { fire: "a fire watch's watchman lowers it", health: "a healer's physician lowers it", order: "a watch house's constable lowers it" } satisfies Record<RiskId, string>,
    robbed: "robbed",
    times: (n: number): string => `${n}×`,
    condition: "condition",
    runDown: "it drags the street down and may fall: a builder's yard mends it",
    wearing: "a builder's yard mends it as its builder passes",
    /** Behind the ⓘ of "needs", by the home's tier: what red and amber mean, and what the next tier asks. */
    needsHelp: {
      1: `Red: it needs this now. Amber: it needs this to become a citizens' home, which holds and pays twice as much. Bread alone already makes a cottage pay half again. Walkers bring needs along the road; the street is how nice the place is (desirability ${home.tiers[2].appeal} for citizens).`,
      2: `Red: it needs this now, or goes back to settlers. Amber: it needs this to become a townhouse of burghers, on a street of ${home.tiers[3].appeal} with a fire watch, a healer, and a watch house all calling.`,
      3: "Red: it needs this now, or goes back to citizens."
    } satisfies Record<Tier, string>,
    safetyHelp: "Every home's risk of fire, sickness, and theft rises slowly; a walker from the matching service lowers it as it passes.",
    /** How it is, in a word or two for the header. */
    summary: (n: number): string => count(n, residents)
  },

  /** A park's panel. */
  park: {
    worth: parkWorth,
    /** What a park's beauty is made of. */
    part: {
      ground: (l) => (l.capped ? "ground (all it counts for)" : "ground"),
      ways: (l) => `way${l.count === 1 ? "" : "s"} in from the street`,
      prop: (l) => props[l.prop].noun.one
    } satisfies Wording<ParkLabel>,
    size: "size",
    sizeOf: (n: number, beauty: number): string => `${count(n, cells)} · beauty ${beauty}`,
    madeOf: "made of",
    /** Its parts with what each is worth, already worded: "ground 2, lamp 1.5". */
    parts: (parts: ReadonlyArray<{ readonly label: string; readonly value: number }>): string => parts.map((p) => `${p.label} ${p.value}`).join(", ") || "nothing yet",
    streets: "the streets around",
    ways: "ways in from the street",
    waysIn: (n: number): string => `${n}${n > 2 ? " (2 count)" : ""}`,
    none: "none",
    noWays: "lay a gravel walk or a paved square out to a road: +1.5 each, two count",
    furnishings: "furnishings that count",
    furnished: (placed: number, room: number): string => `${placed} of ${room}`,
    crowded: (n: number): string => `${n} too many: one counts for every 2 cells of park, so lay more ground`,
    nicerWith: "nicer with",
    missing: (ids: ReadonlyArray<PropId>): string => ids.map((id) => props[id].noun.one).join(", "),
    upkeep: "upkeep",
    upkeepValue: (coins: number): string => token.rate(coins)
  },

  /** A ruin's panel. */
  ruin: {
    cause: ruinCause,
    happened: "what happened",
    what: { burnt: "it burned down", collapsed: "it fell down for want of mending", derelict: "it was left derelict after its thefts" },
    appeal: "desirability nearby",
    untilCleared: "until it is cleared: bulldoze it"
  },

  /** What the pointer is over, in a line; and what a tool would lay there, and for how much. Amounts as icons. */
  tooltip: {
    /** A building: what it is doing, or what keeps it from it; and what it is becoming, when works are under way. */
    building: (b: { readonly kind: KindId; readonly level: number; readonly state: string; readonly works: { readonly level: number; readonly percent: number } | null }): string =>
      `${kindName(b.kind, b.level)} · ${b.state}${b.works ? ` · becoming ${a(kindName(b.kind, b.works.level))}, ${b.works.percent}% built` : ""}`,
    /** Bulldozing: what pulling it down gives back, or that it stays. */
    bulldozeBuilding: (kind: KindId, level: number, back: string): string => `${kindName(kind, level)} · ${back}`,
    hallStays: "the town hall stays",
    bulldozeHome: (tier: Tier, back: string): string => `${tiers[tier].home.one} · ${back}`,
    homeClosed: (tier: Tier): string => `${tiers[tier].home.one} · closed`,
    home: (h: { readonly tier: Tier; readonly residents: number; readonly desirability: number; readonly burning: boolean; readonly sick: boolean }): string =>
      `${tiers[h.tier].home.one} · ${count(h.residents, residents)} · desirability ${h.desirability}${h.burning ? " · on fire!" : h.sick ? " · sick" : ""}`,
    ruin: (cause: "burnt" | "collapsed" | "derelict"): string => `ruin · ${ruinCause[cause]} · bulldoze to clear`,
    park: (what: { readonly prop: PropId } | { readonly ground: GroundId }, whole: { readonly cells: number; readonly value: number; readonly reach: number } | null): string =>
      `park · ${"prop" in what ? props[what.prop].noun.one : grounds[what.ground].noun.one}${whole ? ` · ${whole.cells} cells · ${parkWorth(whole.value, whole.reach)}` : ""}`,
    /** Placing a building: what keeps it from here, or what it costs. */
    placeLocked: (kind: KindId, l: Lock): string => `${kindName(kind)} · ${say(lock, l)}`,
    placeNoRoom: (kind: KindId): string => `${kindName(kind)} · no room here`,
    placeProblem: (kind: KindId, why: string): string => `${kindName(kind)} · ${why}`,
    placeCost: (kind: KindId, c: Kind["cost"]): string => `${kindName(kind)} · ${cost(c)}`,
    pave: (c: { readonly coins: number; readonly stone: number }): string => `pave · ${token.coins(c.coins)} and ${token.amount("stone", c.stone)} a cell · faster walking`,
    desirability: (d: number): string => `desirability ${d}`,
    cancel: "let go here to cancel",
    /** What new homes would bring in once fed, or that they would cost more than they pay. */
    homesWorth: (coins: number): string => (coins > 0 ? ` · ${token.rate(coins, true)} once fed` : " · costs more to run than it pays: finer homes pay better"),
    homes: (c: Kind["cost"], worth: string | null): string => `homes · ${cost(c)} each${worth ?? " · lay them beside a road"}`,
    road: (coins: number): string => `road · ${token.coins(coins)} a cell`,
    /** A stroke being dragged: how much it lays, and what that costs. */
    roadStroke: (n: number, c: Kind["cost"]): string => `${count(n, roadCells)} · ${cost(c)}`,
    homesStroke: (n: number, c: Kind["cost"], worth: string): string => `${count(n, homes)} · ${cost(c)}${worth}`,
    paveStroke: (n: number, c: Kind["cost"]): string => `pave ${count(n, cells)} · ${cost(c)}`,
    groundStroke: (ground: GroundId, n: number, c: Kind["cost"]): string => `${grounds[ground].noun.one} · ${count(n, cells)} · ${cost(c)}`,
    ground: (ground: GroundId, c: Kind["cost"], park: number | null): string => `${grounds[ground].noun.one} · ${cost(c)}${park === null ? "" : ` · park ${signed(park)} desirability`}`,
    /** A furnishing about to be set: what the park would be worth with it (and is now, when that differs), and whether it is one too many. */
    prop: (prop: PropId, c: Kind["cost"], park: { readonly value: number; readonly before: number | null; readonly crowded: boolean } | null): string =>
      `${props[prop].noun.one} · ${cost(c)}${park ? ` · park ${signed(park.value)} desirability${park.before === null ? "" : ` (now ${signed(park.before)})`}` : ""}${park?.crowded ? " · too crowded" : ""}`,
    propNeedsPark: (prop: PropId): string => `${props[prop].noun.one} · lay park ground first`,
    removeProp: (prop: PropId): string => `remove the ${props[prop].noun.one}`,
    removeGround: (ground: GroundId): string => `remove the ${grounds[ground].noun.one}`,
    workedFace: (ore: boolean): string => `worked ${ore ? "ore" : "stone"} face · bulldoze to clear it`,
    rock: (ore: boolean, left: number): string => `${ore ? "ore" : "stone"} · ${left} left`,
    /** What a thing being placed would reach, said beside its outline. */
    walkersReach: (range: number): string => `its walkers reach ${range} road cells from the door`,
    workersFrom: `its workers come from homes within ${COMMUTE} road cells`,
    residentsWalk: `residents walk to work within ${COMMUTE} road cells`
  }
}
