import { resolveRules } from "../src/rules/config.ts"
/**
 * Balance runs: a bot plays the real simulation headless on several seeds,
 * the way a kind of mayor would, and reports how each term ended and how
 * the pressure on the town built up along the way.
 *
 *   node scripts/balance.ts                          5 seeds, a medium fair town, a 60-minute term
 *   node scripts/balance.ts --size large --term 90 --land harsh
 *   node scripts/balance.ts --bot greedy             sensible (default), crowded, uncovered, greedy, sprawl, or idle
 *   node scripts/balance.ts --versus crowded         the bot against another on the same seeds, side by side
 *   node scripts/balance.ts --seeds 10 --from 10     seeds 10 to 19 (to split a sweep across processes)
 *   node scripts/balance.ts --set crown.fine=2 --set kinds.fishery.recipe.seconds=3
 *   node scripts/balance.ts --verbose                every seed's table, every `--every` minutes (default 5)
 *   node scripts/balance.ts --snapshot 30            also saves each seed's town at minute 30, as a file the page can load
 *
 * The mayors:
 * - sensible: builds out the chains as the town grows, keeps food in store,
 *   answers the crown, eases taxes when the town grumbles and buys the stone
 *   and tools its land runs out of;
 * - greedy: the same town, taxed at 200%, selling everything it can and
 *   ignoring the crown;
 * - idle: founds the basics, then leaves the town to itself;
 * - crowded: the sensible mayor, but homes packed in beside the industry,
 *   and no parks or paving;
 * - uncovered: the sensible mayor, but no fire watch, healer, or watch house;
 * - sprawl: the quick loop the economy should not reward: taxes as high as
 *   the town will stand (200% while it approves, never so low it is
 *   pleased), cottages everywhere the coins allow, fish caught or bought to
 *   keep them fed, and never a bakery, a chapel, or a finer home.
 *
 * Every mayor but sprawl stops adding cottages for income once the build
 * tooltip says another would bring in little after administration.
 *
 * The sensible mayor also keeps homes off squalid streets and dirty
 * workshops a little way from homes, lays out parks and paves streets where
 * homes are just short of the next tier, sends for a fire watch, a healer,
 * or a watch house when warning signs go up over a few homes and for a
 * builder when homes start to run down, clears ruins, and puts workers'
 * cottages beside a workplace no settler can walk to.
 *
 * `--set` changes content before the run (numbers, or words such as a crew).
 *
 * To see why a run went the way it did: `CHRONICLE=1` prints each seed's
 * chronicle, `TRACE=1` the citizens' chain minute by minute, `SPEND=1` the
 * ledger and what the bot spent every five minutes, `DEBUG_PLAN=1` what it
 * wants at each decision, and `DEBUG=1` every edit it pushes. The bot only does what a player
 * could: it reads the world, then pushes the same edits the page does.
 */
import { goodIds, home, kinds, landIds, ROAD_COST, sizeIds, type Amounts, type CharterValue, type GoodId, type GroundId, type Kind, type KindId, type PropId } from "../src/content.ts"
import * as content from "../src/content.ts"
import { around, canPlace, DIRS, entrances, GridBuilder, isRoad, key, doors, nearest, reach, roadPrint, useAt, type Use } from "../src/grid.ts"
import { parksOf, ringOf, effectAt } from "../src/appeal.ts"
import { GRID, inside, type Point } from "../src/iso.ts"
import type { GridValue } from "../src/schema.ts"
import { headless, type Snapshot } from "../src/sim/headless.ts"
import { goalsOf, larder, seasonAt } from "../src/sim/index.ts"
import type { Edit } from "../src/ui.ts"
import { SAVE_FORMAT, SAVE_VERSION } from "../src/save.ts"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { fingerprint } from "../tools/balance/provenance.ts"
import { capacity, mealsOf, taxOf } from "../src/rules/households.ts"

// ── Options ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1]! : fallback
}
const seeds = Number(option("seeds", "5"))
const from = Number(option("from", "0"))
const size = option("size", "medium") as CharterValue["size"]
const land = option("land", "fair") as CharterValue["land"]
const term = Number(option("term", "60"))
type Bot = "sensible" | "greedy" | "idle" | "crowded" | "uncovered" | "sprawl"
const bots: ReadonlyArray<Bot> = ["sensible", "greedy", "idle", "crowded", "uncovered", "sprawl"]
/** `--versus <bot>`: run another bot on the same seeds and compare. */
const versus = option("versus", "") as Bot | ""
let bot = option("bot", "sensible") as Bot
const every = Number(option("every", "5"))
const verbose = args.includes("--verbose")
/** `--snapshot <minute>`: write each seed's town at that minute to `--out` (default `snapshots/`), as a save file. */
const snapshotAt = Number(option("snapshot", "0"))
const out = option("out", "snapshots")
if (!sizeIds.includes(size) || !landIds.includes(land) || !bots.includes(bot) || (versus !== "" && !bots.includes(versus))) throw new Error("Unknown --size, --land, --bot, or --versus")
/** Mayors who look after the neighbourhood: parks, paving, homes away from industry. */
const zoned = () => bot !== "crowded" && bot !== "idle" && bot !== "sprawl"
/** Mayors who keep fire watches, healers, and watch houses. */
const covered = () => bot !== "uncovered" && bot !== "idle"
/** Mayors who run the town as the sensible one does (taxes, trade, the crown). */
const sensible = () => bot === "sensible" || bot === "crowded" || bot === "uncovered"

/** `--set path=value`: change a number (or a word, such as a crew) in the content before running. */
for (let i = 0; i < args.length; i++) {
  if (args[i] !== "--set") continue
  const [path, value] = args[i + 1]!.split("=")
  const parts = path!.split(".")
  let target = content as unknown as Record<string, unknown>
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>
  target[parts.at(-1)!] = value === "" || Number.isNaN(Number(value)) ? value : Number(value)
}

const rules = resolveRules()

// ── Reading the world ─────────────────────────────────────────────────────

interface Tile {
  readonly x: number
  readonly y: number
  readonly size: number
}

interface World {
  readonly grid: GridValue
  /** Desirability by cell (see `appeal.ts`), paved road cells, and ruins. */
  readonly appeal: ReadonlyArray<number>
  readonly paved: ReadonlySet<number>
  /** Cells of park, by `key`: their ground and furnishing. */
  readonly parks: ReadonlyMap<number, { readonly x: number; readonly y: number; readonly ground: GroundId; readonly prop: PropId | "none" }>
  readonly ruins: ReadonlyArray<{ readonly id: number; readonly tile: Tile }>
  /** Cells of ore rocks (other rocks are stone). */
  readonly ore: ReadonlySet<number>
  readonly buildings: ReadonlyArray<{ readonly kind: KindId; readonly tile: Tile; readonly status: string; readonly site: boolean; readonly nearby: number }>
  readonly homes: ReadonlyArray<{
    readonly tile: Tile
    readonly tier: number
    readonly residents: number
    readonly site: boolean
    readonly risk: { readonly fire: number; readonly health: number; readonly order: number }
    readonly condition: number
    /** Bread, cloth, and faith all met: only its street keeps it from being a citizens' home. */
    readonly provided: boolean
  }>
  readonly stock: Amounts
  /** Each good's price with traders, in percent of the usual. */
  readonly prices: Amounts
  readonly coins: number
  readonly census: Record<string, number>
  readonly ledger: { readonly taxes: number; readonly trade: number; readonly upkeep: number; readonly admin: number }
  readonly policy: { readonly settlers: number; readonly citizens: number; readonly sells: ReadonlyArray<GoodId>; readonly buys: ReadonlyArray<GoodId>; readonly reserve: number }
  readonly mood: { readonly approval: number; readonly target: number }
  readonly crown: { readonly open: boolean; readonly good: GoodId; readonly amount: number; readonly met: number; readonly missed: number }
  readonly fate: { readonly state: string; readonly reason: string; readonly at: number; readonly score: number; readonly goalSince: number }
  readonly charter: { readonly size: CharterValue["size"]; readonly term: number; readonly founded: number }
  readonly tick: number
}

