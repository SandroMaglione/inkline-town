/**
 * German for the mayor's guide (`game/rules/guide.ts`): what each step
 * asks for, why, and what closes it; and what the guide says of the town as
 * it stands (what is under way, what opens a building, what comes next).
 * The same steps and the same tokens as English's (`../en/guide.ts`), in
 * sentences of German's own.
 *
 * As in English, a step is one thing to do (`action`, one sentence), one
 * reason (`why`), and what puts it away (`goal`). The goal reads after
 * "fertig, wenn", so it is a clause with its verb last ("ein Haus steht").
 * Tools, panels, and map views are tokens, and what a finger and a mouse
 * do is said with `token.device` ("Tippe auf", "Klicke auf": both take
 * "auf", so the sentence around them is the same). Amounts stay words.
 *
 * Every building and good is a chip written through `chips.ts`, in the
 * case its place in the sentence needs, its article outside it; a pronoun
 * or a possessive that stands for one ("sie", "ihr Brandwächter") comes
 * from `grammar.ts`, bent to the noun it stands for.
 */
import type { GoodId } from "../../game/content/index.ts"
import type { Chapter, GuideLocked, GuideSoon, GuideStepId, GuideWaiting } from "../../game/rules/guide.ts"
import type { guide as English } from "../en/guide.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { aKind, good, kind, ofKind, theGood, theKind, toKind } from "./chips.ts"
import { a, adjective, anArticle, capital, count, f, form, its, m, n, noArticle, percent, pronoun, the, to } from "./grammar.ts"
import { built, goods, rankNoun, tiers } from "./nouns.ts"

const tool = token.command
/** A map view's chip: each is a "…karte", feminine, so a sentence gives it "die". */
const map = token.view
const tap = token.device("tippe", "klicke")
const Tap = token.device("Tippe", "Klicke")
/** A verb in the number its good is spoken of in: "die Bretter werden knapp", "das Holz wird knapp". */
const verb = (id: GoodId, one: string, many: string) => (goods[id].many ? many : one)
const runsLow = (id: GoodId) => `${good(id)} ${verb(id, "wird", "werden")} knapp`
/** Plain names the guide speaks of, each through its noun. */
const hall = built("townhall").noun, rank = (r: number) => rankNoun(r)
const settlers = tiers[1].people, citizens = tiers[2].people, residents = m("Einwohner", "Einwohner")
const fenster = n("Fenster", "Fenster"), street = f("Straße", "Straßen")
/** Who walks from a building, for "its watchman", "its builder". */
const watchman = m("Brandwächter", "Brandwächter"), firefighter = m("Feuerwehrmann", "Feuerwehrleute"), mason = m("Maurer", "Maurer"), constable = m("Büttel", "Büttel")
const speed = `${tool("speed")} lässt die Zeit schneller laufen.`
/** What the bar a held stroke waits at calls its button (`page.map.stroke.build`): the opening sends a finger to it by name. */
const lay = "Bauen"

/** A step in words: what to do, why, and when it is done. */
interface Step {
  readonly action: string
  readonly why: string
  readonly goal: string
}

const chapters = {
  founding: "Gründung",
  standing: "Den Ort erhalten",
  citizens: "Bürger gewinnen",
  governing: "Regieren"
} satisfies Record<Chapter, string>

