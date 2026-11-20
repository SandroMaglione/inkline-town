/**
 * German for the page itself (`ui/dom` and what starts it, `app/browser.ts`):
 * its buttons, headings, tooltips, dialogs, and the chips a message's tokens
 * become. The same entries as English, part for part (`satisfies` holds it
 * to them).
 *
 * As in English, what a part shows through markup may hold tokens, what it
 * sets as plain text is words alone, and a sentence with the page's own
 * markup set into it takes each piece as a string and says where it goes.
 * The labels a phone shows in a tight row (the tool bar, the system bar,
 * the HUD's figures, the trade slider's mode) are the shortest German
 * words that say it; the reader sees the full sentence on hover.
 *
 * Every building, good, home, and rank is named through `nouns.ts`, and its
 * article, case, pronoun, and adjective ending bent to it by `grammar.ts`:
 * none is written out beside a name it might not agree with. A button is
 * labelled with a capital, as German labels one ("Speichern"); a heading
 * keeps the lowercase English gives it, and the page capitalises its first
 * letter.
 */
import { COMMUTE, home, mood, park, TOWN_RANK, type Category, type GoodId, type GroundId, type KindId, type LandId, type PropId, type SizeId, type Tier, type WinterId } from "../../game/content/index.ts"
import type { Status } from "../../game/schema.ts"
import type { Trouble } from "../../platform/save.ts"
import type { Offered, ShareFailure } from "../../platform/share/client.ts"
import type { Panel } from "../../view/contracts.ts"
import type { page as English } from "../en/page.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { a, adjective, anArticle, capital, count, decimal, f, form, m, n, percent, pronoun, signed, the, theArticle, to, type Noun } from "./grammar.ts"
import { built, goods, grounds, land, lands, names, props, quantity, rankNoun, sizes, tiers, winter, winters } from "./nouns.ts"
import { amount, taler } from "./said.ts"

/** A number with its sign as a slider or a chip shows it: "+4", "-4", "0". */
const plus = (value: number) => `${value > 0 ? "+" : ""}${value}`
/** A number that may have a fraction, with German's comma: "2,5", "0,05". */
const figure = (value: number) => `${value}`.replace(".", ",")

/** A building's noun, as built or at a level of its upgrades. */
const kind = (id: KindId, level = 0): Noun => built(id, level).noun

/** A good in plain words, in a case, in the number the town speaks of it in: "Bretter", "Brettern", "Holz". */
const ware = (id: GoodId, c: "nom" | "acc" | "dat" = "nom") => form(goods[id], c, goods[id].many)
/** The pronoun that stands for a good: "es" (das Holz), "ihn" (den Fisch), "sie" (die Bretter). */
const them = (id: GoodId, c: "nom" | "acc" = "acc") => pronoun(goods[id], c, goods[id].many)
/** A verb in its good's number: "wird" or "werden", "verdirbt" or "verderben". */
const verb = (id: GoodId, one: string, many: string) => (goods[id].many ? many : one)

const settlers = tiers[1].people, citizens = tiers[2].people, burghers = tiers[3].people
const cottage = tiers[1].home, citizensHome = tiers[2].home, townhouse = tiers[3].home
const residents = m("Einwohner", "Einwohner"), cell = n("Feld", "Felder"), roadCell = n("Straßenfeld", "Straßenfelder"), tree = m("Baum", "Bäume")
const missed = f("verpasste Forderung", "verpasste Forderungen")
/** "im Umkreis von 15 Straßenfeldern". */
const within = (cells: number) => `im Umkreis von ${count(cells, roadCell, "dat")}`

/** What the bar a held stroke waits at calls its button: the messages that send a finger to it name it by this. */
const lay = "Bauen"

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

/** A land in words, in a case: "mittelgroßes, ordentliches Land", "auf kleinem, reichem Land". */
const landOf = (size: SizeId, kindOf: LandId, c: "nom" | "dat" = "nom") =>
  `${adjective(sizes[size].stem, land, c)}, ${adjective(lands[kindOf].stem, land, c)} ${form(land, c)}`
/** The ranks in a row, as a town rises through them: "vom Weiler zum Dorf, zum Städtchen und zur Stadt". */
const rising = `${to("von", "dat", rankNoun(0))} ${to("zu", "dat", rankNoun(1))}, ${to("zu", "dat", rankNoun(2))} und ${to("zu", "dat", rankNoun(3))}`