const read = (snapshot: Snapshot): World => {
  const r = snapshot.resources
  const builder = new GridBuilder(r["Town/Land"].mask)
  const buildings: Array<World["buildings"][number]> = []
  const homes: Array<World["homes"][number]> = []
  const stock: Record<string, number> = Object.fromEntries(goodIds.map((g) => [g, 0]))
  const ore = new Set<number>()
  const paved = new Set<number>()
  const parks = new Map<number, { x: number; y: number; ground: GroundId; prop: PropId | "none" }>()
  const ruins: Array<World["ruins"][number]> = []
  for (const e of snapshot.entities) {
    const c = e.components
    const tile = c["Town/Tile"] as Tile | undefined
    if (!tile) continue
    const use: Use = c["Town/Road"] ? "road" : c["Town/Park"] ? "park" : c["Town/House"] ? "house" : c["Town/Tree"] ? "tree" : c["Town/Rock"] ? "rock" : c["Town/Water"] ? "water" : c["Town/Field"] ? "field" : c["Town/Ruin"] ? "ruin" : "building"
    builder.claim(tile, e.id, use)
    if (c["Town/Rock"]?.ore) ore.add(key(tile.x, tile.y))
    if (c["Town/Paved"]) paved.add(key(tile.x, tile.y))
    if (c["Town/Park"]) parks.set(key(tile.x, tile.y), { x: tile.x, y: tile.y, ...c["Town/Park"] })
    if (c["Town/Ruin"]) ruins.push({ id: e.id, tile })
    if (c["Town/Building"]) buildings.push({ kind: c["Town/Building"].kind, tile, status: c["Town/Status"], site: !!c["Town/Site"], nearby: c["Town/Staff"]?.nearby ?? 0 })
    if (c["Town/House"])
      homes.push({
        tile,
        tier: c["Town/House"].tier,
        residents: c["Town/House"].residents,
        site: !!c["Town/Site"] || !!c["Town/Rising"],
        risk: c["Town/Risk"] ?? { fire: 0, health: 0, order: 0 },
        condition: c["Town/Condition"]?.value ?? 1000,
        provided: c["Town/House"].bread > 0 && c["Town/House"].cloth > 0 && c["Town/House"].faith > 0
      })
    if (c["Town/Storage"] && c["Town/Inventory"]) for (const g of goodIds) stock[g] = (stock[g] ?? 0) + c["Town/Inventory"].stock[g]
  }
  return {
    grid: { ...builder.value(), roads: roadPrint(builder.value()) },
    appeal: r["Town/Appeal"].cells,
    paved,
    parks,
    ruins,
    ore,
    buildings,
    homes,
    stock: stock as Amounts,
    prices: r["Town/Market"].prices,
    coins: r["Town/Treasury"].coins,
    census: r["Town/Census"],
    ledger: r["Town/Ledger"],
    policy: r["Town/Policy"],
    mood: r["Town/Mood"],
    crown: r["Town/Crown"],
    fate: r["Town/Fate"],
    charter: r["Town/Charter"],
    tick: r["Town/Time"].tick
  }
}

// ── The bot ───────────────────────────────────────────────────────────────

/** Can pay for it and keep a little in hand (more while the town is losing coins). */
const affordable = (w: World, cost: Kind["cost"]) =>
  w.coins >= cost.coins + (net(w) < 0 ? 400 : Math.max(150, w.ledger.upkeep + w.ledger.admin)) && Object.entries(cost.materials).every(([g, n]) => w.stock[g as keyof Amounts] >= (n ?? 0))
const net = (w: World) => w.ledger.taxes + w.ledger.trade - w.ledger.upkeep - w.ledger.admin
const residents = (w: World) => w.census.settlers! + w.census.citizens!
const unlocked = (w: World, kind: Kind) => residents(w) >= kind.unlock.residents && w.census.citizens! >= kind.unlock.citizens
const count = (w: World, kind: KindId) => w.buildings.filter((b) => b.kind === kind).length
const citizenHomeTarget = (w: World) => Math.ceil(Math.max(content.sizes[w.charter.size].goal.residents, residents(w)) * content.fate.citizens / content.home.tiers[2].residents * 4 / 3)
const sites = (w: World) => w.buildings.filter((b) => b.site).length + w.homes.length - w.homes.filter((h) => h.residents > 0 || h.tier > 1).length

const sourceUse: Record<string, Use> = { tree: "tree", stone: "rock", ore: "rock", water: "water", field: "empty" }
const middle = GRID / 2

/** How good a spot is for a kind: how much of what it works lies within reach (or 1 for anything else). */
const score = (w: World, kind: Kind, tile: Tile): number => {
  const g = kind.gathers ?? (kind.plants ? { source: "field", radius: kind.plants.radius } : null)
  if (!g) return 1
  const want = sourceUse[g.source]!
  return around(tile, g.radius).filter((c) => useAt(w.grid, c.x, c.y) === want && (want !== "rock" || w.ore.has(key(c.x, c.y)) === (g.source === "ore"))).length
}

