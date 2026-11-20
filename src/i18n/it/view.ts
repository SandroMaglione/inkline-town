/**
 * Italian for what the view reads off the town (`src/view`): the panels of
 * a building, a home, a park, and a ruin; why something is not working and
 * what to do about it; the alerts; the tooltip under the pointer; the map
 * views' legends; and what an upgrade changes. The same entries as
 * English's (`satisfies typeof English`), each with the same tokens in it.
 *
 * Two turns are Italian's own. A building's gender is not known where a
 * line speaks of "it" (a panel serves every kind), so a state is said with
 * a phrase that does not agree ("al lavoro", "a riposo", "senza strada")
 * rather than an adjective that would, and advice is turned so nothing
 * refers back to the building by a pronoun. And every article or
 * preposition before a building or a good goes through `grammar.ts` or
 * `chips.ts`, so it bends to the noun whatever the noun is renamed to.
 */
import { COMMUTE, home, type Crew, type GoodId, type GroundId, type Kind, type KindId, type Need, type PropId, type Tier } from "../../game/content/index.ts"
import type { Cause, RiskId, Street } from "../../game/rules/explain.ts"
import type { GoalId } from "../../game/rules/goals.ts"
import type { Salvage } from "../../game/rules/salvage.ts"
import type { Change } from "../../game/rules/upgrades.ts"
import type { Lock } from "../../game/said.ts"
import type { Status } from "../../game/schema.ts"
import type { AppealLabel, AppealPart, ParkLabel } from "../../game/world/appeal.ts"
import type { view as English } from "../en/view.ts"
import type { Problem } from "../../view/facts.ts"
import type { PlaceProblem } from "../../view/interaction/placing.ts"
import type { LegendKeys } from "../../view/overlay.ts"
import type { WantedReason } from "../../view/upgrades.ts"
import * as token from "../token.ts"
import { say, type Wording } from "../wording.ts"
import { aKind, good, kind, kinds, theGood, theKind, theKinds, toKind } from "./chips.ts"
import { a, agree, before, capital, count, decimal, f, m, signed, the, theArticle, theMany, to, toMany, type Noun } from "./grammar.ts"
import { built, goods, grounds, props, tiers } from "./nouns.ts"
import { cost, lock, needsRank, salvage } from "./said.ts"

const homes = f("casa", "case"), cells = f("casella", "caselle"), roadCells = f("casella di strada", "caselle di strada"), residents = m("abitante", "abitanti")
const kindNoun = (id: KindId, level = 0): Noun => built(id, level).noun
const kindName = (id: KindId, level = 0) => kindNoun(id, level).one
const town = token.command("town")
/** A good in plain words with its article, in the number the town speaks of it in: "il pane", "le tavole", "i mobili". */
const theWare = (id: GoodId): string => before(theArticle(goods[id], goods[id].counted), goods[id].name)
/** A span of seconds, to a tenth: "4,5 s". */
const seconds = (s: number) => `${decimal(Math.round(s * 10) / 10)} s`

// Buildings named in plain words in more than one line, each with the article it takes.
const aBuilder = a(kindNoun("builder")), aFirewatch = a(kindNoun("firewatch")), aHealer = a(kindNoun("healer")), aWatchhouse = a(kindNoun("watchhouse"))

/** What a cause or a problem says: why, and (when there is something to do) what. */
interface Told {
  readonly why: string
  readonly fix?: string
}
/** A building's problem: in a word or two, why in a line, and what to do. */
interface ToldProblem extends Told {
  readonly label: string
}
/** One thing an upgrade changes, as a row: what, from what to what, and what qualifies it. */
interface Gain {
  readonly label: string
  readonly value?: string
  readonly note?: string
}

// ── Streets: what makes one, and what would lift it ───────────────────────

/** What a source of desirability is called in a street's readout. */
const source = {
  kind: (l) => kindName(l.kind, l.level),
  homes: () => "belle case accanto",
  water: () => "acqua",
  woods: () => "bosco",
  paved: () => "via lastricata",
  ruin: () => "rovina",
  worn: () => "una casa malridotta",
  park: () => "parco"
} satisfies Wording<AppealLabel>

/** What counts most against a street, in a line: "cava −6, magazzino −2". */
const against = (parts: ReadonlyArray<AppealPart>, most = 2): string =>
  parts.filter((p) => p.value < 0).slice(0, most).map((p) => `${say(source, p.label)} ${signed(p.value)}`).join(", ")

const street = {
  source,
  against,
  /** A street against what the next tier needs: "−4 qui, ne servono 5: cava −6". */
  short: (s: Street, needed: number): string => {
    const why = against(s.parts)
    return `${signed(s.desirability)} qui, ne servono ${needed}${why ? `: ${why}` : ""}`
  },
  /** What would lift a street: the things a mayor can do (`dragged`: something drags it down). Buildings as chips. */
  advice: (dragged: boolean): string =>
    dragged ? `allontana le attività produttive, o aggiungi un parco, ${aKind("chapel")} o il selciato` : `un parco, ${aKind("chapel")} o una via lastricata accanto`
}

// ── Why a home lacks something ────────────────────────────────────────────

