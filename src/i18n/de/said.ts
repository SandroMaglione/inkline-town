/**
 * German for what the simulation says as data (`game/said.ts`): the
 * chronicle's news, the answers to an edit, why a term ended, and what
 * something costs and gives back. One function for each thing it can say,
 * as in English, in sentences of German's own: every article, pronoun, and
 * adjective beside a name from `nouns.ts` is bent to it by `grammar.ts`
 * and `chips.ts`. Where English would name what a fire took or a thief
 * stole with an article German cannot know, the German names it bare
 * ("Diebe haben [Tuch] gestohlen").
 */
import type { GoodId, Kind } from "../../game/content/index.ts"
import type { Salvage } from "../../game/rules/salvage.ts"
import type { Event, Lock, Notice, Reason } from "../../game/said.ts"
import * as token from "../token.ts"
import { say, type Wording } from "../wording.ts"
import { aKind, good, kinds, some, theKind, toKind } from "./chips.ts"
import { a, adjective, anArticle, and, capital, count, counted, decimal, form, m, n, numeral, percent, pronoun, signed, spelt, the, theArticle } from "./grammar.ts"
import { at, built, goods, land, lands, names, props, quantity, rankNoun, sizes, winter, winters } from "./nouns.ts"

// ── Costs ─────────────────────────────────────────────────────────────────

const entries = (materials: Partial<Record<GoodId, number>>) =>
  (Object.entries(materials) as Array<[GoodId, number]>).filter(([, count]) => count > 0)

/** A cost as amounts side by side: its coins (when it has any), then each material. */
export const cost = (c: Kind["cost"]): string =>
  [...(c.coins > 0 ? [token.coins(c.coins)] : []), ...entries(c.materials).map(([g, count]) => token.amount(g, count))].join(" · ")

/** What pulling something down costs and gives back: "−25 Taler · 2 Bretter, 3 Steine zurück" (nothing: an empty line). */
export const salvage = (s: Salvage): string => {
  const back = entries(s.back).map(([g, count]) => token.amount(g, count)).join(", ")
  return [...(s.fee !== 0 ? [token.coins(-s.fee, true)] : []), ...(back ? [`${back} zurück`] : [])].join(" · ")
}

/** The town's coin. */
export const taler = m("Taler", "Taler")
/** A number as it is, or (`marked`) with its sign: "+25", "−25". */
const figure = (count: number, marked: boolean) => (marked ? signed(count) : `${count}`)

/** An amount in words, where an icon cannot go (a tooltip, a title): "25 Taler", "+3 Taler pro Minute", "2 Bretter". */
export const amount = {
  coins: (count: number, marked = false): string => `${figure(count, marked)} ${counted(Math.abs(count), taler)}`,
  rate: (count: number, marked = false): string => `${figure(count, marked)} ${counted(Math.abs(count), taler)} pro Minute`,
  good: (id: GoodId, count: number): string => quantity(id, count),
  /** After a number of coins beside their icon: a minute's worth. */
  perMinute: "/min"
}

// ── The chronicle ─────────────────────────────────────────────────────────

const home = n("Haus", "Häuser"), building = n("Gebäude", "Gebäude")

/** "Das letzte freiliegende [Erz] ist abgebaut", "Die letzten freiliegenden [Steine] sind gebrochen": article and adjectives follow the good. */
const lastOf = (id: GoodId, done: string): string => {
  const ware = goods[id]
  return `${capital(theArticle(ware, "nom", ware.many))} ${adjective("letzt", ware, "nom", "the", ware.many)} ${adjective("freiliegend", ware, "nom", "the", ware.many)} ${good(id)} ${ware.many ? "sind" : "ist"} ${done}`
}

