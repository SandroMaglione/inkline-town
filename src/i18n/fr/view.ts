/**
 * French for what the view reads off the town (`src/view`): the panels of
 * a building, a home, a park, and a ruin; why something is not working and
 * what to do about it; the alerts; the tooltip under the pointer; the map
 * views' legends; and what an upgrade changes. The same entries as
 * English's (`satisfies typeof English`), each with the same tokens in it.
 *
 * Two turns are French's own. A building's gender is not known where a
 * line speaks of "it" (a panel serves every kind), so a state is said with
 * a phrase that does not agree ("au travail", "au repos", "sans route",
 * "stock plein") rather than an adjective that would, and advice is turned
 * so nothing refers back to the building by a pronoun ("le travail
 * continue", "un atelier de maçon s'en charge"). And every article or
 * preposition before a building or a good goes through `grammar.ts` or
 * `chips.ts`, so it bends to the noun whatever the noun is renamed to. A
 * home is a "maison" or a "chaumière" whatever its tier, so what the home's
 * panel says of it is in the feminine.
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
import { aKind, kind, ofGood, ofKinds, someGood, theGood, theKind, theKinds, toKind } from "./chips.ts"
import { a, agree, before, capital, count, decimal, f, form, m, of, ofA, percent, signed, some, the, theArticle, theMany, to, type Noun } from "./grammar.ts"
import { built, goods, grounds, props, tiers } from "./nouns.ts"
import { cost, lock, salvage } from "./said.ts"

const homes = f("maison"), cells = f("case"), roadCells = f("case de route", "cases de route"), residents = m("habitant")
const kindNoun = (id: KindId, level = 0): Noun => built(id, level).noun
const kindName = (id: KindId, level = 0) => kindNoun(id, level).one
/** "il" or "elle", for a building. */
const it = (id: KindId) => agree(kindNoun(id), "il", "elle")
const town = token.command("town")
/** A good in plain words, in the number the town speaks of it in: with its article ("le pain", "les meubles"), some of it ("du tissu"), or after "de" ("de pierre"). */
const theWare = (id: GoodId): string => before(theArticle(goods[id], goods[id].counted), goods[id].name)
const someWare = (id: GoodId): string => some(goods[id], goods[id].counted)
const ofWare = (id: GoodId): string => of(goods[id], goods[id].counted)
/** A verb said of a good, in the good's number. */
const verb = (id: GoodId, one: string, many: string): string => (goods[id].counted ? many : one)
/** A span of seconds, to a tenth: "4,5 s". */
const seconds = (s: number) => `${decimal(Math.round(s * 10) / 10)} s`
/** "à 15 cases de route au plus": how far a walk may go. */
const within = (n: number, what: Noun = roadCells) => `à ${count(n, what)} au plus`

// Buildings named in plain words in more than one line, each with the article it takes.
const aBuilder = a(kindNoun("builder")), hall = kindNoun("townhall")
/** "d'une tour de guet", "d'un guérisseur": whose walker it is. */
const ofFirewatch = ofA(kindNoun("firewatch")), ofHealer = ofA(kindNoun("healer")), ofWatchhouse = ofA(kindNoun("watchhouse"))

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
  homes: () => "belles maisons voisines",
  water: () => "eau",
  woods: () => "bois",
  paved: () => "rue pavée",
  ruin: () => "ruine",
  worn: () => "une maison délabrée",
  park: () => "parc"
} satisfies Wording<AppealLabel>

/** What counts most against a street, in a line: "carrière −6, entrepôt −2". */
const against = (parts: ReadonlyArray<AppealPart>, most = 2): string =>
  parts.filter((p) => p.value < 0).slice(0, most).map((p) => `${say(source, p.label)} ${signed(p.value)}`).join(", ")

const street = {
  source,
  against,
  /** A street against what the next tier needs: "−4 ici, il faut 5 : carrière −6". */
  short: (s: Street, needed: number): string => {
    const why = against(s.parts)
    return `${signed(s.desirability)} ici, il faut ${needed}${why ? ` : ${why}` : ""}`
  },
  /** What would lift a street: the things a mayor can do (`dragged`: something drags it down). Buildings as chips. */
  advice: (dragged: boolean): string =>
    dragged ? `éloignez l'industrie, ou ajoutez un parc, ${aKind("chapel")} ou des pavés` : `un parc, ${aKind("chapel")} ou une rue pavée à côté`
}

// ── Why a home lacks something ────────────────────────────────────────────

const marketWalker = `le colporteur ${to("de", kindNoun("market"))}`

const notLately = {
  food: `${marketWalker} n'est pas passé récemment`,
  bread: `${marketWalker} n'est pas passé récemment avec ${someWare("bread")}`,
  cloth: `${marketWalker} n'est pas passé récemment avec ${someWare("cloth")}`,
  faith: `le prêtre ${to("de", kindNoun("chapel"))} n'est pas passé récemment`,
  furniture: `${marketWalker} n'est pas passé récemment avec ${someWare("furniture")}`
} satisfies Record<Need, string>

