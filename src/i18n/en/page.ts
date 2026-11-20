/**
 * English for the page itself (`ui/dom` and what starts it, `app/browser.ts`):
 * its buttons, headings, tooltips, dialogs, and the chips a message's tokens
 * become. One entry for each part of the page, under that part's name.
 *
 * What a part shows through markup (a toast, a panel row's value or note)
 * may hold tokens (`../token.ts`), so its amounts show as icons; what it
 * sets as plain text (a button, a `title`) is words alone. A sentence with
 * the page's own markup set into it (a bold number, a good's icon) takes
 * each such piece as a string and says where it goes, so another language
 * can order them as it reads (see `compose` in `ui/dom/kit/text.ts`).
 *
 * Where what a finger does and what a mouse does read differently, both
 * are given (`token.device`), and the page says the one that fits.
 */
import { COMMUTE, home, mood, park, type Category, type GoodId, type GroundId, type KindId, type LandId, type PropId, type SizeId, type Tier, type WinterId } from "../../game/content/index.ts"
import type { Status } from "../../game/schema.ts"
import type { Trouble } from "../../platform/save.ts"
import type { Offered, ShareFailure } from "../../platform/share/client.ts"
import type { Panel } from "../../view/contracts.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { a, capital, signed } from "./grammar.ts"
import { built, goods, grounds, lands, names, props, sizes, tiers, winters } from "./nouns.ts"

const rank = (n: number) => names.rank(n)
/** A number with its sign as a slider or a chip shows it: "+4", "-4", "0". */
const plus = (n: number) => `${n > 0 ? "+" : ""}${n}`

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

