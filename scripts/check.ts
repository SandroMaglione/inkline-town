/**
 * Checks that every way a term can end does end it: the real simulation,
 * headless, put into each situation through the same snapshots the page
 * saves and loads.
 *
 *   node scripts/check.ts
 *
 * - ranks: a town meeting every goal of the next rank, held two minutes,
 *   rises to it (a village, then a town) and plays on; its term then runs
 *   out, and the next term carries on the same town;
 * - bankrupt: three minutes in debt;
 * - revolt: approval at -50 or below for two minutes;
 * - abandoned: residents fall below 15% of their peak;
 * - over: a term run out;
 * - the crown: a request left unanswered is a fine and a snub, and three in
 *   a row and the mayor is dismissed;
 * - and a town saved mid-term loads back the same.
 *
 * And the neighbourhood and its dangers:
 * - a citizens' home next to a smithy goes back to settlers;
 * - an unwatched home catches fire, and the fire spreads;
 * - fish rots without a granary, and keeps in one;
 * - a workplace with no homes within reach stays unstaffed;
 * - a home nobody mends falls down, and a builder keeps it standing;
 * - citizens will not take settlers' work, and settlers stand in for citizens as apprentices;
 * - and homes with every need met become citizens on a street with a park behind it, not packed beside industry.
 */
import { amounts, CONDITION_MAX, goodIds, kinds, RISK_MAX, ticks, type CharterValue, type GroundId, type KindId, type PropId } from "../src/content.ts"
import { canPlace, DIRS, entrances, GridBuilder, isRoad, key, type Use } from "../src/grid.ts"
import { inside } from "../src/iso.ts"
import { parkValue, ringOf, type ParkCell } from "../src/appeal.ts"
import { headless, type Snapshot } from "../src/sim/headless.ts"

const town = (charter: CharterValue = { size: "small", term: 45, land: "fair", seed: 7 }) => {
  const t = headless(charter)
  // A new town has only the ring road round its hall; these checks were laid out along a stub road out of each side.
  t.change((s) => {
    const hall = s.entities.find((e) => e.components["Town/TownHall"])!.components["Town/Tile"]
    for (let i = 2; i <= 3; i++)
      for (const cell of [{ x: hall.x + 2 + i, y: hall.y + 1 }, { x: hall.x + 1, y: hall.y + 2 + i }, { x: hall.x - i, y: hall.y + 1 }, { x: hall.x + 1, y: hall.y - i }])
        s.entities.push({ id: s.nextEntity++, components: { "Town/Tile": { ...cell, size: 1 }, "Town/Road": {} } })
  })
  const fate = () => t.snapshot().resources["Town/Fate"] as { state: string; reason: string; at: number; term: number; began: number; rank: number }
  return { ...t, fate }
}

/** A building on a snapshot, standing and idle. */
const building = (s: Snapshot, kind: string, x: number, y: number, size: number, extra: Record<string, unknown> = {}) => {
  const id = s.nextEntity++
  s.entities.push({
    id,
    components: {
      "Town/Tile": { x, y, size },
      "Town/Building": { kind },
      "Town/Status": "idle",
      "Town/Staff": { needed: 0, assigned: 0, apprentices: 0, nearby: 0 },
      ...extra
    }
  })
  return id
}

/** A cell of park on a snapshot: its ground, and what stands on it. */
const parkCell = (s: Snapshot, x: number, y: number, ground: GroundId, prop: PropId | "none" = "none") => {
  s.entities.push({ id: s.nextEntity++, components: { "Town/Tile": { x, y, size: 1 }, "Town/Park": { ground, prop } } })
}

/**
 * Citizens' homes, every need met for good, on free cells beside the roads;
 * every fifth spot a small park instead (a statue, a fountain, and a lamp on
 * flower beds and lawn), so the street is fine enough for them.
 */