const noneInTown = {
  food: { why: "la ville n'a pas de nourriture en réserve", fix: `construisez ${aKind("fishery")} au bord de l'eau : c'est le plus rapide` },
  bread: {
    why: `la ville n'a pas ${ofWare("bread")}`,
    fix: `construisez ${aKind("bakery")} : ${theGood("wheat")} ${toKind("de", "farm")} ${verb("wheat", "va", "vont")} ${toKind("à", "mill")}, et ${theGood("flour")} ${toKind("à", "bakery")}`
  },
  cloth: { why: `la ville n'a pas ${ofWare("cloth")}`, fix: `construisez ${aKind("weaver")} : ${it("weaver")} tisse ${theGood("wool")} ${toKind("de", "sheep")}` },
  furniture: { why: `la ville n'a pas ${ofWare("furniture")}`, fix: `construisez ${aKind("carpenter")} : ${it("carpenter")} fait ${someGood("furniture")} avec ${someGood("planks")}` }
} satisfies Record<Exclude<Need, "faith">, Told>

const risks = { fire: "incendie", health: "santé", order: "ordre" } satisfies Record<RiskId, string>

/** Why a need is unmet, and what to do about it: the cause in a line, the cure with its buildings as chips. */
const cause: Wording<Cause, Told> = {
  noWalker: (c) =>
    c.service === "market"
      ? { why: `aucun colporteur ${to("de", kindNoun("market"))} n'atteint cette rue`, fix: `construisez ${aKind("market")} : son colporteur fait ${c.range} cases de route, celui ${toKind("de", "townhall")} ${c.hallRange}` }
      : { why: `aucun prêtre ${to("de", kindNoun("chapel"))} n'atteint cette rue`, fix: `construisez ${aKind("chapel")} : son prêtre fait ${c.range} cases de route` },
  tooPoor: (c) => ({
    why: `${theWare(c.need)} ${verb(c.need, "n'arrive", "n'arrivent")} pas ici : seulement dans une rue d'au moins ${c.needed}, et celle-ci est à ${signed(c.desirability)}`,
    fix: "améliorez la rue (voir rue)"
  }),
  noneInTown: (c) => noneInTown[c.need],
  notLately: (c) => ({ why: notLately[c.need] }),
  // "fire, health not kept down": the risks are listed after, so no participle has to agree with each.
  unkept: (c) => ({
    why: `risques mal tenus : ${c.high.map((r) => risks[r]).join(", ")}`,
    fix: `${aKind("firewatch")}, ${aKind("healer")} et ${aKind("watchhouse")} doivent tous passer ici`
  })
}

// ── Why a building is not working ─────────────────────────────────────────

/** What a gatherer finds none of: as its label says it, and as its reason does. */
const sources = {
  stone: { label: `sans ${goods.stone.name}`, none: `pas ${ofWare("stone")}` },
  ore: { label: `sans ${goods.ore.name}`, none: `pas ${ofWare("ore")}` },
  field: { label: "sans champs mûrs", none: "aucun champ mûr" }
} as const

/** Why a building is not working: in a word or two, why in a line, and what to do (its buildings and goods as chips). */
const problem: Wording<Problem, ToldProblem> = {
  unconnected: () => ({ label: "sans route", why: "il lui faut une route au milieu d'un de ses côtés", fix: "tracez une route le long d'un de ses côtés" }),
  noWorkersNear: (p) => {
    const near = p.crew === "citizens" ? tiers[2].home : tiers[1].home
    return {
      label: "sans travailleurs",
      why: `${agree(near, "aucun", "aucune")} ${near.one}${p.crew === "citizens" ? ` (ni ${tiers[1].home.one})` : ""} ${within(COMMUTE)}`,
      fix: "posez des maisons plus près, ou une route vers les maisons voisines"
    }
  },
  workersTaken: () => ({ label: "sans travailleurs", why: "tous ceux d'alentour ont déjà un emploi", fix: `posez d'autres maisons ${within(COMMUTE)}` }),
  full: () => ({ label: "stock plein", why: "nulle part où porter ce qui est produit", fix: `construisez ${aKind("warehouse")} à proximité, ou vendez le surplus dans le panneau ${town}` }),
  paused: () => ({ label: "en pause", why: "pas de travailleurs, un quart de l'entretien", fix: "reprenez le travail ci-dessous" }),
  fishedOut: (p) => ({
    label: `sans ${goods.fish.name}`,
    why: `l'eau à portée est épuisée : chaque bout se repose ${seconds(p.seconds)} après une prise`,
    fix: `une rive plus longue, sans partage, ou moins ${ofKinds("fishery")} sur cette eau`
  }),
  noWater: (p) => ({ label: "sans eau", why: `pas d'eau ${within(p.radius, cells)}`, fix: "reconstruisez au bord de l'eau" }),
  workedOut: (p) => ({
    label: "roche épuisée",
    why: `les fronts taillés à portée donnent un peu ${ofWare(p.source)} de temps en temps`,
    fix: `construisez près d'une roche intacte, ou achetez ${someGood(p.source)} dans le panneau ${town}`
  }),
  growing: (p) => ({ label: "en attente", why: `${p.source === "tree" ? "les arbres" : "les champs"} à portée poussent encore` }),
  noTrees: (p) => ({ label: "sans arbres", why: `aucun arbre adulte ${within(p.radius, cells)}`, fix: `construisez ${aKind("forester")} à proximité : ${it("forester")} replante` }),
  noSource: (p) => ({ label: sources[p.source].label, why: `${sources[p.source].none} ${within(p.radius, cells)}`, fix: "reconstruisez plus près" }),
  noInput: (p) => ({
    label: `sans ${goods[p.good].name}`,
    why: `en attente ${ofWare(p.good)}`,
    fix: p.maker ? `construisez ${aKind(p.maker)}, ou achetez ${someGood(p.good)} dans le panneau ${town}` : `achetez ${someGood(p.good)} dans le panneau ${town}`
  }),
  nothingToHandOut: () => ({ label: "rien à distribuer", why: "ni poisson, ni pain, ni tissu ici", fix: "remplissez la réserve : c'est d'elle que viennent les marchandises" }),
  noPlanks: () => ({ label: `sans ${goods.planks.name}`, why: "rien pour réparer", fix: `construisez ${aKind("sawmill")}` }),
  waiting: () => ({ label: "en attente", why: "en attente" }),
  onFire: () => ({ label: "en feu !", why: "ses ouvriers ont fui", fix: `les pompiers ${before("d'", aKind("firewatch"))} éteignent les incendies` })
}

