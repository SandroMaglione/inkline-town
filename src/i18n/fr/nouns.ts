/**
 * French names for what the town is made of: its buildings and what they
 * become when upgraded, its goods, homes, ranks, lands, winters, and parks.
 * Every table is keyed by the game's ids and checked against them, as
 * English's are.
 *
 * Each noun carries its gender and whether the word before it elides
 * (`grammar.ts`): "l'entrepôt", but "le hameau" and "la halle", whose h is
 * aspirated. How things are named:
 * - A building is called by the place, not the trade ("cabane de
 *   bûcheron", "atelier de tissage", "menuiserie", "infirmerie"), so the
 *   news that one fell down or burned does not read as a person's: "le
 *   bûcheron s'est effondré" would be the woodcutter. Each upgrade has a name
 *   of its own: "mairie", "maison des guildes", "hôtel de ville"; "marché",
 *   "halle"; "four" (the bakehouse), then "boulangerie" with its second
 *   oven; "carrière", then "grande carrière" for the derrick that goes on
 *   cutting worked-out rock.
 * - The people who walk from a building have their own names: the market's
 *   "colporteur", the chapel's "prêtre", the fire watch's "guetteur", the
 *   watch house's "sergent", the infirmary's "médecin", the builder's "maçon".
 *   A walker in general, where English says one, is a "tournée" (a round).
 * - The settlement is "la ville" in a sentence, whatever its rank; its
 *   ranks are "hameau", "village", "bourg", "cité", so "la ville est
 *   désormais une cité" says what it means. Coins are "pièces".
 * - A good is spoken of as French speaks of it: in the plural what comes in
 *   pieces ("des planches", "des outils", "des meubles"), the rest as a
 *   mass ("du bois", "de la farine"). A number of a mass is counted by the
 *   good itself where French counts it so ("3 poissons", "3 pains"), and
 *   otherwise in a measure of its own ("3 sacs de farine", "3 blocs de
 *   pierre").
 * - Streets take a landmark's name after the way ("rue du Moulin",
 *   "impasse des Boulangers"), the town hall's a square ("place de la
 *   Mairie"), as French addresses are written.
 */
import type { GoodId, GroundId, KindId, LandId, Need, PropId, SizeId, Tier, WinterId } from "../../game/content/index.ts"
import type { Place } from "../../game/said.ts"
import { aspirate, capital, f, form, m, of, type Noun } from "./grammar.ts"

/** Something built: what it is called, and what it is for, in a line. */
export interface Thing {
  readonly noun: Noun
  readonly blurb: string
}
const thing = (word: Noun, blurb: string): Thing => ({ noun: word, blurb })

