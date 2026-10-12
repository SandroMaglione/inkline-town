/**
 * Balance runs: a bot plays the real simulation headless on several seeds,
 * the way a kind of mayor would, and reports how each term ended and how
 * the pressure on the town built up along the way.
 *
 *   node scripts/balance.ts                          5 seeds, a medium fair town, a 60-minute term
 *   node scripts/balance.ts --size large --term 90 --land harsh
 *   node scripts/balance.ts --bot greedy             sensible (default), greedy, or idle
 *   node scripts/balance.ts --seeds 10 --from 10     seeds 10 to 19 (to split a sweep across processes)
 *   node scripts/balance.ts --set crown.fine=2 --set kinds.fishery.recipe.seconds=3
 *   node scripts/balance.ts --verbose                every seed's table, every `--every` minutes (default 5)
 *
 * The mayors:
 * - sensible: builds out the chains as the town grows, keeps food in store,
 *   answers the crown, eases taxes when the town grumbles and buys the stone
 *   and tools its land runs out of;
 * - greedy: the same town, taxed at 200%, selling everything it can and
 *   ignoring the crown;
 * - idle: founds the basics, then leaves the town to itself.
 *
 * `--set` changes content before the run. The bot only does what a player
 * could: it reads the world, then pushes the same edits the page does.
 */
import { goodIds, home, kinds, landIds, ROAD_COST, sizeIds, type Amounts, type CharterValue, type GoodId, type Kind, type KindId } from "../src/content.ts"
import * as content from "../src/content.ts"
import { around, canPlace, DIRS, entrances, GridBuilder, isRoad, key, useAt, type Use } from "../src/grid.ts"
import { GRID, inside, type Point } from "../src/iso.ts"
import type { GridValue } from "../src/schema.ts"
import { headless, type Snapshot } from "../src/sim/headless.ts"
import { goalsOf, larder, seasonAt } from "../src/sim/index.ts"
import type { Edit } from "../src/ui.ts"

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
const bot = option("bot", "sensible") as "sensible" | "greedy" | "idle"
const every = Number(option("every", "5"))
const verbose = args.includes("--verbose")
if (!sizeIds.includes(size) || !landIds.includes(land) || !["sensible", "greedy", "idle"].includes(bot)) throw new Error("Unknown --size, --land, or --bot")

/** `--set path=value`: change a number in the content before running. */
for (let i = 0; i < args.length; i++) {
  if (args[i] !== "--set") continue
  const [path, value] = args[i + 1]!.split("=")
  const parts = path!.split(".")
  let target = content as unknown as Record<string, unknown>
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>
  target[parts.at(-1)!] = Number(value)
}

// ── Reading the world ─────────────────────────────────────────────────────

interface Tile {
  readonly x: number
  readonly y: number
  readonly size: number
}

interface World {
  readonly grid: GridValue
  /** Cells of ore rocks (other rocks are stone). */
  readonly ore: ReadonlySet<number>
  readonly buildings: ReadonlyArray<{ readonly kind: KindId; readonly tile: Tile; readonly status: string; readonly site: boolean }>
  readonly homes: ReadonlyArray<{ readonly tile: Tile; readonly tier: number; readonly residents: number }>
  readonly stock: Amounts
  readonly coins: number
  readonly census: Record<string, number>
  readonly ledger: { readonly taxes: number; readonly trade: number; readonly upkeep: number; readonly admin: number }
  readonly policy: { readonly settlers: number; readonly citizens: number; readonly sells: ReadonlyArray<GoodId>; readonly buys: ReadonlyArray<GoodId>; readonly reserve: number }
  readonly mood: { readonly approval: number; readonly target: number }
  readonly crown: { readonly open: boolean; readonly good: GoodId; readonly amount: number; readonly met: number; readonly missed: number }
  readonly fate: { readonly state: string; readonly reason: string; readonly at: number; readonly score: number }
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
  for (const e of snapshot.entities) {
    const c = e.components
    const tile = c["Town/Tile"] as Tile | undefined
    if (!tile) continue
    const use: Use = c["Town/Road"] ? "road" : c["Town/House"] ? "house" : c["Town/Tree"] ? "tree" : c["Town/Rock"] ? "rock" : c["Town/Water"] ? "water" : c["Town/Field"] ? "field" : "building"
    builder.claim(tile, e.id, use)
    if (c["Town/Rock"]?.ore) ore.add(key(tile.x, tile.y))
    if (c["Town/Building"]) buildings.push({ kind: c["Town/Building"].kind, tile, status: c["Town/Status"], site: !!c["Town/Site"] })
    if (c["Town/House"]) homes.push({ tile, tier: c["Town/House"].tier, residents: c["Town/House"].residents })
    if (c["Town/Storage"] && c["Town/Inventory"]) for (const g of goodIds) stock[g] = (stock[g] ?? 0) + c["Town/Inventory"].stock[g]
  }
  return {
    grid: builder.value(),
    ore,
    buildings,
    homes,
    stock: stock as Amounts,
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
      const value = (kind.gathers || kind.plants ? s * 10 : 0) - Math.hypot(x - middle, y - middle)
      if (!best || value > best.value) best = { cell: { x, y }, value }
    }
  }
  return best?.cell ?? null
}

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