const marketWalker = `l'ambulante ${to("di", kindNoun("market"))}`

const notLately = {
  food: `${marketWalker} non passa da un po'`,
  bread: `${marketWalker} non passa con ${theWare("bread")} da un po'`,
  cloth: `${marketWalker} non passa con ${theWare("cloth")} da un po'`,
  faith: `il prete ${to("di", kindNoun("chapel"))} non passa da un po'`,
  furniture: `${marketWalker} non passa con ${theWare("furniture")} da un po'`
} satisfies Record<Need, string>

const noneInTown = {
  food: { why: "il paese non ha cibo in magazzino", fix: `costruisci ${aKind("fishery")} vicino all'acqua: è il modo più rapido` },
  bread: { why: "il paese non ha pane", fix: `costruisci ${aKind("bakery")}: ${theGood("wheat")} ${toKind("di", "farm")} va ${toKind("a", "mill")}, e ${theGood("flour")} ${toKind("a", "bakery")}` },
  cloth: { why: "il paese non ha stoffa", fix: `costruisci ${aKind("weaver")}: tesse ${theGood("wool")} ${toKind("di", "sheep")}` },
  furniture: { why: "il paese non ha mobili", fix: `costruisci ${aKind("carpenter")}: fa ${theGood("furniture")} con ${theGood("planks")}` }
} satisfies Record<Exclude<Need, "faith">, Told>

/** A good that is only brought to a finer street: the verb follows its number. */
const notBrought = { cloth: `${theWare("cloth")} non arriva qui`, furniture: `${theWare("furniture")} non arrivano qui` } satisfies Record<"cloth" | "furniture", string>

const risks = { fire: "incendio", health: "salute", order: "ordine" } satisfies Record<RiskId, string>

/** Why a need is unmet, and what to do about it: the cause in a line, the cure with its buildings as chips. */
const cause: Wording<Cause, Told> = {
  noWalker: (c) =>
    c.service === "market"
      ? { why: `nessun ambulante ${to("di", kindNoun("market"))} arriva a questa via`, fix: `costruisci ${aKind("market")}: il suo ambulante percorre ${c.range} caselle di strada, quello ${toKind("di", "townhall")} ${c.hallRange}` }
      : { why: `nessun prete ${to("di", kindNoun("chapel"))} arriva a questa via`, fix: `costruisci ${aKind("chapel")}: il suo prete percorre ${c.range} caselle di strada` },
  tooPoor: (c) => ({
    why: `${notBrought[c.need]}: solo in una via da ${c.needed} in su, e questa è a ${signed(c.desirability)}`,
    fix: "migliora la via (vedi via)"
  }),
  noneInTown: (c) => noneInTown[c.need],
  notLately: (c) => ({ why: notLately[c.need] }),
  // "fire, health not kept down": the risks are listed after, so no participle has to agree with each.
  unkept: (c) => ({
    why: `rischi non tenuti a bada: ${c.high.map((r) => risks[r]).join(", ")}`,
    fix: `${aKind("firewatch")}, ${aKind("healer")} e ${aKind("watchhouse")} devono tutti passare di qui`
  })
}

// ── Why a building is not working ─────────────────────────────────────────

/** What a gatherer finds none of: as its label says it, and as its reason does. */
const sources = {
  stone: { label: "senza pietra", none: "niente pietra" },
  ore: { label: "senza minerale", none: "niente minerale" },
  field: { label: "senza campi maturi", none: "nessun campo maturo" }
} as const

/** Why a building is not working: in a word or two, why in a line, and what to do (its buildings and goods as chips). */
const problem: Wording<Problem, ToldProblem> = {
  unconnected: () => ({ label: "senza strada", why: "serve una strada al centro di uno dei suoi lati", fix: "traccia una strada lungo uno dei suoi lati" }),
  noWorkersNear: (p) => ({
    label: "senza lavoratori",
    why: `nessuna ${p.crew === "citizens" ? "casa di cittadini (o di coloni)" : "capanna di coloni"} entro ${COMMUTE} caselle di strada`,
    fix: "disponi case più vicino, o una strada verso le case vicine"
  }),
  workersTaken: () => ({ label: "senza lavoratori", why: "tutti quelli vicini hanno già un lavoro", fix: `disponi altre case entro ${COMMUTE} caselle di strada` }),
  full: () => ({ label: "tutto pieno", why: "non c'è dove portare ciò che produce", fix: `costruisci ${aKind("warehouse")} vicino, o vendi l'eccedenza nel pannello ${town}` }),
  paused: () => ({ label: "in pausa", why: "nessun lavoratore, un quarto del mantenimento", fix: "riprendi il lavoro qui sotto" }),
  fishedOut: (p) => ({
    label: "senza pesce",
    why: `l'acqua a portata è esaurita: ogni tratto riposa ${p.seconds} s dopo una pescata`,
    fix: `serve una riva più lunga tutta sua, o meno ${kinds("fishery")} su quest'acqua`
  }),
  noWater: (p) => ({ label: "senz'acqua", why: `niente acqua entro ${p.radius} caselle`, fix: "ricostruisci sulla riva" }),
  workedOut: (p) => ({
    label: "roccia esaurita",
    why: `le pareti scavate a portata danno ancora un po' di ${goods[p.source].name} ogni tanto`,
    fix: `costruisci accanto a roccia intatta, o compra ${theGood(p.source)} nel pannello ${town}`
  }),
  growing: (p) => ({ label: "in attesa", why: `${p.source === "tree" ? "gli alberi" : "i campi"} a portata stanno ancora crescendo` }),
  noTrees: (p) => ({ label: "senza alberi", why: `nessun albero cresciuto entro ${p.radius} caselle`, fix: `costruisci ${aKind("forester")} vicino: ripianta` }),
  noSource: (p) => ({ label: sources[p.source].label, why: `${sources[p.source].none} entro ${p.radius} caselle`, fix: "ricostruisci più vicino" }),
  noInput: (p) => ({
    label: `senza ${goods[p.good].name}`,
    why: `in attesa di ${goods[p.good].name}`,
    fix: p.maker ? `costruisci ${aKind(p.maker)}, o compra ${theGood(p.good)} nel pannello ${town}` : `compra ${theGood(p.good)} nel pannello ${town}`
  }),
  nothingToHandOut: () => ({ label: "niente da distribuire", why: "qui non c'è pesce, pane né stoffa", fix: "riempi il magazzino: si rifornisce da lì" }),
  noPlanks: () => ({ label: "senza tavole", why: "niente con cui riparare", fix: `costruisci ${aKind("sawmill")}` }),
  waiting: () => ({ label: "in attesa", why: "in attesa" }),
  onFire: () => ({ label: "in fiamme!", why: "i lavoratori sono fuggiti", fix: `i pompieri di ${aKind("firewatch")} spengono gli incendi` })
}

