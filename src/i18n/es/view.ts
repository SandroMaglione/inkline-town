/**
 * Spanish for what the view reads off the town (`src/view`): the panels of
 * a building, a home, a park, and a ruin; why something is not working and
 * what to do about it; the alerts; the tooltip under the pointer; the map
 * views' legends; and what an upgrade changes. The same entries as
 * English's (`satisfies typeof English`), each with the same tokens in it.
 *
 * Two turns are Spanish's own. A building's gender is not known where a
 * line speaks of "it" (a panel serves every kind), so a state is said with
 * a phrase that does not agree ("trabajando", "en reposo", "sin camino")
 * rather than an adjective that would, and advice is turned so nothing
 * refers back to the building by a pronoun. And every article or
 * preposition before a building or a good goes through `grammar.ts` or
 * `chips.ts`, so it agrees with the noun whatever the noun is renamed to.
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
import { aKind, anotherKind, good, kinds, theGood, theKind, theKinds, toKind } from "./chips.ts"
import { a, agree, before, capital, count, decimal, f, m, signed, the, theArticle, theMany, to, type Noun } from "./grammar.ts"
import { built, goods, grounds, props, tiers } from "./nouns.ts"
import { cost, lock, salvage } from "./said.ts"

const homes = f("casa", "casas"), cells = f("casilla", "casillas"), roadCells = f("casilla de camino", "casillas de camino"), residents = m("habitante", "habitantes")
const kindNoun = (id: KindId, level = 0): Noun => built(id, level).noun
const kindName = (id: KindId, level = 0) => kindNoun(id, level).one
const town = token.command("town")
/** A good in plain words with its article, in the number the town speaks of it in: "el pan", "las tablas", "los muebles". */
const theWare = (id: GoodId): string => before(theArticle(goods[id], goods[id].counted), goods[id].name)
/** A verb said of a good, in the good's number: "llega" or "llegan". */
const verb = (id: GoodId, one: string, many: string): string => (goods[id].counted ? many : one)
/** A span of seconds, to a tenth: "4,5 s". */
const seconds = (s: number) => `${decimal(Math.round(s * 10) / 10)} s`

// Buildings named in plain words in more than one line, each with the article it takes.
const ofBuilder = to("de", kindNoun("builder")), aBuilder = a(kindNoun("builder")), aFirewatch = a(kindNoun("firewatch")), aHealer = a(kindNoun("healer")), aWatchhouse = a(kindNoun("watchhouse"))
/** Who mends what wears down, said so that nothing refers back to the building or home by a pronoun that would agree with it. */
const mends = `${aBuilder} hace las reparaciones`
/** As far as a resident walks to work: "a no más de 15 casillas de camino". */
const commute = `a no más de ${COMMUTE} casillas de camino`

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
  homes: () => "casas bonitas al lado",
  water: () => "agua",
  woods: () => "bosque",
  paved: () => "calle empedrada",
  ruin: () => "ruina",
  worn: () => "una casa deteriorada",
  park: () => "parque"
} satisfies Wording<AppealLabel>

/** What counts most against a street, in a line: "cantera −6, almacén −2". */
const against = (parts: ReadonlyArray<AppealPart>, most = 2): string =>
  parts.filter((p) => p.value < 0).slice(0, most).map((p) => `${say(source, p.label)} ${signed(p.value)}`).join(", ")

const street = {
  source,
  against,
  /** A street against what the next tier needs: "−4 aquí, hacen falta 5: cantera −6". */
  short: (s: Street, needed: number): string => {
    const why = against(s.parts)
    return `${signed(s.desirability)} aquí, hacen falta ${needed}${why ? `: ${why}` : ""}`
  },
  /** What would lift a street: the things a mayor can do (`dragged`: something drags it down). Buildings as chips. */
  advice: (dragged: boolean): string =>
    dragged ? `aleja la industria, o añade un parque, ${aKind("chapel")} o empedrado` : `un parque, ${aKind("chapel")} o una calle empedrada al lado`
}

// ── Why a home lacks something ────────────────────────────────────────────

const marketWalker = `el repartidor ${to("de", kindNoun("market"))}`

const notLately = {
  food: `${marketWalker} no ha pasado últimamente`,
  bread: `${marketWalker} no ha pasado con ${goods.bread.name} últimamente`,
  cloth: `${marketWalker} no ha pasado con ${goods.cloth.name} últimamente`,
  faith: `el cura ${to("de", kindNoun("chapel"))} no ha pasado últimamente`,
  furniture: `${marketWalker} no ha pasado con ${goods.furniture.name} últimamente`
} satisfies Record<Need, string>

