/**
 * Spanish names for what the town is made of: its buildings and what they
 * become when upgraded, its goods, homes, ranks, lands, winters, and parks.
 * Every table is keyed by the game's ids and checked against them, as
 * English's are.
 *
 * Each noun carries its gender, which its articles and adjectives follow
 * (`grammar.ts`). The words are plain, neutral Spanish, read the same in
 * Spain and in the Americas. Most buildings are named as places
 * ("aserradero", "herrería", "dispensario") where English names the trade
 * ("sawmill", "smithy", "healer"), and the lumberjack is the "cabaña de
 * leñador" of the genre; the people who walk from a service have names that
 * do not echo their building's: a fire post ("puesto de bomberos") sends a
 * "vigilante", a dispensary a "médico", a guardhouse ("cuerpo de guardia")
 * an "alguacil", the builder's yard ("taller de obras") an "albañil", and
 * the food walkers of the town hall and the market are "repartidores".
 *
 * The settlement is "el pueblo" in a sentence, whatever its rank, and the
 * ranks are "caserío", "aldea", "villa" and "ciudad": "villa" is the old
 * charter title of a town, so "pueblo" is never a rank and "el pueblo es
 * ahora una villa" says what it means. The mayor is "el alcalde", Spanish's
 * generic word for the office. A good comes in pieces ("1 tabla", "3
 * tablas") or is measured ("5 de harina"), and streets are named as Spanish
 * towns name them: "Calle del Molino", "Callejón de los Panaderos", and the
 * town hall's "Plaza del Ayuntamiento".
 */
import type { GoodId, GroundId, KindId, LandId, Need, PropId, SizeId, Tier, WinterId } from "../../game/content/index.ts"
import type { Place } from "../../game/said.ts"
import { before, capital, f, m, theArticle, withArticle, type Noun } from "./grammar.ts"

/** Something built: what it is called, and what it is for, in a line. */
export interface Thing {
  readonly noun: Noun
  readonly blurb: string
}
const thing = (word: Noun, blurb: string): Thing => ({ noun: word, blurb })

