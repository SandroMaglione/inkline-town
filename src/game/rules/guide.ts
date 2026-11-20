/**
 * The mayor's guide: a tutorial told through the ticker, one step at a
 * time, written for someone who has never played a town-builder. Each step
 * is one thing to do and one reason for it, and names the buildings it asks
 * for (`asks`), which the ticker turns into chips that place them. What a
 * step says is not here: this file is the guide's order and its conditions,
 * and every word of it is the language's (`i18n`: `guide.steps`, keyed by
 * the step's id, so a new step does not compile until it is worded; what
 * the guide says about the town as it stands, such as what is under way,
 * what opens a building, or what comes next, is told as data and worded
 * there too). A step shows while it applies (`when`) and is put away for good
 * once the town has done it (`done`), whether or not it was ever shown, so a
 * mayor who already knows the game is not told what they did. The list is in
 * order of priority, not of chapters: a request from the crown with a
 * deadline goes ahead of a chain that takes minutes to build.
 *
 * Most steps are a course (`course`), taught in order, chapter by chapter,
 * and counted ("step 3 of 8"). Founding: homes, a road to the water, a
 * fishery, a look at what it needs, a lumberjack, a sawmill, the term's goal,
 * and ten homes. Growing citizens: a quarry, cloth, faith, bread, the first
 * citizens, the goals again. Governing: the ranks, up to a city. The course always has
 * something to say, so the guide never falls silent on a mayor who does not
 * know what comes next; a step whose buildings the town cannot build yet
 * says what opens them (`lockedNote`), and the course goes on to one it can.
 *
 * The course never asks for a building before the town needs it: a
 * building's upkeep starts the day it stands. A step with a `need` waits for
 * it (planks running low, stone running low), the course goes on past it,
 * and the card says what comes next and when (`upcoming`: a lumberjack and
 * a sawmill, once planks fall below 25, with how many there are now).
 *
 * Around the course, steps come when the town needs them: each waits for a
 * sign (stone running low, the woods thinning, a fire risk rising), goes
 * ahead of the course once Founding is done, and after one is done the guide
 * keeps quiet about such signs for `GUIDE_QUIET` seconds. An urgent step (the
 * crown's request, winter, a fire, the sick, a building falling apart) does
 * not wait for the quiet. A sign once shown stays until it is done or put
 * away, so the ticker does not hop between steps.
 *
 * A step that asks for a building is done when the building stands, not when
 * it is laid; in between, `waiting` says what is happening (carriers bringing
 * planks to the site), so the mayor knows they did the right thing.
 */
import { kinds, type Amounts, type KindId } from "../content/index.ts"

/** What the guide reads of the town. */
export interface GuideFacts {
  /** Homes laid, built or not; and built. */
  readonly homes: number
  readonly builtHomes: number
  readonly residents: number
  /** Citizens, and homes that hold them (citizens' homes and townhouses). */
  readonly citizens: number
  readonly finerHomes: number
  /** Kinds of building placed (sites too), and standing. */
  readonly placed: ReadonlySet<KindId>
  readonly standing: ReadonlySet<KindId>
  readonly stock: Amounts
  readonly sick: number
  readonly burning: number
  /** It is winter now, or the next one is this many seconds away (`null`: none before the term ends). */
  readonly winter: boolean
  readonly winterIn: number | null
  /** A building that wants mending. */
  readonly worn: boolean
  /** A settlers' home with every citizens' need met, on a street too poor for citizens. */
  readonly poorStreet: boolean
  readonly crown: { readonly open: boolean; readonly met: number }
  /** Coins a minute, and approval. */
  readonly net: number
  readonly approval: number
  /** The town buys or sells something; a tax rate is off the usual. */
  readonly trading: boolean
  /** The town buys tools from traders. */
  readonly buysTools: boolean
  readonly taxed: boolean
  /** The most of any one good in store. */
  readonly most: number
  /** The page: the town panel is open; a home is selected; a building (not the town hall) is selected. */
  readonly sawTown: boolean
  readonly sawHome: boolean
  readonly sawBuilding: boolean
  /** A road comes within two cells of water, close enough for a fishery on it. */
  readonly roadToWater: boolean
  /** The town's rank: 0 hamlet, 1 village, 2 town, 3 city. */
  readonly rank: number
  /** Kinds of building upgraded where they stand (a market hall, a church). */
  readonly upgraded: ReadonlySet<KindId>
  /** Coins in the treasury. */
  readonly coins: number
  /** Built homes no food walker reaches (the town hall's or a market's). */
  readonly unreached: number
  /** A home whose risk of fire, sickness, or theft is rising. */
  readonly risk: { readonly fire: boolean; readonly health: boolean; readonly order: boolean }
  /** A lumberjack with few trees left in reach. */
  readonly fewTrees: boolean
}

