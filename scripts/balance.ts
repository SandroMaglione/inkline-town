/**
 * Balance runs: a bot plays the real simulation headless, the way a
 * sensible player would, on several seeds, and reports how the town does
 * minute by minute and where it got stuck.
 *
 *   node scripts/balance.ts                    5 seeds, 30 minutes each
 *   node scripts/balance.ts --seeds 10 --minutes 45
 *   node scripts/balance.ts --tax 125          settlers and citizens taxed at 125%
 *   node scripts/balance.ts --set kinds.fishery.recipe.seconds=3 --set home.tiers.1.tax=3
 *   node scripts/balance.ts --verbose          print every seed's minute-by-minute table
 *
 * `--set` changes content before the run (any number of them), so a sweep is
 * a shell loop over values. The bot only does what a player could: it reads
 * the world, then pushes the same edits the page does.
 */
import { amounts, goodIds, home, kinds, ROAD_COST, start, STEP_SECONDS, total, type Amounts, type Kind, type KindId } from "../src/content.ts"
import { around, canPlace, DIRS, entrances, GridBuilder, isRoad, key, useAt, type Use } from "../src/grid.ts"
import { GRID, inside, type Point } from "../src/iso.ts"
import { Game, Ui, type GridValue } from "../src/schema.ts"
import { simulate } from "../src/sim/index.ts"
import { emptyPreview, type Edit, type UiValue } from "../src/ui.ts"

// ── Options ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const option = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const seeds = option("seeds", 5)
const minutes = option("minutes", 30)
const tax = option("tax", 100)
const verbose = args.includes("--verbose")

/** `--set path=value`: change a number in the content before running. */
const roots: Record<string, unknown> = { kinds, home, start }
for (let i = 0; i < args.length; i++) {
  if (args[i] !== "--set") continue
  const [path, value] = args[i + 1]!.split("=")
  const parts = path!.split(".")
  let target = roots as Record<string, unknown>
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>
  target[parts.at(-1)!] = Number(value)
}

// ── Reading the world ─────────────────────────────────────────────────────

interface Snapshot {
  readonly entities: ReadonlyArray<{ readonly id: number; readonly components: Record<string, any> }>
  readonly resources: Record<string, any>
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
  readonly ledger: { readonly taxes: number; readonly trade: number; readonly upkeep: number }
}
interface Tile {
  readonly x: number
  readonly y: number
  readonly size: number
}

const read = (snapshot: Snapshot): World => {
  const builder = new GridBuilder()
  const buildings: Array<World["buildings"][number]> = []
  const homes: Array<World["homes"][number]> = []
  const stock: Record<string, number> = { ...amounts({}) }
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
    coins: snapshot.resources["Town/Treasury"].coins,
    census: snapshot.resources["Town/Census"],
    ledger: snapshot.resources["Town/Ledger"]
  }
}

// ── The bot ───────────────────────────────────────────────────────────────

const affordable = (w: World, cost: Kind["cost"]) =>
  w.coins >= cost.coins + 40 && Object.entries(cost.materials).every(([g, n]) => w.stock[g as keyof Amounts] >= (n ?? 0))
const residents = (w: World) => w.census.settlers! + w.census.citizens!
const unlocked = (w: World, kind: Kind) => residents(w) >= kind.unlock.residents && w.census.citizens! >= kind.unlock.citizens
const count = (w: World, kind: KindId) => w.buildings.filter((b) => b.kind === kind).length
const sites = (w: World) => w.buildings.filter((b) => b.site).length + 0

const sourceUse: Record<string, Use> = { tree: "tree", stone: "rock", ore: "rock", water: "water", field: "empty" }

