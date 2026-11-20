/**
 * Italian for the mayor's guide (`game/rules/guide.ts`): what each step
 * asks for, why, and what closes it; and what the guide says of the town as
 * it stands (what is under way, what opens a building, what comes next).
 * The same steps and the same tokens as English's (`../en/guide.ts`), in
 * sentences of Italian's own.
 *
 * As in English, a step is one thing to do (`action`, one sentence), one
 * reason (`why`), and what puts it away (`goal`, a lowercase clause that
 * reads after "fatto quando"); tools, panels, and map views are tokens, and
 * what a finger and a mouse do is said with `token.device` ("tocca",
 * "clicca"). Amounts stay words.
 *
 * Every building and good is a chip written through `chips.ts`, its
 * article or preposition outside the chip and bent to the noun: nothing
 * here writes "il", "una", or "del" before one by hand. Where English
 * refers back to a good or a building with "it" or "one", the sentence is
 * turned so no pronoun or adjective has to agree with a noun this file
 * does not choose ("ne fa tavole", not "lo sega in tavole").
 */
import type { GoodId } from "../../game/content/index.ts"
import type { Chapter, GuideLocked, GuideSoon, GuideStepId, GuideWaiting } from "../../game/rules/guide.ts"
import type { guide as English } from "../en/guide.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { aKind, good, kind, kinds, theGood, theKind, toGood, toKind } from "./chips.ts"
import { a, capital, theMany, toMany } from "./grammar.ts"
import { goods, rankNoun, tiers } from "./nouns.ts"

const tool = token.command
/** A map view's chip: each is a "mappa …", so a sentence gives it "la". */
const map = token.view
const tap = token.device("tocca", "clicca")
const Tap = token.device("Tocca", "Clicca")
/** A verb in the number its good is spoken of in: "le tavole scarseggiano", "la pietra scarseggia". */
const verb = (id: GoodId, one: string, many: string) => (goods[id].counted ? many : one)
const runsLow = (id: GoodId) => `${capital(theGood(id))} ${verb(id, "scarseggia", "scarseggiano")}`
/** "una peschiera è in piedi": a building stands, said so that nothing agrees with its gender. */
const stands = "è in piedi", stand = "sono in piedi"
const rank = (n: number) => rankNoun(n).one
const speed = `Con ${tool("speed")} il tempo scorre più in fretta.`

/** A step in words: what to do, why, and when it is done. */
interface Step {
  readonly action: string
  readonly why: string
  readonly goal: string
}

const chapters = {
  founding: "Fondazione",
  standing: "Tenerlo in piedi",
  citizens: "Far crescere i cittadini",
  governing: "Governo"
} satisfies Record<Chapter, string>