export const chronicle = {
  founded: (e) =>
    `Gegründet auf ${adjective(sizes[e.size].stem, land, "dat")}, ${adjective(lands[e.land].stem, land, "dat")} ${form(land, "dat")}, für eine Amtszeit von ${e.term} Minuten.`,
  nextTerm: (e) => `Amtszeit ${e.term}: Der Bürgermeister bleibt weitere ${e.minutes} Minuten im Amt.`,
  residents: (e) => `${e.mark} Einwohner.`,
  treasuryEmpty: () => "Die Kasse ist leer: Die Löhne bleiben unbezahlt.",
  uproar: () => "Im Ort herrscht Aufruhr.",
  bankrupt: () => "Bankrott: Die Krone hat dem Bürgermeister die Kasse aus der Hand genommen.",
  revolt: () => "Aufstand: Der Ort hat den Bürgermeister verjagt.",
  abandoned: () => "Verlassen: Die Leute haben den Ort aufgegeben.",
  dismissed: (e) => `Abgesetzt: Die Krone hat einen Bürgermeister ersetzt, der ${e.patience} ihrer Forderungen unbeantwortet ließ.`,
  termOver: (e) => `Amtszeit ${e.term} ist vorüber; ${the(rankNoun(e.rank))} besteht fort.`,
  goalsMet: (e) => `Alle Ziele für ${a(rankNoun(e.rank), "acc")} sind erreicht: Der Ort muss sie nur noch halten.`,
  rankReached: (e) => `Der Ort ist jetzt ${a(rankNoun(e.rank))}: Die Krone schickt ${count(e.reward, taler)}.`,
  crownAsks: (e) => `Die Krone verlangt ${some(e.good, e.amount)} binnen ${decimal(e.minutes)} Minuten, für ${count(e.reward, taler)}.`,
  crownUnanswered: (e) => `Die Krone wartete vergeblich auf ${some(e.good, e.amount)}: eine Strafe von ${count(e.fine, taler, "dat")}.`,
  crownSent: (e) => `An die Krone gesandt: ${some(e.good, e.amount)}, für ${count(e.reward, taler)}.`,
  winter: (e) =>
    `${capital(anArticle(winter))} ${adjective(winters[e.severity].stem, winter, "nom", "a")} ${winter.one}, Jahr ${e.year}: Die Äcker ruhen, und die Fischereien fangen nur ${percent(e.fishing)}${e.heating ? "; die Häuser heizen, um warm zu bleiben" : ""}.`,
  spring: (e) => `Frühling im Jahr ${e.year}.`,
  winterComing: (e) => `In einer Minute kommt der Winter, und laut Almanach wird er ${winters[e.severity].name}: ${e.larder} Nahrung im Lager; der Ort isst ${e.eats} pro Minute.`,
  fire: (e) => `Feuer ${at(e.place)}!`,
  fireOver: (e) => {
    const took = [...(e.homes > 0 ? [spelt(e.homes, home)] : []), ...(e.buildings > 0 ? [spelt(e.buildings, building)] : [])]
    return `Feuer ${at(e.place)}: ${took.length > 0 ? `${and(took)} verloren` : "gelöscht"}.`
  },
  sickness: (e) => `Krankheit ${at(e.place)}: Ein Bader kann sie heilen.`,
  theftCoins: (e) => `Diebe haben ${at(e.place)} ${count(e.coins, taler)} gestohlen.`,
  theftGoods: (e) => `Diebe haben ${at(e.place)} ${good(e.good, "acc")} gestohlen.`,
  derelict: (e) => `Ein Haus ${at(e.place)} stand nach den Diebstählen leer und verfällt nun.`,
  collapsed: (e) => {
    if (e.kind === null) return `Ein Haus ${at(e.place)} ist eingestürzt: Niemand hat es ausgebessert.`
    return `${capital(theKind(e.kind))} ${at(e.place)} ist eingestürzt: Niemand hat ${pronoun(built(e.kind).noun, "acc")} ausgebessert.`
  },
  rotted: (e) => {
    const fish = goods.fish, bread = goods.bread
    const lost = e.rotted === 1 ? `ist ${a(fish)} oder ${a(bread)}` : `sind ${numeral(e.rotted)} ${form(fish, "nom", true)} und ${form(bread, "nom", true)}`
    return `In dieser Minute ${lost} im Lager verdorben: ${
      e.made === null
        ? `${capital(aKind("granary"))} hält ${good("fish", "acc")} und ${good("bread", "acc")} fünfmal so lange frisch, und ${good("smoked")} verdirbt nicht`
        : `Der Ort erzeugt etwa ${e.made} Nahrung pro Minute und isst ${e.eaten}: Weniger ${kinds("fishery")}, ${aKind("smokehouse")} oder der Verkauf von ${good("fish", "dat")} würde den Verderb beenden`
    }.`
  },
  lastRock: (e) =>
    e.ore
      ? `${lastOf("ore", "abgebaut")}: Die alten Abbauwände geben noch ein wenig her, langsam. Händler verkaufen ${good("ore", "acc")} und ${good("tools", "acc")}.`
      : `${lastOf("stone", "gebrochen")}: Die alten Abbauwände geben noch ein wenig her, langsam. Händler verkaufen ${good("stone", "acc")}.`,
  worksBegin: (e) => `Die Arbeiten ${toKind("an", "dat", e.kind, e.level - 1)} beginnen: ${capital(pronoun(built(e.kind, e.level - 1).noun))} wird ${a(built(e.kind, e.level).noun)}.`,
  upgraded: (e) => `${capital(theKind(e.kind, "nom", e.level - 1))} ist jetzt ${a(built(e.kind, e.level).noun)}.`,
  legacy: (e) => e.text
} satisfies Wording<Event>