/** Seconds of the town's time the guide keeps quiet after a step, before the next that is not urgent. */
export const GUIDE_QUIET = 45

/** Where a step's "show me where" goes: a place on the land, or a building of a kind. */
export type GuideFocus = "hall" | "water" | "trees" | "stone" | "ore" | "worn" | "poorStreet" | { readonly kind: KindId }

/** The guide's chapters: founding the town, keeping it standing, growing citizens, and governing it. */
export const chapters = ["founding", "standing", "citizens", "governing"] as const
export type Chapter = (typeof chapters)[number]

/**
 * Every step, by its id. A town saves the ids of the steps it has put away
 * (`Guide.done`), so an id is never renamed; and each language words every
 * one of them. The order here means nothing: `guideSteps` is the order.
 */
export const guideStepIds = [
  "homes", "road", "fishery", "look", "lumberjack", "sawmill", "term", "grow", "quarry", "cloth", "chapel", "wheat", "bakery", "citizens", "goals", "ranks",
  "crown", "winter", "tools", "forester", "firewatch", "builder", "market", "markethall", "street", "carpenter", "healer", "watchhouse", "trade", "taxes", "smithy"
] as const
export type GuideStepId = (typeof guideStepIds)[number]

/** What is happening once the mayor has done a step's part: its homes or its site waiting on planks, or going up. */
export type GuideWaiting =
  /** Homes are laid, and the store has no planks for them. */
  | { readonly _tag: "homesNoPlanks" }
  /** Homes are laid, and builders are carrying their planks. */
  | { readonly _tag: "homesRising" }
  /** A building is laid, and the store has no planks for its site. */
  | { readonly _tag: "siteNoPlanks" }
  /** A building is laid: carriers and builders are at work on its site. */
  | { readonly _tag: "siteRising" }
  /** The ten homes the founding asks for are laid, and going up. */
  | { readonly _tag: "homesLaid" }

/**
 * A course step that waits for the town to need it, by what it will ask
 * for: a lumberjack and a sawmill, a sawmill, or a quarry, once the good
 * they make falls below `below` (the town has `now`).
 */
export type GuideSoon =
  | { readonly _tag: "lumberjack"; readonly below: number; readonly now: number }
  | { readonly _tag: "sawmill"; readonly below: number; readonly now: number }
  | { readonly _tag: "quarry"; readonly below: number; readonly now: number }

/**
 * Why the town cannot build what a step asks for yet: the building opens
 * at more residents, or more citizens, than the town has (`now`), or the
 * treasury (`now`) cannot pay for it.
 */
export type GuideLocked =
  | { readonly _tag: "residents"; readonly kind: KindId; readonly needs: number; readonly now: number }
  | { readonly _tag: "citizens"; readonly kind: KindId; readonly needs: number; readonly now: number }
  | { readonly _tag: "coins"; readonly kind: KindId; readonly cost: number; readonly now: number }

export interface GuideStep {
  readonly id: GuideStepId
  readonly chapter: Chapter
  /** The buildings the step asks for: where its words name them, they become chips to place one. */
  readonly asks?: ReadonlyArray<KindId>
  readonly focus: GuideFocus | null
  readonly when: (f: GuideFacts) => boolean
  /** Part of the course, taught in this order chapter by chapter, without the quiet. */
  readonly course?: boolean
  /** A course step that waits until the town needs it (the course goes on past it meanwhile); and, while it waits, what for. */
  readonly need?: (f: GuideFacts) => boolean
  readonly soon?: (f: GuideFacts) => GuideSoon
  /** It cannot wait for the guide's quiet (and goes ahead of the step shown). */
  readonly urgent?: (f: GuideFacts) => boolean
  readonly done: (f: GuideFacts) => boolean
  /** Once the mayor has done their part and the town is at work on it: what is happening (`null`: not yet). */
  readonly waiting?: (f: GuideFacts) => GuideWaiting | null
}

