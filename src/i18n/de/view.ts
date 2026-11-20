/**
 * German for what the view reads off the town (`src/view`): the panels of
 * a building, a home, a park, and a ruin; why something is not working and
 * what to do about it; the alerts; the tooltip under the pointer; the map
 * views' legends; and what an upgrade changes. The same entries as
 * English's (`satisfies typeof English`), each with the same tokens in it.
 *
 * Two turns are German's own. A panel serves every kind of building and
 * every home, whose genders differ ("die Siedlerhütte", "das Bürgerhaus"),
 * so where English says "it" of one, the German leaves the subject out, as
 * a label may ("braucht eine Straße"), or names what it means ("der
 * Betrieb läuft weiter"), rather than pick a pronoun that might not agree.
 * A predicate adjective takes no ending in German, so a state reads well
 * after any noun ("geschlossen", "krank"). And every article, pronoun, or
 * possessive before a building or a good goes through `grammar.ts` or
 * `chips.ts`, in the case its sentence needs.
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
import { aKind, good, kinds, ofKind, theGood, theKind, theKinds } from "./chips.ts"
import { a, capital, count, decimal, f, form, its, m, n, no, none, percent, pronoun, signed, the, theArticle, type Noun } from "./grammar.ts"
import { built, goods, grounds, props, tiers } from "./nouns.ts"
import { cost, lock, needsRank, salvage } from "./said.ts"

const homes = n("Haus", "Häuser"), cells = n("Feld", "Felder"), roadCells = n("Straßenfeld", "Straßenfelder"), residents = m("Bewohner", "Bewohner")
const walker = m("Läufer", "Läufer"), mason = m("Maurer", "Maurer"), firefighter = m("Feuerwehrmann", "Feuerwehrleute")
const kindNoun = (id: KindId, level = 0): Noun => built(id, level).noun
const kindName = (id: KindId, level = 0) => kindNoun(id, level).one
const town = token.command("town")
/** The town panel, named in plain words where no chip can go. */
const townPanel = "im Fenster „Ort“"
/** A span of seconds, to a tenth: "4,5 s". */
const seconds = (s: number) => `${decimal(Math.round(s * 10) / 10)} s`
/** "im Umkreis von 15 Straßenfeldern". */
const within = (count_: number, word: Noun = roadCells) => `im Umkreis von ${count(count_, word, "dat")}`
/** A good in plain words, in a case, in the number the town speaks of it in: "Bretter", "Brettern", "Holz". */
const ware = (id: GoodId, c: "nom" | "acc" | "dat" = "nom") => form(goods[id], c, goods[id].many)
/** A verb in its good's number: "Tuch wird", "Möbel werden". */
const verb = (id: GoodId, one: string, many: string) => (goods[id].many ? many : one)

// Buildings named in plain words in more than one line, each with the article it takes.
const builder = kindNoun("builder"), firewatch = kindNoun("firewatch"), healer = kindNoun("healer"), watchhouse = kindNoun("watchhouse"), hall = kindNoun("townhall")
/** "der Brandwächter einer Feuerwache", "der Bader einer Baderstube", "der Büttel eines Wachhauses". */
const firewatchman = `der Brandwächter ${a(firewatch, "gen")}`, physician = `der Bader ${a(healer, "gen")}`, bailiff = `der Büttel ${a(watchhouse, "gen")}`
/** "ein Bauhof bessert aus, wenn sein Maurer vorbeikommt". */
const mended = `${a(builder)} bessert aus, wenn ${its(builder, mason)} vorbeikommt`

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
  homes: () => "schöne Häuser daneben",
  water: () => "Wasser",
  woods: () => "Wald",
  paved: () => "Pflaster",
  ruin: () => "Ruine",
  worn: () => "ein verfallenes Haus",
  park: () => "Park"
} satisfies Wording<AppealLabel>

/** What counts most against a street, in a line: "Steinbruch −6, Lagerhaus −2". */
const against = (parts: ReadonlyArray<AppealPart>, most = 2): string =>
  parts.filter((p) => p.value < 0).slice(0, most).map((p) => `${say(source, p.label)} ${signed(p.value)}`).join(", ")

const street = {
  source,
  against,
  /** A street against what the next tier needs: "−4 hier, 5 nötig: Steinbruch −6". */
  short: (s: Street, needed: number): string => {
    const why = against(s.parts)
    return `${signed(s.desirability)} hier, ${needed} nötig${why ? `: ${why}` : ""}`
  },
  /** What would lift a street: the things a mayor can do (`dragged`: something drags it down). Buildings as chips. */
  advice: (dragged: boolean): string =>
    dragged ? `rücke Gewerbe weg, oder setze einen Park, ${aKind("chapel", "acc")} oder Pflaster dazu` : `ein Park, ${aKind("chapel")} oder eine gepflasterte Straße daneben`
}

// ── Why a home lacks something ────────────────────────────────────────────

const marketWalker = `der Läufer ${the(kindNoun("market"), "gen")}`

const notLately = {
  food: `${marketWalker} kam länger nicht vorbei`,
  bread: `${marketWalker} kam länger nicht mit ${ware("bread", "dat")} vorbei`,
  cloth: `${marketWalker} kam länger nicht mit ${ware("cloth", "dat")} vorbei`,
  faith: `der Läufer ${the(kindNoun("chapel"), "gen")} kam länger nicht vorbei`,
  furniture: `${marketWalker} kam länger nicht mit ${ware("furniture", "dat")} vorbei`
} satisfies Record<Need, string>