// ── Upgrades ──────────────────────────────────────────────────────────────

/** What an upgrade changes, a row each: what, from what to what, and (after a comma, in a line) what qualifies it. */
const change: Wording<Change, Gain> = {
  output: (c) => ({ label: goods[c.good].name, value: `${c.from} → ${c.to} al minuto (un lavoro ogni ${seconds(c.secondsFrom)} → ${seconds(c.secondsTo)})` }),
  workers: (c) => ({ label: "lavoratori", value: `${c.from} → ${c.to}` }),
  holds: (c) => ({ label: "contiene", value: `${c.from} → ${c.to} per merce` }),
  carriers: (c) => ({ label: "portatori", value: `${c.from} → ${c.to}` }),
  firefighters: (c) => ({ label: "pompieri", value: `${c.from} → ${c.to}` }),
  reach: (c) => ({ label: "l'ambulante arriva a", value: `${c.from} → ${c.to} caselle di strada` }),
  calls: (c) => ({ label: "un ambulante ogni", value: `${seconds(c.from)} → ${seconds(c.to)}` }),
  deep: () => ({ label: "taglia la roccia esaurita a pieno ritmo, non a un terzo" }),
  admin: (c) => ({ label: "amministrazione", value: `${c.from}% → ${c.to}% in meno` }),
  appeal: (c) => ({
    label: "attrattiva intorno",
    value: `${c.from === null ? "0" : signed(c.from)} → ${signed(c.to)}`,
    ...(c.reach === null ? {} : { note: `fino a ${c.reach} caselle` })
  }),
  upkeep: (c) => ({ label: "mantenimento", value: `${c.from} → ${token.rate(c.to)}` })
}

/** Why the town needs an upgrade now. In an alert its buildings and goods are chips; in a panel it is said in words. */
const wanted = {
  nextRank: "il prossimo rango lo richiede",
  shelvesFull: "ha gli scaffali pieni",
  rockWorked: "ha esaurito la sua roccia",
  millsWait: `${theKinds("mill")} aspettano ${theGood("wheat")}`,
  breadShort: `le case restano senza ${good("bread")} mentre lavora a pieno ritmo`,
  unreached: "ci sono case che nessun ambulante con il cibo raggiunge",
  beyondPriest: "ci sono case che il suo prete non raggiunge",
  fireRisk: "le case delle sue vie corrono un alto rischio d'incendio"
} satisfies Record<WantedReason, string>