const noneInTown = {
  food: { why: "el pueblo no tiene comida en el almacén", fix: `construye ${aKind("fishery")} junto al agua: es lo más rápido` },
  bread: { why: `el pueblo no tiene ${goods.bread.name}`, fix: `construye ${aKind("bakery")}: ${theGood("wheat")} ${toKind("de", "farm")} va ${toKind("a", "mill")}, y ${theGood("flour")} ${toKind("a", "bakery")}` },
  cloth: { why: `el pueblo no tiene ${goods.cloth.name}`, fix: `construye ${aKind("weaver")}: teje ${theGood("wool")} ${toKind("de", "sheep")}` },
  furniture: { why: `el pueblo no tiene ${goods.furniture.name}`, fix: `construye ${aKind("carpenter")}: hace ${good("furniture")} con ${good("planks")}` }
} satisfies Record<Exclude<Need, "faith">, Told>

/** A good that is only brought to a finer street: the verb follows its number. */
const notBrought = {
  cloth: `${theWare("cloth")} no ${verb("cloth", "llega", "llegan")} aquí`,
  furniture: `${theWare("furniture")} no ${verb("furniture", "llega", "llegan")} aquí`
} satisfies Record<"cloth" | "furniture", string>

const risks = { fire: "incendio", health: "salud", order: "orden" } satisfies Record<RiskId, string>

/** Why a need is unmet, and what to do about it: the cause in a line, the cure with its buildings as chips. */
const cause: Wording<Cause, Told> = {
  noWalker: (c) =>
    c.service === "market"
      ? { why: `ningún repartidor ${to("de", kindNoun("market"))} llega a esta calle`, fix: `construye ${aKind("market")}: su repartidor recorre ${c.range} casillas de camino; el ${toKind("de", "townhall")}, ${c.hallRange}` }
      : { why: `ningún cura ${to("de", kindNoun("chapel"))} llega a esta calle`, fix: `construye ${aKind("chapel")}: su cura recorre ${c.range} casillas de camino` },
  tooPoor: (c) => ({
    why: `${notBrought[c.need]}: solo a una calle de ${c.needed} o más, y esta está en ${signed(c.desirability)}`,
    fix: "mejora la calle (ver calle)"
  }),
  noneInTown: (c) => noneInTown[c.need],
  notLately: (c) => ({ why: notLately[c.need] }),
  // "fire, health not kept down": the risks are listed after, so no participle has to agree with each.
  unkept: (c) => ({
    why: `riesgos sin controlar: ${c.high.map((r) => risks[r]).join(", ")}`,
    fix: `${aKind("firewatch")}, ${aKind("healer")} y ${aKind("watchhouse")} tienen que pasar por aquí`
  })
}

// ── Why a building is not working ─────────────────────────────────────────

/** What a gatherer finds none of: as its label says it, and as its reason does. */
const sources = {
  stone: { label: "sin piedra", none: "no hay piedra" },
  ore: { label: "sin mineral", none: "no hay mineral" },
  field: { label: "sin campos maduros", none: "no hay campos maduros" }
} as const

/** Why a building is not working: in a word or two, why in a line, and what to do (its buildings and goods as chips). */
const problem: Wording<Problem, ToldProblem> = {
  unconnected: () => ({ label: "sin camino", why: "necesita un camino en el centro de uno de sus lados", fix: "traza un camino a lo largo de uno de sus lados" }),
  noWorkersNear: (p) => ({
    label: "sin trabajadores",
    why: `no hay ${p.crew === "citizens" ? `${tiers[2].home.other} (ni ${tiers[1].home.other})` : tiers[1].home.other} ${commute}`,
    fix: "pon casas más cerca, o un camino hasta casas cercanas"
  }),
  workersTaken: () => ({ label: "sin trabajadores", why: "todos los de cerca ya tienen trabajo", fix: `pon más casas ${commute}` }),
  full: () => ({ label: "sin espacio", why: "no hay adónde llevar lo que produce", fix: `construye ${aKind("warehouse")} cerca, o vende lo que sobra en el panel ${town}` }),
  paused: () => ({ label: "en pausa", why: "sin trabajadores, un cuarto del mantenimiento", fix: "reanuda el trabajo aquí abajo" }),
  fishedOut: (p) => ({
    label: "sin pescado",
    why: `el agua a su alcance está agotada: cada tramo descansa ${p.seconds} s tras una captura`,
    fix: `dale una orilla propia más larga, o pon menos ${kinds("fishery")} en esta agua`
  }),
  noWater: (p) => ({ label: "sin agua", why: `no hay agua en un radio de ${p.radius} casillas`, fix: "vuelve a construir en la orilla" }),
  workedOut: (p) => ({
    label: "roca agotada",
    why: `los frentes trabajados a su alcance dan un poco de ${goods[p.source].name} de vez en cuando`,
    fix: `construye junto a roca sin explotar, o compra ${good(p.source)} en el panel ${town}`
  }),
  growing: (p) => ({ label: "esperando", why: `${p.source === "tree" ? "los árboles" : "los campos"} a su alcance aún están creciendo` }),
  noTrees: (p) => ({ label: "sin árboles", why: `no hay árboles crecidos en un radio de ${p.radius} casillas`, fix: `construye ${aKind("forester")} cerca: replanta` }),
  noSource: (p) => ({ label: sources[p.source].label, why: `${sources[p.source].none} en un radio de ${p.radius} casillas`, fix: "vuelve a construir más cerca" }),
  noInput: (p) => ({
    label: `sin ${goods[p.good].name}`,
    why: `esperando ${theWare(p.good)}`,
    fix: p.maker ? `construye ${aKind(p.maker)}, o compra ${good(p.good)} en el panel ${town}` : `compra ${good(p.good)} en el panel ${town}`
  }),
  nothingToHandOut: () => ({ label: "nada que repartir", why: "aquí no hay pescado, pan ni tela", fix: "llena el almacén: se abastece de él" }),
  noPlanks: () => ({ label: "sin tablas", why: "no hay con qué reparar", fix: `construye ${aKind("sawmill")}` }),
  waiting: () => ({ label: "esperando", why: "esperando" }),
  onFire: () => ({ label: "¡en llamas!", why: "los trabajadores han huido", fix: `los bomberos de ${aKind("firewatch")} apagan los incendios` })
}