const noneInTown = {
  food: { why: "der Ort hat keine Nahrung im Lager", fix: `baue ${aKind("fishery", "acc")} am Wasser, das geht am schnellsten` },
  bread: {
    why: `der Ort hat ${no(goods.bread, "acc", goods.bread.many)}`,
    fix: `baue ${aKind("bakery", "acc")}; ${theGood("wheat")} ${aKind("farm", "gen")} ${verb("wheat", "geht", "gehen")} zu ${aKind("mill", "dat")}, ${theGood("flour")} daraus zu ${aKind("bakery", "dat")}`
  },
  cloth: { why: `der Ort hat ${no(goods.cloth, "acc", goods.cloth.many)}`, fix: `baue ${aKind("weaver", "acc")}; ${pronoun(kindNoun("weaver"))} webt ${theGood("wool", "acc")} ${aKind("sheep", "gen")}` },
  furniture: {
    why: `der Ort hat ${no(goods.furniture, "acc", goods.furniture.many)}`,
    fix: `baue ${aKind("carpenter", "acc")}; ${pronoun(kindNoun("carpenter"))} macht ${good("furniture", "acc")} aus ${good("planks", "dat")}`
  }
} satisfies Record<Exclude<Need, "faith">, Told>

/** A good that is only brought to a finer street: the verb follows its number. */
const notBrought = (id: "cloth" | "furniture") => `${ware(id)} ${verb(id, "wird", "werden")} hier nicht geliefert`

const risks = { fire: "Brand", health: "Krankheit", order: "Diebstahl" } satisfies Record<RiskId, string>

/** Why a need is unmet, and what to do about it: the cause in a line, the cure with its buildings as chips. */
const cause: Wording<Cause, Told> = {
  noWalker: (c) =>
    c.service === "market"
      ? {
          why: `kein Läufer ${the(kindNoun("market"), "gen")} erreicht diese Straße`,
          fix: `baue ${aKind("market", "acc")}; ${its(kindNoun("market"), walker)} geht ${c.range} Straßenfelder weit, der ${ofKind("townhall")} ${c.hallRange}`
        }
      : { why: `kein Läufer ${the(kindNoun("chapel"), "gen")} erreicht diese Straße`, fix: `baue ${aKind("chapel", "acc")}; ${its(kindNoun("chapel"), walker)} geht ${c.range} Straßenfelder weit` },
  tooPoor: (c) => ({
    why: `${notBrought(c.need)}: nur an Straßen ab ${c.needed}, und diese hat ${signed(c.desirability)}`,
    fix: "hebe die Straße (siehe Straße)"
  }),
  noneInTown: (c) => noneInTown[c.need],
  notLately: (c) => ({ why: notLately[c.need] }),
  // "fire, health not kept down": the risks are listed after, as nouns, so nothing has to agree with each.
  unkept: (c) => ({
    why: `nicht im Griff: ${c.high.map((r) => risks[r]).join(", ")}`,
    fix: `${aKind("firewatch")}, ${aKind("healer")} und ${aKind("watchhouse")} müssen alle hier vorbeikommen`
  })
}

// ── Why a building is not working ─────────────────────────────────────────

/** What a gatherer finds none of: its label and its reason say the same. */
const sources = {
  stone: no(goods.stone, "nom", goods.stone.many),
  ore: no(goods.ore, "nom", goods.ore.many),
  field: "keine reifen Äcker"
} as const