/** How good a spot is for a kind: how much of what it works lies within reach (or 1 for anything else). */
const score = (w: World, kind: Kind, tile: Tile): number => {
  const g = kind.gathers ?? (kind.plants ? { source: kind.plants.what === "tree" ? "field" : "field", radius: kind.plants.radius } : null)
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
      if (!canPlace(w.grid, tile)) continue
      if (!entrances(tile).some((c) => isRoad(w.grid, c.x, c.y))) continue
      const s = score(w, kind, tile)
      if (s < needs) continue
      // A forester belongs beside a lumberjack, replanting what it fells.
      if (kind.id === "forester" && !w.buildings.some((b) => b.kind === "lumberjack" && Math.abs(b.tile.x - x) <= 4 && Math.abs(b.tile.y - y) <= 4)) continue
      const value = (kind.gathers || kind.plants ? s * 10 : 0) - Math.hypot(x - GRID / 2, y - GRID / 2)
      if (!best || value > best.value) best = { cell: { x, y }, value }
    }
  }
  return best?.cell ?? null
}

/** Free cells beside a road, nearest the middle first. */
const homeSpots = (w: World, n: number): Array<Point> => {
  const spots: Array<Point> = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (useAt(w.grid, x, y) !== "empty") continue
      if (DIRS.some((d) => isRoad(w.grid, x + d.x, y + d.y))) spots.push({ x, y })
    }
  }
  return spots.sort((a, b) => Math.hypot(a.x - GRID / 2, a.y - GRID / 2) - Math.hypot(b.x - GRID / 2, b.y - GRID / 2)).slice(0, n)
}

/**
 * A road towards what a kind needs (or, for anything else, into open land):
 * the shortest run of free cells from the road network to a cell near the
 * source, at most `limit` long.
 */
const roadToward = (w: World, kind: Kind | null, limit = 10): Array<Point> => {
  const free = (x: number, y: number) => inside(x, y) && (useAt(w.grid, x, y) === "empty" || useAt(w.grid, x, y) === "tree")
  const want = kind?.gathers ? sourceUse[kind.gathers.source] : null
  const goal = (x: number, y: number) =>
    want ? DIRS.some((d) => useAt(w.grid, x + 2 * d.x, y + 2 * d.y) === want || useAt(w.grid, x + 3 * d.x, y + 3 * d.y) === want) : around({ x, y, size: 1 }, 2).every((c) => free(c.x, c.y))
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
  const fed = homes > 0 ? w.census.food! / homes : 1
  return [
    { kind: "fishery", when: count(w, "fishery") < 1 },
    { kind: "lumberjack", when: count(w, "lumberjack") < 1 },
    { kind: "sawmill", when: count(w, "sawmill") < 1 },
    { kind: "quarry", when: count(w, "quarry") < 1 },
    { kind: "market", when: count(w, "market") < 1 && homes >= 6 },
    { kind: "forester", when: count(w, "forester") < count(w, "lumberjack") },
    { kind: "fishery", when: fed < 0.6 && count(w, "fishery") < 1 + Math.floor(homes / 10) },
    { kind: "chapel", when: count(w, "chapel") < 1 },
    { kind: "sheep", when: count(w, "sheep") < 1 },
    { kind: "weaver", when: count(w, "weaver") < 1 },
    { kind: "farm", when: count(w, "farm") < 1 },
    { kind: "mill", when: count(w, "mill") < 1 },
    { kind: "bakery", when: count(w, "bakery") < 1 },
    { kind: "market", when: fed < 0.6 && count(w, "market") < Math.floor(homes / 12) + 1 },
    { kind: "lumberjack", when: w.stock.planks < 10 && count(w, "lumberjack") < 3 },
    { kind: "quarry", when: w.stock.stone < 6 && count(w, "quarry") < 3 },
    { kind: "warehouse", when: count(w, "warehouse") < Math.floor(homes / 20) },
    { kind: "mine", when: count(w, "mine") < 1 },
    { kind: "smithy", when: count(w, "smithy") < 1 }
  ]
}

