/**
 * Spanish for the mayor's guide (`game/rules/guide.ts`): what each step
 * asks for, why, and what closes it; and what the guide says of the town as
 * it stands (what is under way, what opens a building, what comes next).
 * The same steps and the same tokens as English's (`../en/guide.ts`), in
 * sentences of Spanish's own.
 *
 * As in English, a step is one thing to do (`action`, one sentence), one
 * reason (`why`), and what puts it away (`goal`); tools, panels, and map
 * views are tokens, and what a finger and a mouse do is said with
 * `token.device` ("toca", "haz clic en"). Amounts stay words. A goal reads
 * after "meta:" (`page.ticker.doneWhen`), so it is a phrase ("una pesquería
 * en pie", "abrir el panel del pueblo"), not a clause that would want the
 * subjunctive after "cuando".
 *
 * Every building and good is a chip written through `chips.ts`, its
 * article or preposition outside the chip and agreeing with the noun:
 * nothing here writes "el", "una", or "del" before one by hand. Where
 * English refers back to a good with "it", the pronoun comes from the good
 * itself (`them`: "la convierte en tablas"), and a verb whose subject is a
 * good takes the good's number (`verb`).
 */
import type { GoodId } from "../../game/content/index.ts"
import type { Chapter, GuideLocked, GuideSoon, GuideStepId, GuideWaiting } from "../../game/rules/guide.ts"
import type { guide as English } from "../en/guide.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { aKind, good, kind, kinds, theGood, theKind, toGood, toKind } from "./chips.ts"
import { a, agree, capital, the, theArticle, theMany, to } from "./grammar.ts"
import { built, goods, rankNoun, tiers } from "./nouns.ts"

const tool = token.command
/** A map view's chip: each is a "mapa …", so a sentence gives it "el". */
const map = token.view
const tap = token.device("toca", "haz clic en")
const Tap = token.device("Toca", "Haz clic en")
/** A verb in the number its good is spoken of in: "las tablas se acaban", "la piedra se acaba". */
const verb = (id: GoodId, one: string, many: string) => (goods[id].counted ? many : one)
/** The pronoun that stands for a good as an object: "lo", "la", "los", "las". */
const them = (id: GoodId) => (goods[id].counted ? agree(goods[id], "los", "las") : agree(goods[id], "lo", "la"))
const runsLow = (id: GoodId) => `${capital(theGood(id))} ${verb(id, "se está acabando", "se están acabando")}`
/** "una pesquería en pie": a building stands, said so that nothing agrees with its gender. */
const stands = "en pie"
const rank = (n: number) => rankNoun(n).one
const hall = the(built("townhall").noun)
const speed = `Con ${tool("speed")} el tiempo corre más rápido.`

/** A step in words: what to do, why, and when it is done. */
interface Step {
  readonly action: string
  readonly why: string
  readonly goal: string
}

const chapters = {
  founding: "Fundación",
  standing: "Mantenerlo en pie",
  citizens: "Atraer ciudadanos",
  governing: "Gobernar"
} satisfies Record<Chapter, string>