/** Each building as it is built, then as each of its upgrades (see `Kind.upgrade`). */
export const kinds = {
  townhall: [
    thing(m("ayuntamiento", "ayuntamientos"), "el corazón del pueblo: almacén, impuestos y un repartidor con provisiones"),
    thing(f("casa gremial", "casas gremiales"), "el ayuntamiento con torre de reloj: guarda el doble, envía más porteadores, su repartidor llega más lejos y gobierna el pueblo con una décima parte menos"),
    thing(m("palacio municipal", "palacios municipales"), "una sede con cúpula para la ciudad: guarda más que ninguno, envía más porteadores que ninguno, llega más lejos y gobierna la ciudad con una quinta parte menos")
  ],
  warehouse: [
    thing(m("almacén", "almacenes"), "guarda mercancías más cerca de donde se producen y se usan"),
    thing(m("depósito", "depósitos"), "un patio de carga y una grúa: guarda más del doble y envía dos porteadores más")
  ],
  granary: [thing(m("granero", "graneros"), "guarda comida, y conserva el pescado y el pan cinco veces más tiempo")],
  lumberjack: [thing(f("cabaña de leñador", "cabañas de leñador"), "tala los árboles crecidos de los alrededores para sacar madera")],
  forester: [thing(m("vivero", "viveros"), "planta árboles en el terreno libre de los alrededores")],
  quarry: [
    thing(f("cantera", "canteras"), "corta piedra de las rocas cercanas"),
    thing(m("taller de cantería", "talleres de cantería"), "una grúa y un cobertizo de cantero: sigue cortando la roca agotada a pleno ritmo, no a un tercio; un vecino más polvoriento")
  ],
  mine: [thing(f("mina", "minas"), "extrae mineral de un yacimiento cercano")],
  fishery: [thing(f("pesquería", "pesquerías"), "pesca; necesita su propio tramo de agua a dos casillas como mucho")],
  smokehouse: [thing(m("ahumadero", "ahumaderos"), "ahúma el pescado, que así aguanta todo el invierno")],
  sawmill: [thing(m("aserradero", "aserraderos"), "sierra la madera en tablas")],
  smithy: [thing(f("herrería", "herrerías"), "forja el mineral en herramientas")],
  farm: [
    thing(f("granja", "granjas"), "siembra los campos de alrededor y cosecha el trigo"),
    thing(f("hacienda", "haciendas"), "un granero y un palomar: una tercera mano siega los mismos campos una vez y media más rápido")
  ],
  mill: [thing(m("molino", "molinos"), "muele el trigo en harina")],
  bakery: [
    thing(f("panadería", "panaderías"), "hornea la harina en pan"),
    thing(f("panificadora", "panificadoras"), "un segundo horno y un tercer panadero: pan cada cuatro segundos en lugar de seis")
  ],
  sheep: [thing(m("corral de ovejas", "corrales de ovejas"), "esquila las ovejas para sacar lana")],
  weaver: [thing(m("telar", "telares"), "teje la lana en tela")],
  carpenter: [thing(f("carpintería", "carpinterías"), "hace muebles con tablas, para las casas de los burgueses")],
  market: [
    thing(m("mercado", "mercados"), "un repartidor lleva pescado, pan, tela y muebles a las casas por las que pasa"),
    thing(m("mercado cubierto", "mercados cubiertos"), "una lonja cubierta: su repartidor llega más lejos, más a menudo, y la calle de alrededor es más bonita")
  ],
  chapel: [
    thing(f("capilla", "capillas"), "un cura lleva la fe a las casas por las que pasa"),
    thing(f("iglesia", "iglesias"), "una iglesia con campanario: su cura llega más lejos, más a menudo, y las calles de alrededor son las más bonitas")
  ],
  firewatch: [
    thing(m("puesto de bomberos", "puestos de bomberos"), "un vigilante revisa que no haya fuego en las casas y talleres de su camino; los bomberos acuden a cualquier incendio"),
    thing(m("cuartel de bomberos", "cuarteles de bomberos"), "una torre con campana y una bomba de agua: el vigilante llega más lejos, más a menudo, y acuden cuatro bomberos en lugar de dos")
  ],
  healer: [thing(m("dispensario", "dispensarios"), "un médico visita las casas de su camino y cura a los enfermos")],
  hospital: [thing(m("hospital", "hospitales"), "los médicos pasan más a menudo y llegan más lejos")],
  watchhouse: [thing(m("cuerpo de guardia", "cuerpos de guardia"), "un alguacil recorre las calles y mantiene el orden en las casas de su camino")],
  builder: [thing(m("taller de obras", "talleres de obras"), "un albañil repara las casas y los edificios de su camino, con tablas y piedra")]
} satisfies Record<KindId, readonly [Thing, ...ReadonlyArray<Thing>]>

/** A building at its level of upgrades (0: as built). A level it has no name for reads as the last it has. */
export const built = (id: KindId, level = 0): Thing => {
  const levels: readonly [Thing, ...ReadonlyArray<Thing>] = kinds[id]
  return levels[Math.max(0, Math.min(level, levels.length - 1))] ?? levels[0]
}

/**
 * A good: the ware as the town speaks of it (`name`: "tablas", "harina"),
 * and how a number of it is said. What comes in pieces is counted
 * (`counted`: "1 tabla", "3 tablas"); the rest is measured ("5 de harina").
 */
export interface Good extends Noun {
  readonly name: string
  readonly counted: boolean
}
const pieces = (word: Noun): Good => ({ ...word, name: word.other, counted: true })
const stuff = (word: Noun): Good => ({ ...word, name: word.one, counted: false })