const settle = (s: Snapshot, homes: number) => {
  const grid = new GridBuilder(s.resources["Town/Land"].mask)
  for (const e of s.entities) {
    const tile = e.components["Town/Tile"]
    if (tile) grid.claim(tile, e.id, e.components["Town/Road"] ? "road" : e.components["Town/Park"] ? "park" : "building")
  }
  const g = grid.value()
  let placed = 0
  let parks = 0
  for (let k = 0; k < g.use.length && placed < homes; k++) {
    if (g.use[k] !== "empty") continue
    const x = k % 64
    const y = Math.floor(k / 64)
    if (!DIRS.some((d) => inside(x + d.x, y + d.y) && g.use[key(x + d.x, y + d.y)] === "road")) continue
    const forever = 10_000_000
    // Any square of four free cells this one is in.
    const corner = (placed + parks) % 5 === 4 ? [{ x, y }, { x: x - 1, y }, { x, y: y - 1 }, { x: x - 1, y: y - 1 }].find((c) => canPlace(g, { ...c, size: 2 })) : undefined
    if (corner) {
      parkCell(s, corner.x, corner.y, "square", "statue")
      parkCell(s, corner.x + 1, corner.y, "flowers", "fountain")
      parkCell(s, corner.x, corner.y + 1, "flowers", "lamp")
      parkCell(s, corner.x + 1, corner.y + 1, "lawn")
      grid.claim({ ...corner, size: 2 }, -1, "park")
      parks += 1
      continue
    }
    grid.claim({ x, y, size: 1 }, -1, "house")
    s.entities.push({
      id: s.nextEntity++,
      components: {
        "Town/Tile": { x, y, size: 1 },
        "Town/House": { tier: 2, residents: 8, food: forever, bread: forever, cloth: forever, faith: forever, clock: 1 }
      }
    })
    placed += 1
  }
  return placed
}

/** An entity's components on a snapshot being changed. */
const entityIn = (s: Snapshot, id: number) => s.entities.find((e) => e.id === id)!.components