// ── Why a term ended ──────────────────────────────────────────────────────

/** How a term ended, in a word, for the reckoning's heading. */
export const ended = {
  bankrupt: "Bankrott",
  revolt: "Aufstand",
  abandoned: "Verlassen",
  dismissed: "Abgesetzt",
  over: "die Amtszeit ist vorüber"
} satisfies Record<Exclude<Reason, "none">, string>

// ── What an edit answers with ─────────────────────────────────────────────

const residents = m("Einwohner", "Einwohner"), citizens = m("Bürger", "Bürger")

/** What a town still lacks before it can build something: "erst ab 20 Einwohnern (der Ort hat 12)". */
export const lock = {
  residents: (l) => `erst ab ${count(l.needs, residents, "dat")} (der Ort hat ${l.has})`,
  citizens: (l) => `erst ab ${count(l.needs, citizens, "dat")} (der Ort hat ${l.has})`
} satisfies Wording<Lock>

/** What keeps a town from an upgrade: the rank it must reach first. */
export const needsRank = (rank: number): string => `der Ort muss erst ${a(rankNoun(rank))} sein`

export const notice = {
  locked: (o) => `${names.kind.title(o.kind)}: ${say(lock, o.lock)}`,
  pieceLocked: (o) => `${capital(props[o.prop].noun.one)}: erst in einem größeren Ort`,
  noRoom: () => "Dort ist kein Platz",
  short: (o) => `Nicht genug ${o.of === "coins" ? taler.other : goods[o.of].name}`,
  parkFirst: () => "Lege zuerst Parkboden an",
  rockUnworked: () => "Erst ganz abbauen: Räumen lässt sich nur eine abgebaute Wand",
  hallStays: () => `${capital(the(built("townhall").noun))} bleibt`,
  salvageFee: (o) => `Der Abriss kostet ${token.coins(o.fee)}`,
  pulledDown: (o) =>
    `${o.cancelled ? "Bau abgebrochen" : "Abgerissen"} · ${salvage(o.salvage)}${o.lost > 0 ? ` (${o.lost} ${o.lost === 1 ? "fand" : "fanden"} keinen Platz im Lager)` : ""}`,
  crownSent: (o) => `Gesandt · ${token.coins(o.reward, true)}`,
  upgradeBlocked: (o) => `${names.kind.title(o.kind, o.level)}: ${needsRank(o.rank)}`,
  worksBegun: (o) => `${names.kind.title(o.kind, o.level)} · ${token.coins(-o.coins, true)} · Träger bringen ${cost({ coins: 0, materials: o.materials })}`
} satisfies Wording<Notice>
