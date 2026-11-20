/**
 * Italian for what the simulation says as data (`game/said.ts`): the
 * chronicle's news, the answers to an edit, why a term ended, and what
 * something costs and gives back. One function for each thing it can say,
 * as in English; the sentences are Italian's own, turned where an English
 * one would force an agreement Italian cannot know (what was lost to a
 * fire, what a thief took).
 */
import type { GoodId, Kind } from "../../game/content/index.ts"
import type { Salvage } from "../../game/rules/salvage.ts"
import type { Event, Lock, Notice, Reason } from "../../game/said.ts"
import * as token from "../token.ts"
import { say, type Wording } from "../wording.ts"
import { aKind, good, kinds, some, theGood, theKind, toKind } from "./chips.ts"
import { a, agree, and, capital, decimal, f, form, m, numeral, signed, spelt, the } from "./grammar.ts"
import { at, built, goods, lands, names, props, quantity, rankNoun, sizes, winters } from "./nouns.ts"

// ── Costs ─────────────────────────────────────────────────────────────────

const entries = (materials: Partial<Record<GoodId, number>>) =>
  (Object.entries(materials) as Array<[GoodId, number]>).filter(([, n]) => n > 0)

/** A cost as amounts side by side: its coins (when it has any), then each material. */
export const cost = (c: Kind["cost"]): string =>
  [...(c.coins > 0 ? [token.coins(c.coins)] : []), ...entries(c.materials).map(([g, n]) => token.amount(g, n))].join(" · ")

/** What pulling something down costs and gives back: "−25 monete · recuperate 2 tavole, 3 di pietra" (nothing: an empty line). */
export const salvage = (s: Salvage): string => {
  const back = entries(s.back).map(([g, n]) => token.amount(g, n)).join(", ")
  return [...(s.fee !== 0 ? [token.coins(-s.fee, true)] : []), ...(back ? [`di ritorno ${back}`] : [])].join(" · ")
}

const coin = f("moneta", "monete")
/** A number as it is, or (`marked`) with its sign: "+25", "−25". */
const figure = (n: number, marked: boolean) => (marked ? signed(n) : `${n}`)

/** An amount in words, where an icon cannot go (a tooltip, a title): "25 monete", "+3 monete al minuto", "2 tavole". */
export const amount = {
  coins: (n: number, marked = false): string => `${figure(n, marked)} ${form(Math.abs(n), coin)}`,
  rate: (n: number, marked = false): string => `${figure(n, marked)} ${form(Math.abs(n), coin)} al minuto`,
  good: (id: GoodId, n: number): string => quantity(id, n),
  /** After a number of coins beside their icon: a minute's worth. */
  perMinute: "/min"
}

// ── The chronicle ─────────────────────────────────────────────────────────

const home = f("casa", "case"), building = m("edificio", "edifici")