let failures = 0
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`)
  if (!ok) failures += 1
}

// Ranks: 25 citizens' homes is 200 residents, all citizens; plenty of coins.
{
  const t = town()
  let placed = 0
  t.change((s) => {
    placed = settle(s, 25)
    s.resources["Town/Treasury"].coins = 10_000
  })
  t.run(8 * 60)
  const f = t.fate()
  check("a village, then a town", f.state === "playing" && f.rank === 2, `${placed} homes · ${f.state}, rank ${f.rank}`)
  t.run(38 * 60)
  const end = t.fate()
  check("the term runs out", end.state === "over" && end.rank === 2, `${end.state}, rank ${end.rank}: ${end.reason}`)
  t.edit({ type: "nextTerm" })
  t.run(1)
  const next = t.fate()
  check("the next term", next.state === "playing" && next.term === 2 && next.rank === 2 && next.began === 45 * 3600, `${next.state}, term ${next.term} from ${next.began}`)
}

// Bankrupt: deep in debt with nothing coming in.
{
  const t = town()
  t.change((s) => {
    s.resources["Town/Treasury"].coins = -5000
  })
  t.run(3.5 * 60)
  const f = t.fate()
  check("bankrupt", f.state === "lost" && f.reason.startsWith("Bankrupt"), `${f.state} at ${(f.at / 3600).toFixed(1)} min: ${f.reason}`)
}

// Revolt: an angry town, taxed to the hilt and unpaid.
{
  const t = town()
  t.change((s) => {
    s.resources["Town/Treasury"].coins = -10
    s.resources["Town/Mood"].approval = -100
    s.resources["Town/Policy"].settlers = 200
    s.resources["Town/Policy"].citizens = 200
  })
  t.run(2.5 * 60)
  const f = t.fate()
  check("revolt", f.state === "lost" && f.reason.startsWith("Revolt"), `${f.state} at ${(f.at / 3600).toFixed(1)} min: ${f.reason}`)
}

// Abandoned: a town that once had a hundred people and now has none.
{
  const t = town()
  t.change((s) => {
    s.resources["Town/Fate"].peak = 100
  })
  t.run(2)
  const f = t.fate()
  check("abandoned", f.state === "lost" && f.reason.startsWith("Abandoned"), `${f.state}: ${f.reason}`)
}

// Over: a term left to run out (a short one, to be quick about it).
{
  const t = town({ size: "small", term: 45, land: "rich", seed: 3 })
  t.change((s) => {
    s.resources["Town/Treasury"].coins = 100_000
  })
  t.run(45 * 60 + 2)
  const f = t.fate()
  check("over", f.state === "over", `${f.state} at ${(f.at / 3600).toFixed(1)} min: ${f.reason}`)
}

// The crown: a lumberjack makes wood, the crown asks for some, and nobody sends it.
{
  const t = town()
  const s = t.snapshot()
  const hall = s.entities.find((e) => e.components["Town/TownHall"])!.components["Town/Tile"]
  // Against the stub road out of the town hall's east side, its door on the road.
  t.edit({ type: "building", kind: "lumberjack", cell: { x: hall.x + 4, y: hall.y + 2 }, open: false })
  t.run(12 * 60)
  const c = t.snapshot().resources["Town/Crown"]
  const lines = t.snapshot().resources["Town/Chronicle"].lines as Array<{ text: string }>
  check("crown", c.missed >= 1 && lines.some((l) => l.text.includes("unanswered")), `met ${c.met}, missed ${c.missed}, snubs ${c.snubs.length}`)
  t.run(6 * 60)
  const f = t.fate()
  check("dismissed", f.state === "lost" && f.reason.startsWith("Dismissed"), `${f.state} at ${(f.at / 3600).toFixed(1)} min: ${f.reason}`)
}

// Save and load: a town mid-term loads back to the same state, and runs on the same.
{
  const a = town({ size: "medium", term: 60, land: "harsh", seed: 11 })
  a.run(30)
  const saved = JSON.stringify(a.snapshot())
  a.run(30)
  const b = town({ size: "medium", term: 60, land: "harsh", seed: 11 })
  b.restore(JSON.parse(saved))
  b.run(30)
  const same = JSON.stringify(a.snapshot().resources["Town/Treasury"]) === JSON.stringify(b.snapshot().resources["Town/Treasury"]) &&
    a.snapshot().entities.length === b.snapshot().entities.length
  check("save and load", same, `${a.snapshot().entities.length} entities, ${a.snapshot().resources["Town/Treasury"].coins} coins either way`)
}

// ── The neighbourhood and its dangers ─────────────────────────────────────

/** What stands where on a snapshot. */
const gridOf = (s: Snapshot) => {
  const builder = new GridBuilder(s.resources["Town/Land"].mask)
  for (const e of s.entities) {
    const c = e.components
    const tile = c["Town/Tile"]
    if (!tile) continue
    const use: Use = c["Town/Road"] ? "road" : c["Town/Park"] ? "park" : c["Town/House"] ? "house" : c["Town/Tree"] ? "tree" : c["Town/Rock"] ? "rock" : c["Town/Water"] ? "water" : c["Town/Field"] ? "field" : c["Town/Ruin"] ? "ruin" : "building"
    builder.claim(tile, e.id, use)
  }
  return builder
}
/** The first spot (nearest the town hall) for a tile `size` a side where `ok` holds, claimed so the next search skips it. */
const find = (g: GridBuilder, size: number, ok: (x: number, y: number) => boolean, use: Use = "building") => {
  const spots: Array<{ x: number; y: number }> = []
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (canPlace(g.value(), { x, y, size }) && ok(x, y)) spots.push({ x, y })
  spots.sort((a, b) => Math.hypot(a.x - 31, a.y - 31) - Math.hypot(b.x - 31, b.y - 31))
  const spot = spots[0]
  if (!spot) throw new Error("no room for the check")
  g.claim({ ...spot, size }, -1, use)
  return spot
}
const besideRoad = (g: GridBuilder) => (x: number, y: number) => DIRS.some((d) => isRoad(g.value(), x + d.x, y + d.y))
const doorOnRoad = (g: GridBuilder, size: number) => (x: number, y: number) => entrances({ x, y, size }).some((c) => isRoad(g.value(), c.x, c.y))

/** A home on a snapshot: its tier, residents, needs (met for good, or not), and risks. */
const homeAt = (s: Snapshot, x: number, y: number, tier: 1 | 2 | 3, residents: number, needs = true, r: Partial<Record<"fire" | "health" | "order", number>> = {}) => {
  const forever = 10_000_000
  const id = s.nextEntity++
  s.entities.push({
    id,
    components: {
      "Town/Tile": { x, y, size: 1 },
      "Town/House": { tier, residents, food: needs ? forever : 0, bread: needs ? forever : 0, cloth: needs ? forever : 0, faith: needs ? forever : 0, clock: 1 },
      "Town/Risk": { fire: r.fire ?? 0, health: r.health ?? 0, order: r.order ?? 0, thefts: 0 },
      "Town/Condition": { value: CONDITION_MAX }
    }
  })
  return id
}

/** A building on a snapshot, standing, with every role its kind has (as `rolesOf` gives it). */
const standing = (s: Snapshot, kind: KindId, x: number, y: number, stock: Partial<Record<string, number>> = {}) => {
  const k = kinds[kind]
  const c: Record<string, unknown> = {
    "Town/Tile": { x, y, size: k.size },
    "Town/Building": { kind },
    "Town/Status": "idle",
    "Town/Staff": { needed: k.workers, assigned: 0, apprentices: 0, nearby: 0 }
  }
  if (k.recipe) {
    const r = k.recipe
    c["Town/Recipe"] = { input: r.input, inputs: r.inputs, output: r.output, batch: r.batch, period: ticks(r.seconds), progress: 0, made: 0 }
  }
  if (k.gathers) c["Town/Gatherer"] = { ...k.gathers }
  const tools = k.wear ? ["tools"] : []
  if (k.holds) {
    const all = k.holds.accepts === "all"
    c["Town/Inventory"] = { stock: amounts(stock), accepts: all ? goodIds : [...k.holds.accepts, ...tools], cap: k.holds.cap }
    if (all || k.keeps) c["Town/Storage"] = {}
  } else if (k.recipe) c["Town/Inventory"] = { stock: amounts(stock), accepts: [k.recipe.output, ...tools], cap: 8 }
  if (k.carriers) c["Town/Carriers"] = { count: k.carriers }
  if (k.service) c["Town/Service"] = { service: k.service.service, interval: ticks(k.service.seconds), cooldown: 0, range: k.service.range }
  c["Town/Risk"] = { fire: 0, health: 0, order: 0, thefts: 0 }
  c["Town/Condition"] = { value: CONDITION_MAX }
  const id = s.nextEntity++
  s.entities.push({ id, components: c })
  return id
}
const signedText = (n: number) => (n > 0 ? `+${n}` : `${n}`)
const entity = (t: ReturnType<typeof town>, id: number) => t.snapshot().entities.find((e) => e.id === id)

// A citizens' home on a fine street stays citizens; a smithy beside it sends it back to settlers.
{
  const t = town()
  let home = 0
  let spot = { x: 0, y: 0 }
  t.change((s) => {
    const g = gridOf(s)
    // Room for a smithy right beside it.
    spot = find(g, 1, (x, y) => besideRoad(g)(x, y) && [[1, 0], [-2, 0], [0, 1], [0, -2]].some(([dx, dy]) => canPlace(g.value(), { x: x + dx!, y: y + dy!, size: 2 })), "house")
    home = homeAt(s, spot.x, spot.y, 2, 8)
    // A small park two cells off (a statue and a fountain on it) makes the street fine enough for citizens.
    const park = find(g, 2, (x, y) => ringOf({ x, y, size: 2 }, spot.x, spot.y) === 2, "park")
    parkCell(s, park.x, park.y, "square", "statue")
    parkCell(s, park.x + 1, park.y, "flowers", "fountain")
    parkCell(s, park.x, park.y + 1, "lawn", "lamp")
    parkCell(s, park.x + 1, park.y + 1, "lawn")
  })
  t.run(10)
  const before = entity(t, home)?.components["Town/House"]?.tier
  t.change((s) => {
    const g = gridOf(s)
    const near = find(g, 2, (x, y) => ringOf({ x, y, size: 2 }, spot.x, spot.y) === 1)
    standing(s, "smithy", near.x, near.y)
  })
  t.run(10)
  const after = entity(t, home)?.components["Town/House"]?.tier
  check("a smithy next door", before === 2 && after === 1, `citizens' home before the smithy (tier ${before}), tier ${after} after`)
}

