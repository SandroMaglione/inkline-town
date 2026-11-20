/**
 * Italian names for what the town is made of: its buildings and what they
 * become when upgraded, its goods, homes, ranks, lands, winters, and parks.
 * Every table is keyed by the game's ids and checked against them, as
 * English's are.
 *
 * Each noun carries its gender, which its articles and adjectives follow
 * (`grammar.ts`). Buildings are named as places ("segheria", "infermeria")
 * where English names the trade ("sawmill", "healer"), and the people who
 * walk from them have names that do not echo their building's: a fire
 * watch ("guardia del fuoco") sends a "vedetta", a watch house ("posto di
 * guardia") a "gendarme". The settlement
 * itself is "il paese" in a sentence, whatever its rank: "città" is kept
 * for the last rank, so "il paese è ora una città" says what it means.
 */
import type { GoodId, GroundId, KindId, LandId, Need, PropId, SizeId, Tier, WinterId } from "../../game/content/index.ts"
import type { Place } from "../../game/said.ts"
import { capital, f, m, type Noun } from "./grammar.ts"

/** Something built: what it is called, and what it is for, in a line. */
export interface Thing {
  readonly noun: Noun
  readonly blurb: string
}
const thing = (word: Noun, blurb: string): Thing => ({ noun: word, blurb })

/** Each building as it is built, then as each of its upgrades (see `Kind.upgrade`). */
export const kinds = {
  townhall: [
    thing(m("municipio", "municipi"), "il cuore del paese: magazzino, tasse e un ambulante con le provviste"),
    thing(m("palazzo delle gilde", "palazzi delle gilde"), "il municipio con una torre dell'orologio: contiene il doppio, manda più portatori, il suo ambulante va più lontano e amministra il paese con un decimo in meno"),
    thing(m("palazzo di città", "palazzi di città"), "una sede a cupola per la città: contiene più di tutti, manda più portatori di tutti, arriva più lontano e amministra la città con un quinto in meno")
  ],
  warehouse: [
    thing(m("magazzino", "magazzini"), "conserva le merci più vicino a dove si producono e si usano"),
    thing(m("deposito", "depositi"), "un piazzale di carico e un argano: contiene più del doppio e manda altri due portatori")
  ],
  granary: [thing(m("granaio", "granai"), "conserva il cibo, e fa durare pesce e pane cinque volte più a lungo")],
  lumberjack: [thing(m("taglialegna", "taglialegna"), "abbatte gli alberi cresciuti lì vicino per farne legname")],
  forester: [thing(m("guardaboschi", "guardaboschi"), "pianta alberi sul terreno libero lì vicino")],
  quarry: [
    thing(f("cava", "cave"), "taglia la pietra dalle rocce lì vicino"),
    thing(f("bottega dello scalpellino", "botteghe dello scalpellino"), "una gru e la baracca di uno scalpellino: continua a tagliare la roccia esaurita a pieno ritmo, non a un terzo; un vicino più polveroso")
  ],
  mine: [thing(f("miniera", "miniere"), "estrae il minerale da un giacimento lì vicino")],
  fishery: [thing(f("peschiera", "peschiere"), "pesca; le serve un tratto d'acqua tutto suo entro due caselle")],
  smokehouse: [thing(m("affumicatoio", "affumicatoi"), "affumica il pesce, che così dura tutto l'inverno")],
  sawmill: [thing(f("segheria", "segherie"), "sega il legname in tavole")],
  smithy: [thing(f("fucina", "fucine"), "forgia il minerale in attrezzi")],
  farm: [
    thing(f("fattoria", "fattorie"), "semina i campi intorno e raccoglie il grano"),
    thing(f("tenuta", "tenute"), "un fienile e una colombaia: un terzo bracciante miete gli stessi campi una volta e mezza più in fretta")
  ],
  mill: [thing(m("mulino", "mulini"), "macina il grano in farina")],
  bakery: [
    thing(m("forno", "forni"), "cuoce la farina in pane"),
    thing(m("panificio", "panifici"), "un secondo forno e un terzo fornaio: pane ogni quattro secondi invece di sei")
  ],
  sheep: [thing(m("ovile", "ovili"), "tosa le pecore per la lana")],
  weaver: [thing(f("tessitoria", "tessitorie"), "tesse la lana in stoffa")],
  carpenter: [thing(f("falegnameria", "falegnamerie"), "fa mobili con le tavole, per le palazzine dei borghesi")],
  market: [
    thing(m("mercato", "mercati"), "un ambulante porta pesce, pane, stoffa e mobili alle case davanti a cui passa"),
    thing(m("mercato coperto", "mercati coperti"), "una loggia coperta: il suo ambulante va più lontano, più spesso, e la via intorno è più bella")
  ],
  chapel: [
    thing(f("cappella", "cappelle"), "un ambulante porta la fede alle case davanti a cui passa"),
    thing(f("chiesa", "chiese"), "una chiesa con il campanile: il suo prete va più lontano, più spesso, e le vie intorno sono le più belle")
  ],
  firewatch: [
    thing(f("guardia del fuoco", "guardie del fuoco"), "una vedetta controlla che case e botteghe lungo la via non prendano fuoco; i pompieri corrono a ogni incendio"),
    thing(f("caserma dei pompieri", "caserme dei pompieri"), "una torre con la campana e una pompa: la vedetta va più lontano, più spesso, e corrono quattro pompieri invece di due")
  ],
  healer: [thing(f("infermeria", "infermerie"), "un medico visita le case lungo la via e cura i malati")],
  hospital: [thing(m("ospedale", "ospedali"), "i medici passano più spesso e vanno più lontano")],
  watchhouse: [thing(m("posto di guardia", "posti di guardia"), "un gendarme percorre le vie e mantiene l'ordine nelle case lungo il cammino")],
  builder: [thing(f("bottega del muratore", "botteghe del muratore"), "un muratore ripara le case e gli edifici lungo la via, con tavole e pietra")]
} satisfies Record<KindId, readonly [Thing, ...ReadonlyArray<Thing>]>

