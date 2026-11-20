/**
 * German names for what the town is made of: its buildings and what they
 * become when upgraded, its goods, homes, ranks, lands, winters, and parks.
 * Every table is keyed by the game's ids and checked against them, as
 * English's are.
 *
 * Each noun carries its gender, its plural, and the forms its cases need
 * (`grammar.ts`), and is written as German writes a noun: capitalised,
 * wherever it stands. Every name is one word, a compound where English has
 * two ("Markthalle", "Spritzenhaus", "Pflasterplatz"), so no adjective in
 * a name has to agree with the case a sentence puts it in.
 *
 * Buildings are named as places, never by the trade, so that one can burn
 * or fall down in a sentence ("die Holzfällerhütte", "die Försterei", not
 * "der Holzfäller"): "Sägewerk", "Weberei", "Schmiede", and their upgrades
 * as places a little grander: "Rathaus", "Gildenhaus",
 * "Stadtpalast"; "Lagerhaus", "Packhof"; "Feuerwache", "Spritzenhaus" (a
 * pump house with a bell tower). The people who walk from them have names
 * of their own, older than a fire brigade's: a "Brandwächter" from the fire
 * watch, a "Bader" (the barber-surgeon) from the "Baderstube", a "Büttel"
 * from the "Wachhaus", a "Maurer" from the "Bauhof"; a market or a chapel
 * sends a "Läufer". The settlement itself is "der Ort" in a sentence,
 * whatever its rank, so "der Ort ist jetzt eine Stadt" says what it means;
 * its ranks are "Weiler", "Dorf", "Städtchen", "Stadt". Its people are
 * "Siedler", "Bürger", and "Patrizier", in a "Siedlerhütte", a
 * "Bürgerhaus", and a "Patrizierhaus". Its coins are "Taler".
 *
 * A street is named after its landmark in one word, the way German towns
 * name theirs: "Mühlengasse", "Bäckerstraße", "Webergasse", "Spitalweg",
 * the hall's "Rathausplatz". Each way of naming one has its gender, and so
 * the preposition a sentence puts it after ("in der Mühlengasse", "im
 * Mühlenweg", "am Mühlensteig", "auf dem Rathausplatz").
 */
import type { GoodId, GroundId, KindId, LandId, Need, PropId, SizeId, Tier, WinterId } from "../../game/content/index.ts"
import type { Place } from "../../game/said.ts"
import { a, capital, f, m, n, the, type Noun } from "./grammar.ts"

/** Something built: what it is called, and what it is for, in a line. */
export interface Thing {
  readonly noun: Noun
  readonly blurb: string
}
const thing = (word: Noun, blurb: string): Thing => ({ noun: word, blurb })

/** A tier of homes: who lives there (a plural noun), and what the home is called. */
export const tiers = {
  1: { people: m("Siedler", "Siedler"), home: f("Siedlerhütte", "Siedlerhütten") },
  2: { people: m("Bürger", "Bürger"), home: n("Bürgerhaus", "Bürgerhäuser") },
  3: { people: m("Patrizier", "Patrizier"), home: n("Patrizierhaus", "Patrizierhäuser") }
} satisfies Record<Tier, { readonly people: Noun; readonly home: Noun }>

const hall = n("Rathaus", "Rathäuser")