// An unwatched row of cottages: one catches fire, and it spreads.
{
  const t = town()
  const homes: Array<number> = []
  t.change((s) => {
    const g = gridOf(s)
    const row = find(g, 1, (x, y) => [0, 1, 2, 3, 4].every((i) => canPlace(g.value(), { x: x + i, y, size: 1 })), "house")
    for (let i = 0; i < 5; i++) {
      g.claim({ x: row.x + i, y: row.y, size: 1 }, -1, "house")
      homes.push(homeAt(s, row.x + i, row.y, 1, 4, true, { fire: i === 2 ? RISK_MAX - 20 : 8500 }))
    }
  })
  let most = 0
  for (let i = 0; i < 40; i++) {
    t.run(1)
    most = Math.max(most, t.snapshot().resources["Town/Census"].burning)
  }
  const ruins = t.snapshot().entities.filter((e) => e.components["Town/Ruin"]?.cause === "burnt").length
  const news = (t.snapshot().resources["Town/Chronicle"].lines as Array<{ text: string }>).filter((l) => l.text.startsWith("Fire on")).map((l) => l.text)
  check("fire spreads", most >= 2 && ruins >= 2, `${most} burning at once, ${ruins} burnt down · ${news.at(-1) ?? "no news"}`)
}

// A fire watch nearby: firefighters reach the blaze, and it goes no further.
{
  const t = town()
  const homes: Array<number> = []
  t.change((s) => {
    const g = gridOf(s)
    // A street along the top of the town hall's ring, off its northern stub.
    const hall = s.entities.find((e) => e.components["Town/TownHall"])!.components["Town/Tile"]
    for (let x = hall.x - 3; x <= hall.x + 5; x++) {
      const y = hall.y - 4
      if (!canPlace(g.value(), { x, y, size: 1 })) continue
      s.entities.push({ id: s.nextEntity++, components: { "Town/Tile": { x, y, size: 1 }, "Town/Road": {} } })
      g.claim({ x, y, size: 1 }, -1, "road")
    }
    const row = find(g, 1, (x, y) => [0, 1, 2].every((i) => canPlace(g.value(), { x: x + i, y, size: 1 }) && besideRoad(g)(x + i, y)), "house")
    for (let i = 0; i < 3; i++) {
      g.claim({ x: row.x + i, y: row.y, size: 1 }, -1, "house")
      homes.push(homeAt(s, row.x + i, row.y, 1, 4, true, { fire: i === 1 ? RISK_MAX - 20 : 6000 }))
    }
    const watch = find(g, 2, doorOnRoad(g, 2))
    standing(s, "firewatch", watch.x, watch.y)
    // Workers for the watch.
    const cottage = find(g, 1, besideRoad(g), "house")
    homeAt(s, cottage.x, cottage.y, 1, 4)
  })
  t.run(40)
  const ruins = t.snapshot().entities.filter((e) => e.components["Town/Ruin"]?.cause === "burnt").length
  const standingHomes = homes.filter((id) => entity(t, id)).length
  const news = (t.snapshot().resources["Town/Chronicle"].lines as Array<{ text: string }>).filter((l) => l.text.startsWith("Fire on")).map((l) => l.text)
  check("firefighters", ruins === 1 && standingHomes === 2, `${ruins} burnt down, ${standingHomes} of 3 still standing · ${news.at(-1) ?? "no news"}`)
}