/** A building at its level of upgrades (0: as built). A level it has no name for reads as the last it has. */
export const built = (id: KindId, level = 0): Thing => {
  const levels: readonly [Thing, ...ReadonlyArray<Thing>] = kinds[id]
  return levels[Math.max(0, Math.min(level, levels.length - 1))] ?? levels[0]
}

/**
 * A good: the ware as the town speaks of it (`name`: "tavole", "farina"),
 * and how a number of it is said. What comes in pieces is counted
 * (`counted`: "1 tavola", "3 tavole"); the rest is measured ("5 di farina").
 */
export interface Good extends Noun {
  readonly name: string
  readonly counted: boolean
}
const pieces = (word: Noun): Good => ({ ...word, name: word.other, counted: true })
const stuff = (word: Noun): Good => ({ ...word, name: word.one, counted: false })

export const goods = {
  wood: stuff(m("legname", "legname")),
  planks: pieces(f("tavola", "tavole")),
  stone: stuff(f("pietra", "pietra")),
  ore: stuff(m("minerale", "minerale")),
  tools: pieces(m("attrezzo", "attrezzi")),
  fish: stuff(m("pesce", "pesce")),
  smoked: stuff(m("pesce affumicato", "pesce affumicato")),
  wheat: stuff(m("grano", "grano")),
  flour: stuff(f("farina", "farina")),
  bread: stuff(m("pane", "pane")),
  wool: stuff(f("lana", "lana")),
  cloth: stuff(f("stoffa", "stoffa")),
  furniture: pieces(m("mobile", "mobili"))
} satisfies Record<GoodId, Good>

/** So many of a good, in words: "1 tavola", "3 tavole", "5 di farina". */
export const quantity = (id: GoodId, n: number): string => {
  const good: Good = goods[id]
  return good.counted ? `${n} ${n === 1 ? good.one : good.other}` : `${n} di ${good.name}`
}

/** A tier of homes: who lives there (a plural noun), and what the home is called. */
export const tiers = {
  1: { people: m("colono", "coloni"), home: f("capanna dei coloni", "capanne dei coloni") },
  2: { people: m("cittadino", "cittadini"), home: f("casa dei cittadini", "case dei cittadini") },
  3: { people: m("borghese", "borghesi"), home: f("palazzina", "palazzine") }
} satisfies Record<Tier, { readonly people: Noun; readonly home: Noun }>

/** The town's ranks, lowest first (see `ranks` in the content). */
export const ranks = [f("borgata", "borgate"), m("villaggio", "villaggi"), f("cittadina", "cittadine"), f("città", "città")] as const
/** A rank's noun: one past the last reads as the last. */
export const rankNoun = (rank: number): Noun => ranks[Math.max(0, Math.min(rank, ranks.length - 1))] ?? ranks[0]

/** The land's size and richness, as adjectives of "terra" (feminine). */
export const sizes = { small: "piccola", medium: "media", large: "grande" } satisfies Record<SizeId, string>
export const lands = {
  rich: { name: "ricca", blurb: "boschi fitti, pietra e minerale in abbondanza, due laghi, il tesoro pieno" },
  fair: { name: "discreta", blurb: "abbastanza di tutto, se non lo si spreca" },
  harsh: { name: "aspra", blurb: "boschi radi, poca pietra, un solo giacimento di minerale, un solo lago" }
} satisfies Record<LandId, { readonly name: string; readonly blurb: string }>
/** A winter's severity, as an adjective of "inverno" (masculine). */
export const winters = { mild: "mite", normal: "normale", hard: "rigido" } satisfies Record<WinterId, string>