const steps = {
  // ── The opening, in order ──
  homes: {
    action: `Scegli ${tool("homes")} e trascina lungo la strada grigia intorno al municipio${token.device(", poi tocca Posa", "")}.`,
    why: "I coloni vanno ad abitare nelle case che toccano una strada, e ogni casa paga le tasse: le entrate del paese.",
    goal: `una casa ${stands}`
  },
  road: {
    action: `Scegli ${tool("road")} e traccia una strada da quella del municipio verso l'acqua.`,
    why: `A ogni edificio serve una strada che tocchi il centro di un suo lato, o nessuno può raggiungerlo. Poi viene ${theKind("fishery")}, che vuole l'acqua vicina.`,
    goal: "una strada arriva a due caselle dall'acqua"
  },
  fishery: {
    action: `${Tap} ${kind("fishery")}, poi scegli un punto su quella strada, con l'acqua a non più di due caselle.`,
    why: `I coloni mangiano ${good("fish")}. Il paese ne ha un poco all'inizio, e in magazzino ${theGood("fish")} va a male.`,
    goal: `${aKind("fishery")} ${stands}`
  },
  look: {
    action: `Scegli ${tool("select")} e ${tap} ${theKind("fishery")} per aprire il suo pannello.`,
    why: "A un edificio servono lavoratori dalle case entro 15 caselle di strada; il suo pannello dice quanti ne ha e che cosa lo frena. Il contatore dei posti di lavoro in alto li somma tutti.",
    goal: "apri il pannello di un edificio"
  },
  lumberjack: {
    action: `Costruisci ${aKind("lumberjack")} su una strada accanto agli alberi.`,
    why: `${runsLow("planks")}, e ogni casa e ogni edificio ne costa. ${capital(toGood("da", "wood"))} nascono ${theGood("planks")}.`,
    goal: `${aKind("lumberjack")} ${stands}`
  },
  sawmill: {
    action: `Costruisci ${aKind("sawmill")} su una strada vicino ${toKind("a", "lumberjack")}.`,
    why: `Le merci nascono in catena: ${theKind("lumberjack")} taglia ${theGood("wood")}, e ${theKind("sawmill")} ne fa ${good("planks")}. I portatori trasportano le merci tra i due lungo le strade.`,
    goal: `${aKind("sawmill")} ${stands}`
  },
  term: {
    action: `Apri il pannello ${tool("town")} e leggi gli obiettivi in cima.`,
    why: `Raggiungerli fa salire il paese da ${rank(0)} a ${rank(1)}, ${rank(2)} e ${rank(3)}, ogni volta con una ricompensa della corona. Con ${tool("pause")} fermi l'orologio quando ti serve pensare.`,
    goal: "apri il pannello del paese"
  },
  grow: {
    action: "Traccia altre strade e altre case finché non ci sono dieci case in piedi.",
    why: `Più gente paga più tasse, e sblocca nuovi edifici in ${tool("build")}. La guida chiede un edificio solo quando al paese serve.`,
    goal: `10 case ${stand}`
  },

  // ── The course goes on: citizens ──
  quarry: {
    action: `Costruisci ${aKind("quarry")} su una strada accanto alle rocce chiare.`,
    why: `${runsLow("stone")}, e le botteghe che servono ai cittadini ne costano. Le rocce scure sono ${good("ore")}, per dopo.`,
    goal: `${aKind("quarry")} ${stands}`
  },
  cloth: {
    action: `Costruisci ${aKind("sheep")} e ${aKind("weaver")}, su strade vicine tra loro.`,
    why: `Una casa diventa ${a(tiers[2].home)} con ${good("bread")}, ${good("cloth")} e fede. ${capital(theKind("sheep"))} dà ${theGood("wool")}, e ${theKind("weaver")} ne fa ${good("cloth")}.`,
    goal: `${aKind("sheep")} e ${aKind("weaver")} ${stand}`
  },
  chapel: {
    action: `Costruisci ${aKind("chapel")} su una strada tra le case.`,
    why: `La fede è il secondo bisogno. Il prete ${toKind("di", "chapel")} la porta alle case davanti a cui passa, e ${theKind("chapel")} rende più bella la sua via.`,
    goal: `${aKind("chapel")} ${stands}`
  },
  wheat: {
    action: `Costruisci ${aKind("farm")} e ${aKind("mill")}.`,
    why: `${capital(theGood("bread"))} è il terzo bisogno, e la catena più lunga: ${theKind("farm")} coltiva ${theGood("wheat")}, e ${theKind("mill")} ne fa ${good("flour")}.`,
    goal: `${aKind("farm")} e ${aKind("mill")} ${stand}`
  },
  bakery: {
    action: `Costruisci ${aKind("bakery")} vicino ${toKind("a", "mill")}.`,
    why: `Con ${theGood("flour")} ${toKind("di", "mill")} fa ${theGood("bread")}. Anche ${a(tiers[1].home)} con ${theGood("bread")} in tavola paga la metà in più.`,
    goal: `${aKind("bakery")} ${stands}`
  },
  citizens: {
    action: `Scegli ${tool("select")} e ${tap} una casa per vedere che cosa le manca ancora per ospitare cittadini.`,
    why: `Con ${good("bread")}, ${good("cloth")}, fede e una via di attrattiva 5, una casa cresce appena il magazzino ne paga ${theGood("planks")} e ${theGood("stone")}. Il suo pannello elenca che cosa manca.`,
    goal: "la prima casa ospita cittadini"
  },
  goals: {
    action: `Apri il pannello ${tool("town")} per vedere quanto manca agli obiettivi.`,
    why: "I primi cittadini sono arrivati, e ogni rango ne chiede una quota più grande.",
    goal: "apri il pannello del paese"
  },
  ranks: {
    action: `Raggiungi ogni obiettivo nel pannello ${tool("town")} per far salire di rango il paese.`,
    why: `Mantienili per due minuti e il paese sale, fino a diventare ${rank(3)}. Il rango di ${rank(2)} apre gli ampliamenti ${toKind("di", "market")} e ${toKind("di", "chapel")}. La guida si fa sentire quando qualcosa ha bisogno di te.`,
    goal: `il paese è ${a(rankNoun(3))}`
  },

  // ── Around the course, when the town needs them ──
  crown: {
    action: "Manda alla corona ciò che chiede, con il pulsante «invia» sulla sua richiesta in alto.",
    why: "Paga in monete. Una richiesta senza risposta è una multa, e tre mancate di fila chiudono il tuo mandato.",
    goal: "le merci sono inviate"
  },
  winter: {
    action: `Costruisci ${aKind("granary")} o ${aKind("smokehouse")} prima che arrivi l'inverno.`,
    why: `D'inverno la pesca rallenta, le case mangiano di più, e in magazzino ${theGood("fish")} va a male. Con ${aKind("granary")} dura cinque volte di più, e ${theGood("smoked")} dura tutto l'inverno.`,
    goal: `${aKind("granary")} o ${aKind("smokehouse")} ${stands}`
  },
  tools: {
    action: `Nel pannello ${tool("town")}, sotto merci e commercio, imposta ${theGood("tools")} su compra.`,
    why: `Le botteghe consumano ${theGood("tools")}, e solo ${aKind("smithy")} ne produce: apre a 10 cittadini.`,
    goal: `il paese compra ${good("tools")}, o ${aKind("smithy")} ${stands}`
  },
  forester: {
    action: `Costruisci ${aKind("forester")} accanto ${toKind("a", "lumberjack")}.`,
    why: `${capital(theKind("lumberjack"))} sta finendo gli alberi, e ${aKind("forester")} gliene pianta di nuovi.`,
    goal: `${aKind("forester")} ${stands}`
  },
  firewatch: {
    action: `Costruisci ${aKind("firewatch")} su una strada tra le case.`,
    why: `Le capanne di legno prendono fuoco, e un incendio passa ai vicini. La sua vedetta tiene basso il rischio, e i suoi pompieri spengono gli incendi. La ${map("fire")} mostra il rischio.`,
    goal: `${aKind("firewatch")} ${stands}`
  },
  builder: {
    action: `Costruisci ${aKind("builder")} vicino agli edifici malandati.`,
    why: `Un edificio malandato lavora a metà ritmo e può crollare. Il suo muratore ripara ciò che incontra, con ${good("planks")} e ${good("stone")}. La ${map("condition")} mostra come stanno gli edifici.`,
    goal: `${aKind("builder")} ${stands}`
  },
  market: {
    action: `Costruisci ${aKind("market")} tra le case più lontane dal municipio.`,
    why: `Alcune case sono fuori dalla portata dell'ambulante del municipio, che arriva solo a 20 caselle di strada, e restano senza cibo. L'ambulante di ${aKind("market")} lo porta più lontano.`,
    goal: `${aKind("market")} ${stands}`
  },
  markethall: {
    action: `${Tap} ${theKind("market")} (la freccia d'oro sopra) e dal suo pannello avvia ${theKind("market", 1)}.`,
    why: `Alcune case sono fuori dalla portata di ogni ambulante del cibo. L'ambulante di ${aKind("market", 1)} va più lontano e più spesso, senza pagare il mantenimento di due ${kinds("market")}.`,
    goal: `${aKind("market", 1)} ${stands}`
  },
  street: {
    action: `Porta la via di questa casa ad attrattiva 5: aggiungi lì vicino ${aKind("chapel")}, ${aKind("market")} o un parco, e tieni lontane le botteghe.`,
    why: `Ha ${good("bread")}, ${good("cloth")} e fede, ma i cittadini vivono solo in una via decorosa. La ${map("appeal")} la mostra via per via.`,
    goal: "una casa in una bella via ospita cittadini"
  },
  carpenter: {
    action: `Costruisci ${aKind("carpenter")}: fa ${good("furniture")} con ${theGood("planks")}.`,
    why: `${capital(theMany(tiers[3].people))} vivono ${toMany("in", tiers[3].home)}, e a ${a(tiers[3].home)} servono ${good("furniture")}: due pezzi perché una casa lo diventi, e ogni tanto uno nuovo ${toKind("da", "market")} perché lo resti. Sono le case che pagano di più e ospitano più gente.`,
    goal: `${aKind("carpenter")} ${stands}`
  },
  healer: {
    action: `Costruisci ${aKind("healer")} su una strada tra le case.`,
    why: `La malattia si diffonde, e una casa malata ospita la metà della gente. Il medico ${toKind("di", "healer")} visita le case e le cura. La ${map("health")} mostra il rischio.`,
    goal: `${aKind("healer")} ${stands}`
  },
  watchhouse: {
    action: `Costruisci ${aKind("watchhouse")} su una strada tra le case.`,
    why: `Vie povere, case mezze vuote e poco consenso attirano i ladri. Il suo gendarme percorre le vie e mantiene l'ordine. La ${map("order")} mostra il rischio.`,
    goal: `${aKind("watchhouse")} ${stands}`
  },
  trade: {
    action: `Nel pannello ${tool("town")}, sotto merci e commercio, vendi una merce che si accumula, o comprane una che scarseggia.`,
    why: "Il paese non commercia nulla finché non glielo dici, e le merci in più sono monete che aspettano.",
    goal: "il paese vende o compra qualcosa"
  },
  taxes: {
    action: `Alza un poco le tasse nel pannello ${tool("town")}.`,
    why: "Il paese è contento ma perde monete, e il consenso regge tasse più alte. Sopra il 125% resta un rancore che dura.",
    goal: "un'aliquota delle tasse cambia"
  },
  smithy: {
    action: `Costruisci ${aKind("mine")} accanto alle rocce scure venate di ruggine, e ${aKind("smithy")}.`,
    why: `${runsLow("tools")}, e ogni bottega ne consuma. ${capital(theKind("mine"))} estrae ${theGood("ore")}, e ${theKind("smithy")} ne fa ${good("tools")}.`,
    goal: `${aKind("mine")} e ${aKind("smithy")} ${stand}`
  }
} satisfies Record<GuideStepId, Step>