/** Where to put a kind: road at a door, room for it, and (for gatherers) the most to work, nearest the middle as a tiebreak. */
const spotFor = (w: World, kind: Kind): Point | null => {
  const workersRoads = w.homes.map(home => ({ home, roads: reach(w.grid, doors(w.grid, home.tile)) }))
  let best: { cell: Point; value: number } | null = null
  const needs = kind.gathers ? (kind.gathers.source === "tree" ? 8 : kind.gathers.source === "water" ? 2 : kind.gathers.source === "field" ? 0 : 2) : 0
  for (let y = 0; y + kind.size <= GRID; y++) {
    for (let x = 0; x + kind.size <= GRID; x++) {
      const tile = { x, y, size: kind.size }
      // Gatherers go where the land is, plan or no plan.
      if (!canPlace(w.grid, tile) || (!kind.gathers && offPlan(tile))) continue
      if (!entrances(tile).some((c) => isRoad(w.grid, c.x, c.y))) continue
      const s = score(w, kind, tile)
      if (s < needs) continue
      // A forester belongs beside a lumberjack, replanting what it fells.
      if (kind.id === "forester" && !w.buildings.some((b) => b.kind === "lumberjack" && Math.abs(b.tile.x - x) <= 5 && Math.abs(b.tile.y - y) <= 5)) continue
      // A zoning mayor keeps dirty workshops a couple of cells clear of homes; services go among the homes.
      const dirty = zoned() && kind.appeal && kind.appeal.value < 0
        ? w.homes.reduce((n, h) => n + effectAt(kind.appeal!, ringOf(tile, h.tile.x, h.tile.y)) * (h.tier >= 2 ? 6 : 2), 0)
        : 0
      // A fire watch, healer, or watch house goes among the homes whose signs are up; a builder among run-down ones.
      const risky = kind.service?.service === "fire" || kind.service?.service === "health" || kind.service?.service === "order" ? kind.service.service : null
      const amid = risky !== null
        ? w.homes.filter((h) => h.risk[risky] >= content.risk.warn * 0.6 && ringOf(tile, h.tile.x, h.tile.y) <= 6).length * 3
        : kind.service?.service === "repair"
          ? w.homes.filter((h) => h.condition < 700 && ringOf(tile, h.tile.x, h.tile.y) <= 6).length * 3
          : kind.service && kind.id !== "market" ? homesAround(w, tile, 4) : 0
      // Workers walk at most `COMMUTE` road cells: a workplace well away from every home stands empty.
      if (w.homes.length > 0 && kind.workers > 0) {
        const entrances = doors(w.grid, tile)
        const workers = workersRoads.reduce((n, h) => {
          const found = nearest(h.roads, entrances)
          return n + (found && found.distance <= content.COMMUTE ? h.home.residents : 0)
        }, 0)
        if (workers < kind.workers) continue
      }
      // Services go where they are needed, wherever that is; everything else as near the middle as it can.
      const value = (kind.gathers || kind.plants ? s * 10 : 0) + dirty + amid * 2 - Math.hypot(x - middle, y - middle) / (risky !== null ? 4 : 1)
      if (!best || value > best.value) best = { cell: { x, y }, value }
    }
  }
  return best?.cell ?? null
}

/** Rings from a tile to the nearest home (or 99 when there are none). */
const nearestHome = (w: World, tile: Tile) => {
  let best = 99
  for (const h of w.homes) best = Math.min(best, ringOf(tile, h.tile.x, h.tile.y))
  return best
}
const homesAround = (w: World, tile: Tile, r: number) => w.homes.filter((h) => ringOf(tile, h.tile.x, h.tile.y) <= r).length

/**
 * The bot keeps a street plan: every fourth row and column (in line with the
 * ring road around the town hall) is for roads, and everything else stands
 * in the blocks between them, three cells across.
 */
const lane = (x: number, y: number) => x % 4 === 1 || y % 4 === 1
const offPlan = (tile: Tile) => {
  for (let dy = 0; dy < tile.size; dy++) for (let dx = 0; dx < tile.size; dx++) if (lane(tile.x + dx, tile.y + dy)) return true
  return false
}

/**
 * Free cells beside a road and off the lanes, nearest the middle first: a
 * zoning mayor passes over squalid ones and leans towards nicer ones (or,
 * for workers' cottages, takes those nearest the workplace); a crowding one
 * packs homes in beside the industry.
 */
const homeSpots = (w: World, n: number, near?: Tile): Array<Point> => {
  const spots: Array<Point> = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (useAt(w.grid, x, y) !== "empty" || lane(x, y)) continue
      if (DIRS.some((d) => isRoad(w.grid, x + d.x, y + d.y))) spots.push({ x, y })
    }
  }
  const industry = bot === "crowded" ? w.buildings.filter((b) => (kinds[b.kind].appeal?.value ?? 0) <= -2) : []
  const score = (c: Point) => {
    const distance = Math.hypot(c.x - middle, c.y - middle)
    if (near) return ringOf(near, c.x, c.y)
    if (bot === "crowded") return industry.length > 0 ? Math.min(...industry.map((b) => ringOf(b.tile, c.x, c.y))) + distance / 20 : distance
    if (!zoned()) return distance
    const v = w.appeal[key(c.x, c.y)] ?? 0
    return distance - v / 2 + (v <= content.home.squalid ? 30 : 0)
  }
  return spots.sort((a, b) => score(a) - score(b)).slice(0, n)
}

/**
 * Where a new park helps most: the free square of `size` cells off the
 * lanes with the most homes within its reach that fall just short of the
 * next tier's desirability (a furnished park of `size` gives about `value`).
 */
const parkFor = (w: World, size: number, value: number): Point | null => {
  const short = w.homes.filter((h) => {
    if (h.site || h.tier === 3) return false
    const v = w.appeal[key(h.tile.x, h.tile.y)] ?? 0
    const goal = content.home.tiers[h.tier === 1 ? 2 : 3].appeal
    return v < goal && v >= goal - value
  })
  const minimum = size === 1 ? 1 : 3
  if (short.length < minimum) return null
  const reach = content.park.reach[0] + Math.floor((size * size) / content.park.reach[1])
  let best: { cell: Point; value: number } | null = null
  for (let y = 0; y + size <= GRID; y++) {
    for (let x = 0; x + size <= GRID; x++) {
      const tile = { x, y, size }
      if (!canPlace(w.grid, tile) || offPlan(tile)) continue
      const value = short.filter((h) => ringOf(tile, h.tile.x, h.tile.y) <= Math.max(1, reach - 1)).length
      if (value >= minimum && (!best || value > best.value)) best = { cell: { x, y }, value }
    }
  }
  return best?.cell ?? null
}

/**
 * The next furnishing for the town's parks: on a bare cell of a park with
 * room for more, the finest the town can afford that the park lacks
 * (a statue, a fountain, a lamp).
 */
const furnishing = (w: World): Edit | null => {
  const parks = parksOf([...w.parks.values()])
  for (const p of parks) {
    const placed = p.cells.filter((c) => c.prop !== "none")
    if (placed.length >= Math.ceil(p.cells.length / content.park.cellsPerProp)) continue
    const bare = p.cells.find((c) => c.prop === "none")
    if (!bare) continue
    const has = new Set(placed.map((c) => c.prop))
    const wanted: ReadonlyArray<PropId> = w.coins > 1500 ? ["statue", "fountain", "lamp"] : w.coins > 300 ? ["fountain", "lamp"] : ["lamp"]
    for (const id of wanted) {
      const piece = content.props[id]
      if (has.has(id) && id !== "lamp") continue
      if (residents(w) < piece.unlock.residents || w.census.citizens! < piece.unlock.citizens || !affordable(w, piece.cost)) continue
      return { type: "prop", prop: id, cell: { x: bare.x, y: bare.y } }
    }
  }
  return null
}

/** Homes whose sign for a risk is up, or nearly. */
const atRisk = (w: World, r: "fire" | "health" | "order") => w.homes.filter((h) => !h.site && h.risk[r] >= content.risk.warn * 0.8).length

/**
 * A road towards what a kind needs (or, for anything else, into open land):
 * the shortest run of free cells from the road network to a cell near the
 * source, at most `limit` long.
 */
