/**
 * Italian for the page itself (`ui/dom` and what starts it, `app/browser.ts`):
 * its buttons, headings, tooltips, dialogs, and the chips a message's tokens
 * become. The same entries as English, part for part (`satisfies` holds it
 * to them).
 *
 * As in English, what a part shows through markup may hold tokens, what it
 * sets as plain text is words alone, and a sentence with the page's own
 * markup set into it takes each piece as a string and says where it goes.
 * Italian orders some of them its own way, and turns a sentence where an
 * English one would need an agreement the page cannot know (a good's gender
 * in a slot, a building's in a status).
 *
 * Every building, good, home, and rank is named through `nouns.ts`, and its
 * article, preposition, pronoun, and participle bent to it by `grammar.ts`:
 * none is written out beside a name it might not agree with.
 */
import { COMMUTE, home, mood, park, TOWN_RANK, type Category, type GoodId, type GroundId, type KindId, type LandId, type PropId, type SizeId, type Tier, type WinterId } from "../../game/content/index.ts"
import type { Status } from "../../game/schema.ts"
import type { Trouble } from "../../platform/save.ts"
import type { Offered, ShareFailure } from "../../platform/share/client.ts"
import type { Panel } from "../../view/contracts.ts"
import type { page as English } from "../en/page.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { a, agree, capital, count, f, form, m, signed, the, theMany, to, toMany, type Noun, type Preposition } from "./grammar.ts"
import { built, goods, grounds, lands, names, props, quantity, rankNoun, sizes, tiers, winters } from "./nouns.ts"
import { amount } from "./said.ts"

/** A number with its sign as a slider or a chip shows it: "+4", "-4", "0". */
const plus = (n: number) => `${n > 0 ? "+" : ""}${n}`
/** A number that may have a fraction, with Italian's comma: "2,5", "0,05". */
const figure = (n: number) => `${n}`.replace(".", ",")

/** A building's noun, as built or at a level of its upgrades. */
const kind = (id: KindId, level = 0): Noun => built(id, level).noun

// A good as the town speaks of it is in one number: what comes in pieces is many ("le tavole"), the rest is one ("il pane").
// Its article, a preposition joined to it, the pronoun that stands for it, and a participle said of it all follow that.
/** "le tavole", "il pane", "gli attrezzi". */
const theGood = (id: GoodId): string => (goods[id].counted ? theMany(goods[id]) : the(goods[id]))
/** "dalle tavole", "dal legname", "agli attrezzi". */
const toGood = (preposition: Preposition, id: GoodId): string => (goods[id].counted ? toMany(preposition, goods[id]) : to(preposition, goods[id]))
/** The pronoun for a good: "lo", "la", "li", "le". After a verb's stem it is joined: "comprar" + "li". */
const them = (id: GoodId): string => (goods[id].counted ? agree(goods[id], "li", "le") : agree(goods[id], "lo", "la"))
/** A participle said of a good: "portat" gives "portato", "portata", "portati", "portate". */
const done = (id: GoodId, stem: string): string => `${stem}${goods[id].counted ? agree(goods[id], "i", "e") : agree(goods[id], "o", "a")}`
/** A verb said of a good, in the good's number: "serve" or "servono", "arriva" or "arrivano". */
const verb = (id: GoodId, one: string, many: string): string => (goods[id].counted ? many : one)
/** "there is not enough" of a good, in its number: "non c'è abbastanza pane", "non ci sono abbastanza tavole". */
const notEnough = (id: GoodId, yet: boolean): string =>
  `${goods[id].counted ? `Non ci sono${yet ? " ancora" : ""}` : `Non c'è${yet ? " ancora" : ""}`} abbastanza ${goods[id].name}`

const settlers = tiers[1].people, citizens = tiers[2].people, burghers = tiers[3].people
const cottage = tiers[1].home, citizensHome = tiers[2].home, townhouse = tiers[3].home
const winter = m("inverno", "inverni"), missed = f("richiesta mancata", "richieste mancate"), cell = f("casella", "caselle")
/** "manca" of one thing, "mancano" of more. */
const lacking = (n: number) => (n === 1 ? "manca" : "mancano")

/** What the bar a held stroke waits at calls its button: the messages that send a finger to it name it by this. */
const lay = "Posa"

/** A workplace short of its crew, as the view names it. */
interface ShortPlace {
  readonly title: string
  readonly assigned: number
  readonly needed: number
  readonly nobodyNear: boolean
}

/** A warning over the town: what it is, in a word or two, and what it says. */
const warning = (lead: string, text: string) => ({ lead, text })

/** Asking before something that replaces the town: the question, what it means, and its two ways on. */
const leave = (title: string, text: string, saveThen: string, without: string) => ({ title, text, saveThen, without })

/** A land in words: "terra media e discreta". */
const landOf = (size: SizeId, land: LandId) => `terra ${sizes[size]} e ${lands[land].name}`