// Food rots in the town hall; it keeps in a granary.
{
  const t = town()
  let granary = 0
  t.change((s) => {
    const hall = s.entities.find((e) => e.components["Town/TownHall"])!
    hall.components["Town/Inventory"].stock.fish = 100
    // The town hall's walker would hand fish out: keep it home.
    hall.components["Town/Service"].cooldown = 1_000_000
    const g = gridOf(s)
    // Off the roads, so no carrier moves the fish between them.
    const spot = find(g, 2, (x, y) => !doorOnRoad(g, 2)(x, y) && !entrances({ x, y, size: 2 }).some((c) => DIRS.some((d) => isRoad(g.value(), c.x + d.x, c.y + d.y))))
    granary = standing(s, "granary", spot.x, spot.y, { fish: 60 })
  })
  t.run(3 * 60)
  const s = t.snapshot()
  const hallFish = s.entities.find((e) => e.components["Town/TownHall"])!.components["Town/Inventory"].stock.fish
  const kept = s.entities.find((e) => e.id === granary)!.components["Town/Inventory"].stock.fish
  check("food rots", hallFish <= 45 && kept >= 45, `town hall: 100 fish → ${hallFish} in three minutes; granary: 60 → ${kept}`)
}

// A workplace no home can reach stays unstaffed; a home within reach staffs it.
{
  const t = town()
  let lumberjack = 0
  t.change((s) => {
    const g = gridOf(s)
    const spot = find(g, 2, doorOnRoad(g, 2))
    lumberjack = standing(s, "lumberjack", spot.x, spot.y)
    // Cottages on a road of their own, joined to nothing.
    const island = find(g, 1, (x, y) => {
      if ([-2, -1, 0, 1, 2].some((dy) => [-2, -1, 0, 1, 2, 3].some((dx) => g.value().use[key(x + dx, y + dy)] !== "empty"))) return false
      return true
    }, "road")
    s.entities.push({ id: s.nextEntity++, components: { "Town/Tile": { x: island.x, y: island.y, size: 1 }, "Town/Road": {} } })
    homeAt(s, island.x + 1, island.y, 1, 4)
    homeAt(s, island.x - 1, island.y, 1, 4)
  })
  t.run(5)
  const alone = entity(t, lumberjack)!.components
  t.change((s) => {
    const g = gridOf(s)
    const near = find(g, 1, besideRoad(g), "house")
    homeAt(s, near.x, near.y, 1, 4)
  })
  t.run(5)
  const joined = entity(t, lumberjack)!.components
  check(
    "commuting",
    alone["Town/Status"] === "unstaffed" && alone["Town/Staff"].nearby === 0 && joined["Town/Staff"].assigned === 2,
    `alone: ${alone["Town/Status"]}, ${alone["Town/Staff"].nearby} settlers within reach; with a cottage on its road: ${joined["Town/Staff"].assigned} of 2 workers`
  )
}