const roadToward = (w: World, kind: Kind | null, limit = 16): Array<Point> => {
  const free = (x: number, y: number) => inside(x, y) && (useAt(w.grid, x, y) === "empty" || useAt(w.grid, x, y) === "tree") && (lane(x, y) || !!kind?.gathers)
  const want = kind?.gathers ? sourceUse[kind.gathers.source] : null
  const goal = (x: number, y: number) =>
    want
      ? DIRS.some((d) => useAt(w.grid, x + 2 * d.x, y + 2 * d.y) === want || useAt(w.grid, x + 3 * d.x, y + 3 * d.y) === want)
      : kind === null
      ? around({ x, y, size: 1 }, 1).filter((c) => !lane(c.x, c.y) && useAt(w.grid, c.x, c.y) === "empty").length >= 3
      : fitsBeside(x, y, kind.size)
  // Room for a building `size` cells a side with a door on (x, y), keeping off the road being laid.
  const fitsBeside = (x: number, y: number, size: number) => {
    for (let ty = y - size; ty <= y + 1; ty++) {
      for (let tx = x - size; tx <= x + 1; tx++) {
        const tile = { x: tx, y: ty, size }
        if (entrances(tile).some((c) => c.x === x && c.y === y) && canPlace(w.grid, tile) && !offPlan(tile)) return true
      }
    }
    return false
  }
  const previous = new Map<number, number>()
  const queue: Array<Point> = []
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (isRoad(w.grid, x, y)) queue.push({ x, y })
  const seen = new Set(queue.map((c) => key(c.x, c.y)))
  const depth = new Map(queue.map((c) => [key(c.x, c.y), 0]))
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!
    const d = depth.get(key(c.x, c.y))!
    if (d > 0 && goal(c.x, c.y)) {
      const path: Array<Point> = []
      for (let k: number | undefined = key(c.x, c.y); k !== undefined && !isRoad(w.grid, k % GRID, Math.floor(k / GRID)); k = previous.get(k)) path.push({ x: k % GRID, y: Math.floor(k / GRID) })
      return path.reverse()
    }
    if (d >= limit) continue
    for (const dir of DIRS) {
      const n = { x: c.x + dir.x, y: c.y + dir.y }
      const k = key(n.x, n.y)
      if (seen.has(k) || !free(n.x, n.y)) continue
      seen.add(k)
      previous.set(k, key(c.x, c.y))
      depth.set(k, d + 1)
      queue.push(n)
    }
  }
  return []
}

/**
 * What another cottage would bring in after what it adds to administration (the build tooltip's sum), if it
 * were fed as often as the town's homes are now (`fed`, the share of them fed).
 */
const cottageWorth = (w: World, fed: number) => {
  const cottage = { tier: 1 as const, food: 1, bread: 0, cloth: 0, faith: 0, residents: home.tiers[1].residents }
  const cost = (n: number) => n * (rules.admin.perHome + n / rules.admin.growth)
  return fed * taxOf({ ...cottage, residents: capacity(cottage, w.mood.approval, 0, rules, w.policy.settlers) }, w.policy, rules) - (cost(w.homes.length + 1) - cost(w.homes.length))
}

/** What the bot wants next, in order: the first it can do, it does. */
const plan = (w: World): ReadonlyArray<{ readonly kind: KindId; readonly when: boolean }> => {
  const homes = w.homes.length
  // Food goes by the mouth: a fish or a loaf a visit for every four residents (see `mealsOf`).
  const meals = w.homes.reduce((n, h) => n + mealsOf(h, rules), 0)
  const basics: ReadonlyArray<{ readonly kind: KindId; readonly when: boolean }> = [
    { kind: "fishery", when: count(w, "fishery") < 1 },
    // Services once their warning signs go up over a few homes; a builder once homes start to run down.
    { kind: "firewatch", when: covered() && atRisk(w, "fire") >= 3 && count(w, "firewatch") < 1 + Math.floor(homes / 30) },
    { kind: "healer", when: covered() && atRisk(w, "health") >= 3 && count(w, "healer") + count(w, "hospital") < 1 + Math.floor(homes / 40) },
    { kind: "watchhouse", when: covered() && atRisk(w, "order") >= 3 && count(w, "watchhouse") < 1 + Math.floor(homes / 40) },
    { kind: "builder", when: w.homes.filter((h) => h.condition < 650).length >= 3 && count(w, "builder") < 1 + Math.floor((homes + w.buildings.length) / 80) },
    { kind: "lumberjack", when: count(w, "lumberjack") < 1 },
    { kind: "sawmill", when: count(w, "sawmill") < 1 },
    { kind: "forester", when: count(w, "forester") < count(w, "lumberjack") },
    { kind: "market", when: count(w, "market") < 1 && homes >= 6 },
    { kind: "quarry", when: count(w, "quarry") < 1 },
    // A lumberjack that has felled everything in reach is replaced by one in a forest.
    { kind: "lumberjack", when: w.stock.planks < 20 && w.buildings.filter((b) => b.kind === "lumberjack" && b.status !== "starved").length < 1 + Math.floor(homes / 40) && count(w, "lumberjack") < 2 + Math.floor(homes / 30) },
    // Food: a fishery more while homes go hungry (fish rots, so the larder alone is no guide), and a
    // market for every eighteen meals or so, or what is caught is never handed out.
    // Each bakery feeds the mouths two fisheries would.
    { kind: "fishery", when: w.census.food! < w.homes.length * 0.75 && count(w, "fishery") < Math.max(2, 1 + Math.floor(meals / 7) - 2 * count(w, "bakery")) },
    { kind: "market", when: count(w, "market") < 1 + Math.floor(meals / 20) && w.census.food! < w.homes.length * 0.7 }
  ]
  if (bot === "idle" || bot === "sprawl") return basics
  // The citizens' chains, in proportion to the homes: a bakery bakes for about
  // 16 homes and needs a mill, and a mill most of a farm; a weaver weaves for
  // about 14 homes from one sheep farm's wool. Upstream first, so what a
  // workshop needs is coming before it stands.
  const plannedHomes = citizenHomeTarget(w)
  const citizenHomes = Math.max(plannedHomes, w.homes.filter(h => !h.site && (h.tier >= 2 || (w.appeal[key(h.tile.x, h.tile.y)] ?? 0) >= home.tiers[2].appeal)).length)
  // Citizens eat two loaves a visit, burghers three.
  const bakeries = Math.max(1, Math.ceil(citizenHomes / 4))
  const weavers = Math.max(1, Math.ceil(citizenHomes / 12))
  return [
    ...basics,
    // One of each first, saved up for (see `saving`): tools are scarce until there are citizens to run a smithy.
    { kind: "chapel", when: count(w, "chapel") < 1 },
    { kind: "farm", when: count(w, "farm") < 1 },
    { kind: "mill", when: count(w, "mill") < 1 },
    { kind: "bakery", when: count(w, "bakery") < 1 },
    { kind: "sheep", when: count(w, "sheep") < 1 },
    { kind: "weaver", when: count(w, "weaver") < 1 },
    { kind: "market", when: count(w, "market") < 1 + Math.floor(meals / 18) },
    { kind: "smithy", when: count(w, "smithy") < 1 },
    { kind: "mine", when: count(w, "mine") < 1 },
    { kind: "chapel", when: count(w, "chapel") < 1 + Math.floor(homes / 35) },
    { kind: "farm", when: count(w, "farm") < Math.ceil(bakeries * 0.8) },
    { kind: "mill", when: count(w, "mill") < Math.min(bakeries, count(w, "farm") + 1) },
    { kind: "bakery", when: count(w, "bakery") < Math.min(bakeries, count(w, "mill")) },
    { kind: "sheep", when: count(w, "sheep") < weavers },
    { kind: "weaver", when: count(w, "weaver") < Math.min(weavers, count(w, "sheep")) },
    { kind: "warehouse", when: count(w, "warehouse") < Math.floor(homes / 25) },
    // Fish and bread rot: a granary keeps them, and smoked fish keeps.
    { kind: "granary", when: homes >= 40 && count(w, "granary") < 1 + Math.floor(homes / 70) },
    { kind: "smokehouse", when: homes >= 30 && count(w, "smokehouse") < Math.floor(count(w, "fishery") / 3) },
    { kind: "sawmill", when: w.stock.planks < 15 && w.stock.wood > 10 && count(w, "sawmill") < 3 },
    { kind: "quarry", when: w.stock.stone < 8 && count(w, "quarry") < 3 }
  ]
}