// ── Upgrades ──────────────────────────────────────────────────────────────

/** What an upgrade changes, a row each: what, from what to what, and (after a comma, in a line) what qualifies it. */
const change: Wording<Change, Gain> = {
  output: (c) => ({ label: goods[c.good].name, value: `${c.from} → ${c.to} por minuto (un trabajo cada ${seconds(c.secondsFrom)} → ${seconds(c.secondsTo)})` }),
  workers: (c) => ({ label: "trabajadores", value: `${c.from} → ${c.to}` }),
  holds: (c) => ({ label: "guarda", value: `${c.from} → ${c.to} de cada mercancía` }),
  carriers: (c) => ({ label: "porteadores", value: `${c.from} → ${c.to}` }),
  firefighters: (c) => ({ label: "bomberos", value: `${c.from} → ${c.to}` }),
  reach: (c) => ({ label: "alcance del recorrido", value: `${c.from} → ${c.to} casillas de camino` }),
  calls: (c) => ({ label: "un recorrido cada", value: `${seconds(c.from)} → ${seconds(c.to)}` }),
  deep: () => ({ label: "corta la roca agotada a pleno ritmo, no a un tercio" }),
  admin: (c) => ({ label: "administración", value: `${c.from}% → ${c.to}% menos` }),
  appeal: (c) => ({
    label: "atractivo cercano",
    value: `${c.from === null ? "0" : signed(c.from)} → ${signed(c.to)}`,
    ...(c.reach === null ? {} : { note: `hasta ${c.reach} casillas` })
  }),
  upkeep: (c) => ({ label: "mantenimiento", value: `${c.from} → ${token.rate(c.to)}` })
}

/** Why the town needs an upgrade now. In an alert its buildings and goods are chips; in a panel it is said in words. */
const wanted = {
  nextRank: "el próximo rango lo pide",
  shelvesFull: "tiene los estantes llenos",
  rockWorked: "ha agotado su roca",
  millsWait: `${theKinds("mill")} esperan ${theGood("wheat")}`,
  breadShort: `las casas se quedan sin ${good("bread")} mientras trabaja a pleno ritmo`,
  unreached: "hay casas a las que no llega ningún repartidor de comida",
  beyondPriest: "hay casas a las que no llega su cura",
  fireRisk: "las casas de sus calles corren un alto riesgo de incendio"
} satisfies Record<WantedReason, string>

const upgrade = {
  change,
  /** A change in one line: "atractivo cercano +4 → +6, hasta 6 casillas". */
  line: (g: Gain): string => `${[g.label, ...(g.value === undefined ? [] : [g.value])].join(" ")}${g.note === undefined ? "" : `, ${g.note}`}`,
  /** What starting an upgrade costs: coins now, and the materials carriers then bring. */
  price: (c: Kind["cost"]): string => {
    const carried = cost({ coins: 0, materials: c.materials })
    return `${token.coins(c.coins)} ahora${carried ? ` · los porteadores traen ${carried}` : ""}`
  },
  /** The treasury lacks this much of what it costs to begin. */
  short: (n: number): string => `${n === 1 ? "falta" : "faltan"} ${token.coins(n)}`,
  wanted,
  /** The first upgrade the town needs, in the ticker: why, what becomes what, and how to begin. */
  hint: (h: { readonly reason: WantedReason; readonly kind: KindId; readonly level: number }): string =>
    `${wanted[h.reason]}: ${theKind(h.kind, h.level)} puede convertirse en ${a(kindNoun(h.kind, h.level + 1))}. ${token.device("Toca", "Haz clic en")} el edificio, bajo su flecha dorada, para empezar`,
  /** The upgrade tool's tooltip. */
  path: (kind: KindId, level: number): string => `${kindName(kind, level)} → ${kindName(kind, level + 1)}`,
  underWay: "en marcha: los porteadores están trayendo los materiales",
  begin: "haz clic para empezar: mientras tanto sigue trabajando",
  pick: (kind: KindId): string => `mejorar: elige ${a(kindNoun(kind))} · Esc para terminar`,
  /** The gestures' answers. */
  pickOne: "Elige un edificio que mejorar",
  already: (kind: KindId): string => `${capital(the(kindNoun(kind)))} ya se está mejorando`,
  /** An upgrade under way, in the building's panel. */
  becoming: (kind: KindId, level: number): string => `convirtiéndose en ${a(kindNoun(kind, level))}`,
  // "built", beside a share of the works: a noun, so it agrees with no building.
  built: "avance",
  stillBring: (left: string): string => `los porteadores aún tienen que traer ${left}; mientras tanto sigue trabajando`,
  allIn: "ya han llegado todos los materiales; los albañiles los están colocando, y mientras tanto sigue trabajando"
}