// Citizens will not take settlers' work; settlers stand in for citizens as apprentices.
{
  const t = town()
  let quarry = 0
  let sawmill = 0
  t.change((s) => {
    const g = gridOf(s)
    const a = find(g, 2, doorOnRoad(g, 2))
    quarry = standing(s, "quarry", a.x, a.y)
    const b = find(g, 2, doorOnRoad(g, 2))
    sawmill = standing(s, "sawmill", b.x, b.y)
    for (let i = 0; i < 3; i++) {
      const c = find(g, 1, besideRoad(g), "house")
      homeAt(s, c.x, c.y, 2, 8)
      const p = find(g, 1, () => true, "park")
      parkCell(s, p.x, p.y, "flowers", "statue")
    }
  })
  t.run(3)
  const q1 = entity(t, quarry)!.components["Town/Staff"]
  const w1 = entity(t, sawmill)!.components["Town/Staff"]
  t.change((s) => {
    // Every citizen moves out; a settlers' cottage moves in.
    for (const e of s.entities) if (e.components["Town/House"]?.tier === 2) e.components["Town/House"].residents = 0
    const g = gridOf(s)
    const c = find(g, 1, besideRoad(g), "house")
    homeAt(s, c.x, c.y, 1, 4, false)
  })
  t.run(1)
  const q2 = entity(t, quarry)!.components["Town/Staff"]
  const w2 = entity(t, sawmill)!.components["Town/Staff"]
  check(
    "crews",
    q1.assigned === 3 && q1.apprentices === 0 && w1.assigned === 2 && w1.apprentices === 0 && w2.apprentices > 0 && q2.assigned > 0,
    `citizens only: quarry ${q1.assigned}/3, sawmill ${w1.assigned}/2; settlers only: quarry ${q2.assigned}/3, sawmill ${w2.assigned}/2 (${w2.apprentices} apprentices)`
  )
}

