/**
 * Spanish for the page itself (`ui/dom` and what starts it, `app/browser.ts`):
 * its buttons, headings, tooltips, dialogs, and the chips a message's tokens
 * become. The same entries as English, part for part (`satisfies` holds it
 * to them).
 *
 * As in English, what a part shows through markup may hold tokens, what it
 * sets as plain text is words alone, and a sentence with the page's own
 * markup set into it takes each piece as a string and says where it goes.
 * Spanish orders some of them its own way, and turns a sentence where an
 * English one would need an agreement the page cannot know (a good's gender
 * in a slot, a building's in a status).
 *
 * Every building, good, home, and rank is named through `nouns.ts`, and its
 * article, preposition, pronoun, and participle made to agree with it by
 * `grammar.ts`: none is written out beside a name it might not agree with.
 */
import { COMMUTE, home, mood, park, TOWN_RANK, type Category, type GoodId, type GroundId, type KindId, type LandId, type PropId, type SizeId, type Tier, type WinterId } from "../../game/content/index.ts"
import type { Status } from "../../game/schema.ts"
import type { Trouble } from "../../platform/save.ts"
import type { Offered, ShareFailure } from "../../platform/share/client.ts"
import type { Panel } from "../../view/contracts.ts"
import type { page as English } from "../en/page.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { a, agree, capital, count, decimal, f, m, signed, the, theMany, to, toMany, type Noun } from "./grammar.ts"
import { built, goods, grounds, lands, names, props, quantity, rankNoun, sizes, tiers, winters } from "./nouns.ts"
import { amount } from "./said.ts"

/** A number with its sign as a slider or a chip shows it: "+4", "-4", "0". */
const plus = (n: number) => `${n > 0 ? "+" : ""}${n}`

/** A building's noun, as built or at a level of its upgrades. */
const kind = (id: KindId, level = 0): Noun => built(id, level).noun

// A good as the town speaks of it is in one number: what comes in pieces is many ("las tablas"), the rest is one ("el pan").
// Its article, the pronoun that stands for it, and a verb said of it all follow that.
/** "las tablas", "el pan", "los muebles". */
const theGood = (id: GoodId): string => (goods[id].counted ? theMany(goods[id]) : the(goods[id]))
/** The pronoun for a good as an object: "lo", "la", "los", "las". After an imperative it is joined: "compra" + "las". */
const them = (id: GoodId): string => (goods[id].counted ? agree(goods[id], "los", "las") : agree(goods[id], "lo", "la"))
/** A verb said of a good, in the good's number: "llega" or "llegan". */
const verb = (id: GoodId, one: string, many: string): string => (goods[id].counted ? many : one)
/** "there is not enough" of a good, in its number: "no hay suficiente pan", "no hay suficientes tablas". */
const notEnough = (id: GoodId, yet: boolean): string => `${yet ? "Aún no hay" : "No hay"} ${goods[id].counted ? "suficientes" : "suficiente"} ${goods[id].name}`

const settlers = tiers[1].people, citizens = tiers[2].people, burghers = tiers[3].people
const cottage = tiers[1].home, citizensHome = tiers[2].home, townhouse = tiers[3].home
const winter = m("invierno", "inviernos"), cell = f("casilla", "casillas")
/** Requests missed one after another: "1 petición sin respuesta", "2 peticiones seguidas sin respuesta". */
const missedInARow = (n: number) => (n === 1 ? "1 petición sin respuesta" : `${n} peticiones seguidas sin respuesta`)
/** "falta" of one thing, "faltan" of more. */
const lacking = (n: number) => (n === 1 ? "falta" : "faltan")

/** What the bar a held stroke waits at calls its button: the messages that send a finger to it name it by this. */
const lay = "Colocar"

/** A workplace short of its crew, as the view names it. */
interface ShortPlace {
  readonly title: string
  readonly assigned: number
  readonly needed: number
  readonly nobodyNear: boolean
}

/** A warning over the town: what it is, in a word or two, and what it says. */
const warning = (lead: string, text: string) => ({ lead, text })

/** Asking before something that replaces the town: the question, what it means, and its two ways on. */
const leave = (title: string, text: string, saveThen: string, without: string) => ({ title, text, saveThen, without })

/** A land in words: "tierra mediana y regular". */
const landOf = (size: SizeId, land: LandId) => `tierra ${sizes[size]} y ${lands[land].name}`

