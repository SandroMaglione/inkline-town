/**
 * The mayor's guide: a tutorial told through the ticker, one step at a
 * time. Each step says what to build or do next and why, and names the
 * buildings it means so the ticker can turn them into chips that place
 * them. A step shows while it applies (`when`) and is put away for good
 * once the town has done it (`done`), whether or not it was ever shown, so
 * a mayor who already knows the game is not told what they did. The list
 * is in order of priority, not of chapters: a request from the crown with a
 * deadline goes ahead of a chain that takes minutes to build.
 */
import type { Amounts, KindId } from "../content.ts"

/** What the guide reads of the town. */
export interface GuideFacts {
  /** Homes laid, built or not. */
  readonly homes: number
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
  readonly taxed: boolean
  /** The most of any one good in store. */
  readonly most: number
  /** The page: the town panel has been open. */
  readonly sawTown: boolean
}

/** Where a step's "show me where" goes: a place on the land, or a building of a kind. */
export type GuideFocus = "hall" | "water" | "trees" | "stone" | "ore" | "worn" | "poorStreet" | { readonly kind: KindId }

export const chapters = ["Founding", "Keeping it standing", "Growing citizens", "Governing"] as const
export type Chapter = (typeof chapters)[number]

export interface GuideStep {
  readonly id: string
  readonly chapter: Chapter
  /** What to do and why. Building names become chips to place one; a key in brackets, a key. */
  readonly text: string
  readonly focus: GuideFocus | null
  readonly when: (f: GuideFacts) => boolean
  readonly done: (f: GuideFacts) => boolean
}

const has = (f: GuideFacts, ...kinds: ReadonlyArray<KindId>) => kinds.every((k) => f.placed.has(k))