const steps = {
  // ── The opening, in order ──
  homes: {
    action: `Nimm ${tool("homes")} und ziehe entlang der grauen Straße um ${the(hall, "acc")}${token.device(`, dann tippe auf ${lay}`, "")}.`,
    why: `${settlers.other} ziehen in Häuser, die an einer Straße liegen, und jedes Haus zahlt Steuern: die Einnahmen des Ortes.`,
    goal: "ein Haus steht"
  },
  road: {
    action: `Nimm ${tool("road")} und ziehe von der Straße ${to("an", "dat", hall)} eine neue zum Wasser.`,
    why: `Jedes Gebäude braucht eine Straße an der Mitte einer seiner Seiten, sonst erreicht es niemand. Als Nächstes kommt ${theKind("fishery")}, und ${pronoun(built("fishery").noun)} braucht Wasser in der Nähe.`,
    goal: "eine Straße bis auf zwei Felder ans Wasser reicht"
  },
  fishery: {
    action: `${Tap} auf ${kind("fishery", "acc")} und setze ${pronoun(built("fishery").noun, "acc")} an diese Straße, höchstens zwei Felder vom Wasser entfernt.`,
    why: `${settlers.other} essen ${good("fish", "acc")}. Der Ort hat anfangs ein wenig davon, und im Lager ${verb("fish", "verdirbt", "verderben")} ${good("fish")}.`,
    goal: `${aKind("fishery")} steht`
  },
  look: {
    action: `Nimm ${tool("select")} und ${tap} auf ${theKind("fishery", "acc")}, um ${its(built("fishery").noun, fenster, "acc")} zu öffnen.`,
    why: "Ein Gebäude braucht Arbeiter aus Häusern im Umkreis von 15 Straßenfeldern; sein Fenster zeigt, wie viele es hat und was es bremst. Der Arbeitszähler oben zählt alle zusammen.",
    goal: "du das Fenster eines Gebäudes öffnest"
  },
  lumberjack: {
    action: `Baue ${aKind("lumberjack", "acc")} an einer Straße neben den Bäumen.`,
    why: `${runsLow("planks")}, und jedes Haus und Gebäude kostet ${verb("planks", "etwas", "welche")}. Aus ${good("wood", "dat")} entstehen ${good("planks")}.`,
    goal: `${aKind("lumberjack")} steht`
  },
  sawmill: {
    action: `Baue ${aKind("sawmill", "acc")} an einer Straße ${toKind("bei", "dat", "lumberjack")}.`,
    why: `Waren entstehen in Ketten: ${capital(theKind("lumberjack"))} liefert ${good("wood", "acc")}, und ${theKind("sawmill")} sägt daraus ${good("planks", "acc")}. Träger bringen die Waren über die Straßen hin und her.`,
    goal: `${aKind("sawmill")} steht`
  },
  term: {
    action: `Öffne das Fenster ${tool("town")} und lies die Ziele ganz oben.`,
    why: `Erreichst du sie, steigt der Ort ${to("von", "dat", rank(0))} ${to("zu", "dat", rank(1))}, ${to("zu", "dat", rank(2))} und ${to("zu", "dat", rank(3))} auf, jedes Mal mit einem Lohn der Krone. ${tool("pause")} hält die Uhr an, wenn du nachdenken willst.`,
    goal: "du das Fenster des Ortes öffnest"
  },
  grow: {
    action: "Lege weitere Straßen und Häuser an, bis zehn Häuser stehen.",
    why: `Mehr Leute zahlen mehr Steuern und schalten neue Gebäude unter ${tool("build")} frei. Der Ratgeber fragt nach einem Gebäude erst, wenn der Ort es braucht.`,
    goal: "10 Häuser stehen"
  },

  // ── The course goes on: citizens ──
  quarry: {
    action: `Baue ${aKind("quarry", "acc")} an einer Straße neben den hellen Felsen.`,
    why: `${runsLow("stone")}, und die Werkstätten, die ${citizens.other} brauchen, kosten ${verb("stone", "etwas", "welche")}. Die dunklen Felsen sind ${good("ore")}, für später.`,
    goal: `${aKind("quarry")} steht`
  },
  cloth: {
    action: `Baue ${aKind("sheep", "acc")} und ${aKind("weaver", "acc")} an Straßen nahe beieinander.`,
    why: `Mit ${good("bread", "dat")}, ${good("cloth", "dat")} und Glauben wird ein Haus ${to("zu", "dat", tiers[2].home)}. ${capital(theKind("sheep"))} schert ${good("wool", "acc")}, und ${theKind("weaver")} webt daraus ${good("cloth", "acc")}.`,
    goal: `${aKind("sheep")} und ${aKind("weaver")} stehen`
  },
  chapel: {
    action: `Baue ${aKind("chapel", "acc")} an einer Straße zwischen den Häusern.`,
    why: `Glaube ist das zweite Bedürfnis. Der Läufer ${ofKind("chapel")} bringt ihn zu den Häusern an seinem Weg, und ${theKind("chapel")} macht ${its(built("chapel").noun, street, "acc")} wohnlicher.`,
    goal: `${aKind("chapel")} steht`
  },
  wheat: {
    action: `Baue ${aKind("farm", "acc")} und ${aKind("mill", "acc")}.`,
    why: `${good("bread")} ist das dritte Bedürfnis und die längste Kette: ${capital(theKind("farm"))} baut ${good("wheat", "acc")} an, und ${theKind("mill")} mahlt daraus ${good("flour", "acc")}.`,
    goal: `${aKind("farm")} und ${aKind("mill")} stehen`
  },
  bakery: {
    action: `Baue ${aKind("bakery", "acc")} ${toKind("bei", "dat", "mill")}.`,
    why: `${capital(pronoun(built("bakery").noun))} backt aus ${theGood("flour", "dat")} ${ofKind("mill")} ${good("bread", "acc")}. Schon ${a(tiers[1].home)} mit ${good("bread", "dat")} auf dem Tisch zahlt die Hälfte mehr.`,
    goal: `${aKind("bakery")} steht`
  },
  citizens: {
    action: `Nimm ${tool("select")} und ${tap} auf ein Haus, um zu sehen, was ihm noch für ${citizens.other} fehlt.`,
    why: `Mit ${good("bread", "dat")}, ${good("cloth", "dat")}, Glauben und einer Straße mit Wohnwert 5 wächst ein Haus, sobald das Lager ${theGood("planks", "acc")} und ${good("stone", "acc")} dafür hergibt. Sein Fenster zeigt, was fehlt.`,
    goal: `das erste Haus ${citizens.other} beherbergt`
  },
  goals: {
    action: `Öffne das Fenster ${tool("town")}, um zu sehen, wie nah die Ziele sind.`,
    why: `Die ersten ${citizens.other} sind eingezogen, und jeder Rang verlangt einen größeren Anteil von ihnen.`,
    goal: "du das Fenster des Ortes öffnest"
  },
  ranks: {
    action: `Erfülle alle Ziele im Fenster ${tool("town")}, um den Rang des Ortes zu heben.`,
    why: `Halte sie zwei Minuten, und der Ort steigt auf, bis ${to("zu", "dat", rank(3))}. Ab dem Rang ${rank(2).one} gibt es Ausbauten für ${theKind("market", "acc")} und ${theKind("chapel", "acc")}. Der Ratgeber meldet sich, wenn etwas dich braucht.`,
    goal: `der Ort ${a(rank(3))} ist`
  },

  // ── Around the course, when the town needs them ──
  crown: {
    action: "Schicke der Krone, was sie verlangt, mit dem Knopf „Senden“ an ihrer Forderung oben.",
    why: "Sie zahlt in Talern. Eine unbeantwortete Forderung kostet eine Strafe, und drei verpasste in Folge beenden deine Amtszeit.",
    goal: "die Waren gesandt sind"
  },
  winter: {
    action: `Baue ${aKind("granary", "acc")} oder ${aKind("smokehouse", "acc")}, bevor der Winter kommt.`,
    why: `Im Winter fängt man weniger, die Häuser essen mehr, und ${good("fish")} ${verb("fish", "verdirbt", "verderben")} im Lager. ${capital(aKind("granary"))} hält ${pronoun(goods.fish, "acc", goods.fish.many)} fünfmal so lange frisch, und ${good("smoked")} hält sich den ganzen Winter.`,
    goal: `${aKind("granary")} oder ${aKind("smokehouse")} steht`
  },
  tools: {
    action: `Stelle im Fenster ${tool("town")} unter Waren und Handel ${good("tools", "acc")} auf Kaufen.`,
    why: `Werkstätten verbrauchen ${good("tools", "acc")}, und nur ${aKind("smithy")} stellt ${pronoun(goods.tools, "acc", goods.tools.many)} her; ${pronoun(built("smithy").noun)} öffnet ab ${count(10, citizens, "dat")}.`,
    goal: `der Ort ${good("tools", "acc")} kauft oder ${aKind("smithy")} steht`
  },
  forester: {
    action: `Baue ${aKind("forester", "acc")} neben ${theKind("lumberjack", "dat")}.`,
    why: `${capital(theKind("lumberjack", "dat"))} gehen die Bäume aus, und ${aKind("forester")} pflanzt ${pronoun(built("lumberjack").noun, "dat")} neue.`,
    goal: `${aKind("forester")} steht`
  },
  firewatch: {
    action: `Baue ${aKind("firewatch", "acc")} an einer Straße zwischen den Häusern.`,
    why: `Holzhütten fangen Feuer, und ein Brand greift auf die Nachbarn über. ${capital(its(built("firewatch").noun, watchman))} hält die Gefahr gering, und ${its(built("firewatch").noun, firefighter, "nom", true)} löschen Brände. Die ${map("fire")} zeigt die Gefahr.`,
    goal: `${aKind("firewatch")} steht`
  },
  builder: {
    action: `Baue ${aKind("builder", "acc")} bei den abgenutzten Gebäuden.`,
    why: `Ein heruntergekommenes Gebäude arbeitet im halben Tempo und kann einstürzen. ${capital(its(built("builder").noun, mason))} bessert aus, woran er vorbeikommt, mit ${good("planks", "dat")} und ${good("stone", "dat")}. Die ${map("condition")} zeigt ihren Zustand.`,
    goal: `${aKind("builder")} steht`
  },
  market: {
    action: `Baue ${aKind("market", "acc")} zwischen den Häusern, die am weitesten ${to("von", "dat", hall)} entfernt sind.`,
    why: `Manche Häuser liegen außer Reichweite des Läufers ${to("von", "dat", hall)}, der nur 20 Straßenfelder weit kommt, und bekommen keine Nahrung. Der Läufer ${aKind("market", "gen")} trägt sie weiter.`,
    goal: `${aKind("market")} steht`
  },
  markethall: {
    action: `${Tap} auf ${theKind("market", "acc")} (der goldene Pfeil darüber) und beginne in ${its(built("market").noun, fenster, "dat")} den Ausbau ${toKind("zu", "dat", "market", 1)}.`,
    why: `Manche Häuser liegen jenseits jedes Läufers mit Nahrung. Der Läufer ${aKind("market", "gen", 1)} geht weiter und öfter, ohne den Unterhalt ${anArticle(built("market").noun, "gen")} ${adjective("zweit", built("market").noun, "gen", "a")} ${kind("market", "gen")}.`,
    goal: `${aKind("market", "nom", 1)} steht`
  },
  street: {
    action: `Hebe die Straße dieses Hauses auf Wohnwert 5: Setze ${aKind("chapel", "acc")}, ${aKind("market", "acc")} oder einen Park in die Nähe, und halte Werkstätten fern.`,
    why: `Es hat ${good("bread", "acc")}, ${good("cloth", "acc")} und Glauben, aber ${citizens.other} wohnen nur an einer ordentlichen Straße. Die ${map("appeal")} zeigt den Wohnwert.`,
    goal: `ein Haus an einer feinen Straße ${citizens.other} beherbergt`
  },
  carpenter: {
    action: `Baue ${aKind("carpenter", "acc")}: ${capital(pronoun(built("carpenter").noun))} macht ${good("furniture", "acc")} aus ${good("planks", "dat")}.`,
    why: `${tiers[3].people.other} wohnen in ${form(tiers[3].home, "dat", true)}, und ${a(tiers[3].home)} braucht ${good("furniture", "acc")}: zwei Stück für den Aufstieg und ab und zu ein neues ${toKind("von", "dat", "market")}, um es zu bleiben. Sie zahlen am meisten und beherbergen die meisten Leute.`,
    goal: `${aKind("carpenter")} steht`
  },
  healer: {
    action: `Baue ${aKind("healer", "acc")} an einer Straße zwischen den Häusern.`,
    why: `Krankheit breitet sich aus, und ein krankes Haus beherbergt nur halb so viele Leute. Der Bader ${toKind("aus", "dat", "healer")} besucht die Häuser und heilt sie. Die ${map("health")} zeigt die Gefahr.`,
    goal: `${aKind("healer")} steht`
  },
  watchhouse: {
    action: `Baue ${aKind("watchhouse", "acc")} an einer Straße zwischen den Häusern.`,
    why: `Arme Straßen, halb leere Häuser und geringe Zustimmung ziehen Diebe an. ${capital(its(built("watchhouse").noun, constable))} geht durch die Straßen und hält Ordnung. Die ${map("order")} zeigt die Gefahr.`,
    goal: `${aKind("watchhouse")} steht`
  },
  trade: {
    action: `Verkaufe im Fenster ${tool("town")} unter Waren und Handel eine Ware, die sich stapelt, oder kaufe eine, die knapp wird.`,
    why: "Der Ort treibt keinen Handel, bis du es ihm sagst, und übrige Waren sind Taler, die nur darauf warten, verdient zu werden.",
    goal: "der Ort etwas verkauft oder kauft"
  },
  taxes: {
    action: `Erhöhe die Steuern im Fenster ${tool("town")} ein wenig.`,
    why: `Der Ort ist zufrieden, verliert aber Taler, und die Zustimmung verträgt höhere Steuern. Über ${percent(125)} bleibt ein Groll, der anhält.`,
    goal: "ein Steuersatz geändert ist"
  },
  smithy: {
    action: `Baue ${aKind("mine", "acc")} neben den dunklen, rostgeäderten Felsen und ${aKind("smithy", "acc")}.`,
    why: `${runsLow("tools")}, und jede Werkstatt verbraucht ${pronoun(goods.tools, "acc", goods.tools.many)}. ${capital(theKind("mine"))} fördert ${good("ore", "acc")}, und ${theKind("smithy")} schmiedet daraus ${good("tools", "acc")}.`,
    goal: `${aKind("mine")} und ${aKind("smithy")} stehen`
  }
} satisfies Record<GuideStepId, Step>