/** Every one of these buildings stands (built, not only laid). */
const has = (f: GuideFacts, ...kinds: ReadonlyArray<KindId>) => kinds.every((k) => f.standing.has(k))

/** Planks and stone low enough that a lumberjack and a sawmill, or a quarry, are worth their upkeep. */
export const PLANKS_LOW = 25
export const STONE_LOW = 8

/** What a site needs while it waits: planks, mostly, carried from the store. */
const siteNote = (f: GuideFacts): GuideWaiting => (f.stock.planks === 0 ? { _tag: "siteNoPlanks" } : { _tag: "siteRising" })

/** The step's buildings are laid but not all standing yet. */
const rising = (...kinds: ReadonlyArray<KindId>) => (f: GuideFacts): GuideWaiting | null =>
  kinds.some((k) => f.placed.has(k) && !f.standing.has(k)) ? siteNote(f) : null

export const guideSteps: ReadonlyArray<GuideStep> = [
  // ── The opening, in order ──
  {
    id: "homes",
    chapter: "founding",
    course: true,
    focus: "hall",
    when: () => true,
    done: (f) => f.builtHomes > 0,
    waiting: (f) => (f.homes > 0 ? (f.stock.planks === 0 ? { _tag: "homesNoPlanks" } : { _tag: "homesRising" }) : null)
  },
  {
    id: "road",
    chapter: "founding",
    course: true,
    focus: "water",
    when: () => true,
    done: (f) => f.roadToWater || has(f, "fishery") || has(f, "bakery")
  },
  {
    id: "fishery",
    chapter: "founding",
    course: true,
    asks: ["fishery"],
    focus: "water",
    when: () => true,
    done: (f) => has(f, "fishery") || has(f, "bakery"),
    waiting: rising("fishery")
  },
  {
    id: "look",
    chapter: "founding",
    course: true,
    focus: { kind: "fishery" },
    when: (f) => f.standing.has("fishery"),
    done: (f) => f.sawBuilding
  },
  {
    id: "lumberjack",
    chapter: "founding",
    course: true,
    asks: ["lumberjack"],
    focus: "trees",
    when: () => true,
    need: (f) => f.stock.planks < PLANKS_LOW || f.placed.has("lumberjack"),
    soon: (f) => ({ _tag: "lumberjack", below: PLANKS_LOW, now: f.stock.planks }),
    done: (f) => has(f, "lumberjack"),
    waiting: rising("lumberjack")
  },
  {
    id: "sawmill",
    chapter: "founding",
    course: true,
    asks: ["sawmill"],
    focus: { kind: "lumberjack" },
    when: () => true,
    need: (f) => f.stock.planks < PLANKS_LOW || f.placed.has("lumberjack") || f.placed.has("sawmill"),
    soon: (f) => ({ _tag: "sawmill", below: PLANKS_LOW, now: f.stock.planks }),
    done: (f) => has(f, "sawmill"),
    waiting: rising("sawmill")
  },
  {
    id: "term",
    chapter: "founding",
    course: true,
    focus: null,
    when: () => true,
    done: (f) => f.sawTown
  },
  {
    id: "grow",
    chapter: "founding",
    course: true,
    focus: "hall",
    when: () => true,
    done: (f) => f.builtHomes >= 10,
    waiting: (f) => (f.homes >= 10 && f.builtHomes < 10 ? { _tag: "homesLaid" } : null)
  },

  // ── The course goes on: citizens ──
  {
    id: "quarry",
    chapter: "citizens",
    course: true,
    asks: ["quarry"],
    focus: "stone",
    when: () => true,
    need: (f) => f.stock.stone < STONE_LOW || f.placed.has("quarry"),
    soon: (f) => ({ _tag: "quarry", below: STONE_LOW, now: f.stock.stone }),
    done: (f) => has(f, "quarry"),
    waiting: rising("quarry")
  },
  {
    id: "cloth",
    chapter: "citizens",
    course: true,
    asks: ["sheep", "weaver"],
    focus: "hall",
    when: () => true,
    done: (f) => has(f, "sheep", "weaver"),
    waiting: rising("sheep", "weaver")
  },
  {
    id: "chapel",
    chapter: "citizens",
    course: true,
    asks: ["chapel"],
    focus: "hall",
    when: () => true,
    done: (f) => has(f, "chapel"),
    waiting: rising("chapel")
  },
  {
    id: "wheat",
    chapter: "citizens",
    course: true,
    asks: ["farm", "mill"],
    focus: "hall",
    when: () => true,
    done: (f) => has(f, "farm", "mill"),
    waiting: rising("farm", "mill")
  },
  {
    id: "bakery",
    chapter: "citizens",
    course: true,
    asks: ["bakery"],
    focus: { kind: "mill" },
    when: (f) => has(f, "farm", "mill"),
    done: (f) => has(f, "bakery"),
    waiting: rising("bakery")
  },
  {
    id: "citizens",
    chapter: "citizens",
    course: true,
    focus: "hall",
    when: () => true,
    done: (f) => f.finerHomes > 0
  },
  {
    id: "goals",
    chapter: "citizens",
    course: true,
    focus: null,
    when: (f) => f.finerHomes > 0,
    done: (f) => f.sawTown
  },
  {
    id: "ranks",
    chapter: "governing",
    course: true,
    focus: null,
    when: () => true,
    done: (f) => f.rank >= 3
  },

  // ── Around the course, when the town needs them ──
  {
    id: "crown",
    chapter: "governing",
    focus: null,
    when: (f) => f.crown.open,
    urgent: () => true,
    done: (f) => f.crown.met > 0
  },
  {
    id: "winter",
    chapter: "standing",
    asks: ["granary", "smokehouse"],
    focus: "hall",
    when: (f) => f.residents >= 20 && (f.winter || (f.winterIn !== null && f.winterIn <= 120)),
    urgent: () => true,
    done: (f) => has(f, "granary") || has(f, "smokehouse"),
    waiting: rising("granary", "smokehouse")
  },
  {
    id: "tools",
    chapter: "citizens",
    focus: null,
    when: (f) => f.residents >= 15 && f.citizens < 10 && f.stock.tools <= 3 && !has(f, "smithy"),
    done: (f) => f.buysTools || has(f, "smithy")
  },
  {
    id: "forester",
    chapter: "founding",
    asks: ["forester"],
    focus: { kind: "lumberjack" },
    when: (f) => f.fewTrees,
    done: (f) => has(f, "forester"),
    waiting: rising("forester")
  },
  {
    id: "firewatch",
    chapter: "standing",
    asks: ["firewatch"],
    focus: "hall",
    when: (f) => f.risk.fire || f.burning > 0,
    urgent: (f) => f.burning > 0,
    done: (f) => has(f, "firewatch"),
    waiting: rising("firewatch")
  },
  {
    id: "builder",
    chapter: "standing",
    asks: ["builder"],
    focus: "worn",
    when: (f) => f.worn,
    urgent: () => true,
    done: (f) => has(f, "builder"),
    waiting: rising("builder")
  },
  {
    id: "market",
    chapter: "standing",
    asks: ["market"],
    focus: "hall",
    when: (f) => f.unreached >= 2,
    done: (f) => has(f, "market"),
    waiting: rising("market")
  },
  {
    id: "markethall",
    chapter: "standing",
    focus: { kind: "market" },
    when: (f) => f.rank >= 2 && has(f, "market") && f.unreached >= 2,
    done: (f) => f.upgraded.has("market")
  },
  {
    id: "street",
    chapter: "citizens",
    asks: ["chapel", "market"],
    focus: "poorStreet",
    when: (f) => f.poorStreet,
    done: (f) => f.finerHomes > 0
  },
  {
    id: "carpenter",
    chapter: "citizens",
    asks: ["carpenter"],
    focus: "hall",
    when: (f) => f.citizens >= 60 && f.finerHomes >= 8,
    done: (f) => has(f, "carpenter"),
    waiting: rising("carpenter")
  },
  {
    id: "healer",
    chapter: "standing",
    asks: ["healer"],
    focus: "hall",
    when: (f) => f.residents >= 30 && (f.sick > 0 || f.risk.health),
    urgent: (f) => f.sick > 0,
    done: (f) => has(f, "healer") || has(f, "hospital"),
    waiting: rising("healer")
  },
  {
    id: "watchhouse",
    chapter: "standing",
    asks: ["watchhouse"],
    focus: "hall",
    when: (f) => f.residents >= 40 && f.risk.order,
    done: (f) => has(f, "watchhouse"),
    waiting: rising("watchhouse")
  },
  {
    id: "trade",
    chapter: "governing",
    focus: null,
    when: (f) => f.residents >= 20 && (f.net < 0 || f.most >= 80),
    done: (f) => f.trading
  },
  {
    id: "taxes",
    chapter: "governing",
    focus: null,
    when: (f) => f.approval >= 30 && f.net < 0,
    done: (f) => f.taxed
  },
  {
    id: "smithy",
    chapter: "governing",
    asks: ["mine", "smithy"],
    focus: "ore",
    when: (f) => f.citizens >= 10 && f.stock.tools <= 5,
    done: (f) => has(f, "mine", "smithy"),
    waiting: rising("mine", "smithy")
  }
]