export const page = {
  /** What a building's chip in a message says on hover. */
  chips: {
    goTo: (id: KindId): string => `Gehe ${to("zu", "dat", kind(id))}`,
    /** A row that places a building, on hover. */
    place: (id: KindId): string => `Baue ${a(kind(id), "acc")}`,
    build: (id: KindId): string => `Baue ${a(kind(id), "acc")}: ${built(id).blurb}`
  },
  /** How long ago a save was made, roughly. */
  ago: {
    now: "gerade eben",
    minutes: (count_: number): string => `vor ${count_} min`,
    hours: (count_: number): string => `vor ${count_} h`,
    yesterday: "gestern",
    days: (count_: number): string => `vor ${count_} Tagen`
  },
  /** Words more than one part of the page says. */
  common: {
    close: "Schließen",
    closeEsc: "Schließen (Esc)",
    cancel: "Abbrechen",
    /** A section's ⓘ. */
    whatThisMeans: "Was das bedeutet",
    showWhere: "Zeig mir, wo",
    dismiss: "Verwerfen",
    coins: taler.other
  },

  // ── The map and its tools ───────────────────────────────────────────────

  /** What picking something to put on the map says, and the bar a held stroke waits at. */
  map: {
    place: (id: KindId): string => {
      const what = kind(id)
      return token.device(`Tippe auf eine Stelle für ${the(what, "acc")}, dann tippe erneut, um ${pronoun(what, "acc")} zu bauen`, `Klicke, um ${a(what, "acc")} zu platzieren · Esc zum Beenden`)
    },
    layGround: (id: GroundId): string => {
      const what = grounds[id].noun
      return token.device(`Ziehe ein Rechteck für ${a(what, "acc")}, dann tippe auf ${lay}`, `Ziehe ein Rechteck für ${a(what, "acc")} · Esc zum Beenden`)
    },
    furnish: (id: PropId): string => {
      const what = props[id].noun
      return token.device(
        `Tippe auf ein Parkfeld für ${the(what, "acc")}, dann tippe erneut, um ${pronoun(what, "acc")} aufzustellen`,
        `Klicke auf ein Parkfeld, um ${a(what, "acc")} aufzustellen · Esc zum Beenden`
      )
    },
    /** A touch tap that holds what it would do: tapped again, it does it. What it would remove is not known here, so neither says "it". */
    tapAgain: { remove: "erneut tippen zum Entfernen", build: "erneut tippen, um hier zu bauen" },
    overlays: "Kartenansichten",
    stroke: { build: lay, cancel: "Abbrechen" }
  },
  toolbar: {
    town: { label: "Ort", title: "Ziele, Zahlen, Steuern und Handel des Ortes (T)" },
    more: "Teilen, Ratgeber, Speichern, Laden, neuer Ort",
    pause: "Halte den Ort an, oder lass ihn weiterlaufen (Leertaste)",
    /** A speed's button: "Lass den Ort mit 2× laufen (2)". */
    runAt: (speed: string, key: string): string => `Lass den Ort mit ${speed} laufen (${key})`,
    cycle: "Tempo ändern: 1×, 2×, 4×",
    /** The pause switch, read aloud: what pressing it does now. */
    run: "Den Ort laufen lassen",
    pauseNow: "Den Ort anhalten",
    runAtLast: (last: number): string => `Den Ort mit ${last}× laufen lassen`
  },
  mapViews: {
    title: "Kartenansichten",
    help: "Färbe die Karte nach einer davon, um zu sehen, wo es dem Ort gut oder schlecht geht. Drücke die Taste erneut (oder klicke), um sie auszublenden.",
    // A view's label is a bare noun ("Wohnwert", "Feuer"): it is named as a view, so no article has to agree with it.
    show: (label: string, key: string): string => `Ansicht „${label}“ über der Karte zeigen (${key}); noch einmal zum Ausblenden`
  },
  /** Share, the guide, save, load, and new town: each button's label and what it says on hover. */
  system: {
    share: { label: "Teilen", tip: "Teile ein Bild des Ortes, oder einen Link, den jeder öffnen kann, um zuzusehen und weiterzuspielen" },
    guide: {
      label: "Ratgeber",
      tip: "Schalte den Ratgeber an oder aus: Er sagt einem neuen Bürgermeister, was als Nächstes zu tun ist, und warum",
      turnOn: "Schalte den Ratgeber wieder an: ein nächster Schritt, und warum, oben im Ticker",
      turnOff: "Schalte den Ratgeber aus"
    },
    language: { label: "Sprache", tip: "Wähle die Sprache, in der der Ort zu lesen ist" },
    save: { label: "Speichern", tip: "Speichere den Ort in diesem Browser (er speichert sich auch alle zwei Minuten selbst)" },
    load: { label: "Laden", tip: "Lade den neuesten Spielstand: deinen oder den automatischen, je nachdem, welcher neuer ist" },
    newTown: { label: "Neuer Ort", tip: "Gründe einen neuen Ort auf neuem Land" },
    recentre: { label: "Zentrieren", tip: "Zurück zum ursprünglichen Winkel und zur Mitte" },
    leave: {
      load: leave("den neuesten Spielstand laden?", "Der Ort, wie er jetzt ist, wird durch den neuesten Spielstand ersetzt (deinen oder den automatischen).", "Speichern, dann laden", "Laden ohne Speichern"),
      newTown: leave("einen neuen Ort gründen?", "Dieser Ort ist für immer verloren, wenn er nicht vorher gespeichert wird.", "Speichern, dann neues Land wählen", "Neues Land ohne Speichern wählen"),
      stay: "Weiterspielen"
    }
  },
  /** The camera bar in the map's corner (the renderer draws it): its two drag modes, the zoom, and the way back. */
  camera: {
    label: "Kartenkamera",
    pan: { label: "Schieben", title: "Ziehen verschiebt die Karte; die Werkzeuge Straße, Pflaster, Häuser und Parkboden bauen beim Ziehen" },
    rotate: { label: "Drehen", title: "Ziehen dreht, statt zu platzieren. Ziehen mit der rechten Maustaste dreht auch, und Q und E drehen um ein Achtel." },
    zoomOut: "Herauszoomen",
    zoom: "Kamerazoom",
    zoomIn: "Hineinzoomen",
    reset: { label: "Kamera zurücksetzen", title: "Ursprünglicher Winkel und Mitte (Pos1)" }
  },
  /** Choosing the language: every language is listed by its own name, so only what is around the list is said here. */
  language: {
    /** On the language now in use, read aloud. */
    current: (name: string): string => `${name} (aktiv)`,
    /** The browser would not keep the choice, so the page stays as it is. */
    notKept: "Dieser Browser hat die Wahl nicht behalten, also bleibt die Sprache, wie sie ist"
  },
  /** The maker's credit: what each link is, read aloud. */
  credit: {
    typeonce: "Typeonce Games: weitere Spiele vom Macher von Inkline Town",
    ritmo: "ritmo auf GitHub: die ECS-Laufzeit, mit der Inkline Town gemacht ist",
    madeWith: "Gemacht mit",
    madeBy: "Gemacht von Typeonce",
    newTab: (label: string): string => `${label} (öffnet in einem neuen Tab)`
  },

  // ── The heads-up display ────────────────────────────────────────────────

  hud: {
    /** What each good is for: who makes it, who takes it. */
    goods: {
      wood: `kommt ${to("aus", "dat", kind("lumberjack"), true)}; ${a(kind("sawmill"))} sägt daraus ${ware("planks")}`,
      planks: `woraus Häuser und Gebäude gebaut werden: ${a(kind("sawmill"))} macht ${them("planks")} aus ${ware("wood", "dat")}`,
      stone: `zum Bauen und Pflastern: ${the(kind("quarry"), "nom", true)} brechen ${them("stone")} aus Felsen, die zur Neige gehen`,
      ore: `nur für ${ware("tools", "acc")}: Sobald der Ort 10 ${citizens.other} hat, fördert ${them("ore")} ${a(kind("mine"))} aus den rostroten Vorkommen, und ${a(kind("smithy"))} schmiedet daraus ${ware("tools", "acc")}`,
      tools: `zum Bauen, und Werkstätten verschleißen alle 50 oder 60 Arbeitsgänge ein Stück: ${a(kind("smithy"))} schmiedet ${them("tools")}, oder kaufe ${them("tools")}`,
      fish: `Nahrung für ${settlers.other}: ${the(kind("fishery"), "nom", true)} fangen ${them("fish")} am Wasser; ${them("fish", "nom")} ${verb("fish", "verdirbt", "verderben")} in etwa drei Minuten`,
      smoked: `${ware("fish")}, ${theArticle(goods.smoked)} sich den ganzen Winter hält: ${a(kind("smokehouse"))} räuchert ${them("smoked")}`,
      wheat: `${the(kind("farm"), "nom", true)} bauen ${them("wheat")} an; ${a(kind("mill"))} mahlt daraus ${ware("flour", "acc")} (nicht im Winter)`,
      flour: `kommt von ${a(kind("mill"), "dat")}; ${a(kind("bakery"))} backt daraus ${ware("bread", "acc")}`,
      bread: `Nahrung, die ${citizens.other} brauchen, und ${a(cottage)} mit ${ware("bread", "dat")} zahlt die Hälfte mehr: ${them("bread", "nom")} ${verb("bread", "verdirbt", "verderben")} in etwa fünf Minuten`,
      wool: `${the(kind("sheep"), "nom", true)} scheren ${them("wool")}; ${a(kind("weaver"))} webt daraus ${ware("cloth", "acc")}`,
      cloth: `${citizens.other} brauchen ${them("cloth")}: ${capital(them("cloth", "nom"))} ${verb("cloth", "wird", "werden")} nur an Straßen mit Wohnwert 5 oder mehr geliefert`,
      furniture: `${burghers.other} brauchen ${them("furniture")} in ihren ${form(townhouse, "dat", true)}: ${a(kind("carpenter"))} macht ${them("furniture")} aus ${ware("planks", "dat")}; ${them("furniture", "nom")} ${verb("furniture", "wird", "werden")} nur an Straßen geliefert, die fein genug für ${form(townhouse, "acc", true)} sind`
    } satisfies Record<GoodId, string>,
    /** A good and what it is for: "Bretter: woraus Häuser und Gebäude gebaut werden…". */
    good: (name: string, help: string): string => `${name}: ${help}`,
    /** A good's last minute, under what it is for. Said with participles, which agree with nothing. */
    goodFlow: (flow: { readonly made: number; readonly used: number; readonly traded: number; readonly stock: number; readonly elsewhere: number }): string =>
      `Letzte Minute: ${flow.made} erzeugt, ${flow.used} verbraucht${flow.traded !== 0 ? `, ${Math.abs(flow.traded)} ${flow.traded > 0 ? "gekauft" : "verkauft"}` : ""}. ${flow.stock} im Lager, ${flow.elsewhere} im Ort verteilt (in Werkstätten und Märkten, und unterwegs).`,
    stock: "Waren im Lager des Ortes, und wohin sich jede bewegt · klicke, um zu sehen, was der Ort erzeugt und verbraucht",
    goodsChip: "Die Waren im Lager",
    folk: "Öffne die Zahlen, Ziele und Stellschrauben des Ortes (T)",
    treasury: {
      plain: "Taler in der Kasse, und was sie bei den jetzigen Sätzen pro Minute gewinnt (oder verliert) · klicke für die letzte Minute des Ortes",
      counted: (flow: { readonly change: number; readonly made: number; readonly used: number; readonly traded: number; readonly net: number }): string =>
        `Taler in der Kasse · klicke für die letzte Minute des Ortes\nLetzte Minute: ${signed(flow.change)} (eingenommen ${flow.made}, ausgegeben ${flow.used}${flow.traded !== 0 ? `, Handel ${signed(flow.traded)}` : ""})\nBei den jetzigen Sätzen: ${signed(flow.net)}/min (Steuern, Handel, Unterhalt, Verwaltung)`
    },
    clock: {
      paused: "Pause",
      /** Under the clock: "Jahr 2 · Winter in 3:20 (hart)". `until` is one of the three below. */
      year: (year: number, until: string): string => `Jahr ${year} · ${until}`,
      winter: (severity: WinterId, spring: string): string => `${adjective(winters[severity].stem, winter)} ${winter.one} · Frühling in ${spring}`,
      winterIn: (left: string, coming: WinterId): string => `${winter.one} in ${left} (${winters[coming].name})`,
      noMoreWinters: "kein Winter mehr",
      /** The clock on hover: the season, the almanac's next two winters (`null`: beyond the term), and what each kind does to a catch (percent). */
      title: (c: { readonly winter: boolean; readonly coming: WinterId | null; readonly after: WinterId | null; readonly fishing: Readonly<Record<WinterId, number>> }): string => {
        const will = (w: WinterId | null) => (w === null ? "liegt nach der Amtszeit" : `wird ${winters[w].name}`)
        return `${c.winter ? "Winter: Die Äcker ruhen, der Fischfang ist langsam, und die Häuser essen schneller" : "Restzeit der Amtszeit"}\nDer Almanach: Der kommende Winter ${will(c.coming)}, der danach ${will(c.after)}.\n${capital(winters.mild.name)}: Fischfang bei ${percent(c.fishing.mild)}. ${capital(winters.normal.name)}: ${percent(c.fishing.normal)}. ${capital(winters.hard.name)}: anderthalbmal so lang, Fischfang bei ${percent(c.fishing.hard)}, und heizende Häuser sind brandgefährdet.`
      }
    },
    approval: "Zustimmung",
    settlers: settlers.other,
    citizens: citizens.other,
    /** Beside the citizens, once there are any: "· 12 Patrizier". */
    burghers: (count_: number): string => count(count_, burghers),
    jobs: {
      short: (count_: number): string => `${count_} ${count_ === 1 ? "fehlt" : "fehlen"} · klick`,
      filled: "besetzt",
      filledTitle: `Arbeiter im Einsatz von benötigten Arbeitern: Jede Arbeitsstätte ist voll besetzt. Einwohner gehen höchstens ${COMMUTE} Straßenfelder weit zur Arbeit.`,
      /** How many workplaces are short, and the first few of them. */
      shortTitle: (count_: number, places: ReadonlyArray<ShortPlace>): string =>
        `Arbeiter im Einsatz von benötigten Arbeitern. ${count_ > 1 ? `${count_} Arbeitsstätten fehlen` : "Einer Arbeitsstätte fehlen"} Leute: ${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? ` (keine Häuser ${within(COMMUTE)})` : ""}`).join(", ")}. Klicke, um sie der Reihe nach zu besuchen.`
    },
    /** The goods' last minute, side by side: each column, and what it counts. */
    flow: {
      counting: "Die Waren des Ortes werden gezählt: Die ersten Zahlen kommen in einer halben Minute…",
      made: { label: "Ertrag", title: "In der letzten Minute von Werkstätten und Sammlern erzeugt" },
      used: { label: "Verbrauch", title: "In der letzten Minute gegessen, verarbeitet, verbaut, verdorben oder weggeschickt" },
      traded: { label: "Handel", title: "In der letzten Minute gekauft (+) oder verkauft (−)" },
      storage: { label: "Lager", title: `${capital(to("in", "dat", kind("townhall")))}, ${to("in", "dat", kind("warehouse"), true)} und ${to("in", "dat", kind("granary"), true)}` },
      about: { label: "unterwegs", title: `In Werkstätten und ${form(kind("market"), "dat", true)}, in den Körben der Läufer und den Kisten der Träger` }
    },
    /** The crown's request: `amount` and `good` are set in bold, the good with its icon. */
    crown: {
      asks: (amountOf: string, good: string): string => `die Krone verlangt ${amountOf} ${good}`,
      inStore: (count_: number): string => `${count_} im Lager`,
      /** What is in store (coloured by whether it is enough), when it is due (bold), and what it pays. */
      terms: (inStore: string, due: string, reward: string): string => `${inStore} · noch ${due} · ${reward}`,
      reward: (coins: number): string => amount.coins(coins, true),
      send: "Senden",
      sendTitle: (good: GoodId, count_: number, reward: number): string => `Schicke der Krone ${quantity(good, count_)} für ${amount.coins(reward)}`,
      notEnough: (good: GoodId): string => `Noch nicht genug ${ware(good)} im Lager`
    },
    /** What threatens the term, or is about to raise the town a rank: `left` is a clock. */
    warnings: {
      bankruptIn: (left: string) => warning("Verschuldet:", `Bankrott in ${left}, wenn sich die Kasse nicht erholt`),
      debt: warning("Verschuldet:", "die Löhne bleiben unbezahlt"),
      revoltIn: (left: string) => warning("Aufruhr:", `der Ort verjagt den Bürgermeister in ${left}`),
      restless: warning("Unruhe:", "die Zustimmung sinkt Richtung Aufstand"),
      emptying: warning("Abwanderung:", "die Leute verlassen den Ort"),
      patience: (streak: number) => warning("Die Geduld der Krone:", `${count(streak, missed)} in Folge; noch eine, und der Bürgermeister wird abgesetzt`),
      /** Every goal of the next rank (`to`) is met and holding. */
      rises: (next: number, left: string) => warning("Alle Ziele erfüllt:", `der Ort wird in ${left} ${a(rankNoun(next))}`)
    }
  },

  // ── The ticker ──────────────────────────────────────────────────────────

  ticker: {
    bulb: "Der Ratgeber, und was jetzt Aufmerksamkeit braucht",
    tucked: "Der Ratgeber steckt in der Glühbirne oben rechts",
    guideOff: "Ratgeber aus · unten rechts wieder einschalten",
    /** How long ago a piece of news happened, in the town's own time. */
    ago: {
      now: "gerade eben",
      seconds: (count_: number): string => `vor ${count_} s`,
      minutes: (count_: number): string => `vor ${count_} min`
    },
    /** The guide's heading: "Ratgeber · Gründung". */
    guide: (chapter: string): string => `Ratgeber · ${chapter}`,
    step: (at: number, of: number): string => `Schritt ${at} von ${of}`,
    firstSteps: "Die ersten Schritte eines neuen Ortes",
    hide: "Ratgeber aus",
    hideTitle: "Schalte den Ratgeber aus (der Ratgeber-Knopf unten rechts schaltet ihn wieder an)",
    /** Under a step: what closes it. `goal` is the step's own words, a clause with its verb last. */
    doneWhen: (goal: string): string => `fertig, wenn ${goal}`,
    skip: "Diesen Schritt überspringen",
    tuck: "Verbergen: Der Ratgeber bleibt in der Glühbirne oben rechts",
    now: "jetzt",
    lately: "zuletzt"
  },

  // ── The panels ──────────────────────────────────────────────────────────

  town: {
    title: "Ort",
    /** Under the heading: "mittelgroßes, ordentliches Land · ein Dorf · Amtszeit 2, 60 Minuten". */
    sub: (c: { readonly size: SizeId; readonly land: LandId; readonly rank: number; readonly term: number; readonly minutes: number }): string =>
      `${landOf(c.size, c.land)} · ${a(rankNoun(c.rank))} · Amtszeit ${c.term}, ${c.minutes} Minuten`,
    seed: (seed: number): string => `Startwert ${seed}`,
    goals: {
      title: "Ziele",
      help: `Der Ort wächst ${rising}. Erfülle alle Ziele des nächsten Rangs zugleich und halte sie zwei Minuten: Die Krone schickt eine Belohnung, und das Spiel geht weiter. Ein Rang geht nie verloren.`,
      top: (now: number): string => `${capital(a(rankNoun(now)))}, der höchste Rang: Erhalte ${pronoun(rankNoun(now), "acc")}, Amtszeit um Amtszeit.`,
      holding: (now: number, left: string): string => `Alle erfüllt: Halte sie noch ${left}, und ${the(rankNoun(now))} wird ${a(rankNoun(now + 1))}.`,
      toward: (now: number): string => `Jetzt ${a(rankNoun(now))}: Diese Ziele machen ${pronoun(rankNoun(now), "acc")} zu ${a(rankNoun(now + 1), "dat")}.`
    },
    approval: {
      title: "Zustimmung",
      help: "Häuser beherbergen mehr Bewohner, wenn die Zustimmung hoch ist, und weniger, wenn sie niedrig ist. Bei −50 für zwei Minuten verjagt der Ort den Bürgermeister.",
      heading: "jetzt → Richtung"
    },
    treasury: {
      title: "Kasse",
      help: `Taler pro Minute. Steuern kommen nur von Häusern, die versorgt sind, im Verhältnis zu den Bedürfnissen, die sie erfüllt haben. Die Verwaltung wird nach Häusern berechnet und wächst schneller als der Ort: In einem großen Ort kostet ${anArticle(cottage)} ${adjective("weiter", cottage, "nom", "a")} ${cottage.one} etwa so viel, wie ${pronoun(cottage)} zahlt, während ${a(citizensHome)} oder ${a(townhouse)} zwei- oder dreimal so viele Leute zu denselben Kosten beherbergt. Drei Minuten verschuldet, und der Ort ist bankrott.`,
      taxes: "Steuern",
      supplied: "wenn jedes Haus versorgt wäre",
      trade: "Handel",
      upkeep: "Unterhalt",
      admin: "Verwaltung",
      net: "pro Minute",
      /** The sum of the above, with its sign: "+12 Taler". */
      netCoins: (coins: number): string => amount.coins(coins, true),
      leftOnTable: (gap: number): string =>
        `${amount.rate(gap)} verschenkt: Ein hungriges Haus zahlt nichts, ${a(cottage)} mit ${ware("bread", "dat")} die Hälfte mehr, eine feine Straße ein Viertel mehr`
    },
    taxes: {
      title: "Steuersätze",
      help: `Niedrigere Steuern heben die Zustimmung, höhere senken sie, gewichtet danach, wie viele es von jeder Stufe gibt. Über ${percent(100)} ziehen auch manche Einwohner weg, ${settlers.other} früher als ${citizens.other}, also bringt ein höherer Satz nicht immer mehr ein: Unter jedem Satz steht, was die Häuser bei jeder Stufe zahlen würden, sobald sie sich eingependelt haben. Über ${percent(mood.grudge.above)} hegt der Ort außerdem einen Groll, der den Satz überdauert: Steuern am Ende zu senken, macht eine Amtszeit des Auspressens nicht ungeschehen.`,
      slider: `Ziehe, um den Satz einzustellen; Doppelklick für die üblichen ${percent(100)}`,
      /** What a rate does to approval (`sway`: 0 at the usual rate), and whether it is high enough to leave a grudge. */
      effect: (sway: number, grudge: boolean): string =>
        `${sway === 0 ? "der übliche Satz" : `${signed(sway)} Zustimmung`}${grudge ? " · solange er so hoch bleibt, wächst ein Groll, der nur langsam vergeht" : ""}`,
      /** Taxes a minute at each step of the rate, and the step that brings in most. */
      outlook: (steps: ReadonlyArray<{ readonly rate: number; readonly taxes: number }>, best: number): string =>
        `Steuern pro Minute, eingependelt: ${steps.map((o) => `${percent(o.rate)} ${o.taxes}`).join(" · ")} · am meisten bei ${percent(best)}`,
      outlookTitle: `Steuern pro Minute von allen Häusern, wenn dieser Satz bliebe und die Häuser sich einpendelten: Über ${percent(100)} ziehen Einwohner weg, und die Zustimmung folgt dem Satz`
    },
    people: {
      title: "Einwohner",
      settlers: settlers.other,
      citizens: citizens.other,
      burghers: `davon ${burghers.other}`,
      homes: "Häuser",
      jobs: "Stellen besetzt",
      jobsOf: (employed: number, jobs: number): string => `${employed} von ${jobs}`,
      staffed: "jede Arbeitsstätte ist voll besetzt",
      /** How many workplaces are short, the first few (`more`: there are others), and where to find them. */
      short: (count_: number, places: ReadonlyArray<ShortPlace>, more: boolean): string =>
        `${count_} ohne volle Belegschaft: ${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? " (niemand in Reichweite)" : ""}`).join(", ")}${more ? ", …" : ""} · klicke auf den Arbeitszähler, um sie zu besuchen`
    },
    needs: {
      title: "versorgte Häuser",
      help: `Ein hungriges Haus zahlt keine Steuern. ${settlers.other} brauchen Nahrung (${ware("fish", "acc")}, ${ware("smoked", "acc")} oder ${ware("bread", "acc")}) von ${a(kind("market"), "dat")}, und ${a(cottage)}, ${theArticle(cottage)} zusätzlich ${ware("bread", "acc")} hat, zahlt die Hälfte mehr; ein Besuch versorgt ein Haus mit ${a(goods.fish, "dat")} oder ${a(goods.bread, "dat")} je vier Bewohner, also isst ${a(citizensHome)} doppelt so viel wie ${a(cottage)} und ${a(townhouse)} dreimal so viel; ${citizens.other} und ${burghers.other} brauchen ${ware("bread", "acc")}, ${ware("cloth", "acc")} und Glauben, ${burghers.other} außerdem ${ware("furniture", "acc")} von ${a(kind("carpenter"), "dat")}. ${ware("cloth")} ${verb("cloth", "wird", "werden")} nur an Straßen mit Wohnwert 5 oder mehr geliefert, ${ware("furniture")} an Straßen ab 12. ${ware("fish")} ${verb("fish", "verdirbt", "verderben")} in etwa drei Minuten und ${ware("bread")} in fünf; ${a(kind("granary"))} hält beides fünfmal so lange frisch.`,
      larder: "Nahrung im Lager",
      eaten: "gegessen · verdorben/min",
      trouble: "kranke Häuser · brennend"
    },
    crown: {
      title: "die Krone",
      help: "Wer der Krone schickt, was sie verlangt, verdient Taler. Eine verpasste Forderung kostet eine Strafe, und der Ort erinnert sich eine Weile an den Affront; zu viele verpasste in Folge, und die Krone setzt den Bürgermeister ab.",
      tally: "erfüllt · verpasst",
      /** An open request: `what` (so many of a good) is set in bold. */
      wants: (what: string, left: string, reward: string): string => `Will ${what} · noch ${left} · ${reward}`,
      what: (good: GoodId, count_: number): string => quantity(good, count_),
      reward: (coins: number): string => amount.coins(coins, true),
      next: (left: string, patience: number): string => `Nächste Forderung in ${left} · ${patience} verpasste in Folge beenden die Amtszeit`
    },
    trade: {
      title: "Waren und Handel",
      help: "Händler kommen alle paar Sekunden. Ziehe den Regler einer Ware nach links, um zu verkaufen, was über den Vorrat hinausgeht, nach rechts, um bis dahin zuzukaufen (zum anderthalbfachen Preis); je weiter, desto mehr bei jedem Besuch; die Mitte handelt nicht. Die Preise fallen, wenn der Ort verkauft, und steigen dreimal so schnell, wenn er kauft; ein hoher Preis beruhigt sich nur langsam, also gleicht Zukaufen einen Mangel aus, aber ein Ort, der von gekaufter Nahrung lebt, zahlt jede Minute mehr.",
      keep: "im Lager behalten",
      keepTitle: "Wie viel der Ort von jeder Ware behält: Er verkauft nur, was darüber liegt, und kauft nur bis dahin zu",
      keepNote: "je Ware: verkauft wird nur darüber, gekauft nur bis dahin",
      deal: (good: GoodId): string =>
        `Nach links ziehen, um ${ware(good, "acc")} zu verkaufen, nach rechts, um ${them(good)} zu kaufen; je weiter, desto mehr bei jedem Besuch der Händler. Doppelklick beendet den Handel damit.`,
      /** What a good's slider is set to: nothing, or the most it sells or buys a minute. */
      none: "kein Handel",
      sell: (most: number): string => `Verkauf ≤${most}/min`,
      buy: (most: number): string => `Einkauf ≤${most}/min`,
      /** A good's price in coins ("T", for Taler), and (when it is not the usual) in percent of the usual: "3,5 T (120 %)". */
      price: (coins: number, share: number | null): string => `${figure(coins)} T${share === null ? "" : ` (${percent(share)})`}`,
      asks: "was Händler für ein Stück verlangen",
      pays: "was Händler für ein Stück zahlen"
    },
    chronicle: "Chronik"
  },
  build: {
    title: "Bauen",
    sub: token.device("Wähle eins, dann tippe auf die Karte, wo es hin soll", "Wähle eins, dann klicke auf die Karte · Esc zum Beenden"),
    categories: { storage: "Lager", gathering: "Rohstoffe", crafts: "Handwerk", food: "Nahrung", services: "Dienste" } satisfies Record<Category, string>,
    cost: "Kosten",
    does: "Zweck",
    /** What keeps the town from building something yet, in place of what it is for. */
    needsResidents: (count_: number): string => `ab ${count(count_, residents, "dat")}`,
    needsCitizens: (count_: number): string => `ab ${count(count_, citizens, "dat")}`,
    /** What each of a building's chips says on hover. */
    recipe: (r: { readonly input: GoodId | null; readonly inputs: number; readonly output: GoodId; readonly batch: number; readonly seconds: number }): string =>
      `${r.input ? `macht aus ${quantity(r.input, r.inputs, true)} ${quantity(r.output, r.batch)}` : `macht ${quantity(r.output, r.batch)}`} alle ${figure(r.seconds)} s`,
    serves: (range: number): string => `die Läufer versorgen die Häuser bis ${range} Straßenfelder ab der Tür`,
    holds: (cap: number, keeps: number | null): string => `fasst bis zu ${cap} je Ware${keeps === null ? "" : `, und hält Nahrung ${keeps}-mal so lange frisch`}`,
    crew: (workers: number, tier: Tier): string => `${count(workers, tiers[tier].people)} zum Arbeiten, aus Häusern ${within(COMMUTE)}`,
    appeal: (value: number, reach: number): string => `Wohnwert ${plus(value)} daneben, bis ${count(reach, cell)} weit${value < 0 ? ": Häuser fernhalten" : ": Häuser mögen das"}`,
    upkeep: "Unterhalt: Taler pro Minute, solange das Gebäude steht (ein Viertel, wenn pausiert)",
    /** A building's whole line on hover: what it is, who works it, how far it reaches, what it does to its street, and what it costs to keep. */
    option: (id: KindId, k: { readonly workers: number; readonly citizens: boolean; readonly range: number | null; readonly appeal: { readonly value: number; readonly reach: number } | null; readonly upkeep: number }): string =>
      `${names.kind.title(id)}: ${built(id).blurb}${k.workers > 0 ? ` · ${count(k.workers, k.citizens ? citizens : settlers)} als Arbeiter, aus Häusern ${within(COMMUTE)}` : ""}${k.range === null ? "" : ` · Läufer reichen ${k.range} Straßenfelder`}${k.appeal ? ` · Wohnwert ${plus(k.appeal.value)} bis ${count(k.appeal.reach, cell)} weit` : ""} · ${amount.rate(k.upkeep)}`,
    parks: {
      title: "Parks",
      help: `Lege Boden an, dann stelle Ausstattung darauf. Boden, der sich berührt, ist ein Park: Je mehr er enthält, desto schöner die Straßen ringsum (${citizens.other} brauchen ${home.tiers[2].appeal}, ${townhouse.other} ${home.tiers[3].appeal}). Ein Ausstattungsstück zählt je ${park.cellsPerProp} Felder; wo Parks sich treffen, zählt der schönste voll.`,
      ground: "Boden · Rechteck ziehen",
      furnishings: "Ausstattung · auf ein Parkfeld klicken",
      beauty: "Schönheit für den Park",
      upkeep: "Unterhalt, Taler pro Minute",
      /** A park piece's whole line on hover: `name` and `blurb` are its own. */
      piece: (name: string, blurb: string, p: { readonly beauty: number; readonly upkeep: number; readonly ground: boolean }): string =>
        `${name}: ${blurb} · Schönheit +${figure(p.beauty)}${p.ground ? " pro Feld" : ""} · ${figure(p.upkeep)} Taler pro Minute`
    }
  },
  /** The panel of what is picked: a building, a home, a park, or a ruin. */
  selection: {
    park: "Park",
    ruin: "Ruine",
    /** Under the heading: who lives in a home of each tier, and what a ruin or a park is for. */
    home: {
      1: `hier wohnen ${settlers.other} und erledigen die grobe Arbeit`,
      2: `hier wohnen ${citizens.other}, erledigen die Facharbeit und zahlen doppelt so viel`,
      3: `hier wohnen ${burghers.other} und zahlen die besten Steuern`
    } satisfies Record<Tier, string>,
    aboutRuin: "reiß sie ab, um das Grundstück zu räumen",
    aboutPark: "jedes Feld Boden, das dieses berührt: Lege mehr an oder stelle Ausstattung darauf, um die Straßen ringsum schöner zu machen",
    status: "Status",
    /** How a building is, in a word, when nothing is wrong with it. */
    statuses: {
      building: "im Bau",
      idle: "untätig",
      working: "in Betrieb",
      starved: "ohne Nachschub",
      blocked: "blockiert",
      unstaffed: "ohne Arbeiter",
      unconnected: "ohne Straße",
      paused: "pausiert"
    } satisfies Record<Status, string>,
    causes: { burnt: "abgebrannt", collapsed: "eingestürzt", derelict: "verfallen" } satisfies Record<Extract<Panel, { readonly type: "ruin" }>["cause"], string>,
    /** A park's worth in a word: the desirability it gives, and how far. */
    parkWorth: (value: number, reach: number): string => `${plus(value)} bis ${count(reach, cell)} weit`,
    whatMakesIt: "was ihn ausmacht",
    whatIsLeft: "was übrig ist",
    pause: "Arbeit pausieren",
    resume: "Arbeit fortsetzen",
    pauseTitle: "Ein pausiertes Gebäude hat keine Arbeiter und zahlt ein Viertel seines Unterhalts",
    closeHome: "Haus schließen",
    reopenHome: "Haus wieder öffnen",
    closeTitle: `Ein geschlossenes Haus steht leer: keine Steuern, und keine Kosten für die Verwaltung ${the(kind("townhall"), "gen")}. Öffne es wieder, und ${settlers.other} ziehen zurück.`,
    remove: "Entfernen"
  },
  /** What upgrading a building would cost and give: `to` is the level it would stand at. */
  upgrade: {
    title: (id: KindId, level: number): string => `Ausbau ${to("zu", "dat", kind(id, level))}`,
    begin: (id: KindId, level: number): string => `${kind(id, level).one} bauen`,
    needed: (why: string): string => `jetzt nötig: ${why}`,
    notNeeded: "noch nicht nötig: Der goldene Pfeil zeigt, wann",
    pay: "du zahlst",
    get: "du bekommst",
    now: "jetzt, zum Beginnen",
    price: (coins: number): string => token.coins(coins),
    short: (coins: number): string => `${token.coins(coins)} ${coins === 1 ? "fehlt" : "fehlen"}`,
    later: "später, angeliefert",
    lacks: (lacking: ReadonlyArray<{ readonly good: GoodId; readonly count: number }>): string =>
      `im Lager fehlen ${lacking.map((l) => token.amount(l.good, l.count)).join(", ")}: Die Arbeiten warten darauf`,
    fromStore: "aus dem Lager: Die Arbeiten gehen weiter, sobald es eintrifft",
    upkeepAfter: "Unterhalt danach",
    goesOn: "der Betrieb läuft während der Arbeiten weiter, und auf dem Grundstück wächst ein Gerüst"
  },

  // ── The sheets ──────────────────────────────────────────────────────────

  /** Founding a town: the charter. */
  charter: {
    by: "von",
    sub: "Wähle das Land, dann lass den Ort bis zu seinem Ziel wachsen, bevor die Amtszeit endet.",
    land: {
      title: "Land",
      /** What a land of this size asks of a town: each figure is a chip. */
      note: (people: string, income: string): string => `${a(rankNoun(TOWN_RANK))}: ${people}${income}`,
      residents: (count_: number): string => `${count_} Einwohner`,
      income: (coins: number): string => `+${coins}/min`,
      tip: (people: number, income: number): string =>
        `Der Rang ${rankNoun(TOWN_RANK).one} verlangt ${count(people, residents)} und Einnahmen von ${count(income, taler, "dat")} pro Minute; ${a(rankNoun(TOWN_RANK - 1))} weniger, ${a(rankNoun(TOWN_RANK + 1))} mehr`
    },
    term: {
      title: "Amtszeit",
      label: (minutes: number): string => `${minutes} min`,
      years: (years: number, minutes: number): string => `${years} Jahre zu ${figure(minutes)} min`,
      winters: (count_: number): string => count(count_, winter),
      tip: (minutes: number, years: number): string => `${minutes} Minuten bei 1×: ${years} Jahre, mit einem Winter am Ende jedes Jahres nach dem ersten`
    },
    richness: {
      title: "Reichtum",
      coins: (coins: number): string => `${amount.coins(coins)} zum Start`
    },
    reroll: "↻ anderes Land",
    rerollTitle: (seed: number): string => `Anderes Land ziehen (dies ist Startwert ${seed})`,
    cells: (count_: number): string => count(count_, cell),
    trees: (count_: number): string => count(count_, tree),
    // What the land holds is counted in rocks and in veins of ore: "18 Steine" would be what they give. Its icon says which rock.
    stone: (count_: number): string => count(count_, m("Fels", "Felsen", "Felsens")),
    ore: (count_: number): string => count(count_, f("Erzader", "Erzadern")),
    start: "Neu beginnen",
    resume: "Weiterspielen",
    /** The town saved in this browser, by its title, and (when known) how long ago it was saved. */
    resumeTitle: (title: string, saved: string | null): string => `Spiele mit dem Ort weiter, der in diesem Browser gespeichert ist: ${title}${saved === null ? "" : `, gespeichert ${saved}`}`
  },
  /** The end of the term. */
  reckoning: {
    lost: "die Amtszeit ist verloren · sieh, wie",
    over: (term: number): string => `Amtszeit ${term} ist vorüber · sieh, wie`,
    /** The heading of a term that ran its course: `verdict` is one of `verdict` below. */
    title: (term: number, verdict: string): string => `Amtszeit ${term} ist vorüber: ${verdict}`,
    /** What became of a town whose term ran out. */
    verdict: { unrooted: "der Ort hat nie Wurzeln geschlagen", flourishing: "blühend", holding: "standhaft", declining: "im Niedergang" },
    facts: {
      rank: "Rang",
      minutes: "Minuten im Amt",
      residents: "Einwohner",
      citizens: `${citizens.other} · ${burghers.other}`,
      coins: taler.other,
      approval: "Zustimmung",
      crown: "Krone erfüllt · verpasst",
      score: "Punkte"
    },
    legend: "— Einwohner (gestrichelt: nächster Rang) · Taler · - - Zustimmung · schattiert: Winter",
    next: "Nächste Amtszeit",
    nextTitle: (minutes: number): string => `Bleib weitere ${minutes} Minuten im Amt: derselbe Ort, neue Winter, und die Forderungen der Krone fangen wieder klein an`,
    retire: "Abtreten: einen neuen Ort gründen",
    found: "Einen neuen Ort gründen",
    look: "Den Ort ansehen",
    share: "Den Ort teilen",
    shareTitle: "Ein Bild des Ortes mit seinem Urteil, oder ein Link, den jeder öffnen kann"
  },
  /** The picture a town is shared as, and the lines a link to it previews with. */
  card: {
    /** How a lost term ended (`ended`: the view's word for it), as a headline. */
    lost: (ended: string): string => capital(ended),
    over: (now: number, term: number, verdict: string): string => `${capital(a(rankNoun(now)))}: Amtszeit ${term} ist vorüber, ${verdict}`,
    playing: (now: number, year: number, term: number): string => `${capital(a(rankNoun(now)))} · Jahr ${year} · Amtszeit ${term}`,
    land: (size: SizeId, kindOf: LandId, minutes: number): string => `${capital(landOf(size, kindOf))} · ${minutes}-Minuten-Amtszeit`,
    residents: "Einwohner",
    citizens: citizens.other,
    coins: taler.other,
    approval: "Zustimmung"
  },
  share: {
    title: "den Ort teilen",
    sub: "Poste das Bild, wo du willst, oder erstelle einen Link: Wer ihn öffnet, sieht diesen Ort laufen, von dort aus, wo du jetzt hinschaust, und kann von hier aus weiterspielen.",
    /** The picture's button: a phone hands it to its share sheet, a computer saves it. */
    sharePicture: "Bild teilen",
    savePicture: "Bild speichern",
    makeLink: "Link erstellen",
    making: "Link wird erstellt…",
    again: "Link erneut versuchen",
    shareLink: "Link teilen",
    copyLink: "Link kopieren",
    open: "Öffnen",
    noPicture: "Das Bild konnte nicht erstellt werden",
    /** What handing the picture or the link to the device came to. */
    offered: {
      shared: () => "Geteilt",
      notShared: () => "Nicht geteilt",
      saved: (o) => `Bild gespeichert als ${o.name}`,
      copied: () => "Link kopiert",
      link: (o) => o.url
    } satisfies Wording<Offered>,
    /** Why a town could not be shared, or a shared one opened. What the server itself says (`error`) is in its own words. */
    failed: {
      unreachable: (failure) => (failure.sending ? "Der Server war nicht erreichbar, um den Ort zu teilen" : "Der Server war für diesen Ort nicht erreichbar"),
      notFound: () => "Unter diesem Link ist kein Ort geteilt (geteilte Orte bleiben sechs Monate)",
      refused: (failure) => `${failure.sending ? "Der Ort konnte nicht geteilt werden" : "Dieser Ort konnte nicht geöffnet werden"}: ${failure.error ?? `der Server antwortete ${failure.status}`}`,
      unpacked: () => "Der Ort konnte nicht verpackt werden"
    } satisfies Wording<ShareFailure>,
    notShared: "Der Ort konnte nicht geteilt werden",
    notOpened: "Dieser Ort konnte nicht geöffnet werden"
  },
  /** Visiting a shared town. */
  visit: {
    shared: "ein geteilter Ort",
    play: "Von hier weiterspielen",
    playTitle: "Mach diesen Ort zu deinem: bauen, regieren, und er speichert sich in diesem Browser selbst",
    yours: "Der Ort gehört dir: Er speichert sich beim Spielen selbst",
    own: "Gründe deinen eigenen"
  },
  /** Saving and loading. */
  save: {
    notReady: "Nicht bereit",
    saved: "Gespeichert",
    /** A save's title, as it is listed: "mittelgroßes, ordentliches Land · Jahr 2 · 23 min gespielt". */
    title: (c: { readonly size: SizeId; readonly land: LandId; readonly year: number; readonly minutes: number }): string =>
      `${landOf(c.size, c.land)} · Jahr ${c.year} · ${c.minutes} min gespielt`,
    untitled: "ein Ort",
    /** A save from before saves had titles. */
    earlier: "ein früherer Spielstand",
    loaded: (title: string): string => `Geladen: ${title}`,
    loadedAuto: (title: string): string => `Automatischer Spielstand geladen: ${title}`,
    /** What went wrong with a save. */
    trouble: {
      nothingSaved: (e) => (e.auto ? "Noch kein automatischer Spielstand" : "Noch nichts gespeichert"),
      unreadable: () => "Der Spielstand konnte nicht gelesen werden",
      wrongVersion: (e) => (e.older ? "Dieser Spielstand stammt aus einer älteren Version des Spiels" : "Dieser Spielstand stammt aus einer neueren Version des Spiels"),
      rejected: (e) => `Der Spielstand passt nicht zu diesem Spiel: ${e.reason}`,
      storageFailed: (e) => `Speichern fehlgeschlagen: ${e.reason}`,
      unsaveable: (e) => `Der Ort konnte nicht gespeichert werden: ${e.reason}`
    } satisfies Wording<Trouble>
  },
  /**
   * News of the next Typeonce game (`ui/dom/brand/signup.ts`): the card at the first spring, and the panel on the
   * reckoning. "Typeonce Games" is a name, and stays.
   */
  signup: {
    /** The sign-up, read aloud. */
    label: "Neue Spiele von Typeonce Games",
    /** The card's top strip, in the town's own voice: the moment (in bold), and what it means. The first spring is always year 3's. */
    moment: { lead: "Frühling im Jahr 3.", text: "Der Ort hat seinen ersten Winter überstanden." },
    headline: "Spiele das nächste Typeonce-Spiel als Erstes",
    body: "Inkline Town ist von Typeonce Games. Hinterlasse deine E-Mail-Adresse, und das nächste kostenlose Spiel erreicht dich am Tag seines Erscheinens.",
    /** The field, read aloud, and what it shows while empty. */
    email: "E-Mail-Adresse",
    placeholder: "du@beispiel.de",
    submit: "Neue Spiele erhalten",
    keep: "Weiterspielen",
    /** How a sign-up went, in the studio's words. */
    outcome: {
      ok: "Sieh in deinem Posteingang nach, um zu bestätigen.",
      invalid_email: "Diese Adresse sieht nicht richtig aus.",
      rate_limited: "Zu viele Versuche. Warte eine Minute und versuche es erneut.",
      unavailable: "Das hat nicht geklappt. Versuche es erneut."
    }
  },
  /** On the card shown while the town is drawn for the first time (the page's own HTML says it in English until the language is known). */
  loading: "der Ort wird gezeichnet…",
  /** The town could not start, or stopped: said in place of the page. */
  fatal: {
    start: (why: string): string => `Der Ort konnte nicht starten: ${why}`,
    frame: (delta: number): string => `Ungültiges Frame-Delta: ${delta}`,
    stopped: "Der Ort hat nach einem Systemfehler angehalten.",
    loop: (field: string): string => `Ungültige Fixed-Loop-Option: ${field}`
  }
} satisfies typeof English