/** What is happening, once the mayor has done a step's part and the town is at work on it. */
const waiting = {
  homesNoPlanks: () => `Die Häuser warten auf ${good("planks", "acc")}, aber das Lager hat nichts davon.`,
  homesRising: () => `Bauleute tragen ${good("planks", "acc")} vom Lager zu den neuen Häusern, und ${settlers.other} ziehen ein, sobald eines steht. ${speed}`,
  siteNoPlanks: () =>
    `Im Lager sind ${noArticle(goods.planks, "nom", goods.planks.many)} ${good("planks")} mehr, also wartet die Baustelle: Verkaufe etwas im Fenster ${tool("town")}, oder kaufe dort ${good("planks", "acc")}.`,
  siteRising: () => `Vorerst ist es eine Baustelle: Träger bringen ${good("planks", "acc")} und ${good("stone", "acc")} aus dem Lager, dann bauen die Bauleute es auf. ${speed}`,
  homesLaid: () => "Zehn Häuser sind angelegt: Die Bauleute errichten sie gerade."
} satisfies Wording<GuideWaiting>

/** Why the town cannot build what a step asks for yet, and what to do meanwhile. */
const locked = {
  residents: (l) => `${capital(theKind(l.kind))} gibt es ab ${count(l.needs, residents, "dat")} (jetzt ${l.now}): Lege mehr ${tool("homes")} an und versorge sie mit Nahrung.`,
  citizens: (l) => `${capital(theKind(l.kind))} gibt es ab ${count(l.needs, citizens, "dat")} (jetzt ${l.now}).`,
  coins: (l) => `Spare: ${capital(theKind(l.kind))} kostet ${l.cost} Taler (jetzt ${l.now}). Häuser zahlen jede Minute Steuern.`
} satisfies Wording<GuideLocked>

/** The next step that waits for the town to need it: what it will ask for, and when it comes. */
const below = (id: GoodId, s: { readonly below: number; readonly now: number }) =>
  `sobald ${theGood(id)} unter ${s.below} ${verb(id, "fällt", "fallen")} (jetzt ${s.now})`
const upcoming = {
  lumberjack: (s) => `Als Nächstes: ${aKind("lumberjack")} und ${aKind("sawmill")}, ${below("planks", s)}.`,
  sawmill: (s) => `Als Nächstes: ${aKind("sawmill")}, ${below("planks", s)}.`,
  quarry: (s) => `Als Nächstes: ${aKind("quarry")}, ${below("stone", s)}.`
} satisfies Wording<GuideSoon>

export const guide = { chapters, steps, waiting, locked, upcoming } satisfies typeof English