export const page = {
  /** What a building's chip in a message says on hover. */
  chips: {
    goTo: (id: KindId): string => `Go to the ${built(id).noun.one}`,
    /** A row that places a building, on hover. */
    place: (id: KindId): string => `Build ${a(built(id).noun.one)}`,
    build: (id: KindId): string => `Build ${a(built(id).noun.one)}: ${built(id).blurb}`
  },
  /** How long ago a save was made, roughly. */
  ago: {
    now: "just now",
    minutes: (n: number): string => `${n} min ago`,
    hours: (n: number): string => `${n} h ago`,
    yesterday: "yesterday",
    days: (n: number): string => `${n} days ago`
  },
  /** Words more than one part of the page says. */
  common: {
    close: "Close",
    closeEsc: "Close (Esc)",
    cancel: "Cancel",
    /** A section's ⓘ. */
    whatThisMeans: "What this means",
    showWhere: "Show me where",
    dismiss: "Dismiss",
    coins: "coins"
  },

  // ── The map and its tools ───────────────────────────────────────────────

  /** What picking something to put on the map says, and the bar a held stroke waits at. */
  map: {
    place: (id: KindId): string => {
      const what = built(id).noun.one
      return token.device(`Tap a spot for the ${what}, then tap it again to build it`, `Click to place ${a(what)} · Esc to stop`)
    },
    layGround: (id: GroundId): string => {
      const what = grounds[id].noun.one
      return token.device(`Drag a rectangle to lay ${what}, then tap Build`, `Drag a rectangle to lay ${what} · Esc to stop`)
    },
    furnish: (id: PropId): string => {
      const what = props[id].noun.one
      return token.device(`Tap a cell of park for the ${what}, then tap it again to set it`, `Click a cell of park to set ${a(what)} · Esc to stop`)
    },
    /** A touch tap that holds what it would do: tapped again, it does it. */
    tapAgain: { remove: "tap it again to remove it", build: "tap it again to build it here" },
    overlays: "Map overlays",
    stroke: { build: "Build", cancel: "Cancel" }
  },
  toolbar: {
    town: { label: "town", title: "The town's goals, numbers, taxes, and trade (T)" },
    more: "Share, the guide, save, load, new town",
    pause: "Pause the town, or run it again (space)",
    /** A speed's button: "Run the town at 2× (2)". */
    runAt: (speed: string, key: string): string => `Run the town at ${speed} (${key})`,
    cycle: "Change speed: 1×, 2×, 4×",
    /** The pause switch, read aloud: what pressing it does now. */
    run: "Run the town",
    pauseNow: "Pause the town",
    runAtLast: (last: number): string => `Run the town at ${last}×`
  },
  mapViews: {
    title: "map overlays",
    help: "Colour the map by one of these, to see where the town is doing well or badly. Press the key again (or click) to hide it.",
    show: (label: string, key: string): string => `Show ${label} over the map (${key}); again to hide it`
  },
  /** Share, the guide, save, load, and new town: each button's label and what it says on hover. */
  system: {
    share: { label: "share", tip: "Share a picture of the town, or a link anyone can open to watch it and play on" },
    guide: {
      label: "guide",
      tip: "Turn the guide on or off: it tells a new mayor what to do next, and why",
      turnOn: "Turn the guide back on: a next step to take, and why, at the top of the ticker",
      turnOff: "Turn the guide off"
    },
    save: { label: "save", tip: "Save the town in this browser (it also autosaves every two minutes)" },
    load: { label: "load", tip: "Load the latest save: yours or the autosave, whichever is newer" },
    newTown: { label: "new town", tip: "Found a new town on new land" },
    recentre: { label: "recentre", tip: "Back to the original angle and centre" },
    leave: {
      load: leave("load the latest save?", "The town as it is now is replaced by the latest save (yours or the autosave).", "Save, then load", "Load without saving"),
      newTown: leave("found a new town?", "This town is left behind for good unless it is saved first.", "Save, then choose new land", "Choose new land without saving"),
      stay: "Keep playing"
    }
  },
  /** The maker's credit: what each link is, read aloud. */
  credit: {
    typeonce: "Typeonce Games: more games by the maker of Inkline Town",
    ritmo: "ritmo on GitHub: the ECS runtime Inkline Town is made with",
    madeWith: "Made with",
    madeBy: "Made by Typeonce",
    newTab: (label: string): string => `${label} (opens in a new tab)`
  },

  // ── The heads-up display ────────────────────────────────────────────────

  hud: {
    /** What each good is for: who makes it, who takes it. */
    goods: {
      wood: "lumberjacks fell it; a sawmill saws it into planks",
      planks: "what homes and buildings are built from: a sawmill makes them from wood",
      stone: "for building and paving: quarries cut it from rocks, which run out",
      ore: "only for tools: once the town has 10 citizens, a mine digs it from the rust-red deposits, and a smithy forges it into tools",
      tools: "for building, and workshops wear one out every 50 or 60 jobs: a smithy forges them, or buy them",
      fish: "food for settlers: fisheries catch it by the water; it rots in about three minutes",
      smoked: "fish that keeps all winter: a smokehouse smokes it",
      wheat: "farms grow it; a mill grinds it into flour (not in winter)",
      flour: "a mill's; a bakery bakes it into bread",
      bread: "food that citizens need, and a cottage with bread pays half again: it rots in about five minutes",
      wool: "sheep farms shear it; a weaver weaves it into cloth",
      cloth: "citizens need it: only brought to streets with desirability 5 or more",
      furniture: "burghers need it in their townhouses: a carpenter makes it from planks; only brought to streets fine enough for townhouses"
    } satisfies Record<GoodId, string>,
    /** A good and what it is for: "planks: what homes and buildings are built from…". */
    good: (name: string, help: string): string => `${name}: ${help}`,
    /** A good's last minute, under what it is for. */
    goodFlow: (f: { readonly made: number; readonly used: number; readonly traded: number; readonly stock: number; readonly elsewhere: number }): string =>
      `Last minute: made ${f.made}, used ${f.used}${f.traded !== 0 ? `, ${f.traded > 0 ? "bought" : "sold"} ${Math.abs(f.traded)}` : ""}. ${f.stock} in storage, ${f.elsewhere} about town (in workshops and markets, and on the way).`,
    stock: "Goods in the town's storage, and which way each is going · click for what the town makes and uses",
    goodsChip: "The goods in storage",
    folk: "Open the town's numbers, goals, and levers (T)",
    treasury: {
      plain: "Coins in the treasury, and what it gains (or loses) a minute at the current rates · click for the town's last minute",
      counted: (f: { readonly change: number; readonly made: number; readonly used: number; readonly traded: number; readonly net: number }): string =>
        `Coins in the treasury · click for the town's last minute\nLast minute: ${signed(f.change)} (made ${f.made}, used ${f.used}${f.traded !== 0 ? `, traded ${signed(f.traded)}` : ""})\nAt the current rates: ${signed(f.net)}/min (taxes, trade, upkeep, administration)`
    },
    clock: {
      paused: "paused",
      /** Under the clock: "year 2 · winter in 3:20 (hard)". `until` is one of the three below. */
      year: (year: number, until: string): string => `year ${year} · ${until}`,
      winter: (severity: WinterId, spring: string): string => `${winters[severity]} winter · spring in ${spring}`,
      winterIn: (left: string, coming: WinterId): string => `winter in ${left} (${winters[coming]})`,
      noMoreWinters: "no more winters this term",
      /** The clock on hover: the season, the almanac's next two winters (`null`: beyond the term), and what each kind does to a catch (percent). */
      title: (c: { readonly winter: boolean; readonly coming: WinterId | null; readonly after: WinterId | null; readonly fishing: Readonly<Record<WinterId, number>> }): string =>
        `${c.winter ? "Winter: fields lie still, fishing is slow, and homes eat faster" : "Time left in the term"}\nThe almanac: the coming winter is ${c.coming === null ? "beyond the term" : winters[c.coming]}, the one after ${c.after === null ? "beyond the term" : winters[c.after]}.\nMild: fishing at ${c.fishing.mild}%. Normal: ${c.fishing.normal}%. Hard: half as long again, fishing at ${c.fishing.hard}%, and homes heating are a fire risk.`
    },
    approval: "approval",
    settlers: "settlers",
    citizens: "citizens",
    /** Beside the citizens, once there are any: "· 12 burghers". */
    burghers: (n: number): string => `${n} burghers`,
    jobs: {
      short: (n: number): string => `${n} short · click`,
      filled: "jobs filled",
      filledTitle: `Workers at work over workers needed: every workplace has its crew. Residents walk at most ${COMMUTE} road cells to work.`,
      /** How many workplaces are short, and the first few of them. */
      shortTitle: (n: number, places: ReadonlyArray<ShortPlace>): string =>
        `Workers at work over workers needed. ${n} ${n > 1 ? "workplaces are" : "workplace is"} short: ${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? ` (no homes within ${COMMUTE} road cells)` : ""}`).join(", ")}. Click to visit them in turn.`
    },
    /** The goods' last minute, side by side: each column, and what it counts. */
    flow: {
      counting: "Counting the town's goods: the first numbers come in half a minute…",
      made: { label: "made", title: "Made by workshops and gatherers over the last minute" },
      used: { label: "used", title: "Eaten, worked up, built with, rotted, or sent away over the last minute" },
      traded: { label: "traded", title: "Bought (+) or sold (−) over the last minute" },
      storage: { label: "storage", title: "In the town hall, warehouses, and granaries" },
      about: { label: "about town", title: "In workshops and markets, walkers' baskets, and carriers' crates" }
    },
    /** The crown's request: `amount` and `good` are set in bold, the good with its icon. */
    crown: {
      asks: (amount: string, good: string): string => `the crown asks for ${amount} ${good}`,
      inStore: (n: number): string => `${n} in store`,
      /** What is in store (coloured by whether it is enough), when it is due (bold), and what it pays. */
      terms: (inStore: string, due: string, reward: string): string => `${inStore} · due in ${due} · ${reward}`,
      reward: (coins: number): string => `+${coins} coins`,
      send: "send",
      sendTitle: (good: GoodId, amount: number, reward: number): string => `Send ${amount} ${goods[good].other} to the crown for ${reward} coins`,
      notEnough: (good: GoodId): string => `Not enough ${goods[good].other} in store yet`
    },
    /** What threatens the term, or is about to raise the town a rank: `left` is a clock. */
    warnings: {
      bankruptIn: (left: string) => warning("In debt:", `bankrupt in ${left} unless the treasury recovers`),
      debt: warning("In debt:", "wages are going unpaid"),
      revoltIn: (left: string) => warning("Uproar:", `the town turns the mayor out in ${left}`),
      restless: warning("Restless:", "approval is falling towards revolt"),
      emptying: warning("Emptying:", "people are leaving the town"),
      patience: (streak: number) => warning("The crown's patience:", `${streak} requests missed in a row; one more and the mayor is dismissed`),
      /** Every goal of the next rank (`to`) is met and holding. */
      rises: (to: number, left: string) => warning("Every goal met:", `the town is ${a(rank(to))} in ${left}`)
    }
  },

  // ── The ticker ──────────────────────────────────────────────────────────

  ticker: {
    bulb: "The guide, and what needs looking at now",
    tucked: "The guide is in the bulb at the top right",
    guideOff: "Guide off · turn it back on from the bottom right",
    /** How long ago a piece of news happened, in the town's own time. */
    ago: {
      now: "just now",
      seconds: (n: number): string => `${n} s ago`,
      minutes: (n: number): string => `${n} min ago`
    },
    /** The guide's heading: "guide · Founding". */
    guide: (chapter: string): string => `guide · ${chapter}`,
    step: (at: number, of: number): string => `step ${at} of ${of}`,
    firstSteps: "The first steps of a new town",
    hide: "hide guide",
    hideTitle: "Turn the guide off (the guide button in the bottom right turns it back on)",
    /** Under a step: what closes it. `goal` is the step's own words. */
    doneWhen: (goal: string): string => `done when ${goal}`,
    skip: "Skip this step",
    tuck: "Hide: the guide stays in the bulb at the top right",
    now: "now",
    lately: "lately"
  },

  // ── The panels ──────────────────────────────────────────────────────────

  town: {
    title: "town",
    /** Under the heading: "medium, fair land · a village · term 2, 60 minutes". */
    sub: (c: { readonly size: SizeId; readonly land: LandId; readonly rank: number; readonly term: number; readonly minutes: number }): string =>
      `${sizes[c.size]}, ${lands[c.land].name} land · ${a(rank(c.rank))} · term ${c.term}, ${c.minutes} minutes`,
    seed: (seed: number): string => `seed ${seed}`,
    goals: {
      title: "goals",
      help: "The town rises from a hamlet to a village, a town, and a city. Meet every goal of the next rank at once and hold them for two minutes: the crown sends a reward, and the game goes on. A rank is never lost.",
      top: (now: number): string => `${capital(a(rank(now)))}, the highest rank: keep it standing, term after term.`,
      holding: (now: number, left: string): string => `All met: hold them ${left} more and the ${rank(now)} is ${a(rank(now + 1))}.`,
      toward: (now: number): string => `${capital(a(rank(now)))} now: these make it ${a(rank(now + 1))}.`
    },
    approval: {
      title: "approval",
      help: "Homes hold more residents when approval is high and fewer when it is low. At −50 for two minutes, the town turns the mayor out.",
      heading: "now → heading for"
    },
    treasury: {
      title: "treasury",
      help: "Coins a minute. Taxes come only from homes that are fed, in proportion to the needs they have met. Administration is reckoned by the home and grows faster than the town: in a large town another cottage costs about what it pays, while a citizens' home or a townhouse holds two or three times the people for the same cost. Three minutes in debt and the town is bankrupt.",
      taxes: "taxes",
      supplied: "if every home were supplied",
      trade: "trade",
      upkeep: "upkeep",
      admin: "administration",
      net: "a minute",
      /** The sum of the above, with its sign: "+12 coins". */
      netCoins: (n: number): string => `${signed(n)} coins`,
      leftOnTable: (gap: number): string => `${gap} coins a minute left on the table: a hungry home pays nothing, a cottage with bread pays half again, a fine street a quarter more`
    },
    taxes: {
      title: "tax rates",
      help: `Lower taxes raise approval, higher ones lower it, weighed by how many of each tier there are. Above 100% some residents also move away, settlers sooner than citizens, so a higher rate does not always bring in more: under each rate is what the homes would pay at each step once they settle there. Above ${mood.grudge.above}% the town also keeps a grudge that outlasts the rate: cutting taxes at the end does not undo a term of squeezing.`,
      slider: "Drag to set the rate; double-click for the usual 100%",
      /** What a rate does to approval (`sway`: 0 at the usual rate), and whether it is high enough to leave a grudge. */
      effect: (sway: number, grudge: boolean): string =>
        `${sway === 0 ? "the usual rate" : `${signed(sway)} approval`}${grudge ? " · a grudge builds while it stays this high, and fades slowly" : ""}`,
      /** Taxes a minute at each step of the rate, and the step that brings in most. */
      outlook: (steps: ReadonlyArray<{ readonly rate: number; readonly taxes: number }>, best: number): string =>
        `taxes a minute, once settled: ${steps.map((o) => `${o.rate}% ${o.taxes}`).join(" · ")} · most at ${best}%`,
      outlookTitle: "Taxes a minute from every home if this rate stayed there and the homes settled: residents move away above 100%, and approval follows the rate"
    },
    people: {
      title: "people",
      settlers: "settlers",
      citizens: "citizens",
      burghers: "of them, burghers",
      homes: "homes",
      jobs: "jobs filled",
      jobsOf: (employed: number, jobs: number): string => `${employed} of ${jobs}`,
      staffed: "every workplace has its crew",
      /** How many workplaces are short, the first few (`more`: there are others), and where to find them. */
      short: (n: number, places: ReadonlyArray<ShortPlace>, more: boolean): string =>
        `${n} short of workers: ${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? " (nobody within reach)" : ""}`).join(", ")}${more ? ", …" : ""} · click the jobs counter to visit them`
    },
    needs: {
      title: "homes supplied",
      help: "A hungry home pays no taxes. Settlers need food (fish, smoked fish, or bread) from a market, and a cottage with bread besides pays half again; a visit feeds a home a fish or a loaf for every four residents, so a citizens' home eats twice what a cottage does and a townhouse three times; citizens and burghers need bread, cloth, and faith, and burghers furniture from a carpenter besides. Cloth is only brought to streets with desirability 5 or more, furniture to streets of 12 or more. Fish rots in about three minutes and bread in five; a granary keeps them five times as long.",
      larder: "food in store",
      eaten: "eaten · rotted last minute",
      trouble: "sick homes · on fire"
    },
    crown: {
      title: "the crown",
      help: "Sending what the crown asks for earns coins. A missed request is a fine, and the town remembers the snub for a while; too many missed in a row and the crown dismisses the mayor.",
      tally: "requests met · missed",
      /** An open request: `what` (so many of a good) is set in bold. */
      wants: (what: string, left: string, reward: string): string => `Wants ${what} · ${left} left · ${reward}`,
      what: (good: GoodId, amount: number): string => `${amount} ${goods[good].other}`,
      reward: (coins: number): string => `+${coins} coins`,
      next: (left: string, patience: number): string => `Next request in ${left} · ${patience} missed in a row ends the term`
    },
    trade: {
      title: "goods and trade",
      help: "Traders call every few seconds. Drag a good's slider left to sell it beyond what the town keeps, right to buy it up to that (at half again the price), the further the more each call; the middle neither sells nor buys. Prices fall as the town sells and rise, three times as fast, as it buys; a dear price calms only slowly, so buying tops up a shortfall but a town fed on bought food pays more every minute.",
      keep: "keep in store",
      keepTitle: "How much of each good the town keeps: it sells only beyond this, and buys only up to it",
      keepNote: "of each good: sold only above this, bought only up to it",
      deal: (good: GoodId): string => `Drag left to sell ${goods[good].other}, right to buy it; the further, the more each time the traders call. Double-click to stop trading it.`,
      /** What a good's slider is set to: nothing, or the most it sells or buys a minute. */
      none: "no trade",
      sell: (most: number): string => `sell ≤${most}/min`,
      buy: (most: number): string => `buy ≤${most}/min`,
      /** A good's price in coins, and (when it is not the usual) in percent of the usual: "3.5c (120%)". */
      price: (coins: number, percent: number | null): string => `${coins}c${percent === null ? "" : ` (${percent}%)`}`,
      asks: "what traders ask for one",
      pays: "what traders pay for one"
    },
    chronicle: "chronicle"
  },
  build: {
    title: "build",
    sub: token.device("Pick one, then tap the map where it goes", "Pick one, then click the map · Esc to stop"),
    categories: { storage: "storage", gathering: "gathering", crafts: "crafts", food: "food", services: "services" } satisfies Record<Category, string>,
    cost: "cost",
    does: "does",
    /** What keeps the town from building something yet, in place of what it is for. */
    needsResidents: (n: number): string => `needs ${n} residents`,
    needsCitizens: (n: number): string => `needs ${n} citizens`,
    /** What each of a building's chips says on hover. */
    recipe: (r: { readonly input: GoodId | null; readonly inputs: number; readonly output: GoodId; readonly batch: number; readonly seconds: number }): string =>
      `${r.input ? `turns ${r.inputs} ${goods[r.input].other} into ${r.batch} ${goods[r.output].other}` : `makes ${r.batch} ${goods[r.output].other}`} every ${r.seconds} s`,
    serves: (range: number): string => `its walkers serve the homes within ${range} road cells of its door`,
    holds: (cap: number, keeps: number | null): string => `holds up to ${cap} of each good${keeps === null ? "" : `, and keeps food ${keeps} times as long`}`,
    crew: (workers: number, tier: Tier): string => `${workers} ${tiers[tier].people} to work it, from homes within ${COMMUTE} road cells`,
    appeal: (value: number, reach: number): string => `desirability ${plus(value)} beside it, out to ${reach} cells${value < 0 ? ": keep homes away" : ": homes like it"}`,
    upkeep: "upkeep: coins a minute while it stands (a quarter when paused)",
    /** A building's whole line on hover: what it is, who works it, how far it reaches, what it does to its street, and what it costs to keep. */
    option: (id: KindId, k: { readonly workers: number; readonly citizens: boolean; readonly range: number | null; readonly appeal: { readonly value: number; readonly reach: number } | null; readonly upkeep: number }): string =>
      `${names.kind.title(id)}: ${built(id).blurb}${k.workers > 0 ? ` · ${k.workers} ${k.citizens ? "citizen" : "settler"} workers from within ${COMMUTE} road cells` : ""}${k.range === null ? "" : ` · walkers reach ${k.range} road cells`}${k.appeal ? ` · desirability ${plus(k.appeal.value)} out to ${k.appeal.reach} cells` : ""} · ${k.upkeep} coins a minute`,
    parks: {
      title: "parks",
      help: `Lay ground, then set furnishings on it. Ground that touches is one park: the more it holds the nicer the streets around it (citizens need ${home.tiers[2].appeal}, townhouses ${home.tiers[3].appeal}). One furnishing counts for every ${park.cellsPerProp} cells; where parks meet, the finest counts in full.`,
      ground: "ground · drag a rectangle",
      furnishings: "furnishings · click a cell of park",
      beauty: "beauty it adds to its park",
      upkeep: "upkeep, coins a minute",
      /** A park piece's whole line on hover: `name` and `blurb` are its own. */
      piece: (name: string, blurb: string, p: { readonly beauty: number; readonly upkeep: number; readonly ground: boolean }): string =>
        `${name}: ${blurb} · beauty +${p.beauty}${p.ground ? " a cell" : ""} · ${p.upkeep} coins a minute`
    }
  },
  /** The panel of what is picked: a building, a home, a park, or a ruin. */
  selection: {
    park: "park",
    ruin: "ruin",
    /** Under the heading: who lives in a home of each tier, and what a ruin or a park is for. */
    home: {
      1: "settlers live here and do the rough work",
      2: "citizens live here, do the skilled work, and pay twice as much",
      3: "burghers live here, and pay the best taxes"
    } satisfies Record<Tier, string>,
    aboutRuin: "bulldoze it to clear the plot",
    aboutPark: "every cell of ground that touches this one: lay more, or set furnishings on it, to make the streets around it nicer",
    status: "status",
    /** How a building is, in a word, when nothing is wrong with it. */
    statuses: {
      building: "building",
      idle: "idle",
      working: "working",
      starved: "starved",
      blocked: "blocked",
      unstaffed: "unstaffed",
      unconnected: "unconnected",
      paused: "paused"
    } satisfies Record<Status, string>,
    causes: { burnt: "burnt", collapsed: "collapsed", derelict: "derelict" } satisfies Record<Extract<Panel, { readonly type: "ruin" }>["cause"], string>,
    /** A park's worth in a word: the desirability it gives, and how far. */
    parkWorth: (value: number, reach: number): string => `${plus(value)} out to ${reach} cells`,
    whatMakesIt: "what makes it",
    whatIsLeft: "what is left",
    pause: "Pause work",
    resume: "Resume work",
    pauseTitle: "A paused building has no workers and pays a quarter of its upkeep",
    closeHome: "Close home",
    reopenHome: "Reopen home",
    closeTitle: "A closed home stands empty: no taxes, and no cost to the town hall's administration. Reopen it and settlers move back in.",
    remove: "Remove"
  },
  /** What upgrading a building would cost and give: `to` is the level it would stand at. */
  upgrade: {
    title: (id: KindId, to: number): string => `upgrade to ${built(id, to).noun.one}`,
    begin: (id: KindId, to: number): string => `Begin the ${built(id, to).noun.one}`,
    needed: (why: string): string => `needed now: ${why}`,
    notNeeded: "not needed yet: the gold arrow shows when it is",
    pay: "you pay",
    get: "you get",
    now: "now, to begin",
    price: (coins: number): string => token.coins(coins),
    short: (coins: number): string => `${token.coins(coins)} short`,
    later: "later, carried in",
    lacks: (lacking: ReadonlyArray<{ readonly good: GoodId; readonly count: number }>): string =>
      `the store lacks ${lacking.map((l) => token.amount(l.good, l.count)).join(", ")}: the works wait for them`,
    fromStore: "from the store: the works go on as they come",
    upkeepAfter: "upkeep after",
    goesOn: "it goes on working while the works go on, and scaffolding rises inside its plot"
  },

  // ── The sheets ──────────────────────────────────────────────────────────

  /** Founding a town: the charter. */
  charter: {
    by: "by",
    sub: "Pick the land, then grow the town to its goal before the term runs out.",
    land: {
      title: "land",
      /** What a land of this size asks of a town: each figure is a chip. */
      note: (residents: string, income: string): string => `a town at ${residents}${income}`,
      residents: (n: number): string => `${n} residents`,
      income: (coins: number): string => `+${coins}/min`,
      tip: (residents: number, income: number): string => `The town rank asks ${residents} residents and an income of ${income} coins a minute; a village less, a city more`
    },
    term: {
      title: "term",
      label: (minutes: number): string => `${minutes} min`,
      years: (years: number, minutes: number): string => `${years} years of ${minutes} min`,
      winters: (n: number): string => `${n} winters`,
      tip: (minutes: number, years: number): string => `${minutes} minutes at 1×: ${years} years, a winter at the end of each after the first`
    },
    richness: {
      title: "richness",
      coins: (n: number): string => `${n} coins to start`
    },
    reroll: "↻ other land",
    rerollTitle: (seed: number): string => `Draw other land (this is seed ${seed})`,
    cells: (n: number): string => `${n} cells`,
    trees: (n: number): string => `${n} trees`,
    stone: (n: number): string => `${n} stone`,
    ore: (n: number): string => `${n} ore`,
    start: "Start new",
    resume: "Continue saved",
    /** The town saved in this browser, by its title, and (when known) how long ago it was saved. */
    resumeTitle: (title: string, saved: string | null): string => `Carry on with the town saved in this browser: ${title}${saved === null ? "" : `, saved ${saved}`}`
  },
  /** The end of the term. */
  reckoning: {
    lost: "the term is lost · see how",
    over: (term: number): string => `term ${term} is over · see how`,
    /** The heading of a term that ran its course: `verdict` is one of `verdict` below. */
    title: (term: number, verdict: string): string => `term ${term} is over: ${verdict}`,
    /** What became of a town whose term ran out. */
    verdict: { unrooted: "the town never took root", flourishing: "flourishing", holding: "holding on", declining: "declining" },
    facts: {
      rank: "rank",
      minutes: "minutes in office",
      residents: "residents",
      citizens: "citizens · burghers",
      coins: "coins",
      approval: "approval",
      crown: "crown met · missed",
      score: "score"
    },
    legend: "— residents (dashed: the next rank) · coins · - - approval · shaded: winters",
    next: "Next term",
    nextTitle: (minutes: number): string => `Stand for another ${minutes} minutes: the same town, new winters, and the crown's requests start small again`,
    retire: "Retire: found a new town",
    found: "Found a new town",
    look: "Look at the town",
    share: "Share the town",
    shareTitle: "A picture of the town and its verdict, or a link anyone can open"
  },
  /** The picture a town is shared as, and the lines a link to it previews with. */
  card: {
    /** How a lost term ended (`ended`: the view's word for it), as a headline. */
    lost: (ended: string): string => capital(ended),
    over: (now: number, term: number, verdict: string): string => `${capital(a(rank(now)))}: term ${term} is over, ${verdict}`,
    playing: (now: number, year: number, term: number): string => `${capital(a(rank(now)))} · year ${year} · term ${term}`,
    land: (size: SizeId, land: LandId, minutes: number): string => `${capital(sizes[size])}, ${lands[land].name} land · ${minutes}-minute term`,
    residents: "residents",
    citizens: "citizens",
    coins: "coins",
    approval: "approval"
  },
  share: {
    title: "share the town",
    sub: "Post the picture anywhere, or make a link: whoever opens it sees this town running, from where you look at it now, and can play on from here.",
    /** The picture's button: a phone hands it to its share sheet, a computer saves it. */
    sharePicture: "Share the picture",
    savePicture: "Save the picture",
    makeLink: "Make a link",
    making: "Making a link…",
    again: "Try the link again",
    shareLink: "Share the link",
    copyLink: "Copy the link",
    open: "Open",
    noPicture: "The picture could not be made",
    /** What handing the picture or the link to the device came to. */
    offered: {
      shared: () => "Shared",
      notShared: () => "Not shared",
      saved: (o) => `Saved the picture as ${o.name}`,
      copied: () => "Link copied",
      link: (o) => o.url
    } satisfies Wording<Offered>,
    /** Why a town could not be shared, or a shared one opened. What the server itself says (`error`) is in its own words. */
    failed: {
      unreachable: (f) => (f.sending ? "Could not reach the server to share the town" : "Could not reach the server for that town"),
      notFound: () => "No town is shared under that link (shares are kept for six months)",
      refused: (f) => `${f.sending ? "Could not share the town" : "Could not open that town"}: ${f.error ?? `the server answered ${f.status}`}`,
      unpacked: () => "The town could not be packed up"
    } satisfies Wording<ShareFailure>,
    notShared: "Could not share the town",
    notOpened: "Could not open that town"
  },
  /** Visiting a shared town. */
  visit: {
    shared: "a shared town",
    play: "Play from here",
    playTitle: "Make this town yours: build, govern, and it autosaves in this browser",
    yours: "The town is yours: it autosaves as you play",
    own: "Found your own"
  },
  /** Saving and loading. */
  save: {
    notReady: "Not ready",
    saved: "Saved",
    /** A save's title, as it is listed: "medium, fair land · year 2 · 23 min in". */
    title: (c: { readonly size: SizeId; readonly land: LandId; readonly year: number; readonly minutes: number }): string =>
      `${sizes[c.size]}, ${lands[c.land].name} land · year ${c.year} · ${c.minutes} min in`,
    untitled: "a town",
    /** A save from before saves had titles. */
    earlier: "an earlier save",
    loaded: (title: string): string => `Loaded ${title}`,
    loadedAuto: (title: string): string => `Loaded the autosave: ${title}`,
    /** What went wrong with a save. */
    trouble: {
      nothingSaved: (e) => (e.auto ? "No autosave yet" : "Nothing saved yet"),
      unreadable: () => "The save could not be read",
      wrongVersion: (e) => (e.older ? "That save is from an older version of the game" : "That save is from a newer version of the game"),
      rejected: (e) => `The save does not fit this game: ${e.reason}`,
      storageFailed: (e) => `Could not save: ${e.reason}`,
      unsaveable: (e) => `Could not save the town: ${e.reason}`
    } satisfies Wording<Trouble>
  },
  /** The town could not start, or stopped: said in place of the page. */
  fatal: {
    start: (why: string): string => `The town could not start: ${why}`,
    frame: (delta: number): string => `Invalid frame delta: ${delta}`,
    stopped: "The town stopped after a system failure.",
    loop: (field: string): string => `Invalid fixed-loop option: ${field}`
  }
}
