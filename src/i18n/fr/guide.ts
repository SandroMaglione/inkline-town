/**
 * French for the mayor's guide (`game/rules/guide.ts`): what each step
 * asks for, why, and what closes it; and what the guide says of the town as
 * it stands (what is under way, what opens a building, what comes next).
 * The same steps and the same tokens as English's (`../en/guide.ts`), in
 * sentences of French's own, speaking to the mayor as "vous".
 *
 * As in English, a step is one thing to do (`action`, one sentence), one
 * reason (`why`), and what puts it away (`goal`, a lowercase clause that
 * reads after "fait quand"); tools, panels, and map views are tokens, and
 * what a finger and a mouse do is said with `token.device` ("touchez",
 * "cliquez"). Amounts stay words.
 *
 * Every building and good is a chip written through `chips.ts`, its
 * article or preposition outside the chip and bent to the noun: nothing
 * here writes "le", "une", or "du" before one by hand. A building stands
 * as "il y a une [pêcherie]", so no participle agrees with it; a good
 * referred back to is "en" ("en fait des planches"), or a pronoun and a
 * verb bent to its gender and number (`them`, `verb`).
 */
import type { GoodId, KindId } from "../../game/content/index.ts"
import type { Chapter, GuideLocked, GuideSoon, GuideStepId, GuideWaiting } from "../../game/rules/guide.ts"
import type { guide as English } from "../en/guide.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { aKind, good, kind, ofGood, someGood, theGood, theKind, toGood, toKind } from "./chips.ts"
import { a, agree, before, capital, count, f, of, some, theMany, to } from "./grammar.ts"
import { built, goods, rankNoun, tiers } from "./nouns.ts"

const tool = token.command
/** A map view's chip: each is a "carte …", so a sentence gives it "la". */
const map = token.view
const tap = token.device("touchez", "cliquez")
const Tap = token.device("Touchez", "Cliquez")
/** A verb in the number its good is spoken of in: "les planches se font rares", "la pierre se fait rare". */
const verb = (id: GoodId, one: string, many: string) => (goods[id].counted ? many : one)
/** The pronoun that stands for a good: "le", "la", "les". */
const them = (id: GoodId) => (goods[id].counted ? "les" : agree(goods[id], "le", "la"))
const runsLow = (id: GoodId) => `${capital(theGood(id))} ${verb(id, "se fait rare", "se font rares")}`
/** "il y a une [pêcherie]": a building stands, said so that nothing agrees with its gender. */
const stands = "il y a"
/** "il" or "elle", for a building. */
const it = (id: KindId) => agree(built(id).noun, "il", "elle")
const hall = built("townhall").noun, coin = f("pièce")
const rank = (n: number) => rankNoun(n)
const speed = `${tool("speed")} fait passer le temps plus vite.`

/** A step in words: what to do, why, and when it is done. */
interface Step {
  readonly action: string
  readonly why: string
  readonly goal: string
}

const chapters = {
  founding: "Fondation",
  standing: "Tenir debout",
  citizens: "Accueillir des citoyens",
  governing: "Gouverner"
} satisfies Record<Chapter, string>