export const chronicle = {
  founded: (e) => `Fondato su una terra ${sizes[e.size]} e ${lands[e.land].name}, per un mandato di ${e.term} minuti.`,
  nextTerm: (e) => `Mandato ${e.term}: il sindaco resta in carica per altri ${e.minutes} minuti.`,
  residents: (e) => `${e.mark} abitanti.`,
  treasuryEmpty: () => "Il tesoro è vuoto: i salari non vengono pagati.",
  uproar: () => "Il paese è in tumulto.",
  bankrupt: () => "Bancarotta: la corona ha tolto il tesoro dalle mani del sindaco.",
  revolt: () => "Rivolta: il paese ha cacciato il sindaco.",
  abandoned: () => "Abbandono: la gente ha lasciato il paese.",
  dismissed: (e) => `Destituzione: la corona ha sostituito un sindaco che ha lasciato senza risposta ${e.patience} delle sue richieste.`,
  termOver: (e) => `Il mandato ${e.term} è finito; ${the(rankNoun(e.rank))} resta in piedi.`,
  goalsMet: (e) => `Ogni obiettivo di ${a(rankNoun(e.rank))} è raggiunto: al paese basta mantenerli.`,
  rankReached: (e) => `Il paese è ora ${a(rankNoun(e.rank))}: la corona manda ${e.reward} monete.`,
  crownAsks: (e) => `La corona chiede ${some(e.good, e.amount)} entro ${decimal(e.minutes)} minuti, per ${e.reward} monete.`,
  crownUnanswered: (e) => `La richiesta della corona di ${some(e.good, e.amount)} è rimasta senza risposta: una multa di ${e.fine} monete.`,
  crownSent: (e) => `La corona ha ricevuto ${some(e.good, e.amount)}: ${e.reward} monete di ricompensa.`,
  winter: (e) => `Un inverno ${winters[e.severity]}, anno ${e.year}: i campi riposano e le peschiere pescano il ${e.fishing}%${e.heating ? "; le case accendono il fuoco per scaldarsi" : ""}.`,
  spring: (e) => `Primavera dell'anno ${e.year}.`,
  winterComing: (e) => `L'inverno arriva tra un minuto, e l'almanacco dice che sarà ${winters[e.severity]}: ${e.larder} di cibo in magazzino; il paese ne mangia ${e.eats} al minuto.`,
  fire: (e) => `Incendio ${at(e.place)}!`,
  fireOver: (e) => {
    const took = [...(e.homes > 0 ? [spelt(e.homes, home)] : []), ...(e.buildings > 0 ? [spelt(e.buildings, building)] : [])]
    return `Incendio ${at(e.place)}: ${took.length > 0 ? `il fuoco ha distrutto ${and(took)}` : "spento"}.`
  },
  sickness: (e) => `Malattia ${at(e.place)}: un medico può curarla.`,
  theftCoins: (e) => `I ladri ${at(e.place)} sono fuggiti con ${e.coins} monete.`,
  theftGoods: (e) => `I ladri ${at(e.place)} hanno rubato ${theGood(e.good)}.`,
  derelict: (e) => `Una casa ${at(e.place)} è rimasta vuota dopo i furti, ed è lasciata in abbandono.`,
  collapsed: (e) => {
    if (e.kind === null) return `Una casa ${at(e.place)} è crollata: nessuno l'ha riparata.`
    const word = built(e.kind).noun
    return `${capital(theKind(e.kind))} ${at(e.place)} è ${agree(word, "crollato", "crollata")}: nessuno l'ha ${agree(word, "riparato", "riparata")}.`
  },
  rotted: (e) =>
    `${e.rotted === 1 ? "Un pesce o una pagnotta è andato a male" : `${capital(numeral(e.rotted))} tra pesci e pagnotte sono andati a male`} in magazzino in questo minuto: ${
      e.made === null
        ? `${aKind("granary")} fa durare ${theGood("fish")} e ${theGood("bread")} cinque volte più a lungo, e ${theGood("smoked")} non va a male`
        : `il paese produce circa ${e.made} di cibo al minuto e ne mangia ${e.eaten}: meno ${kinds("fishery")}, ${aKind("smokehouse")}, o vendere ${theGood("fish")} eviterebbero lo spreco`
    }.`,
  lastRock: (e) =>
    e.ore
      ? `L'ultimo ${good("ore")} a cielo aperto è stato estratto: le pareti già scavate ne danno ancora un poco, lentamente. I mercanti vendono ${good("ore")} e ${good("tools")}.`
      : `L'ultima ${good("stone")} a cielo aperto è stata cavata: le pareti già scavate ne danno ancora un poco, lentamente. I mercanti vendono ${good("stone")}.`,
  worksBegin: (e) => `Iniziano i lavori ${toKind("su", e.kind, e.level - 1)}: diventerà ${a(built(e.kind, e.level).noun)}.`,
  upgraded: (e) => `${capital(theKind(e.kind, e.level - 1))} è ora ${a(built(e.kind, e.level).noun)}.`,
  legacy: (e) => e.text
} satisfies Wording<Event>

// ── Why a term ended ──────────────────────────────────────────────────────

/** How a term ended, in a word, for the reckoning's heading. */
export const ended = {
  bankrupt: "bancarotta",
  revolt: "rivolta",
  abandoned: "abbandono",
  dismissed: "destituzione",
  over: "il mandato è finito"
} satisfies Record<Exclude<Reason, "none">, string>

// ── What an edit answers with ─────────────────────────────────────────────

/** What a town still lacks before it can build something: "servono 20 abitanti (il paese ne ha 12)". */
export const lock = {
  residents: (l) => `servono ${l.needs} abitanti (il paese ne ha ${l.has})`,
  citizens: (l) => `servono ${l.needs} cittadini (il paese ne ha ${l.has})`
} satisfies Wording<Lock>

/** What keeps a town from an upgrade: the rank it must reach first. */
export const needsRank = (n: number): string => `il paese deve essere ${a(rankNoun(n))}`

export const notice = {
  locked: (n) => `${names.kind.title(n.kind)}: ${say(lock, n.lock)}`,
  pieceLocked: (n) => `${capital(props[n.prop].noun.one)}: serve un paese più grande`,
  noRoom: () => "Qui non c'è posto",
  short: (n) => (n.of === "coins" ? "Non ci sono abbastanza monete" : goods[n.of].counted ? `Non ci sono abbastanza ${goods[n.of].name}` : `Non c'è abbastanza ${goods[n.of].name}`),
  parkFirst: () => "Prima stendi il terreno del parco",
  rockUnworked: () => "Prima va cavata fino in fondo: si può sgombrare solo una parete già scavata",
  hallStays: () => "Il municipio resta",
  salvageFee: (n) => `Demolire costa ${token.coins(n.fee)}`,
  pulledDown: (n) =>
    `${n.cancelled ? "Annullato" : "Demolito"} · ${salvage(n.salvage)}${n.lost > 0 ? ` (${n.lost} non ${n.lost === 1 ? "ha" : "hanno"} trovato posto in magazzino)` : ""}`,
  crownSent: (n) => `Inviato · ${token.coins(n.reward, true)}`,
  upgradeBlocked: (n) => `${names.kind.title(n.kind, n.level)}: ${needsRank(n.rank)}`,
  worksBegun: (n) => `${names.kind.title(n.kind, n.level)} · ${token.coins(-n.coins, true)} · i portatori portano ${cost({ coins: 0, materials: n.materials })}`
} satisfies Wording<Notice>