/** Each building as it is built, then as each of its upgrades (see `Kind.upgrade`). */
export const kinds = {
  townhall: [
    thing(hall, "das Herz des Ortes: Lager, Steuern und ein Läufer mit Vorräten"),
    thing(n("Gildenhaus", "Gildenhäuser"), `${a(hall)} mit Uhrturm: fasst doppelt so viel, schickt mehr Träger, sein Läufer geht weiter, und es verwaltet den Ort um ein Zehntel billiger`),
    thing(m("Stadtpalast", "Stadtpaläste", "Stadtpalastes"), "ein Kuppelbau für die Stadt: fasst am meisten, schickt die meisten Träger, sein Läufer geht am weitesten, und er verwaltet den Ort um ein Fünftel billiger")
  ],
  warehouse: [
    thing(n("Lagerhaus", "Lagerhäuser"), "lagert Waren näher dort, wo sie entstehen und gebraucht werden"),
    thing(m("Packhof", "Packhöfe"), "ein Ladehof mit Kran: fasst mehr als doppelt so viel und schickt zwei Träger mehr")
  ],
  granary: [thing(m("Kornspeicher", "Kornspeicher"), "lagert Nahrung und hält Fisch und Brot fünfmal so lange frisch")],
  lumberjack: [thing(f("Holzfällerhütte", "Holzfällerhütten"), "fällt ausgewachsene Bäume in der Nähe für Holz")],
  forester: [thing(f("Försterei", "Förstereien"), "pflanzt Bäume auf freiem Boden in der Nähe")],
  quarry: [
    thing(m("Steinbruch", "Steinbrüche"), "bricht Steine aus den Felsen in der Nähe"),
    thing(f("Steinhauerei", "Steinhauereien"), "ein Ladebaum und eine Steinmetzhütte: bricht abgebauten Fels weiter in vollem Tempo, nicht zu einem Drittel; ein staubigerer Nachbar")
  ],
  mine: [thing(n("Bergwerk", "Bergwerke"), "fördert Erz aus einem Vorkommen in der Nähe")],
  fishery: [thing(f("Fischerei", "Fischereien"), "fängt Fisch; braucht ein eigenes Stück Wasser im Umkreis von zwei Feldern")],
  smokehouse: [thing(f("Räucherei", "Räuchereien"), "räuchert Fisch, der sich dann den ganzen Winter hält")],
  sawmill: [thing(n("Sägewerk", "Sägewerke"), "sägt Holz zu Brettern")],
  smithy: [thing(f("Schmiede", "Schmieden"), "schmiedet Erz zu Werkzeug")],
  farm: [
    thing(m("Bauernhof", "Bauernhöfe"), "bestellt die Äcker ringsum und erntet den Weizen"),
    thing(m("Gutshof", "Gutshöfe"), "eine Scheune und ein Taubenschlag: eine dritte Hand erntet dieselben Äcker anderthalbmal so schnell")
  ],
  mill: [thing(f("Mühle", "Mühlen"), "mahlt Weizen zu Mehl")],
  bakery: [
    thing(f("Bäckerei", "Bäckereien"), "backt Mehl zu Brot"),
    thing(f("Großbäckerei", "Großbäckereien"), "ein zweiter Ofen und ein dritter Bäcker: Brot alle vier Sekunden statt alle sechs")
  ],
  sheep: [thing(f("Schäferei", "Schäfereien"), "schert Schafe für Wolle")],
  weaver: [thing(f("Weberei", "Webereien"), "webt Wolle zu Tuch")],
  carpenter: [thing(f("Tischlerei", "Tischlereien"), `baut Möbel aus Brettern, für ${the(tiers[3].home, "acc", true)}`)],
  market: [
    thing(m("Markt", "Märkte", "Marktes"), "ein Läufer bringt Fisch, Brot, Tuch und Möbel zu den Häusern, an denen er vorbeikommt"),
    thing(f("Markthalle", "Markthallen"), "eine überdachte Halle: Ihr Läufer geht weiter und öfter, und die Straße ringsum wird feiner")
  ],
  chapel: [
    thing(f("Kapelle", "Kapellen"), "ein Läufer bringt den Glauben zu den Häusern, an denen er vorbeikommt"),
    thing(f("Kirche", "Kirchen"), "eine Kirche mit Turm: Ihr Priester geht weiter und öfter, und die Straßen ringsum werden die feinsten")
  ],
  firewatch: [
    thing(f("Feuerwache", "Feuerwachen"), "ein Brandwächter prüft Häuser und Werkstätten am Weg auf Feuer; Feuerwehrleute eilen zu jedem Brand"),
    thing(n("Spritzenhaus", "Spritzenhäuser"), "ein Glockenturm und eine Spritze: Sein Brandwächter geht weiter und öfter, und vier Feuerwehrleute rücken aus statt zwei")
  ],
  healer: [thing(f("Baderstube", "Baderstuben"), "ein Bader besucht die Häuser am Weg und heilt die Kranken")],
  hospital: [thing(n("Spital", "Spitäler"), "die Ärzte kommen öfter und gehen weiter")],
  watchhouse: [thing(n("Wachhaus", "Wachhäuser"), "ein Büttel geht durch die Straßen und hält in den Häusern am Weg Ordnung")],
  builder: [thing(m("Bauhof", "Bauhöfe"), "ein Maurer bessert Häuser und Gebäude am Weg aus, mit Brettern und Steinen")]
} satisfies Record<KindId, readonly [Thing, ...ReadonlyArray<Thing>]>

/** A building at its level of upgrades (0: as built). A level it has no name for reads as the last it has. */
export const built = (id: KindId, level = 0): Thing => {
  const levels: readonly [Thing, ...ReadonlyArray<Thing>] = kinds[id]
  return levels[Math.max(0, Math.min(level, levels.length - 1))] ?? levels[0]
}

/**
 * A good: the ware as the town speaks of it (`name`), which is its plural
 * where the ware comes in pieces ("Bretter", "Steine", "Möbel", `many`)
 * and its singular where it is a stuff ("Holz", "Mehl", "Fisch"); and how
 * a number of it is said (`unit`: "1 Brett", "3 Bretter", "5 Holz").
 */
