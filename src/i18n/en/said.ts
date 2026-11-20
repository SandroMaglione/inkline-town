/**
 * English for what the simulation says as data (`game/said.ts`): the
 * chronicle's news, the answers to an edit, why a term ended, and what
 * something costs and gives back. One function for each thing it can say,
 * and the compiler holds the table to every one of them.
 */
import type { GoodId, Kind, KindId } from "../../game/content/index.ts"
import type { Salvage } from "../../game/rules/salvage.ts"
import type { Event, Lock, Notice, Reason } from "../../game/said.ts"
import * as token from "../token.ts"
import { say, type Wording } from "../wording.ts"
import { a, and, capital, form, noun, signed, spelt } from "./grammar.ts"
import { built, goods, lands, names, place, props, sizes, winters } from "./nouns.ts"

const rank = (n: number) => names.rank(n)
/** A building in the news, as a chip, by what it is called at its level. */
const building = (id: KindId, level = 0) => token.kind(id, built(id, level).noun.one)
const ware = (id: GoodId) => token.good(id)

// ── Costs ─────────────────────────────────────────────────────────────────

const entries = (materials: Partial<Record<GoodId, number>>) =>
  (Object.entries(materials) as Array<[GoodId, number]>).filter(([, n]) => n > 0)

/** A cost as amounts side by side: its coins (when it has any), then each material. */
export const cost = (c: Kind["cost"]): string =>
  [...(c.coins > 0 ? [token.coins(c.coins)] : []), ...entries(c.materials).map(([g, n]) => token.amount(g, n))].join(" · ")

/** What pulling something down costs and gives back: "−25 coins · 2 planks, 3 stone back" (nothing: an empty line). */
export const salvage = (s: Salvage): string => {
  const back = entries(s.back).map(([g, n]) => token.amount(g, n)).join(", ")
  return [...(s.fee !== 0 ? [token.coins(-s.fee, true)] : []), ...(back ? [`${back} back`] : [])].join(" · ")
}

const coin = noun("coin")
/** A number as it is, or (`marked`) with its sign: "+25", "−25". */
const figure = (n: number, marked: boolean) => (marked ? signed(n) : `${n}`)

/** An amount in words, where an icon cannot go (a tooltip, a title): "25 coins", "+3 coins a minute", "2 planks". */
export const amount = {
  coins: (n: number, marked = false): string => `${figure(n, marked)} ${form(Math.abs(n), coin)}`,
  rate: (n: number, marked = false): string => `${figure(n, marked)} ${form(Math.abs(n), coin)} a minute`,
  good: (id: GoodId, n: number): string => `${n} ${form(n, goods[id])}`,
  /** After a number of coins beside their icon: a minute's worth. */
  perMinute: "/min"
}

// ── The chronicle ─────────────────────────────────────────────────────────