/** Each building as it is built, then as each of its upgrades (see `Kind.upgrade`). */
export const kinds = {
  townhall: [
    thing(f("mairie"), "le cœur de la ville : réserve, impôts, et un colporteur avec des vivres"),
    thing(f("maison des guildes", "maisons des guildes"), "la mairie et sa tour à horloge : elle contient deux fois plus, envoie plus de porteurs, son colporteur va plus loin, et elle gère la ville pour un dixième de moins"),
    thing(m("hôtel de ville", "hôtels de ville"), "le siège à coupole de la cité : il contient le plus, envoie le plus de porteurs, va le plus loin, et gère la cité pour un cinquième de moins")
  ],
  warehouse: [
    thing(m("entrepôt"), "stocke les marchandises plus près de là où on les fait et les utilise"),
    thing(m("dépôt"), "une cour de chargement et un palan : il contient plus du double, et envoie deux porteurs de plus")
  ],
  granary: [thing(m("grenier"), "stocke la nourriture, et garde le poisson et le pain cinq fois plus longtemps")],
  lumberjack: [thing(f("cabane de bûcheron", "cabanes de bûcheron"), "son bûcheron abat les arbres adultes alentour pour en tirer du bois")],
  forester: [thing(f("maison forestière", "maisons forestières"), "son forestier plante des arbres sur le terrain libre alentour")],
  quarry: [
    thing(f("carrière"), "taille la pierre dans les rochers alentour"),
    thing(f("grande carrière", "grandes carrières"), "un treuil et une loge de tailleur : elle continue de tailler la roche épuisée à plein régime, et non au tiers ; un voisin plus poussiéreux")
  ],
  mine: [thing(f("mine"), "extrait le minerai d'un gisement alentour")],
  fishery: [thing(f("pêcherie"), "pêche du poisson ; il lui faut son propre bout d'eau, à deux cases au plus")],
  smokehouse: [thing(m("fumoir"), "fume le poisson, qui se garde alors tout l'hiver")],
  sawmill: [thing(f("scierie"), "scie le bois en planches")],
  smithy: [thing(f("forge"), "forge des outils avec le minerai")],
  farm: [
    thing(f("ferme"), "sème les champs autour d'elle et récolte le blé"),
    thing(m("domaine"), "une grange et un pigeonnier : une troisième paire de bras moissonne les mêmes champs moitié plus vite")
  ],
  mill: [thing(m("moulin"), "moud le blé en farine")],
  bakery: [
    thing(m("four"), "cuit la farine en pain"),
    thing(f("boulangerie"), "un second four et un troisième boulanger : du pain toutes les quatre secondes au lieu de six")
  ],
  sheep: [thing(f("bergerie"), "tond les moutons pour leur laine")],
  weaver: [thing(m("atelier de tissage", "ateliers de tissage"), "tisse la laine en tissu")],
  carpenter: [thing(f("menuiserie"), "fait des meubles avec des planches, pour les maisons bourgeoises")],
  market: [
    thing(m("marché"), "un colporteur porte poisson, pain, tissu et meubles aux maisons sur son passage"),
    thing(aspirate(f("halle")), "un marché couvert : son colporteur va plus loin, plus souvent, et la rue alentour est plus belle")
  ],
  chapel: [
    thing(f("chapelle"), "un prêtre apporte la foi aux maisons sur son passage"),
    thing(f("église"), "une église avec un clocher : son prêtre va plus loin, plus souvent, et les rues alentour sont les plus belles")
  ],
  firewatch: [
    thing(f("tour de guet", "tours de guet"), "un guetteur surveille le feu dans les maisons et les ateliers sur son chemin ; les pompiers accourent à chaque incendie"),
    thing(f("caserne de pompiers", "casernes de pompiers"), "un beffroi et une pompe : son guetteur va plus loin, plus souvent, et quatre pompiers accourent au lieu de deux")
  ],
  healer: [thing(f("infirmerie"), "un médecin visite les maisons sur son chemin et soigne les malades")],
  hospital: [thing(m("hôpital", "hôpitaux"), "les médecins passent plus souvent et vont plus loin")],
  watchhouse: [thing(m("corps de garde", "corps de garde"), "un sergent parcourt les rues et maintient l'ordre dans les maisons sur son chemin")],
  builder: [thing(m("atelier de maçon", "ateliers de maçon"), "un maçon répare les maisons et les bâtiments sur son chemin, avec des planches et de la pierre")]
} satisfies Record<KindId, readonly [Thing, ...ReadonlyArray<Thing>]>

/** A building at its level of upgrades (0: as built). A level it has no name for reads as the last it has. */
export const built = (id: KindId, level = 0): Thing => {
  const levels: readonly [Thing, ...ReadonlyArray<Thing>] = kinds[id]
  return levels[Math.max(0, Math.min(level, levels.length - 1))] ?? levels[0]
}

/**
 * A good: the ware as the town speaks of it (`name`: "planches", "farine"),
 * and how a number of it is said. What comes in pieces is spoken of in the
 * plural (`counted`: "des planches") and counted as itself ("3 planches");
 * a mass is spoken of in the singular ("du pain"), and counted as itself
 * where French counts it so ("3 pains"), or else in its `measure` ("3 sacs
 * de farine").
 */