/** Why a building is not working: in a word or two, why in a line, and what to do (its buildings and goods as chips). */
const problem: Wording<Problem, ToldProblem> = {
  unconnected: () => ({ label: "keine Straße", why: "braucht eine Straße an der Mitte einer Seite", fix: "lege eine Straße an eine Seite" }),
  noWorkersNear: (p) => ({
    label: "keine Arbeiter",
    why: `keine ${p.crew === "citizens" ? `${tiers[2].home.other} (oder ${tiers[1].home.other})` : tiers[1].home.other} ${within(COMMUTE)}`,
    fix: "lege Häuser näher an, oder eine Straße zu Häusern in der Nähe"
  }),
  workersTaken: () => ({ label: "keine Arbeiter", why: "alle in der Nähe haben schon Arbeit", fix: `lege mehr Häuser ${within(COMMUTE)} an` }),
  full: () => ({ label: "voll", why: "kein Platz für die Erzeugnisse", fix: `baue ${aKind("warehouse", "acc")} in der Nähe, oder verkaufe den Überschuss im Fenster ${town}` }),
  paused: () => ({ label: "pausiert", why: "keine Arbeiter, ein Viertel des Unterhalts", fix: "setze die Arbeit unten fort" }),
  fishedOut: (p) => ({
    label: no(goods.fish, "nom", goods.fish.many),
    why: `das Wasser in Reichweite ist leergefischt; jedes Stück ruht ${p.seconds} s nach einem Fang`,
    fix: `gib ${pronoun(kindNoun("fishery"), "dat")} ein längeres eigenes Ufer, oder baue weniger ${kinds("fishery")} an diesem Wasser`
  }),
  noWater: (p) => ({ label: "kein Wasser", why: `kein Wasser ${within(p.radius, cells)}`, fix: "baue am Ufer neu" }),
  workedOut: (p) => ({
    label: "erschöpft",
    why: `die abgebauten Wände in Reichweite geben nur ab und zu noch ${ware(p.source, "acc")} her`,
    fix: `baue an frischem Fels neu, oder kaufe ${good(p.source, "acc")} im Fenster ${town}`
  }),
  growing: (p) => ({ label: "wartet", why: p.source === "tree" ? "die Bäume in Reichweite wachsen noch" : "die Äcker in Reichweite reifen noch" }),
  noTrees: (p) => ({
    label: "keine Bäume",
    why: `keine ausgewachsenen Bäume ${within(p.radius, cells)}`,
    fix: `baue ${aKind("forester", "acc")} in der Nähe; ${pronoun(kindNoun("forester"))} forstet auf`
  }),
  noSource: (p) => ({ label: sources[p.source], why: `${sources[p.source]} ${within(p.radius, cells)}`, fix: "baue näher daran neu" }),
  noInput: (p) => ({
    label: no(goods[p.good], "nom", goods[p.good].many),
    why: `wartet auf ${ware(p.good, "acc")}`,
    fix: p.maker ? `baue ${aKind(p.maker, "acc")}, oder kaufe ${good(p.good, "acc")} im Fenster ${town}` : `kaufe ${good(p.good, "acc")} im Fenster ${town}`
  }),
  nothingToHandOut: () => ({
    label: "nichts zu verteilen",
    why: `weder ${ware("fish")} noch ${ware("bread")} noch ${ware("cloth")} hier`,
    fix: "fülle das Lager auf, der Nachschub kommt von dort"
  }),
  noPlanks: () => ({ label: no(goods.planks, "nom", goods.planks.many), why: "nichts zum Ausbessern", fix: `baue ${aKind("sawmill", "acc")}` }),
  waiting: () => ({ label: "wartet", why: "wartet" }),
  onFire: () => ({ label: "brennt!", why: "die Belegschaft ist geflohen", fix: `die Feuerwehrleute ${aKind("firewatch", "gen")} löschen Brände` })
}

// ── Upgrades ──────────────────────────────────────────────────────────────

/** What an upgrade changes, a row each: what, from what to what, and (after a comma, in a line) what qualifies it. */
const change: Wording<Change, Gain> = {
  output: (c) => ({ label: goods[c.good].name, value: `${c.from} → ${c.to} pro Minute (ein Arbeitsgang alle ${seconds(c.secondsFrom)} → ${seconds(c.secondsTo)})` }),
  workers: (c) => ({ label: "Arbeiter", value: `${c.from} → ${c.to}` }),
  holds: (c) => ({ label: "fasst", value: `${c.from} → ${c.to} je Ware` }),
  carriers: (c) => ({ label: "Träger", value: `${c.from} → ${c.to}` }),
  firefighters: (c) => ({ label: firefighter.other, value: `${c.from} → ${c.to}` }),
  reach: (c) => ({ label: "Läufer reicht", value: `${c.from} → ${c.to} Straßenfelder` }),
  calls: (c) => ({ label: "ein Läufer alle", value: `${seconds(c.from)} → ${seconds(c.to)}` }),
  deep: () => ({ label: "bricht abgebauten Fels in vollem Tempo, nicht zu einem Drittel" }),
  admin: (c) => ({ label: "Verwaltung", value: `${percent(c.from)} → ${percent(c.to)} weniger` }),
  appeal: (c) => ({
    label: "Wohnwert ringsum",
    value: `${c.from === null ? "0" : signed(c.from)} → ${signed(c.to)}`,
    ...(c.reach === null ? {} : { note: `bis ${count(c.reach, cells)} weit` })
  }),
  upkeep: (c) => ({ label: "Unterhalt", value: `${c.from} → ${token.rate(c.to)}` })
}

/** Why the town needs an upgrade now. In an alert its buildings and goods are chips; in a panel it is said in words. */
const wanted = {
  nextRank: "der nächste Rang verlangt es",
  shelvesFull: "die Regale sind voll",
  rockWorked: "der Fels ist abgebaut",
  millsWait: `${theKinds("mill")} warten auf ${good("wheat", "acc")}`,
  breadShort: `Häuser bleiben ohne ${good("bread", "acc")}, obwohl der Betrieb auf Hochtouren läuft`,
  unreached: "Häuser liegen jenseits aller Läufer mit Nahrung",
  beyondPriest: "Häuser liegen außer Reichweite des Priesters",
  fireRisk: "die Häuser ringsum sind stark brandgefährdet"
} satisfies Record<WantedReason, string>