/** One decision: build what is wanted first, or homes when workers run short, or road towards what is needed. */
const decide = (w: World): ReadonlyArray<Edit> => {
  if (sites(w) > 2) return []
  // Homes when workers run short, or (they are the town's income) whenever food reaches most of them.
  const fed = w.homes.length > 0 ? w.census.food! / w.homes.length : 1
  const short = w.census.jobs! + 6 > residents(w) || (fed >= 0.7 && w.stock.planks >= 8)
  if (short && affordable(w, { coins: home.cost.coins * 3, materials: { planks: 3 } })) {
    const spots = homeSpots(w, 3)
    if (spots.length > 0) return [{ type: "homes", cells: spots }]
    const road = roadToward(w, null)
    if (road.length > 0 && w.coins > road.length * ROAD_COST + 60) return [{ type: "roads", cells: road }]
  }
  for (const want of plan(w)) {
    if (!want.when) continue
    const kind = kinds[want.kind]
    if (!unlocked(w, kind) || !affordable(w, kind.cost)) continue
    const spot = spotFor(w, kind)
    if (spot) return [{ type: "building", kind: want.kind, cell: spot, open: false }]
    const road = roadToward(w, kind)
    if (road.length > 0 && w.coins > road.length * ROAD_COST + kind.cost.coins) return [{ type: "roads", cells: road }]
  }
  return []
}

// ── Running ───────────────────────────────────────────────────────────────

interface Row {
  readonly minute: number
  readonly coins: number
  readonly net: number
  readonly taxes: number
  readonly trade: number
  readonly upkeep: number
  readonly settlers: number
  readonly citizens: number
  readonly homes: number
  readonly food: number
  readonly cloth: number
  readonly faith: number
  readonly jobs: string
  readonly buildings: number
  readonly problems: Record<string, number>
}

const run = (seed: number) => {
  const ui: UiValue = {
    tool: "select", placing: null, menu: null, pointer: null, dragFrom: null, selected: null, gestures: [],
    edits: [{ type: "newTown", seed }],
    preview: emptyPreview(), hits: [], panel: null, centres: new Map(), stats: null, toast: () => {}
  }
  const made = Game.Runtime.make({
    services: Game.Runtime.services(Game.Runtime.service(Ui, ui)),
    resources: {
      Time: { tick: 0 }, Rng: seed, Treasury: { coins: 0 }, Ledger: { taxes: 0, trade: 0, upkeep: 0 },
      Census: { homes: 0, settlers: 0, citizens: 0, jobs: 0, employed: 0, food: 0, bread: 0, cloth: 0, faith: 0 },
      Policy: { settlers: 100, citizens: 100, sells: [], reserve: 25 }, Grid: { owner: [], use: [] }, Stock: amounts({})
    }
  })
  if (!made.ok) throw new Error(JSON.stringify(made.error))
  const runtime = made.value
  const step = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) runtime.tick(simulate)
  }
  step(0.1)
  // The new town has its usual policy; set the taxes for this run.
  ui.edits.push({ type: "tax", tier: "settlers", rate: tax }, { type: "tax", tier: "citizens", rate: tax })
  step(0.1)

  const rows: Array<Row> = []
  const problems: Record<string, number> = {}
  let firstCitizen: number | null = null
  let minCoins = Infinity
  let debtMinutes = 0
  const DECIDE = 5
  for (let t = 0; t < minutes * 60; t += DECIDE) {
    const w = read(runtime.snapshot() as unknown as Snapshot)
    ui.edits.push(...decide(w))
    step(DECIDE)
    minCoins = Math.min(minCoins, w.coins)
    if ((t + DECIDE) % 60 === 0) {
      const now = read(runtime.snapshot() as unknown as Snapshot)
      const minute = (t + DECIDE) / 60
      const problemsNow: Record<string, number> = {}
      for (const b of now.buildings) {
        if (["unconnected", "unstaffed", "starved", "blocked"].includes(b.status) && !b.site) {
          const k = `${b.kind} ${b.status}`
          problemsNow[k] = (problemsNow[k] ?? 0) + 1
          problems[k] = (problems[k] ?? 0) + 1
        }
      }
      if (now.coins < 0) debtMinutes += 1
      if (firstCitizen === null && now.census.citizens! > 0) firstCitizen = minute
      const h = Math.max(1, now.homes.length)
      rows.push({
        minute,
        coins: now.coins,
        net: now.ledger.taxes + now.ledger.trade - now.ledger.upkeep,
        taxes: now.ledger.taxes,
        trade: now.ledger.trade,
        upkeep: now.ledger.upkeep,
        settlers: now.census.settlers!,
        citizens: now.census.citizens!,
        homes: now.homes.length,
        food: Math.round((now.census.food! / h) * 100),
        cloth: Math.round((now.census.cloth! / h) * 100),
        faith: Math.round((now.census.faith! / h) * 100),
        jobs: `${now.census.employed}/${now.census.jobs}`,
        buildings: now.buildings.length,
        problems: problemsNow
      })
    }
  }
  const end = read(runtime.snapshot() as unknown as Snapshot)
  const built: Record<string, number> = {}
  for (const b of end.buildings) built[b.kind] = (built[b.kind] ?? 0) + 1
  return { seed, rows, problems, firstCitizen, minCoins, debtMinutes, built, stock: end.stock }
}

