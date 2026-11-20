/**
 * French for what the simulation says as data (`game/said.ts`): the
 * chronicle's news, the answers to an edit, why a term ended, and what
 * something costs and gives back. One function for each thing it can say,
 * as in English; the sentences are French's own, turned where an English
 * one would force an agreement French cannot know: what a fire took is
 * what "le feu a détruit", what a thief took is "du tissu" or "des
 * planches", and what the crown was sent is what "la couronne a reçu".
 */
import type { GoodId, Kind } from "../../game/content/index.ts"
import type { Salvage } from "../../game/rules/salvage.ts"
import type { Event, Lock, Notice, Reason } from "../../game/said.ts"
import * as token from "../token.ts"
import { say, type Wording } from "../wording.ts"
import { aKind, ofGood, ofKinds, some, someGood, theGood, theKind } from "./chips.ts"
import { a, agree, and, capital, count, decimal, f, form, m, numeral, of, ofA, signed, spelt, the, theMany } from "./grammar.ts"
import { at, built, goods, lands, names, props, quantity, rankNoun, sizes, winters } from "./nouns.ts"

// ── Costs ─────────────────────────────────────────────────────────────────

const entries = (materials: Partial<Record<GoodId, number>>) =>
  (Object.entries(materials) as Array<[GoodId, number]>).filter(([, n]) => n > 0)

/** A cost as amounts side by side: its coins (when it has any), then each material. */
export const cost = (c: Kind["cost"]): string =>
  [...(c.coins > 0 ? [token.coins(c.coins)] : []), ...entries(c.materials).map(([g, n]) => token.amount(g, n))].join(" · ")

/** What pulling something down costs and gives back: "−25 pièces · en retour 2 planches, 3 blocs de pierre" (nothing: an empty line). */
export const salvage = (s: Salvage): string => {
  const back = entries(s.back).map(([g, n]) => token.amount(g, n)).join(", ")
  return [...(s.fee !== 0 ? [token.coins(-s.fee, true)] : []), ...(back ? [`en retour ${back}`] : [])].join(" · ")
}

const coin = f("pièce")
/** A number as it is, or (`marked`) with its sign: "+25", "−25". */
const figure = (n: number, marked: boolean) => (marked ? signed(n) : `${n}`)

/** An amount in words, where an icon cannot go (a tooltip, a title): "25 pièces", "+3 pièces par minute", "2 planches", "3 sacs de farine". */
export const amount = {
  coins: (n: number, marked = false): string => `${figure(n, marked)} ${form(Math.abs(n), coin)}`,
  rate: (n: number, marked = false): string => `${figure(n, marked)} ${form(Math.abs(n), coin)} par minute`,
  good: (id: GoodId, n: number): string => quantity(id, n),
  /** After a number of coins beside their icon: a minute's worth. */
  perMinute: "/min"
}

// ── The chronicle ─────────────────────────────────────────────────────────

const home = f("maison"), building = m("bâtiment"), minute = f("minute"), ration = f("ration")