export const chronicle = {
  founded: (e) => `Founded on ${sizes[e.size]}, ${lands[e.land].name} land, for a term of ${e.term} minutes.`,
  nextTerm: (e) => `Term ${e.term}: the mayor stands for another ${e.minutes} minutes.`,
  residents: (e) => `${e.mark} residents.`,
  treasuryEmpty: () => "The treasury is empty: wages go unpaid.",
  uproar: () => "The town is in uproar.",
  bankrupt: () => "Bankrupt: the crown has taken the treasury out of the mayor's hands.",
  revolt: () => "Revolt: the town has turned the mayor out.",
  abandoned: () => "Abandoned: the people have left the town.",
  dismissed: (e) => `Dismissed: the crown has replaced a mayor who left ${e.patience} of its requests unanswered.`,
  termOver: (e) => `Term ${e.term} is over; the ${rank(e.rank)} stands.`,
  goalsMet: (e) => `Every goal of ${a(rank(e.rank))} is met: the town needs only to hold them.`,
  rankReached: (e) => `The town is now ${a(rank(e.rank))}: the crown sends ${e.reward} coins.`,
  crownAsks: (e) => `The crown asks for ${e.amount} ${ware(e.good)} within ${e.minutes} minutes, for ${e.reward} coins.`,
  crownUnanswered: (e) => `The crown's request for ${e.amount} ${ware(e.good)} went unanswered: a fine of ${e.fine} coins.`,
  crownSent: (e) => `Sent the crown ${e.amount} ${ware(e.good)}, for ${e.reward} coins.`,
  winter: (e) => `${capital(a(winters[e.severity]))} winter, year ${e.year}: the fields lie still and fisheries catch ${e.fishing}%${e.heating ? "; homes burn fires to keep warm" : ""}.`,
  spring: (e) => `Spring of year ${e.year}.`,
  winterComing: (e) => `Winter in a minute, and the almanac says it will be ${winters[e.severity]}: ${e.larder} food in store; the town eats ${e.eats} a minute.`,
  fire: (e) => `Fire on ${place(e.place)}!`,
  fireOver: (e) => {
    const took = [...(e.homes > 0 ? [spelt(e.homes, noun("home"))] : []), ...(e.buildings > 0 ? [spelt(e.buildings, noun("building"))] : [])]
    return `Fire on ${place(e.place)}: ${took.length > 0 ? `${and(took)} lost` : "put out"}.`
  },
  sickness: (e) => `Sickness on ${place(e.place)}: a physician can cure it.`,
  theftCoins: (e) => `Thieves on ${place(e.place)} made off with ${e.coins} coins.`,
  theftGoods: (e) => `Thieves on ${place(e.place)} made off with ${ware(e.good)}.`,
  derelict: (e) => `A home on ${place(e.place)} stood empty after its thefts, and is left derelict.`,
  collapsed: (e) => `${e.kind === null ? "A home" : `The ${building(e.kind)}`} on ${place(e.place)} fell down: nobody mended it.`,
  rotted: (e) =>
    `${capital(spelt(e.rotted, noun("fish or loaf", "fish and loaves")))} rotted in store this minute: ${
      e.made === null
        ? `a ${building("granary")} keeps ${ware("fish")} and ${ware("bread")} five times as long, and ${ware("smoked")} keeps`
        : `the town makes about ${e.made} food a minute and eats ${e.eaten}: fewer ${token.kind("fishery", built("fishery").noun.other)}, a ${building("smokehouse")}, or selling ${ware("fish")} would stop the waste`
    }.`,
  lastRock: (e) =>
    e.ore
      ? `The last of the open ${ware("ore")} is dug: the worked faces still give a little, slowly. Traders sell ${ware("ore")} and ${ware("tools")}.`
      : `The last of the open ${ware("stone")} is quarried: the worked faces still give a little, slowly. Traders sell ${ware("stone")}.`,
  worksBegin: (e) => `Works begin on the ${building(e.kind, e.level - 1)}: it is to be ${a(built(e.kind, e.level).noun.one)}.`,
  upgraded: (e) => `The ${building(e.kind, e.level - 1)} is now ${a(built(e.kind, e.level).noun.one)}.`,
  legacy: (e) => e.text
} satisfies Wording<Event>

// ── Why a term ended ──────────────────────────────────────────────────────

/** How a term ended, in a word, for the reckoning's heading. */
export const ended = {
  bankrupt: "bankrupt",
  revolt: "revolt",
  abandoned: "abandoned",
  dismissed: "dismissed",
  over: "the term is over"
} satisfies Record<Exclude<Reason, "none">, string>

// ── What an edit answers with ─────────────────────────────────────────────

/** What a town still lacks before it can build something: "needs 20 residents (the town has 12)". */
export const lock = {
  residents: (l) => `needs ${l.needs} residents (the town has ${l.has})`,
  citizens: (l) => `needs ${l.needs} citizens (the town has ${l.has})`
} satisfies Wording<Lock>

/** What keeps a town from an upgrade: the rank it must reach first. */
export const needsRank = (n: number): string => `needs the town to be ${a(rank(n))}`

export const notice = {
  locked: (n) => `${names.kind.title(n.kind)} ${say(lock, n.lock)}`,
  pieceLocked: (n) => `${capital(props[n.prop].noun.one)} needs a bigger town`,
  noRoom: () => "No room there",
  short: (n) => `Not enough ${n.of === "coins" ? "coins" : goods[n.of].other}`,
  parkFirst: () => "Lay park ground first",
  rockUnworked: () => "Quarry it down first: only a worked face can be cleared",
  hallStays: () => "The town hall stays",
  salvageFee: (n) => `Pulling it down costs ${token.coins(n.fee)}`,
  pulledDown: (n) => `${n.cancelled ? "Cancelled" : "Pulled down"} · ${salvage(n.salvage)}${n.lost > 0 ? ` (${n.lost} found no room in storage)` : ""}`,
  crownSent: (n) => `Sent · ${token.coins(n.reward, true)}`,
  upgradeBlocked: (n) => `${names.kind.title(n.kind, n.level)} ${needsRank(n.rank)}`,
  worksBegun: (n) => `${names.kind.title(n.kind, n.level)} · ${token.coins(-n.coins, true)} · carriers bring ${cost({ coins: 0, materials: n.materials })}`
} satisfies Wording<Notice>

