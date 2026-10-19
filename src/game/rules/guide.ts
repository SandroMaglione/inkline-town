/**
 * The mayor's guide: a tutorial told through the ticker, one step at a
 * time, written for someone who has never played a town-builder. Each step
 * is one thing to do (`action`) and one reason for it (`why`), and names the
 * buildings it asks for (`asks`) so the ticker can turn them into chips that
 * place them. A step shows while it applies (`when`) and is put away for good
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
 * and the card says what comes next and when (`upcoming`: "next: a
 * lumberjack and a sawmill, once planks fall below 25 (31 now)").
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
 *
 * The texts are written once for mouse and touch. In them:
 * - a building's name (in `asks`) becomes a chip that starts placing one;
 * - `[homes]`, `[road]`, `[select]`, `[build]`, `[town]`, `[speed]`,
 *   `[pause]`, and `[view:fire]` (any map view) become chips that pick that
 *   tool, open that panel, or show that view; on a keyboard they carry the key;
 * - `{tap|click}` reads "tap" on a touch screen and "click" with a mouse.
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

export const chapters = ["Founding", "Keeping it standing", "Growing citizens", "Governing"] as const
export type Chapter = (typeof chapters)[number]

export interface GuideStep {
  readonly id: string
  readonly chapter: Chapter
  /** What to do, in one sentence. */
  readonly action: string
  /** Why, in a sentence or two. */
  readonly why: string
  /** When the step is done, in a few words: shown under it, so the mayor knows what closes it. */
  readonly goal: string
  /** The buildings the step asks for: their names in the text become chips to place one. */
  readonly asks?: ReadonlyArray<KindId>
  readonly focus: GuideFocus | null
  readonly when: (f: GuideFacts) => boolean
  /** Part of the course, taught in this order chapter by chapter, without the quiet. */
  readonly course?: boolean
  /** A course step that waits until the town needs it (the course goes on past it meanwhile); and, while it waits, what for. */
  readonly need?: (f: GuideFacts) => boolean
  readonly soon?: (f: GuideFacts) => string
  /** It cannot wait for the guide's quiet (and goes ahead of the step shown). */
  readonly urgent?: (f: GuideFacts) => boolean
  readonly done: (f: GuideFacts) => boolean
  /** Once the mayor has done their part and the town is at work on it: what is happening (`null`: not yet). */
  readonly waiting?: (f: GuideFacts) => string | null
}

/** Every one of these buildings stands (built, not only laid). */
const has = (f: GuideFacts, ...kinds: ReadonlyArray<KindId>) => kinds.every((k) => f.standing.has(k))

/** Planks and stone low enough that a lumberjack and a sawmill, or a quarry, are worth their upkeep. */
export const PLANKS_LOW = 25
export const STONE_LOW = 8

/** What a site needs while it waits: planks, mostly, carried from the store. */
const siteNote = (f: GuideFacts) =>
  f.stock.planks === 0
    ? "The store has no planks left, so the site waits: sell something in the [town] panel, or buy planks there."
    : "It is a building site for now: carriers bring its planks and stone from the store, then builders put it up. [speed] makes time run faster."

/** The step's buildings are laid but not all standing yet. */
const rising = (...kinds: ReadonlyArray<KindId>) => (f: GuideFacts) =>
  kinds.some((k) => f.placed.has(k) && !f.standing.has(k)) ? siteNote(f) : null

