/**
 * French for the page itself (`ui/dom` and what starts it, `app/browser.ts`):
 * its buttons, headings, tooltips, dialogs, and the chips a message's tokens
 * become. The same entries as English, part for part (`satisfies` holds it
 * to them).
 *
 * The page speaks to the mayor as "vous", in the imperative ("Construisez",
 * "Choisissez"), as French game interfaces do; a button or a tooltip that
 * names what it does is in the infinitive ("Fonder une nouvelle ville",
 * "Partager l'image"), as French buttons are.
 *
 * As in English, what a part shows through markup may hold tokens, what it
 * sets as plain text is words alone, and a sentence with the page's own
 * markup set into it takes each piece as a string and says where it goes.
 * French orders some of them its own way, and turns a sentence where an
 * English one would need an agreement the page cannot know (a good's gender
 * in a slot, a building's in a status, a rank's in a verdict).
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
import { a, agree, before, capital, count, f, form, m, of, ofA, percent, signed, some, the, theArticle, theMany, to, toMany, type Noun, type Preposition } from "./grammar.ts"
import { built, goods, grounds, lands, names, props, quantity, rankNoun, sizes, tiers, winters } from "./nouns.ts"
import { amount } from "./said.ts"

/** A number with its sign as a slider or a chip shows it: "+4", "-4", "0". */
const plus = (n: number) => `${n > 0 ? "+" : ""}${n}`
/** A number that may have a fraction, with French's comma: "2,5", "0,05". */
const figure = (n: number) => `${n}`.replace(".", ",")

/** A building's noun, as built or at a level of its upgrades. */
const kind = (id: KindId, level = 0): Noun => built(id, level).noun

// A good as the town speaks of it is in one number: what comes in pieces is many ("les planches"), the rest is one ("le pain").
// Its article, a preposition joined to it, the pronoun that stands for it, and a participle said of it all follow that.
/** "les planches", "le pain", "les outils". */
const theGood = (id: GoodId): string => before(theArticle(goods[id], goods[id].counted), goods[id].name)
/** "des planches", "du pain", "aux outils". */
const toGood = (preposition: Preposition, id: GoodId): string => (goods[id].counted ? toMany(preposition, goods[id]) : to(preposition, goods[id]))
/** "des planches", "du bois", "de la laine". */
const someGood = (id: GoodId): string => some(goods[id], goods[id].counted)
/** "de planches", "d'outils", "de pain". */
const ofGood = (id: GoodId): string => of(goods[id], goods[id].counted)
/** The pronoun for a good as a verb's object, before the verb: "le", "la", "les", and "l'" before a vowel ("l'abattent"). */
const them = (id: GoodId, verb: string): string => (goods[id].counted ? `les ${verb}` : before(/^[aeiouyéèêh]/i.test(verb) ? "l'" : agree(goods[id], "le", "la"), verb))
/** The same pronoun after an imperative: "achetez-les", "achetez-le". */
const themAfter = (id: GoodId): string => (goods[id].counted ? "les" : agree(goods[id], "le", "la"))
/** The pronoun for a good as a verb's subject: "il", "elle", "ils", "elles". */
const it = (id: GoodId): string => (goods[id].counted ? agree(goods[id], "ils", "elles") : agree(goods[id], "il", "elle"))
/** A participle said of a good: "apporté" gives "apporté", "apportée", "apportés", "apportées". */
const done = (id: GoodId, stem: string): string => `${stem}${agree(goods[id], "", "e")}${goods[id].counted ? "s" : ""}`
/** A verb said of a good, in the good's number: "pourrit" or "pourrissent". */
const verb = (id: GoodId, one: string, many: string): string => (goods[id].counted ? many : one)

const settlers = tiers[1].people, citizens = tiers[2].people, burghers = tiers[3].people
const cottage = tiers[1].home, citizensHome = tiers[2].home, townhouse = tiers[3].home
const winter = m("hiver"), missed = f("demande manquée", "demandes manquées"), cell = f("case"), coin = f("pièce"), hall = kind("townhall")
/** How far a walk may go: "à 15 cases de route au plus". */
const within = `à ${COMMUTE} cases de route au plus`

/** What the bar a held stroke waits at calls its button: the messages that send a finger to it name it by this. */
const lay = "Bâtir"

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

/** A land in words: "terre moyenne et passable". */
const landOf = (size: SizeId, land: LandId) => `terre ${sizes[size]} et ${lands[land].name}`