export interface Good extends Noun {
  readonly name: string
  readonly counted: boolean
  readonly measure: Noun | null
}
const pieces = (word: Noun): Good => ({ ...word, name: word.other, counted: true, measure: null })
const stuff = (word: Noun, measure: Noun | null = null): Good => ({ ...word, name: word.one, counted: false, measure })

export const goods = {
  wood: stuff(m("bois", "bois"), m("rondin")),
  planks: pieces(f("planche")),
  stone: stuff(f("pierre"), m("bloc")),
  ore: stuff(m("minerai"), f("charge")),
  tools: pieces(m("outil")),
  fish: stuff(m("poisson")),
  smoked: stuff(m("poisson fumé", "poissons fumés")),
  wheat: stuff(m("blé"), f("gerbe")),
  flour: stuff(f("farine"), m("sac")),
  bread: stuff(m("pain")),
  wool: stuff(f("laine"), m("ballot")),
  cloth: stuff(m("tissu"), m("rouleau", "rouleaux")),
  furniture: pieces(m("meuble"))
} satisfies Record<GoodId, Good>

/** The words before a good when a number of it is said: "3" alone, or "3 sacs de". */
export const measured = (id: GoodId, n: number): string => {
  const good: Good = goods[id]
  return good.measure === null ? `${n}` : `${n} ${form(n, good.measure)} ${good.elides ? "d'" : "de"}`
}
/** So many of a good, in words: "1 planche", "3 poissons", "3 sacs de farine", "2 charges de minerai". */
export const quantity = (id: GoodId, n: number): string => {
  const good: Good = goods[id]
  return good.measure === null ? `${n} ${form(n, good)}` : `${n} ${form(n, good.measure)} ${of(good)}`
}

/** A tier of homes: who lives there (a noun, spoken of in the plural), and what the home is called. */
export const tiers = {
  1: { people: m("colon"), home: f("chaumière") },
  2: { people: m("citoyen"), home: f("maison de citoyens", "maisons de citoyens") },
  3: { people: m("bourgeois", "bourgeois"), home: f("maison bourgeoise", "maisons bourgeoises") }
} satisfies Record<Tier, { readonly people: Noun; readonly home: Noun }>

/** The town's ranks, lowest first (see `ranks` in the content). */
export const ranks = [aspirate(m("hameau", "hameaux")), m("village"), m("bourg"), f("cité")] as const
/** A rank's noun: one past the last reads as the last. */
export const rankNoun = (rank: number): Noun => ranks[Math.max(0, Math.min(rank, ranks.length - 1))] ?? ranks[0]

/** The land's size and richness, as adjectives of "terre" (feminine). */
export const sizes = { small: "petite", medium: "moyenne", large: "grande" } satisfies Record<SizeId, string>
export const lands = {
  rich: { name: "riche", blurb: "des forêts profondes, de la pierre et du minerai en abondance, deux lacs, un trésor plein" },
  fair: { name: "passable", blurb: "assez de tout, si rien n'est gaspillé" },
  harsh: { name: "ingrate", blurb: "des bois clairsemés, peu de pierre, un seul gisement de minerai, un seul lac" }
} satisfies Record<LandId, { readonly name: string; readonly blurb: string }>
/** A winter's severity, as an adjective of "hiver" (masculine). */
export const winters = { mild: "doux", normal: "normal", hard: "rude" } satisfies Record<WinterId, string>

export const grounds = {
  lawn: thing(m("gazon"), "de l'herbe où dessiner un parc"),
  flowers: thing(m("parterre de fleurs", "parterres de fleurs"), "des bordures fleuries : plus jolies que le gazon"),
  path: thing(f("allée de gravier", "allées de gravier"), "une promenade à travers le parc"),
  square: thing(f("place pavée", "places pavées"), "des pavés de pierre, pour y dresser une statue ou une fontaine")
} satisfies Record<GroundId, Thing>
export const props = {
  lamp: thing(m("réverbère"), "un réverbère en fer le long de la promenade"),
  fountain: thing(f("fontaine"), "un bassin de pierre plein d'eau fraîche"),
  statue: thing(f("statue"), "un fondateur de pierre, la fierté du parc")
} satisfies Record<PropId, Thing>

