/**
 * English for the mayor's guide (`game/rules/guide.ts`): what each step
 * asks for, why, and what closes it; and what the guide says of the town as
 * it stands (what is under way, what opens a building, what comes next).
 * The rules hold the guide's order and its conditions and say the rest as
 * data; every word of it is here.
 *
 * The texts are written for someone who has never played a town-builder,
 * and once for mouse and touch. A step is one thing to do (`action`, one
 * sentence, short enough for a phone's peek), one reason for it (`why`, a
 * sentence or two), and what puts it away (`goal`, a few words that read
 * after "done when"). In them:
 * - a building is named with `k`, and a good with `g`, so it shows as a
 *   chip: a building the step asks for (`asks`, in the rules) as one that
 *   starts placing it, one that already stands near as one that goes to it;
 * - a tool, a panel, the clock, or a map view is named with `tool` or `map`
 *   (`[homes]`, `[town]`, `[view:fire]`), a chip that picks it and, on a
 *   keyboard, carries its key: a text never names a key itself;
 * - what a finger does and what a mouse does are said with `token.device`
 *   ("tap" on a touch screen, "click" with a mouse).
 * Amounts stay words here ("200 coins"): the guide's card is read, not
 * scanned for numbers.
 */
import type { GoodId, KindId } from "../../game/content/index.ts"
import type { Chapter, GuideLocked, GuideSoon, GuideStepId, GuideWaiting } from "../../game/rules/guide.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"

/** A building, as a chip: by its plain name, or by the word the sentence needs ("market hall", for the market's). */
const k = (id: KindId, shown?: string) => token.kind(id, shown)
/** A good, as a chip: by its plain name, or as the sentence writes it ("Stone", at its start). */
const g = (id: GoodId, shown?: string) => token.good(id, shown)
const tool = token.command
const map = token.view
const tap = token.device("tap", "click")
const Tap = token.device("Tap", "Click")

/** A step in words: what to do, why, and when it is done. */
interface Step {
  readonly action: string
  readonly why: string
  readonly goal: string
}

const chapters = {
  founding: "Founding",
  standing: "Keeping it standing",
  citizens: "Growing citizens",
  governing: "Governing"
} satisfies Record<Chapter, string>