/** One decision: build what is wanted first, or homes when workers run short, or road towards what is needed. */
const decide = (w: World): ReadonlyArray<Edit> => {
  const edits: Array<Edit> = []
  // Policy, now and then.
  if (bot === "greedy") {
    if (w.policy.settlers !== 200) edits.push({ type: "tax", tier: "settlers", rate: 200 }, { type: "tax", tier: "citizens", rate: 200 }, { type: "reserve", amount: 10 })
    for (const g of goodIds) if (!w.policy.sells.includes(g)) edits.push({ type: "trade", good: g, mode: "sell" })
  }
  const fed = w.homes.length > 0 ? w.census.food! / w.homes.length : 1
  if (bot === "sprawl") {
    const rate = w.mood.approval > 25 ? 200 : w.mood.approval > 10 ? 175 : w.mood.approval > 0 ? 150 : w.mood.approval > -20 ? 125 : 100
    if (w.policy.settlers !== rate) edits.push({ type: "tax", tier: "settlers", rate }, { type: "tax", tier: "citizens", rate })
    if (w.policy.reserve !== 30) edits.push({ type: "reserve", amount: 30 })
    // Fish bought whenever the homes go short, planks when building runs short; the crown answered when it can be.
    for (const [g, low, enough] of [["fish", fed < 0.8 ? 30 : -1, 30], ["planks", 8, 20]] as const) {
      const buying = w.policy.buys.includes(g)
      if (!buying && w.stock[g] < low && w.coins > 60) edits.push({ type: "trade", good: g, mode: "buy" })
      if (buying && (w.stock[g] >= enough || w.coins < 30)) edits.push({ type: "trade", good: g, mode: "none" })
    }
    if (w.crown.open && w.stock[w.crown.good] >= w.crown.amount) edits.push({ type: "deliver" })
  }
  if (sensible()) {
    // Taxes follow the town's mood; once every other goal is met, they come down to win it over.
    const goals = goalsOf(w.charter, {
      settlers: w.census.settlers!, citizens: w.census.citizens!, coins: w.coins, net: net(w), approval: w.mood.approval
    }, rules)
    // Closing in on a complete town: everything but approval and the larder met. Cut taxes, buy food.
    const closing = goals.every((g) => g.met || g.id === "approval") && w.coins > 1000
    const rate = closing || w.mood.approval < 0 ? 50 : w.mood.approval < 15 ? 75 : w.mood.approval > 45 ? 125 : 100
    if (w.policy.settlers !== rate) edits.push({ type: "tax", tier: "settlers", rate }, { type: "tax", tier: "citizens", rate })
    // Keep enough to answer the crown, buying what is short of its request.
    const asked = w.crown.open ? w.crown.amount : 0
    const reserve = asked > 50 ? 100 : 50
    if (w.policy.reserve !== reserve) edits.push({ type: "reserve", amount: reserve })
    const cost = w.crown.amount * content.goods[w.crown.good].price * 2
    const crownBuy = w.crown.open && w.stock[w.crown.good] < w.crown.amount && w.coins > cost + 200 ? w.crown.good : null
    if (crownBuy && !w.policy.buys.includes(crownBuy)) edits.push({ type: "trade", good: crownBuy, mode: "buy" })
    // Buy what runs short, while the treasury can bear it; stop once there is enough.
    // Never at any price: buying drives it up, so stop at half again the usual.
    const civicShort = w.coins > 1500 && count(w, "mill") > 0 && count(w, "weaver") > 0 && count(w, "chapel") > 0 && w.census.citizens! < Math.max(content.sizes[w.charter.size].goal.residents, residents(w)) * content.fate.citizens
    const shortages: ReadonlyArray<readonly [GoodId, number, number]> = [["bread", civicShort ? 8 : -1, 20], ["cloth", civicShort ? 4 : -1, 12], ["planks", 6, 14], ["stone", 4, 12], ["tools", 3, 6], ["fish", (fed < 0.5 && w.stock.fish < 10) || (closing && fed < 0.7 && w.stock.fish < 20) ? 1000 : -1, 24]]
    for (const [g, low, enough] of shortages) {
      if (g === crownBuy) continue
      const buying = w.policy.buys.includes(g)
      const dear = w.prices[g] > 150
      if (!buying && w.stock[g] < low && w.coins > 150 && !dear) edits.push({ type: "trade", good: g, mode: "buy" })
      if (buying && (w.stock[g] >= enough || w.coins < 50 || dear)) edits.push({ type: "trade", good: g, mode: "none" })
    }
    if (w.crown.open && w.stock[w.crown.good] >= w.crown.amount) edits.push({ type: "deliver" })
    // Stop buying what was only bought for the crown.
    for (const g of w.policy.buys) if (g !== crownBuy && !shortages.some(([s]) => s === g)) edits.push({ type: "trade", good: g, mode: content.trade.sells.includes(g) ? "sell" : "none" })
    // In debt: stop what is idle anyway; back to work once there is money again. While the crown waits
    // for something the town's own workshops use up (wood, wool, ore), those workshops wait instead; the
    // bread chain is too precious to stop, so wheat and flour are bought instead.
    const hoarding = w.crown.open && w.stock[w.crown.good] < w.crown.amount && !["wheat", "flour"].includes(w.crown.good) ? w.crown.good : null
    for (const b of w.buildings) {
      if (b.site || b.kind === "townhall") continue
      const consumer = hoarding !== null && kinds[b.kind].recipe?.input === hoarding
      if (consumer && b.status !== "paused") edits.push({ type: "pause", cell: b.tile, on: true })
      else if (w.coins < 0 && net(w) < 0 && ["blocked", "starved"].includes(b.status)) edits.push({ type: "pause", cell: b.tile, on: true })
      else if (b.status === "paused" && !consumer && w.coins > 300) edits.push({ type: "pause", cell: b.tile, on: false })
    }
  }
  // Ruins are cleared.
  if (bot !== "idle") for (const r of w.ruins) edits.push({ type: "remove", cell: { x: r.tile.x, y: r.tile.y } })
  if (bot === "idle" && residents(w) > 30) return edits

  // A workshop more where what it works piles up in storage (flour with no baker to bake it), before anything else.
  if (sensible()) {
    const backlog = (["bakery", "weaver", "mill"] as const).find((k) => w.stock[kinds[k].recipe!.input!] > 40 && unlocked(w, kinds[k]) && affordable(w, kinds[k].cost)
      && !w.buildings.some((b) => b.kind === k && (b.site || b.status === "unstaffed")))
    const spot = backlog ? spotFor(w, kinds[backlog]) : null
    if (backlog && spot) return [...edits, { type: "building", kind: backlog, cell: spot, open: false }]
  }
  // Establish enough desirable homes before adding more cottages or repeating industrial chains.
  const citizenHomes = citizenHomeTarget(w)
  const eligible = w.homes.filter(h => !h.site && (w.appeal[key(h.tile.x, h.tile.y)] ?? 0) >= content.home.tiers[2].appeal).length
  if (zoned() && residents(w) >= 30 && count(w, "chapel") > 0 && eligible < citizenHomes && w.coins > 250) {
    const furnishingEdit = furnishing(w)
    if (furnishingEdit) return [...edits, furnishingEdit]
    const large = parkFor(w, 2, 9)
    const size = large ? 2 : 1
    const spot = large ?? parkFor(w, 1, w.census.citizens! >= 20 ? 6 : 5)
    if (spot && affordable(w, { coins: size * size * content.grounds.flowers.cost.coins, materials: {} })) {
      const cells = Array.from({ length: size * size }, (_, i) => ({ x: spot.x + i % size, y: spot.y + Math.floor(i / size) }))
      return [...edits, { type: "ground", ground: "flowers", cells }]
    }
  }
  // Workers' cottages beside a workplace no settler can walk to.
  const lonely = w.buildings.find((b) => !b.site && b.status === "unstaffed" && kinds[b.kind].workers > 0)
  if (lonely && affordable(w, { coins: home.cost.coins * 3, materials: { planks: 3 } })) {
    const spots = homeSpots(w, 3, lonely.tile).filter((c) => ringOf(lonely.tile, c.x, c.y) <= 6)
    if (spots.length > 0) return [...edits, { type: "homes", cells: spots }]
  }
  if (sites(w) > 3) return edits
  // Homes when workers run short, or (they are the town's income) when food reaches most of them and
  // there are coins to spare; not far past the goal, where upgrading homes pays better than more of them.
  const goal = content.sizes[w.charter.size].goal.residents
  const sprawling = bot === "sprawl" && fed >= 0.5 && w.stock.planks >= 4
  // Not while the homes there are go hungry: a hungry home holds half its people, and more cottages only spread the food thinner.
  const short = sprawling || (w.census.jobs! + 6 > residents(w) && fed >= 0.6) || (fed >= 0.6 && w.stock.planks >= 8 && w.coins > 300 && residents(w) < goal * 1.1 && w.homes.length < Math.ceil(goal / home.tiers[1].residents) && cottageWorth(w, fed) > 2)
  if (short && affordable(w, { coins: home.cost.coins * 4, materials: { planks: 4 } })) {
    const spots = homeSpots(w, 4)
    if (spots.length > 0) return [...edits, { type: "homes", cells: spots }]
    const road = roadToward(w, null)
    if (road.length > 0 && w.coins > road.length * ROAD_COST + 60) return [...edits, { type: "roads", cells: road }]
  }
  if (process.env.DEBUG_PLAN) console.log(`  t ${w.tick} coins ${w.coins} planks ${w.stock.planks} stone ${w.stock.stone} tools ${w.stock.tools} wants ${plan(w).filter((p) => p.when).map((p) => p.kind).join(",")}`)
  for (const want of plan(w)) {
    if (!want.when) continue
    const kind = kinds[want.kind]
    if (!unlocked(w, kind)) continue
    // The first of each of the citizens' chain is saved up for, rather than spending on what comes after it.
    if (!affordable(w, kind.cost)) {
      if (saving.includes(want.kind) && count(w, want.kind) < 1) break
      continue
    }
    // Another of a kind will not help while one stands without workers.
    if (want.kind !== "fishery" && w.buildings.some((b) => b.kind === want.kind && !b.site && b.status === "unstaffed")) continue
    if ((resting.get(want.kind) ?? 0) > w.tick) continue
    const spot = spotFor(w, kind)
    if (spot) {
      roading.delete(want.kind)
      return [...edits, { type: "building", kind: want.kind, cell: spot, open: false }]
    }
    // Lay a road towards what it needs, a few times; if there is still no room, leave it for a few minutes.
    const road = roadToward(w, kind)
    if (road.length > 0 && w.coins > road.length * ROAD_COST + kind.cost.coins && (roading.get(want.kind) ?? 0) < 4) {
      roading.set(want.kind, (roading.get(want.kind) ?? 0) + 1)
      return [...edits, { type: "roads", cells: road }]
    }
    roading.delete(want.kind)
    resting.set(want.kind, w.tick + 5 * 3600)
  }
  // Parks, then (with stone to spare) paving, where homes fall a little short of the next tier: furnish
  // the parks there are first, then lay a small lawn (a bigger one once the treasury is comfortable).
  if (zoned() && w.coins > 150) {
    const furnish = furnishing(w)
    if (furnish) return [...edits, furnish]
    const size = w.coins > 1500 ? 3 : 2
    const spot = parkFor(w, size, size === 3 ? 12 : 6)
    if (spot && affordable(w, { coins: size * size * content.grounds.lawn.cost.coins, materials: {} })) {
      const cells: Array<Point> = []
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) cells.push({ x: spot.x + dx, y: spot.y + dy })
      return [...edits, { type: "ground", ground: "lawn", cells }]
    }
    if (w.stock.stone >= 15 && w.coins > 400) {
      const cells: Array<Point> = []
      for (const h of w.homes) {
        if (h.tier === 3 || h.site) continue
        const v = w.appeal[key(h.tile.x, h.tile.y)] ?? 0
        if (v !== content.home.tiers[h.tier === 1 ? 2 : 3].appeal - 1) continue
        for (const d of DIRS) {
          const c = { x: h.tile.x + d.x, y: h.tile.y + d.y }
          if (isRoad(w.grid, c.x, c.y) && !w.paved.has(key(c.x, c.y)) && !cells.some((p) => p.x === c.x && p.y === c.y)) cells.push(c)
        }
      }
      if (cells.length > 0) return [...edits, { type: "pave", cells: cells.slice(0, 4) }]
    }
  }
  return edits
}
/** What a mayor saves up for (the first of each), rather than spend on anything later in the plan. */
const saving: ReadonlyArray<KindId> = ["chapel", "farm", "mill", "bakery", "sheep", "weaver"]
/** Roads laid towards each kind since one was last built, and until when a kind with no room is left alone. */
const roading = new Map<KindId, number>()
const resting = new Map<KindId, number>()