/** What is happening, once the mayor has done a step's part and the town is at work on it. */
const waiting = {
  homesNoPlanks: () => `Le case aspettano ${theGood("planks")}, e il magazzino non ne ha.`,
  homesRising: () => `I muratori portano ${theGood("planks")} dal magazzino alle nuove case, e i coloni arrivano appena una è in piedi. ${speed}`,
  siteNoPlanks: () => `Il magazzino non ha più ${good("planks")}, e il cantiere aspetta: vendi qualcosa nel pannello ${tool("town")}, o compra lì ${theGood("planks")}.`,
  siteRising: () => `Per ora è un cantiere: i portatori portano lì ${theGood("planks")} e ${theGood("stone")} dal magazzino, poi i muratori lo tirano su. ${speed}`,
  homesLaid: () => "Dieci case sono tracciate: i muratori le stanno tirando su."
} satisfies Wording<GuideWaiting>

/** Why the town cannot build what a step asks for yet, and what to do meanwhile. */
const locked = {
  residents: (l) => `${capital(theKind(l.kind))} apre a ${l.needs} abitanti (ora ${l.now}): traccia altre ${tool("homes")} e non lasciarle senza cibo.`,
  citizens: (l) => `${capital(theKind(l.kind))} apre a ${l.needs} cittadini (ora ${l.now}).`,
  coins: (l) => `Metti da parte: ${theKind(l.kind)} costa ${l.cost} monete (ora ${l.now}). Le case pagano le tasse ogni minuto.`
} satisfies Wording<GuideLocked>

/** The next step that waits for the town to need it: what it will ask for, and when it comes. */
const below = (id: GoodId, s: { readonly below: number; readonly now: number }) =>
  `quando ${theGood(id)} ${verb(id, "scende", "scendono")} sotto ${s.below} (ora ${s.now})`
const upcoming = {
  lumberjack: (s) => `Poi: ${aKind("lumberjack")} e ${aKind("sawmill")}, ${below("planks", s)}.`,
  sawmill: (s) => `Poi: ${aKind("sawmill")}, ${below("planks", s)}.`,
  quarry: (s) => `Poi: ${aKind("quarry")}, ${below("stone", s)}.`
} satisfies Wording<GuideSoon>

export const guide = { chapters, steps, waiting, locked, upcoming } satisfies typeof English