/** The course, in order. */
export const courseSteps: ReadonlyArray<GuideStep> = guideSteps.filter((s) => s.course)

/** Where a course step stands in its chapter ("step 3 of 8"), or `null` for a step not in the course or alone in its chapter. */
export const courseCount = (step: GuideStep): { readonly at: number; readonly of: number } | null => {
  if (!step.course) return null
  const chapter = courseSteps.filter((s) => s.chapter === step.chapter)
  return chapter.length > 1 ? { at: chapter.indexOf(step) + 1, of: chapter.length } : null
}

/** When the town cannot build what a step asks for yet: what opens it, or what it costs (`null`: it can). */
export const lockedNote = (step: GuideStep, f: GuideFacts): GuideLocked | null => {
  for (const id of step.asks ?? []) {
    const kind = kinds[id]
    if (kind.unlock.residents > f.residents) return { _tag: "residents", kind: id, needs: kind.unlock.residents, now: f.residents }
    if (kind.unlock.citizens > f.citizens) return { _tag: "citizens", kind: id, needs: kind.unlock.citizens, now: f.citizens }
  }
  // Not yet laid, and the treasury cannot pay for the cheapest of them.
  const unpaid = (step.asks ?? []).filter((id) => !f.placed.has(id)).map((id) => kinds[id])
  const cheapest = unpaid.sort((a, b) => a.cost.coins - b.cost.coins)[0]
  if (cheapest && f.coins < cheapest.cost.coins) return { _tag: "coins", kind: cheapest.id, cost: cheapest.cost.coins, now: f.coins }
  return null
}