export const goods = {
  wood: stuff(f("madera", "madera")),
  planks: pieces(f("tabla", "tablas")),
  stone: stuff(f("piedra", "piedra")),
  ore: stuff(m("mineral", "mineral")),
  tools: pieces(f("herramienta", "herramientas")),
  fish: stuff(m("pescado", "pescado")),
  smoked: stuff(m("pescado ahumado", "pescado ahumado")),
  wheat: stuff(m("trigo", "trigo")),
  flour: stuff(f("harina", "harina")),
  bread: stuff(m("pan", "pan")),
  wool: stuff(f("lana", "lana")),
  cloth: stuff(f("tela", "tela")),
  furniture: pieces(m("mueble", "muebles"))
} satisfies Record<GoodId, Good>

/** So many of a good, in words: "1 tabla", "3 tablas", "5 de harina". */
export const quantity = (id: GoodId, n: number): string => {
  const good: Good = goods[id]
  return good.counted ? `${n} ${n === 1 ? good.one : good.other}` : `${n} de ${good.name}`
}

/** A tier of homes: who lives there (a plural noun), and what the home is called. */
export const tiers = {
  1: { people: m("colono", "colonos"), home: f("choza de colonos", "chozas de colonos") },
  2: { people: m("ciudadano", "ciudadanos"), home: f("casa de ciudadanos", "casas de ciudadanos") },
  3: { people: m("burgués", "burgueses"), home: f("casa burguesa", "casas burguesas") }
} satisfies Record<Tier, { readonly people: Noun; readonly home: Noun }>

/** The town's ranks, lowest first (see `ranks` in the content). */
export const ranks = [m("caserío", "caseríos"), f("aldea", "aldeas"), f("villa", "villas"), f("ciudad", "ciudades")] as const
/** A rank's noun: one past the last reads as the last. */
export const rankNoun = (rank: number): Noun => ranks[Math.max(0, Math.min(rank, ranks.length - 1))] ?? ranks[0]

/** The land's size and richness, as adjectives of "tierra" (feminine). */
export const sizes = { small: "pequeña", medium: "mediana", large: "grande" } satisfies Record<SizeId, string>
export const lands = {
  rich: { name: "rica", blurb: "bosques espesos, piedra y mineral de sobra, dos lagos, el tesoro lleno" },
  fair: { name: "regular", blurb: "bastante de todo, si no se desperdicia" },
  harsh: { name: "pobre", blurb: "bosques ralos, poca piedra, un solo yacimiento de mineral, un solo lago" }
} satisfies Record<LandId, { readonly name: string; readonly blurb: string }>
/** A winter's severity, as an adjective of "invierno" (masculine). */
export const winters = { mild: "suave", normal: "normal", hard: "duro" } satisfies Record<WinterId, string>

export const grounds = {
  lawn: thing(m("césped", "céspedes"), "hierba sobre la que trazar un parque"),
  flowers: thing(m("parterre", "parterres"), "arriates plantados: más bonitos que el césped"),
  path: thing(m("sendero de grava", "senderos de grava"), "un paseo a través del parque"),
  square: thing(f("plazoleta empedrada", "plazoletas empedradas"), "adoquines de piedra, para que se alce una estatua o una fuente")
} satisfies Record<GroundId, Thing>
export const props = {
  lamp: thing(m("farol", "faroles"), "un farol de hierro junto al paseo"),
  fountain: thing(f("fuente", "fuentes"), "una pila de piedra con agua fresca"),
  statue: thing(f("estatua", "estatuas"), "un fundador de piedra, el orgullo del parque")
} satisfies Record<PropId, Thing>

export const needs = { food: "comida", bread: "pan", cloth: "tela", faith: "fe", furniture: "muebles" } satisfies Record<Need, string>