// ── Placing ───────────────────────────────────────────────────────────────

const gathered = { tree: "no hay árboles", stone: "no hay rocas claras de piedra", ore: "no hay rocas oscuras de mineral", water: "no hay agua" } as const

const place = {
  /** What is wrong with a building where it would stand. */
  problem: {
    noRoad: () => "necesita un camino en el centro de un lado",
    nothingNear: (p) => `${gathered[p.source]} en un radio de ${p.radius} casillas`
  } satisfies Wording<PlaceProblem>,
  /** A building refused where it was put down: "Pesquería: necesita un camino en el centro de un lado". */
  refused: (kind: KindId, why: string): string => `${capital(kindName(kind))}: ${why}`
}

// ── Map views ─────────────────────────────────────────────────────────────

/**
 * Each map view's legend: its heading, what each colour means, and how the reading works. A colour is laid over homes
 * and buildings alike, so what it means is said with a phrase ("bajo control", "en buen estado"), not an adjective
 * that would agree with one of them.
 */
const legend = {
  appeal: {
    title: "atractivo",
    keys: {
      townhouses: `${home.tiers[3].appeal}+: ${tiers[3].home.other}`,
      citizens: `${home.tiers[2].appeal}+: ${tiers[2].people.other}`,
      settlers: `de 0 a 4: solo ${tiers[1].people.other}`,
      fewer: "bajo 0: menos gente, menos impuestos",
      squalid: `${signed(home.squalid)} o menos: miseria`
    },
    note: `Cada punto cuenta: una choza aloja a menos gente y paga menos por cada punto bajo 0, y paga más por encima. La industria aleja las casas; los parques (cuanto más tienen, más lejos llegan), ${a(kindNoun("chapel"))}, ${a(kindNoun("market"))} y las calles empedradas las atraen.`
  },
  workers: {
    title: "trabajadores",
    keys: { staffed: "plantilla completa", short: "faltan trabajadores", none: "sin trabajadores", settlers: tiers[1].home.other, citizens: tiers[2].home.other },
    note: `Los habitantes caminan como mucho ${COMMUTE} casillas de camino hasta el trabajo. Elige un lugar de trabajo para ver su alcance y las casas que quedan dentro.`
  },
  fire: {
    title: "incendios",
    keys: { good: "bajo control", fair: "en aumento", bad: "en riesgo, o en llamas" },
    note: `Los edificios también toman el color. El vigilante de ${aFirewatch} pone a cero el riesgo de cada casa y taller de su camino; el bermellón indica más de la mitad, así que aún hay tiempo. Las casas de madera, los hornos, las forjas y el hacinamiento lo hacen subir.`
  },
  health: {
    title: "salud",
    keys: { good: "visita reciente", fair: "en aumento", bad: "en riesgo, o con enfermos" },
    note: `El médico de ${aHealer} pone a cero el riesgo y cura a los enfermos. El hambre, el hacinamiento, la miseria, el polvo de cantera y el agua estancada lo hacen subir.`
  },
  order: {
    title: "orden",
    keys: { good: "en orden", fair: "en aumento", bad: "hay ladrones" },
    note: `El alguacil de ${aWatchhouse} mantiene el orden. La poca aprobación, la miseria y las casas a medio llenar lo hacen subir; primero llegan los robos, luego la casa queda abandonada.`
  },
  condition: {
    title: "estado",
    keys: { good: "en buen estado", fair: "necesita reparación", bad: "deterioro: medio ritmo" },
    note: `El albañil ${ofBuilder} repara con tablas y piedra lo que encuentra a su paso. Cuando el estado llega a cero, se derrumba.`
  }
} satisfies { readonly [V in keyof LegendKeys]: { readonly title: string; readonly keys: Readonly<Record<LegendKeys[V], string>>; readonly note: string } }

// ── Parks and ruins ───────────────────────────────────────────────────────

/** What a park does for the streets around it. */
const parkWorth = (value: number, reach: number): string => `atractivo ${signed(value)} hasta ${reach} casillas`
/** What became of a ruin, in a word: of "ruina", so in the feminine. */
const ruinCause = { burnt: "quemada", collapsed: "derrumbada", derelict: "abandonada" }

// ── The catalog's part ────────────────────────────────────────────────────