// ── Running ───────────────────────────────────────────────────────────────

interface Row {
  readonly minute: number
  readonly coins: number
  readonly net: number
  readonly income: number
  readonly costs: number
  readonly admin: number
  readonly approval: number
  readonly residents: number
  readonly citizens: number
  readonly homes: number
  readonly food: number
  readonly larder: number
  readonly winter: boolean
  readonly crown: string
  readonly goals: number
  /** Homes sick and things on fire now; homes and buildings lost to fire, collapse, and dereliction so far. */
  readonly sick: number
  readonly burning: number
  readonly lost: number
  readonly burghers: number
  readonly problems: Record<string, number>
}

const run = (seed: number) => {
  roading.clear()
  resting.clear()
  const town = headless({ size, term, land, seed }, { rules, toast: (m) => { if (process.env.DEBUG) console.log("toast:", m) } })
  const ui = town.ui
  const step = town.run

  const rows: Array<Row> = []
  const problems: Record<string, number> = {}
  const ruined = new Set<number>()
  const spend: Record<string, number> = {}
  let longestGoalHold = 0
  let w = read(town.snapshot())
  const DECIDE = 5
  for (let t = 0; t < term * 60 + DECIDE && w.fate.state === "playing"; t += DECIDE) {
    const chosen = decide(w)
    if (process.env.SPEND) {
      for (const e of chosen) {
        const k = e.type === "building" ? kinds[e.kind].category === "services" ? e.kind : kinds[e.kind].category : e.type === "prop" ? e.prop : e.type
        const cost = e.type === "building" ? kinds[e.kind].cost.coins : e.type === "homes" ? e.cells.length * home.cost.coins : e.type === "roads" ? e.cells.length * ROAD_COST : e.type === "pave" ? e.cells.length * 3 : e.type === "ground" ? e.cells.length * content.grounds[e.ground].cost.coins : e.type === "prop" ? content.props[e.prop].cost.coins : 0
        if (cost > 0) spend[k] = (spend[k] ?? 0) + cost
      }
      if ((t + DECIDE) % 300 === 0) {
        const l = w.ledger
        console.log(`  ${(t + DECIDE) / 60}m ledger/min taxes ${l.taxes} trade ${l.trade} upkeep ${l.upkeep} admin ${l.admin} · spent last 5 min: ${Object.entries(spend).map(([k, n]) => `${k} ${n}`).join(", ")}`)
        for (const k of Object.keys(spend)) delete spend[k]
      }
    }
    if (process.env.DEBUG) console.log(t, JSON.stringify(chosen).slice(0, 200))
    ui.edits.push(...chosen)
    step(DECIDE)
    w = read(town.snapshot())
    if (w.fate.goalSince >= 0) longestGoalHold = Math.max(longestGoalHold, (w.tick - w.charter.founded - w.fate.goalSince) / 60)
    for (const r of w.ruins) ruined.add(r.id)
    if ((t + DECIDE) % 60 !== 0) continue
    if (process.env.TRACE) {
      const snap = town.snapshot()
      const chain = ["farm", "mill", "bakery", "sheep", "weaver", "chapel", "market"].map((k) => {
        const all = snap.entities.filter((e) => e.components["Town/Building"]?.kind === k)
        const up = all.filter((e) => !e.components["Town/Site"] && !e.components["Town/Rising"])
        const made = up.reduce((n, e) => n + (e.components["Town/Recipe"]?.made ?? 0), 0)
        return `${k} ${up.length}/${all.length}${made ? ` made ${made}` : ""}${up.length ? ` ${up.map((e) => e.components["Town/Status"][0]).join("")}` : ""}`
      })
      const homes = snap.entities.filter((e) => e.components["Town/House"]).map((e) => e.components["Town/House"])
      console.log(`  ${(t + DECIDE) / 60}m coins ${w.coins} · ${chain.join(" · ")} · bread ${homes.filter((h) => h.bread > 0).length} cloth ${homes.filter((h) => h.cloth > 0).length} faith ${homes.filter((h) => h.faith > 0).length} /${homes.length} · stock bread ${w.stock.bread} flour ${w.stock.flour} wheat ${w.stock.wheat} tools ${w.stock.tools}`)
    }
    const minute = (t + DECIDE) / 60
    if (minute === snapshotAt) {
      mkdirSync(out, { recursive: true })
      const file = `${out}/${size}-${land}-${seed}-${minute}min.json`
      const title = `${size}, ${land} land · ${minute} min in · ${bot} bot, seed ${seed}`
      writeFileSync(file, JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION, slot: "manual", savedAt: Date.now(), title, world: town.snapshot() }))
      console.log(`saved ${file}`)
    }
    const problemsNow: Record<string, number> = {}
    for (const b of w.buildings) {
      if (["unconnected", "unstaffed", "starved", "blocked"].includes(b.status) && !b.site) {
        const k = `${b.kind} ${b.status}`
        problemsNow[k] = (problemsNow[k] ?? 0) + 1
        problems[k] = (problems[k] ?? 0) + 1
      }
    }
    const h = Math.max(1, w.homes.length)
    const income = w.ledger.taxes + Math.max(0, w.ledger.trade)
    const costs = w.ledger.upkeep + w.ledger.admin + Math.max(0, -w.ledger.trade)
    const goals = goalsOf(w.charter, {
      settlers: w.census.settlers!, citizens: w.census.citizens!, coins: w.coins, net: income - costs, approval: w.mood.approval
    }, rules)
    rows.push({
      minute,
      coins: w.coins,
      net: income - costs,
      income,
      costs,
      admin: w.ledger.admin,
      approval: w.mood.approval,
      residents: residents(w),
      citizens: w.census.citizens!,
      homes: w.homes.length,
      food: Math.round((w.census.food! / h) * 100),
      larder: larder(w.stock),
      winter: seasonAt(w.tick - w.charter.founded, w.charter, rules).winter,
      crown: `${w.crown.open ? `${w.crown.amount} ${w.crown.good}` : "-"} ${w.crown.met}/${w.crown.missed}`,
      goals: goals.filter((g) => g.met).length,
      sick: w.census.sick!,
      burning: w.census.burning!,
      lost: ruined.size,
      burghers: w.census.burghers!,
      problems: problemsNow
    })
  }
  if (process.env.CHRONICLE) for (const l of town.snapshot().resources["Town/Chronicle"].lines as Array<{ tick: number; text: string }>) console.log(`  ${(l.tick / 3600).toFixed(1)} ${l.text}`)
  const lastGoals = goalsOf(w.charter, {
    settlers: w.census.settlers!, citizens: w.census.citizens!, coins: w.coins, net: net(w), approval: w.mood.approval
  }, rules).map((g) => `${g.met ? "✓" : "✗"} ${g.text} (${g.value})`).join(" · ")
  const hh = Math.max(1, w.homes.length)
  console.log(`  longest continuous goal hold: ${longestGoalHold.toFixed(1)} seconds`)
  const supplied = `food ${Math.round((w.census.food! / hh) * 100)}% bread ${Math.round((w.census.bread! / hh) * 100)}% cloth ${Math.round((w.census.cloth! / hh) * 100)}% faith ${Math.round((w.census.faith! / hh) * 100)}%`
  const end = w.fate.state === "playing" ? { state: "playing", reason: "", minute: term } : { state: w.fate.state, reason: w.fate.reason, minute: Math.round(w.fate.at / 360) / 10 }
  const built: Record<string, number> = {}
  for (const b of w.buildings) built[b.kind] = (built[b.kind] ?? 0) + 1
  const final = town.snapshot().resources
  return { seed, rows, problems, end, score: w.fate.score, built, stock: w.stock, crown: w.crown, lastGoals, supplied, lost: ruined.size,
    longestGoalHoldSeconds: longestGoalHold,
    final: { census: final["Town/Census"], treasury: final["Town/Treasury"], ledger: final["Town/Ledger"], mood: final["Town/Mood"], fate: final["Town/Fate"], charter: final["Town/Charter"] } }
}