const steps = {
  // ── The opening, in order ──
  homes: {
    action: `Elige ${tool("homes")} y arrastra a lo largo del camino gris que rodea ${hall}${token.device(", y luego toca Colocar", "")}.`,
    why: `${capital(theMany(tiers[1].people))} se mudan a las casas que tocan un camino, y cada casa paga impuestos: los ingresos del pueblo.`,
    goal: `una casa ${stands}`
  },
  road: {
    action: `Elige ${tool("road")} y traza un camino desde el ${to("de", built("townhall").noun)} hacia el agua.`,
    why: `Todo edificio necesita un camino que toque el centro de uno de sus lados, o nadie puede llegar a él. Luego viene ${theKind("fishery")}, que necesita agua cerca.`,
    goal: "un camino a dos casillas del agua"
  },
  fishery: {
    action: `${Tap} ${kind("fishery")} y luego elige un sitio en ese camino, con el agua a dos casillas como mucho.`,
    why: `${capital(theMany(tiers[1].people))} comen ${good("fish")}. El pueblo empieza con un poco, y en el almacén ${theGood("fish")} ${verb("fish", "se echa", "se echan")} a perder.`,
    goal: `${aKind("fishery")} ${stands}`
  },
  look: {
    action: `Elige ${tool("select")} y ${tap} ${theKind("fishery")} para abrir su panel.`,
    why: "Un edificio necesita trabajadores de casas a 15 casillas de camino como mucho; su panel dice cuántos tiene y qué lo frena. El contador de empleos de arriba los suma todos.",
    goal: "abrir el panel de un edificio"
  },
  lumberjack: {
    action: `Construye ${aKind("lumberjack")} en un camino junto a los árboles.`,
    why: `${runsLow("planks")}, y cada casa y cada edificio ${them("planks")} necesita. ${capital(toGood("de", "wood"))} ${verb("planks", "sale", "salen")} ${theGood("planks")}.`,
    goal: `${aKind("lumberjack")} ${stands}`
  },
  sawmill: {
    action: `Construye ${aKind("sawmill")} en un camino cerca ${toKind("de", "lumberjack")}.`,
    why: `Las mercancías van en cadena: ${theKind("lumberjack")} tala ${good("wood")}, y ${theKind("sawmill")} ${them("wood")} convierte en ${good("planks")}. Los porteadores llevan las mercancías de uno a otro por los caminos.`,
    goal: `${aKind("sawmill")} ${stands}`
  },
  term: {
    action: `Abre el panel ${tool("town")} y lee los objetivos de arriba.`,
    why: `Cumplirlos hace subir al pueblo de ${rank(0)} a ${rank(1)}, ${rank(2)} y ${rank(3)}, cada vez con una recompensa de la corona. Con ${tool("pause")} paras el reloj cuando necesites pensar.`,
    goal: "abrir el panel del pueblo"
  },
  grow: {
    action: "Traza más caminos y casas hasta que haya diez casas en pie.",
    why: `Más gente paga más impuestos, y desbloquea edificios nuevos en ${tool("build")}. La guía pide un edificio solo cuando el pueblo lo necesita.`,
    goal: `10 casas ${stands}`
  },

  // ── The course goes on: citizens ──
  quarry: {
    action: `Construye ${aKind("quarry")} en un camino junto a las rocas claras.`,
    why: `${runsLow("stone")}, y los talleres que piden ${theMany(tiers[2].people)} también ${them("stone")} necesitan. Las rocas oscuras son ${good("ore")}, para más adelante.`,
    goal: `${aKind("quarry")} ${stands}`
  },
  cloth: {
    action: `Construye ${aKind("sheep")} y ${aKind("weaver")}, en caminos cercanos entre sí.`,
    why: `Una casa pasa a ser ${a(tiers[2].home)} con ${good("bread")}, ${good("cloth")} y fe. ${capital(theKind("sheep"))} esquila ${good("wool")}, y ${theKind("weaver")} ${them("wool")} convierte en ${good("cloth")}.`,
    goal: `${aKind("sheep")} y ${aKind("weaver")} ${stands}`
  },
  chapel: {
    action: `Construye ${aKind("chapel")} en un camino entre las casas.`,
    why: `La fe es la segunda necesidad. El cura ${toKind("de", "chapel")} la lleva a las casas por las que pasa, y ${theKind("chapel")} hace más agradable vivir en su calle.`,
    goal: `${aKind("chapel")} ${stands}`
  },
  wheat: {
    action: `Construye ${aKind("farm")} y ${aKind("mill")}.`,
    why: `${capital(theGood("bread"))} es la tercera necesidad, y la cadena más larga: ${theKind("farm")} cultiva ${good("wheat")}, y ${theKind("mill")} ${them("wheat")} convierte en ${good("flour")}.`,
    goal: `${aKind("farm")} y ${aKind("mill")} ${stands}`
  },
  bakery: {
    action: `Construye ${aKind("bakery")} cerca ${toKind("de", "mill")}.`,
    why: `Hornea ${theGood("flour")} ${toKind("de", "mill")} para hacer ${good("bread")}. Hasta ${a(tiers[1].home)} con ${good("bread")} en la mesa paga la mitad más.`,
    goal: `${aKind("bakery")} ${stands}`
  },
  citizens: {
    action: `Elige ${tool("select")} y ${tap} una casa para ver qué le falta todavía para alojar ${tiers[2].people.other}.`,
    why: `Con ${good("bread")}, ${good("cloth")}, fe y una calle de atractivo 5, una casa crece en cuanto el almacén paga ${theGood("planks")} y ${theGood("stone")}. Su panel dice qué falta.`,
    goal: `la primera casa con ${tiers[2].people.other}`
  },
  goals: {
    action: `Abre el panel ${tool("town")} para ver cuánto falta para los objetivos.`,
    why: `Han llegado ${theArticle(tiers[2].people, true)} ${agree(tiers[2].people, "primeros", "primeras")} ${tiers[2].people.other}, y cada rango pide una parte mayor de ellos.`,
    goal: "abrir el panel del pueblo"
  },
  ranks: {
    action: `Cumple todos los objetivos del panel ${tool("town")} para subir el rango del pueblo.`,
    why: `Mantenlos dos minutos y el pueblo sube, hasta llegar a ${rank(3)}. El rango de ${rank(2)} abre las mejoras ${toKind("de", "market")} y ${toKind("de", "chapel")}. La guía te avisa cuando algo te necesita.`,
    goal: `llegar a ser ${a(rankNoun(3))}`
  },

  // ── Around the course, when the town needs them ──
  crown: {
    action: "Envía a la corona lo que pide, con el botón «enviar» de su petición, arriba.",
    why: "Paga en monedas. Una petición sin respuesta es una multa, y tres seguidas sin responder acaban con tu mandato.",
    goal: "enviar las mercancías"
  },
  winter: {
    action: `Construye ${aKind("granary")} o ${aKind("smokehouse")} antes de que llegue el invierno.`,
    why: `En invierno la pesca va más lenta, las casas comen más y en el almacén ${theGood("fish")} ${verb("fish", "se echa", "se echan")} a perder. ${capital(aKind("granary"))} ${them("fish")} conserva cinco veces más tiempo, y ${theGood("smoked")} ${verb("smoked", "aguanta", "aguantan")} todo el invierno.`,
    goal: `${aKind("granary")} o ${aKind("smokehouse")} ${stands}`
  },
  tools: {
    action: `En el panel ${tool("town")}, en mercancías y comercio, pon ${theGood("tools")} en comprar.`,
    why: `Los talleres gastan ${theGood("tools")}, y solo ${aKind("smithy")} ${them("tools")} fabrica: se abre con 10 ${tiers[2].people.other}.`,
    goal: `comprar ${good("tools")}, o ${aKind("smithy")} ${stands}`
  },
  forester: {
    action: `Construye ${aKind("forester")} junto ${toKind("a", "lumberjack")}.`,
    why: `${capital(theKind("lumberjack"))} se está quedando sin árboles, y ${aKind("forester")} le planta otros nuevos.`,
    goal: `${aKind("forester")} ${stands}`
  },
  firewatch: {
    action: `Construye ${aKind("firewatch")} en un camino entre las casas.`,
    why: `Las casas de madera prenden fuego, y un incendio salta a las vecinas. Su vigilante mantiene bajo el riesgo, y sus bomberos apagan los incendios. El ${map("fire")} muestra el riesgo.`,
    goal: `${aKind("firewatch")} ${stands}`
  },
  builder: {
    action: `Construye ${aKind("builder")} cerca de los edificios desgastados.`,
    why: `Un edificio deteriorado trabaja a medio ritmo y puede derrumbarse. Su albañil repara lo que encuentra a su paso, con ${good("planks")} y ${good("stone")}. El ${map("condition")} muestra cómo están.`,
    goal: `${aKind("builder")} ${stands}`
  },
  market: {
    action: `Construye ${aKind("market")} entre las casas más alejadas ${to("de", built("townhall").noun)}.`,
    why: `Algunas casas quedan fuera del alcance del repartidor ${to("de", built("townhall").noun)}, que solo llega a 20 casillas de camino, y se quedan sin comida. El de ${aKind("market")} la lleva más lejos.`,
    goal: `${aKind("market")} ${stands}`
  },
  markethall: {
    action: `${Tap} ${theKind("market")} (la flecha dorada encima) y empieza ${theKind("market", 1)} desde su panel.`,
    why: `Algunas casas quedan fuera del alcance de todo repartidor de comida. El de ${aKind("market", 1)} llega más lejos y más a menudo, sin pagar el mantenimiento de dos ${kinds("market")}.`,
    goal: `${aKind("market", 1)} ${stands}`
  },
  street: {
    action: `Sube la calle de esta casa a atractivo 5: añade cerca ${aKind("chapel")}, ${aKind("market")} o un parque, y aleja los talleres.`,
    why: `Tiene ${good("bread")}, ${good("cloth")} y fe, pero ${theMany(tiers[2].people)} solo viven en una calle decente. El ${map("appeal")} lo muestra calle a calle.`,
    goal: `${tiers[2].people.other} en una casa de una calle bonita`
  },
  carpenter: {
    action: `Construye ${aKind("carpenter")}: hace ${good("furniture")} con ${good("planks")}.`,
    why: `${capital(theMany(tiers[3].people))} viven en ${tiers[3].home.other}, y ${a(tiers[3].home)} pide ${good("furniture")}: dos piezas para llegar a serlo, y de vez en cuando una nueva ${toKind("de", "market")} para seguir siéndolo. Son las casas que más pagan y más gente alojan.`,
    goal: `${aKind("carpenter")} ${stands}`
  },
  healer: {
    action: `Construye ${aKind("healer")} en un camino entre las casas.`,
    why: `La enfermedad se extiende, y una casa con enfermos aloja a la mitad de la gente. El médico ${toKind("de", "healer")} visita las casas y las cura. El ${map("health")} muestra el riesgo.`,
    goal: `${aKind("healer")} ${stands}`
  },
  watchhouse: {
    action: `Construye ${aKind("watchhouse")} en un camino entre las casas.`,
    why: `Calles pobres, casas medio vacías y poca aprobación atraen ladrones. Su alguacil recorre las calles y mantiene el orden. El ${map("order")} muestra el riesgo.`,
    goal: `${aKind("watchhouse")} ${stands}`
  },
  trade: {
    action: `En el panel ${tool("town")}, en mercancías y comercio, vende una mercancía que se acumule, o compra una que escasee.`,
    why: "El pueblo no comercia nada hasta que se lo digas, y las mercancías que sobran son monedas por ganar.",
    goal: "vender o comprar algo"
  },
  taxes: {
    action: `Sube un poco los impuestos en el panel ${tool("town")}.`,
    why: "El pueblo está contento pero pierde monedas, y la aprobación aguanta impuestos más altos. Por encima del 125% queda un rencor que dura.",
    goal: "cambiar un tipo de impuesto"
  },
  smithy: {
    action: `Construye ${aKind("mine")} junto a las rocas oscuras con vetas de óxido, y ${aKind("smithy")}.`,
    why: `${runsLow("tools")}, y todos los talleres ${them("tools")} gastan. ${capital(theKind("mine"))} extrae ${good("ore")}, y ${theKind("smithy")} ${them("ore")} convierte en ${good("tools")}.`,
    goal: `${aKind("mine")} y ${aKind("smithy")} ${stands}`
  }
} satisfies Record<GuideStepId, Step>