export interface Good extends Noun {
  readonly name: string
  readonly many: boolean
  readonly unit: { readonly one: string; readonly other: string }
}
const pieces = (word: Noun, unit = { one: word.one, other: word.other }): Good => ({ ...word, name: word.other, many: true, unit })
const stuff = (word: Noun, unit = { one: word.one, other: word.one }): Good => ({ ...word, name: word.one, many: false, unit })

export const goods = {
  wood: stuff(n("Holz", "Hölzer")),
  planks: pieces(n("Brett", "Bretter")),
  stone: pieces(m("Stein", "Steine")),
  ore: stuff(n("Erz", "Erze")),
  tools: stuff(n("Werkzeug", "Werkzeuge"), { one: "Werkzeug", other: "Werkzeuge" }),
  fish: stuff(m("Fisch", "Fische"), { one: "Fisch", other: "Fische" }),
  smoked: stuff(m("Räucherfisch", "Räucherfische"), { one: "Räucherfisch", other: "Räucherfische" }),
  wheat: stuff(m("Weizen", "Weizen")),
  flour: stuff(n("Mehl", "Mehle")),
  bread: stuff(n("Brot", "Brote"), { one: "Brot", other: "Brote" }),
  wool: stuff(f("Wolle", "Wollen")),
  cloth: stuff(n("Tuch", "Tuche")),
  furniture: pieces(n("Möbel", "Möbel"), { one: "Möbelstück", other: "Möbel" })
} satisfies Record<GoodId, Good>

/** So many of a good, in words: "1 Brett", "3 Bretter", "5 Holz"; in the dative, a counted plural takes its -n ("aus 3 Brettern"). */
export const quantity = (id: GoodId, count: number, dative = false): string => {
  const good: Good = goods[id]
  if (count === 1 || good.unit.one === good.unit.other) return `${count} ${count === 1 ? good.unit.one : good.unit.other}`
  return `${count} ${dative && !/[ns]$/.test(good.unit.other) ? `${good.unit.other}n` : good.unit.other}`
}

/** The town's ranks, lowest first (see `ranks` in the content). */
export const ranks = [m("Weiler", "Weiler"), n("Dorf", "Dörfer"), n("Städtchen", "Städtchen"), f("Stadt", "Städte")] as const
/** A rank's noun: one past the last reads as the last. */
export const rankNoun = (rank: number): Noun => ranks[Math.max(0, Math.min(rank, ranks.length - 1))] ?? ranks[0]

/**
 * An adjective of the land or the winter: the word a choice is labelled
 * with, and the stem a sentence gives its ending to ("auf kleinem Land",
 * "ein harter Winter"). A medium land is "mittel" on its own and
 * "mittelgroß" in a sentence: "mittel" takes no ending.
 */
export interface Adjective {
  readonly name: string
  readonly stem: string
}
const adjective = (name: string, stem = name): Adjective => ({ name, stem })

export const sizes = { small: adjective("klein"), medium: adjective("mittel", "mittelgroß"), large: adjective("groß") } satisfies Record<SizeId, Adjective>
export const lands = {
  rich: { ...adjective("reich"), blurb: "dichte Wälder, viel Stein und Erz, zwei Seen, eine volle Kasse" },
  fair: { ...adjective("ordentlich"), blurb: "genug von allem, wenn nichts verschwendet wird" },
  harsh: { ...adjective("karg"), blurb: "lichte Wälder, wenig Stein, ein einziges Erzvorkommen, ein einziger See" }
} satisfies Record<LandId, Adjective & { readonly blurb: string }>
/** The land a town is founded on: "Land" (neuter), which its adjectives agree with. */
export const land = n("Land", "Länder")
export const winters = { mild: adjective("mild"), normal: adjective("normal"), hard: adjective("hart") } satisfies Record<WinterId, Adjective>
/** "Winter", which a winter's adjective agrees with. */
export const winter = m("Winter", "Winter")

export const grounds = {
  lawn: thing(m("Rasen", "Rasen"), "Gras, auf dem sich ein Park anlegen lässt"),
  flowers: thing(n("Blumenbeet", "Blumenbeete"), "bepflanzte Rabatten: hübscher als Rasen"),
  path: thing(m("Kiesweg", "Kieswege"), "ein Spazierweg durch den Park"),
  square: thing(m("Pflasterplatz", "Pflasterplätze"), "Pflastersteine, auf denen eine Statue oder ein Brunnen stehen kann")
} satisfies Record<GroundId, Thing>
export const props = {
  lamp: thing(f("Laterne", "Laternen"), "ein eiserner Laternenpfahl am Weg"),
  fountain: thing(m("Brunnen", "Brunnen"), "ein Steinbecken mit frischem Wasser"),
  statue: thing(f("Statue", "Statuen"), "ein Gründer aus Stein, der Stolz des Parks")
} satisfies Record<PropId, Thing>