const pad = (v: unknown, n: number) => String(v).padStart(n)
const results = []
const started = performance.now()
for (let i = 0; i < seeds; i++) {
  const r = run(1000 + i * 7919)
  results.push(r)
  if (verbose) {
    console.log(`\nseed ${r.seed}`)
    console.log(" min   coins   net  settlers citizens homes food% cloth% faith%  jobs   bldgs  problems")
    for (const row of r.rows) {
      const p = Object.entries(row.problems).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ""}`).join(", ")
      console.log(`${pad(row.minute, 4)} ${pad(row.coins, 7)} ${pad(row.net, 5)} ${pad(row.settlers, 9)} ${pad(row.citizens, 8)} ${pad(row.homes, 5)} ${pad(row.food, 5)} ${pad(row.cloth, 6)} ${pad(row.faith, 6)} ${pad(row.jobs, 7)} ${pad(row.buildings, 6)}  ${p}`)
    }
    console.log(`  built: ${Object.entries(r.built).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ""}`).join(", ")}`)
    console.log(`  stock: ${goodIds.filter((g) => r.stock[g] > 0).map((g) => `${g} ${r.stock[g]}`).join(", ")}`)
  }
}

// ── Summary ───────────────────────────────────────────────────────────────

const mean = (xs: ReadonlyArray<number>) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const last = results.map((r) => r.rows.at(-1)!)
console.log(`\n${seeds} seeds × ${minutes} min, tax ${tax}%  (${Math.round(performance.now() - started)} ms)`)
console.log(`  residents at the end   ${mean(last.map((r) => r.settlers + r.citizens)).toFixed(0)}  (citizens ${mean(last.map((r) => r.citizens)).toFixed(0)})`)
console.log(`  coins at the end       ${mean(last.map((r) => r.coins)).toFixed(0)}, net ${mean(last.map((r) => r.net)).toFixed(0)}/min (taxes ${mean(last.map((r) => r.taxes)).toFixed(0)}, trade ${mean(last.map((r) => r.trade)).toFixed(0)}, upkeep ${mean(last.map((r) => r.upkeep)).toFixed(0)})`)
console.log(`  lowest coins           ${Math.min(...results.map((r) => r.minCoins))}   minutes in debt ${mean(results.map((r) => r.debtMinutes)).toFixed(1)}`)
console.log(`  first citizens         ${results.map((r) => (r.firstCitizen === null ? "never" : `${r.firstCitizen} min`)).join(", ")}`)
console.log(`  homes supplied         food ${mean(last.map((r) => r.food)).toFixed(0)}%, cloth ${mean(last.map((r) => r.cloth)).toFixed(0)}%, faith ${mean(last.map((r) => r.faith)).toFixed(0)}%`)
const allProblems: Record<string, number> = {}
for (const r of results) for (const [k, n] of Object.entries(r.problems)) allProblems[k] = (allProblems[k] ?? 0) + n
const top = Object.entries(allProblems).sort((a, b) => b[1] - a[1]).slice(0, 6)
console.log(`  most common problems   ${top.map(([k, n]) => `${k} (${(n / seeds).toFixed(1)} min/seed)`).join(", ") || "none"}`)
void total