export const chronicle = {
  founded: (e) => `Ville fondée sur une terre ${sizes[e.size]} et ${lands[e.land].name}, pour un mandat de ${count(e.term, minute)}.`,
  nextTerm: (e) => `Mandat ${e.term} : le maire reste en fonction ${count(e.minutes, minute)} de plus.`,
  residents: (e) => `${e.mark} habitants.`,
  treasuryEmpty: () => "Le trésor est vide : les salaires ne sont plus payés.",
  uproar: () => "La ville gronde.",
  bankrupt: () => "Faillite : la couronne a retiré le trésor des mains du maire.",
  revolt: () => "Révolte : la ville a chassé le maire.",
  abandoned: () => "Abandon : les habitants ont quitté la ville.",
  dismissed: (e) => `Destitution : la couronne a remplacé un maire qui a laissé ${e.patience} de ses demandes sans réponse.`,
  termOver: (e) => `Le mandat ${e.term} est terminé ; ${the(rankNoun(e.rank))} tient bon.`,
  goalsMet: (e) => `Tous les objectifs ${ofA(rankNoun(e.rank))} sont atteints : il ne reste à la ville qu'à les tenir.`,
  rankReached: (e) => `La ville est désormais ${a(rankNoun(e.rank))} : la couronne envoie ${count(e.reward, coin)}.`,
  crownAsks: (e) => `La couronne demande ${some(e.good, e.amount)} d'ici ${decimal(e.minutes)} ${form(e.minutes, minute)}, contre ${count(e.reward, coin)}.`,
  crownUnanswered: (e) => `La couronne demandait ${some(e.good, e.amount)} : sans réponse, c'est une amende de ${count(e.fine, coin)}.`,
  crownSent: (e) => `La couronne a reçu ${some(e.good, e.amount)}, contre ${count(e.reward, coin)}.`,
  winter: (e) =>
    `Hiver ${winters[e.severity]}, an ${e.year} : les champs dorment et ${theMany(built("fishery").noun)} ne prennent que ${e.fishing} %${e.heating ? " ; les maisons font du feu pour se chauffer" : ""}.`,
  spring: (e) => `Printemps de l'an ${e.year}.`,
  winterComing: (e) =>
    `L'hiver arrive dans une minute, et l'almanach le prédit ${winters[e.severity]} : ${count(e.larder, ration)} en réserve ; la ville en mange ${e.eats} par minute.`,
  fire: (e) => `Incendie ${at(e.place)} !`,
  fireOver: (e) => {
    const took = [...(e.homes > 0 ? [spelt(e.homes, home)] : []), ...(e.buildings > 0 ? [spelt(e.buildings, building)] : [])]
    return `Incendie ${at(e.place)} : ${took.length > 0 ? `le feu a détruit ${and(took)}` : "il est éteint"}.`
  },
  sickness: (e) => `Maladie ${at(e.place)} : un médecin peut la guérir.`,
  theftCoins: (e) => `${capital(at(e.place))}, des voleurs ont emporté ${count(e.coins, coin)}.`,
  theftGoods: (e) => `${capital(at(e.place))}, des voleurs ont emporté ${someGood(e.good)}.`,
  derelict: (e) => `Une maison ${at(e.place)}, vide après ses vols, est laissée à l'abandon.`,
  collapsed: (e) => {
    if (e.kind === null) return `Une maison ${at(e.place)} s'est effondrée : personne ne l'avait réparée.`
    const word = built(e.kind).noun
    return `${capital(theKind(e.kind))} ${at(e.place)} s'est ${agree(word, "effondré", "effondrée")} : personne ne l'avait ${agree(word, "réparé", "réparée")}.`
  },
  rotted: (e) =>
    `${e.rotted === 1 ? "Un poisson ou un pain a pourri" : `${capital(numeral(e.rotted))} poissons et pains ont pourri`} en réserve cette minute : ${
      e.made === null
        ? `${aKind("granary")} garde ${theGood("fish")} et ${theGood("bread")} cinq fois plus longtemps, et ${theGood("smoked")} ne pourrit pas`
        : `la ville produit environ ${count(e.made, ration)} par minute et en mange ${e.eaten} : moins ${ofKinds("fishery")}, ${aKind("smokehouse")} ou vendre ${someGood("fish")} mettrait fin au gaspillage`
    }.`,
  lastRock: (e) =>
    e.ore
      ? `Plus ${ofGood("ore")} à ciel ouvert : les fronts déjà taillés en donnent encore un peu, lentement. Les marchands vendent ${someGood("ore")} et ${someGood("tools")}.`
      : `Plus ${ofGood("stone")} à ciel ouvert : les fronts déjà taillés en donnent encore un peu, lentement. Les marchands vendent ${someGood("stone")}.`,
  worksBegin: (e) =>
    `Début des travaux sur ${theKind(e.kind, e.level - 1)} : ${agree(built(e.kind, e.level - 1).noun, "il", "elle")} deviendra ${a(built(e.kind, e.level).noun)}.`,
  upgraded: (e) => `${capital(theKind(e.kind, e.level - 1))} est désormais ${a(built(e.kind, e.level).noun)}.`,
  legacy: (e) => e.text
} satisfies Wording<Event>

// ── Why a term ended ──────────────────────────────────────────────────────

/** How a term ended, in a word, for the reckoning's heading. */
export const ended = {
  bankrupt: "faillite",
  revolt: "révolte",
  abandoned: "abandon",
  dismissed: "destitution",
  over: "le mandat est terminé"
} satisfies Record<Exclude<Reason, "none">, string>

// ── What an edit answers with ─────────────────────────────────────────────

/** What a town still lacks before it can build something: "il faut 20 habitants (la ville en a 12)". */
export const lock = {
  residents: (l) => `il faut ${l.needs} habitants (la ville en a ${l.has})`,
  citizens: (l) => `il faut ${l.needs} citoyens (la ville en a ${l.has})`
} satisfies Wording<Lock>

/** What keeps a town from an upgrade: the rank it must reach first. */
export const needsRank = (n: number): string => `la ville doit être ${a(rankNoun(n))}`

export const notice = {
  locked: (n) => `${names.kind.title(n.kind)} : ${say(lock, n.lock)}`,
  pieceLocked: (n) => `${capital(props[n.prop].noun.one)} : il faut une ville plus grande`,
  noRoom: () => "Pas de place ici",
  short: (n) => (n.of === "coins" ? "Pas assez de pièces" : `Pas assez ${of(goods[n.of], goods[n.of].counted)}`),
  parkFirst: () => "Posez d'abord le terrain du parc",
  rockUnworked: () => "Extrayez d'abord toute la roche : seul un front taillé peut être dégagé",
  hallStays: () => `${capital(the(built("townhall").noun))} reste`,
  salvageFee: (n) => `Démolir coûte ${token.coins(n.fee)}`,
  pulledDown: (n) => `${n.cancelled ? "Annulé" : "Démoli"} · ${salvage(n.salvage)}${n.lost > 0 ? ` (${n.lost} sans place en réserve)` : ""}`,
  crownSent: (n) => `Envoyé · ${token.coins(n.reward, true)}`,
  upgradeBlocked: (n) => `${names.kind.title(n.kind, n.level)} : ${needsRank(n.rank)}`,
  worksBegun: (n) => `${names.kind.title(n.kind, n.level)} · ${token.coins(-n.coins, true)} · les porteurs apportent ${cost({ coins: 0, materials: n.materials })}`
} satisfies Wording<Notice>