/** The next course step that waits for the town to need it: what it will ask for, and when it comes (`null`: none waiting). */
export const upcoming = (f: GuideFacts, done: ReadonlySet<string>): GuideSoon | null =>
  courseSteps.find((s) => !done.has(s.id) && !s.done(f) && s.when(f) && s.need && !s.need(f) && s.soon)?.soon?.(f) ?? null

/** The steps the town has now done that the guide has not yet put away. */
export const guideDone = (f: GuideFacts, done: ReadonlySet<string>): Array<string> =>
  guideSteps.filter((s) => !done.has(s.id) && s.done(f)).map((s) => s.id)

/**
 * The step to show now, if any: an urgent one first; then the course while
 * the town is being founded; then a sign already shown (`shown`), until it is
 * done or put away; then, unless the guide is keeping `quiet`, a new sign;
 * and otherwise the course: its next step, or when the town cannot build
 * that yet, a later building it can (else the step, saying what opens it).
 */
export const guideStep = (f: GuideFacts, done: ReadonlySet<string>, pace: { readonly shown?: string | null; readonly quiet?: boolean } = {}): GuideStep | null => {
  const open = (s: GuideStep) => !done.has(s.id) && !s.done(f)
  const urgent = guideSteps.find((s) => open(s) && s.when(f) && s.urgent?.(f))
  if (urgent) return urgent
  const course = courseSteps.filter((s) => open(s) && s.when(f) && (s.need?.(f) ?? true))
  // A step the town cannot build yet gives way to a later building it can; else it shows, saying what opens it.
  const first = course[0] ?? null
  const next = first && lockedNote(first, f) !== null ? (course.find((s) => s.asks && lockedNote(s, f) === null) ?? first) : first
  if (next?.chapter === "founding") return next
  const shown = guideSteps.find((s) => s.id === pace.shown && !s.course && open(s) && (!s.urgent || s.when(f)))
  if (shown) return shown
  const sign = pace.quiet ? undefined : guideSteps.find((s) => !s.course && open(s) && s.when(f))
  return sign ?? next
}