/** Free cells beside a road and off the lanes, nearest the middle first. */
const homeSpots = (w: World, n: number): Array<Point> => {
  const spots: Array<Point> = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (useAt(w.grid, x, y) !== "empty" || lane(x, y)) continue
      if (DIRS.some((d) => isRoad(w.grid, x + d.x, y + d.y))) spots.push({ x, y })
    }
  }
  return spots.sort((a, b) => Math.hypot(a.x - middle, a.y - middle) - Math.hypot(b.x - middle, b.y - middle)).slice(0, n)
}

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

/** What the bot wants next, in order: the first it can do, it does. */
const plan = (w: World): ReadonlyArray<{ readonly kind: KindId; readonly when: boolean }> => {
  const homes = w.homes.length
  const basics: ReadonlyArray<{ readonly kind: KindId; readonly when: boolean }> = [
    { kind: "fishery", when: count(w, "fishery") < 1 },
    { kind: "lumberjack", when: count(w, "lumberjack") < 1 },
    { kind: "sawmill", when: count(w, "sawmill") < 1 },
    { kind: "forester", when: count(w, "forester") < count(w, "lumberjack") },
    { kind: "market", when: count(w, "market") < 1 && homes >= 6 },
    { kind: "quarry", when: count(w, "quarry") < 1 },
    // A lumberjack that has felled everything in reach is replaced by one in a forest.
    { kind: "lumberjack", when: w.stock.planks < 20 && w.buildings.filter((b) => b.kind === "lumberjack" && b.status !== "starved").length < 1 + Math.floor(homes / 40) }
  ]
  if (bot === "idle") return basics
  // The citizens' chains, in proportion to the homes: a bakery bakes for about
  // 16 homes and needs a mill, and a mill most of a farm; a weaver weaves for
  // about 14 homes from one sheep farm's wool. Upstream first, so what a
  // workshop needs is coming before it stands.
  const bakeries = homes < 20 ? 1 : 1 + Math.floor(homes / 12)
  const weavers = homes < 20 ? 1 : 1 + Math.floor(homes / 12)
  return [
    ...basics,
    { kind: "fishery", when: larder(w.stock) < homes && count(w, "fishery") < 1 + Math.floor(homes / 7) },
    // One of each first: tools are scarce until there are citizens to run a smithy.
    { kind: "chapel", when: count(w, "chapel") < 1 },
    { kind: "farm", when: count(w, "farm") < 1 },
    { kind: "mill", when: count(w, "mill") < 1 },
    { kind: "bakery", when: count(w, "bakery") < 1 },
    { kind: "sheep", when: count(w, "sheep") < 1 },
    { kind: "weaver", when: count(w, "weaver") < 1 },
    { kind: "smithy", when: count(w, "smithy") < 1 },
    { kind: "mine", when: count(w, "mine") < 1 },
    { kind: "chapel", when: count(w, "chapel") < 1 + Math.floor(homes / 35) },
    { kind: "farm", when: count(w, "farm") < Math.ceil(bakeries * 0.8) },
    { kind: "mill", when: count(w, "mill") < Math.min(bakeries, count(w, "farm") + 1) },
    { kind: "bakery", when: count(w, "bakery") < Math.min(bakeries, count(w, "mill")) },
    { kind: "sheep", when: count(w, "sheep") < weavers },
    { kind: "weaver", when: count(w, "weaver") < Math.min(weavers, count(w, "sheep")) },
    { kind: "warehouse", when: count(w, "warehouse") < Math.floor(homes / 25) },
    { kind: "market", when: count(w, "market") < 1 + Math.floor(homes / 16) },
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
  if (bot === "sensible") {
    // Taxes follow the town's mood; once every other goal is met, they come down to win it over.
    const goals = goalsOf(w.charter, {
      settlers: w.census.settlers!, citizens: w.census.citizens!, coins: w.coins, net: net(w), approval: w.mood.approval
    })
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
    const shortages: ReadonlyArray<readonly [GoodId, number, number]> = [["planks", 10, 30], ["stone", 6, 20], ["tools", 4, 8], ["fish", (fed < 0.5 && w.stock.fish < 10) || (closing && fed < 0.7 && w.stock.fish < 20) ? 1000 : -1, 30]]
    for (const [g, low, enough] of shortages) {
      if (g === crownBuy) continue
      const buying = w.policy.buys.includes(g)
      if (!buying && w.stock[g] < low && w.coins > 150) edits.push({ type: "trade", good: g, mode: "buy" })
      if (buying && (w.stock[g] >= enough || w.coins < 50)) edits.push({ type: "trade", good: g, mode: "none" })
    }
    if (w.crown.open && w.stock[w.crown.good] >= w.crown.amount) edits.push({ type: "deliver" })
    // Stop buying what was only bought for the crown.
    for (const g of w.policy.buys) if (g !== crownBuy && !shortages.some(([s]) => s === g)) edits.push({ type: "trade", good: g, mode: content.trade.sells.includes(g) ? "sell" : "none" })
    // In debt: stop what is idle anyway; back to work once there is money again.
    for (const b of w.buildings) {
      if (b.site || b.kind === "townhall") continue
      if (w.coins < 0 && net(w) < 0 && ["blocked", "starved"].includes(b.status)) edits.push({ type: "pause", cell: b.tile, on: true })
      if (b.status === "paused" && w.coins > 300) edits.push({ type: "pause", cell: b.tile, on: false })
    }
  }
  if (bot === "idle" && residents(w) > 30) return edits

  if (sites(w) > 3) return edits
  // Homes when workers run short, or (they are the town's income) when food reaches most of them and
  // there are coins to spare; not far past the goal, where upgrading homes pays better than more of them.
  const goal = content.sizes[w.charter.size].goal.residents
  const short = w.census.jobs! + 6 > residents(w) || (fed >= 0.6 && w.stock.planks >= 8 && w.coins > 300 && residents(w) < goal * 1.2)
  if (short && affordable(w, { coins: home.cost.coins * 4, materials: { planks: 4 } })) {
    const spots = homeSpots(w, 4)
    if (spots.length > 0) return [...edits, { type: "homes", cells: spots }]
    const road = roadToward(w, null)
    if (road.length > 0 && w.coins > road.length * ROAD_COST + 60) return [...edits, { type: "roads", cells: road }]
  }
  for (const want of plan(w)) {
    if (!want.when) continue
    const kind = kinds[want.kind]
    if (!unlocked(w, kind) || !affordable(w, kind.cost)) continue
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
  return edits
}
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
  readonly problems: Record<string, number>
}

const run = (seed: number) => {
  roading.clear()
  resting.clear()
  const town = headless({ size, term, land, seed }, { toast: (m) => { if (process.env.DEBUG) console.log("toast:", m) } })
  const ui = town.ui
  const step = town.run

  const rows: Array<Row> = []
  const problems: Record<string, number> = {}
  let w = read(town.snapshot())
  const DECIDE = 5
  for (let t = 0; t < term * 60 + DECIDE && w.fate.state === "playing"; t += DECIDE) {
    const chosen = decide(w)
    if (process.env.DEBUG) console.log(t, JSON.stringify(chosen).slice(0, 200))
    ui.edits.push(...chosen)
    step(DECIDE)
    w = read(town.snapshot())
    if ((t + DECIDE) % 60 !== 0) continue
    const minute = (t + DECIDE) / 60
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
    })
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
      winter: seasonAt(w.tick - w.charter.founded, w.charter).winter,
      crown: `${w.crown.open ? `${w.crown.amount} ${w.crown.good}` : "-"} ${w.crown.met}/${w.crown.missed}`,
      goals: goals.filter((g) => g.met).length,
      problems: problemsNow
    })
  }
  const lastGoals = goalsOf(w.charter, {
    settlers: w.census.settlers!, citizens: w.census.citizens!, coins: w.coins, net: net(w), approval: w.mood.approval
  }).map((g) => `${g.met ? "✓" : "✗"} ${g.text} (${g.value})`).join(" · ")
  const hh = Math.max(1, w.homes.length)
  const supplied = `food ${Math.round((w.census.food! / hh) * 100)}% bread ${Math.round((w.census.bread! / hh) * 100)}% cloth ${Math.round((w.census.cloth! / hh) * 100)}% faith ${Math.round((w.census.faith! / hh) * 100)}%`
  const end = w.fate.state === "playing" ? { state: "playing", reason: "", minute: term } : { state: w.fate.state, reason: w.fate.reason, minute: Math.round(w.fate.at / 360) / 10 }
  const built: Record<string, number> = {}
  for (const b of w.buildings) built[b.kind] = (built[b.kind] ?? 0) + 1
  return { seed, rows, problems, end, score: w.fate.score, built, stock: w.stock, crown: w.crown, lastGoals, supplied }
}

const pad = (v: unknown, n: number) => String(v).padStart(n)
const results: Array<ReturnType<typeof run>> = []
const started = performance.now()
const header = "  min   coins   net  income costs admin  appr  resid  citiz homes food% larder season   crown(met/missed) goals  problems"
const line = (r: Row) => {
  const p = Object.entries(r.problems).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ""}`).join(", ")
  return `${pad(r.minute, 5)} ${pad(r.coins, 7)} ${pad(r.net, 5)} ${pad(r.income, 7)} ${pad(r.costs, 5)} ${pad(r.admin, 5)} ${pad(r.approval, 5)} ${pad(r.residents, 6)} ${pad(r.citizens, 6)} ${pad(r.homes, 5)} ${pad(r.food, 5)} ${pad(r.larder, 6)} ${pad(r.winter ? "winter" : "", 6)}  ${pad(r.crown, 18)} ${pad(r.goals, 5)}  ${p}`
}
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

const mean = (xs: ReadonlyArray<number>) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
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