const steps = {
  // ── The opening, in order ──
  homes: {
    action: `Pick ${tool("homes")} and drag along the grey road around the town hall${token.device(", then tap Build", "")}.`,
    why: "Settlers move into homes that touch a road, and every home pays taxes: the town's income.",
    goal: "a home stands"
  },
  road: {
    action: `Pick ${tool("road")} and drag a road from the town hall's road towards the water.`,
    why: `Every building needs a road touching the middle of one of its sides, or nobody can reach it. The ${k("fishery")} comes next, and it needs water nearby.`,
    goal: "a road comes within two cells of water"
  },
  fishery: {
    action: `${Tap} ${k("fishery")}, then place it on that road, with water no more than two cells away.`,
    why: `Settlers eat ${g("fish")}. The town starts with a little, and ${g("fish")} rots in store.`,
    goal: `a ${k("fishery")} stands`
  },
  look: {
    action: `Pick ${tool("select")} and ${tap} the ${k("fishery")} to open its panel.`,
    why: "A building needs workers from homes within 15 road cells; its panel says how many it has, and what holds it back. The jobs counter at the top adds them all up.",
    goal: "you open a building's panel"
  },
  lumberjack: {
    action: `Build a ${k("lumberjack")} on a road beside the trees.`,
    why: `${g("planks", "Planks")} are running low, and every home and building costs some. ${g("wood", "Wood")} is where ${g("planks")} start.`,
    goal: `a ${k("lumberjack")} stands`
  },
  sawmill: {
    action: `Build a ${k("sawmill")} on a road near the ${k("lumberjack")}.`,
    why: `Goods come in chains: the ${k("lumberjack")} fells ${g("wood")}, and the ${k("sawmill")} saws it into ${g("planks")}. Carriers walk the goods between them along the roads.`,
    goal: `a ${k("sawmill")} stands`
  },
  term: {
    action: `Open the ${tool("town")} panel and read the goals at its top.`,
    why: `Meeting them raises the town from hamlet to village, town, and city, each with a reward from the crown. ${tool("pause")} stops the clock whenever you need to think.`,
    goal: "you open the town panel"
  },
  grow: {
    action: "Lay more roads and homes until ten homes stand.",
    why: `More people pay more taxes, and unlock new buildings in ${tool("build")}. The guide asks for a building only once the town needs it.`,
    goal: "10 homes stand"
  },

  // ── The course goes on: citizens ──
  quarry: {
    action: `Build a ${k("quarry")} on a road beside the pale rocks.`,
    why: `${g("stone", "Stone")} is running low, and the workshops citizens need cost some. The dark rocks are ${g("ore")}, for later.`,
    goal: `a ${k("quarry")} stands`
  },
  cloth: {
    action: `Build a ${k("sheep")} and a ${k("weaver")}, on roads near each other.`,
    why: `A home becomes a citizens' home with ${g("bread")}, ${g("cloth")}, and faith. The ${k("sheep")} shears ${g("wool")}, and the ${k("weaver")} weaves it into ${g("cloth")}.`,
    goal: `a ${k("sheep")} and a ${k("weaver")} stand`
  },
  chapel: {
    action: `Build a ${k("chapel")} on a road among the homes.`,
    why: `Faith is the second need. The ${k("chapel")}'s walker brings it to the homes it passes, and the ${k("chapel")} makes its street nicer to live on.`,
    goal: `a ${k("chapel")} stands`
  },
  wheat: {
    action: `Build a ${k("farm")} and a ${k("mill")}.`,
    why: `${g("bread", "Bread")} is the third need, and the longest chain: the ${k("farm")} grows ${g("wheat")}, and the ${k("mill")} grinds it into ${g("flour")}.`,
    goal: `a ${k("farm")} and a ${k("mill")} stand`
  },
  bakery: {
    action: `Build a ${k("bakery")} near the ${k("mill")}.`,
    why: `It bakes the ${k("mill")}'s ${g("flour")} into ${g("bread")}. Even a settlers' cottage with ${g("bread")} on the table pays half again.`,
    goal: `a ${k("bakery")} stands`
  },
  citizens: {
    action: `Pick ${tool("select")} and ${tap} a home to see what it still lacks to hold citizens.`,
    why: `With ${g("bread")}, ${g("cloth")}, faith, and a street of desirability 5, a home rises once the store pays its ${g("planks")} and ${g("stone")}. Its panel lists what is missing.`,
    goal: "the first home holds citizens"
  },
  goals: {
    action: `Open the ${tool("town")} panel to see how close the goals are.`,
    why: "The first citizens have moved in, and each rank asks for a bigger share of them.",
    goal: "you open the town panel"
  },
  ranks: {
    action: `Meet every goal in the ${tool("town")} panel to raise the town's rank.`,
    why: `Hold them for two minutes and the town rises, up to a city. The town rank opens upgrades for the ${k("market")} and the ${k("chapel")}. The guide speaks up when something needs you.`,
    goal: "the town is a city"
  },

  // ── Around the course, when the town needs them ──
  crown: {
    action: "Send the crown what it asks for, with the send button on its request at the top.",
    why: "It pays coins. An unanswered request is a fine, and three missed in a row end your term.",
    goal: "the goods are sent"
  },
  winter: {
    action: `Build a ${k("granary")} or a ${k("smokehouse")} before winter comes.`,
    why: `In winter fishing slows, homes eat more, and ${g("fish")} rots in store. A ${k("granary")} keeps it five times as long, and ${g("smoked")} keeps all winter.`,
    goal: `a ${k("granary")} or a ${k("smokehouse")} stands`
  },
  tools: {
    action: `In the ${tool("town")} panel, under goods and trade, set ${g("tools")} to buy.`,
    why: `Workshops use up ${g("tools")}, and only a ${k("smithy")} makes new ones, which opens at 10 citizens.`,
    goal: `the town buys ${g("tools")}, or a ${k("smithy")} stands`
  },
  forester: {
    action: `Build a ${k("forester")} next to the ${k("lumberjack")}.`,
    why: `The ${k("lumberjack")} is running out of trees, and a ${k("forester")} plants new ones for it.`,
    goal: `a ${k("forester")} stands`
  },
  firewatch: {
    action: `Build a ${k("firewatch")} on a road among the homes.`,
    why: `Wooden cottages catch fire, and a fire spreads to the neighbours. Its watchman keeps the risk down, and its firefighters put fires out. ${map("fire")} shows the risk.`,
    goal: `a ${k("firewatch")} stands`
  },
  builder: {
    action: `Build a ${k("builder")} near the worn buildings.`,
    why: `A run-down building works at half pace and can fall down. Its builder mends what it passes, with ${g("planks")} and ${g("stone")}. ${map("condition")} shows their state.`,
    goal: `a ${k("builder")} stands`
  },
  market: {
    action: `Build a ${k("market")} among the homes furthest from the town hall.`,
    why: `Some homes are beyond the town hall's walker, which only reaches 20 road cells, and get no food. A ${k("market")}'s walker carries it further.`,
    goal: `a ${k("market")} stands`
  },
  markethall: {
    action: `${Tap} the ${k("market")} (the gold arrow over it) and begin its ${k("market", "market hall")} from its panel.`,
    why: `Some homes are beyond every food walker. A ${k("market", "market hall")}'s walker goes further and more often, without a second ${k("market")}'s upkeep.`,
    goal: `a ${k("market", "market hall")} stands`
  },
  street: {
    action: `Raise this home's street to desirability 5: add a ${k("chapel")}, a ${k("market")}, or a park nearby, and keep workshops away.`,
    why: `It has ${g("bread")}, ${g("cloth")}, and faith, but citizens only live on a decent street. ${map("appeal")} shows desirability.`,
    goal: "a home on a fine street holds citizens"
  },
  carpenter: {
    action: `Build a ${k("carpenter")}: it makes ${g("furniture")} from ${g("planks")}.`,
    why: `Burghers live in townhouses, and a townhouse wants ${g("furniture")}: two pieces to rise to one, and a fresh piece from the ${k("market")} now and then to stay one. Townhouses pay the most and hold the most people.`,
    goal: `a ${k("carpenter")} stands`
  },
  healer: {
    action: `Build a ${k("healer")} on a road among the homes.`,
    why: `Sickness is spreading, and a sick home holds half as many people. The ${k("healer")}'s physician calls on homes and cures them. ${map("health")} shows the risk.`,
    goal: `a ${k("healer")} stands`
  },
  watchhouse: {
    action: `Build a ${k("watchhouse")} on a road among the homes.`,
    why: `Poor streets, half-empty homes, and low approval breed thieves. Its constable walks the streets and keeps order. ${map("order")} shows the risk.`,
    goal: `a ${k("watchhouse")} stands`
  },
  trade: {
    action: `In the ${tool("town")} panel, under goods and trade, sell a good that piles up, or buy one that runs short.`,
    why: "The town trades nothing until you tell it to, and spare goods are coins waiting to be made.",
    goal: "the town sells or buys something"
  },
  taxes: {
    action: `Raise taxes a little in the ${tool("town")} panel.`,
    why: "The town is content but losing coins, and approval can carry higher taxes. Above 125% leaves a grudge that lasts.",
    goal: "a tax rate is changed"
  },
  smithy: {
    action: `Build a ${k("mine")} beside the dark, rust-veined rocks, and a ${k("smithy")}.`,
    why: `${g("tools", "Tools")} are running low, and every workshop uses them up. The ${k("mine")} digs ${g("ore")}, and the ${k("smithy")} forges it into ${g("tools")}.`,
    goal: `a ${k("mine")} and a ${k("smithy")} stand`
  }
} satisfies Record<GuideStepId, Step>