export const guideSteps: ReadonlyArray<GuideStep> = [
  // ── The opening, in order ──
  {
    id: "homes",
    chapter: "Founding",
    course: true,
    action: "Pick [homes] and drag along the grey road around the town hall{, then tap Build|}.",
    why: "Settlers move into homes that touch a road, and every home pays taxes: the town's income.",
    goal: "a home stands",
    focus: "hall",
    when: () => true,
    done: (f) => f.builtHomes > 0,
    waiting: (f) =>
      f.homes > 0
        ? f.stock.planks === 0
          ? "The homes wait for planks, and the store has none."
          : "Builders are carrying planks from the store to the new homes, and settlers move in once one stands. [speed] makes time run faster."
        : null
  },
  {
    id: "road",
    chapter: "Founding",
    course: true,
    action: "Pick [road] and drag a road from the town hall's road towards the water.",
    why: "Every building needs a road touching the middle of one of its sides, or nobody can reach it. The fishery comes next, and it needs water nearby.",
    goal: "a road comes within two cells of water",
    focus: "water",
    when: () => true,
    done: (f) => f.roadToWater || has(f, "fishery") || has(f, "bakery")
  },
  {
    id: "fishery",
    chapter: "Founding",
    course: true,
    action: "{Tap|Click} fishery, then place it on that road, with water no more than two cells away.",
    why: "Settlers eat fish. The town starts with a little, and fish rots in store.",
    goal: "a fishery stands",
    asks: ["fishery"],
    focus: "water",
    when: () => true,
    done: (f) => has(f, "fishery") || has(f, "bakery"),
    waiting: rising("fishery")
  },
  {
    id: "look",
    chapter: "Founding",
    course: true,
    action: "Pick [select] and {tap|click} the fishery to open its panel.",
    why: "A building needs workers from homes within 15 road cells; its panel says how many it has, and what holds it back. The jobs counter at the top adds them all up.",
    goal: "you open a building's panel",
    focus: { kind: "fishery" },
    when: (f) => f.standing.has("fishery"),
    done: (f) => f.sawBuilding
  },
  {
    id: "lumberjack",
    chapter: "Founding",
    course: true,
    action: "Build a lumberjack on a road beside the trees.",
    why: "Planks are running low, and every home and building costs some. Wood is where planks start.",
    goal: "a lumberjack stands",
    asks: ["lumberjack"],
    focus: "trees",
    when: () => true,
    need: (f) => f.stock.planks < PLANKS_LOW || f.placed.has("lumberjack"),
    soon: (f) => `a lumberjack and a sawmill, once planks fall below ${PLANKS_LOW} (${f.stock.planks} now)`,
    done: (f) => has(f, "lumberjack"),
    waiting: rising("lumberjack")
  },
  {
    id: "sawmill",
    chapter: "Founding",
    course: true,
    action: "Build a sawmill on a road near the lumberjack.",
    why: "Goods come in chains: the lumberjack fells wood, and the sawmill saws it into planks. Carriers walk the goods between them along the roads.",
    goal: "a sawmill stands",
    asks: ["sawmill"],
    focus: { kind: "lumberjack" },
    when: () => true,
    need: (f) => f.stock.planks < PLANKS_LOW || f.placed.has("lumberjack") || f.placed.has("sawmill"),
    soon: (f) => `a sawmill, once planks fall below ${PLANKS_LOW} (${f.stock.planks} now)`,
    done: (f) => has(f, "sawmill"),
    waiting: rising("sawmill")
  },
  {
    id: "term",
    chapter: "Founding",
    course: true,
    action: "Open the [town] panel and read the goals at its top.",
    why: "Meeting them raises the town from hamlet to village, town, and city, each with a reward from the crown. [pause] stops the clock whenever you need to think.",
    goal: "you open the town panel",
    focus: null,
    when: () => true,
    done: (f) => f.sawTown
  },
  {
    id: "grow",
    chapter: "Founding",
    course: true,
    action: "Lay more roads and homes until ten homes stand.",
    why: "More people pay more taxes, and unlock new buildings in [build]. The guide asks for a building only once the town needs it.",
    goal: "10 homes stand",
    focus: "hall",
    when: () => true,
    done: (f) => f.builtHomes >= 10,
    waiting: (f) => (f.homes >= 10 && f.builtHomes < 10 ? "Ten homes are laid: builders are putting them up." : null)
  },

  // ── The course goes on: citizens ──
  {
    id: "quarry",
    chapter: "Growing citizens",
    course: true,
    action: "Build a quarry on a road beside the pale rocks.",
    why: "Stone is running low, and the workshops citizens need cost some. The dark rocks are ore, for later.",
    goal: "a quarry stands",
    asks: ["quarry"],
    focus: "stone",
    when: () => true,
    need: (f) => f.stock.stone < STONE_LOW || f.placed.has("quarry"),
    soon: (f) => `a quarry, once stone falls below ${STONE_LOW} (${f.stock.stone} now)`,
    done: (f) => has(f, "quarry"),
    waiting: rising("quarry")
  },
  {
    id: "cloth",
    chapter: "Growing citizens",
    course: true,
    action: "Build a sheep farm and a weaver, on roads near each other.",
    why: "A home becomes a citizens' home with bread, cloth, and faith. The sheep farm shears wool, and the weaver weaves it into cloth.",
    goal: "a sheep farm and a weaver stand",
    asks: ["sheep", "weaver"],
    focus: "hall",
    when: () => true,
    done: (f) => has(f, "sheep", "weaver"),
    waiting: rising("sheep", "weaver")
  },
  {
    id: "chapel",
    chapter: "Growing citizens",
    course: true,
    action: "Build a chapel on a road among the homes.",
    why: "Faith is the second need. The chapel's walker brings it to the homes it passes, and the chapel makes its street nicer to live on.",
    goal: "a chapel stands",
    asks: ["chapel"],
    focus: "hall",
    when: () => true,
    done: (f) => has(f, "chapel"),
    waiting: rising("chapel")
  },
  {
    id: "wheat",
    chapter: "Growing citizens",
    course: true,
    action: "Build a farm and a mill.",
    why: "Bread is the third need, and the longest chain: the farm grows wheat, and the mill grinds it into flour.",
    goal: "a farm and a mill stand",
    asks: ["farm", "mill"],
    focus: "hall",
    when: () => true,
    done: (f) => has(f, "farm", "mill"),
    waiting: rising("farm", "mill")
  },
  {
    id: "bakery",
    chapter: "Growing citizens",
    course: true,
    action: "Build a bakery near the mill.",
    why: "It bakes the mill's flour into bread. Even a settlers' cottage with bread on the table pays half again.",
    goal: "a bakery stands",
    asks: ["bakery"],
    focus: { kind: "mill" },
    when: (f) => has(f, "farm", "mill"),
    done: (f) => has(f, "bakery"),
    waiting: rising("bakery")
  },
  {
    id: "citizens",
    chapter: "Growing citizens",
    course: true,
    action: "Pick [select] and {tap|click} a home to see what it still lacks to hold citizens.",
    why: "With bread, cloth, faith, and a street of desirability 5, a home rises once the store pays its planks and stone. Its panel lists what is missing.",
    goal: "the first home holds citizens",
    focus: "hall",
    when: () => true,
    done: (f) => f.finerHomes > 0
  },
  {
    id: "goals",
    chapter: "Growing citizens",
    course: true,
    action: "Open the [town] panel to see how close the goals are.",
    why: "The first citizens have moved in, and each rank asks for a bigger share of them.",
    goal: "you open the town panel",
    focus: null,
    when: (f) => f.finerHomes > 0,
    done: (f) => f.sawTown
  },
  {
    id: "ranks",
    chapter: "Governing",
    course: true,
    action: "Meet every goal in the [town] panel to raise the town's rank.",
    why: "Hold them for two minutes and the town rises, up to a city. The town rank opens upgrades for the market and the chapel. The guide speaks up when something needs you.",
    goal: "the town is a city",
    focus: null,
    when: () => true,
    done: (f) => f.rank >= 3
  },

  // ── Around the course, when the town needs them ──
  {
    id: "crown",
    chapter: "Governing",
    action: "Send the crown what it asks for, with the send button on its request at the top.",
    why: "It pays coins. An unanswered request is a fine, and three missed in a row end your term.",
    goal: "the goods are sent",
    focus: null,
    when: (f) => f.crown.open,
    urgent: () => true,
    done: (f) => f.crown.met > 0
  },
  {
    id: "winter",
    chapter: "Keeping it standing",
    action: "Build a granary or a smokehouse before winter comes.",
    why: "In winter fishing slows, homes eat more, and fish rots in store. A granary keeps it five times as long, and smoked fish keeps all winter.",
    goal: "a granary or a smokehouse stands",
    asks: ["granary", "smokehouse"],
    focus: "hall",
    when: (f) => f.residents >= 20 && (f.winter || (f.winterIn !== null && f.winterIn <= 120)),
    urgent: () => true,
    done: (f) => has(f, "granary") || has(f, "smokehouse"),
    waiting: rising("granary", "smokehouse")
  },
  {
    id: "tools",
    chapter: "Growing citizens",
    action: "In the [town] panel, under goods and trade, set tools to buy.",
    why: "Workshops use up tools, and only a smithy makes new ones, which opens at 10 citizens.",
    goal: "the town buys tools, or a smithy stands",
    focus: null,
    when: (f) => f.residents >= 15 && f.citizens < 10 && f.stock.tools <= 3 && !has(f, "smithy"),
    done: (f) => f.buysTools || has(f, "smithy")
  },
  {
    id: "forester",
    chapter: "Founding",
    action: "Build a forester next to the lumberjack.",
    why: "The lumberjack is running out of trees, and a forester plants new ones for it.",
    goal: "a forester stands",
    asks: ["forester"],
    focus: { kind: "lumberjack" },
    when: (f) => f.fewTrees,
    done: (f) => has(f, "forester"),
    waiting: rising("forester")
  },
  {
    id: "firewatch",
    chapter: "Keeping it standing",
    action: "Build a fire watch on a road among the homes.",
    why: "Wooden cottages catch fire, and a fire spreads to the neighbours. Its watchman keeps the risk down, and its firefighters put fires out. [view:fire] shows the risk.",
    goal: "a fire watch stands",
    asks: ["firewatch"],
    focus: "hall",
    when: (f) => f.risk.fire || f.burning > 0,
    urgent: (f) => f.burning > 0,
    done: (f) => has(f, "firewatch"),
    waiting: rising("firewatch")
  },
  {
    id: "builder",
    chapter: "Keeping it standing",
    action: "Build a builder's yard near the worn buildings.",
    why: "A run-down building works at half pace and can fall down. Its builder mends what it passes, with planks and stone. [view:condition] shows their state.",
    goal: "a builder's yard stands",
    asks: ["builder"],
    focus: "worn",
    when: (f) => f.worn,
    urgent: () => true,
    done: (f) => has(f, "builder"),
    waiting: rising("builder")
  },
  {
    id: "market",
    chapter: "Keeping it standing",
    action: "Build a market among the homes furthest from the town hall.",
    why: "Some homes are beyond the town hall's walker, which only reaches 20 road cells, and get no food. A market's walker carries it further.",
    goal: "a market stands",
    asks: ["market"],
    focus: "hall",
    when: (f) => f.unreached >= 2,
    done: (f) => has(f, "market"),
    waiting: rising("market")
  },
  {
    id: "markethall",
    chapter: "Keeping it standing",
    action: "{Tap|Click} the market (the gold arrow over it) and begin its market hall from its panel.",
    why: "Some homes are beyond every food walker. A market hall's walker goes further and more often, without a second market's upkeep.",
    goal: "a market hall stands",
    focus: { kind: "market" },
    when: (f) => f.rank >= 2 && has(f, "market") && f.unreached >= 2,
    done: (f) => f.upgraded.has("market")
  },
  {
    id: "street",
    chapter: "Growing citizens",
    action: "Raise this home's street to desirability 5: add a chapel, a market, or a park nearby, and keep workshops away.",
    why: "It has bread, cloth, and faith, but citizens only live on a decent street. [view:appeal] shows desirability.",
    goal: "a home on a fine street holds citizens",
    asks: ["chapel", "market"],
    focus: "poorStreet",
    when: (f) => f.poorStreet,
    done: (f) => f.finerHomes > 0
  },
  {
    id: "carpenter",
    chapter: "Growing citizens",
    action: "Build a carpenter: it makes furniture from planks.",
    why: "Burghers live in townhouses, and a townhouse wants furniture: two pieces to rise to one, and a fresh piece from the market now and then to stay one. Townhouses pay the most and hold the most people.",
    goal: "a carpenter stands",
    asks: ["carpenter"],
    focus: "hall",
    when: (f) => f.citizens >= 60 && f.finerHomes >= 8,
    done: (f) => has(f, "carpenter"),
    waiting: rising("carpenter")
  },
  {
    id: "healer",
    chapter: "Keeping it standing",
    action: "Build a healer on a road among the homes.",
    why: "Sickness is spreading, and a sick home holds half as many people. The healer's physician calls on homes and cures them. [view:health] shows the risk.",
    goal: "a healer stands",
    asks: ["healer"],
    focus: "hall",
    when: (f) => f.residents >= 30 && (f.sick > 0 || f.risk.health),
    urgent: (f) => f.sick > 0,
    done: (f) => has(f, "healer") || has(f, "hospital"),
    waiting: rising("healer")
  },
  {
    id: "watchhouse",
    chapter: "Keeping it standing",
    action: "Build a watch house on a road among the homes.",
    why: "Poor streets, half-empty homes, and low approval breed thieves. Its constable walks the streets and keeps order. [view:order] shows the risk.",
    goal: "a watch house stands",
    asks: ["watchhouse"],
    focus: "hall",
    when: (f) => f.residents >= 40 && f.risk.order,
    done: (f) => has(f, "watchhouse"),
    waiting: rising("watchhouse")
  },
  {
    id: "trade",
    chapter: "Governing",
    action: "In the [town] panel, under goods and trade, sell a good that piles up, or buy one that runs short.",
    why: "The town trades nothing until you tell it to, and spare goods are coins waiting to be made.",
    goal: "the town sells or buys something",
    focus: null,
    when: (f) => f.residents >= 20 && (f.net < 0 || f.most >= 80),
    done: (f) => f.trading
  },
  {
    id: "taxes",
    chapter: "Governing",
    action: "Raise taxes a little in the [town] panel.",
    why: "The town is content but losing coins, and approval can carry higher taxes. Above 125% leaves a grudge that lasts.",
    goal: "a tax rate is changed",
    focus: null,
    when: (f) => f.approval >= 30 && f.net < 0,
    done: (f) => f.taxed
  },
  {
    id: "smithy",
    chapter: "Governing",
    action: "Build a mine beside the dark, rust-veined rocks, and a smithy.",
    why: "Tools are running low, and every workshop uses them up. The mine digs ore, and the smithy forges it into tools.",
    goal: "a mine and a smithy stand",
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

/** When the town cannot build what a step asks for yet: what opens it, and what to do meanwhile (`null`: it can). */
export const lockedNote = (step: GuideStep, f: GuideFacts): string | null => {
  for (const id of step.asks ?? []) {
    const kind = kinds[id]
    if (kind.unlock.residents > f.residents)
      return `The ${kind.title.toLowerCase()} opens at ${kind.unlock.residents} residents (${f.residents} now): lay more [homes] and keep them fed.`
    if (kind.unlock.citizens > f.citizens) return `The ${kind.title.toLowerCase()} opens at ${kind.unlock.citizens} citizens (${f.citizens} now).`
  }
  // Not yet laid, and the treasury cannot pay for the cheapest of them.
  const unpaid = (step.asks ?? []).filter((id) => !f.placed.has(id)).map((id) => kinds[id])
  const cheapest = unpaid.sort((a, b) => a.cost.coins - b.cost.coins)[0]
  if (cheapest && f.coins < cheapest.cost.coins)
    return `Save up: the ${cheapest.title.toLowerCase()} costs ${cheapest.cost.coins} coins (${f.coins} now). Homes pay taxes every minute.`
  return null
}

/** The next course step that waits for the town to need it: what it is, and when it comes (`null`: none waiting). */
export const upcoming = (f: GuideFacts, done: ReadonlySet<string>): string | null => {
  const step = courseSteps.find((s) => !done.has(s.id) && !s.done(f) && s.when(f) && s.need && !s.need(f) && s.soon)
  return step ? `Next: ${step.soon!(f)}.` : null
}

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
  if (next?.chapter === "Founding") return next
  const shown = guideSteps.find((s) => s.id === pace.shown && !s.course && open(s) && (!s.urgent || s.when(f)))
  if (shown) return shown
  const sign = pace.quiet ? undefined : guideSteps.find((s) => !s.course && open(s) && s.when(f))
  return sign ?? next
}