export const page = {
  /** What a building's chip in a message says on hover. */
  chips: {
    goTo: (id: KindId): string => `Aller ${to("à", kind(id))}`,
    /** A row that places a building, on hover. */
    place: (id: KindId): string => `Construire ${a(kind(id))}`,
    build: (id: KindId): string => `Construire ${a(kind(id))} : ${built(id).blurb}`
  },
  /** How long ago a save was made, roughly. */
  ago: {
    now: "à l'instant",
    minutes: (n: number): string => `il y a ${n} min`,
    hours: (n: number): string => `il y a ${n} h`,
    yesterday: "hier",
    days: (n: number): string => `il y a ${n} jours`
  },
  /** Words more than one part of the page says. */
  common: {
    close: "Fermer",
    closeEsc: "Fermer (Échap)",
    cancel: "Annuler",
    /** A section's ⓘ. */
    whatThisMeans: "Ce que cela veut dire",
    showWhere: "Me montrer où",
    dismiss: "Ignorer",
    coins: "pièces"
  },

  // ── The map and its tools ───────────────────────────────────────────────

  /** What picking something to put on the map says, and the bar a held stroke waits at. */
  map: {
    place: (id: KindId): string => {
      const what = kind(id)
      return token.device(`Touchez un endroit pour ${the(what)}, puis touchez-le à nouveau pour bâtir`, `Cliquez pour placer ${a(what)} · Échap pour arrêter`)
    },
    layGround: (id: GroundId): string => {
      const what = grounds[id].noun
      return token.device(`Tracez un rectangle pour poser ${the(what)}, puis touchez ${lay}`, `Tracez un rectangle pour poser ${the(what)} · Échap pour arrêter`)
    },
    furnish: (id: PropId): string => {
      const what = props[id].noun
      return token.device(`Touchez une case de parc pour ${the(what)}, puis touchez-la à nouveau pour l'installer`, `Cliquez sur une case de parc pour installer ${a(what)} · Échap pour arrêter`)
    },
    /** A touch tap that holds what it would do: tapped again, it does it. What it would remove is not known here, so neither says "it". */
    tapAgain: { remove: "touchez à nouveau pour enlever", build: "touchez à nouveau pour bâtir ici" },
    overlays: "Vues de la carte",
    stroke: { build: lay, cancel: "Annuler" }
  },
  toolbar: {
    town: { label: "ville", title: "Objectifs, chiffres, impôts et commerce de la ville (T)" },
    more: "Partager, le guide, sauvegarder, charger, nouvelle ville",
    pause: "Mettre la ville en pause, ou la relancer (espace)",
    /** A speed's button: "Faire tourner la ville à 2× (2)". */
    runAt: (speed: string, key: string): string => `Faire tourner la ville à ${speed} (${key})`,
    cycle: "Changer de vitesse : 1×, 2×, 4×",
    /** The pause switch, read aloud: what pressing it does now. */
    run: "Relancer la ville",
    pauseNow: "Mettre la ville en pause",
    runAtLast: (last: number): string => `Faire tourner la ville à ${last}×`
  },
  mapViews: {
    title: "vues de la carte",
    help: "Colorez la carte selon l'une d'elles, pour voir où la ville va bien ou mal. Appuyez à nouveau sur la touche (ou cliquez) pour la masquer.",
    // A view's label is a bare noun ("attrait", "incendie"): it is named as a view, so no article has to agree with it.
    show: (label: string, key: string): string => `Afficher la vue « ${label} » sur la carte (${key}) ; encore une fois pour la masquer`
  },
  /** Share, the guide, save, load, and new town: each button's label and what it says on hover. */
  system: {
    share: { label: "partager", tip: "Partager une image de la ville, ou un lien que tout le monde peut ouvrir pour la regarder et continuer à jouer" },
    guide: {
      label: "guide",
      tip: "Activer ou couper le guide : il dit à un nouveau maire quoi faire ensuite, et pourquoi",
      turnOn: "Réactiver le guide : la prochaine étape, et pourquoi, en haut du fil",
      turnOff: "Couper le guide"
    },
    language: { label: "langue", tip: "Choisir la langue du jeu" },
    save: { label: "sauver", tip: "Sauvegarder la ville dans ce navigateur (elle se sauvegarde aussi toute seule toutes les deux minutes)" },
    load: { label: "charger", tip: "Charger la dernière sauvegarde : la vôtre ou l'automatique, la plus récente des deux" },
    newTown: { label: "fonder", tip: "Fonder une nouvelle ville sur une nouvelle terre" },
    recentre: { label: "recentrer", tip: "Revenir à l'angle et au centre de départ" },
    leave: {
      load: leave("charger la dernière sauvegarde ?", "La ville telle qu'elle est sera remplacée par la dernière sauvegarde (la vôtre ou l'automatique).", "Sauvegarder, puis charger", "Charger sans sauvegarder"),
      newTown: leave("fonder une nouvelle ville ?", "Cette ville sera perdue pour de bon, à moins de la sauvegarder d'abord.", "Sauvegarder, puis choisir une terre", "Choisir une terre sans sauvegarder"),
      stay: "Continuer à jouer"
    }
  },
  /** The camera bar in the map's corner (the renderer draws it): its two drag modes, the zoom, and the way back. */
  camera: {
    label: "Caméra de la carte",
    pan: { label: "Déplacer", title: "Faites glisser pour vous déplacer ; les outils route, paver, maisons et terrain de parc tracent en glissant" },
    rotate: { label: "Pivoter", title: "Faites glisser pour faire pivoter au lieu de placer. Glisser avec le bouton droit fait aussi pivoter, et Q et E tournent d'un huitième." },
    zoomOut: "Dézoomer",
    zoom: "Zoom de la caméra",
    zoomIn: "Zoomer",
    reset: { label: "Réinitialiser la caméra", title: "Angle et centre de départ (Début)" }
  },
  /** Choosing the language: every language is listed by its own name, so only what is around the list is said here. */
  language: {
    /** On the language now in use, read aloud. */
    current: (name: string): string => `${name} (en cours)`,
    /** The browser would not keep the choice, so the page stays as it is. */
    notKept: "Ce navigateur n'a pas gardé le choix, donc la langue reste la même"
  },
  /** The maker's credit: what each link is, read aloud. */
  credit: {
    typeonce: "Typeonce Games : d'autres jeux de l'auteur d'Inkline Town",
    ritmo: "ritmo sur GitHub : le runtime ECS avec lequel Inkline Town est fait",
    madeWith: "Fait avec",
    madeBy: "Fait par Typeonce",
    newTab: (label: string): string => `${label} (s'ouvre dans un nouvel onglet)`
  },

  // ── The heads-up display ────────────────────────────────────────────────

  hud: {
    /** What each good is for: who makes it, who takes it. */
    goods: {
      // The goods' help names the people at work ("les bûcherons", "les bergers") where English does, and their buildings elsewhere.
      wood: `les bûcherons ${them("wood", "abattent")} ; ${a(kind("sawmill"))} ${them("wood", "scie")} en ${goods.planks.name}`,
      planks: `ce dont on bâtit maisons et bâtiments : ${a(kind("sawmill"))} ${them("planks", "tire")} ${toGood("de", "wood")}`,
      stone: `pour bâtir et paver : ${theMany(kind("quarry"))} ${them("stone", "taillent")} dans les rochers, qui s'épuisent`,
      ore: `seulement pour ${theGood("tools")} : dès que la ville a 10 ${citizens.other}, ${a(kind("mine"))} ${them("ore", "extrait")} des gisements couleur rouille, et ${a(kind("smithy"))} en fait ${someGood("tools")}`,
      tools: `pour bâtir, et les ateliers en usent ${agree(goods.tools, "un", "une")} tous les 50 ou 60 travaux : ${a(kind("smithy"))} en fait, ou achetez-${themAfter("tools")}`,
      fish: `nourriture des ${settlers.other} : ${theMany(kind("fishery"))} ${them("fish", "pêchent")} au bord de l'eau ; ${it("fish")} ${verb("fish", "pourrit", "pourrissent")} en trois minutes environ`,
      smoked: `${goods.fish.name} qui se garde tout l'hiver : ${a(kind("smokehouse"))} ${them("fish", "fume")}`,
      wheat: `${theMany(kind("farm"))} ${them("wheat", "cultivent")} ; ${a(kind("mill"))} ${them("wheat", "moud")} en ${goods.flour.name} (pas en hiver)`,
      flour: `${verb("flour", "vient", "viennent")} ${to("de", kind("mill"))} ; ${a(kind("bakery"))} ${them("flour", "cuit")} en ${goods.bread.name}`,
      bread: `nourriture dont ${theMany(citizens)} ont besoin, et ${a(cottage)} avec ${someGood("bread")} paie moitié plus : ${it("bread")} ${verb("bread", "pourrit", "pourrissent")} en cinq minutes environ`,
      wool: `les bergers ${them("wool", "tondent")} ; ${a(kind("weaver"))} ${them("wool", "tisse")} en ${goods.cloth.name}`,
      cloth: `${theMany(citizens)} en ont besoin : ${it("cloth")} ${verb("cloth", "n'est", "ne sont")} ${done("cloth", "apporté")} que dans les rues d'attrait 5 ou plus`,
      furniture: `${theMany(burghers)} en ont besoin dans leurs ${townhouse.other} : ${a(kind("carpenter"))} ${them("furniture", "fait")} avec ${someGood("planks")} ; ${it("furniture")} ${verb("furniture", "n'est", "ne sont")} ${done("furniture", "apporté")} que dans les rues assez belles pour ${theMany(townhouse)}`
    } satisfies Record<GoodId, string>,
    /** A good and what it is for: "planches : ce dont on bâtit maisons et bâtiments…". */
    good: (name: string, help: string): string => `${name} : ${help}`,
    /** A good's last minute, under what it is for. Said in nouns (what was made, what was used), so nothing has to agree with the good. */
    goodFlow: (flow: { readonly made: number; readonly used: number; readonly traded: number; readonly stock: number; readonly elsewhere: number }): string =>
      `Dernière minute : production ${flow.made}, consommation ${flow.used}${flow.traded !== 0 ? `, ${flow.traded > 0 ? "achats" : "ventes"} ${Math.abs(flow.traded)}` : ""}. ${flow.stock} en réserve, ${flow.elsewhere} en ville (dans les ateliers et les marchés, et en chemin).`,
    stock: "Les marchandises en réserve, et dans quel sens va chacune · cliquez pour voir ce que la ville produit et consomme",
    goodsChip: "Les marchandises en réserve",
    folk: "Ouvrir les chiffres, les objectifs et les leviers de la ville (T)",
    treasury: {
      plain: "Pièces au trésor, et ce qu'il gagne (ou perd) par minute au rythme actuel · cliquez pour la dernière minute de la ville",
      counted: (flow: { readonly change: number; readonly made: number; readonly used: number; readonly traded: number; readonly net: number }): string =>
        `Pièces au trésor · cliquez pour la dernière minute de la ville\nDernière minute : ${signed(flow.change)} (recettes ${flow.made}, dépenses ${flow.used}${flow.traded !== 0 ? `, commerce ${signed(flow.traded)}` : ""})\nAu rythme actuel : ${signed(flow.net)}/min (impôts, commerce, entretien, administration)`
    },
    clock: {
      paused: "en pause",
      /** Under the clock: "an 2 · hiver dans 3:20 (rude)". `until` is one of the three below. */
      year: (year: number, until: string): string => `an ${year} · ${until}`,
      // Under the clock there is one short line: when the winter ends says when spring comes, in fewer letters.
      winter: (severity: WinterId, spring: string): string => `${winter.one} ${winters[severity]} · fin dans ${spring}`,
      winterIn: (left: string, coming: WinterId): string => `${winter.one} dans ${left} (${winters[coming]})`,
      noMoreWinters: "plus d'hiver ce mandat",
      /** The clock on hover: the season, the almanac's next two winters (`null`: beyond the term), and what each kind does to a catch (percent). */
      title: (c: { readonly winter: boolean; readonly coming: WinterId | null; readonly after: WinterId | null; readonly fishing: Readonly<Record<WinterId, number>> }): string =>
        `${c.winter ? "Hiver : les champs dorment, la pêche est lente et les maisons mangent plus vite" : "Temps restant du mandat"}\nL'almanach : le prochain hiver sera ${c.coming === null ? "au-delà du mandat" : winters[c.coming]}, le suivant ${c.after === null ? "au-delà du mandat" : winters[c.after]}.\n${capital(winters.mild)} : pêche à ${percent(c.fishing.mild)}. ${capital(winters.normal)} : ${percent(c.fishing.normal)}. ${capital(winters.hard)} : moitié plus long, pêche à ${percent(c.fishing.hard)}, et les maisons qui se chauffent risquent le feu.`
    },
    approval: "soutien",
    settlers: settlers.other,
    citizens: citizens.other,
    /** Beside the citizens, once there are any: "· 12 bourgeois". */
    burghers: (n: number): string => count(n, burghers),
    jobs: {
      short: (n: number): string => `${count(n, m("manquant"))} · cliquez`,
      filled: "postes pourvus",
      filledTitle: `Travailleurs à l'ouvrage sur travailleurs requis : chaque lieu de travail a son équipe. Les habitants marchent au plus ${COMMUTE} cases de route pour aller travailler.`,
      /** How many workplaces are short, and the first few of them. */
      shortTitle: (n: number, places: ReadonlyArray<ShortPlace>): string =>
        `Travailleurs à l'ouvrage sur travailleurs requis. ${n > 1 ? `${n} lieux de travail manquent` : "Un lieu de travail manque"} de bras : ${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? ` (aucune maison ${within})` : ""}`).join(", ")}. Cliquez pour les visiter tour à tour.`
    },
    /** The goods' last minute, side by side: each column, and what it counts. */
    flow: {
      counting: "On compte les marchandises de la ville : les premiers chiffres arrivent dans une demi-minute…",
      made: { label: "produit", title: "Produit par les ateliers et les exploitations pendant la dernière minute" },
      used: { label: "utilisé", title: "Mangé, transformé, utilisé pour bâtir, pourri ou envoyé pendant la dernière minute" },
      traded: { label: "échangé", title: "Acheté (+) ou vendu (−) pendant la dernière minute" },
      storage: { label: "réserve", title: `Dans ${the(hall)}, ${theMany(kind("warehouse"))} et ${theMany(kind("granary"))}` },
      about: { label: "en ville", title: `Dans les ateliers et ${theMany(kind("market"))}, les paniers des colporteurs et les caisses des porteurs` }
    },
    /** The crown's request: `amount` and `good` are set in bold, the good with its icon. */
    crown: {
      // The good comes first, the number after it: "20 planches" but "20 sacs de farine", and the page hands the two as separate pieces.
      asks: (n: string, good: string): string => `${good} pour la couronne : ${n}`,
      inStore: (n: number): string => `${n} en stock`,
      /** What is in store (coloured by whether it is enough), when it is due (bold), and what it pays. */
      terms: (inStore: string, due: string, reward: string): string => `${inStore} · reste ${due} · ${reward}`,
      reward: (coins: number): string => amount.coins(coins, true),
      send: "envoyer",
      sendTitle: (good: GoodId, n: number, reward: number): string => `Envoyer ${quantity(good, n)} à la couronne contre ${amount.coins(reward)}`,
      notEnough: (good: GoodId): string => `Pas encore assez ${ofGood(good)} en réserve`
    },
    /** What threatens the term, or is about to raise the town a rank: `left` is a clock. */
    warnings: {
      bankruptIn: (left: string) => warning("Dettes :", `faillite dans ${left} si le trésor ne se redresse pas`),
      debt: warning("Dettes :", "les salaires ne sont plus payés"),
      revoltIn: (left: string) => warning("Colère :", `la ville chasse le maire dans ${left}`),
      restless: warning("Agitation :", "le soutien glisse vers la révolte"),
      emptying: warning("Exode :", "les habitants quittent la ville"),
      patience: (streak: number) => warning("La patience de la couronne :", `${count(streak, missed)} d'affilée ; une de plus et le maire est destitué`),
      /** Every goal of the next rank (`to`) is met and holding. */
      rises: (next: number, left: string) => warning("Tous les objectifs atteints :", `la ville devient ${a(rankNoun(next))} dans ${left}`)
    }
  },

  // ── The ticker ──────────────────────────────────────────────────────────

  ticker: {
    bulb: "Le guide, et ce qui demande votre attention",
    tucked: "Le guide est dans l'ampoule en haut à droite",
    guideOff: "Guide coupé · réactivez-le en bas à droite",
    /** How long ago a piece of news happened, in the town's own time. */
    ago: {
      now: "à l'instant",
      seconds: (n: number): string => `il y a ${n} s`,
      minutes: (n: number): string => `il y a ${n} min`
    },
    /** The guide's heading: "guide · Fondation". */
    guide: (chapter: string): string => `guide · ${chapter}`,
    step: (at: number, of: number): string => `étape ${at} sur ${of}`,
    firstSteps: "Les premiers pas d'une nouvelle ville",
    hide: "couper",
    hideTitle: "Couper le guide (le bouton du guide, en bas à droite, le réactive)",
    /** Under a step: what closes it. `goal` is the step's own words. */
    doneWhen: (goal: string): string => `fait quand ${goal}`,
    skip: "Passer cette étape",
    tuck: "Masquer : le guide reste dans l'ampoule en haut à droite",
    now: "maintenant",
    lately: "récemment"
  },

  // ── The panels ──────────────────────────────────────────────────────────

  town: {
    title: "ville",
    /** Under the heading: "terre moyenne et passable · un village · mandat 2, 60 minutes". */
    sub: (c: { readonly size: SizeId; readonly land: LandId; readonly rank: number; readonly term: number; readonly minutes: number }): string =>
      `${landOf(c.size, c.land)} · ${a(rankNoun(c.rank))} · mandat ${c.term}, ${c.minutes} minutes`,
    seed: (seed: number): string => `graine ${seed}`,
    goals: {
      title: "objectifs",
      help: `La ville grandit ${of(rankNoun(0))} en ${rankNoun(1).one}, puis en ${rankNoun(2).one} et en ${rankNoun(3).one}. Atteignez à la fois tous les objectifs du rang suivant et tenez-les deux minutes : la couronne envoie une récompense, et la partie continue. Un rang ne se perd jamais.`,
      top: (now: number): string => `${capital(a(rankNoun(now)))}, le plus haut rang : ${agree(rankNoun(now), "maintenez-le", "maintenez-la")} debout, mandat après mandat.`,
      holding: (now: number, left: string): string => `Tous atteints : tenez-les encore ${left} et ${the(rankNoun(now))} devient ${a(rankNoun(now + 1))}.`,
      toward: (now: number): string => `${capital(a(rankNoun(now)))} pour l'instant : ceux-ci en font ${a(rankNoun(now + 1))}.`
    },
    approval: {
      title: "soutien",
      help: "Les maisons logent plus d'habitants quand le soutien est haut, et moins quand il est bas. À −50 pendant deux minutes, la ville chasse le maire.",
      heading: "actuel → visé"
    },
    treasury: {
      title: "trésor",
      help: `Pièces par minute. Les impôts ne viennent que des maisons nourries, à proportion des besoins satisfaits. L'administration se compte par maison et croît plus vite que la ville : dans une grande ville, ${agree(cottage, "un autre", "une autre")} ${cottage.one} coûte à peu près ce qu'${agree(cottage, "il", "elle")} rapporte, alors qu'${a(citizensHome)} ou ${a(townhouse)} loge deux ou trois fois plus de monde pour le même coût. Trois minutes de dettes et la ville fait faillite.`,
      taxes: "impôts",
      supplied: "si toutes les maisons étaient fournies",
      trade: "commerce",
      upkeep: "entretien",
      admin: "administration",
      net: "par minute",
      /** The sum of the above, with its sign: "+12 pièces". */
      netCoins: (n: number): string => amount.coins(n, true),
      leftOnTable: (gap: number): string => `${amount.rate(gap)} de manque à gagner : une maison affamée ne paie rien, ${a(cottage)} avec ${someGood("bread")} paie moitié plus, une belle rue un quart de plus`
    },
    taxes: {
      title: "taux d'imposition",
      help: `Des impôts plus bas font monter le soutien, des impôts plus hauts le font baisser, selon le nombre d'habitants de chaque rang. Au-delà de 100 % certains habitants s'en vont aussi, ${theMany(settlers)} avant ${theMany(citizens)}, donc un taux plus haut ne rapporte pas toujours plus : sous chaque taux figure ce que paieraient les maisons à chaque palier, une fois installées. Au-delà de ${percent(mood.grudge.above)}, la ville garde aussi une rancune qui survit au taux : baisser les impôts à la fin n'efface pas un mandat passé à pressurer.`,
      slider: "Faites glisser pour fixer le taux ; double-cliquez pour revenir aux 100 % habituels",
      /** What a rate does to approval (`sway`: 0 at the usual rate), and whether it is high enough to leave a grudge. */
      effect: (sway: number, grudge: boolean): string =>
        `${sway === 0 ? "le taux habituel" : `${signed(sway)} de soutien`}${grudge ? " · une rancune grandit tant qu'il reste aussi haut, et s'efface lentement" : ""}`,
      /** Taxes a minute at each step of the rate, and the step that brings in most. */
      outlook: (steps: ReadonlyArray<{ readonly rate: number; readonly taxes: number }>, best: number): string =>
        `impôts par minute, une fois stabilisés : ${steps.map((o) => `${percent(o.rate)} ${o.taxes}`).join(" · ")} · au plus haut à ${percent(best)}`,
      outlookTitle: "Impôts par minute de toutes les maisons si ce taux restait en place et que les maisons s'y faisaient : les habitants partent au-delà de 100 %, et le soutien suit le taux"
    },
    people: {
      title: "habitants",
      settlers: settlers.other,
      citizens: citizens.other,
      burghers: `dont ${burghers.other}`,
      homes: "maisons",
      jobs: "postes pourvus",
      jobsOf: (employed: number, jobs: number): string => `${employed} sur ${jobs}`,
      staffed: "chaque lieu de travail a son équipe",
      /** How many workplaces are short, the first few (`more`: there are others), and where to find them. */
      short: (n: number, places: ReadonlyArray<ShortPlace>, more: boolean): string =>
        `${n} à court de bras : ${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? " (personne à portée)" : ""}`).join(", ")}${more ? ", …" : ""} · cliquez sur le compteur d'emplois pour les visiter`
    },
    needs: {
      title: "maisons fournies",
      help: `Une maison affamée ne paie pas d'impôts. ${capital(theMany(settlers))} ont besoin de nourriture (${goods.fish.name}, ${goods.smoked.name} ou ${goods.bread.name}) venue ${ofA(kind("market"))}, et ${a(cottage)} qui a aussi ${someGood("bread")} paie moitié plus ; une visite donne à une maison un poisson ou un pain pour quatre habitants, si bien qu'${a(citizensHome)} mange deux fois plus qu'${a(cottage)}, et ${a(townhouse)} trois fois plus ; ${theMany(citizens)} et ${theMany(burghers)} ont besoin ${ofGood("bread")}, ${ofGood("cloth")} et de foi, et ${theMany(burghers)} en plus ${someGood("furniture")} ${ofA(kind("carpenter"))}. ${capital(theGood("cloth"))} ${verb("cloth", "n'est", "ne sont")} ${done("cloth", "apporté")} que dans les rues d'attrait 5 ou plus, ${theGood("furniture")} dans celles de 12 ou plus. ${capital(theGood("fish"))} ${verb("fish", "pourrit", "pourrissent")} en trois minutes environ et ${theGood("bread")} en cinq ; ${a(kind("granary"))} les garde cinq fois plus longtemps.`,
      larder: "nourriture en réserve",
      eaten: "mangé · pourri en 1 min",
      trouble: "maisons malades · en feu"
    },
    crown: {
      title: "la couronne",
      help: "Envoyer ce que la couronne demande rapporte des pièces. Une demande manquée coûte une amende, et la ville se souvient un moment de l'affront ; trop de demandes manquées d'affilée, et la couronne destitue le maire.",
      tally: "demandes honorées · manquées",
      /** An open request: `what` (so many of a good) is set in bold. */
      wants: (what: string, left: string, reward: string): string => `Veut ${what} · reste ${left} · ${reward}`,
      what: (good: GoodId, n: number): string => quantity(good, n),
      reward: (coins: number): string => amount.coins(coins, true),
      next: (left: string, patience: number): string => `Prochaine demande dans ${left} · ${patience} manquées d'affilée mettent fin au mandat`
    },
    trade: {
      title: "marchandises et commerce",
      help: "Les marchands passent toutes les quelques secondes. Faites glisser le curseur d'une marchandise à gauche pour la vendre au-delà de ce que la ville garde, à droite pour l'acheter jusqu'à ce niveau (au prix majoré de moitié) ; plus loin, plus à chaque passage ; au milieu, ni vente ni achat. Les prix baissent quand la ville vend et montent, trois fois plus vite, quand elle achète ; un prix élevé ne se calme que lentement, alors acheter comble un manque, mais une ville nourrie d'achats paie plus cher chaque minute.",
      keep: "garder en réserve",
      keepTitle: "Ce que la ville garde de chaque marchandise : elle ne vend qu'au-delà, et n'achète que jusque-là",
      keepNote: "de chaque marchandise : vendu seulement au-delà, acheté seulement jusque-là",
      deal: (good: GoodId): string =>
        `Faites glisser à gauche pour vendre ${theGood(good)}, à droite pour ${them(good, "acheter")} ; plus loin, plus à chaque passage des marchands. Double-cliquez pour arrêter d'en faire commerce.`,
      /** What a good's slider is set to: nothing, or the most it sells or buys a minute. */
      none: "neutre",
      sell: (most: number): string => `vente ≤${most}/min`,
      buy: (most: number): string => `achat ≤${most}/min`,
      /** A good's price in coins ("p", for pièces), and (when it is not the usual) in percent of the usual: "3,5 p (120 %)". */
      price: (coins: number, usual: number | null): string => `${figure(coins)} p${usual === null ? "" : ` (${percent(usual)})`}`,
      asks: "ce que les marchands en demandent, à l'unité",
      pays: "ce que les marchands en paient, à l'unité"
    },
    chronicle: "chronique"
  },
  build: {
    title: "bâtir",
    sub: token.device("Choisissez-en un, puis touchez la carte là où il va", "Choisissez-en un, puis cliquez sur la carte · Échap pour arrêter"),
    categories: { storage: "stockage", gathering: "récolte", crafts: "ateliers", food: "nourriture", services: "services" } satisfies Record<Category, string>,
    cost: "coût",
    does: "rôle",
    /** What keeps the town from building something yet, in place of what it is for. */
    needsResidents: (n: number): string => `il faut ${n} habitants`,
    needsCitizens: (n: number): string => `il faut ${n} ${citizens.other}`,
    /** What each of a building's chips says on hover. */
    recipe: (r: { readonly input: GoodId | null; readonly inputs: number; readonly output: GoodId; readonly batch: number; readonly seconds: number }): string =>
      `${r.input ? `transforme ${quantity(r.input, r.inputs)} en ${quantity(r.output, r.batch)}` : `produit ${quantity(r.output, r.batch)}`} toutes les ${figure(r.seconds)} s`,
    serves: (range: number): string => `ses tournées desservent les maisons jusqu'à ${range} cases de route de sa porte`,
    holds: (cap: number, keeps: number | null): string => `contient jusqu'à ${cap} de chaque marchandise${keeps === null ? "" : `, et garde la nourriture ${keeps} fois plus longtemps`}`,
    // "to work it" would need the building's gender: "pour y travailler" (to work there) needs none.
    crew: (workers: number, tier: Tier): string => `${count(workers, tiers[tier].people)} pour y travailler, depuis des maisons ${within}`,
    appeal: (value: number, reach: number): string => `attrait ${plus(value)} à côté, jusqu'à ${count(reach, cell)}${value < 0 ? " : tenez les maisons à l'écart" : " : les maisons l'apprécient"}`,
    upkeep: "entretien : pièces par minute tant que le bâtiment est debout (un quart en pause)",
    /** A building's whole line on hover: what it is, who works it, how far it reaches, what it does to its street, and what it costs to keep. */
    option: (id: KindId, k: { readonly workers: number; readonly citizens: boolean; readonly range: number | null; readonly appeal: { readonly value: number; readonly reach: number } | null; readonly upkeep: number }): string =>
      `${names.kind.title(id)} : ${built(id).blurb}${k.workers > 0 ? ` · ${count(k.workers, k.citizens ? citizens : settlers)} au travail, ${within}` : ""}${k.range === null ? "" : ` · tournées jusqu'à ${k.range} cases de route`}${k.appeal ? ` · attrait ${plus(k.appeal.value)} jusqu'à ${count(k.appeal.reach, cell)}` : ""} · ${amount.rate(k.upkeep)}`,
    parks: {
      title: "parcs",
      help: `Posez du terrain, puis installez-y du décor. Le terrain qui se touche forme un seul parc : plus il est garni, plus les rues alentour sont belles (il faut ${home.tiers[2].appeal} ${toMany("à", citizens)}, ${home.tiers[3].appeal} ${toMany("à", townhouse)}). Un élément de décor compte pour ${park.cellsPerProp} cases ; là où des parcs se rejoignent, le plus beau compte en entier.`,
      ground: "terrain · tracez un rectangle",
      furnishings: "décor · cliquez sur une case de parc",
      beauty: "beauté ajoutée à son parc",
      upkeep: "entretien, pièces par minute",
      /** A park piece's whole line on hover: `name` and `blurb` are its own. */
      piece: (name: string, blurb: string, p: { readonly beauty: number; readonly upkeep: number; readonly ground: boolean }): string =>
        `${name} : ${blurb} · beauté +${figure(p.beauty)}${p.ground ? " la case" : ""} · ${figure(p.upkeep)} ${form(p.upkeep, coin)} par minute`
    }
  },
  /** The panel of what is picked: a building, a home, a park, or a ruin. */
  selection: {
    park: "parc",
    ruin: "ruine",
    /** Under the heading: who lives in a home of each tier, and what a ruin or a park is for. */
    home: {
      1: `ici vivent ${theMany(settlers)}, qui font les gros travaux`,
      2: `ici vivent ${theMany(citizens)}, qui font le travail qualifié et paient deux fois plus`,
      3: `ici vivent ${theMany(burghers)}, qui paient les meilleurs impôts`
    } satisfies Record<Tier, string>,
    aboutRuin: "rasez-la pour dégager le terrain",
    aboutPark: "toutes les cases de terrain qui touchent celle-ci : posez-en d'autres, ou installez-y du décor, pour embellir les rues alentour",
    status: "état",
    /** How a building is, in a word, when nothing is wrong with it: phrases that agree with no building, whatever its gender. */
    statuses: {
      building: "en chantier",
      idle: "au repos",
      working: "au travail",
      starved: "en manque",
      blocked: "sans débouché",
      unstaffed: "sans travailleurs",
      unconnected: "sans route",
      paused: "en pause"
    } satisfies Record<Status, string>,
    // Said of the ruin ("ruine", above): feminine.
    causes: { burnt: "brûlée", collapsed: "effondrée", derelict: "abandonnée" } satisfies Record<Extract<Panel, { readonly type: "ruin" }>["cause"], string>,
    /** A park's worth in a word: the desirability it gives, and how far. */
    parkWorth: (value: number, reach: number): string => `${plus(value)} jusqu'à ${count(reach, cell)}`,
    whatMakesIt: "ce qui le compose",
    whatIsLeft: "ce qui reste",
    pause: "Arrêter le travail",
    resume: "Reprendre le travail",
    pauseTitle: "Un bâtiment en pause n'a pas de travailleurs et paie un quart de son entretien",
    closeHome: "Fermer la maison",
    reopenHome: "Rouvrir la maison",
    closeTitle: `Une maison fermée reste vide : pas d'impôts, et aucun coût pour l'administration ${to("de", hall)}. Rouvrez-la et ${theMany(settlers)} reviennent.`,
    remove: "Enlever"
  },
  /** What upgrading a building would cost and give: `to` is the level it would stand at. */
  upgrade: {
    title: (id: KindId, level: number): string => `agrandissement en ${kind(id, level).one}`,
    begin: (id: KindId, level: number): string => `Bâtir ${the(kind(id, level))}`,
    needed: (why: string): string => `nécessaire maintenant : ${why}`,
    notNeeded: "pas encore nécessaire : la flèche dorée dira quand",
    pay: "vous payez",
    get: "vous obtenez",
    now: "maintenant, pour commencer",
    price: (coins: number): string => token.coins(coins),
    short: (coins: number): string => `il manque ${token.coins(coins)}`,
    later: "plus tard, livré",
    lacks: (short: ReadonlyArray<{ readonly good: GoodId; readonly count: number }>): string =>
      `il manque à la réserve ${short.map((l) => token.amount(l.good, l.count)).join(", ")} : les travaux les attendent`,
    fromStore: "de la réserve : les travaux avancent au fil des livraisons",
    upkeepAfter: "entretien après",
    goesOn: "le bâtiment continue de travailler pendant les travaux, et des échafaudages montent sur sa parcelle"
  },

  // ── The sheets ──────────────────────────────────────────────────────────

  /** Founding a town: the charter. */
  charter: {
    by: "par",
    sub: "Choisissez la terre, puis faites grandir la ville jusqu'à son objectif avant la fin du mandat.",
    land: {
      title: "terre",
      /** What a land of this size asks of a town: each figure is a chip. */
      note: (residents: string, income: string): string => `${a(rankNoun(TOWN_RANK))} à ${residents}${income}`,
      residents: (n: number): string => `${n} habitants`,
      income: (coins: number): string => `+${coins}/min`,
      tip: (residents: number, income: number): string =>
        `Le rang de ${rankNoun(TOWN_RANK).one} demande ${residents} habitants et un revenu de ${amount.rate(income)} ; ${a(rankNoun(TOWN_RANK - 1))} moins, ${a(rankNoun(TOWN_RANK + 1))} plus`
    },
    term: {
      title: "mandat",
      label: (minutes: number): string => `${minutes} min`,
      years: (years: number, minutes: number): string => `${years} ans de ${figure(minutes)} min`,
      winters: (n: number): string => count(n, winter),
      tip: (minutes: number, years: number): string => `${minutes} minutes à 1× : ${years} ans, un hiver à la fin de chacun après le premier`
    },
    richness: {
      title: "richesse",
      coins: (n: number): string => `${amount.coins(n)} au départ`
    },
    reroll: "↻ autre terre",
    rerollTitle: (seed: number): string => `Tirer une autre terre (c'est la graine ${seed})`,
    cells: (n: number): string => count(n, cell),
    trees: (n: number): string => count(n, m("arbre")),
    // What the land holds is counted in rocks and in veins of ore: "18 pierre" would be a weight of it.
    stone: (n: number): string => count(n, m("rocher")),
    ore: (n: number): string => count(n, m("filon")),
    start: "Fonder la ville",
    resume: "Reprendre la ville",
    /** The town saved in this browser, by its title, and (when known) how long ago it was saved. */
    resumeTitle: (title: string, saved: string | null): string => `Reprendre la ville sauvegardée dans ce navigateur : ${title}${saved === null ? "" : `, sauvegardée ${saved}`}`
  },
  /** The end of the term. */
  reckoning: {
    lost: "le mandat est perdu · voir comment",
    over: (term: number): string => `le mandat ${term} est terminé · voir comment`,
    /** The heading of a term that ran its course: `verdict` is one of `verdict` below. */
    title: (term: number, verdict: string): string => `le mandat ${term} est terminé : ${verdict}`,
    /** What became of a town whose term ran out: said beside a rank too (a "bourg", a "cité"), so in words that agree with neither. */
    verdict: { unrooted: "la ville n'a jamais pris racine", flourishing: "prospère", holding: "stable", declining: "en déclin" },
    facts: {
      rank: "rang",
      minutes: "minutes en fonction",
      residents: "habitants",
      citizens: `${citizens.other} · ${burghers.other}`,
      coins: "pièces",
      approval: "soutien",
      crown: "couronne ✓ · ✗",
      score: "score"
    },
    legend: "— habitants (tirets : le prochain rang) · pièces · - - soutien · ombré : hivers",
    next: "Mandat suivant",
    nextTitle: (minutes: number): string => `Rester en fonction ${minutes} minutes de plus : la même ville, de nouveaux hivers, et les demandes de la couronne repartent petites`,
    retire: "Se retirer : fonder une nouvelle ville",
    found: "Fonder une nouvelle ville",
    look: "Regarder la ville",
    share: "Partager la ville",
    shareTitle: "Une image de la ville et de son verdict, ou un lien que tout le monde peut ouvrir"
  },
  /** The picture a town is shared as, and the lines a link to it previews with. */
  card: {
    /** How a lost term ended (`ended`: the view's word for it), as a headline. */
    lost: (ended: string): string => capital(ended),
    over: (now: number, term: number, verdict: string): string => `${capital(a(rankNoun(now)))} : mandat ${term} terminé, ${verdict}`,
    playing: (now: number, year: number, term: number): string => `${capital(a(rankNoun(now)))} · an ${year} · mandat ${term}`,
    land: (size: SizeId, land: LandId, minutes: number): string => `${capital(landOf(size, land))} · mandat de ${minutes} minutes`,
    residents: "habitants",
    citizens: citizens.other,
    coins: "pièces",
    approval: "soutien"
  },
  share: {
    title: "partager la ville",
    sub: "Publiez l'image où vous voulez, ou créez un lien : qui l'ouvre voit cette ville tourner, depuis là où vous la regardez, et peut continuer à jouer à partir d'ici.",
    /** The picture's button: a phone hands it to its share sheet, a computer saves it. */
    sharePicture: "Partager l'image",
    savePicture: "Enregistrer l'image",
    makeLink: "Créer un lien",
    making: "Création du lien…",
    again: "Réessayer le lien",
    shareLink: "Partager le lien",
    copyLink: "Copier le lien",
    open: "Ouvrir",
    noPicture: "L'image n'a pas pu être créée",
    /** What handing the picture or the link to the device came to. */
    offered: {
      shared: () => "Partagé",
      notShared: () => "Non partagé",
      saved: (o) => `Image enregistrée sous ${o.name}`,
      copied: () => "Lien copié",
      link: (o) => o.url
    } satisfies Wording<Offered>,
    /** Why a town could not be shared, or a shared one opened. What the server itself says (`error`) is in its own words. */
    failed: {
      unreachable: (failure) => (failure.sending ? "Impossible de joindre le serveur pour partager la ville" : "Impossible de joindre le serveur pour cette ville"),
      notFound: () => "Aucune ville n'est partagée sous ce lien (les partages sont gardés six mois)",
      refused: (failure) => `${failure.sending ? "Impossible de partager la ville" : "Impossible d'ouvrir cette ville"} : ${failure.error ?? `le serveur a répondu ${failure.status}`}`,
      unpacked: () => "La ville n'a pas pu être empaquetée"
    } satisfies Wording<ShareFailure>,
    notShared: "Impossible de partager la ville",
    notOpened: "Impossible d'ouvrir cette ville"
  },
  /** Visiting a shared town. */
  visit: {
    shared: "une ville partagée",
    play: "Jouer à partir d'ici",
    playTitle: "Faire vôtre cette ville : bâtissez, gouvernez, et elle se sauvegarde dans ce navigateur",
    yours: "La ville est à vous : elle se sauvegarde au fil du jeu",
    own: "Fonder la vôtre"
  },
  /** Saving and loading. */
  save: {
    notReady: "Pas prêt",
    saved: "Sauvegardé",
    /** A save's title, as it is listed: "terre moyenne et passable · an 2 · 23 min de jeu". */
    title: (c: { readonly size: SizeId; readonly land: LandId; readonly year: number; readonly minutes: number }): string =>
      `${landOf(c.size, c.land)} · an ${c.year} · ${c.minutes} min de jeu`,
    untitled: "une ville",
    /** A save from before saves had titles. */
    earlier: "une sauvegarde plus ancienne",
    loaded: (title: string): string => `Chargé : ${title}`,
    loadedAuto: (title: string): string => `Sauvegarde automatique chargée : ${title}`,
    /** What went wrong with a save. */
    trouble: {
      nothingSaved: (e) => (e.auto ? "Pas encore de sauvegarde automatique" : "Rien de sauvegardé pour l'instant"),
      unreadable: () => "La sauvegarde est illisible",
      wrongVersion: (e) => (e.older ? "Cette sauvegarde vient d'une version plus ancienne du jeu" : "Cette sauvegarde vient d'une version plus récente du jeu"),
      rejected: (e) => `La sauvegarde ne correspond pas à ce jeu : ${e.reason}`,
      storageFailed: (e) => `Sauvegarde impossible : ${e.reason}`,
      unsaveable: (e) => `Impossible de sauvegarder la ville : ${e.reason}`
    } satisfies Wording<Trouble>
  },
  /**
   * News of the next Typeonce game (`ui/dom/brand/signup.ts`): the card at the first spring, and the panel on the
   * reckoning. "Typeonce Games" is a name, and stays.
   */
  signup: {
    label: "Les nouveaux jeux de Typeonce Games",
    moment: { lead: "Printemps de l'an 3.", text: "La ville a passé son premier hiver." },
    headline: "Jouez en premier au prochain jeu Typeonce",
    body: "Inkline Town est fait par Typeonce Games. Laissez votre e-mail et le prochain jeu gratuit vous parvient le jour de sa sortie.",
    email: "Adresse e-mail",
    placeholder: "vous@exemple.fr",
    submit: "Recevoir les nouveaux jeux",
    keep: "Continuer à jouer",
    outcome: {
      ok: "Vérifiez votre boîte de réception pour confirmer.",
      invalid_email: "Cette adresse ne semble pas correcte.",
      rate_limited: "Trop d'essais. Attendez une minute et réessayez.",
      unavailable: "Ça n'a pas marché. Réessayez."
    }
  },
  /** On the card shown while the town is drawn for the first time (the page's own HTML says it in English until the language is known). */
  loading: "on dessine la ville…",
  /** The town could not start, or stopped: said in place of the page. */
  fatal: {
    start: (why: string): string => `La ville n'a pas pu démarrer : ${why}`,
    frame: (delta: number): string => `Delta d'image invalide : ${delta}`,
    stopped: "La ville s'est arrêtée après une panne du système.",
    loop: (field: string): string => `Option de boucle fixe invalide : ${field}`
  }
} satisfies typeof English