export const needs = { food: "nourriture", bread: "pain", cloth: "tissu", faith: "foi", furniture: "meubles" } satisfies Record<Need, string>

/** What a landmark lends its streets' names, with the "de" and article it is said with: rue "du Moulin", impasse "des Boulangers". */
const streets = {
  townhall: "de la Mairie", warehouse: "de l'Entrepôt", granary: "du Grenier", lumberjack: "des Bûcherons", forester: "de la Forêt", quarry: "de la Carrière",
  mine: "de la Mine", fishery: "des Pêcheurs", smokehouse: "du Fumoir", sawmill: "de la Scierie", smithy: "des Forgerons", farm: "de la Ferme",
  mill: "du Moulin", bakery: "des Boulangers", sheep: "des Bergers", weaver: "des Tisserands", market: "du Marché", chapel: "de la Chapelle",
  firewatch: "du Guet", healer: "des Guérisseurs", hospital: "de l'Hôpital", watchhouse: "de la Garde", builder: "des Maçons", carpenter: "des Menuisiers"
} satisfies Record<KindId, string>
/** The ways a street is called (as many as `STREET_WAYS`), each with how a sentence puts something in it. */
const ways = [
  { name: "rue", at: "dans la rue" },
  { name: "ruelle", at: "dans la ruelle" },
  { name: "chemin", at: "sur le chemin" },
  { name: "allée", at: "dans l'allée" },
  { name: "passage", at: "dans le passage" },
  { name: "impasse", at: "dans l'impasse" }
] as const
const square = { name: "place", at: "sur la place" }
const way = (where: NonNullable<Place>) => (where.kind === "townhall" ? square : ways[where.way % ways.length] ?? ways[0])

/** Where something happened: "rue du Moulin", "place de la Mairie", or "les abords de la ville". */
export const place = (where: Place): string => (where === null ? "les abords de la ville" : `${way(where).name} ${streets[where.kind]}`)
/** Where something happened, as a sentence places it: "dans la rue du Moulin", "sur la place de la Mairie", "aux abords de la ville". */
export const at = (where: Place): string => (where === null ? "aux abords de la ville" : `${way(where).at} ${streets[where.kind]}`)

/**
 * The finished names, as the page reads them: a heading (`title`), the
 * word in a sentence (`name`), and what it is for (`blurb`). A sentence
 * that needs an article or a plural is the locale's to write, not the
 * page's to put together.
 */
export const names = {
  kind: {
    /** "Maison des guildes": a building at its level of upgrades, as a heading. */
    title: (id: KindId, level = 0): string => capital(built(id, level).noun.one),
    /** "maison des guildes": as a sentence names it. */
    name: (id: KindId, level = 0): string => built(id, level).noun.one,
    blurb: (id: KindId, level = 0): string => built(id, level).blurb
  },
  good: {
    /** "planches", "poisson fumé": the ware. */
    name: (id: GoodId): string => goods[id].name
  },
  tier: {
    /** "colons", "citoyens", "bourgeois". */
    people: (tier: Tier): string => tiers[tier].people.other,
    /** "chaumière", "maison de citoyens", "maison bourgeoise". */
    home: (tier: Tier): string => tiers[tier].home.one
  },
  /** "hameau", "village", "bourg", "cité": a rank past the last reads as the last. */
  rank: (rank: number): string => rankNoun(rank).one,
  size: (id: SizeId): string => sizes[id],
  land: { name: (id: LandId): string => lands[id].name, blurb: (id: LandId): string => lands[id].blurb },
  winter: (id: WinterId): string => winters[id],
  ground: { title: (id: GroundId): string => capital(grounds[id].noun.one), name: (id: GroundId): string => grounds[id].noun.one, blurb: (id: GroundId): string => grounds[id].blurb },
  prop: { title: (id: PropId): string => capital(props[id].noun.one), name: (id: PropId): string => props[id].noun.one, blurb: (id: PropId): string => props[id].blurb },
  need: (need: Need): string => needs[need],
  place
}