export const page = {
  /** What a building's chip in a message says on hover. */
  chips: {
    goTo: (id: KindId): string => `Vai ${to("a", kind(id))}`,
    /** A row that places a building, on hover. */
    place: (id: KindId): string => `Costruisci ${a(kind(id))}`,
    build: (id: KindId): string => `Costruisci ${a(kind(id))}: ${built(id).blurb}`
  },
  /** How long ago a save was made, roughly. */
  ago: {
    now: "proprio ora",
    minutes: (n: number): string => `${n} min fa`,
    hours: (n: number): string => `${n} h fa`,
    yesterday: "ieri",
    days: (n: number): string => `${n} giorni fa`
  },
  /** Words more than one part of the page says. */
  common: {
    close: "Chiudi",
    closeEsc: "Chiudi (Esc)",
    cancel: "Annulla",
    /** A section's ⓘ. */
    whatThisMeans: "Che cosa significa",
    showWhere: "Mostrami dove",
    dismiss: "Ignora",
    coins: "monete"
  },

  // ── The map and its tools ───────────────────────────────────────────────

  /** What picking something to put on the map says, and the bar a held stroke waits at. */
  map: {
    place: (id: KindId): string => {
      const what = kind(id)
      return token.device(`Tocca un punto per ${the(what)}, poi toccalo di nuovo per ${agree(what, "costruirlo", "costruirla")}`, `Clicca per posare ${a(what)} · Esc per smettere`)
    },
    layGround: (id: GroundId): string => {
      const what = grounds[id].noun
      return token.device(`Trascina un rettangolo per stendere ${the(what)}, poi tocca ${lay}`, `Trascina un rettangolo per stendere ${the(what)} · Esc per smettere`)
    },
    furnish: (id: PropId): string => {
      const what = props[id].noun
      return token.device(`Tocca una casella di parco per ${the(what)}, poi toccala di nuovo per ${agree(what, "posarlo", "posarla")}`, `Clicca una casella di parco per posare ${a(what)} · Esc per smettere`)
    },
    /** A touch tap that holds what it would do: tapped again, it does it. What it would remove is not known here, so neither says "it". */
    tapAgain: { remove: "tocca di nuovo per demolire", build: "tocca di nuovo per costruire qui" },
    overlays: "Viste della mappa",
    stroke: { build: lay, cancel: "Annulla" }
  },
  toolbar: {
    town: { label: "paese", title: "Obiettivi, numeri, tasse e commercio del paese (T)" },
    more: "Condividi, la guida, salva, carica, nuovo paese",
    pause: "Metti in pausa il paese, o fallo ripartire (spazio)",
    /** A speed's button: "Fai andare il paese a 2× (2)". */
    runAt: (speed: string, key: string): string => `Fai andare il paese a ${speed} (${key})`,
    cycle: "Cambia velocità: 1×, 2×, 4×",
    /** The pause switch, read aloud: what pressing it does now. */
    run: "Fai ripartire il paese",
    pauseNow: "Metti in pausa il paese",
    runAtLast: (last: number): string => `Fai andare il paese a ${last}×`
  },
  mapViews: {
    title: "viste della mappa",
    help: "Colora la mappa secondo una di queste, per vedere dove il paese va bene o male. Premi di nuovo il tasto (o clicca) per nasconderla.",
    // A view's label is a bare noun ("attrattiva", "incendi"): it is named as a view, so no article has to agree with it.
    show: (label: string, key: string): string => `Mostra sulla mappa la vista «${label}» (${key}); di nuovo per nasconderla`
  },
  /** Share, the guide, save, load, and new town: each button's label and what it says on hover. */
  system: {
    share: { label: "condividi", tip: "Condividi un'immagine del paese, o un link che chiunque può aprire per guardarlo e continuare a giocare" },
    guide: {
      label: "guida",
      tip: "Accendi o spegni la guida: dice a un nuovo sindaco che cosa fare dopo, e perché",
      turnOn: "Riaccendi la guida: il prossimo passo da fare, e perché, in cima al notiziario",
      turnOff: "Spegni la guida"
    },
    language: { label: "lingua", tip: "Scegli la lingua in cui si legge il paese" },
    save: { label: "salva", tip: "Salva il paese in questo browser (si salva anche da solo ogni due minuti)" },
    load: { label: "carica", tip: "Carica l'ultimo salvataggio: il tuo o quello automatico, il più recente dei due" },
    newTown: { label: "nuovo paese", tip: "Fonda un nuovo paese su una nuova terra" },
    recentre: { label: "ricentra", tip: "Torna all'angolo e al centro di partenza" },
    leave: {
      load: leave("caricare l'ultimo salvataggio?", "Il paese com'è ora viene sostituito dall'ultimo salvataggio (il tuo o quello automatico).", "Salva, poi carica", "Carica senza salvare"),
      newTown: leave("fondare un nuovo paese?", "Questo paese è perso per sempre, a meno di salvarlo prima.", "Salva, poi scegli una nuova terra", "Scegli una nuova terra senza salvare"),
      stay: "Continua a giocare"
    }
  },
  /** The camera bar in the map's corner (the renderer draws it): its two drag modes, the zoom, and the way back. */
  camera: {
    label: "Visuale della mappa",
    pan: { label: "Sposta", title: "Trascina per spostarti; gli strumenti strada, selciato, case e terreno del parco trascinano per costruire" },
    rotate: { label: "Ruota", title: "Trascina per ruotare invece di posare. Anche il trascinamento con il tasto destro ruota, e Q ed E girano di un ottavo." },
    zoomOut: "Riduci lo zoom",
    zoom: "Zoom della visuale",
    zoomIn: "Aumenta lo zoom",
    reset: { label: "Ripristina la visuale", title: "Angolo e centro di partenza (Home)" }
  },
  /** Choosing the language: every language is listed by its own name, so only what is around the list is said here. */
  language: {
    /** On the language now in use, read aloud. */
    current: (name: string): string => `${name} (in uso)`,
    /** The browser would not keep the choice, so the page stays as it is. */
    notKept: "Questo browser non ha conservato la scelta, quindi la lingua resta com'è"
  },
  /** The maker's credit: what each link is, read aloud. */
  credit: {
    typeonce: "Typeonce Games: altri giochi dall'autore di Inkline Town",
    ritmo: "ritmo su GitHub: il runtime ECS con cui è fatto Inkline Town",
    madeWith: "Fatto con",
    madeBy: "Fatto da Typeonce",
    newTab: (label: string): string => `${label} (si apre in una nuova scheda)`
  },

  // ── The heads-up display ────────────────────────────────────────────────

  hud: {
    /** What each good is for: who makes it, who takes it. */
    goods: {
      wood: `${theMany(kind("lumberjack"))} ${them("wood")} abbattono; ${a(kind("sawmill"))} ${them("wood")} sega in ${goods.planks.name}`,
      planks: `ciò con cui si costruiscono case ed edifici: ${a(kind("sawmill"))} ${them("planks")} ricava ${toGood("da", "wood")}`,
      stone: `per costruire e lastricare: ${theMany(kind("quarry"))} ${them("stone")} tagliano dalle rocce, che si esauriscono`,
      ore: `solo per ${theGood("tools")}: quando il paese ha 10 ${citizens.other}, ${a(kind("mine"))} ${them("ore")} estrae dai giacimenti color ruggine, e ${a(kind("smithy"))} ${them("ore")} forgia in ${goods.tools.name}`,
      tools: `per costruire, e le botteghe ne consumano ${agree(goods.tools, "uno", "una")} ogni 50 o 60 lavori: ${a(kind("smithy"))} ${them("tools")} forgia, oppure compra${them("tools")}`,
      fish: `cibo per ${theMany(settlers)}: ${theMany(kind("fishery"))} ${them("fish")} pescano vicino all'acqua; va a male in circa tre minuti`,
      smoked: `${goods.fish.name} che dura tutto l'inverno: ${a(kind("smokehouse"))} ${them("fish")} affumica`,
      wheat: `${theMany(kind("farm"))} ${them("wheat")} coltivano; ${a(kind("mill"))} ${them("wheat")} macina in ${goods.flour.name} (non d'inverno)`,
      flour: `viene ${to("da", kind("mill"))}; ${a(kind("bakery"))} ${them("flour")} cuoce in ${goods.bread.name}`,
      bread: `cibo di cui ${theMany(citizens)} hanno bisogno, e ${a(cottage)} con ${theGood("bread")} paga la metà in più: va a male in circa cinque minuti`,
      wool: `${theMany(kind("sheep"))} ${them("wool")} tosano; ${a(kind("weaver"))} ${them("wool")} tesse in ${goods.cloth.name}`,
      cloth: `${verb("cloth", "serve", "servono")} ${toMany("a", citizens)}: ${verb("cloth", "viene", "vengono")} ${done("cloth", "portat")} solo nelle vie con attrattiva 5 o più`,
      furniture: `${verb("furniture", "serve", "servono")} ${toMany("a", burghers)} nelle loro ${townhouse.other}: ${a(kind("carpenter"))} ${them("furniture")} fa con ${theGood("planks")}; ${verb("furniture", "viene", "vengono")} ${done("furniture", "portat")} solo nelle vie abbastanza belle per ${theMany(townhouse)}`
    } satisfies Record<GoodId, string>,
    /** A good and what it is for: "tavole: ciò con cui si costruiscono case ed edifici…". */
    good: (name: string, help: string): string => `${name}: ${help}`,
    /** A good's last minute, under what it is for. Said in nouns (what was made, what was used), so nothing has to agree with the good. */
    goodFlow: (flow: { readonly made: number; readonly used: number; readonly traded: number; readonly stock: number; readonly elsewhere: number }): string =>
      `Ultimo minuto: produzione ${flow.made}, consumo ${flow.used}${flow.traded !== 0 ? `, ${flow.traded > 0 ? "acquisti" : "vendite"} ${Math.abs(flow.traded)}` : ""}. ${flow.stock} in magazzino, ${flow.elsewhere} in giro per il paese (in botteghe e mercati, e per strada).`,
    stock: "Le merci nel magazzino del paese, e come va ciascuna · clicca per vedere che cosa il paese produce e usa",
    goodsChip: "Le merci in magazzino",
    folk: "Apri i numeri, gli obiettivi e le leve del paese (T)",
    treasury: {
      plain: "Monete nel tesoro, e quanto guadagna (o perde) al minuto al ritmo attuale · clicca per l'ultimo minuto del paese",
      counted: (flow: { readonly change: number; readonly made: number; readonly used: number; readonly traded: number; readonly net: number }): string =>
        `Monete nel tesoro · clicca per l'ultimo minuto del paese\nUltimo minuto: ${signed(flow.change)} (entrate ${flow.made}, uscite ${flow.used}${flow.traded !== 0 ? `, commercio ${signed(flow.traded)}` : ""})\nAl ritmo attuale: ${signed(flow.net)}/min (tasse, commercio, mantenimento, amministrazione)`
    },
    clock: {
      paused: "in pausa",
      /** Under the clock: "anno 2 · inverno tra 3:20 (rigido)". `until` is one of the three below. */
      year: (year: number, until: string): string => `anno ${year} · ${until}`,
      // Under the clock there is one short line: how much longer the winter lasts says when spring comes, in fewer letters.
      winter: (severity: WinterId, spring: string): string => `${winter.one} ${winters[severity]} · ancora ${spring}`,
      winterIn: (left: string, coming: WinterId): string => `${winter.one} tra ${left} (${winters[coming]})`,
      noMoreWinters: "nessun altro inverno",
      /** The clock on hover: the season, the almanac's next two winters (`null`: beyond the term), and what each kind does to a catch (percent). */
      title: (c: { readonly winter: boolean; readonly coming: WinterId | null; readonly after: WinterId | null; readonly fishing: Readonly<Record<WinterId, number>> }): string =>
        `${c.winter ? "Inverno: i campi riposano, la pesca è lenta e le case mangiano più in fretta" : "Tempo rimasto nel mandato"}\nL'almanacco: il prossimo inverno è ${c.coming === null ? "oltre il mandato" : winters[c.coming]}, quello dopo ${c.after === null ? "oltre il mandato" : winters[c.after]}.\n${capital(winters.mild)}: pesca al ${c.fishing.mild}%. ${capital(winters.normal)}: ${c.fishing.normal}%. ${capital(winters.hard)}: dura una volta e mezza, pesca al ${c.fishing.hard}%, e le case che si scaldano sono a rischio d'incendio.`
    },
    approval: "consenso",
    settlers: settlers.other,
    citizens: citizens.other,
    /** Beside the citizens, once there are any: "· 12 borghesi". */
    burghers: (n: number): string => count(n, burghers),
    jobs: {
      short: (n: number): string => `${lacking(n)} ${n} · clicca`,
      filled: "posti coperti",
      filledTitle: `Lavoratori al lavoro su lavoratori richiesti: ogni luogo di lavoro ha la sua squadra. Gli abitanti fanno al massimo ${COMMUTE} caselle di strada per andare al lavoro.`,
      /** How many workplaces are short, and the first few of them. */
      shortTitle: (n: number, places: ReadonlyArray<ShortPlace>): string =>
        `Lavoratori al lavoro su lavoratori richiesti. ${n > 1 ? `A ${n} luoghi di lavoro` : "A un luogo di lavoro"} mancano lavoratori: ${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? ` (nessuna casa entro ${COMMUTE} caselle di strada)` : ""}`).join(", ")}. Clicca per visitarli uno alla volta.`
    },
    /** The goods' last minute, side by side: each column, and what it counts. */
    flow: {
      counting: "Si contano le merci del paese: i primi numeri arrivano tra mezzo minuto…",
      made: { label: "fatto", title: "Prodotto da botteghe e raccoglitori nell'ultimo minuto" },
      used: { label: "usato", title: "Mangiato, lavorato, usato per costruire, andato a male o spedito via nell'ultimo minuto" },
      traded: { label: "scambi", title: "Comprato (+) o venduto (−) nell'ultimo minuto" },
      storage: { label: "magazzino", title: `${capital(to("in", kind("townhall")))}, ${toMany("in", kind("warehouse"))} e ${toMany("in", kind("granary"))}` },
      about: { label: "in giro", title: `Nelle botteghe e ${toMany("in", kind("market"))}, nelle ceste degli ambulanti e nelle casse dei portatori` }
    },
    /** The crown's request: `amount` and `good` are set in bold, the good with its icon. */
    crown: {
      // The good comes first, the number after it: "20 tavole" but "20 di farina", and the page hands the two as separate pieces.
      asks: (amount: string, good: string): string => `la corona chiede ${good}: ${amount}`,
      inStore: (n: number): string => `${n} in magazzino`,
      /** What is in store (coloured by whether it is enough), when it is due (bold), and what it pays. */
      terms: (inStore: string, due: string, reward: string): string => `${inStore} · scade tra ${due} · ${reward}`,
      reward: (coins: number): string => amount.coins(coins, true),
      send: "invia",
      sendTitle: (good: GoodId, n: number, reward: number): string => `Invia ${quantity(good, n)} alla corona per ${amount.coins(reward)}`,
      notEnough: (good: GoodId): string => `${notEnough(good, true)} in magazzino`
    },
    /** What threatens the term, or is about to raise the town a rank: `left` is a clock. */
    warnings: {
      bankruptIn: (left: string) => warning("In debito:", `bancarotta tra ${left} se il tesoro non si riprende`),
      debt: warning("In debito:", "i salari non vengono pagati"),
      revoltIn: (left: string) => warning("Tumulto:", `il paese caccia il sindaco tra ${left}`),
      restless: warning("Malcontento:", "il consenso scende verso la rivolta"),
      emptying: warning("Si svuota:", "la gente sta lasciando il paese"),
      patience: (streak: number) => warning("La pazienza della corona:", `${count(streak, missed)} di fila; ancora una e il sindaco è destituito`),
      /** Every goal of the next rank (`to`) is met and holding. */
      rises: (next: number, left: string) => warning("Ogni obiettivo raggiunto:", `il paese diventa ${a(rankNoun(next))} tra ${left}`)
    }
  },

  // ── The ticker ──────────────────────────────────────────────────────────

  ticker: {
    bulb: "La guida, e ciò che richiede attenzione ora",
    tucked: "La guida è nella lampadina in alto a destra",
    guideOff: "Guida spenta · riaccendila in basso a destra",
    /** How long ago a piece of news happened, in the town's own time. */
    ago: {
      now: "proprio ora",
      seconds: (n: number): string => `${n} s fa`,
      minutes: (n: number): string => `${n} min fa`
    },
    /** The guide's heading: "guida · Fondazione". */
    guide: (chapter: string): string => `guida · ${chapter}`,
    step: (at: number, of: number): string => `passo ${at} di ${of}`,
    firstSteps: "I primi passi di un nuovo paese",
    hide: "spegni guida",
    hideTitle: "Spegni la guida (il pulsante della guida in basso a destra la riaccende)",
    /** Under a step: what closes it. `goal` is the step's own words. */
    doneWhen: (goal: string): string => `fatto quando ${goal}`,
    skip: "Salta questo passo",
    tuck: "Nascondi: la guida resta nella lampadina in alto a destra",
    now: "ora",
    lately: "da poco"
  },

  // ── The panels ──────────────────────────────────────────────────────────

  town: {
    title: "paese",
    /** Under the heading: "terra media e discreta · un villaggio · mandato 2, 60 minuti". */
    sub: (c: { readonly size: SizeId; readonly land: LandId; readonly rank: number; readonly term: number; readonly minutes: number }): string =>
      `${landOf(c.size, c.land)} · ${a(rankNoun(c.rank))} · mandato ${c.term}, ${c.minutes} minuti`,
    seed: (seed: number): string => `seme ${seed}`,
    goals: {
      title: "obiettivi",
      help: `Il paese cresce da ${rankNoun(0).one} a ${rankNoun(1).one}, ${rankNoun(2).one} e ${rankNoun(3).one}. Raggiungi insieme tutti gli obiettivi del rango successivo e mantienili per due minuti: la corona manda una ricompensa, e il gioco continua. Un rango non si perde mai.`,
      top: (now: number): string => `${capital(a(rankNoun(now)))}, il rango più alto: ${agree(rankNoun(now), "tienilo", "tienila")} in piedi, mandato dopo mandato.`,
      holding: (now: number, left: string): string => `Tutti raggiunti: mantienili ancora ${left} e ${the(rankNoun(now))} diventa ${a(rankNoun(now + 1))}.`,
      toward: (now: number): string => `${capital(a(rankNoun(now)))} per ora: questi ne fanno ${a(rankNoun(now + 1))}.`
    },
    approval: {
      title: "consenso",
      help: "Le case ospitano più abitanti quando il consenso è alto e meno quando è basso. A −50 per due minuti, il paese caccia il sindaco.",
      heading: "ora → verso"
    },
    treasury: {
      title: "tesoro",
      help: `Monete al minuto. Le tasse vengono solo dalle case sfamate, in proporzione ai bisogni che hanno soddisfatto. L'amministrazione si calcola per casa e cresce più in fretta del paese: in un paese grande ${agree(cottage, "un altro", "un'altra")} ${cottage.one} costa più o meno quanto paga, mentre ${a(citizensHome)} o ${a(townhouse)} ospita due o tre volte le persone allo stesso costo. Tre minuti in debito e il paese è in bancarotta.`,
      taxes: "tasse",
      supplied: "se ogni casa fosse rifornita",
      trade: "commercio",
      upkeep: "mantenimento",
      admin: "amministrazione",
      net: "al minuto",
      /** The sum of the above, with its sign: "+12 monete". */
      netCoins: (n: number): string => amount.coins(n, true),
      leftOnTable: (gap: number): string => `${amount.rate(gap)} lasciate sul tavolo: una casa affamata non paga nulla, ${a(cottage)} con ${theGood("bread")} paga la metà in più, una bella via un quarto in più`
    },
    taxes: {
      title: "aliquote",
      help: `Tasse più basse alzano il consenso, più alte lo abbassano, in proporzione a quanti abitanti ha ogni ceto. Sopra il 100% alcuni abitanti se ne vanno, ${theMany(settlers)} prima ${toMany("di", citizens)}, quindi un'aliquota più alta non sempre rende di più: sotto ogni aliquota c'è quanto pagherebbero le case a ogni scatto, una volta assestate. Sopra il ${mood.grudge.above}% il paese cova anche un rancore che dura più dell'aliquota: tagliare le tasse alla fine non cancella un mandato passato a spremere.`,
      slider: "Trascina per fissare l'aliquota; doppio clic per il solito 100%",
      /** What a rate does to approval (`sway`: 0 at the usual rate), and whether it is high enough to leave a grudge. */
      effect: (sway: number, grudge: boolean): string =>
        `${sway === 0 ? "l'aliquota solita" : `${signed(sway)} consenso`}${grudge ? " · finché resta così alta cresce un rancore, che svanisce lentamente" : ""}`,
      /** Taxes a minute at each step of the rate, and the step that brings in most. */
      outlook: (steps: ReadonlyArray<{ readonly rate: number; readonly taxes: number }>, best: number): string =>
        `tasse al minuto, a regime: ${steps.map((o) => `${o.rate}% ${o.taxes}`).join(" · ")} · il massimo al ${best}%`,
      outlookTitle: "Tasse al minuto da tutte le case se l'aliquota restasse lì e le case si assestassero: sopra il 100% gli abitanti se ne vanno, e il consenso segue l'aliquota"
    },
    people: {
      title: "abitanti",
      settlers: settlers.other,
      citizens: citizens.other,
      burghers: `di cui ${burghers.other}`,
      homes: "case",
      jobs: "posti coperti",
      jobsOf: (employed: number, jobs: number): string => `${employed} di ${jobs}`,
      staffed: "ogni luogo di lavoro ha la sua squadra",
      /** How many workplaces are short, the first few (`more`: there are others), and where to find them. */
      short: (n: number, places: ReadonlyArray<ShortPlace>, more: boolean): string =>
        `${n} a corto di lavoratori: ${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? " (nessuno a portata)" : ""}`).join(", ")}${more ? ", …" : ""} · clicca il contatore dei posti per visitarli`
    },
    needs: {
      title: "case rifornite",
      help: `Una casa affamata non paga tasse. ${capital(toMany("a", settlers))} serve cibo (${goods.fish.name}, ${goods.smoked.name} o ${goods.bread.name}) da ${a(kind("market"))}, e ${a(cottage)} che ha anche ${theGood("bread")} paga la metà in più; una visita dà a una casa un pesce o una pagnotta ogni quattro abitanti, così ${a(citizensHome)} mangia il doppio di ${a(cottage)} e ${a(townhouse)} il triplo; a ${citizens.other} e ${burghers.other} servono ${goods.bread.name}, ${goods.cloth.name} e fede, e ${toMany("a", burghers)} anche ${theGood("furniture")} di ${a(kind("carpenter"))}. ${capital(theGood("cloth"))} ${verb("cloth", "arriva", "arrivano")} solo nelle vie con attrattiva 5 o più, ${theGood("furniture")} solo in quelle con 12 o più. ${capital(theGood("fish"))} va a male in circa tre minuti e ${theGood("bread")} in cinque; ${a(kind("granary"))} li fa durare cinque volte più a lungo.`,
      larder: "cibo in magazzino",
      eaten: "mangiato · andato a male nell'ultimo minuto",
      trouble: "case malate · in fiamme"
    },
    crown: {
      title: "la corona",
      help: "Inviare ciò che la corona chiede frutta monete. Una richiesta mancata è una multa, e il paese ricorda l'affronto per un po'; troppe mancate di fila e la corona destituisce il sindaco.",
      tally: "richieste esaudite · mancate",
      /** An open request: `what` (so many of a good) is set in bold. */
      wants: (what: string, left: string, reward: string): string => `Vuole ${what} · restano ${left} · ${reward}`,
      what: (good: GoodId, n: number): string => quantity(good, n),
      reward: (coins: number): string => amount.coins(coins, true),
      next: (left: string, patience: number): string => `Prossima richiesta tra ${left} · ${patience} mancate di fila chiudono il mandato`
    },
    trade: {
      title: "merci e commercio",
      help: "I mercanti passano ogni pochi secondi. Trascina il cursore di una merce a sinistra per venderla oltre ciò che il paese tiene, a destra per comprarla fino a quel livello (a una volta e mezza il prezzo): più lo sposti, più ne passa a ogni visita; al centro non si vende né si compra. I prezzi scendono quando il paese vende e salgono, tre volte più in fretta, quando compra; un prezzo caro si calma solo lentamente, così comprare colma un ammanco, ma un paese nutrito di cibo comprato paga di più ogni minuto.",
      keep: "tieni in magazzino",
      keepTitle: "Quanto il paese tiene di ogni merce: vende solo oltre questa soglia, e compra solo fino a questa",
      keepNote: "di ogni merce: si vende solo sopra, si compra solo fino a qui",
      deal: (good: GoodId): string => `Trascina a sinistra per vendere ${theGood(good)}, a destra per comprar${them(good)}; più lontano, più ne passa a ogni visita dei mercanti. Doppio clic per smettere di commerciar${them(good)}.`,
      /** What a good's slider is set to: nothing, or the most it sells or buys a minute. */
      none: "non scambia",
      sell: (most: number): string => `vendi ≤${most}/min`,
      buy: (most: number): string => `compra ≤${most}/min`,
      /** A good's price in coins ("m", for monete), and (when it is not the usual) in percent of the usual: "3,5m (120%)". */
      price: (coins: number, percent: number | null): string => `${figure(coins)}m${percent === null ? "" : ` (${percent}%)`}`,
      asks: "quanto chiedono i mercanti per unità",
      pays: "quanto pagano i mercanti per unità"
    },
    chronicle: "cronaca"
  },
  build: {
    title: "costruisci",
    sub: token.device("Scegline uno, poi tocca la mappa dove va", "Scegline uno, poi clicca la mappa · Esc per smettere"),
    categories: { storage: "magazzini", gathering: "raccolta", crafts: "botteghe", food: "cibo", services: "servizi" } satisfies Record<Category, string>,
    cost: "costo",
    does: "fa",
    /** What keeps the town from building something yet, in place of what it is for. */
    needsResidents: (n: number): string => `servono ${n} abitanti`,
    needsCitizens: (n: number): string => `servono ${n} ${citizens.other}`,
    /** What each of a building's chips says on hover. */
    recipe: (r: { readonly input: GoodId | null; readonly inputs: number; readonly output: GoodId; readonly batch: number; readonly seconds: number }): string =>
      `${r.input ? `trasforma ${quantity(r.input, r.inputs)} in ${quantity(r.output, r.batch)}` : `produce ${quantity(r.output, r.batch)}`} ogni ${figure(r.seconds)} s`,
    serves: (range: number): string => `i suoi ambulanti servono le case entro ${range} caselle di strada dalla sua porta`,
    holds: (cap: number, keeps: number | null): string => `contiene fino a ${cap} di ogni merce${keeps === null ? "" : `, e fa durare il cibo ${keeps} volte più a lungo`}`,
    // "to work it" would need the building's gender: "per lavorarci" (to work there) needs none.
    crew: (workers: number, tier: Tier): string => `${count(workers, tiers[tier].people)} per lavorarci, da case entro ${COMMUTE} caselle di strada`,
    appeal: (value: number, reach: number): string => `attrattiva ${plus(value)} accanto, fino a ${count(reach, cell)}${value < 0 ? ": tieni lontane le case" : ": alle case piace"}`,
    upkeep: "mantenimento: monete al minuto finché sta in piedi (un quarto quando è in pausa)",
    /** A building's whole line on hover: what it is, who works it, how far it reaches, what it does to its street, and what it costs to keep. */
    option: (id: KindId, k: { readonly workers: number; readonly citizens: boolean; readonly range: number | null; readonly appeal: { readonly value: number; readonly reach: number } | null; readonly upkeep: number }): string =>
      `${names.kind.title(id)}: ${built(id).blurb}${k.workers > 0 ? ` · ${count(k.workers, k.citizens ? citizens : settlers)} al lavoro, da entro ${COMMUTE} caselle di strada` : ""}${k.range === null ? "" : ` · gli ambulanti arrivano a ${k.range} caselle di strada`}${k.appeal ? ` · attrattiva ${plus(k.appeal.value)} fino a ${count(k.appeal.reach, cell)}` : ""} · ${amount.rate(k.upkeep)}`,
    parks: {
      title: "parchi",
      help: `Stendi il terreno, poi posaci sopra gli arredi. Il terreno che si tocca è un solo parco: più ne contiene, più belle sono le vie intorno (${toMany("a", citizens)} serve ${home.tiers[2].appeal}, ${toMany("a", townhouse)} ${home.tiers[3].appeal}). Conta un arredo ogni ${park.cellsPerProp} caselle; dove i parchi si incontrano, il più bello conta per intero.`,
      ground: "terreno · trascina un rettangolo",
      furnishings: "arredi · clicca una casella di parco",
      beauty: "bellezza che aggiunge al suo parco",
      upkeep: "mantenimento, monete al minuto",
      /** A park piece's whole line on hover: `name` and `blurb` are its own. */
      piece: (name: string, blurb: string, p: { readonly beauty: number; readonly upkeep: number; readonly ground: boolean }): string =>
        `${name}: ${blurb} · bellezza +${figure(p.beauty)}${p.ground ? " a casella" : ""} · ${figure(p.upkeep)} monete al minuto`
    }
  },
  /** The panel of what is picked: a building, a home, a park, or a ruin. */
  selection: {
    park: "parco",
    ruin: "rovina",
    /** Under the heading: who lives in a home of each tier, and what a ruin or a park is for. */
    home: {
      1: `qui vivono ${theMany(settlers)}, che fanno i lavori pesanti`,
      2: `qui vivono ${theMany(citizens)}, che fanno i lavori di mestiere e pagano il doppio`,
      3: `qui vivono ${theMany(burghers)}, che pagano le tasse migliori`
    } satisfies Record<Tier, string>,
    aboutRuin: "demoliscila per liberare il lotto",
    aboutPark: "ogni casella di terreno che tocca questa: stendine altre, o posaci degli arredi, per rendere più belle le vie intorno",
    status: "stato",
    /** How a building is, in a word, when nothing is wrong with it: phrases that agree with no building, whatever its gender. */
    statuses: {
      building: "in costruzione",
      idle: "a riposo",
      working: "al lavoro",
      starved: "senza rifornimenti",
      blocked: "senza sbocco",
      unstaffed: "senza lavoratori",
      unconnected: "senza strada",
      paused: "in pausa"
    } satisfies Record<Status, string>,
    // Said of the ruin ("rovina", above): feminine.
    causes: { burnt: "bruciata", collapsed: "crollata", derelict: "abbandonata" } satisfies Record<Extract<Panel, { readonly type: "ruin" }>["cause"], string>,
    /** A park's worth in a word: the desirability it gives, and how far. */
    parkWorth: (value: number, reach: number): string => `${plus(value)} fino a ${count(reach, cell)}`,
    whatMakesIt: "di che cosa è fatto",
    whatIsLeft: "che cosa resta",
    pause: "Ferma il lavoro",
    resume: "Riprendi il lavoro",
    pauseTitle: "Un edificio in pausa non ha lavoratori e paga un quarto del mantenimento",
    closeHome: "Chiudi la casa",
    reopenHome: "Riapri la casa",
    closeTitle: `Una casa chiusa resta vuota: niente tasse, e nessun costo per l'amministrazione ${to("di", kind("townhall"))}. Riaprila e ${theMany(settlers)} tornano.`,
    remove: "Rimuovi"
  },
  /** What upgrading a building would cost and give: `to` is the level it would stand at. */
  upgrade: {
    title: (id: KindId, level: number): string => `ampliamento in ${kind(id, level).one}`,
    begin: (id: KindId, level: number): string => `Avvia ${the(kind(id, level))}`,
    needed: (why: string): string => `serve ora: ${why}`,
    notNeeded: "non serve ancora: la freccia dorata indica quando",
    pay: "paghi",
    get: "ottieni",
    now: "ora, per iniziare",
    price: (coins: number): string => token.coins(coins),
    short: (coins: number): string => `${lacking(coins)} ${token.coins(coins)}`,
    later: "poi, in arrivo",
    lacks: (short: ReadonlyArray<{ readonly good: GoodId; readonly count: number }>): string =>
      `al magazzino ${lacking(short.reduce((n, l) => n + l.count, 0))} ${short.map((l) => token.amount(l.good, l.count)).join(", ")}: i lavori aspettano`,
    fromStore: "dal magazzino: i lavori procedono man mano che arrivano",
    upkeepAfter: "mantenimento dopo",
    goesOn: "continua a lavorare mentre i lavori vanno avanti, e le impalcature salgono dentro il suo lotto"
  },

  // ── The sheets ──────────────────────────────────────────────────────────

  /** Founding a town: the charter. */
  charter: {
    by: "di",
    sub: "Scegli la terra, poi fai crescere il paese fino al suo obiettivo prima che finisca il mandato.",
    land: {
      title: "terra",
      /** What a land of this size asks of a town: each figure is a chip. */
      note: (residents: string, income: string): string => `${a(rankNoun(TOWN_RANK))} a ${residents}${income}`,
      residents: (n: number): string => `${n} abitanti`,
      income: (coins: number): string => `+${coins}/min`,
      tip: (residents: number, income: number): string =>
        `Il rango di ${rankNoun(TOWN_RANK).one} chiede ${residents} abitanti e un'entrata di ${amount.rate(income)}; ${a(rankNoun(TOWN_RANK - 1))} meno, ${a(rankNoun(TOWN_RANK + 1))} di più`
    },
    term: {
      title: "mandato",
      label: (minutes: number): string => `${minutes} min`,
      years: (years: number, minutes: number): string => `${years} anni da ${figure(minutes)} min`,
      winters: (n: number): string => count(n, winter),
      tip: (minutes: number, years: number): string => `${minutes} minuti a 1×: ${years} anni, con un inverno alla fine di ciascuno dopo il primo`
    },
    richness: {
      title: "ricchezza",
      coins: (n: number): string => `${amount.coins(n)} per iniziare`
    },
    reroll: "↻ altra terra",
    rerollTitle: (seed: number): string => `Estrai un'altra terra (questo è il seme ${seed})`,
    cells: (n: number): string => count(n, cell),
    trees: (n: number): string => `${n} alberi`,
    // What the land holds is counted in rocks and in veins of ore: "18 di pietra" would be a weight of it.
    stone: (n: number): string => count(n, f("roccia", "rocce")),
    ore: (n: number): string => count(n, m("filone", "filoni")),
    start: "Fonda il paese",
    resume: "Riprendi il paese",
    /** The town saved in this browser, by its title, and (when known) how long ago it was saved. */
    resumeTitle: (title: string, saved: string | null): string => `Riprendi il paese salvato in questo browser: ${title}${saved === null ? "" : `, salvato ${saved}`}`
  },
  /** The end of the term. */
  reckoning: {
    lost: "il mandato è perso · guarda come",
    over: (term: number): string => `il mandato ${term} è finito · guarda come`,
    /** The heading of a term that ran its course: `verdict` is one of `verdict` below. */
    title: (term: number, verdict: string): string => `il mandato ${term} è finito: ${verdict}`,
    /** What became of a town whose term ran out. */
    verdict: { unrooted: "il paese non ha mai messo radici", flourishing: "fiorente", holding: "tiene duro", declining: "in declino" },
    facts: {
      rank: "rango",
      minutes: "minuti in carica",
      residents: "abitanti",
      citizens: `${citizens.other} · ${burghers.other}`,
      coins: "monete",
      approval: "consenso",
      crown: "corona: fatte · mancate",
      score: "punteggio"
    },
    legend: "— abitanti (tratteggiato: il prossimo rango) · monete · - - consenso · ombreggiato: inverni",
    next: "Prossimo mandato",
    nextTitle: (minutes: number): string => `Resta in carica per altri ${minutes} minuti: lo stesso paese, nuovi inverni, e le richieste della corona ripartono piccole`,
    retire: "Ritirati: fonda un nuovo paese",
    found: "Fonda un nuovo paese",
    look: "Guarda il paese",
    share: "Condividi il paese",
    shareTitle: "Un'immagine del paese con il suo verdetto, o un link che chiunque può aprire"
  },
  /** The picture a town is shared as, and the lines a link to it previews with. */
  card: {
    /** How a lost term ended (`ended`: the view's word for it), as a headline. */
    lost: (ended: string): string => capital(ended),
    over: (now: number, term: number, verdict: string): string => `${capital(a(rankNoun(now)))}: il mandato ${term} è finito, ${verdict}`,
    playing: (now: number, year: number, term: number): string => `${capital(a(rankNoun(now)))} · anno ${year} · mandato ${term}`,
    land: (size: SizeId, land: LandId, minutes: number): string => `${capital(landOf(size, land))} · mandato di ${minutes} minuti`,
    residents: "abitanti",
    citizens: citizens.other,
    coins: "monete",
    approval: "consenso"
  },
  share: {
    title: "condividi il paese",
    sub: "Pubblica l'immagine dove vuoi, o crea un link: chi lo apre vede questo paese in funzione, da dove lo guardi ora, e può continuare a giocare da qui.",
    /** The picture's button: a phone hands it to its share sheet, a computer saves it. */
    sharePicture: "Condividi l'immagine",
    savePicture: "Salva l'immagine",
    makeLink: "Crea un link",
    making: "Creo un link…",
    again: "Riprova il link",
    shareLink: "Condividi il link",
    copyLink: "Copia il link",
    open: "Apri",
    noPicture: "Non è stato possibile creare l'immagine",
    /** What handing the picture or the link to the device came to. */
    offered: {
      shared: () => "Condiviso",
      notShared: () => "Non condiviso",
      saved: (o) => `Immagine salvata come ${o.name}`,
      copied: () => "Link copiato",
      link: (o) => o.url
    } satisfies Wording<Offered>,
    /** Why a town could not be shared, or a shared one opened. What the server itself says (`error`) is in its own words. */
    failed: {
      unreachable: (failure) => (failure.sending ? "Impossibile raggiungere il server per condividere il paese" : "Impossibile raggiungere il server per quel paese"),
      notFound: () => "Nessun paese è condiviso con quel link (le condivisioni si conservano per sei mesi)",
      refused: (failure) => `${failure.sending ? "Impossibile condividere il paese" : "Impossibile aprire quel paese"}: ${failure.error ?? `il server ha risposto ${failure.status}`}`,
      unpacked: () => "Non è stato possibile impacchettare il paese"
    } satisfies Wording<ShareFailure>,
    notShared: "Impossibile condividere il paese",
    notOpened: "Impossibile aprire quel paese"
  },
  /** Visiting a shared town. */
  visit: {
    shared: "un paese condiviso",
    play: "Gioca da qui",
    playTitle: "Fai tuo questo paese: costruisci, governa, e si salva da solo in questo browser",
    yours: "Il paese è tuo: si salva da solo mentre giochi",
    own: "Fonda il tuo"
  },
  /** Saving and loading. */
  save: {
    notReady: "Non pronto",
    saved: "Salvato",
    /** A save's title, as it is listed: "terra media e discreta · anno 2 · 23 min di gioco". */
    title: (c: { readonly size: SizeId; readonly land: LandId; readonly year: number; readonly minutes: number }): string =>
      `${landOf(c.size, c.land)} · anno ${c.year} · ${c.minutes} min di gioco`,
    untitled: "un paese",
    /** A save from before saves had titles. */
    earlier: "un salvataggio precedente",
    loaded: (title: string): string => `Caricato: ${title}`,
    loadedAuto: (title: string): string => `Caricato il salvataggio automatico: ${title}`,
    /** What went wrong with a save. */
    trouble: {
      nothingSaved: (e) => (e.auto ? "Ancora nessun salvataggio automatico" : "Ancora nessun salvataggio"),
      unreadable: () => "Non è stato possibile leggere il salvataggio",
      wrongVersion: (e) => (e.older ? "Quel salvataggio viene da una versione più vecchia del gioco" : "Quel salvataggio viene da una versione più nuova del gioco"),
      rejected: (e) => `Il salvataggio non è adatto a questo gioco: ${e.reason}`,
      storageFailed: (e) => `Impossibile salvare: ${e.reason}`,
      unsaveable: (e) => `Impossibile salvare il paese: ${e.reason}`
    } satisfies Wording<Trouble>
  },
  /**
   * News of the next Typeonce game (`ui/dom/brand/signup.ts`): the card at the first spring, and the panel on the
   * reckoning. "Typeonce Games" is a name, and stays.
   */
  signup: {
    label: "Nuovi giochi di Typeonce Games",
    moment: { lead: "Primavera dell'anno 3.", text: "Il paese ha superato il suo primo inverno." },
    headline: "Gioca per primo al prossimo gioco Typeonce",
    body: "Inkline Town è fatto da Typeonce Games. Lascia la tua email e il prossimo gioco gratuito ti arriva il giorno in cui esce.",
    email: "Indirizzo email",
    placeholder: "tu@esempio.it",
    submit: "Ricevi i nuovi giochi",
    keep: "Continua a giocare",
    outcome: {
      ok: "Controlla la posta per confermare.",
      invalid_email: "Questo indirizzo non sembra giusto.",
      rate_limited: "Troppi tentativi. Aspetta un minuto e riprova.",
      unavailable: "Non è andata a buon fine. Riprova."
    }
  },
  /** On the card shown while the town is drawn for the first time (the page's own HTML says it in English until the language is known). */
  loading: "si disegna il paese…",
  /** The town could not start, or stopped: said in place of the page. */
  fatal: {
    start: (why: string): string => `Il paese non è riuscito a partire: ${why}`,
    frame: (delta: number): string => `Delta di frame non valido: ${delta}`,
    stopped: "Il paese si è fermato dopo un errore di sistema.",
    loop: (field: string): string => `Opzione del ciclo a passo fisso non valida: ${field}`
  }
} satisfies typeof English
