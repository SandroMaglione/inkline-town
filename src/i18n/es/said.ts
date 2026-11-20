/**
 * Spanish for what the simulation says as data (`game/said.ts`): the
 * chronicle's news, the answers to an edit, why a term ended, and what
 * something costs and gives back. One function for each thing it can say,
 * as in English; the sentences are Spanish's own, turned where an English
 * one would force an agreement Spanish cannot know (what a fire took, what
 * a thief stole: a bare noun after "se han llevado" needs no article).
 */
import type { GoodId, Kind } from "../../game/content/index.ts"
import type { Salvage } from "../../game/rules/salvage.ts"
import type { Event, Lock, Notice, Reason } from "../../game/said.ts"
import * as token from "../token.ts"
import { say, type Wording } from "../wording.ts"
import { aKind, good, kinds, some, theGood, theKind, toKind } from "./chips.ts"
import { a, agree, and, capital, decimal, f, form, m, numeral, signed, spelt, the, theMany } from "./grammar.ts"
import { at, built, goods, lands, names, of, props, rankNoun, sizes, winters } from "./nouns.ts"

// ── Costs ─────────────────────────────────────────────────────────────────

const entries = (materials: Partial<Record<GoodId, number>>) =>
  (Object.entries(materials) as Array<[GoodId, number]>).filter(([, n]) => n > 0)

/** A cost as amounts side by side: its coins (when it has any), then each material. */
export const cost = (c: Kind["cost"]): string =>
  [...(c.coins > 0 ? [token.coins(c.coins)] : []), ...entries(c.materials).map(([g, n]) => token.amount(g, n))].join(" · ")

/** What pulling something down costs and gives back: "−25 monedas · recuperas 2 tablas, 3 de piedra" (nothing: an empty line). */
export const salvage = (s: Salvage): string => {
  const back = entries(s.back).map(([g, n]) => token.amount(g, n)).join(", ")
  return [...(s.fee !== 0 ? [token.coins(-s.fee, true)] : []), ...(back ? [`recuperas ${back}`] : [])].join(" · ")
}

const coin = f("moneda", "monedas")
/** A number as it is, or (`marked`) with its sign: "+25", "−25". */
const figure = (n: number, marked: boolean) => (marked ? signed(n) : `${n}`)

/** An amount in words, where an icon cannot go (a tooltip, a title): "25 monedas", "+3 monedas por minuto", "2 tablas", "5 de piedra". */
export const amount = {
  coins: (n: number, marked = false): string => `${figure(n, marked)} ${form(Math.abs(n), coin)}`,
  rate: (n: number, marked = false): string => `${figure(n, marked)} ${form(Math.abs(n), coin)} por minuto`,
  good: (id: GoodId, n: number): string => (goods[id].counted ? `${n} ${form(n, goods[id])}` : `${n} de ${goods[id].name}`),
  /** After a number of coins beside their icon: a minute's worth. */
  perMinute: "/min"
}

// ── The chronicle ─────────────────────────────────────────────────────────

const home = f("casa", "casas"), building = m("edificio", "edificios")