/** What is happening, once the mayor has done a step's part and the town is at work on it. */
const waiting = {
  homesNoPlanks: () => `Las casas esperan ${theGood("planks")}, y en el almacén no queda nada.`,
  homesRising: () => `Los albañiles llevan ${theGood("planks")} del almacén a las casas nuevas, y ${theMany(tiers[1].people)} se mudan en cuanto una está en pie. ${speed}`,
  siteNoPlanks: () =>
    `En el almacén no ${verb("planks", "queda", "quedan")} ${good("planks")}, así que la obra espera: vende algo en el panel ${tool("town")}, o compra allí ${theGood("planks")}.`,
  siteRising: () => `De momento es una obra: los porteadores traen ${theGood("planks")} y ${theGood("stone")} del almacén, y luego los albañiles la levantan. ${speed}`,
  homesLaid: () => "Hay diez casas trazadas: los albañiles las están levantando."
} satisfies Wording<GuideWaiting>

/** Why the town cannot build what a step asks for yet, and what to do meanwhile. */
const locked = {
  residents: (l) => `${capital(theKind(l.kind))} se abre con ${l.needs} habitantes (ahora ${l.now}): pon más ${tool("homes")} y que no les falte comida.`,
  citizens: (l) => `${capital(theKind(l.kind))} se abre con ${l.needs} ${tiers[2].people.other} (ahora ${l.now}).`,
  coins: (l) => `Ahorra: ${theKind(l.kind)} cuesta ${l.cost} monedas (ahora ${l.now}). Las casas pagan impuestos cada minuto.`
} satisfies Wording<GuideLocked>

/** The next step that waits for the town to need it: what it will ask for, and when it comes. */
const below = (id: GoodId, s: { readonly below: number; readonly now: number }) =>
  `cuando ${theGood(id)} ${verb(id, "baje", "bajen")} de ${s.below} (ahora ${s.now})`
const upcoming = {
  lumberjack: (s) => `Después: ${aKind("lumberjack")} y ${aKind("sawmill")}, ${below("planks", s)}.`,
  sawmill: (s) => `Después: ${aKind("sawmill")}, ${below("planks", s)}.`,
  quarry: (s) => `Después: ${aKind("quarry")}, ${below("stone", s)}.`
} satisfies Wording<GuideSoon>

export const guide = { chapters, steps, waiting, locked, upcoming } satisfies typeof English
