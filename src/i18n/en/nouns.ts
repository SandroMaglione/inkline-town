/**
 * English names for what the town is made of: its buildings and what they
 * become when upgraded, its goods, homes, ranks, lands, winters, and parks.
 * The game's content tables (`game/content`) hold only ids and numbers;
 * every table here is keyed by those ids and checked against them, so a
 * new building, good, or park piece does not compile until it is named.
 *
 * Nouns are kept as English writes them in the middle of a sentence
 * ("town hall"); a heading capitalises one (`title`). The rest of the
 * locale builds its sentences from these, and the page reads only the
 * finished names (`names`, at the end).
 */
import type { GoodId, GroundId, KindId, LandId, Need, PropId, SizeId, Tier, WinterId } from "../../game/content/index.ts"
import type { Place } from "../../game/said.ts"
import { capital, mass, noun, type Noun } from "./grammar.ts"

/** Something built: what it is called, and what it is for, in a line. */
export interface Thing {
  readonly noun: Noun
  readonly blurb: string
}
const thing = (word: Noun, blurb: string): Thing => ({ noun: word, blurb })

/** Each building as it is built, then as each of its upgrades (see `Kind.upgrade`). */
export const kinds = {
  townhall: [
    thing(noun("town hall"), "the heart of the town: storage, taxes, and a walker with provisions"),
    thing(noun("guildhall"), "the town hall with a clock tower: it holds twice as much, sends more carriers, its walker goes further, and it runs the town for a tenth less"),
    thing(noun("city hall"), "a domed seat of the city: it holds the most, sends the most carriers, walks furthest, and runs the city for a fifth less")
  ],
  warehouse: [
    thing(noun("warehouse"), "stores goods nearer where they are made and used"),
    thing(noun("depot"), "a loading yard and a hoist: it holds more than twice as much, and sends two more carriers")
  ],
  granary: [thing(noun("granary", "granaries"), "stores food, and keeps fish and bread five times as long")],
  lumberjack: [thing(noun("lumberjack"), "fells grown trees nearby for wood")],
  forester: [thing(noun("forester"), "plants trees on free ground nearby")],
  quarry: [
    thing(noun("quarry", "quarries"), "cuts stone from rocks nearby"),
    thing(noun("masonry", "masonries"), "a derrick and a mason's shed: it goes on cutting worked-out rock at full pace, not a third of it; a dustier neighbour")
  ],
  mine: [thing(noun("mine"), "digs ore from a deposit nearby")],
  fishery: [thing(noun("fishery", "fisheries"), "catches fish; needs its own stretch of water within two cells")],
  smokehouse: [thing(noun("smokehouse"), "smokes fish, which then keeps all winter")],
  sawmill: [thing(noun("sawmill"), "saws wood into planks")],
  smithy: [thing(noun("smithy", "smithies"), "forges ore into tools")],
  farm: [
    thing(noun("farm"), "sows fields around it and harvests the wheat"),
    thing(noun("estate"), "a barn and a dovecote: a third hand reaps the same fields half again as fast")
  ],
  mill: [thing(noun("mill"), "grinds wheat into flour")],
  bakery: [
    thing(noun("bakery", "bakeries"), "bakes flour into bread"),
    thing(mass("ovenworks"), "a second oven and a third baker: bread every four seconds instead of six")
  ],
  sheep: [thing(noun("sheep farm"), "shears sheep for wool")],
  weaver: [thing(noun("weaver"), "weaves wool into cloth")],
  carpenter: [thing(noun("carpenter"), "makes furniture from planks, for the burghers' townhouses")],
  market: [
    thing(noun("market"), "a walker carries fish, bread, cloth, and furniture to the homes it passes"),
    thing(noun("market hall"), "a covered hall: its walker goes further, more often, and the street around it is finer")
  ],
  chapel: [
    thing(noun("chapel"), "a walker brings faith to the homes it passes"),
    thing(noun("church", "churches"), "a church with a tower: its priest walks further, more often, and the streets around it are the finest")
  ],
  firewatch: [
    thing(noun("fire watch", "fire watches"), "a watchman checks homes and workshops along the way for fire; firefighters run to any blaze"),
    thing(noun("fire brigade"), "a bell tower and a pump: its watchman walks further, more often, and four firefighters run instead of two")
  ],
  healer: [thing(noun("healer"), "a physician calls on the homes along the way and cures the sick")],
  hospital: [thing(noun("hospital"), "physicians call more often and walk further")],
  watchhouse: [thing(noun("watch house"), "a constable walks the streets, keeping order in the homes along the way")],
  builder: [thing(noun("builder's yard"), "a builder mends the homes and buildings along the way, with planks and stone")]
} satisfies Record<KindId, readonly [Thing, ...ReadonlyArray<Thing>]>

/** A building at its level of upgrades (0: as built). A level it has no name for reads as the last it has. */
export const built = (id: KindId, level = 0): Thing => {
  const levels: readonly [Thing, ...ReadonlyArray<Thing>] = kinds[id]
  return levels[Math.max(0, Math.min(level, levels.length - 1))] ?? levels[0]
}