const steps = {
  // ── The opening, in order ──
  homes: {
    action: `Prenez ${tool("homes")} et faites glisser le long de la route grise autour ${to("de", hall)}${token.device(", puis touchez Bâtir", "")}.`,
    why: "Les colons s'installent dans les maisons qui touchent une route, et chaque maison paie des impôts : le revenu de la ville.",
    goal: "il y a une maison"
  },
  road: {
    action: `Prenez ${tool("road")} et tracez une route depuis celle ${to("de", hall)} vers l'eau.`,
    why: `Tout bâtiment a besoin d'une route qui touche le milieu d'un de ses côtés, sinon personne ne l'atteint. ${capital(theKind("fishery"))} vient ensuite, et il lui faut de l'eau tout près.`,
    goal: "une route arrive à deux cases de l'eau"
  },
  fishery: {
    action: `${Tap} ${kind("fishery")}, puis placez-${agree(built("fishery").noun, "le", "la")} sur cette route, à deux cases de l'eau au plus.`,
    why: `Les colons mangent ${someGood("fish")}. La ville en a un peu au départ, et ${theGood("fish")} ${verb("fish", "pourrit", "pourrissent")} en réserve.`,
    goal: `${stands} ${aKind("fishery")}`
  },
  look: {
    action: `Avec ${tool("select")}, ${tap} ${theKind("fishery")} pour ouvrir son panneau.`,
    why: "Un bâtiment a besoin de travailleurs venus de maisons à 15 cases de route au plus ; son panneau dit combien il en a, et ce qui le freine. Le compteur d'emplois, en haut, les additionne tous.",
    goal: "vous ouvrez le panneau d'un bâtiment"
  },
  lumberjack: {
    action: `Construisez ${aKind("lumberjack")} sur une route près des arbres.`,
    why: `${runsLow("planks")}, et chaque maison, chaque bâtiment en coûte. ${capital(theGood("planks"))} ${verb("planks", "vient", "viennent")} ${toGood("de", "wood")}.`,
    goal: `${stands} ${aKind("lumberjack")}`
  },
  sawmill: {
    action: `Construisez ${aKind("sawmill")} sur une route près ${toKind("de", "lumberjack")}.`,
    why: `Les marchandises se font en chaîne : ${theKind("lumberjack")} fournit ${theGood("wood")}, et ${theKind("sawmill")} en fait ${someGood("planks")}. Les porteurs les transportent de l'un à l'autre par les routes.`,
    goal: `${stands} ${aKind("sawmill")}`
  },
  term: {
    action: `Ouvrez le panneau ${tool("town")} et lisez les objectifs tout en haut.`,
    why: `Les atteindre fait passer la ville ${of(rank(0))} en ${rank(1).one}, puis en ${rank(2).one} et en ${rank(3).one}, chaque fois avec une récompense de la couronne. ${tool("pause")} arrête l'horloge quand vous avez besoin de réfléchir.`,
    goal: "vous ouvrez le panneau de la ville"
  },
  grow: {
    action: "Tracez d'autres routes et d'autres maisons jusqu'à en avoir dix.",
    why: `Plus d'habitants paient plus d'impôts, et débloquent de nouveaux bâtiments dans ${tool("build")}. Le guide ne demande un bâtiment que lorsque la ville en a besoin.`,
    goal: `${stands} 10 maisons`
  },

  // ── The course goes on: citizens ──
  quarry: {
    action: `Construisez ${aKind("quarry")} sur une route près des rochers pâles.`,
    why: `${runsLow("stone")}, et les ateliers dont les citoyens ont besoin en coûtent. Les rochers sombres sont ${someGood("ore")}, pour plus tard.`,
    goal: `${stands} ${aKind("quarry")}`
  },
  cloth: {
    action: `Construisez ${aKind("sheep")} et ${aKind("weaver")}, sur des routes proches l'une de l'autre.`,
    why: `Une maison devient ${a(tiers[2].home)} avec ${someGood("bread")}, ${someGood("cloth")} et la foi. ${capital(theKind("sheep"))} donne ${theGood("wool")}, et ${theKind("weaver")} en fait ${someGood("cloth")}.`,
    goal: `${stands} ${aKind("sheep")} et ${aKind("weaver")}`
  },
  chapel: {
    action: `Construisez ${aKind("chapel")} sur une route parmi les maisons.`,
    why: `La foi est le deuxième besoin. Le prêtre ${toKind("de", "chapel")} l'apporte aux maisons sur son passage, et ${theKind("chapel")} rend sa rue plus agréable à vivre.`,
    goal: `${stands} ${aKind("chapel")}`
  },
  wheat: {
    action: `Construisez ${aKind("farm")} et ${aKind("mill")}.`,
    why: `${capital(theGood("bread"))} ${verb("bread", "est", "sont")} le troisième besoin, et la plus longue chaîne : ${theKind("farm")} cultive ${theGood("wheat")}, et ${theKind("mill")} en fait ${someGood("flour")}.`,
    goal: `${stands} ${aKind("farm")} et ${aKind("mill")}`
  },
  bakery: {
    action: `Construisez ${aKind("bakery")} près ${toKind("de", "mill")}.`,
    why: `${capital(it("bakery"))} cuit ${theGood("flour")} ${toKind("de", "mill")} en ${good("bread")}. Même ${a(tiers[1].home)} avec ${someGood("bread")} sur la table paie moitié plus.`,
    goal: `${stands} ${aKind("bakery")}`
  },
  citizens: {
    action: `Avec ${tool("select")}, ${tap} une maison pour voir ce qui lui manque encore pour loger des citoyens.`,
    why: `Avec ${someGood("bread")}, ${someGood("cloth")}, la foi et une rue d'attrait 5, une maison s'agrandit dès que la réserve fournit ${theGood("planks")} et ${theGood("stone")} nécessaires. Son panneau dit ce qui manque.`,
    goal: "la première maison loge des citoyens"
  },
  goals: {
    action: `Ouvrez le panneau ${tool("town")} pour voir où en sont les objectifs.`,
    why: "Les premiers citoyens sont arrivés, et chaque rang en demande une plus grande part.",
    goal: "vous ouvrez le panneau de la ville"
  },
  ranks: {
    action: `Atteignez tous les objectifs du panneau ${tool("town")} pour élever le rang de la ville.`,
    why: `Tenez-les deux minutes et la ville monte, jusqu'à devenir ${a(rank(3))}. Le rang de ${rank(2).one} ouvre les agrandissements ${toKind("de", "market")} et ${toKind("de", "chapel")}. Le guide se manifeste quand on a besoin de vous.`,
    goal: `la ville est ${a(rank(3))}`
  },

  // ── Around the course, when the town needs them ──
  crown: {
    action: "Envoyez à la couronne ce qu'elle demande, avec le bouton « envoyer » de sa demande, en haut.",
    why: "Elle paie en pièces. Une demande sans réponse coûte une amende, et trois manquées d'affilée mettent fin à votre mandat.",
    goal: "les marchandises sont envoyées"
  },
  winter: {
    action: `Construisez ${aKind("granary")} ou ${aKind("smokehouse")} avant que l'hiver arrive.`,
    why: `En hiver la pêche ralentit, les maisons mangent plus, et ${theGood("fish")} ${verb("fish", "pourrit", "pourrissent")} en réserve. ${capital(aKind("granary"))} ${them("fish")} garde cinq fois plus longtemps, et ${theGood("smoked")} ${verb("smoked", "se garde", "se gardent")} tout l'hiver.`,
    goal: `${stands} ${aKind("granary")} ou ${aKind("smokehouse")}`
  },
  tools: {
    action: `Dans le panneau ${tool("town")}, sous marchandises et commerce, mettez ${theGood("tools")} à l'achat.`,
    why: `Les ateliers usent ${theGood("tools")}, et il n'y a qu'${aKind("smithy")} pour en refaire ; ${it("smithy")} ouvre à 10 citoyens.`,
    goal: `la ville achète ${someGood("tools")}, ou qu'${stands} ${aKind("smithy")}`
  },
  forester: {
    action: `Construisez ${aKind("forester")} à côté ${toKind("de", "lumberjack")}.`,
    why: `${capital(theKind("lumberjack"))} manque d'arbres, et ${aKind("forester")} lui en replante.`,
    goal: `${stands} ${aKind("forester")}`
  },
  firewatch: {
    action: `Construisez ${aKind("firewatch")} sur une route parmi les maisons.`,
    why: `${capital(theMany(tiers[1].home))} en bois prennent feu, et le feu gagne le voisinage. Son guetteur tient le risque bas, et ses pompiers éteignent les incendies. La ${map("fire")} montre le risque.`,
    goal: `${stands} ${aKind("firewatch")}`
  },
  builder: {
    action: `Construisez ${aKind("builder")} près des bâtiments usés.`,
    why: `Un bâtiment délabré travaille à mi-régime et peut s'effondrer. Son maçon répare ce qu'il croise, avec ${someGood("planks")} et ${someGood("stone")}. La ${map("condition")} montre où ils en sont.`,
    goal: `${stands} ${aKind("builder")}`
  },
  market: {
    action: `Construisez ${aKind("market")} parmi les maisons les plus loin ${to("de", hall)}.`,
    why: `Certaines maisons sont hors de portée du colporteur ${to("de", hall)}, qui ne va qu'à 20 cases de route, et restent sans nourriture. Le colporteur ${before("d'", aKind("market"))} la porte plus loin.`,
    goal: `${stands} ${aKind("market")}`
  },
  markethall: {
    action: `${Tap} ${theKind("market")} (la flèche dorée au-dessus) et lancez ${theKind("market", 1)} depuis son panneau.`,
    why: `Certaines maisons sont hors de portée de tout colporteur. Celui ${before("d'", aKind("market", 1))} va plus loin et plus souvent, sans l'entretien ${before("d'", agree(built("market").noun, "un second", "une seconde"))} ${kind("market")}.`,
    goal: `${stands} ${aKind("market", 1)}`
  },
  street: {
    action: `Portez la rue de cette maison à un attrait de 5 : ajoutez ${aKind("chapel")}, ${aKind("market")} ou un parc tout près, et éloignez les ateliers.`,
    why: `Elle a ${someGood("bread")}, ${someGood("cloth")} et la foi, mais les citoyens ne vivent que dans une rue convenable. La ${map("appeal")} montre l'attrait rue par rue.`,
    goal: "une maison dans une belle rue loge des citoyens"
  },
  carpenter: {
    action: `Construisez ${aKind("carpenter")} : ${it("carpenter")} fait ${someGood("furniture")} avec ${someGood("planks")}.`,
    why: `${capital(theMany(tiers[3].people))} vivent dans ${some(tiers[3].home, true)}, qui veulent ${someGood("furniture")} : il en faut deux pour qu'une maison le devienne, puis un apport ${toKind("de", "market")} de temps en temps pour qu'elle le reste. Ce sont elles qui paient et logent le plus.`,
    goal: `${stands} ${aKind("carpenter")}`
  },
  healer: {
    action: `Construisez ${aKind("healer")} sur une route parmi les maisons.`,
    why: `La maladie se répand, et une maison malade loge moitié moins de monde. Le médecin ${toKind("de", "healer")} visite les maisons et les soigne. La ${map("health")} montre le risque.`,
    goal: `${stands} ${aKind("healer")}`
  },
  watchhouse: {
    action: `Construisez ${aKind("watchhouse")} sur une route parmi les maisons.`,
    why: `Les rues pauvres, les maisons à moitié vides et un faible soutien attirent les voleurs. Son sergent parcourt les rues et maintient l'ordre. La ${map("order")} montre le risque.`,
    goal: `${stands} ${aKind("watchhouse")}`
  },
  trade: {
    action: `Dans le panneau ${tool("town")}, sous marchandises et commerce, vendez une marchandise qui s'entasse, ou achetez-en une qui manque.`,
    why: "La ville ne commerce rien tant que vous ne le lui dites pas, et les surplus sont des pièces qui n'attendent que vous.",
    goal: "la ville vend ou achète quelque chose"
  },
  taxes: {
    action: `Montez un peu les impôts dans le panneau ${tool("town")}.`,
    why: "La ville est contente mais perd des pièces, et son soutien peut porter des impôts plus lourds. Au-delà de 125 %, la rancune s'installe pour longtemps.",
    goal: "un taux d'imposition change"
  },
  smithy: {
    action: `Construisez ${aKind("mine")} près des rochers sombres veinés de rouille, et ${aKind("smithy")}.`,
    why: `${runsLow("tools")}, et chaque atelier en use. ${capital(theKind("mine"))} extrait ${theGood("ore")}, et ${theKind("smithy")} en fait ${someGood("tools")}.`,
    goal: `${stands} ${aKind("mine")} et ${aKind("smithy")}`
  }
} satisfies Record<GuideStepId, Step>