/** What is happening, once the mayor has done a step's part and the town is at work on it. */
const waiting = {
  homesNoPlanks: () => `The homes wait for ${g("planks")}, and the store has none.`,
  homesRising: () => `Builders are carrying ${g("planks")} from the store to the new homes, and settlers move in once one stands. ${tool("speed")} makes time run faster.`,
  siteNoPlanks: () => `The store has no ${g("planks")} left, so the site waits: sell something in the ${tool("town")} panel, or buy ${g("planks")} there.`,
  siteRising: () => `It is a building site for now: carriers bring its ${g("planks")} and ${g("stone")} from the store, then builders put it up. ${tool("speed")} makes time run faster.`,
  homesLaid: () => "Ten homes are laid: builders are putting them up."
} satisfies Wording<GuideWaiting>

/** Why the town cannot build what a step asks for yet, and what to do meanwhile. */
const locked = {
  residents: (l) => `The ${k(l.kind)} opens at ${l.needs} residents (${l.now} now): lay more ${tool("homes")} and keep them fed.`,
  citizens: (l) => `The ${k(l.kind)} opens at ${l.needs} citizens (${l.now} now).`,
  coins: (l) => `Save up: the ${k(l.kind)} costs ${l.cost} coins (${l.now} now). Homes pay taxes every minute.`
} satisfies Wording<GuideLocked>

/** The next step that waits for the town to need it: what it will ask for, and when it comes. */
const upcoming = {
  lumberjack: (s) => `Next: a ${k("lumberjack")} and a ${k("sawmill")}, once ${g("planks")} fall below ${s.below} (${s.now} now).`,
  sawmill: (s) => `Next: a ${k("sawmill")}, once ${g("planks")} fall below ${s.below} (${s.now} now).`,
  quarry: (s) => `Next: a ${k("quarry")}, once ${g("stone")} falls below ${s.below} (${s.now} now).`
} satisfies Wording<GuideSoon>

export const guide = { chapters, steps, waiting, locked, upcoming }