/** A good: the ware as the town speaks of it ("planks"), and as it is counted ("1 plank"). */
export const goods = {
  wood: mass("wood"),
  planks: noun("plank"),
  stone: mass("stone"),
  ore: mass("ore"),
  tools: noun("tool"),
  fish: mass("fish"),
  smoked: mass("smoked fish"),
  wheat: mass("wheat"),
  flour: mass("flour"),
  bread: mass("bread"),
  wool: mass("wool"),
  cloth: mass("cloth"),
  furniture: mass("furniture")
} satisfies Record<GoodId, Noun>

/** A tier of homes: who lives there, and what the home is called. */
export const tiers = {
  1: { people: "settlers", home: noun("settlers' cottage") },
  2: { people: "citizens", home: noun("citizens' home") },
  3: { people: "burghers", home: noun("townhouse") }
} satisfies Record<Tier, { readonly people: string; readonly home: Noun }>

/** The town's ranks, lowest first (see `ranks` in the content). */
export const ranks = [noun("hamlet"), noun("village"), noun("town"), noun("city", "cities")] as const

export const sizes = { small: "small", medium: "medium", large: "large" } satisfies Record<SizeId, string>
export const lands = {
  rich: { name: "rich", blurb: "deep forests, plenty of stone and ore, two lakes, a full treasury" },
  fair: { name: "fair", blurb: "enough of everything, if it is not wasted" },
  harsh: { name: "harsh", blurb: "thin woods, little stone, one deposit of ore, one lake" }
} satisfies Record<LandId, { readonly name: string; readonly blurb: string }>
export const winters = { mild: "mild", normal: "normal", hard: "hard" } satisfies Record<WinterId, string>

export const grounds = {
  lawn: thing(noun("lawn"), "grass to lay a park out on"),
  flowers: thing(noun("flower bed"), "planted borders: prettier than lawn"),
  path: thing(noun("gravel path"), "a walk through the park"),
  square: thing(noun("paved square"), "stone setts, for a statue or a fountain to stand on")
} satisfies Record<GroundId, Thing>
export const props = {
  lamp: thing(noun("lamp"), "an iron lamp post along the walk"),
  fountain: thing(noun("fountain"), "a stone basin of fresh water"),
  statue: thing(noun("statue"), "a founder in stone, the pride of the park")
} satisfies Record<PropId, Thing>

export const needs = { food: "food", bread: "bread", cloth: "cloth", faith: "faith", furniture: "furniture" } satisfies Record<Need, string>

/** What a landmark lends its streets' names: "Mill" Lane, "Baker" Street. */
const streets = {
  townhall: "Hall", warehouse: "Warehouse", granary: "Granary", lumberjack: "Timber", forester: "Forest", quarry: "Quarry",
  mine: "Mine", fishery: "Fisher", smokehouse: "Smokehouse", sawmill: "Sawmill", smithy: "Smithy", farm: "Farm", mill: "Mill",
  bakery: "Baker", sheep: "Shepherd", weaver: "Weaver", market: "Market", chapel: "Chapel", firewatch: "Watch", healer: "Healer",
  hospital: "Hospital", watchhouse: "Constable", builder: "Builder", carpenter: "Joiner"
} satisfies Record<KindId, string>
/** The ways a street is called: as many as `STREET_WAYS`. */
const ways = ["Lane", "Street", "Row", "Way", "Close", "Walk"] as const

/** Where something happened: "Mill Lane", "Hall Square", or "the edge of town". */
export const place = (where: Place): string =>
  where === null ? "the edge of town" : `${streets[where.kind]} ${where.kind === "townhall" ? "Square" : ways[where.way % ways.length]}`

/**
 * The finished names, as the page reads them: a heading (`title`), the
 * word in a sentence (`name`), and what it is for (`blurb`). A sentence
 * that needs an article or a plural is the locale's to write, not the
 * page's to put together.
 */
export const names = {
  kind: {
    /** "Market hall": a building at its level of upgrades, as a heading. */
    title: (id: KindId, level = 0): string => capital(built(id, level).noun.one),
    /** "market hall": as a sentence names it. */
    name: (id: KindId, level = 0): string => built(id, level).noun.one,
    blurb: (id: KindId, level = 0): string => built(id, level).blurb
  },
  good: {
    /** "planks", "smoked fish": the ware. */
    name: (id: GoodId): string => goods[id].other
  },
  tier: {
    /** "settlers", "citizens", "burghers". */
    people: (tier: Tier): string => tiers[tier].people,
    /** "settlers' cottage", "citizens' home", "townhouse". */
    home: (tier: Tier): string => tiers[tier].home.one
  },
  /** "hamlet", "village", "town", "city": a rank past the last reads as the last. */
  rank: (rank: number): string => (ranks[Math.max(0, Math.min(rank, ranks.length - 1))] ?? ranks[0]).one,
  size: (id: SizeId): string => sizes[id],
  land: { name: (id: LandId): string => lands[id].name, blurb: (id: LandId): string => lands[id].blurb },
  winter: (id: WinterId): string => winters[id],
  ground: { title: (id: GroundId): string => capital(grounds[id].noun.one), name: (id: GroundId): string => grounds[id].noun.one, blurb: (id: GroundId): string => grounds[id].blurb },
  prop: { title: (id: PropId): string => capital(props[id].noun.one), name: (id: PropId): string => props[id].noun.one, blurb: (id: PropId): string => props[id].blurb },
  need: (need: Need): string => needs[need],
  place
}