export const grounds = {
  lawn: thing(m("prato", "prati"), "erba su cui disporre un parco"),
  flowers: thing(f("aiuola", "aiuole"), "bordure fiorite: più belle del prato"),
  path: thing(m("vialetto di ghiaia", "vialetti di ghiaia"), "una passeggiata attraverso il parco"),
  square: thing(f("piazzetta lastricata", "piazzette lastricate"), "selciato di pietra, su cui posare una statua o una fontana")
} satisfies Record<GroundId, Thing>
export const props = {
  lamp: thing(m("lampione", "lampioni"), "un lampione di ferro lungo la passeggiata"),
  fountain: thing(f("fontana", "fontane"), "una vasca di pietra con acqua fresca"),
  statue: thing(f("statua", "statue"), "un fondatore di pietra, l'orgoglio del parco")
} satisfies Record<PropId, Thing>

export const needs = { food: "cibo", bread: "pane", cloth: "stoffa", faith: "fede", furniture: "mobili" } satisfies Record<Need, string>

/** What a landmark lends its streets' names, with the preposition its article joins: Via "del Mulino", Vicolo "dei Fornai". */
const streets = {
  townhall: "del Municipio", warehouse: "del Magazzino", granary: "del Granaio", lumberjack: "dei Taglialegna", forester: "del Bosco", quarry: "della Cava",
  mine: "della Miniera", fishery: "dei Pescatori", smokehouse: "dell'Affumicatoio", sawmill: "della Segheria", smithy: "dei Fabbri", farm: "della Fattoria",
  mill: "del Mulino", bakery: "dei Fornai", sheep: "dei Pastori", weaver: "dei Tessitori", market: "del Mercato", chapel: "della Cappella",
  firewatch: "della Guardia", healer: "dei Medici", hospital: "dell'Ospedale", watchhouse: "della Ronda", builder: "dei Muratori", carpenter: "dei Falegnami"
} satisfies Record<KindId, string>
/** The ways a street is called: as many as `STREET_WAYS`. */
const ways = ["Via", "Vicolo", "Corso", "Contrada", "Salita", "Strada"] as const

/** Where something happened: "Via del Mulino", "Piazza del Municipio", or "i margini del paese". */
export const place = (where: Place): string =>
  where === null ? "i margini del paese" : `${where.kind === "townhall" ? "Piazza" : ways[where.way % ways.length]} ${streets[where.kind]}`
/** Where something happened, as a sentence places it: "in Via del Mulino", "ai margini del paese". */
export const at = (where: Place): string => (where === null ? "ai margini del paese" : `in ${place(where)}`)

/**
 * The finished names, as the page reads them: a heading (`title`), the
 * word in a sentence (`name`), and what it is for (`blurb`). A sentence
 * that needs an article or a plural is the locale's to write, not the
 * page's to put together.
 */
export const names = {
  kind: {
    /** "Mercato coperto": a building at its level of upgrades, as a heading. */
    title: (id: KindId, level = 0): string => capital(built(id, level).noun.one),
    /** "mercato coperto": as a sentence names it. */
    name: (id: KindId, level = 0): string => built(id, level).noun.one,
    blurb: (id: KindId, level = 0): string => built(id, level).blurb
  },
  good: {
    /** "tavole", "pesce affumicato": the ware. */
    name: (id: GoodId): string => goods[id].name
  },
  tier: {
    /** "coloni", "cittadini", "borghesi". */
    people: (tier: Tier): string => tiers[tier].people.other,
    /** "capanna dei coloni", "casa dei cittadini", "palazzina". */
    home: (tier: Tier): string => tiers[tier].home.one
  },
  /** "borgata", "villaggio", "cittadina", "città": a rank past the last reads as the last. */
  rank: (rank: number): string => rankNoun(rank).one,
  size: (id: SizeId): string => sizes[id],
  land: { name: (id: LandId): string => lands[id].name, blurb: (id: LandId): string => lands[id].blurb },
  winter: (id: WinterId): string => winters[id],
  ground: { title: (id: GroundId): string => capital(grounds[id].noun.one), name: (id: GroundId): string => grounds[id].noun.one, blurb: (id: GroundId): string => grounds[id].blurb },
  prop: { title: (id: PropId): string => capital(props[id].noun.one), name: (id: PropId): string => props[id].noun.one, blurb: (id: PropId): string => props[id].blurb },
  need: (need: Need): string => needs[need],
  place
}