// ── Upgrades ──────────────────────────────────────────────────────────────

/** What an upgrade changes, a row each: what, from what to what, and (after a comma, in a line) what qualifies it. */
const change: Wording<Change, Gain> = {
  output: (c) => ({ label: goods[c.good].name, value: `${c.from} → ${c.to} par minute (un travail toutes les ${seconds(c.secondsFrom)} → ${seconds(c.secondsTo)})` }),
  workers: (c) => ({ label: "travailleurs", value: `${c.from} → ${c.to}` }),
  holds: (c) => ({ label: "contient", value: `${c.from} → ${c.to} par marchandise` }),
  carriers: (c) => ({ label: "porteurs", value: `${c.from} → ${c.to}` }),
  firefighters: (c) => ({ label: "pompiers", value: `${c.from} → ${c.to}` }),
  reach: (c) => ({ label: "portée", value: `${c.from} → ${c.to} cases de route` }),
  calls: (c) => ({ label: "une tournée toutes les", value: `${seconds(c.from)} → ${seconds(c.to)}` }),
  deep: () => ({ label: "taille la roche épuisée à plein régime, et non au tiers" }),
  admin: (c) => ({ label: "administration", value: `${percent(c.from)} → ${percent(c.to)} de moins` }),
  appeal: (c) => ({
    label: "attrait alentour",
    value: `${c.from === null ? "0" : signed(c.from)} → ${signed(c.to)}`,
    ...(c.reach === null ? {} : { note: `jusqu'à ${count(c.reach, cells)}` })
  }),
  upkeep: (c) => ({ label: "entretien", value: `${c.from} → ${token.rate(c.to)}` })
}

/** Why the town needs an upgrade now. In an alert its buildings and goods are chips; in a panel it is said in words. */
const wanted = {
  nextRank: "le prochain rang l'exige",
  shelvesFull: "ses rayons sont pleins",
  rockWorked: "sa roche est épuisée",
  millsWait: `${theKinds("mill")} attendent ${someGood("wheat")}`,
  breadShort: `les maisons manquent ${ofGood("bread")} alors qu'on y travaille à plein`,
  unreached: "des maisons sont hors de portée de tout colporteur",
  beyondPriest: "des maisons sont hors de portée de son prêtre",
  fireRisk: "les maisons de ses rues courent un grand risque d'incendie"
} satisfies Record<WantedReason, string>

const upgrade = {
  change,
  /** A change in one line: "attrait alentour +4 → +6, jusqu'à 6 cases". */
  line: (g: Gain): string => `${[g.label, ...(g.value === undefined ? [] : [g.value])].join(" ")}${g.note === undefined ? "" : `, ${g.note}`}`,
  /** What starting an upgrade costs: coins now, and the materials carriers then bring. */
  price: (c: Kind["cost"]): string => {
    const carried = cost({ coins: 0, materials: c.materials })
    return `${token.coins(c.coins)} tout de suite${carried ? ` · les porteurs apportent ${carried}` : ""}`
  },
  /** The treasury lacks this much of what it costs to begin. */
  short: (n: number): string => `il manque ${token.coins(n)}`,
  wanted,
  /** The first upgrade the town needs, in the ticker: why, what becomes what, and how to begin. */
  hint: (h: { readonly reason: WantedReason; readonly kind: KindId; readonly level: number }): string =>
    `${wanted[h.reason]} : ${theKind(h.kind, h.level)} peut devenir ${a(kindNoun(h.kind, h.level + 1))}. ${token.device("Touchez", "Cliquez")} le bâtiment, sous sa flèche dorée, pour commencer`,
  /** The upgrade tool's tooltip. */
  path: (kind: KindId, level: number): string => `${kindName(kind, level)} → ${kindName(kind, level + 1)}`,
  underWay: "en cours : les porteurs apportent les matériaux",
  begin: "cliquez pour commencer : le travail continue en attendant",
  pick: (kind: KindId): string => `agrandir : choisissez ${a(kindNoun(kind))} · Échap pour arrêter`,
  /** The gestures' answers. */
  pickOne: "Choisissez un bâtiment à agrandir",
  already: (kind: KindId): string => `${capital(the(kindNoun(kind)))} est déjà en cours d'agrandissement`,
  /** An upgrade under way, in the building's panel. */
  becoming: (kind: KindId, level: number): string => `devient ${a(kindNoun(kind, level))}`,
  // "built", beside a share of the works: a noun, so it agrees with no building.
  built: "avancement",
  stillBring: (left: string): string => `les porteurs doivent encore apporter ${left} ; le travail continue en attendant`,
  allIn: "tous les matériaux sont là ; les ouvriers les mettent en œuvre, et le travail continue en attendant"
}