const upgrade = {
  change,
  /** A change in one line: "Wohnwert ringsum +4 → +6, bis 6 Felder weit". */
  line: (g: Gain): string => `${[g.label, ...(g.value === undefined ? [] : [g.value])].join(" ")}${g.note === undefined ? "" : `, ${g.note}`}`,
  /** What starting an upgrade costs: coins now, and the materials carriers then bring. */
  price: (c: Kind["cost"]): string => {
    const carried = cost({ coins: 0, materials: c.materials })
    return `${token.coins(c.coins)} sofort${carried ? ` · Träger bringen ${carried}` : ""}`
  },
  /** The treasury lacks this much of what it costs to begin. */
  short: (coins: number): string => `${token.coins(coins)} ${coins === 1 ? "fehlt" : "fehlen"}`,
  wanted,
  /** The first upgrade the town needs, in the ticker: why, what becomes what, and how to begin. */
  hint: (h: { readonly reason: WantedReason; readonly kind: KindId; readonly level: number }): string =>
    `${wanted[h.reason]}: ${capital(theKind(h.kind, "nom", h.level))} kann ${a(kindNoun(h.kind, h.level + 1))} werden. ${token.device("Tippe", "Klicke")} darauf (unter dem goldenen Pfeil), um zu beginnen`,
  /** The upgrade tool's tooltip. */
  path: (kind: KindId, level: number): string => `${kindName(kind, level)} → ${kindName(kind, level + 1)}`,
  underWay: "im Gange: Träger bringen die Baustoffe",
  begin: "klicke, um zu beginnen: Der Betrieb läuft so lange weiter",
  pick: (kind: KindId): string => `Ausbau: wähle ${a(kindNoun(kind), "acc")} · Esc zum Beenden`,
  /** The gestures' answers. */
  pickOne: "Wähle ein Gebäude zum Ausbauen",
  already: (kind: KindId): string => `${capital(the(kindNoun(kind)))} wird schon ausgebaut`,
  /** An upgrade under way, in the building's panel. */
  becoming: (kind: KindId, level: number): string => `wird ${a(kindNoun(kind, level))}`,
  built: "gebaut",
  stillBring: (left: string): string => `Träger bringen noch ${left}; der Betrieb läuft weiter`,
  allIn: "alle Baustoffe sind da; die Bauleute verbauen sie, und der Betrieb läuft weiter"
}

// ── Placing ───────────────────────────────────────────────────────────────

const gathered = { tree: "keine Bäume", stone: "keine hellen Steinfelsen", ore: "keine dunklen Erzfelsen", water: "kein Wasser" } as const

const place = {
  /** What is wrong with a building where it would stand. */
  problem: {
    noRoad: () => "braucht eine Straße an der Mitte einer Seite",
    nothingNear: (p) => `${gathered[p.source]} ${within(p.radius, cells)}`
  } satisfies Wording<PlaceProblem>,
  /** A building refused where it was put down: "Fischerei: braucht eine Straße an der Mitte einer Seite". */
  refused: (kind: KindId, why: string): string => `${kindName(kind)}: ${why}`
}

// ── Map views ─────────────────────────────────────────────────────────────

/** Each map view's legend: its heading, what each colour means, and how the reading works. A colour's meaning is a predicate, which agrees with nothing. */
const legend = {
  appeal: {
    title: "Wohnwert",
    keys: {
      townhouses: `${home.tiers[3].appeal}+: ${tiers[3].home.other}`,
      citizens: `${home.tiers[2].appeal}+: ${tiers[2].people.other}`,
      settlers: `0 bis 4: nur ${tiers[1].people.other}`,
      fewer: "unter 0: weniger Leute, weniger Steuern",
      squalid: `${signed(home.squalid)} oder weniger: elend`
    },
    note: `Jeder Punkt zählt: ${capital(a(tiers[1].home))} beherbergt für jeden Punkt unter 0 weniger Leute und zahlt weniger, darüber zahlt ${pronoun(tiers[1].home)} mehr. Gewerbe hält Häuser fern; Parks (je mehr sie enthalten, desto weiter reichen sie), ${a(kindNoun("chapel"))}, ${a(kindNoun("market"))} und gepflasterte Straßen ziehen sie an.`
  },
  workers: {
    title: "Arbeiter",
    keys: { staffed: "voll besetzt", short: "zu wenige Arbeiter", none: "keine Arbeiter", settlers: tiers[1].home.other, citizens: tiers[2].home.other },
    note: `Einwohner gehen höchstens ${COMMUTE} Straßenfelder weit zur Arbeit. Wähle eine Arbeitsstätte, um ihre Reichweite und die Häuser darin zu sehen.`
  },
  fire: {
    title: "Feuer",
    keys: { good: "bewacht", fair: "steigend", bad: "gefährdet oder brennend" },
    note: `Auch Gebäude nehmen die Farbe an. ${capital(firewatchman)} setzt die Gefahr jedes Hauses und jeder Werkstatt an seinem Weg zurück; Zinnoberrot heißt: über die Hälfte, es bleibt also noch Zeit. Holzhütten, Öfen, Essen und Gedränge erhöhen sie.`
  },
  health: {
    title: "Gesundheit",
    keys: { good: "besucht", fair: "steigend", bad: "gefährdet oder krank" },
    note: `${capital(physician)} setzt die Gefahr zurück und heilt die Kranken. Hunger, Gedränge, Elend, Steinstaub und stehendes Wasser erhöhen sie.`
  },
  order: {
    title: "Ordnung",
    keys: { good: "in Ordnung", fair: "steigend", bad: "Diebe unterwegs" },
    note: `${capital(bailiff)} hält Ordnung. Geringe Zustimmung, Elend und Häuser, die nicht voll sind, erhöhen die Gefahr; erst kommt Diebstahl, dann verfällt das Haus.`
  },
  condition: {
    title: "Zustand",
    keys: { good: "gepflegt", fair: "braucht Ausbesserung", bad: "verfallen: halbes Tempo" },
    note: `${capital(a(builder))} bessert mit ${ware("planks", "dat")} und ${ware("stone", "dat")} aus, woran ${its(builder, mason)} vorbeikommt. Bei null stürzt das Gebäude ein.`
  }
} satisfies { readonly [V in keyof LegendKeys]: { readonly title: string; readonly keys: Readonly<Record<LegendKeys[V], string>>; readonly note: string } }