/** What is happening, once the mayor has done a step's part and the town is at work on it. */
const waiting = {
  homesNoPlanks: () => `Les maisons attendent ${someGood("planks")}, et la réserve n'en a pas.`,
  homesRising: () => `Les ouvriers portent ${theGood("planks")} de la réserve aux nouvelles maisons, et les colons emménagent dès qu'une maison est bâtie. ${speed}`,
  siteNoPlanks: () => `La réserve n'a plus ${ofGood("planks")}, alors le chantier attend : vendez quelque chose dans le panneau ${tool("town")}, ou achetez-y ${someGood("planks")}.`,
  siteRising: () => `C'est un chantier pour l'instant : les porteurs apportent ${theGood("planks")} et ${theGood("stone")} de la réserve, puis les ouvriers montent le bâtiment. ${speed}`,
  homesLaid: () => "Dix maisons sont tracées : les ouvriers les bâtissent."
} satisfies Wording<GuideWaiting>

/** Why the town cannot build what a step asks for yet, and what to do meanwhile. */
const locked = {
  residents: (l) => `${capital(theKind(l.kind))} ouvre à ${l.needs} habitants (actuellement ${l.now}) : posez d'autres ${tool("homes")} et nourrissez-les.`,
  citizens: (l) => `${capital(theKind(l.kind))} ouvre à ${l.needs} citoyens (actuellement ${l.now}).`,
  coins: (l) => `Économisez : ${theKind(l.kind)} coûte ${count(l.cost, coin)} (actuellement ${l.now}). Les maisons paient des impôts chaque minute.`
} satisfies Wording<GuideLocked>

/** The next step that waits for the town to need it: what it will ask for, and when it comes. */
const below = (id: GoodId, s: { readonly below: number; readonly now: number }) =>
  `quand ${theGood(id)} ${verb(id, "passe", "passent")} sous ${s.below} (actuellement ${s.now})`
const upcoming = {
  lumberjack: (s) => `Ensuite : ${aKind("lumberjack")} et ${aKind("sawmill")}, ${below("planks", s)}.`,
  sawmill: (s) => `Ensuite : ${aKind("sawmill")}, ${below("planks", s)}.`,
  quarry: (s) => `Ensuite : ${aKind("quarry")}, ${below("stone", s)}.`
} satisfies Wording<GuideSoon>

export const guide = { chapters, steps, waiting, locked, upcoming } satisfies typeof English