const pad = (v: unknown, n: number) => String(v).padStart(n)
const header = "  min   coins   net  income costs admin  appr  resid  citiz burgh homes food% larder season   crown(met/missed) goals sick fire lost  problems"
const line = (r: Row) => {
  const p = Object.entries(r.problems).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ""}`).join(", ")
  return `${pad(r.minute, 5)} ${pad(r.coins, 7)} ${pad(r.net, 5)} ${pad(r.income, 7)} ${pad(r.costs, 5)} ${pad(r.admin, 5)} ${pad(r.approval, 5)} ${pad(r.residents, 6)} ${pad(r.citizens, 6)} ${pad(r.burghers, 5)} ${pad(r.homes, 5)} ${pad(r.food, 5)} ${pad(r.larder, 6)} ${pad(r.winter ? "winter" : "", 6)}  ${pad(r.crown, 18)} ${pad(r.goals, 5)} ${pad(r.sick, 4)} ${pad(r.burning, 4)} ${pad(r.lost, 4)}  ${p}`
}
const mean = (xs: ReadonlyArray<number>) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

/** Plays every seed with one mayor, reporting as it goes. */
const play = (which: Bot) => {
  bot = which
  const results: Array<ReturnType<typeof run>> = []
  const started = performance.now()
  for (let i = from; i < from + seeds; i++) {
    const r = run(1000 + i * 7919)
    results.push(r)
    const outcome = r.end.state === "playing" ? "still playing" : `${r.end.state} at ${r.end.minute} min: ${r.end.reason}`
    console.log(`seed ${r.seed}: ${outcome}  (score ${r.score})`)
    console.log(`  goals: ${r.lastGoals}`)
    console.log(`  homes supplied: ${r.supplied} · built ${Object.entries(r.built).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ""}`).join(", ")}`)
    if (verbose) {
      console.log(header)
      for (const row of r.rows) if (row.minute % every === 0 || row === r.rows.at(-1)) console.log(line(row))
      console.log(`  built: ${Object.entries(r.built).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ""}`).join(", ")}`)
      console.log(`  stock: ${goodIds.filter((g) => r.stock[g] > 0).map((g) => `${g} ${r.stock[g]}`).join(", ")}\n`)
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n${seeds} seeds · ${size} ${land} land · ${term}-minute term · ${bot} mayor  (${Math.round((performance.now() - started) / 1000)} s)`)
  const outcomes: Record<string, Array<number>> = {}
  for (const r of results) {
    const k = r.end.state === "lost" ? `lost (${r.end.reason.split(":")[0]!.toLowerCase()})` : r.end.state
    ;(outcomes[k] ??= []).push(r.end.minute)
  }
  console.log(`  outcomes        ${Object.entries(outcomes).map(([k, ms]) => `${k} ×${ms.length} (around minute ${Math.round(mean(ms))})`).join(", ")}`)
  console.log(`  score           ${Math.round(mean(results.map((r) => r.score)))}`)
  console.log(`  crown           met ${mean(results.map((r) => r.crown.met)).toFixed(1)}, missed ${mean(results.map((r) => r.crown.missed)).toFixed(1)}`)
  // The pressure curve: each checkpoint averaged over the seeds still running then.
  console.log(`\n  pressure, averaged over the seeds still in office:`)
  console.log("  min  seeds  resid  citiz  homes   coins    net  costs/income  admin  appr  food%  larder/homes  goals")
  for (let m = every; m <= term; m += every) {
    const at = results.map((r) => r.rows.find((row) => row.minute === m)).filter((row): row is Row => row !== undefined)
    if (at.length === 0) break
    console.log(
      `${pad(m, 5)} ${pad(at.length, 6)} ${pad(Math.round(mean(at.map((r) => r.residents))), 6)} ${pad(Math.round(mean(at.map((r) => r.citizens))), 6)} ${pad(Math.round(mean(at.map((r) => r.homes))), 6)} ${pad(Math.round(mean(at.map((r) => r.coins))), 7)} ${pad(Math.round(mean(at.map((r) => r.net))), 6)} ${pad(mean(at.map((r) => r.costs / Math.max(1, r.income))).toFixed(2), 13)} ${pad(Math.round(mean(at.map((r) => r.admin))), 6)} ${pad(Math.round(mean(at.map((r) => r.approval))), 5)} ${pad(Math.round(mean(at.map((r) => r.food))), 6)} ${pad(mean(at.map((r) => r.larder / Math.max(1, r.homes))).toFixed(2), 13)} ${pad(mean(at.map((r) => r.goals)).toFixed(1), 6)}`
    )
  }
  const allProblems: Record<string, number> = {}
  for (const r of results) for (const [k, n] of Object.entries(r.problems)) allProblems[k] = (allProblems[k] ?? 0) + n
  const top = Object.entries(allProblems).sort((a, b) => b[1] - a[1]).slice(0, 6)
  console.log(`\n  most common problems   ${top.map(([k, n]) => `${k} (${(n / seeds).toFixed(1)} min/seed)`).join(", ") || "none"}`)
  return results
}