export const view = {
  /** What a building is doing, in a word: phrases that agree with no building, whatever its gender. */
  status: {
    building: "en obras", idle: "en reposo", working: "trabajando", starved: "sin suministros", blocked: "sin salida", unstaffed: "sin trabajadores", unconnected: "sin camino", paused: "en pausa"
  } satisfies Record<Status, string>,
  street,
  cause,
  /** A cause in one line: "why: what to do". */
  causeLine: (told: Told): string => (told.fix === undefined ? told.why : `${told.why}: ${told.fix}`),
  problem,
  /** A problem in one line, for the panel's header and the tooltip: "sin camino: necesita un camino en el centro de uno de sus lados". */
  problemLine: (told: ToldProblem): string => `${told.label}: ${told.why}`,
  upgrade,
  place,
  legend,
  /** How a risk reads: "bien", "40%", or "alto, 85%". */
  risk: { ok: "bien", some: (percent: number): string => `${percent}%`, high: (percent: number): string => `alto, ${percent}%` },
  /** What pulling something down (or cancelling a site) costs and gives back: "derribar: −25 monedas · recuperas 2 tablas, 3 de piedra". */
  salvage: (s: { readonly cancelled: boolean; readonly salvage: Salvage }): string => {
    const said = salvage(s.salvage)
    return `${s.cancelled ? "cancelar" : "derribar"}${said ? `: ${said}` : ""}`
  },

  /** What moves the town's approval, a row each. */
  mood: {
    base: "ánimo del pueblo",
    needs: "necesidades cubiertas",
    taxes: "impuestos actuales",
    grudge: "rencor por impuestos pasados",
    debt: "salarios sin pagar",
    crown: "el disgusto de la corona",
    winter: "un invierno de hambre"
  },

  /** What the next rank asks: each goal, and how the town stands against it. */
  goal: {
    text: {
      residents: (target) => `${target} habitantes`,
      citizens: (target) => `${target}% de ${tiers[2].people.other}`,
      burghers: (target) => `${target}% de ${tiers[3].people.other}`,
      approval: (target) => `aprobación de ${target} o más`,
      income: (target) => `${target} monedas por minuto, sin deudas`,
      hall: (target) => a(kindNoun("townhall", target))
    } satisfies Record<GoalId, (target: number) => string>,
    value: {
      residents: (value) => `${value}`,
      citizens: (value) => `${value}%`,
      burghers: (value) => `${value}%`,
      approval: (value) => `${value}`,
      income: (value) => `${value}`,
      // Of a building whose gender the goal does not know: "hecho" would have to agree, "sí" does not.
      hall: (value, target) => (value >= target ? "sí" : "aún no")
    } satisfies Record<GoalId, (value: number, target: number) => string>
  },

  /** What needs looking at now, in the ticker: buildings, goods, and tools as chips; amounts in words. */
  alerts: {
    fire: (burning: number, watched: boolean): string =>
      `${burning} en llamas: ${watched ? `los bomberos ${toKind("de", "firewatch")} ya van de camino` : `construye ${aKind("firewatch")} cerca: sus bomberos apagan los incendios`}`,
    sick: (sick: number, healed: boolean): string =>
      `${count(sick, homes)} con enfermos, que ${sick === 1 ? "aloja" : "alojan"} a la mitad de la gente: ${healed ? `${aKind("healer")} al alcance de su camino los cura` : `construye ${aKind("healer")} entre las casas`}`,
    /** Workshops idle for want of their input, by kind: "sin suministros: el molino espera trigo ×2. …". */
    idle: (waiting: ReadonlyArray<{ readonly kind: KindId; readonly good: GoodId; readonly n: number }>): string =>
      `sin suministros: ${waiting.map((w) => `${theKind(w.kind)} necesita ${good(w.good)}${w.n > 1 ? ` ×${w.n}` : ""}`).join(", ")}. Produce más de lo que falta, o cómpralo en el panel ${town}`,
    /** Workplaces no home can reach, by kind. */
    remote: (remote: ReadonlyArray<{ readonly kind: KindId; readonly n: number }>): string =>
      `sin trabajadores para ${remote.map((w) => `${theKind(w.kind)}${w.n > 1 ? ` ×${w.n}` : ""}`).join(", ")}: pon ${token.command("homes")} ${commute} de allí, o un camino hasta casas cercanas`,
    hungry: `no hay comida en el almacén, así que las casas pasan hambre y no pagan impuestos: construye ${anotherKind("fishery")}, o compra ${good("fish")} en el panel ${town}`
  },

  /** A building's panel. */
  building: {
    beingBuilt: "en obras",
    waitingFor: "esperando",
    carriersBring: "los porteadores los traen del almacén: compra en el panel del pueblo lo que le falte al pueblo",
    builders: "albañiles",
    atWork: "trabajando",
    workers: "trabajadores",
    staffed: (assigned: number, needed: number): string => `${assigned} de ${needed}`,
    nobodyNear: (crew: Crew): string => `no vive ningún ${tiers[crew === "citizens" ? 2 : 1].people.one} ${commute}: pon casas más cerca`,
    allTaken: `todos los de cerca tienen trabajo: pon más casas ${commute}`,
    apprentices: `${theMany(tiers[1].people)} sustituyen a ${theMany(tiers[2].people)}, a tres cuartos de ritmo`,
    makes: "produce",
    /** What it makes: from what, into what (each with its icon), or what alone. */
    recipe: (input: GoodId | null, output: GoodId): string => (input ? `${token.good(input)} → ${token.good(output)}` : goods[output].name),
    walkersOut: "recorridos en marcha",
    handedOut: "repartido, último minuto",
    handedTo: (n: number): string => `a ${count(n, homes)} en sus recorridos`,
    nothing: "nada",
    nobodyNeeded: "ninguna casa de sus recorridos necesitaba lo que llevaba",
    shelf: "en los estantes ahora",
    holds: "guarda",
    tools: goods.tools.name,
    none: agree(goods.tools, "ninguno", "ninguna"),
    noTools: `medio ritmo hasta que llegue ${agree(goods.tools, "uno", "una")}: ${a(kindNoun("smithy"))} ${agree(goods.tools, "los", "las")} hace, o ${agree(goods.tools, "cómpralos", "cómpralas")} en el panel del pueblo`,
    upkeep: "mantenimiento",
    upkeepValue: (coins: number): string => token.rate(coins),
    condition: "estado",
    runDown: `medio ritmo, y puede derrumbarse: ${mends}`,
    wearing: `${mends} cuando pasa su albañil`,
    fireRisk: "riesgo de incendio",
    fireCure: `el vigilante de ${aFirewatch} lo baja al pasar`,
    appeal: "atractivo cercano",
    work: "trabajo",
    running: "funcionamiento",
    /** Behind the ⓘ of "funcionamiento": a sentence for each thing that costs or risks something. */
    help: {
      upkeep: "El mantenimiento se paga cada minuto que el edificio sigue en pie, un cuarto mientras está en pausa.",
      condition: `Todo se desgasta; ${mends}.`,
      hot: "Un horno o una forja: un riesgo de incendio para sí mismo y para las casas a 2 casillas.",
      appeal: (reach: number, worse: boolean): string =>
        `Cambia lo agradables que son las calles hasta ${reach} casillas${worse ? ": las casas cercanas alojan a menos gente y pagan menos" : ""}.`
    }
  },

  /** A home's panel: a home is a "casa" or a "choza", so what is said of it is in the feminine. */
  house: {
    household: "hogar",
    beingBuilt: "en obras",
    builders: "albañiles",
    waitingPlank: "esperando su tabla",
    closed: "cerrada",
    empty: "vacía",
    closedNote: `no paga impuestos ni le cuesta nada ${to("a", kindNoun("townhall"))}: reábrela y ${theMany(tiers[1].people)} vuelven`,
    /** Why it holds fewer than it could. */
    fewer: {
      sick: "la mitad mientras haya enfermos",
      disapproval: "menos mientras el pueblo desapruebe a su alcalde",
      street: (advice: string): string => `menos en una calle pobre: ${advice}`,
      taxed: (rate: number): string => `menos con impuestos al ${rate}%: algunos se van`,
      needs: "menos hasta que se cubran todas las necesidades"
    },
    onFire: "en llamas",
    fled: "todos han huido",
    sick: "con enfermos",
    halved: "la mitad",
    sickNote: `se pasa en un minuto, o cuando llega el médico de ${aHealer}`,
    residents: "habitantes",
    living: (n: number, room: number): string => `${n} de ${room}`,
    pays: "paga",
    paying: (coins: number): string => token.rate(coins),
    hungry: "con hambre",
    hungryNote: "con hambre: sin comida, sin impuestos",
    could: (coins: number): string => `${token.rate(coins)} con todas las necesidades cubiertas`,
    worksAt: "trabaja en",
    workplace: (kind: KindId): string => kindName(kind),
    nothingNearby: "nada cerca",
    needs: "necesidades",
    met: "✓",
    missing: "falta",
    /** What a need is wanted for: the tier it would raise the home to. */
    forTier: (tier: Tier): string => `para ${tiers[tier].people.other}`,
    street: "calle",
    streetOf: (desirability: number, needed: number): string => `${signed(desirability)} de ${needed}`,
    desirability: (d: number): string => signed(d),
    services: "servicios",
    rebuilding: "reconstrucción",
    rebuilt: "hecha ✓",
    shortOf: (short: Kind["cost"]): string =>
      `al pueblo le faltan ${[...(short.coins > 0 ? [token.coins(short.coins)] : []), ...(Object.entries(short.materials) as Array<[GoodId, number]>).map(([g, n]) => token.amount(g, n))].join(", ")}`,
    waitsForStore: `se queda en su nivel hasta que el almacén tenga lo que hace falta: prodúcelo, o cómpralo en el panel ${town}`,
    rebuiltAlready: "ya reconstruida: vuelve a subir sin coste",
    readyFor: (tier: Tier): string => `lista para ${tiers[tier].people.other}`,
    readyNote: "crece cuando llega el próximo habitante, y entonces paga su reconstrucción",
    safety: "riesgos y desgaste",
    risks: "riesgos",
    allLow: "todos bajos",
    riskOf: { fire: "riesgo de incendio", health: "riesgo para la salud", order: "riesgo de robo" } satisfies Record<RiskId, string>,
    cure: { fire: `lo baja el vigilante de ${aFirewatch}`, health: `lo baja el médico de ${aHealer}`, order: `lo baja el alguacil de ${aWatchhouse}` } satisfies Record<RiskId, string>,
    robbed: "robada",
    times: (n: number): string => `${n}×`,
    condition: "estado",
    runDown: `hunde la calle y puede derrumbarse: ${mends}`,
    wearing: `${mends} cuando pasa su albañil`,
    /** Behind the ⓘ of "necesidades", by the home's tier: what red and amber mean, and what the next tier asks. */
    needsHelp: {
      1: `Rojo: lo necesita ya. Ámbar: lo necesita para convertirse en ${a(tiers[2].home)}, que aloja y paga el doble. Solo con pan una choza ya paga la mitad más. Los repartidores llevan las necesidades por el camino; la calle es lo agradable que es el sitio (atractivo ${home.tiers[2].appeal} para ${tiers[2].people.other}).`,
      2: `Rojo: lo necesita ya, o vuelve a ser de ${tiers[1].people.other}. Ámbar: lo necesita para convertirse en ${a(tiers[3].home)}, en una calle de ${home.tiers[3].appeal} atendida por ${aFirewatch}, ${aHealer} y ${aWatchhouse}.`,
      3: `Rojo: lo necesita ya, o vuelve a ser de ${tiers[2].people.other}.`
    } satisfies Record<Tier, string>,
    safetyHelp: "En cada casa el riesgo de incendio, enfermedad y robo sube poco a poco; lo baja al pasar quien sale del servicio correspondiente.",
    /** How it is, in a word or two for the header. */
    summary: (n: number): string => count(n, residents)
  },

  /** A park's panel. */
  park: {
    worth: parkWorth,
    /** What a park's beauty is made of. */
    part: {
      ground: (l) => (l.capped ? "terreno (todo lo que cuenta)" : "terreno"),
      ways: (l) => (l.count === 1 ? "entrada desde la calle" : "entradas desde la calle"),
      prop: (l) => props[l.prop].noun.one
    } satisfies Wording<ParkLabel>,
    size: "tamaño",
    sizeOf: (n: number, beauty: number): string => `${count(n, cells)} · belleza ${decimal(beauty)}`,
    madeOf: "hecho de",
    /** Its parts with what each is worth, already worded: "terreno 2, farol 1,5". */
    parts: (parts: ReadonlyArray<{ readonly label: string; readonly value: number }>): string => parts.map((p) => `${p.label} ${decimal(p.value)}`).join(", ") || "nada todavía",
    streets: "las calles de alrededor",
    ways: "entradas desde la calle",
    waysIn: (n: number): string => `${n}${n > 2 ? " (cuentan 2)" : ""}`,
    none: "ninguna",
    noWays: `traza ${a(grounds.path.noun)} o ${a(grounds.square.noun)} hasta un camino: +1,5 cada uno, cuentan dos`,
    furnishings: "adornos que cuentan",
    furnished: (placed: number, room: number): string => `${placed} de ${room}`,
    crowded: (n: number): string => `${n} de más: cuenta uno por cada 2 casillas de parque, así que pon más terreno`,
    nicerWith: "más bonito con",
    missing: (ids: ReadonlyArray<PropId>): string => ids.map((id) => props[id].noun.one).join(", "),
    upkeep: "mantenimiento",
    upkeepValue: (coins: number): string => token.rate(coins)
  },

  /** A ruin's panel. */
  ruin: {
    cause: ruinCause,
    happened: "qué pasó",
    // What stood here is not known to be a home or a building: each is said as what befell it, a noun.
    what: { burnt: "un incendio", collapsed: "un derrumbe, por falta de reparaciones", derelict: "el abandono, tras los robos" },
    appeal: "atractivo cercano",
    untilCleared: "hasta que se despeje: derríbala"
  },

  /** What the pointer is over, in a line; and what a tool would lay there, and for how much. Amounts as icons. */
  tooltip: {
    /** A building: what it is doing, or what keeps it from it; and what it is becoming, when works are under way. */
    building: (b: { readonly kind: KindId; readonly level: number; readonly state: string; readonly works: { readonly level: number; readonly percent: number } | null }): string =>
      `${kindName(b.kind, b.level)} · ${b.state}${b.works ? ` · convirtiéndose en ${a(kindNoun(b.kind, b.works.level))}, al ${b.works.percent}%` : ""}`,
    /** Bulldozing: what pulling it down gives back, or that it stays. */
    bulldozeBuilding: (kind: KindId, level: number, back: string): string => `${kindName(kind, level)} · ${back}`,
    hallStays: `${the(kindNoun("townhall"))} no se derriba`,
    bulldozeHome: (tier: Tier, back: string): string => `${tiers[tier].home.one} · ${back}`,
    homeClosed: (tier: Tier): string => `${tiers[tier].home.one} · ${agree(tiers[tier].home, "cerrado", "cerrada")}`,
    home: (h: { readonly tier: Tier; readonly residents: number; readonly desirability: number; readonly burning: boolean; readonly sick: boolean }): string =>
      `${tiers[h.tier].home.one} · ${count(h.residents, residents)} · atractivo ${h.desirability}${h.burning ? " · ¡en llamas!" : h.sick ? " · con enfermos" : ""}`,
    ruin: (cause: "burnt" | "collapsed" | "derelict"): string => `ruina · ${ruinCause[cause]} · derríbala para despejar`,
    park: (what: { readonly prop: PropId } | { readonly ground: GroundId }, whole: { readonly cells: number; readonly value: number; readonly reach: number } | null): string =>
      `parque · ${"prop" in what ? props[what.prop].noun.one : grounds[what.ground].noun.one}${whole ? ` · ${count(whole.cells, cells)} · ${parkWorth(whole.value, whole.reach)}` : ""}`,
    /** Placing a building: what keeps it from here, or what it costs. */
    placeLocked: (kind: KindId, l: Lock): string => `${kindName(kind)} · ${say(lock, l)}`,
    placeNoRoom: (kind: KindId): string => `${kindName(kind)} · aquí no hay espacio`,
    placeProblem: (kind: KindId, why: string): string => `${kindName(kind)} · ${why}`,
    placeCost: (kind: KindId, c: Kind["cost"]): string => `${kindName(kind)} · ${cost(c)}`,
    pave: (c: { readonly coins: number; readonly stone: number }): string => `empedrar · ${token.coins(c.coins)} y ${token.amount("stone", c.stone)} por casilla · se camina más rápido`,
    desirability: (d: number): string => `atractivo ${d}`,
    cancel: "suelta aquí para cancelar",
    /** What new homes would bring in once fed, or that they would cost more than they pay. */
    // Said after one home or many ("1 casa", "4 casas"): turned so nothing has to agree in number.
    homesWorth: (coins: number): string => (coins > 0 ? ` · ${token.rate(coins, true)} en cuanto llegue la comida` : " · el mantenimiento supera los impuestos: las casas mejores pagan más"),
    homes: (c: Kind["cost"], worth: string | null): string => `casas · ${cost(c)} cada una${worth ?? " · ponlas junto a un camino"}`,
    road: (coins: number): string => `camino · ${token.coins(coins)} por casilla`,
    /** A stroke being dragged: how much it lays, and what that costs. */
    roadStroke: (n: number, c: Kind["cost"]): string => `${count(n, roadCells)} · ${cost(c)}`,
    homesStroke: (n: number, c: Kind["cost"], worth: string): string => `${count(n, homes)} · ${cost(c)}${worth}`,
    paveStroke: (n: number, c: Kind["cost"]): string => `empedrar ${count(n, cells)} · ${cost(c)}`,
    groundStroke: (ground: GroundId, n: number, c: Kind["cost"]): string => `${grounds[ground].noun.one} · ${count(n, cells)} · ${cost(c)}`,
    ground: (ground: GroundId, c: Kind["cost"], park: number | null): string => `${grounds[ground].noun.one} · ${cost(c)}${park === null ? "" : ` · parque con ${signed(park)} de atractivo`}`,
    /** A furnishing about to be set: what the park would be worth with it (and is now, when that differs), and whether it is one too many. */
    prop: (prop: PropId, c: Kind["cost"], park: { readonly value: number; readonly before: number | null; readonly crowded: boolean } | null): string =>
      `${props[prop].noun.one} · ${cost(c)}${park ? ` · parque con ${signed(park.value)} de atractivo${park.before === null ? "" : ` (ahora ${signed(park.before)})`}` : ""}${park?.crowded ? " · demasiado lleno" : ""}`,
    propNeedsPark: (prop: PropId): string => `${props[prop].noun.one} · primero pon terreno de parque`,
    removeProp: (prop: PropId): string => `quitar ${the(props[prop].noun)}`,
    removeGround: (ground: GroundId): string => `quitar ${the(grounds[ground].noun)}`,
    workedFace: (ore: boolean): string => `frente trabajado de ${goods[ore ? "ore" : "stone"].name} · derríbalo para despejarlo`,
    rock: (ore: boolean, left: number): string => `${goods[ore ? "ore" : "stone"].name} · ${left === 1 ? "queda" : "quedan"} ${left}`,
    /** What a thing being placed would reach, said beside its outline. */
    walkersReach: (range: number): string => `sus recorridos llegan a ${range} casillas de camino desde la puerta`,
    workersFrom: `sus trabajadores vienen de casas ${commute}`,
    residentsWalk: `los habitantes van al trabajo ${commute}`
  }
} satisfies typeof English