export const guideSteps: ReadonlyArray<GuideStep> = [
  {
    id: "homes",
    chapter: "Founding",
    text: "Drag a row of homes along the road from the town hall (H), or lay more road first (R). Settlers move in on their own, and every home pays taxes.",
    focus: "hall",
    when: () => true,
    done: (f) => f.homes > 0
  },
  {
    id: "fishery",
    chapter: "Founding",
    text: "Settlers eat, and the fish in store will not last. Build a fishery (B) on a road within two cells of water; the town hall's walker carries the fish to the homes.",
    focus: "water",
    when: (f) => f.homes > 0,
    done: (f) => has(f, "fishery") || has(f, "bakery")
  },
  {
    id: "crown",
    chapter: "Governing",
    text: "The crown asks for goods by a deadline. Send them from the bar at the top for coins; an unanswered request is a fine, and three missed in a row and the mayor is dismissed.",
    focus: null,
    when: (f) => f.crown.open,
    done: (f) => f.crown.met > 0
  },
  {
    id: "winter",
    chapter: "Keeping it standing",
    text: "Winter is coming: fishing slows, homes eat faster, and fish rots in store. A granary keeps fish five times as long, and a smokehouse makes fish that keeps all winter.",
    focus: "hall",
    when: (f) => f.residents >= 20 && (f.winter || (f.winterIn !== null && f.winterIn <= 120)),
    done: (f) => has(f, "granary") || has(f, "smokehouse")
  },
  {
    id: "tools",
    chapter: "Growing citizens",
    text: "Tools are scarce until a smithy makes them, and that needs 10 citizens. Keep them for the weaver, the mill, and the bakery (not lamps), or buy them from traders in the town panel (T).",
    focus: null,
    when: (f) => f.residents >= 15 && f.stock.tools <= 3 && !has(f, "weaver", "mill", "bakery"),
    done: (f) => has(f, "weaver", "mill", "bakery") || has(f, "smithy")
  },
  {
    id: "planks",
    chapter: "Founding",
    text: "Every home and building costs planks. A lumberjack by the woods fells wood, and a sawmill saws it into planks.",
    focus: "trees",
    when: (f) => has(f, "fishery") || f.stock.planks < 20,
    done: (f) => has(f, "lumberjack", "sawmill")
  },
  {
    id: "forester",
    chapter: "Founding",
    text: "The woods run out. A forester beside the lumberjack plants new trees for it to fell.",
    focus: { kind: "lumberjack" },
    when: (f) => has(f, "lumberjack"),
    done: (f) => has(f, "forester")
  },
  {
    id: "quarry",
    chapter: "Founding",
    text: "Storage, workshops, and paving take stone, and the town starts with little. A quarry cuts it from the rocks nearby.",
    focus: "stone",
    when: (f) => has(f, "lumberjack", "sawmill") || f.stock.stone < 6,
    done: (f) => has(f, "quarry")
  },
  {
    id: "firewatch",
    chapter: "Keeping it standing",
    text: "Wooden cottages catch fire, and a fire spreads to its neighbours. A fire watch sends a watchman along the streets, and firefighters to any blaze. Press F to see the risk.",
    focus: "hall",
    when: (f) => f.homes >= 8 || f.burning > 0,
    done: (f) => has(f, "firewatch")
  },
  {
    id: "builder",
    chapter: "Keeping it standing",
    text: "Buildings wear out, and a run-down one works at half pace and may fall. A builder's yard mends what its builder passes, with planks and stone. Press C to see their condition.",
    focus: "worn",
    when: (f) => f.worn,
    done: (f) => has(f, "builder")
  },
  {
    id: "market",
    chapter: "Keeping it standing",
    text: "The town hall's walker only reaches 20 road cells. A market sends a walker with fish, bread, and cloth further along the streets.",
    focus: "hall",
    when: (f) => f.residents >= 40 && f.standing.has("fishery"),
    done: (f) => has(f, "market")
  },
  {
    id: "street",
    chapter: "Growing citizens",
    text: "A home here has bread, cloth, and faith, but its street is too poor for citizens: it needs desirability 5. Press D to see it; keep workshops away, and add a chapel, a market, or a park.",
    focus: "poorStreet",
    when: (f) => f.poorStreet,
    done: (f) => f.finerHomes > 0
  },
  {
    id: "cloth",
    chapter: "Growing citizens",
    text: "Settlers become citizens, who pay twice as much, once they have bread, cloth, and faith. Now open: a sheep farm and a weaver make cloth, and a chapel brings faith.",
    focus: "hall",
    when: (f) => f.residents >= 15,
    done: (f) => has(f, "sheep", "weaver", "chapel")
  },
  {
    id: "bread",
    chapter: "Growing citizens",
    text: "Bread is the last of a citizen's needs. Now open: a farm grows wheat, a mill grinds it into flour, and a bakery bakes the bread.",
    focus: "hall",
    when: (f) => f.residents >= 30,
    done: (f) => has(f, "farm", "mill", "bakery")
  },
  {
    id: "goals",
    chapter: "Growing citizens",
    text: "The first citizens have moved in. Open the town panel (T) to see the goals the term is judged by: residents, citizens, approval, and coins.",
    focus: null,
    when: (f) => f.finerHomes > 0,
    done: (f) => f.sawTown
  },
  {
    id: "healer",
    chapter: "Keeping it standing",
    text: "Hunger, crowding, and a quarry's dust make homes sick, and a sick home holds half as many. A healer's physician calls on the homes and cures them. Press A to see the risk.",
    focus: "hall",
    when: (f) => f.residents >= 30 && (f.sick > 0 || f.residents >= 50),
    done: (f) => has(f, "healer") || has(f, "hospital")
  },
  {
    id: "watchhouse",
    chapter: "Keeping it standing",
    text: "Poor streets, half-empty homes, and low approval breed thieves. A watch house sends a constable along the streets to keep order. Press O to see the risk.",
    focus: "hall",
    when: (f) => f.residents >= 40,
    done: (f) => has(f, "watchhouse")
  },
  {
    id: "trade",
    chapter: "Governing",
    text: "The town trades nothing until told to. In the town panel (T), sell what piles up beyond the reserve, and buy what runs short.",
    focus: null,
    when: (f) => f.residents >= 20 && (f.net < 0 || f.most >= 80),
    done: (f) => f.trading
  },
  {
    id: "taxes",
    chapter: "Governing",
    text: "The town is content, and approval can carry higher taxes. Raise them in the town panel (T); above 125% leaves a grudge that lasts.",
    focus: null,
    when: (f) => f.approval >= 30 && f.net < 0,
    done: (f) => f.taxed
  },
  {
    id: "smithy",
    chapter: "Governing",
    text: "Now open: a mine digs ore from a deposit, and a smithy forges it into tools, which every workshop and lamp needs and which wear out.",
    focus: "ore",
    when: (f) => f.citizens >= 10,
    done: (f) => has(f, "mine", "smithy")
  }
]

/** The steps the town has now done that the guide has not yet put away. */
export const guideDone = (f: GuideFacts, done: ReadonlySet<string>): Array<string> =>
  guideSteps.filter((s) => !done.has(s.id) && s.done(f)).map((s) => s.id)

/** The step to show now, if any: the first that applies and is not yet done or put away. */
export const guideStep = (f: GuideFacts, done: ReadonlySet<string>): GuideStep | null =>
  guideSteps.find((s) => !done.has(s.id) && !s.done(f) && s.when(f)) ?? null