export const needs = { food: "Nahrung", bread: "Brot", cloth: "Tuch", faith: "Glaube", furniture: "Möbel" } satisfies Record<Need, string>

/** What a landmark lends its streets' names, as the first part of one word: "Mühlen"-gasse, "Bäcker"-straße. */
const streets = {
  townhall: "Rathaus", warehouse: "Lager", granary: "Speicher", lumberjack: "Holz", forester: "Forst", quarry: "Steinbruch",
  mine: "Gruben", fishery: "Fischer", smokehouse: "Räucher", sawmill: "Säger", smithy: "Schmiede", farm: "Bauern", mill: "Mühlen",
  bakery: "Bäcker", sheep: "Schäfer", weaver: "Weber", market: "Markt", chapel: "Kapellen", firewatch: "Brand", healer: "Bader",
  hospital: "Spital", watchhouse: "Büttel", builder: "Maurer", carpenter: "Tischler"
} satisfies Record<KindId, string>
/** A way of naming a street: the word that ends its name, and where a sentence puts something on it ("in der", "im", "am"). */
interface Way {
  readonly end: string
  readonly at: string
}
/** The ways a street is called: as many as `STREET_WAYS`. */
const ways: ReadonlyArray<Way> = [
  { end: "Gasse", at: "in der" },
  { end: "Straße", at: "in der" },
  { end: "Zeile", at: "in der" },
  { end: "Weg", at: "im" },
  { end: "Winkel", at: "im" },
  { end: "Steig", at: "am" }
]
const square: Way = { end: "Platz", at: "auf dem" }
const way = (where: NonNullable<Place>): Way => (where.kind === "townhall" ? square : (ways[where.way % ways.length] ?? square))
/** A landmark and a way, joined as German joins a compound: one word, the second part lowercased ("Mühlen" + "Gasse": "Mühlengasse"). */
const joined = (first: string, end: string): string => `${first}${end.charAt(0).toLocaleLowerCase("de")}${end.slice(1)}`

/** Where something happened: "Mühlengasse", "Rathausplatz", or "der Ortsrand". */
export const place = (where: Place): string => (where === null ? "der Ortsrand" : joined(streets[where.kind], way(where).end))
/** Where something happened, as a sentence places it: "in der Mühlengasse", "im Mühlenweg", "auf dem Rathausplatz", "am Ortsrand". */
export const at = (where: Place): string => (where === null ? "am Ortsrand" : `${way(where).at} ${place(where)}`)

/**
 * The finished names, as the page reads them: a heading (`title`), the
 * word in a sentence (`name`), and what it is for (`blurb`). In German the
 * two are the same word: a noun is capitalised wherever it stands. A
 * sentence that needs an article or a case is the locale's to write.
 */
export const names = {
  kind: {
    /** "Markthalle": a building at its level of upgrades, as a heading. */
    title: (id: KindId, level = 0): string => capital(built(id, level).noun.one),
    /** "Markthalle": as a sentence names it (a noun keeps its capital). */
    name: (id: KindId, level = 0): string => built(id, level).noun.one,
    blurb: (id: KindId, level = 0): string => built(id, level).blurb
  },
  good: {
    /** "Bretter", "Räucherfisch": the ware. */
    name: (id: GoodId): string => goods[id].name
  },
  tier: {
    /** "Siedler", "Bürger", "Patrizier". */
    people: (tier: Tier): string => tiers[tier].people.other,
    /** "Siedlerhütte", "Bürgerhaus", "Patrizierhaus". */
    home: (tier: Tier): string => tiers[tier].home.one
  },
  /** "Weiler", "Dorf", "Städtchen", "Stadt": a rank past the last reads as the last. */
  rank: (rank: number): string => rankNoun(rank).one,
  size: (id: SizeId): string => sizes[id].name,
  land: { name: (id: LandId): string => lands[id].name, blurb: (id: LandId): string => lands[id].blurb },
  winter: (id: WinterId): string => winters[id].name,
  ground: { title: (id: GroundId): string => capital(grounds[id].noun.one), name: (id: GroundId): string => grounds[id].noun.one, blurb: (id: GroundId): string => grounds[id].blurb },
  prop: { title: (id: PropId): string => capital(props[id].noun.one), name: (id: PropId): string => props[id].noun.one, blurb: (id: PropId): string => props[id].blurb },
  need: (need: Need): string => needs[need],
  place
}