const upgrade = {
  change,
  /** A change in one line: "attrattiva intorno +4 → +6, fino a 6 caselle". */
  line: (g: Gain): string => `${[g.label, ...(g.value === undefined ? [] : [g.value])].join(" ")}${g.note === undefined ? "" : `, ${g.note}`}`,
  /** What starting an upgrade costs: coins now, and the materials carriers then bring. */
  price: (c: Kind["cost"]): string => {
    const carried = cost({ coins: 0, materials: c.materials })
    return `${token.coins(c.coins)} subito${carried ? ` · i portatori portano ${carried}` : ""}`
  },
  /** The treasury lacks this much of what it costs to begin. */
  short: (n: number): string => `${n === 1 ? "manca" : "mancano"} ${token.coins(n)}`,
  wanted,
  /** The first upgrade the town needs, in the ticker: why, what becomes what, and how to begin. */
  hint: (h: { readonly reason: WantedReason; readonly kind: KindId; readonly level: number }): string =>
    `${wanted[h.reason]}: ${theKind(h.kind, h.level)} può diventare ${a(kindNoun(h.kind, h.level + 1))}. ${token.device("Tocca", "Clicca")} l'edificio, sotto la freccia dorata, per iniziare`,
  /** The upgrade tool's tooltip. */
  path: (kind: KindId, level: number): string => `${kindName(kind, level)} → ${kindName(kind, level + 1)}`,
  underWay: "in corso: i portatori stanno portando i materiali",
  begin: "clicca per iniziare: nel frattempo continua a lavorare",
  pick: (kind: KindId): string => `amplia: scegli ${a(kindNoun(kind))} · Esc per smettere`,
  /** The gestures' answers. */
  pickOne: "Scegli un edificio da ampliare",
  already: (kind: KindId): string => `${capital(the(kindNoun(kind)))} è già in ampliamento`,
  /** An upgrade under way, in the building's panel. */
  becoming: (kind: KindId, level: number): string => `sta diventando ${a(kindNoun(kind, level))}`,
  // "built", beside a share of the works: a noun, so it agrees with no building.
  built: "avanzamento",
  stillBring: (left: string): string => `i portatori devono ancora portare ${left}; nel frattempo continua a lavorare`,
  allIn: "tutti i materiali sono arrivati; i muratori li stanno mettendo in opera, e nel frattempo continua a lavorare"
}

// ── Placing ───────────────────────────────────────────────────────────────

const gathered = { tree: "nessun albero", stone: "nessuna roccia chiara di pietra", ore: "nessuna roccia scura di minerale", water: "niente acqua" } as const

const place = {
  /** What is wrong with a building where it would stand. */
  problem: {
    noRoad: () => "serve una strada al centro di un lato",
    nothingNear: (p) => `${gathered[p.source]} entro ${p.radius} caselle`
  } satisfies Wording<PlaceProblem>,
  /** A building refused where it was put down: "Peschiera: serve una strada al centro di un lato". */
  refused: (kind: KindId, why: string): string => `${capital(kindName(kind))}: ${why}`
}

// ── Map views ─────────────────────────────────────────────────────────────

/**
 * Each map view's legend: its heading, what each colour means, and how the reading works. A colour is laid over homes
 * and buildings alike, so what it means is said with a phrase ("sotto controllo", "in buono stato"), not an adjective
 * that would agree with one of them.
 */
const legend = {
  appeal: {
    title: "attrattiva",
    keys: {
      townhouses: `${home.tiers[3].appeal}+: ${tiers[3].home.other}`,
      citizens: `${home.tiers[2].appeal}+: ${tiers[2].people.other}`,
      settlers: `da 0 a 4: solo ${tiers[1].people.other}`,
      fewer: "sotto 0: meno gente, meno tasse",
      squalid: `${signed(home.squalid)} o meno: squallore`
    },
    note: `Ogni punto conta: una capanna ospita meno gente e paga meno per ogni punto sotto 0, e paga di più sopra. Le attività produttive allontanano le case; i parchi (più cose contengono, più lontano arrivano), ${a(kindNoun("chapel"))}, ${a(kindNoun("market"))} e le vie lastricate le attirano.`
  },
  workers: {
    title: "lavoratori",
    keys: { staffed: "al completo", short: "a corto di lavoratori", none: "senza lavoratori", settlers: "case dei coloni", citizens: "case dei cittadini" },
    note: `Gli abitanti fanno al massimo ${COMMUTE} caselle di strada per andare al lavoro. Seleziona un luogo di lavoro per vedere fin dove arriva e le case al suo interno.`
  },
  fire: {
    title: "incendi",
    keys: { good: "sotto controllo", fair: "in aumento", bad: "a rischio, o in fiamme" },
    note: `Anche gli edifici prendono il colore. La vedetta di ${aFirewatch} azzera il rischio di ogni casa e bottega lungo la via; il vermiglio significa oltre la metà, quindi c'è ancora tempo. Capanne di legno, forni, fucine e affollamento fanno salire il rischio.`
  },
  health: {
    title: "salute",
    keys: { good: "visita recente", fair: "in aumento", bad: "a rischio, o con malati" },
    note: `Il medico di ${aHealer} azzera il rischio e cura i malati. Fame, affollamento, squallore, polvere di cava e acqua stagnante fanno salire il rischio.`
  },
  order: {
    title: "ordine",
    keys: { good: "in ordine", fair: "in aumento", bad: "ladri in giro" },
    note: `Il gendarme di ${aWatchhouse} mantiene l'ordine. Consenso basso, squallore e case non piene fanno salire il rischio; prima i furti, poi la casa viene abbandonata.`
  },
  condition: {
    title: "stato",
    keys: { good: "in buono stato", fair: "da riparare", bad: "in cattivo stato: metà ritmo" },
    note: `${capital(aBuilder)} ripara con tavole e pietra ciò davanti a cui passa il suo muratore. Quando lo stato arriva a zero, c'è il crollo.`
  }
} satisfies { readonly [V in keyof LegendKeys]: { readonly title: string; readonly keys: Readonly<Record<LegendKeys[V], string>>; readonly note: string } }

// ── Parks and ruins ───────────────────────────────────────────────────────