const mine = play(bot)
const jsonOut = option("json", "")
if (jsonOut) {
  mkdirSync(dirname(jsonOut), { recursive: true })
  writeFileSync(jsonOut, JSON.stringify({ size, land, term, bot, rulesSha256: fingerprint(rules), results: mine }, null, 2))
}
if (versus !== "") {
  const first = bot
  const theirs = play(versus)
  /** Each mayor's towns, side by side: how far they got, and what they lost. */
  const at = (rs: ReadonlyArray<ReturnType<typeof run>>, minute: number, f: (r: Row) => number) =>
    mean(rs.map((r) => r.rows.filter((row) => row.minute <= minute).at(-1)).filter((row): row is Row => row !== undefined).map(f))
  const peak = (rs: ReadonlyArray<ReturnType<typeof run>>, f: (r: Row) => number) => mean(rs.map((r) => Math.max(0, ...r.rows.map(f))))
  console.log(`\n${first} against ${versus}, the same ${seeds} seeds:`)
  console.log(`  ${"".padEnd(34)}${first.padStart(12)}${versus.padStart(12)}`)
  const lineOf = (label: string, f: (rs: ReadonlyArray<ReturnType<typeof run>>) => number) =>
    console.log(`  ${label.padEnd(34)}${pad(Math.round(f(mine)), 12)}${pad(Math.round(f(theirs)), 12)}`)
  lineOf("most citizens", (rs) => peak(rs, (r) => r.citizens))
  lineOf("most burghers", (rs) => peak(rs, (r) => r.burghers))
  lineOf("most residents", (rs) => peak(rs, (r) => r.residents))
  lineOf("citizens at minute 30", (rs) => at(rs, 30, (r) => r.citizens))
  lineOf("homes and buildings lost by minute 30", (rs) => at(rs, 30, (r) => r.lost))
  lineOf("lost by the end", (rs) => mean(rs.map((r) => r.lost)))
  lineOf("score", (rs) => mean(rs.map((r) => r.score)))
}