// ── Parks and ruins ───────────────────────────────────────────────────────

/** What a park does for the streets around it. */
const parkWorth = (value: number, reach: number): string => `Wohnwert ${signed(value)} bis ${count(reach, cells)} weit`
/** What became of a ruin, in a word: a participle, which agrees with nothing. */
const ruinCause = { burnt: "abgebrannt", collapsed: "eingestürzt", derelict: "verfallen" }

// ── The catalog's part ────────────────────────────────────────────────────

export const view = {
  /** What a building is doing, in a word or two. */
  status: {
    building: "im Bau", idle: "untätig", working: "in Betrieb", starved: "ohne Nachschub", blocked: "blockiert", unstaffed: "ohne Arbeiter", unconnected: "ohne Straße", paused: "pausiert"
  } satisfies Record<Status, string>,
  street,
  cause,
  /** A cause in one line: "why: what to do". */
  causeLine: (told: Told): string => (told.fix === undefined ? told.why : `${told.why}: ${told.fix}`),
  problem,
  /** A problem in one line, for the panel's header and the tooltip: "keine Straße: braucht eine Straße an der Mitte einer Seite". */
  problemLine: (told: ToldProblem): string => `${told.label}: ${told.why}`,
  upgrade,
  place,
  legend,
  /** How a risk reads: "ok", "40 %", or "hoch, 85 %". */
  risk: { ok: "ok", some: (share: number): string => percent(share), high: (share: number): string => `hoch, ${percent(share)}` },
  /** What pulling something down (or cancelling a site) costs and gives back: "abreißen: −25 Taler · 2 Bretter, 3 Steine zurück". */
  salvage: (s: { readonly cancelled: boolean; readonly salvage: Salvage }): string => {
    const said = salvage(s.salvage)
    return `${s.cancelled ? "abbrechen" : "abreißen"}${said ? `: ${said}` : ""}`
  },

  /** What moves the town's approval, a row each. */
  mood: {
    base: "Grundstimmung im Ort",
    needs: "erfüllte Bedürfnisse",
    taxes: "Steuern jetzt",
    grudge: "Groll über frühere Steuern",
    debt: "unbezahlte Löhne",
    crown: "Unmut der Krone",
    winter: "ein Hungerwinter"
  },

  /** What the next rank asks: each goal, and how the town stands against it. */
  goal: {
    text: {
      residents: (target) => `${target} Einwohner`,
      citizens: (target) => `${percent(target)} davon ${tiers[2].people.other}`,
      burghers: (target) => `${percent(target)} davon ${tiers[3].people.other}`,
      approval: (target) => `Zustimmung ${target} oder mehr`,
      income: (target) => `${target} Taler pro Minute, schuldenfrei`,
      hall: (target) => a(kindNoun("townhall", target))
    } satisfies Record<GoalId, (target: number) => string>,
    value: {
      residents: (value) => `${value}`,
      citizens: (value) => percent(value),
      burghers: (value) => percent(value),
      approval: (value) => `${value}`,
      income: (value) => `${value}`,
      hall: (value, target) => (value >= target ? "gebaut" : "noch nicht")
    } satisfies Record<GoalId, (value: number, target: number) => string>
  },

  /** What needs looking at now, in the ticker: buildings, goods, and tools as chips; amounts in words. */
  alerts: {
    fire: (burning: number, watched: boolean): string =>
      `${burning} in Flammen: ${
        watched
          ? `die Feuerwehrleute ${ofKind("firewatch")} sind unterwegs`
          : `baue ${aKind("firewatch", "acc")} in der Nähe; ${its(firewatch, firefighter, "nom", true)} löschen Brände`
      }`,
    sick: (sick: number, healed: boolean): string =>
      `${count(sick, homes)} krank, mit halb so vielen Bewohnern: ${healed ? `${aKind("healer")} in Reichweite der Straße heilt die Kranken` : `baue ${aKind("healer", "acc")} zwischen den Häusern`}`,
    /** Workshops idle for want of their input, by kind: "untätig: die Mühle braucht Weizen ×2. …". */
    idle: (waiting: ReadonlyArray<{ readonly kind: KindId; readonly good: GoodId; readonly n: number }>): string =>
      `untätig: ${waiting.map((w) => `${theKind(w.kind)} braucht ${good(w.good, "acc")}${w.n > 1 ? ` ×${w.n}` : ""}`).join(", ")}. Stelle mehr davon her, oder kaufe im Fenster ${town} zu`,
    /** Workplaces no home can reach, by kind. */
    remote: (remote: ReadonlyArray<{ readonly kind: KindId; readonly n: number }>): string =>
      `keine Arbeiter für ${remote.map((w) => `${theKind(w.kind, "acc")}${w.n > 1 ? ` ×${w.n}` : ""}`).join(", ")}: lege ${token.command("homes")} ${within(COMMUTE)} an, oder eine Straße zu Häusern in der Nähe`,
    hungry: `keine Nahrung im Lager, also hungern die Häuser und zahlen keine Steuern: baue noch ${aKind("fishery", "acc")}, oder kaufe ${good("fish", "acc")} im Fenster ${town}`
  },

  /** A building's panel. */
  building: {
    beingBuilt: "im Bau",
    waitingFor: "wartet auf",
    carriersBring: `Träger holen sie aus dem Lager: Kaufe, was dem Ort fehlt, ${townPanel}`,
    builders: "Bauleute",
    atWork: "bei der Arbeit",
    workers: "Arbeiter",
    staffed: (assigned: number, needed: number): string => `${assigned} von ${needed}`,
    nobodyNear: (crew: Crew): string => `keine ${tiers[crew === "citizens" ? 2 : 1].people.other} wohnen ${within(COMMUTE)}: lege Häuser näher an`,
    allTaken: `alle in der Nähe haben Arbeit: lege mehr Häuser ${within(COMMUTE)} an`,
    apprentices: `${tiers[1].people.other} vertreten die ${tiers[2].people.other}, im Dreivierteltempo`,
    makes: "stellt her",
    /** What it makes: from what, into what (each with its icon), or what alone. */
    recipe: (input: GoodId | null, output: GoodId): string => (input ? `${token.good(input)} → ${token.good(output)}` : goods[output].name),
    walkersOut: "Läufer unterwegs",
    handedOut: "verteilt, letzte Minute",
    handedTo: (count_: number): string => `an ${count(count_, homes, "acc")} auf den Runden`,
    nothing: "nichts",
    nobodyNeeded: "kein Haus auf den Runden brauchte, was der Läufer dabeihatte",
    shelf: "jetzt im Regal",
    holds: "fasst",
    tools: goods.tools.name,
    none: none(goods.tools, goods.tools.many),
    noTools: `halbes Tempo, bis Nachschub kommt: ${a(kindNoun("smithy"))} stellt ${pronoun(goods.tools, "acc", goods.tools.many)} her, oder kaufe ${pronoun(goods.tools, "acc", goods.tools.many)} ${townPanel}`,
    upkeep: "Unterhalt",
    upkeepValue: (coins: number): string => token.rate(coins),
    condition: "Zustand",
    runDown: `halbes Tempo und Einsturzgefahr: ${a(builder)} bessert aus`,
    wearing: mended,
    fireRisk: "Brandgefahr",
    fireCure: `${firewatchman} senkt sie im Vorbeigehen`,
    appeal: "Wohnwert ringsum",
    work: "bei der Arbeit",
    running: "Betrieb",
    /** Behind the ⓘ of "Betrieb": a sentence for each thing that costs or risks something. */
    help: {
      upkeep: "Unterhalt wird jede Minute gezahlt, solange das Gebäude steht, ein Viertel davon während einer Pause.",
      condition: `Alles nutzt sich ab; ${a(builder)} bessert aus.`,
      hot: "Ein Ofen oder eine Esse: Brandgefahr für das Gebäude selbst und für Häuser im Umkreis von 2 Feldern.",
      appeal: (reach: number, worse: boolean): string =>
        `Das Gebäude verändert, wie schön die Straßen bis ${count(reach, cells)} weit sind${worse ? ": Häuser in der Nähe beherbergen weniger Leute und zahlen weniger" : ""}.`
    }
  },

  /** A home's panel: a home is a "Siedlerhütte" or a "…haus", so what is said of it agrees with neither, or with a predicate. */
  house: {
    household: "Haushalt",
    beingBuilt: "im Bau",
    builders: "Bauleute",
    waitingPlank: `wartet auf ${a(goods.planks, "acc")}`,
    closed: "geschlossen",
    empty: "leer",
    closedNote: `keine Steuern und keine Kosten für ${the(hall, "acc")}: wieder öffnen, und ${tiers[1].people.other} ziehen zurück`,
    /** Why it holds fewer than it could. */
    fewer: {
      sick: "halb so viele während der Krankheit",
      disapproval: "weniger, solange der Ort mit dem Bürgermeister unzufrieden ist",
      street: (advice: string): string => `weniger an einer armen Straße: ${advice}`,
      taxed: (rate: number): string => `weniger bei Steuern von ${percent(rate)}: Manche ziehen weg`,
      needs: "weniger, bis jedes Bedürfnis erfüllt ist"
    },
    onFire: "brennt",
    fled: "alle sind geflohen",
    sick: "krank",
    halved: "halb so viele",
    sickNote: `vergeht in einer Minute, oder wenn ${physician} kommt`,
    residents: "Bewohner",
    living: (count_: number, room: number): string => `${count_} von ${room}`,
    pays: "zahlt",
    paying: (coins: number): string => token.rate(coins),
    hungry: "hungrig",
    hungryNote: "hungrig: keine Nahrung, keine Steuern",
    could: (coins: number): string => `${token.rate(coins)} mit allen Bedürfnissen erfüllt`,
    worksAt: "arbeitet bei",
    workplace: (kind: KindId): string => kindName(kind),
    nothingNearby: "nichts in der Nähe",
    needs: "Bedürfnisse",
    met: "✓",
    missing: "fehlt",
    /** What a need is wanted for: the tier it would raise the home to. */
    forTier: (tier: Tier): string => `für ${tiers[tier].people.other}`,
    street: "Straße",
    streetOf: (desirability: number, needed: number): string => `${signed(desirability)} von ${needed}`,
    desirability: (d: number): string => signed(d),
    services: "Dienste",
    rebuilding: "Umbau",
    rebuilt: "fertig ✓",
    shortOf: (short: Kind["cost"]): string =>
      `dem Ort fehlen ${[...(short.coins > 0 ? [token.coins(short.coins)] : []), ...(Object.entries(short.materials) as Array<[GoodId, number]>).map(([g, count_]) => token.amount(g, count_))].join(", ")}`,
    waitsForStore: `bleibt auf der jetzigen Stufe, bis das Lager genug hat: selbst herstellen, oder im Fenster ${town} kaufen`,
    rebuiltAlready: "schon umgebaut: steigt kostenlos wieder auf",
    readyFor: (tier: Tier): string => `bereit für ${tiers[tier].people.other}`,
    readyNote: "wächst, sobald der nächste Bewohner einzieht, und zahlt dann den Umbau",
    safety: "Gefahren und Verschleiß",
    risks: "Gefahren",
    allLow: "alle gering",
    riskOf: { fire: "Brandgefahr", health: "Krankheitsgefahr", order: "Diebstahlgefahr" } satisfies Record<RiskId, string>,
    cure: { fire: `${firewatchman} senkt sie`, health: `${physician} senkt sie`, order: `${bailiff} senkt sie` } satisfies Record<RiskId, string>,
    robbed: "bestohlen",
    times: (count_: number): string => `${count_}×`,
    condition: "Zustand",
    runDown: `zieht die Straße herab und kann einstürzen: ${a(builder)} bessert aus`,
    wearing: mended,
    /** Behind the ⓘ of "Bedürfnisse", by the home's tier: what red and amber mean, and what the next tier asks. */
    needsHelp: {
      1: `Rot: jetzt nötig. Gelb: nötig, um ${a(tiers[2].home)} zu werden, ${theArticle(tiers[2].home)} doppelt so viel fasst und zahlt. Schon Brot allein lässt ${a(tiers[1].home, "acc")} die Hälfte mehr zahlen. Läufer bringen die Bedürfnisse über die Straße; die Straße ist, wie schön die Lage ist (Wohnwert ${home.tiers[2].appeal} für ${tiers[2].people.other}).`,
      2: `Rot: jetzt nötig, sonst ziehen wieder ${tiers[1].people.other} ein. Gelb: nötig, um ${a(tiers[3].home)} zu werden, an einer Straße mit Wohnwert ${home.tiers[3].appeal}, an der ${a(firewatch)}, ${a(healer)} und ${a(watchhouse)} alle vorbeikommen.`,
      3: `Rot: jetzt nötig, sonst ziehen wieder ${tiers[2].people.other} ein.`
    } satisfies Record<Tier, string>,
    safetyHelp: "In jedem Haus steigt die Gefahr von Brand, Krankheit und Diebstahl langsam; ein Läufer des passenden Dienstes senkt sie im Vorbeigehen.",
    /** How it is, in a word or two for the header. */
    summary: (count_: number): string => count(count_, residents)
  },

  /** A park's panel. */
  park: {
    worth: parkWorth,
    /** What a park's beauty is made of. */
    part: {
      ground: (l) => (l.capped ? "Boden (mehr zählt nicht)" : "Boden"),
      ways: (l) => (l.count === 1 ? "Zugang von der Straße" : "Zugänge von der Straße"),
      prop: (l) => props[l.prop].noun.one
    } satisfies Wording<ParkLabel>,
    size: "Größe",
    sizeOf: (count_: number, beauty: number): string => `${count(count_, cells)} · Schönheit ${decimal(beauty)}`,
    madeOf: "besteht aus",
    /** Its parts with what each is worth, already worded: "Boden 2, Laterne 1,5". */
    parts: (parts: ReadonlyArray<{ readonly label: string; readonly value: number }>): string => parts.map((p) => `${p.label} ${decimal(p.value)}`).join(", ") || "noch nichts",
    streets: "die Straßen ringsum",
    ways: "Zugänge von der Straße",
    waysIn: (count_: number): string => `${count_}${count_ > 2 ? " (2 zählen)" : ""}`,
    none: "keine",
    noWays: `lege ${a(grounds.path.noun, "acc")} oder ${a(grounds.square.noun, "acc")} bis an eine Straße: je +1,5, zwei zählen`,
    furnishings: "Ausstattung, die zählt",
    furnished: (placed: number, room: number): string => `${placed} von ${room}`,
    crowded: (count_: number): string => `${count_} zu viel: Ein Stück zählt je 2 Parkfelder, also lege mehr Boden an`,
    nicerWith: "schöner mit",
    missing: (ids: ReadonlyArray<PropId>): string => ids.map((id) => props[id].noun.one).join(", "),
    upkeep: "Unterhalt",
    upkeepValue: (coins: number): string => token.rate(coins)
  },

  /** A ruin's panel. */
  ruin: {
    cause: ruinCause,
    happened: "was geschah",
    what: { burnt: "abgebrannt", collapsed: "eingestürzt, weil niemand ausbesserte", derelict: "nach den Diebstählen verfallen" },
    appeal: "Wohnwert ringsum",
    untilCleared: "bis sie geräumt ist: reiß sie ab"
  },

  /** What the pointer is over, in a line; and what a tool would lay there, and for how much. Amounts as icons. */
  tooltip: {
    /** A building: what it is doing, or what keeps it from it; and what it is becoming, when works are under way. */
    building: (b: { readonly kind: KindId; readonly level: number; readonly state: string; readonly works: { readonly level: number; readonly percent: number } | null }): string =>
      `${kindName(b.kind, b.level)} · ${b.state}${b.works ? ` · wird ${a(kindNoun(b.kind, b.works.level))}, ${percent(b.works.percent)} gebaut` : ""}`,
    /** Bulldozing: what pulling it down gives back, or that it stays. */
    bulldozeBuilding: (kind: KindId, level: number, back: string): string => `${kindName(kind, level)} · ${back}`,
    hallStays: `${the(hall)} bleibt`,
    bulldozeHome: (tier: Tier, back: string): string => `${tiers[tier].home.one} · ${back}`,
    homeClosed: (tier: Tier): string => `${tiers[tier].home.one} · geschlossen`,
    home: (h: { readonly tier: Tier; readonly residents: number; readonly desirability: number; readonly burning: boolean; readonly sick: boolean }): string =>
      `${tiers[h.tier].home.one} · ${count(h.residents, residents)} · Wohnwert ${h.desirability}${h.burning ? " · brennt!" : h.sick ? " · krank" : ""}`,
    ruin: (cause: "burnt" | "collapsed" | "derelict"): string => `Ruine · ${ruinCause[cause]} · abreißen zum Räumen`,
    park: (what: { readonly prop: PropId } | { readonly ground: GroundId }, whole: { readonly cells: number; readonly value: number; readonly reach: number } | null): string =>
      `Park · ${"prop" in what ? props[what.prop].noun.one : grounds[what.ground].noun.one}${whole ? ` · ${count(whole.cells, cells)} · ${parkWorth(whole.value, whole.reach)}` : ""}`,
    /** Placing a building: what keeps it from here, or what it costs. */
    placeLocked: (kind: KindId, l: Lock): string => `${kindName(kind)} · ${say(lock, l)}`,
    placeNoRoom: (kind: KindId): string => `${kindName(kind)} · hier ist kein Platz`,
    placeProblem: (kind: KindId, why: string): string => `${kindName(kind)} · ${why}`,
    placeCost: (kind: KindId, c: Kind["cost"]): string => `${kindName(kind)} · ${cost(c)}`,
    pave: (c: { readonly coins: number; readonly stone: number }): string => `Pflaster · ${token.coins(c.coins)} und ${token.amount("stone", c.stone)} pro Feld · schnelleres Gehen`,
    desirability: (d: number): string => `Wohnwert ${d}`,
    cancel: "hier loslassen zum Abbrechen",
    /** What new homes would bring in once fed, or that they would cost more than they pay. */
    // Said after one home or many ("1 Haus", "4 Häuser"): turned so nothing has to agree in number.
    homesWorth: (coins: number): string => (coins > 0 ? ` · ${token.rate(coins, true)}, sobald versorgt` : " · Unterhalt über den Steuern: feinere Häuser zahlen besser"),
    homes: (c: Kind["cost"], worth: string | null): string => `Häuser · ${cost(c)} pro Haus${worth ?? " · an einer Straße anlegen"}`,
    road: (coins: number): string => `Straße · ${token.coins(coins)} pro Feld`,
    /** A stroke being dragged: how much it lays, and what that costs. */
    roadStroke: (count_: number, c: Kind["cost"]): string => `${count(count_, roadCells)} · ${cost(c)}`,
    homesStroke: (count_: number, c: Kind["cost"], worth: string): string => `${count(count_, homes)} · ${cost(c)}${worth}`,
    paveStroke: (count_: number, c: Kind["cost"]): string => `${count(count_, cells)} pflastern · ${cost(c)}`,
    groundStroke: (ground: GroundId, count_: number, c: Kind["cost"]): string => `${grounds[ground].noun.one} · ${count(count_, cells)} · ${cost(c)}`,
    ground: (ground: GroundId, c: Kind["cost"], park: number | null): string => `${grounds[ground].noun.one} · ${cost(c)}${park === null ? "" : ` · Park ${signed(park)} Wohnwert`}`,
    /** A furnishing about to be set: what the park would be worth with it (and is now, when that differs), and whether it is one too many. */
    prop: (prop: PropId, c: Kind["cost"], park: { readonly value: number; readonly before: number | null; readonly crowded: boolean } | null): string =>
      `${props[prop].noun.one} · ${cost(c)}${park ? ` · Park ${signed(park.value)} Wohnwert${park.before === null ? "" : ` (jetzt ${signed(park.before)})`}` : ""}${park?.crowded ? " · zu voll" : ""}`,
    propNeedsPark: (prop: PropId): string => `${props[prop].noun.one} · lege zuerst Parkboden an`,
    removeProp: (prop: PropId): string => `${the(props[prop].noun, "acc")} entfernen`,
    removeGround: (ground: GroundId): string => `${the(grounds[ground].noun, "acc")} entfernen`,
    workedFace: (ore: boolean): string => `abgebaute ${ore ? "Erzwand" : "Steinwand"} · abreißen zum Räumen`,
    rock: (ore: boolean, left: number): string => `${goods[ore ? "ore" : "stone"].name} · noch ${left}`,
    /** What a thing being placed would reach, said beside its outline. */
    walkersReach: (range: number): string => `die Läufer reichen ${range} Straßenfelder ab der Tür`,
    workersFrom: `die Arbeiter kommen aus Häusern ${within(COMMUTE)}`,
    residentsWalk: `Einwohner gehen ${within(COMMUTE)} zur Arbeit`
  }
} satisfies typeof English