export const page = {
  /** What a building's chip in a message says on hover. */
  chips: {
    goTo: (id: KindId): string => `Ir ${to("a", kind(id))}`,
    /** A row that places a building, on hover. */
    place: (id: KindId): string => `Construye ${a(kind(id))}`,
    build: (id: KindId): string => `Construye ${a(kind(id))}: ${built(id).blurb}`
  },
  /** How long ago a save was made, roughly. */
  ago: {
    now: "ahora mismo",
    minutes: (n: number): string => `hace ${n} min`,
    hours: (n: number): string => `hace ${n} h`,
    yesterday: "ayer",
    days: (n: number): string => `hace ${n} días`
  },
  /** Words more than one part of the page says. */
  common: {
    close: "Cerrar",
    closeEsc: "Cerrar (Esc)",
    cancel: "Cancelar",
    /** A section's ⓘ. */
    whatThisMeans: "Qué significa",
    showWhere: "Muéstrame dónde",
    dismiss: "Descartar",
    coins: "monedas"
  },

  // ── The map and its tools ───────────────────────────────────────────────

  /** What picking something to put on the map says, and the bar a held stroke waits at. */
  map: {
    place: (id: KindId): string => {
      const what = kind(id)
      return token.device(`Toca un sitio para ${the(what)}, y tócalo otra vez para ${agree(what, "construirlo", "construirla")}`, `Haz clic para colocar ${a(what)} · Esc para terminar`)
    },
    layGround: (id: GroundId): string => {
      const what = grounds[id].noun
      return token.device(`Arrastra un rectángulo para poner ${the(what)}, y luego toca ${lay}`, `Arrastra un rectángulo para poner ${the(what)} · Esc para terminar`)
    },
    furnish: (id: PropId): string => {
      const what = props[id].noun
      return token.device(`Toca una casilla de parque para ${the(what)}, y tócala otra vez para ${agree(what, "ponerlo", "ponerla")}`, `Haz clic en una casilla de parque para poner ${a(what)} · Esc para terminar`)
    },
    /** A touch tap that holds what it would do: tapped again, it does it. What it would remove is not known here, so neither says "it". */
    tapAgain: { remove: "toca otra vez para derribar", build: "toca otra vez para construir aquí" },
    overlays: "Vistas del mapa",
    stroke: { build: lay, cancel: "Cancelar" }
  },
  toolbar: {
    town: { label: "pueblo", title: "Los objetivos, las cifras, los impuestos y el comercio del pueblo (T)" },
    more: "Compartir, la guía, guardar, cargar, pueblo nuevo",
    pause: "Pausa el pueblo, o ponlo en marcha otra vez (espacio)",
    /** A speed's button: "Pon el pueblo a 2× (2)". */
    runAt: (speed: string, key: string): string => `Pon el pueblo a ${speed} (${key})`,
    cycle: "Cambia la velocidad: 1×, 2×, 4×",
    /** The pause switch, read aloud: what pressing it does now. */
    run: "Pon en marcha el pueblo",
    pauseNow: "Pausa el pueblo",
    runAtLast: (last: number): string => `Pon el pueblo a ${last}×`
  },
  mapViews: {
    title: "vistas del mapa",
    help: "Colorea el mapa según una de estas, para ver dónde le va bien o mal al pueblo. Pulsa otra vez la tecla (o haz clic) para ocultarla.",
    // A view's label is a bare noun ("atractivo", "incendios"): it is named as a view, so no article has to agree with it.
    show: (label: string, key: string): string => `Muestra la vista «${label}» sobre el mapa (${key}); otra vez para ocultarla`
  },
  /** Share, the guide, save, load, and new town: each button's label and what it says on hover. */
  system: {
    share: { label: "compartir", tip: "Comparte una imagen del pueblo, o un enlace que cualquiera puede abrir para verlo y seguir jugando" },
    guide: {
      label: "guía",
      tip: "Activa o desactiva la guía: le dice a quien empieza qué hacer a continuación, y por qué",
      turnOn: "Vuelve a activar la guía: un próximo paso que dar, y por qué, arriba del todo en las noticias",
      turnOff: "Desactiva la guía"
    },
    language: { label: "idioma", tip: "Elige el idioma en el que se lee el pueblo" },
    save: { label: "guardar", tip: "Guarda el pueblo en este navegador (también se guarda solo cada dos minutos)" },
    load: { label: "cargar", tip: "Carga la última partida guardada: la tuya o la automática, la que sea más reciente" },
    newTown: { label: "pueblo nuevo", tip: "Funda un pueblo nuevo en una tierra nueva" },
    recentre: { label: "centrar", tip: "Vuelve al ángulo y al centro del principio" },
    leave: {
      load: leave("¿cargar la última partida guardada?", "El pueblo tal como está ahora se sustituye por la última partida guardada (la tuya o la automática).", "Guardar y luego cargar", "Cargar sin guardar"),
      newTown: leave("¿fundar un pueblo nuevo?", "Este pueblo se pierde para siempre si no se guarda antes.", "Guardar y luego elegir tierra nueva", "Elegir tierra nueva sin guardar"),
      stay: "Seguir jugando"
    }
  },
  /** The camera bar in the map's corner (the renderer draws it): its two drag modes, the zoom, and the way back. */
  camera: {
    label: "Cámara del mapa",
    pan: { label: "Mover", title: "Arrastra para moverte; las herramientas de camino, empedrar, casas y terreno de parque construyen al arrastrar" },
    rotate: { label: "Girar", title: "Arrastra para girar en lugar de colocar. Arrastrar con el botón derecho también gira, y Q y E giran un octavo." },
    zoomOut: "Alejar",
    zoom: "Zoom de la cámara",
    zoomIn: "Acercar",
    reset: { label: "Restablecer la cámara", title: "Ángulo y centro del principio (Inicio)" }
  },
  /** Choosing the language: every language is listed by its own name, so only what is around the list is said here. */
  language: {
    /** On the language now in use, read aloud. */
    current: (name: string): string => `${name} (en uso)`,
    /** The browser would not keep the choice, so the page stays as it is. */
    notKept: "Este navegador no ha guardado la elección, así que el idioma se queda como está"
  },
  /** The maker's credit: what each link is, read aloud. */
  credit: {
    typeonce: "Typeonce Games: más juegos del autor de Inkline Town",
    ritmo: "ritmo en GitHub: el runtime ECS con el que está hecho Inkline Town",
    madeWith: "Hecho con",
    madeBy: "Hecho por Typeonce",
    newTab: (label: string): string => `${label} (se abre en una pestaña nueva)`
  },

  // ── The heads-up display ────────────────────────────────────────────────

  hud: {
    /** What each good is for: who makes it, who takes it. */
    goods: {
      wood: `${theMany(kind("lumberjack"))} ${them("wood")} talan; ${a(kind("sawmill"))} ${them("wood")} convierte en ${goods.planks.name}`,
      planks: `el material de casas y edificios: ${a(kind("sawmill"))} ${them("planks")} saca ${to("de", goods.wood)}`,
      stone: `para construir y empedrar: ${theMany(kind("quarry"))} ${them("stone")} cortan de las rocas, que se agotan`,
      ore: `solo para ${goods.tools.name}: cuando el pueblo tiene 10 ${citizens.other}, ${a(kind("mine"))} ${them("ore")} extrae de los yacimientos rojizos, y ${a(kind("smithy"))} ${them("ore")} convierte en ${goods.tools.name}`,
      tools: `para construir, y los talleres gastan ${agree(goods.tools, "uno", "una")} cada 50 o 60 trabajos: ${a(kind("smithy"))} ${them("tools")} forja, o se pueden comprar`,
      fish: `comida para ${settlers.other}: ${theMany(kind("fishery"))} ${them("fish")} pescan junto al agua; ${verb("fish", "se echa", "se echan")} a perder en unos tres minutos`,
      smoked: `${goods.fish.name} que aguanta todo el invierno: ${a(kind("smokehouse"))} ${them("fish")} ahúma`,
      wheat: `${theMany(kind("farm"))} ${them("wheat")} cultivan; ${a(kind("mill"))} ${them("wheat")} convierte en ${goods.flour.name} (no en invierno)`,
      flour: `sale ${to("de", kind("mill"))}; ${a(kind("bakery"))} ${them("flour")} hornea para hacer ${goods.bread.name}`,
      bread: `comida que necesitan ${theMany(citizens)}, y ${a(cottage)} con ${goods.bread.name} paga la mitad más: ${verb("bread", "se echa", "se echan")} a perder en unos cinco minutos`,
      wool: `${theMany(kind("sheep"))} ${them("wool")} esquilan; ${a(kind("weaver"))} ${them("wool")} convierte en ${goods.cloth.name}`,
      cloth: `${toMany("a", citizens)} ${verb("cloth", "les hace", "les hacen")} falta: solo ${verb("cloth", "llega", "llegan")} a calles con atractivo 5 o más`,
      furniture: `${toMany("a", burghers)} ${verb("furniture", "les hace", "les hacen")} falta en sus ${townhouse.other}: ${a(kind("carpenter"))} ${them("furniture")} hace con ${goods.planks.name}; solo ${verb("furniture", "llega", "llegan")} a calles lo bastante bonitas para ${theMany(townhouse)}`
    } satisfies Record<GoodId, string>,
    /** A good and what it is for: "tablas: con las tablas se construyen casas y edificios…". */
    good: (name: string, help: string): string => `${name}: ${help}`,
    /** A good's last minute, under what it is for. Said in nouns (what was made, what was used), so nothing has to agree with the good. */
    goodFlow: (flow: { readonly made: number; readonly used: number; readonly traded: number; readonly stock: number; readonly elsewhere: number }): string =>
      `Último minuto: producción ${flow.made}, consumo ${flow.used}${flow.traded !== 0 ? `, ${flow.traded > 0 ? "compras" : "ventas"} ${Math.abs(flow.traded)}` : ""}. ${flow.stock} en el almacén, ${flow.elsewhere} por el pueblo (en talleres y mercados, y de camino).`,
    stock: "Las mercancías del almacén del pueblo, y hacia dónde va cada una · haz clic para ver qué produce y usa el pueblo",
    goodsChip: "Las mercancías del almacén",
    folk: "Abre las cifras, los objetivos y las palancas del pueblo (T)",
    treasury: {
      plain: "Monedas en el tesoro, y lo que gana (o pierde) por minuto al ritmo actual · haz clic para ver el último minuto del pueblo",
      counted: (flow: { readonly change: number; readonly made: number; readonly used: number; readonly traded: number; readonly net: number }): string =>
        `Monedas en el tesoro · haz clic para ver el último minuto del pueblo\nÚltimo minuto: ${signed(flow.change)} (ingresos ${flow.made}, gastos ${flow.used}${flow.traded !== 0 ? `, comercio ${signed(flow.traded)}` : ""})\nAl ritmo actual: ${signed(flow.net)}/min (impuestos, comercio, mantenimiento, administración)`
    },
    clock: {
      paused: "en pausa",
      /** Under the clock: "año 2 · invierno en 3:20 (duro)". `until` is one of the three below. */
      year: (year: number, until: string): string => `año ${year} · ${until}`,
      // Under the clock there is one short line: how much longer the winter lasts says when spring comes, in fewer letters.
      winter: (severity: WinterId, spring: string): string => `${winter.one} ${winters[severity]} · queda ${spring}`,
      winterIn: (left: string, coming: WinterId): string => `${winter.one} en ${left} (${winters[coming]})`,
      noMoreWinters: "sin más inviernos",
      /** The clock on hover: the season, the almanac's next two winters (`null`: beyond the term), and what each kind does to a catch (percent). */
      title: (c: { readonly winter: boolean; readonly coming: WinterId | null; readonly after: WinterId | null; readonly fishing: Readonly<Record<WinterId, number>> }): string =>
        `${c.winter ? "Invierno: los campos descansan, la pesca va lenta y las casas comen más rápido" : "Tiempo que queda de mandato"}\nEl almanaque: ${c.coming === null ? "el próximo invierno queda fuera del mandato" : `el próximo invierno será ${winters[c.coming]}`}; el siguiente, ${c.after === null ? "fuera del mandato" : winters[c.after]}.\n${capital(winters.mild)}: pesca al ${c.fishing.mild}%. ${capital(winters.normal)}: ${c.fishing.normal}%. ${capital(winters.hard)}: la mitad más largo, pesca al ${c.fishing.hard}%, y las casas que se calientan corren riesgo de incendio.`
    },
    approval: "aprobación",
    settlers: settlers.other,
    citizens: citizens.other,
    /** Beside the citizens, once there are any: "· 12 burgueses". */
    burghers: (n: number): string => count(n, burghers),
    jobs: {
      short: (n: number): string => `${lacking(n)} ${n} · clic`,
      filled: "pleno empleo",
      filledTitle: `Trabajadores ocupados sobre trabajadores necesarios: cada lugar de trabajo tiene su plantilla. Los habitantes caminan como mucho ${COMMUTE} casillas de camino hasta el trabajo.`,
      /** How many workplaces are short, and the first few of them. */
      shortTitle: (n: number, places: ReadonlyArray<ShortPlace>): string =>
        `Trabajadores ocupados sobre trabajadores necesarios. ${n > 1 ? `A ${n} lugares de trabajo les faltan` : "A un lugar de trabajo le faltan"} trabajadores: ${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? ` (no hay casas a no más de ${COMMUTE} casillas de camino)` : ""}`).join(", ")}. Haz clic para visitarlos uno a uno.`
    },
    /** The goods' last minute, side by side: each column, and what it counts. */
    flow: {
      counting: "Contando las mercancías del pueblo: las primeras cifras llegan en medio minuto…",
      made: { label: "hecho", title: "Producido por talleres y recolectores en el último minuto" },
      used: { label: "usado", title: "Comido, transformado, usado para construir, echado a perder o enviado fuera en el último minuto" },
      traded: { label: "comercio", title: "Comprado (+) o vendido (−) en el último minuto" },
      storage: { label: "almacén", title: `${capital(to("en", kind("townhall")))}, ${toMany("en", kind("warehouse"))} y ${toMany("en", kind("granary"))}` },
      about: { label: "en ruta", title: `En talleres y ${kind("market").other}, en las cestas de los repartidores y en las cajas de los porteadores` }
    },
    /** The crown's request: `amount` and `good` are set in bold, the good with its icon. */
    crown: {
      // The good comes first, the number after it: "20 tablas" but "20 de harina", and the page hands the two as separate pieces.
      asks: (amount: string, good: string): string => `la corona pide ${good}: ${amount}`,
      inStore: (n: number): string => `${n} en el almacén`,
      /** What is in store (coloured by whether it is enough), when it is due (bold), and what it pays. */
      terms: (inStore: string, due: string, reward: string): string => `${inStore} · vence en ${due} · ${reward}`,
      reward: (coins: number): string => amount.coins(coins, true),
      send: "enviar",
      sendTitle: (good: GoodId, n: number, reward: number): string => `Envía ${quantity(good, n)} a la corona a cambio de ${amount.coins(reward)}`,
      notEnough: (good: GoodId): string => `${notEnough(good, true)} en el almacén`
    },
    /** What threatens the term, or is about to raise the town a rank: `left` is a clock. */
    warnings: {
      bankruptIn: (left: string) => warning("En deuda:", `bancarrota en ${left} si el tesoro no se recupera`),
      debt: warning("En deuda:", "los salarios quedan sin pagar"),
      revoltIn: (left: string) => warning("Alboroto:", `el pueblo echa al alcalde en ${left}`),
      restless: warning("Inquietud:", "la aprobación baja hacia la revuelta"),
      emptying: warning("Se vacía:", "la gente se está yendo del pueblo"),
      patience: (streak: number) => warning("La paciencia de la corona:", `${missedInARow(streak)}; una más y el alcalde queda destituido`),
      /** Every goal of the next rank (`to`) is met and holding. */
      rises: (next: number, left: string) => warning("Todos los objetivos cumplidos:", `el pueblo será ${a(rankNoun(next))} en ${left}`)
    }
  },

  // ── The ticker ──────────────────────────────────────────────────────────

  ticker: {
    bulb: "La guía, y lo que hay que mirar ahora",
    tucked: "La guía está en la bombilla de arriba a la derecha",
    guideOff: "Guía desactivada · vuelve a activarla abajo a la derecha",
    /** How long ago a piece of news happened, in the town's own time. */
    ago: {
      now: "ahora mismo",
      seconds: (n: number): string => `hace ${n} s`,
      minutes: (n: number): string => `hace ${n} min`
    },
    /** The guide's heading: "guía · Fundación". */
    guide: (chapter: string): string => `guía · ${chapter}`,
    step: (at: number, of: number): string => `paso ${at} de ${of}`,
    firstSteps: "Los primeros pasos de un pueblo nuevo",
    hide: "ocultar guía",
    hideTitle: "Desactiva la guía (el botón de la guía, abajo a la derecha, la vuelve a activar)",
    /** Under a step: what closes it. `goal` is the step's own words, a phrase (see `guide.ts`). */
    doneWhen: (goal: string): string => `meta: ${goal}`,
    skip: "Saltar este paso",
    tuck: "Ocultar: la guía se queda en la bombilla de arriba a la derecha",
    now: "ahora",
    lately: "reciente"
  },

  // ── The panels ──────────────────────────────────────────────────────────

  town: {
    title: "pueblo",
    /** Under the heading: "tierra mediana y regular · una aldea · mandato 2, 60 minutos". */
    sub: (c: { readonly size: SizeId; readonly land: LandId; readonly rank: number; readonly term: number; readonly minutes: number }): string =>
      `${landOf(c.size, c.land)} · ${a(rankNoun(c.rank))} · mandato ${c.term}, ${c.minutes} minutos`,
    seed: (seed: number): string => `semilla ${seed}`,
    goals: {
      title: "objetivos",
      help: `El pueblo sube de ${rankNoun(0).one} a ${rankNoun(1).one}, ${rankNoun(2).one} y ${rankNoun(3).one}. Cumple a la vez todos los objetivos del rango siguiente y mantenlos dos minutos: la corona envía una recompensa, y el juego sigue. Un rango nunca se pierde.`,
      top: (now: number): string => `${capital(a(rankNoun(now)))}, el rango más alto: ${agree(rankNoun(now), "mantenlo", "mantenla")} en pie, mandato tras mandato.`,
      holding: (now: number, left: string): string => `Todos cumplidos: mantenlos ${left} más y ${the(rankNoun(now))} será ${a(rankNoun(now + 1))}.`,
      toward: (now: number): string => `${capital(a(rankNoun(now)))} por ahora: con esto llegará a ser ${a(rankNoun(now + 1))}.`
    },
    approval: {
      title: "aprobación",
      help: "Las casas alojan a más habitantes cuando la aprobación es alta y a menos cuando es baja. A −50 durante dos minutos, el pueblo echa al alcalde.",
      heading: "ahora → hacia"
    },
    treasury: {
      title: "tesoro",
      help: `Monedas por minuto. Los impuestos solo vienen de casas con comida, en proporción a las necesidades que tienen cubiertas. La administración se calcula por casa y crece más rápido que el pueblo: en un pueblo grande, ${agree(cottage, "otro", "otra")} ${cottage.one} cuesta más o menos lo que paga, mientras que ${a(citizensHome)} o ${a(townhouse)} aloja a dos o tres veces más gente por el mismo coste. Tres minutos en deuda y el pueblo está en bancarrota.`,
      taxes: "impuestos",
      supplied: "si todas las casas estuvieran abastecidas",
      trade: "comercio",
      upkeep: "mantenimiento",
      admin: "administración",
      net: "por minuto",
      /** The sum of the above, with its sign: "+12 monedas". */
      netCoins: (n: number): string => amount.coins(n, true),
      leftOnTable: (gap: number): string => `${amount.rate(gap)} desaprovechadas: una casa con hambre no paga nada, ${a(cottage)} con ${goods.bread.name} paga la mitad más, una calle bonita una cuarta parte más`
    },
    taxes: {
      title: "tipos de impuesto",
      help: `Los impuestos bajos suben la aprobación, los altos la bajan, según cuántos habitantes hay de cada clase. Por encima del 100% algunos habitantes además se van, ${theMany(settlers)} antes que ${theMany(citizens)}, así que un tipo más alto no siempre recauda más: bajo cada tipo está lo que pagarían las casas en cada escalón una vez asentadas. Por encima del ${mood.grudge.above}% el pueblo guarda además un rencor que dura más que el tipo: bajar los impuestos al final no borra un mandato entero de apretar.`,
      slider: "Arrastra para fijar el tipo; doble clic para el 100% habitual",
      /** What a rate does to approval (`sway`: 0 at the usual rate), and whether it is high enough to leave a grudge. */
      effect: (sway: number, grudge: boolean): string =>
        `${sway === 0 ? "el tipo habitual" : `${signed(sway)} de aprobación`}${grudge ? " · mientras siga tan alto crece un rencor, que se desvanece despacio" : ""}`,
      /** Taxes a minute at each step of the rate, and the step that brings in most. */
      outlook: (steps: ReadonlyArray<{ readonly rate: number; readonly taxes: number }>, best: number): string =>
        `impuestos por minuto, una vez asentados: ${steps.map((o) => `${o.rate}% ${o.taxes}`).join(" · ")} · el máximo al ${best}%`,
      outlookTitle: "Impuestos por minuto de todas las casas si el tipo se quedara ahí y las casas se asentaran: por encima del 100% los habitantes se van, y la aprobación sigue al tipo"
    },
    people: {
      title: "habitantes",
      settlers: settlers.other,
      citizens: citizens.other,
      burghers: `de ellos, ${burghers.other}`,
      homes: "casas",
      jobs: "empleos cubiertos",
      jobsOf: (employed: number, jobs: number): string => `${employed} de ${jobs}`,
      staffed: "cada lugar de trabajo tiene su plantilla",
      /** How many workplaces are short, the first few (`more`: there are others), and where to find them. */
      short: (n: number, places: ReadonlyArray<ShortPlace>, more: boolean): string =>
        `${n} con falta de trabajadores: ${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? " (nadie a su alcance)" : ""}`).join(", ")}${more ? ", …" : ""} · haz clic en el contador de empleos para visitarlos`
    },
    needs: {
      title: "casas abastecidas",
      help: `Una casa con hambre no paga impuestos. ${capital(toMany("a", settlers))} les hace falta comida (${goods.fish.name}, ${goods.smoked.name} o ${goods.bread.name}) de ${a(kind("market"))}, y ${a(cottage)} que además tiene ${goods.bread.name} paga la mitad más; una visita da a una casa un pescado o un pan por cada cuatro habitantes, así que ${a(citizensHome)} come el doble que ${a(cottage)} y ${a(townhouse)} el triple; ${citizens.other} y ${burghers.other} necesitan ${goods.bread.name}, ${goods.cloth.name} y fe, y ${theMany(burghers)} además ${goods.furniture.name} de ${a(kind("carpenter"))}. ${capital(theGood("cloth"))} solo ${verb("cloth", "llega", "llegan")} a calles con atractivo 5 o más, ${theGood("furniture")} a calles de 12 o más. ${capital(theGood("fish"))} se echa a perder en unos tres minutos y ${theGood("bread")} en cinco; ${a(kind("granary"))} los conserva cinco veces más tiempo.`,
      larder: "comida en el almacén",
      eaten: "comido · podrido en el último minuto",
      trouble: "casas con enfermos · en llamas"
    },
    crown: {
      title: "la corona",
      help: "Enviar lo que pide la corona da monedas. Una petición sin respuesta es una multa, y el pueblo recuerda el desaire durante un tiempo; demasiadas seguidas sin respuesta y la corona destituye al alcalde.",
      tally: "atendidas · sin respuesta",
      /** An open request: `what` (so many of a good) is set in bold. */
      wants: (what: string, left: string, reward: string): string => `Quiere ${what} · quedan ${left} · ${reward}`,
      what: (good: GoodId, n: number): string => quantity(good, n),
      reward: (coins: number): string => amount.coins(coins, true),
      next: (left: string, patience: number): string => `Próxima petición en ${left} · ${patience} seguidas sin respuesta acaban con el mandato`
    },
    trade: {
      title: "mercancías y comercio",
      help: "Los mercaderes pasan cada pocos segundos. Arrastra el control de una mercancía a la izquierda para vender lo que pase de lo que guarda el pueblo, a la derecha para comprar hasta esa cantidad (a la mitad más de precio): cuanto más lejos, más en cada visita; en el centro ni se vende ni se compra. Los precios bajan cuando el pueblo vende y suben, tres veces más rápido, cuando compra; un precio caro tarda en calmarse, así que comprar cubre una falta, pero un pueblo que come comida comprada paga más cada minuto.",
      keep: "guardar en el almacén",
      keepTitle: "Cuánto guarda el pueblo de cada mercancía: solo vende por encima de esto, y solo compra hasta esto",
      keepNote: "de cada mercancía: se vende solo por encima, se compra solo hasta aquí",
      deal: (good: GoodId): string =>
        `Arrastra a la izquierda para vender ${theGood(good)}, a la derecha para comprar${them(good)}; cuanto más lejos, más cada vez que pasan los mercaderes. Doble clic para dejar de comerciar con ${agree(goods[good], goods[good].counted ? "ellos" : "él", goods[good].counted ? "ellas" : "ella")}.`,
      /** What a good's slider is set to: nothing, or the most it sells or buys a minute. */
      none: "sin comercio",
      sell: (most: number): string => `vende ≤${most}/min`,
      buy: (most: number): string => `compra ≤${most}/min`,
      /** A good's price in coins ("m", for monedas), and (when it is not the usual) in percent of the usual: "3,5m (120%)". */
      price: (coins: number, percent: number | null): string => `${decimal(coins)}m${percent === null ? "" : ` (${percent}%)`}`,
      asks: "lo que piden los mercaderes por una unidad",
      pays: "lo que pagan los mercaderes por una unidad"
    },
    chronicle: "crónica"
  },
  build: {
    title: "construir",
    sub: token.device("Elige uno y toca el mapa donde va", "Elige uno y haz clic en el mapa · Esc para terminar"),
    categories: { storage: "almacenes", gathering: "recolección", crafts: "oficios", food: "comida", services: "servicios" } satisfies Record<Category, string>,
    cost: "coste",
    does: "hace",
    /** What keeps the town from building something yet, in place of what it is for. */
    needsResidents: (n: number): string => `se necesitan ${n} habitantes`,
    needsCitizens: (n: number): string => `se necesitan ${n} ${citizens.other}`,
    /** What each of a building's chips says on hover. */
    recipe: (r: { readonly input: GoodId | null; readonly inputs: number; readonly output: GoodId; readonly batch: number; readonly seconds: number }): string =>
      `${r.input ? `convierte ${quantity(r.input, r.inputs)} en ${quantity(r.output, r.batch)}` : `produce ${quantity(r.output, r.batch)}`} cada ${decimal(r.seconds)} s`,
    serves: (range: number): string => `sus recorridos atienden a las casas a no más de ${range} casillas de camino de su puerta`,
    holds: (cap: number, keeps: number | null): string => `guarda hasta ${cap} de cada mercancía${keeps === null ? "" : `, y conserva la comida ${keeps} veces más tiempo`}`,
    // "to work it" would need the building's gender: "para trabajar allí" needs none.
    crew: (workers: number, tier: Tier): string => `${count(workers, tiers[tier].people)} para trabajar allí, de casas a no más de ${COMMUTE} casillas de camino`,
    appeal: (value: number, reach: number): string => `atractivo ${plus(value)} al lado, hasta ${count(reach, cell)}${value < 0 ? ": mantén lejos las casas" : ": a las casas les gusta"}`,
    upkeep: "mantenimiento: monedas por minuto mientras sigue en pie (un cuarto en pausa)",
    /** A building's whole line on hover: what it is, who works it, how far it reaches, what it does to its street, and what it costs to keep. */
    option: (id: KindId, k: { readonly workers: number; readonly citizens: boolean; readonly range: number | null; readonly appeal: { readonly value: number; readonly reach: number } | null; readonly upkeep: number }): string =>
      `${names.kind.title(id)}: ${built(id).blurb}${k.workers > 0 ? ` · ${count(k.workers, k.citizens ? citizens : settlers)} trabajando, de casas a no más de ${COMMUTE} casillas de camino` : ""}${k.range === null ? "" : ` · sus recorridos llegan a ${k.range} casillas de camino`}${k.appeal ? ` · atractivo ${plus(k.appeal.value)} hasta ${count(k.appeal.reach, cell)}` : ""} · ${amount.rate(k.upkeep)}`,
    parks: {
      title: "parques",
      help: `Pon terreno y luego coloca adornos encima. El terreno que se toca es un solo parque: cuanto más tiene, más bonitas son las calles de alrededor (${theMany(citizens)} necesitan ${home.tiers[2].appeal}; ${theMany(townhouse)}, ${home.tiers[3].appeal}). Cuenta un adorno por cada ${park.cellsPerProp} casillas; donde se juntan parques, el más bonito cuenta entero.`,
      ground: "terreno · arrastra un rectángulo",
      furnishings: "adornos · haz clic en una casilla de parque",
      beauty: "belleza que añade a su parque",
      upkeep: "mantenimiento, monedas por minuto",
      /** A park piece's whole line on hover: `name` and `blurb` are its own. */
      piece: (name: string, blurb: string, p: { readonly beauty: number; readonly upkeep: number; readonly ground: boolean }): string =>
        `${name}: ${blurb} · belleza +${decimal(p.beauty)}${p.ground ? " por casilla" : ""} · ${decimal(p.upkeep)} monedas por minuto`
    }
  },
  /** The panel of what is picked: a building, a home, a park, or a ruin. */
  selection: {
    park: "parque",
    ruin: "ruina",
    /** Under the heading: who lives in a home of each tier, and what a ruin or a park is for. */
    home: {
      1: `aquí viven ${theMany(settlers)}, que hacen el trabajo duro`,
      2: `aquí viven ${theMany(citizens)}, que hacen el trabajo de oficio y pagan el doble`,
      3: `aquí viven ${theMany(burghers)}, que pagan los mejores impuestos`
    } satisfies Record<Tier, string>,
    aboutRuin: "derríbala para despejar el solar",
    aboutPark: "cada casilla de terreno que toca esta: pon más, o coloca adornos, para que las calles de alrededor sean más bonitas",
    status: "estado",
    /** How a building is, in a word, when nothing is wrong with it: phrases that agree with no building, whatever its gender. */
    statuses: {
      building: "en obras",
      idle: "en reposo",
      working: "trabajando",
      starved: "sin suministros",
      blocked: "sin salida",
      unstaffed: "sin trabajadores",
      unconnected: "sin camino",
      paused: "en pausa"
    } satisfies Record<Status, string>,
    // Said of the ruin ("ruina", above): feminine.
    causes: { burnt: "quemada", collapsed: "derrumbada", derelict: "abandonada" } satisfies Record<Extract<Panel, { readonly type: "ruin" }>["cause"], string>,
    /** A park's worth in a word: the desirability it gives, and how far. */
    parkWorth: (value: number, reach: number): string => `${plus(value)} hasta ${count(reach, cell)}`,
    whatMakesIt: "de qué está hecho",
    whatIsLeft: "qué queda",
    pause: "Pausar el trabajo",
    resume: "Reanudar el trabajo",
    pauseTitle: "Un edificio en pausa no tiene trabajadores y paga un cuarto de su mantenimiento",
    closeHome: "Cerrar la casa",
    reopenHome: "Reabrir la casa",
    closeTitle: `Una casa cerrada se queda vacía: sin impuestos, y sin coste para la administración ${to("de", kind("townhall"))}. Reábrela y ${theMany(settlers)} vuelven.`,
    remove: "Quitar"
  },
  /** What upgrading a building would cost and give: `to` is the level it would stand at. */
  upgrade: {
    title: (id: KindId, level: number): string => `mejora a ${kind(id, level).one}`,
    begin: (id: KindId, level: number): string => `Empezar ${the(kind(id, level))}`,
    needed: (why: string): string => `hace falta ya: ${why}`,
    notNeeded: "aún no hace falta: la flecha dorada indica cuándo",
    pay: "pagas",
    get: "obtienes",
    now: "ahora, para empezar",
    price: (coins: number): string => token.coins(coins),
    short: (coins: number): string => `${lacking(coins)} ${token.coins(coins)}`,
    later: "después, traído",
    lacks: (short: ReadonlyArray<{ readonly good: GoodId; readonly count: number }>): string =>
      `al almacén le ${lacking(short.reduce((n, l) => n + l.count, 0))} ${short.map((l) => token.amount(l.good, l.count)).join(", ")}: las obras esperan`,
    fromStore: "del almacén: las obras avanzan a medida que llegan",
    upkeepAfter: "mantenimiento después",
    goesOn: "sigue trabajando mientras duran las obras, y los andamios se alzan dentro de su solar"
  },

  // ── The sheets ──────────────────────────────────────────────────────────

  /** Founding a town: the charter. */
  charter: {
    by: "de",
    sub: "Elige la tierra, y haz crecer el pueblo hasta su objetivo antes de que acabe el mandato.",
    land: {
      title: "tierra",
      /** What a land of this size asks of a town: each figure is a chip. */
      note: (residents: string, income: string): string => `${a(rankNoun(TOWN_RANK))} con ${residents}${income}`,
      residents: (n: number): string => `${n} habitantes`,
      income: (coins: number): string => `+${coins}/min`,
      tip: (residents: number, income: number): string =>
        `El rango de ${rankNoun(TOWN_RANK).one} pide ${residents} habitantes y unos ingresos de ${amount.rate(income)}; ${a(rankNoun(TOWN_RANK - 1))} menos, ${a(rankNoun(TOWN_RANK + 1))} más`
    },
    term: {
      title: "mandato",
      label: (minutes: number): string => `${minutes} min`,
      years: (years: number, minutes: number): string => `${years} años de ${decimal(minutes)} min`,
      winters: (n: number): string => count(n, winter),
      tip: (minutes: number, years: number): string => `${minutes} minutos a 1×: ${years} años, con un invierno al final de cada uno después del primero`
    },
    richness: {
      title: "riqueza",
      coins: (n: number): string => `${amount.coins(n)} para empezar`
    },
    reroll: "↻ otra tierra",
    rerollTitle: (seed: number): string => `Saca otra tierra (esta es la semilla ${seed})`,
    cells: (n: number): string => count(n, cell),
    trees: (n: number): string => `${n} árboles`,
    // What the land holds is counted in rocks and in veins of ore: "18 de piedra" would be a weight of it.
    stone: (n: number): string => count(n, f("roca", "rocas")),
    ore: (n: number): string => count(n, f("veta", "vetas")),
    start: "Nueva partida",
    resume: "Continuar partida",
    /** The town saved in this browser, by its title, and (when known) how long ago it was saved. */
    resumeTitle: (title: string, saved: string | null): string => `Sigue con el pueblo guardado en este navegador: ${title}${saved === null ? "" : `, guardado ${saved}`}`
  },
  /** The end of the term. */
  reckoning: {
    lost: "el mandato se ha perdido · mira cómo",
    over: (term: number): string => `el mandato ${term} ha terminado · mira cómo`,
    /** The heading of a term that ran its course: `verdict` is one of `verdict` below. */
    title: (term: number, verdict: string): string => `el mandato ${term} ha terminado: ${verdict}`,
    /** What became of a town whose term ran out: phrases, since the card says it after the rank ("una villa", "un caserío"), whose gender varies. */
    verdict: { unrooted: "el pueblo nunca echó raíces", flourishing: "en auge", holding: "resistiendo", declining: "en declive" },
    facts: {
      rank: "rango",
      minutes: "minutos en el cargo",
      residents: "habitantes",
      citizens: `${citizens.other} · ${burghers.other}`,
      coins: "monedas",
      approval: "aprobación",
      crown: "corona: atendidas · no",
      score: "puntuación"
    },
    legend: "— habitantes (discontinua: el próximo rango) · monedas · - - aprobación · sombreado: inviernos",
    next: "Siguiente mandato",
    nextTitle: (minutes: number): string => `Sigue en el cargo otros ${minutes} minutos: el mismo pueblo, inviernos nuevos, y las peticiones de la corona vuelven a empezar pequeñas`,
    retire: "Retirarse: fundar un pueblo nuevo",
    found: "Fundar un pueblo nuevo",
    look: "Mirar el pueblo",
    share: "Compartir el pueblo",
    shareTitle: "Una imagen del pueblo y su veredicto, o un enlace que cualquiera puede abrir"
  },
  /** The picture a town is shared as, and the lines a link to it previews with. */
  card: {
    /** How a lost term ended (`ended`: the view's word for it), as a headline. */
    lost: (ended: string): string => capital(ended),
    over: (now: number, term: number, verdict: string): string => `${capital(a(rankNoun(now)))}: el mandato ${term} ha terminado, ${verdict}`,
    playing: (now: number, year: number, term: number): string => `${capital(a(rankNoun(now)))} · año ${year} · mandato ${term}`,
    land: (size: SizeId, land: LandId, minutes: number): string => `${capital(landOf(size, land))} · mandato de ${minutes} minutos`,
    residents: "habitantes",
    citizens: citizens.other,
    coins: "monedas",
    approval: "aprobación"
  },
  share: {
    title: "compartir el pueblo",
    sub: "Publica la imagen donde quieras, o crea un enlace: quien lo abra verá este pueblo en marcha, desde donde lo miras ahora, y podrá seguir jugando desde aquí.",
    /** The picture's button: a phone hands it to its share sheet, a computer saves it. */
    sharePicture: "Compartir la imagen",
    savePicture: "Guardar la imagen",
    makeLink: "Crear un enlace",
    making: "Creando un enlace…",
    again: "Reintentar el enlace",
    shareLink: "Compartir el enlace",
    copyLink: "Copiar el enlace",
    open: "Abrir",
    noPicture: "No se ha podido crear la imagen",
    /** What handing the picture or the link to the device came to. */
    offered: {
      shared: () => "Compartido",
      notShared: () => "No compartido",
      saved: (o) => `Imagen guardada como ${o.name}`,
      copied: () => "Enlace copiado",
      link: (o) => o.url
    } satisfies Wording<Offered>,
    /** Why a town could not be shared, or a shared one opened. What the server itself says (`error`) is in its own words. */
    failed: {
      unreachable: (failure) => (failure.sending ? "No se ha podido conectar con el servidor para compartir el pueblo" : "No se ha podido conectar con el servidor para ese pueblo"),
      notFound: () => "No hay ningún pueblo compartido con ese enlace (los pueblos compartidos se guardan seis meses)",
      refused: (failure) => `${failure.sending ? "No se ha podido compartir el pueblo" : "No se ha podido abrir ese pueblo"}: ${failure.error ?? `el servidor ha respondido ${failure.status}`}`,
      unpacked: () => "No se ha podido empaquetar el pueblo"
    } satisfies Wording<ShareFailure>,
    notShared: "No se ha podido compartir el pueblo",
    notOpened: "No se ha podido abrir ese pueblo"
  },
  /** Visiting a shared town. */
  visit: {
    shared: "un pueblo compartido",
    play: "Jugar desde aquí",
    playTitle: "Haz tuyo este pueblo: construye, gobierna, y se guarda solo en este navegador",
    yours: "El pueblo es tuyo: se guarda solo mientras juegas",
    own: "Funda el tuyo"
  },
  /** Saving and loading. */
  save: {
    notReady: "Aún no está listo",
    saved: "Guardado",
    /** A save's title, as it is listed: "tierra mediana y regular · año 2 · 23 min de juego". */
    title: (c: { readonly size: SizeId; readonly land: LandId; readonly year: number; readonly minutes: number }): string =>
      `${landOf(c.size, c.land)} · año ${c.year} · ${c.minutes} min de juego`,
    untitled: "un pueblo",
    /** A save from before saves had titles. */
    earlier: "una partida anterior",
    loaded: (title: string): string => `Cargado: ${title}`,
    loadedAuto: (title: string): string => `Cargado el guardado automático: ${title}`,
    /** What went wrong with a save. */
    trouble: {
      nothingSaved: (e) => (e.auto ? "Aún no hay guardado automático" : "Aún no hay nada guardado"),
      unreadable: () => "No se ha podido leer la partida guardada",
      wrongVersion: (e) => (e.older ? "Esa partida es de una versión más antigua del juego" : "Esa partida es de una versión más nueva del juego"),
      rejected: (e) => `La partida no encaja con este juego: ${e.reason}`,
      storageFailed: (e) => `No se ha podido guardar: ${e.reason}`,
      unsaveable: (e) => `No se ha podido guardar el pueblo: ${e.reason}`
    } satisfies Wording<Trouble>
  },
  /**
   * News of the next Typeonce game (`ui/dom/brand/signup.ts`): the card at the first spring, and the panel on the
   * reckoning. "Typeonce Games" is a name, and stays.
   */
  signup: {
    label: "Juegos nuevos de Typeonce Games",
    moment: { lead: "Primavera del año 3.", text: "El pueblo ha superado su primer invierno." },
    headline: "Juega antes que nadie al próximo juego de Typeonce",
    body: "Inkline Town es obra de Typeonce Games. Deja tu correo y el próximo juego gratuito te llegará el día que salga.",
    email: "Correo electrónico",
    placeholder: "tu@ejemplo.com",
    submit: "Recibir juegos nuevos",
    keep: "Seguir jugando",
    outcome: {
      ok: "Revisa tu correo para confirmar.",
      invalid_email: "Esa dirección no parece correcta.",
      rate_limited: "Demasiados intentos. Espera un minuto y vuelve a intentarlo.",
      unavailable: "No ha funcionado. Vuelve a intentarlo."
    }
  },
  /** On the card shown while the town is drawn for the first time (the page's own HTML says it in English until the language is known). */
  loading: "dibujando el pueblo…",
  /** The town could not start, or stopped: said in place of the page. */
  fatal: {
    start: (why: string): string => `El pueblo no ha podido arrancar: ${why}`,
    frame: (delta: number): string => `Delta de fotograma no válido: ${delta}`,
    stopped: "El pueblo se ha detenido tras un fallo del sistema.",
    loop: (field: string): string => `Opción del bucle de paso fijo no válida: ${field}`
  }
} satisfies typeof English