/** What a park does for the streets around it. */
const parkWorth = (value: number, reach: number): string => `attrattiva ${signed(value)} fino a ${reach} caselle`
/** What became of a ruin, in a word: of "rovina", so in the feminine. */
const ruinCause = { burnt: "bruciata", collapsed: "crollata", derelict: "abbandonata" }

// ── The catalog's part ────────────────────────────────────────────────────

export const view = {
  /** What a building is doing, in a word: phrases that agree with no building, whatever its gender. */
  status: {
    building: "in costruzione", idle: "a riposo", working: "al lavoro", starved: "senza rifornimenti", blocked: "senza sbocco", unstaffed: "senza lavoratori", unconnected: "senza strada", paused: "in pausa"
  } satisfies Record<Status, string>,
  street,
  cause,
  /** A cause in one line: "why: what to do". */
  causeLine: (told: Told): string => (told.fix === undefined ? told.why : `${told.why}: ${told.fix}`),
  problem,
  /** A problem in one line, for the panel's header and the tooltip: "senza strada: serve una strada al centro di uno dei suoi lati". */
  problemLine: (told: ToldProblem): string => `${told.label}: ${told.why}`,
  upgrade,
  place,
  legend,
  /** How a risk reads: "ok", "40%", or "alto, 85%". */
  risk: { ok: "ok", some: (percent: number): string => `${percent}%`, high: (percent: number): string => `alto, ${percent}%` },
  /** What pulling something down (or cancelling a site) costs and gives back: "demolisci: −25 monete · di ritorno 2 tavole, 3 di pietra". */
  salvage: (s: { readonly cancelled: boolean; readonly salvage: Salvage }): string => {
    const said = salvage(s.salvage)
    return `${s.cancelled ? "annulla" : "demolisci"}${said ? `: ${said}` : ""}`
  },

  /** What moves the town's approval, a row each. */
  mood: {
    base: "umore del paese",
    needs: "bisogni soddisfatti",
    taxes: "tasse attuali",
    grudge: "rancore per le tasse passate",
    debt: "salari non pagati",
    crown: "malcontento della corona",
    winter: "un inverno di fame"
  },

  /** What the next rank asks: each goal, and how the town stands against it. */
  goal: {
    text: {
      residents: (target) => `${target} abitanti`,
      citizens: (target) => `${target}% di ${tiers[2].people.other}`,
      burghers: (target) => `${target}% di ${tiers[3].people.other}`,
      approval: (target) => `consenso a ${target} o più`,
      income: (target) => `${target} monete al minuto, senza debiti`,
      hall: (target) => a(kindNoun("townhall", target))
    } satisfies Record<GoalId, (target: number) => string>,
    value: {
      residents: (value) => `${value}`,
      citizens: (value) => `${value}%`,
      burghers: (value) => `${value}%`,
      approval: (value) => `${value}`,
      income: (value) => `${value}`,
      hall: (value, target) => (value >= target ? "c'è" : "non ancora")
    } satisfies Record<GoalId, (value: number, target: number) => string>
  },

  /** What needs looking at now, in the ticker: buildings, goods, and tools as chips; amounts in words. */
  alerts: {
    fire: (burning: number, watched: boolean): string =>
      `${burning} in fiamme: ${watched ? `i pompieri ${toKind("di", "firewatch")} stanno arrivando` : `costruisci ${aKind("firewatch")} vicino: i suoi pompieri spengono gli incendi`}`,
    sick: (sick: number, healed: boolean): string =>
      `${count(sick, homes)} ${sick === 1 ? "malata" : "malate"}, con metà degli abitanti: ${healed ? `${aKind("healer")} a portata della strada guarisce i malati` : `costruisci ${aKind("healer")} tra le case`}`,
    /** Workshops idle for want of their input, by kind: "senza rifornimenti: il mulino aspetta il grano ×2. …". */
    idle: (waiting: ReadonlyArray<{ readonly kind: KindId; readonly good: GoodId; readonly n: number }>): string =>
      `senza rifornimenti: ${waiting.map((w) => `${theKind(w.kind)} aspetta ${theGood(w.good)}${w.n > 1 ? ` ×${w.n}` : ""}`).join(", ")}. Produci di più ciò che manca, o compralo nel pannello ${town}`,
    /** Workplaces no home can reach, by kind. */
    remote: (remote: ReadonlyArray<{ readonly kind: KindId; readonly n: number }>): string =>
      `nessun lavoratore per ${remote.map((w) => `${theKind(w.kind)}${w.n > 1 ? ` ×${w.n}` : ""}`).join(", ")}: disponi ${token.command("homes")} entro ${COMMUTE} caselle di strada da lì, o una strada verso le case vicine`,
    hungry: `niente cibo in magazzino, così le case patiscono la fame e non pagano tasse: costruisci ${agree(kindNoun("fishery"), "un altro", "un'altra")} ${kind("fishery")}, o compra ${theGood("fish")} nel pannello ${town}`
  },

  /** A building's panel. */
  building: {
    beingBuilt: "in costruzione",
    waitingFor: "in attesa di",
    carriersBring: "i portatori li portano dal magazzino: compra nel pannello paese ciò che al paese manca",
    builders: "muratori",
    atWork: "al lavoro",
    workers: "lavoratori",
    staffed: (assigned: number, needed: number): string => `${assigned} su ${needed}`,
    nobodyNear: (crew: Crew): string => `nessun ${tiers[crew === "citizens" ? 2 : 1].people.one} abita entro ${COMMUTE} caselle di strada: disponi case più vicino`,
    allTaken: `tutti quelli vicini hanno un lavoro: disponi altre case entro ${COMMUTE} caselle di strada`,
    apprentices: "i coloni sostituiscono i cittadini, a tre quarti del ritmo",
    makes: "produce",
    /** What it makes: from what, into what (each with its icon), or what alone. */
    recipe: (input: GoodId | null, output: GoodId): string => (input ? `${token.good(input)} → ${token.good(output)}` : goods[output].name),
    walkersOut: "ambulanti in giro",
    handedOut: "distribuito, ultimo minuto",
    handedTo: (n: number): string => `a ${count(n, homes)} lungo i suoi giri`,
    nothing: "niente",
    nobodyNeeded: "nessuna casa lungo i suoi giri aveva bisogno di ciò che portava",
    shelf: "sugli scaffali ora",
    holds: "contiene",
    tools: "attrezzi",
    none: "nessuno",
    noTools: `metà ritmo finché non ne arriva uno: li fa ${a(kindNoun("smithy"))}, o comprali nel pannello paese`,
    upkeep: "mantenimento",
    upkeepValue: (coins: number): string => token.rate(coins),
    condition: "stato",
    runDown: `metà ritmo, e rischia il crollo: ${aBuilder} fa le riparazioni`,
    wearing: `${aBuilder} fa le riparazioni quando passa il suo muratore`,
    fireRisk: "rischio d'incendio",
    fireCure: `la vedetta di ${aFirewatch} lo abbassa quando passa`,
    appeal: "attrattiva intorno",
    work: "al lavoro",
    running: "gestione",
    /** Behind the ⓘ of "gestione": a sentence for each thing that costs or risks something. */
    help: {
      upkeep: "Il mantenimento si paga ogni minuto finché l'edificio è in piedi, un quarto mentre è in pausa.",
      condition: `Tutto si consuma; ${aBuilder} fa le riparazioni.`,
      hot: "Un forno o una fucina: un rischio d'incendio per sé e per le case entro 2 caselle.",
      appeal: (reach: number, worse: boolean): string =>
        `Cambia quanto sono belle le vie fino a ${reach} caselle${worse ? ": le case vicine ospitano meno gente e pagano meno" : ""}.`
    }
  },

  /** A home's panel: a home is "casa", "capanna", or "palazzina", so what is said of it is in the feminine. */
  house: {
    household: "famiglia",
    beingBuilt: "in costruzione",
    builders: "muratori",
    waitingPlank: "in attesa della sua tavola",
    closed: "chiusa",
    empty: "vuota",
    closedNote: `non paga tasse e non costa nulla ${to("a", kindNoun("townhall"))}: riaprila e i coloni tornano`,
    /** Why it holds fewer than it could. */
    fewer: {
      sick: "la metà finché è malata",
      disapproval: "meno finché il paese disapprova il suo sindaco",
      street: (advice: string): string => `meno in una via povera: ${advice}`,
      taxed: (rate: number): string => `meno con le tasse al ${rate}%: qualcuno se ne va`,
      needs: "meno finché ogni bisogno non è soddisfatto"
    },
    onFire: "in fiamme",
    fled: "sono fuggiti tutti",
    sick: "malata",
    halved: "la metà",
    sickNote: `passa in un minuto, o quando arriva il medico di ${aHealer}`,
    residents: "abitanti",
    living: (n: number, room: number): string => `${n} su ${room}`,
    pays: "paga",
    paying: (coins: number): string => token.rate(coins),
    hungry: "affamata",
    hungryNote: "affamata: niente cibo, niente tasse",
    could: (coins: number): string => `${token.rate(coins)} con ogni bisogno soddisfatto`,
    worksAt: "lavora presso",
    workplace: (kind: KindId): string => kindName(kind),
    nothingNearby: "niente nei dintorni",
    needs: "bisogni",
    met: "✓",
    missing: "manca",
    /** What a need is wanted for: the tier it would raise the home to. */
    forTier: (tier: Tier): string => `per ${theMany(tiers[tier].people)}`,
    street: "via",
    streetOf: (desirability: number, needed: number): string => `${signed(desirability)} su ${needed}`,
    desirability: (d: number): string => signed(d),
    services: "servizi",
    rebuilding: "ricostruzione",
    rebuilt: "fatta ✓",
    shortOf: (short: Kind["cost"]): string =>
      `al paese mancano ${[...(short.coins > 0 ? [token.coins(short.coins)] : []), ...(Object.entries(short.materials) as Array<[GoodId, number]>).map(([g, n]) => token.amount(g, n))].join(", ")}`,
    waitsForStore: `resta al suo livello finché il magazzino non ha ciò che serve: producilo, o compralo nel pannello ${town}`,
    rebuiltAlready: "già ricostruita: risale senza spese",
    readyFor: (tier: Tier): string => `pronta per ${theMany(tiers[tier].people)}`,
    readyNote: "cresce quando arriva il prossimo abitante, e allora paga la sua ricostruzione",
    safety: "rischi e usura",
    risks: "rischi",
    allLow: "tutti bassi",
    riskOf: { fire: "rischio d'incendio", health: "rischio per la salute", order: "rischio di furti" } satisfies Record<RiskId, string>,
    cure: { fire: `lo abbassa la vedetta di ${aFirewatch}`, health: `lo abbassa il medico di ${aHealer}`, order: `lo abbassa il gendarme di ${aWatchhouse}` } satisfies Record<RiskId, string>,
    robbed: "derubata",
    times: (n: number): string => `${n}×`,
    condition: "stato",
    runDown: `trascina giù la via e rischia il crollo: ${aBuilder} fa le riparazioni`,
    wearing: `${aBuilder} fa le riparazioni quando passa il suo muratore`,
    /** Behind the ⓘ of "bisogni", by the home's tier: what red and amber mean, and what the next tier asks. */
    needsHelp: {
      1: `Rosso: le serve ora. Ambra: le serve per diventare ${a(tiers[2].home)}, che ospita e paga il doppio. Già il solo pane fa pagare a una capanna una volta e mezza. Gli ambulanti portano i bisogni lungo la strada; la via è quanto è bello il posto (attrattiva ${home.tiers[2].appeal} per ${theMany(tiers[2].people)}).`,
      2: `Rosso: le serve ora, o torna ${toMany("a", tiers[1].people)}. Ambra: le serve per diventare ${a(tiers[3].home)} di ${tiers[3].people.other}, in una via da ${home.tiers[3].appeal} dove passano ${aFirewatch}, ${aHealer} e ${aWatchhouse}.`,
      3: `Rosso: le serve ora, o torna ${toMany("a", tiers[2].people)}.`
    } satisfies Record<Tier, string>,
    safetyHelp: "In ogni casa il rischio di incendio, malattia e furto sale piano; un ambulante del servizio giusto lo abbassa quando passa.",
    /** How it is, in a word or two for the header. */
    summary: (n: number): string => count(n, residents)
  },

  /** A park's panel. */
  park: {
    worth: parkWorth,
    /** What a park's beauty is made of. */
    part: {
      ground: (l) => (l.capped ? "terreno (tutto ciò che conta)" : "terreno"),
      ways: (l) => (l.count === 1 ? "ingresso dalla strada" : "ingressi dalla strada"),
      prop: (l) => props[l.prop].noun.one
    } satisfies Wording<ParkLabel>,
    size: "dimensione",
    sizeOf: (n: number, beauty: number): string => `${count(n, cells)} · bellezza ${decimal(beauty)}`,
    madeOf: "fatto di",
    /** Its parts with what each is worth, already worded: "terreno 2, lampione 1,5". */
    parts: (parts: ReadonlyArray<{ readonly label: string; readonly value: number }>): string => parts.map((p) => `${p.label} ${decimal(p.value)}`).join(", ") || "ancora niente",
    streets: "le vie intorno",
    ways: "ingressi dalla strada",
    waysIn: (n: number): string => `${n}${n > 2 ? " (ne contano 2)" : ""}`,
    none: "nessuno",
    noWays: `stendi ${a(grounds.path.noun)} o ${a(grounds.square.noun)} fino a una strada: +1,5 l'uno, ne contano due`,
    furnishings: "arredi che contano",
    furnished: (placed: number, room: number): string => `${placed} su ${room}`,
    crowded: (n: number): string => `${n} di troppo: ne conta uno ogni 2 caselle di parco, quindi stendi altro terreno`,
    nicerWith: "più bello con",
    missing: (ids: ReadonlyArray<PropId>): string => ids.map((id) => props[id].noun.one).join(", "),
    upkeep: "mantenimento",
    upkeepValue: (coins: number): string => token.rate(coins)
  },

  /** A ruin's panel. */
  ruin: {
    cause: ruinCause,
    happened: "che cosa è successo",
    // What stood here is not known to be a home or a building: each is said as what befell it, a noun.
    what: { burnt: "un incendio", collapsed: "un crollo, per mancanza di riparazioni", derelict: "l'abbandono, dopo i furti" },
    appeal: "attrattiva intorno",
    untilCleared: "finché non viene sgombrata: demoliscila"
  },

  /** What the pointer is over, in a line; and what a tool would lay there, and for how much. Amounts as icons. */
  tooltip: {
    /** A building: what it is doing, or what keeps it from it; and what it is becoming, when works are under way. */
    building: (b: { readonly kind: KindId; readonly level: number; readonly state: string; readonly works: { readonly level: number; readonly percent: number } | null }): string =>
      `${kindName(b.kind, b.level)} · ${b.state}${b.works ? ` · sta diventando ${a(kindNoun(b.kind, b.works.level))}, al ${b.works.percent}%` : ""}`,
    /** Bulldozing: what pulling it down gives back, or that it stays. */
    bulldozeBuilding: (kind: KindId, level: number, back: string): string => `${kindName(kind, level)} · ${back}`,
    hallStays: `${the(kindNoun("townhall"))} resta`,
    bulldozeHome: (tier: Tier, back: string): string => `${tiers[tier].home.one} · ${back}`,
    homeClosed: (tier: Tier): string => `${tiers[tier].home.one} · ${agree(tiers[tier].home, "chiuso", "chiusa")}`,
    home: (h: { readonly tier: Tier; readonly residents: number; readonly desirability: number; readonly burning: boolean; readonly sick: boolean }): string =>
      `${tiers[h.tier].home.one} · ${count(h.residents, residents)} · attrattiva ${h.desirability}${h.burning ? " · in fiamme!" : h.sick ? ` · ${agree(tiers[h.tier].home, "malato", "malata")}` : ""}`,
    ruin: (cause: "burnt" | "collapsed" | "derelict"): string => `rovina · ${ruinCause[cause]} · demolisci per sgombrare`,
    park: (what: { readonly prop: PropId } | { readonly ground: GroundId }, whole: { readonly cells: number; readonly value: number; readonly reach: number } | null): string =>
      `parco · ${"prop" in what ? props[what.prop].noun.one : grounds[what.ground].noun.one}${whole ? ` · ${count(whole.cells, cells)} · ${parkWorth(whole.value, whole.reach)}` : ""}`,
    /** Placing a building: what keeps it from here, or what it costs. */
    placeLocked: (kind: KindId, l: Lock): string => `${kindName(kind)} · ${say(lock, l)}`,
    placeNoRoom: (kind: KindId): string => `${kindName(kind)} · qui non c'è posto`,
    placeProblem: (kind: KindId, why: string): string => `${kindName(kind)} · ${why}`,
    placeCost: (kind: KindId, c: Kind["cost"]): string => `${kindName(kind)} · ${cost(c)}`,
    pave: (c: { readonly coins: number; readonly stone: number }): string => `selciato · ${token.coins(c.coins)} e ${token.amount("stone", c.stone)} a casella · si cammina più svelti`,
    desirability: (d: number): string => `attrattiva ${d}`,
    cancel: "lascia qui per annullare",
    /** What new homes would bring in once fed, or that they would cost more than they pay. */
    // Said after one home or many ("1 casa", "4 case"): turned so nothing has to agree in number.
    homesWorth: (coins: number): string => (coins > 0 ? ` · ${token.rate(coins, true)} una volta arrivato il cibo` : " · il mantenimento supera le tasse: le case migliori pagano meglio"),
    homes: (c: Kind["cost"], worth: string | null): string => `case · ${cost(c)} l'una${worth ?? " · disponile lungo una strada"}`,
    road: (coins: number): string => `strada · ${token.coins(coins)} a casella`,
    /** A stroke being dragged: how much it lays, and what that costs. */
    roadStroke: (n: number, c: Kind["cost"]): string => `${count(n, roadCells)} · ${cost(c)}`,
    homesStroke: (n: number, c: Kind["cost"], worth: string): string => `${count(n, homes)} · ${cost(c)}${worth}`,
    paveStroke: (n: number, c: Kind["cost"]): string => `selciato per ${count(n, cells)} · ${cost(c)}`,
    groundStroke: (ground: GroundId, n: number, c: Kind["cost"]): string => `${grounds[ground].noun.one} · ${count(n, cells)} · ${cost(c)}`,
    ground: (ground: GroundId, c: Kind["cost"], park: number | null): string => `${grounds[ground].noun.one} · ${cost(c)}${park === null ? "" : ` · parco ${signed(park)} di attrattiva`}`,
    /** A furnishing about to be set: what the park would be worth with it (and is now, when that differs), and whether it is one too many. */
    prop: (prop: PropId, c: Kind["cost"], park: { readonly value: number; readonly before: number | null; readonly crowded: boolean } | null): string =>
      `${props[prop].noun.one} · ${cost(c)}${park ? ` · parco ${signed(park.value)} di attrattiva${park.before === null ? "" : ` (ora ${signed(park.before)})`}` : ""}${park?.crowded ? " · troppo affollato" : ""}`,
    propNeedsPark: (prop: PropId): string => `${props[prop].noun.one} · prima stendi il terreno del parco`,
    removeProp: (prop: PropId): string => `togli ${the(props[prop].noun)}`,
    removeGround: (ground: GroundId): string => `togli ${the(grounds[ground].noun)}`,
    workedFace: (ore: boolean): string => `parete scavata di ${goods[ore ? "ore" : "stone"].name} · demolisci per sgombrarla`,
    rock: (ore: boolean, left: number): string => `${goods[ore ? "ore" : "stone"].name} · ${left === 1 ? "ne resta" : "ne restano"} ${left}`,
    /** What a thing being placed would reach, said beside its outline. */
    walkersReach: (range: number): string => `i suoi ambulanti arrivano a ${range} caselle di strada dalla porta`,
    workersFrom: `i suoi lavoratori vengono dalle case entro ${COMMUTE} caselle di strada`,
    residentsWalk: `gli abitanti vanno al lavoro entro ${COMMUTE} caselle di strada`
  }
} satisfies typeof English