// A home nobody mends falls down; a builder next door keeps one standing.
{
  const t = town()
  let neglected = 0
  let mended = 0
  t.change((s) => {
    const g = gridOf(s)
    // Off the roads altogether, so no builder ever passes it.
    const a = find(g, 1, (x, y) => !besideRoad(g)(x, y), "house")
    neglected = homeAt(s, a.x, a.y, 1, 4)
    entityIn(s, neglected)["Town/Condition"].value = 3
    // Right by the builder's door, so the builder's first step passes it.
    const doorWithRoom = (x: number, y: number) =>
      entrances({ x, y, size: 2 }).some((c) => isRoad(g.value(), c.x, c.y) && DIRS.some((d) => canPlace(g.value(), { x: c.x + d.x, y: c.y + d.y, size: 1 }) && ringOf({ x, y, size: 2 }, c.x + d.x, c.y + d.y) > 0))
    const yard = find(g, 2, doorWithRoom)
    standing(s, "builder", yard.x, yard.y, { planks: 10, stone: 4 })
    const door = entrances({ ...yard, size: 2 }).find((c) => isRoad(g.value(), c.x, c.y) && DIRS.some((d) => canPlace(g.value(), { x: c.x + d.x, y: c.y + d.y, size: 1 })))!
    const by = DIRS.map((d) => ({ x: door.x + d.x, y: door.y + d.y })).find((c) => canPlace(g.value(), { ...c, size: 1 }))!
    g.claim({ ...by, size: 1 }, -1, "house")
    mended = homeAt(s, by.x, by.y, 1, 4)
    entityIn(s, mended)["Town/Condition"].value = 500
  })
  t.run(30)
  const fell = !entity(t, neglected) && t.snapshot().entities.some((e) => e.components["Town/Ruin"]?.cause === "collapsed")
  const kept = entity(t, mended)?.components["Town/Condition"]?.value ?? 0
  check("wear and mending", fell && kept > 900, `the neglected home ${fell ? "fell down" : "still stands"}; the one by the builder's yard is at ${Math.round(kept / 10)}%`)
}

// Zoned against crowded: the same homes, every need met, on a street with a park behind it away from industry,
// and packed in beside a smithy and a quarry. Only the first become citizens.
{
  const t = town()
  const zoned: Array<number> = []
  const crowded: Array<number> = []
  t.change((s) => {
    const g = gridOf(s)
    const hall = s.entities.find((e) => e.components["Town/TownHall"])!.components["Town/Tile"]
    const empty = (x: number, y: number, size = 1) => {
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) if (g.value().use[key(x + dx, y + dy)] !== "empty") return false
      return true
    }
    const lay = (x: number, y: number, use: Use) => g.claim({ x, y, size: 1 }, -1, use)
    // Two streets off the town hall's ring: one to the north, one to the south.
    for (const [y, homesAt, besideAt] of [[hall.y - 4, hall.y - 5, hall.y - 6], [hall.y + 6, hall.y + 7, hall.y + 8]] as const) {
      for (let x = hall.x - 3; x <= hall.x + 5; x++) {
        if (!empty(x, y)) continue
        s.entities.push({ id: s.nextEntity++, components: { "Town/Tile": { x, y, size: 1 }, "Town/Road": {} } })
        lay(x, y, "road")
      }
      for (let x = hall.x - 2; x <= hall.x + 4; x++) {
        if (!empty(x, homesAt)) continue
        lay(x, homesAt, "house")
        const id = homeAt(s, x, homesAt, 1, 4)
        ;(y < hall.y ? zoned : crowded).push(id)
      }
      if (y < hall.y) {
        // A strip of park behind the zoned homes: lawn, a fountain, and lamps.
        const furnished: Record<number, PropId> = { [hall.x - 1]: "lamp", [hall.x + 1]: "fountain", [hall.x + 3]: "lamp" }
        for (let x = hall.x - 2; x <= hall.x + 4; x++) if (empty(x, besideAt)) {
          parkCell(s, x, besideAt, "lawn", furnished[x] ?? "none")
          lay(x, besideAt, "park")
        }
      } else {
        // A smithy and a quarry right behind the crowded ones.
        for (const [kind, x] of [["smithy", hall.x - 1], ["quarry", hall.x + 2]] as const) if (empty(x, besideAt, 2)) {
          standing(s, kind, x, besideAt)
          g.claim({ x, y: besideAt, size: 2 }, -1, "building")
        }
      }
    }
  })
  t.run(20)
  const tiers = (ids: Array<number>) => ids.map((id) => entity(t, id)?.components["Town/House"]?.tier ?? 0)
  const citizens = (ids: Array<number>) => ids.reduce((n, id) => {
    const h = entity(t, id)?.components["Town/House"]
    return n + (h && h.tier >= 2 ? h.residents : 0)
  }, 0)
  check(
    "zoned against crowded",
    zoned.length >= 4 && crowded.length >= 4 && citizens(zoned) > 0 && citizens(crowded) === 0,
    `zoned street: ${citizens(zoned)} citizens (tiers ${tiers(zoned).join("")}); crowded street: ${citizens(crowded)} citizens (tiers ${tiers(crowded).join("")})`
  )
}