// ── Placing ───────────────────────────────────────────────────────────────

const gathered = { tree: "aucun arbre", stone: "aucun rocher de pierre pâle", ore: "aucun rocher sombre de minerai", water: "pas d'eau" } as const

const place = {
  /** What is wrong with a building where it would stand. */
  problem: {
    noRoad: () => "il faut une route au milieu d'un côté",
    nothingNear: (p) => `${gathered[p.source]} ${within(p.radius, cells)}`
  } satisfies Wording<PlaceProblem>,
  /** A building refused where it was put down: "Pêcherie : il faut une route au milieu d'un côté". */
  refused: (kind: KindId, why: string): string => `${capital(kindName(kind))} : ${why}`
}

// ── Map views ─────────────────────────────────────────────────────────────

/**
 * Each map view's legend: its heading, what each colour means, and how the reading works. A colour is laid over homes
 * and buildings alike, so what it means is said with a phrase ("sous surveillance", "en bon état"), not an adjective
 * that would agree with one of them.
 */
const legend = {
  appeal: {
    title: "attrait",
    keys: {
      townhouses: `${home.tiers[3].appeal}+ : ${tiers[3].home.other}`,
      citizens: `${home.tiers[2].appeal}+ : ${tiers[2].people.other}`,
      settlers: `de 0 à 4 : ${tiers[1].people.other} seulement`,
      fewer: "sous 0 : moins d'habitants, moins d'impôts",
      squalid: `${signed(home.squalid)} ou moins : insalubre`
    },
    note: `Chaque point compte : ${a(tiers[1].home)} loge moins et paie moins pour chaque point sous 0, et paie plus au-dessus. L'industrie repousse les maisons ; les parcs (plus ils sont garnis, plus ils portent loin), ${a(kindNoun("chapel"))}, ${a(kindNoun("market"))} et les rues pavées les attirent.`
  },
  workers: {
    title: "travailleurs",
    keys: { staffed: "au complet", short: "manque de bras", none: "sans travailleurs", settlers: tiers[1].home.other, citizens: tiers[2].home.other },
    note: `Les habitants marchent au plus ${COMMUTE} cases de route pour aller travailler. Choisissez un lieu de travail pour voir sa portée et les maisons qu'elle couvre.`
  },
  fire: {
    title: "incendie",
    keys: { good: "sous surveillance", fair: "en hausse", bad: "en danger, ou en feu" },
    note: `Les bâtiments prennent aussi la couleur. Le guetteur ${ofFirewatch} remet à zéro le risque de chaque maison et atelier sur son chemin ; le vermillon veut dire plus de la moitié, il reste donc du temps. ${capital(theMany(tiers[1].home))} en bois, les fours, les forges et l'entassement le font monter.`
  },
  health: {
    title: "santé",
    keys: { good: "visite récente", fair: "en hausse", bad: "en danger, ou malade" },
    note: `Le médecin ${ofHealer} remet le risque à zéro et soigne les malades. La faim, l'entassement, l'insalubrité, la poussière des carrières et l'eau stagnante le font monter.`
  },
  order: {
    title: "ordre",
    keys: { good: "en ordre", fair: "en hausse", bad: "voleurs en maraude" },
    note: `Le sergent ${ofWatchhouse} maintient l'ordre. Un faible soutien, l'insalubrité et les maisons pas pleines le font monter ; d'abord le vol, puis la maison est laissée à l'abandon.`
  },
  condition: {
    title: "état",
    keys: { good: "en bon état", fair: "à réparer", bad: "en mauvais état : mi-régime" },
    note: `${capital(aBuilder)} répare avec des planches et de la pierre ce que son maçon croise. À zéro, tout s'effondre.`
  }
} satisfies { readonly [V in keyof LegendKeys]: { readonly title: string; readonly keys: Readonly<Record<LegendKeys[V], string>>; readonly note: string } }

// ── Parks and ruins ───────────────────────────────────────────────────────

/** What a park does for the streets around it. */
const parkWorth = (value: number, reach: number): string => `attrait ${signed(value)} jusqu'à ${count(reach, cells)}`
/** What became of a ruin, in a word: of "ruine", so in the feminine. */
const ruinCause = { burnt: "brûlée", collapsed: "effondrée", derelict: "abandonnée" }
const sick = m("malade"), lodge = m("qui loge", "qui logent")