export const chronicle = {
  founded: (e) => `Fundado en una tierra ${sizes[e.size]} y ${lands[e.land].name}, por un mandato de ${e.term} minutos.`,
  nextTerm: (e) => `Mandato ${e.term}: el alcalde sigue en el cargo otros ${e.minutes} minutos.`,
  residents: (e) => `${e.mark} habitantes.`,
  treasuryEmpty: () => "El tesoro está vacío: los salarios quedan sin pagar.",
  uproar: () => "El pueblo está alborotado.",
  bankrupt: () => "Bancarrota: la corona le ha quitado el tesoro al alcalde.",
  revolt: () => "Revuelta: el pueblo ha echado al alcalde.",
  abandoned: () => "Abandono: la gente se ha ido del pueblo.",
  dismissed: (e) => `Destitución: la corona ha sustituido a un alcalde que dejó sin respuesta ${e.patience} de sus peticiones.`,
  termOver: (e) => `El mandato ${e.term} ha terminado; ${the(rankNoun(e.rank))} sigue en pie.`,
  goalsMet: (e) => `Todos los objetivos de ${a(rankNoun(e.rank))} están cumplidos: al pueblo solo le queda mantenerlos.`,
  rankReached: (e) => `El pueblo es ahora ${a(rankNoun(e.rank))}: la corona envía ${e.reward} monedas.`,
  crownAsks: (e) => `La corona pide ${some(e.good, e.amount)} en un plazo de ${decimal(e.minutes)} minutos, a cambio de ${e.reward} monedas.`,
  crownUnanswered: (e) => `La corona pidió ${some(e.good, e.amount)} y no hubo respuesta: una multa de ${e.fine} monedas.`,
  crownSent: (e) => `La corona ha recibido ${some(e.good, e.amount)}: ${e.reward} monedas de recompensa.`,
  winter: (e) =>
    `Un invierno ${winters[e.severity]}, año ${e.year}: los campos descansan y ${theMany(built("fishery").noun)} pescan al ${e.fishing}%${e.heating ? "; las casas encienden fuego para calentarse" : ""}.`,
  spring: (e) => `Primavera del año ${e.year}.`,
  winterComing: (e) => `El invierno llega dentro de un minuto, y el almanaque dice que será ${winters[e.severity]}: ${e.larder} de comida en el almacén; el pueblo come ${e.eats} por minuto.`,
  fire: (e) => `¡Incendio ${at(e.place)}!`,
  fireOver: (e) => {
    const took = [...(e.homes > 0 ? [spelt(e.homes, home)] : []), ...(e.buildings > 0 ? [spelt(e.buildings, building)] : [])]
    return `Incendio ${at(e.place)}: ${took.length > 0 ? `el fuego ha destruido ${and(took)}` : "apagado"}.`
  },
  sickness: (e) => `Enfermedad ${at(e.place)}: un médico puede curarla.`,
  theftCoins: (e) => `${capital(at(e.place))}, unos ladrones se han llevado ${e.coins} monedas.`,
  theftGoods: (e) => `${capital(at(e.place))}, unos ladrones se han llevado ${good(e.good)}.`,
  derelict: (e) => `Una casa ${of(e.place)} se quedó vacía tras los robos, y ha quedado abandonada.`,
  collapsed: (e) => {
    if (e.kind === null) return `Una casa ${of(e.place)} se ha derrumbado: nadie la reparó.`
    return `${capital(theKind(e.kind))} ${of(e.place)} se ha derrumbado: nadie ${agree(built(e.kind).noun, "lo", "la")} reparó.`
  },
  rotted: (e) =>
    `${e.rotted === 1 ? "Se ha echado a perder un pescado o un pan" : `Se han echado a perder ${numeral(e.rotted)} entre pescados y panes`} en el almacén en este minuto: ${
      e.made === null
        ? `${aKind("granary")} conserva ${good("fish")} y ${good("bread")} cinco veces más tiempo, y ${theGood("smoked")} no se estropea`
        : `el pueblo produce unos ${e.made} de comida por minuto y come ${e.eaten}: menos ${kinds("fishery")}, ${aKind("smokehouse")} o vender ${good("fish")} evitaría el desperdicio`
    }.`,
  // "Se ha agotado" agrees only in number, and ore and stone are both spoken of as one: no gender to know.
  lastRock: (e) =>
    e.ore
      ? `Se ha agotado ${theGood("ore")} a cielo abierto: los frentes ya trabajados aún dan un poco, despacio. Los mercaderes venden ${good("ore")} y ${good("tools")}.`
      : `Se ha agotado ${theGood("stone")} a cielo abierto: los frentes ya trabajados aún dan un poco, despacio. Los mercaderes venden ${good("stone")}.`,
  worksBegin: (e) => `Empiezan las obras ${toKind("en", e.kind, e.level - 1)}: será ${a(built(e.kind, e.level).noun)}.`,
  upgraded: (e) => `${capital(theKind(e.kind, e.level - 1))} es ahora ${a(built(e.kind, e.level).noun)}.`,
  legacy: (e) => e.text
} satisfies Wording<Event>

// ── Why a term ended ──────────────────────────────────────────────────────

/** How a term ended, in a word, for the reckoning's heading. */
export const ended = {
  bankrupt: "bancarrota",
  revolt: "revuelta",
  abandoned: "abandono",
  dismissed: "destitución",
  over: "el mandato ha terminado"
} satisfies Record<Exclude<Reason, "none">, string>

// ── What an edit answers with ─────────────────────────────────────────────

/** What a town still lacks before it can build something: "se necesitan 20 habitantes (el pueblo tiene 12)". */
export const lock = {
  residents: (l) => `se necesitan ${l.needs} habitantes (el pueblo tiene ${l.has})`,
  citizens: (l) => `se necesitan ${l.needs} ciudadanos (el pueblo tiene ${l.has})`
} satisfies Wording<Lock>

/** What keeps a town from an upgrade: the rank it must reach first. */
export const needsRank = (n: number): string => `el pueblo tiene que ser ${a(rankNoun(n))}`

export const notice = {
  locked: (n) => `${names.kind.title(n.kind)}: ${say(lock, n.lock)}`,
  pieceLocked: (n) => `${capital(props[n.prop].noun.one)}: hace falta un pueblo más grande`,
  noRoom: () => "Aquí no hay espacio",
  // "suficiente" follows only the number of what is short: one for what is measured, many for what is counted.
  short: (n) => (n.of === "coins" ? "No hay suficientes monedas" : `No hay ${goods[n.of].counted ? "suficientes" : "suficiente"} ${goods[n.of].name}`),
  parkFirst: () => "Primero pon terreno de parque",
  rockUnworked: () => "Primero agota la roca: solo se puede despejar un frente ya trabajado",
  hallStays: () => `${capital(the(built("townhall").noun))} no se derriba`,
  salvageFee: (n) => `Derribar cuesta ${token.coins(n.fee)}`,
  // A home, a road, a building, or a site: said as what was done, a noun, so nothing agrees with what it was.
  pulledDown: (n) =>
    `${n.cancelled ? "Obra cancelada" : "Derribo"} · ${salvage(n.salvage)}${n.lost > 0 ? ` (${n.lost} no ${n.lost === 1 ? "cupo" : "cupieron"} en el almacén)` : ""}`,
  crownSent: (n) => `Envío hecho · ${token.coins(n.reward, true)}`,
  upgradeBlocked: (n) => `${names.kind.title(n.kind, n.level)}: ${needsRank(n.rank)}`,
  worksBegun: (n) => `${names.kind.title(n.kind, n.level)} · ${token.coins(-n.coins, true)} · los porteadores traen ${cost({ coins: 0, materials: n.materials })}`
} satisfies Wording<Notice>