// A park with walks out to the street is worth more than the same park shut in behind homes.
{
  const cells: Array<ParkCell> = []
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) cells.push({ x, y, ground: x === 1 ? "path" : "lawn", prop: x === 1 && y === 1 ? "fountain" : "none" })
  const shut = parkValue(cells)
  // A road runs past both ends of the walk.
  const open = parkValue(cells, (x, y) => x === 1 && (y === -1 || y === 3))
  check("park entrances", open.entrances === 2 && open.value === shut.value + 3, `shut in: ${shut.value}; two walks out to the road: ${open.value}`)
}

// Pulling down a sawmill: a tenth of its coins, and half its planks and stone back in storage.
{
  const t = town()
  let mill = { x: 0, y: 0 }
  t.change((s) => {
    const g = gridOf(s)
    mill = find(g, 2, doorOnRoad(g, 2))
    standing(s, "sawmill", mill.x, mill.y)
  })
  const held = () => t.snapshot().entities.find((e) => e.components["Town/TownHall"])!.components["Town/Inventory"].stock
  const coins = () => t.snapshot().resources["Town/Treasury"].coins
  t.run(1)
  const before = { coins: coins(), ...held() }
  t.edit({ type: "remove", cell: mill })
  t.run(0.05)
  const after = { coins: coins(), ...held() }
  const gone = !t.snapshot().entities.some((e) => e.components["Town/Building"]?.kind === "sawmill")
  check("salvage", gone && before.coins - after.coins === 10 && after.planks - before.planks === 1 && after.stone - before.stone === 1,
    `${before.coins - after.coins} coins, +${after.planks - before.planks} planks, +${after.stone - before.stone} stone`)
}

// A closed home stands empty and costs the town hall nothing; reopened, settlers come back.
{
  const t = town()
  let home = 0
  let spot = { x: 0, y: 0 }
  t.change((s) => {
    const g = gridOf(s)
    spot = find(g, 1, besideRoad(g), "house")
    home = homeAt(s, spot.x, spot.y, 1, 4)
  })
  t.run(2)
  const homes = () => t.snapshot().resources["Town/Census"].homes
  const open = homes()
  t.edit({ type: "pause", cell: spot, on: true })
  t.run(2)
  const emptied = entity(t, home)?.components["Town/House"]?.residents
  const closedHomes = homes()
  const closed = Boolean(entity(t, home)?.components["Town/Paused"] !== undefined)
  t.edit({ type: "pause", cell: spot, on: false })
  t.run(30)
  const back = entity(t, home)?.components["Town/House"]?.residents
  check("closing a home", closed && emptied === 0 && closedHomes === open - 1 && back > 0, `residents 4 → ${emptied} closed (homes ${open} → ${closedHomes}), ${back} after reopening`)
}

// Fine homes lift their neighbours, not themselves.
{
  const t = town()
  let a = { x: 0, y: 0 }
  t.change((s) => {
    const g = gridOf(s)
    a = find(g, 1, (x, y) => besideRoad(g)(x, y) && canPlace(g.value(), { x: x + 1, y, size: 1 }) && canPlace(g.value(), { x: x - 1, y, size: 1 }), "house")
    g.claim({ x: a.x + 1, y: a.y, size: 1 }, -1, "house")
    homeAt(s, a.x, a.y, 3, 12)
    homeAt(s, a.x + 1, a.y, 1, 4)
  })
  t.run(1)
  const cells = t.snapshot().resources["Town/Appeal"].cells as Array<number>
  const lone = (() => {
    const u = town()
    u.change((s) => {
      const g = gridOf(s)
      const b = find(g, 1, (x, y) => x === a.x + 1 && y === a.y, "house")
      homeAt(s, b.x, b.y, 1, 4)
    })
    u.run(1)
    return u.snapshot().resources["Town/Appeal"].cells as Array<number>
  })()
  const lift = cells[key(a.x + 1, a.y)]! - lone[key(a.x + 1, a.y)]!
  check("fine homes lift the street", lift === 2, `a townhouse next door: ${signedText(lift)} desirability`)
}

console.log(failures === 0 ? "\nall ends hold" : `\n${failures} failed`)
if (failures > 0) process.exit(1)