// ── The catalog's part ────────────────────────────────────────────────────

export const view = {
  /** What a building is doing, in a word: phrases that agree with no building, whatever its gender. */
  status: {
    building: "en chantier", idle: "au repos", working: "au travail", starved: "en manque", blocked: "sans débouché", unstaffed: "sans travailleurs", unconnected: "sans route", paused: "en pause"
  } satisfies Record<Status, string>,
  street,
  cause,
  /** A cause in one line: "why : what to do". */
  causeLine: (told: Told): string => (told.fix === undefined ? told.why : `${told.why} : ${told.fix}`),
  problem,
  /** A problem in one line, for the panel's header and the tooltip: "sans route : il lui faut une route au milieu d'un de ses côtés". */
  problemLine: (told: ToldProblem): string => `${told.label} : ${told.why}`,
  upgrade,
  place,
  legend,
  /** How a risk reads: "bas", "40 %", or "élevé, 85 %". */
  risk: { ok: "bas", some: (n: number): string => percent(n), high: (n: number): string => `élevé, ${percent(n)}` },
  /** What pulling something down (or cancelling a site) costs and gives back: "démolir : −25 pièces · en retour 2 planches, 3 blocs de pierre". */
  salvage: (s: { readonly cancelled: boolean; readonly salvage: Salvage }): string => {
    const said = salvage(s.salvage)
    return `${s.cancelled ? "annuler" : "démolir"}${said ? ` : ${said}` : ""}`
  },

  /** What moves the town's approval, a row each. */
  mood: {
    base: "humeur de la ville",
    needs: "besoins satisfaits",
    taxes: "impôts actuels",
    grudge: "rancune pour les impôts passés",
    debt: "salaires impayés",
    crown: "mécontentement de la couronne",
    winter: "un hiver de disette"
  },

  /** What the next rank asks: each goal, and how the town stands against it. */
  goal: {
    text: {
      residents: (target) => `${target} habitants`,
      citizens: (target) => `${percent(target)} de ${tiers[2].people.other}`,
      burghers: (target) => `${percent(target)} de ${tiers[3].people.other}`,
      approval: (target) => `soutien d'au moins ${target}`,
      income: (target) => `${target} pièces par minute, sans dette`,
      hall: (target) => a(kindNoun("townhall", target))
    } satisfies Record<GoalId, (target: number) => string>,
    value: {
      residents: (value) => `${value}`,
      citizens: (value) => percent(value),
      burghers: (value) => percent(value),
      approval: (value) => `${value}`,
      income: (value) => `${value}`,
      hall: (value, target) => (value >= target ? "oui" : "pas encore")
    } satisfies Record<GoalId, (value: number, target: number) => string>
  },

  /** What needs looking at now, in the ticker: buildings, goods, and tools as chips; amounts in words. */
  alerts: {
    fire: (burning: number, watched: boolean): string =>
      `${burning} en feu : ${watched ? `les pompiers ${toKind("de", "firewatch")} arrivent` : `construisez ${aKind("firewatch")} à proximité : ses pompiers éteignent les incendies`}`,
    sick: (n: number, healed: boolean): string =>
      `${count(n, homes)} ${form(n, sick)}, ${form(n, lodge)} moitié moins de monde : ${healed ? `${aKind("healer")} à portée soigne les malades` : `construisez ${aKind("healer")} parmi les maisons`}`,
    /** Workshops idle for want of their input, by kind: "au repos : le moulin attend du blé ×2. …". */
    idle: (waiting: ReadonlyArray<{ readonly kind: KindId; readonly good: GoodId; readonly n: number }>): string =>
      `au repos : ${waiting.map((w) => `${theKind(w.kind)} attend ${someGood(w.good)}${w.n > 1 ? ` ×${w.n}` : ""}`).join(", ")}. Produisez-en davantage, ou achetez-en dans le panneau ${town}`,
    /** Workplaces no home can reach, by kind. */
    remote: (remote: ReadonlyArray<{ readonly kind: KindId; readonly n: number }>): string =>
      `aucun travailleur pour ${remote.map((w) => `${theKind(w.kind)}${w.n > 1 ? ` ×${w.n}` : ""}`).join(", ")} : posez des ${token.command("homes")} ${within(COMMUTE)}, ou une route vers les maisons voisines`,
    hungry: `pas de nourriture en réserve, alors les maisons ont faim et ne paient pas d'impôts : construisez ${agree(kindNoun("fishery"), "un autre", "une autre")} ${kind("fishery")}, ou achetez ${someGood("fish")} dans le panneau ${town}`
  },

  /** A building's panel. */
  building: {
    beingBuilt: "en chantier",
    waitingFor: "en attente de",
    carriersBring: "les porteurs les apportent de la réserve : achetez ce qui manque dans le panneau de la ville",
    builders: "ouvriers",
    atWork: "au travail",
    workers: "travailleurs",
    staffed: (assigned: number, needed: number): string => `${assigned} sur ${needed}`,
    nobodyNear: (crew: Crew): string => {
      const people = tiers[crew === "citizens" ? 2 : 1].people
      return `${agree(people, "aucun", "aucune")} ${people.one} n'habite ${within(COMMUTE)} : posez des maisons plus près`
    },
    allTaken: `tous ceux d'alentour ont un emploi : posez d'autres maisons ${within(COMMUTE)}`,
    apprentices: "des colons remplacent les citoyens, aux trois quarts du rythme",
    makes: "produit",
    /** What it makes: from what, into what (each with its icon), or what alone. */
    recipe: (input: GoodId | null, output: GoodId): string => (input ? `${token.good(input)} → ${token.good(output)}` : goods[output].name),
    walkersOut: "en tournée",
    handedOut: "distribué, dernière minute",
    handedTo: (n: number): string => `à ${count(n, homes)} sur ses tournées`,
    nothing: "rien",
    nobodyNeeded: "aucune maison sur ses tournées n'avait besoin de ce qu'elles apportaient",
    shelf: "en rayon",
    holds: "contient",
    tools: goods.tools.name,
    none: agree(goods.tools, "aucun", "aucune"),
    noTools: `mi-régime jusqu'à ce qu'il en arrive ${agree(goods.tools, "un", "une")} : ${a(kindNoun("smithy"))} en fait, ou achetez-en dans le panneau de la ville`,
    upkeep: "entretien",
    upkeepValue: (coins: number): string => token.rate(coins),
    condition: "état",
    runDown: `mi-régime, et risque de s'effondrer : ${aBuilder} s'en charge`,
    wearing: `${aBuilder} s'en charge quand son maçon passe`,
    fireRisk: "risque d'incendie",
    fireCure: `le guetteur ${ofFirewatch} le fait baisser en passant`,
    appeal: "attrait alentour",
    work: "au travail",
    running: "fonctionnement",
    /** Behind the ⓘ of "fonctionnement": a sentence for each thing that costs or risks something. */
    help: {
      upkeep: "L'entretien se paie chaque minute tant que le bâtiment est debout, un quart en pause.",
      condition: `Tout s'use ; ${aBuilder} répare.`,
      hot: "Un four ou une forge : un risque d'incendie sur place et pour les maisons à 2 cases ou moins.",
      appeal: (reach: number, worse: boolean): string =>
        `Le bâtiment change l'agrément des rues jusqu'à ${count(reach, cells)}${worse ? " : les maisons proches logent moins de monde et paient moins" : ""}.`
    }
  },

  /** A home's panel: a home is a "maison" or a "chaumière", so what is said of it is in the feminine. */
  house: {
    household: "foyer",
    beingBuilt: "en chantier",
    builders: "ouvriers",
    waitingPlank: `en attente ${ofA(goods.planks)}`,
    closed: "fermée",
    empty: "vide",
    closedNote: `elle ne paie pas d'impôts et ne coûte rien ${to("à", hall)} : rouvrez-la et les colons reviennent`,
    /** Why it holds fewer than it could. */
    fewer: {
      sick: "moitié moins tant qu'elle est malade",
      disapproval: "moins tant que la ville désapprouve son maire",
      street: (advice: string): string => `moins dans une rue pauvre : ${advice}`,
      taxed: (rate: number): string => `moins avec des impôts à ${percent(rate)} : certains s'en vont`,
      needs: "moins tant que tous les besoins ne sont pas satisfaits"
    },
    onFire: "en feu",
    fled: "tout le monde a fui",
    sick: "malade",
    halved: "moitié moins",
    sickNote: `ça passe en une minute, ou à la visite du médecin ${ofHealer}`,
    residents: "habitants",
    living: (n: number, room: number): string => `${n} sur ${room}`,
    pays: "paie",
    paying: (coins: number): string => token.rate(coins),
    hungry: "affamée",
    hungryNote: "affamée : sans nourriture, pas d'impôts",
    could: (coins: number): string => `${token.rate(coins)} avec tous les besoins satisfaits`,
    worksAt: "lieu de travail",
    workplace: (kind: KindId): string => kindName(kind),
    nothingNearby: "rien à proximité",
    needs: "besoins",
    met: "✓",
    missing: "manque",
    /** What a need is wanted for: the tier it would raise the home to. */
    forTier: (tier: Tier): string => `pour ${theMany(tiers[tier].people)}`,
    street: "rue",
    streetOf: (desirability: number, needed: number): string => `${signed(desirability)} sur ${needed}`,
    desirability: (d: number): string => signed(d),
    services: "services",
    rebuilding: "reconstruction",
    rebuilt: "faite ✓",
    shortOf: (short: Kind["cost"]): string =>
      `il manque à la ville ${[...(short.coins > 0 ? [token.coins(short.coins)] : []), ...(Object.entries(short.materials) as Array<[GoodId, number]>).map(([g, n]) => token.amount(g, n))].join(", ")}`,
    waitsForStore: `elle reste à son niveau jusqu'à ce que la réserve l'ait : produisez-le, ou achetez-le dans le panneau ${town}`,
    rebuiltAlready: "déjà reconstruite : elle remonte gratuitement",
    readyFor: (tier: Tier): string => `prête pour ${theMany(tiers[tier].people)}`,
    readyNote: "elle grandit à l'arrivée du prochain habitant, et paie alors sa reconstruction",
    safety: "risques et usure",
    risks: "risques",
    allLow: "tous bas",
    riskOf: { fire: "risque d'incendie", health: "risque sanitaire", order: "risque de vol" } satisfies Record<RiskId, string>,
    cure: { fire: `le guetteur ${ofFirewatch} le fait baisser`, health: `le médecin ${ofHealer} le fait baisser`, order: `le sergent ${ofWatchhouse} le fait baisser` } satisfies Record<RiskId, string>,
    robbed: "cambriolée",
    times: (n: number): string => `${n}×`,
    condition: "état",
    runDown: `elle tire la rue vers le bas et risque de s'effondrer : ${aBuilder} s'en charge`,
    wearing: `${aBuilder} s'en charge quand son maçon passe`,
    /** Behind the ⓘ of "besoins", by the home's tier: what red and amber mean, and what the next tier asks. */
    needsHelp: {
      1: `Rouge : il lui faut ceci maintenant. Ambre : il lui faut ceci pour devenir ${a(tiers[2].home)}, qui loge et paie deux fois plus. ${capital(the(goods.bread))} ${agree(goods.bread, "seul", "seule")} fait déjà payer ${a(tiers[1].home)} moitié plus. Les tournées apportent les besoins le long de la route ; la rue, c'est l'agrément du lieu (attrait ${home.tiers[2].appeal} pour ${theMany(tiers[2].people)}).`,
      2: `Rouge : il lui faut ceci maintenant, sinon elle redevient ${a(tiers[1].home)}. Ambre : il lui faut ceci pour devenir ${a(tiers[3].home)}, dans une rue d'attrait ${home.tiers[3].appeal} où passent ${a(kindNoun("firewatch"))}, ${a(kindNoun("healer"))} et ${a(kindNoun("watchhouse"))}.`,
      3: `Rouge : il lui faut ceci maintenant, sinon elle redevient ${a(tiers[2].home)}.`
    } satisfies Record<Tier, string>,
    safetyHelp: "Le risque d'incendie, de maladie et de vol de chaque maison monte lentement ; la tournée du service correspondant le fait baisser en passant.",
    /** How it is, in a word or two for the header. */
    summary: (n: number): string => count(n, residents)
  },

  /** A park's panel. */
  park: {
    worth: parkWorth,
    /** What a park's beauty is made of. */
    part: {
      ground: (l) => (l.capped ? "terrain (plafonné)" : "terrain"),
      ways: (l) => (l.count === 1 ? "entrée depuis la rue" : "entrées depuis la rue"),
      prop: (l) => props[l.prop].noun.one
    } satisfies Wording<ParkLabel>,
    size: "taille",
    sizeOf: (n: number, beauty: number): string => `${count(n, cells)} · beauté ${decimal(beauty)}`,
    madeOf: "composé de",
    /** Its parts with what each is worth, already worded: "terrain 2, réverbère 1,5". */
    parts: (parts: ReadonlyArray<{ readonly label: string; readonly value: number }>): string => parts.map((p) => `${p.label} ${decimal(p.value)}`).join(", ") || "rien pour l'instant",
    streets: "les rues alentour",
    ways: "entrées depuis la rue",
    waysIn: (n: number): string => `${n}${n > 2 ? " (2 comptent)" : ""}`,
    none: "aucune",
    noWays: `posez ${a(grounds.path.noun)} ou ${a(grounds.square.noun)} jusqu'à une route : +1,5 par entrée, deux comptent`,
    furnishings: "décor qui compte",
    furnished: (placed: number, room: number): string => `${placed} sur ${room}`,
    crowded: (n: number): string => `${n} de trop : un élément compte pour 2 cases de parc, alors posez plus de terrain`,
    nicerWith: "plus beau avec",
    missing: (ids: ReadonlyArray<PropId>): string => ids.map((id) => props[id].noun.one).join(", "),
    upkeep: "entretien",
    upkeepValue: (coins: number): string => token.rate(coins)
  },

  /** A ruin's panel. */
  ruin: {
    cause: ruinCause,
    happened: "ce qui s'est passé",
    // What stood here is not known to be a home or a building: each is said as what befell it, a noun.
    what: { burnt: "un incendie", collapsed: "un effondrement, faute d'entretien", derelict: "l'abandon, après les vols" },
    appeal: "attrait alentour",
    untilCleared: "jusqu'à son déblaiement : rasez-la"
  },

  /** What the pointer is over, in a line; and what a tool would lay there, and for how much. Amounts as icons. */
  tooltip: {
    /** A building: what it is doing, or what keeps it from it; and what it is becoming, when works are under way. */
    building: (b: { readonly kind: KindId; readonly level: number; readonly state: string; readonly works: { readonly level: number; readonly percent: number } | null }): string =>
      `${kindName(b.kind, b.level)} · ${b.state}${b.works ? ` · devient ${a(kindNoun(b.kind, b.works.level))}, travaux à ${percent(b.works.percent)}` : ""}`,
    /** Bulldozing: what pulling it down gives back, or that it stays. */
    bulldozeBuilding: (kind: KindId, level: number, back: string): string => `${kindName(kind, level)} · ${back}`,
    hallStays: `${the(hall)} reste`,
    bulldozeHome: (tier: Tier, back: string): string => `${tiers[tier].home.one} · ${back}`,
    homeClosed: (tier: Tier): string => `${tiers[tier].home.one} · ${agree(tiers[tier].home, "fermé", "fermée")}`,
    home: (h: { readonly tier: Tier; readonly residents: number; readonly desirability: number; readonly burning: boolean; readonly sick: boolean }): string =>
      `${tiers[h.tier].home.one} · ${count(h.residents, residents)} · attrait ${h.desirability}${h.burning ? " · en feu !" : h.sick ? " · malade" : ""}`,
    ruin: (cause: "burnt" | "collapsed" | "derelict"): string => `ruine · ${ruinCause[cause]} · rasez pour déblayer`,
    park: (what: { readonly prop: PropId } | { readonly ground: GroundId }, whole: { readonly cells: number; readonly value: number; readonly reach: number } | null): string =>
      `parc · ${"prop" in what ? props[what.prop].noun.one : grounds[what.ground].noun.one}${whole ? ` · ${count(whole.cells, cells)} · ${parkWorth(whole.value, whole.reach)}` : ""}`,
    /** Placing a building: what keeps it from here, or what it costs. */
    placeLocked: (kind: KindId, l: Lock): string => `${kindName(kind)} · ${say(lock, l)}`,
    placeNoRoom: (kind: KindId): string => `${kindName(kind)} · pas de place ici`,
    placeProblem: (kind: KindId, why: string): string => `${kindName(kind)} · ${why}`,
    placeCost: (kind: KindId, c: Kind["cost"]): string => `${kindName(kind)} · ${cost(c)}`,
    pave: (c: { readonly coins: number; readonly stone: number }): string => `paver · ${token.coins(c.coins)} et ${token.amount("stone", c.stone)} la case · on marche plus vite`,
    desirability: (d: number): string => `attrait ${d}`,
    cancel: "relâchez ici pour annuler",
    /** What new homes would bring in once fed, or that they would cost more than they pay. */
    // Said after one home or many ("1 maison", "4 maisons"): turned so nothing has to agree in number.
    homesWorth: (coins: number): string => (coins > 0 ? ` · ${token.rate(coins, true)} une fois la nourriture arrivée` : " · l'entretien dépasse les impôts : les belles maisons paient mieux"),
    homes: (c: Kind["cost"], worth: string | null): string => `maisons · ${cost(c)} chacune${worth ?? " · posez-les le long d'une route"}`,
    road: (coins: number): string => `route · ${token.coins(coins)} la case`,
    /** A stroke being dragged: how much it lays, and what that costs. */
    roadStroke: (n: number, c: Kind["cost"]): string => `${count(n, roadCells)} · ${cost(c)}`,
    homesStroke: (n: number, c: Kind["cost"], worth: string): string => `${count(n, homes)} · ${cost(c)}${worth}`,
    paveStroke: (n: number, c: Kind["cost"]): string => `paver ${count(n, cells)} · ${cost(c)}`,
    groundStroke: (ground: GroundId, n: number, c: Kind["cost"]): string => `${grounds[ground].noun.one} · ${count(n, cells)} · ${cost(c)}`,
    ground: (ground: GroundId, c: Kind["cost"], park: number | null): string => `${grounds[ground].noun.one} · ${cost(c)}${park === null ? "" : ` · parc ${signed(park)} d'attrait`}`,
    /** A furnishing about to be set: what the park would be worth with it (and is now, when that differs), and whether it is one too many. */
    prop: (prop: PropId, c: Kind["cost"], park: { readonly value: number; readonly before: number | null; readonly crowded: boolean } | null): string =>
      `${props[prop].noun.one} · ${cost(c)}${park ? ` · parc ${signed(park.value)} d'attrait${park.before === null ? "" : ` (actuellement ${signed(park.before)})`}` : ""}${park?.crowded ? " · trop chargé" : ""}`,
    propNeedsPark: (prop: PropId): string => `${props[prop].noun.one} · posez d'abord le terrain du parc`,
    removeProp: (prop: PropId): string => `enlever ${the(props[prop].noun)}`,
    removeGround: (ground: GroundId): string => `enlever ${the(grounds[ground].noun)}`,
    workedFace: (ore: boolean): string => `front taillé ${of(goods[ore ? "ore" : "stone"])} · rasez pour le dégager`,
    rock: (ore: boolean, left: number): string => `${goods[ore ? "ore" : "stone"].name} · encore ${left}`,
    /** What a thing being placed would reach, said beside its outline. */
    walkersReach: (range: number): string => `ses tournées vont à ${range} cases de route de la porte`,
    workersFrom: `ses travailleurs viennent des maisons ${within(COMMUTE)}`,
    residentsWalk: `les habitants vont travailler ${within(COMMUTE)}`
  }
} satisfies typeof English