/** What a landmark lends its streets' names, with the article its preposition joins: Calle "del Molino", Callejón "de los Panaderos". */
const streets = {
  townhall: "del Ayuntamiento", warehouse: "del Almacén", granary: "del Granero", lumberjack: "de los Leñadores", forester: "del Vivero", quarry: "de la Cantera",
  mine: "de la Mina", fishery: "de los Pescadores", smokehouse: "del Ahumadero", sawmill: "del Aserradero", smithy: "de los Herreros", farm: "de la Granja",
  mill: "del Molino", bakery: "de los Panaderos", sheep: "de los Pastores", weaver: "de los Tejedores", market: "del Mercado", chapel: "de la Capilla",
  firewatch: "de los Bomberos", healer: "de los Médicos", hospital: "del Hospital", watchhouse: "de la Guardia", builder: "de los Albañiles", carpenter: "de los Carpinteros"
} satisfies Record<KindId, string>
/** The ways a street is called: as many as `STREET_WAYS`, each with its gender, for the article a sentence gives it. */
const ways = [f("Calle", "Calles"), m("Callejón", "Callejones"), m("Paseo", "Paseos"), m("Camino", "Caminos"), f("Cuesta", "Cuestas"), m("Pasaje", "Pasajes")] as const
const square = f("Plaza", "Plazas")
const edge = "las afueras del pueblo"

const wayOf = (where: NonNullable<Place>): Noun => (where.kind === "townhall" ? square : ways[where.way % ways.length]!)

/** Where something happened: "Calle del Molino", "Plaza del Ayuntamiento", or "las afueras del pueblo". */
export const place = (where: Place): string => (where === null ? edge : `${wayOf(where).one} ${streets[where.kind]}`)
/** Where something happened, as a sentence places it: "en la Calle del Molino", "en el Paseo del Mercado", "en las afueras del pueblo". */
export const at = (where: Place): string => (where === null ? `en ${edge}` : `en ${before(theArticle(wayOf(where)), place(where))}`)
/** Where something stands, after the thing: "de la Calle del Molino", "del Paseo del Mercado", "de las afueras del pueblo". */
export const of = (where: Place): string => (where === null ? `de ${edge}` : before(withArticle("de", wayOf(where)), place(where)))

/**
 * The finished names, as the page reads them: a heading (`title`), the
 * word in a sentence (`name`), and what it is for (`blurb`). A sentence
 * that needs an article or a plural is the locale's to write, not the
 * page's to put together.
 */
export const names = {
  kind: {
    /** "Mercado cubierto": a building at its level of upgrades, as a heading. */
    title: (id: KindId, level = 0): string => capital(built(id, level).noun.one),
    /** "mercado cubierto": as a sentence names it. */
    name: (id: KindId, level = 0): string => built(id, level).noun.one,
    blurb: (id: KindId, level = 0): string => built(id, level).blurb
  },
  good: {
    /** "tablas", "pescado ahumado": the ware. */
    name: (id: GoodId): string => goods[id].name
  },
  tier: {
    /** "colonos", "ciudadanos", "burgueses". */
    people: (tier: Tier): string => tiers[tier].people.other,
    /** "choza de colonos", "casa de ciudadanos", "casa burguesa". */
    home: (tier: Tier): string => tiers[tier].home.one
  },
  /** "caserío", "aldea", "villa", "ciudad": a rank past the last reads as the last. */
  rank: (rank: number): string => rankNoun(rank).one,
  size: (id: SizeId): string => sizes[id],
  land: { name: (id: LandId): string => lands[id].name, blurb: (id: LandId): string => lands[id].blurb },
  winter: (id: WinterId): string => winters[id],
  ground: { title: (id: GroundId): string => capital(grounds[id].noun.one), name: (id: GroundId): string => grounds[id].noun.one, blurb: (id: GroundId): string => grounds[id].blurb },
  prop: { title: (id: PropId): string => capital(props[id].noun.one), name: (id: PropId): string => props[id].noun.one, blurb: (id: PropId): string => props[id].blurb },
  need: (need: Need): string => needs[need],
  place
}
