/**
 * Checks that every way a term can end does end it: the real simulation,
 * headless, put into each situation through the same snapshots the page
 * saves and loads.
 *
 *   node scripts/check.ts
 *
 * - complete: a town meeting every goal, held two minutes, is won; it can
 *   carry on governing, and its term then runs out as complete;
 * - bankrupt: three minutes in debt;
 * - revolt: approval at -50 or below for two minutes;
 * - abandoned: residents fall below 15% of their peak;
 * - over: a term run out;
 * - the crown: a request left unanswered is a fine and a snub, and three in
 *   a row and the mayor is dismissed;
 * - and a town saved mid-term loads back the same.
 */
import type { CharterValue } from "../src/content.ts"
import { DIRS, GridBuilder, key } from "../src/grid.ts"
import { inside } from "../src/iso.ts"
import { headless, type Snapshot } from "../src/sim/headless.ts"

const town = (charter: CharterValue = { size: "small", term: 45, land: "fair", seed: 7 }) => {
  const t = headless(charter)
  const fate = () => t.snapshot().resources["Town/Fate"] as { state: string; reason: string; at: number; governing: boolean }
  return { ...t, fate }
}

/** Citizens' homes, every need met for good, on free cells beside the roads. */
const settle = (s: Snapshot, homes: number) => {
  const grid = new GridBuilder(s.resources["Town/Land"].mask)
  for (const e of s.entities) {
    const tile = e.components["Town/Tile"]
    if (tile) grid.claim(tile, e.id, e.components["Town/Road"] ? "road" : "building")
  }
  const g = grid.value()
  let placed = 0
  for (let k = 0; k < g.use.length && placed < homes; k++) {
    if (g.use[k] !== "empty") continue
    const x = k % 64
    const y = Math.floor(k / 64)
    if (!DIRS.some((d) => inside(x + d.x, y + d.y) && g.use[key(x + d.x, y + d.y)] === "road")) continue
    const forever = 10_000_000
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

let failures = 0
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`)
  if (!ok) failures += 1
}

// Complete: 25 citizens' homes is 200 residents, all citizens; plenty of coins.
{
  const t = town()
  let placed = 0
  t.change((s) => {
    placed = settle(s, 25)
    s.resources["Town/Treasury"].coins = 10_000
  })
  t.run(4 * 60)
  const f = t.fate()
  check("complete", f.state === "won", `${placed} homes · ${f.state} at ${(f.at / 3600).toFixed(1)} min: ${f.reason}`)
  t.edit({ type: "govern" })
  t.run(1)
  check("keep governing", t.fate().state === "playing" && t.fate().governing, `${t.fate().state}, governing ${t.fate().governing}`)
  t.run(42 * 60)
  const end = t.fate()
  check("complete to the end", end.state === "over" && end.governing, `${end.state}: ${end.reason}`)
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

console.log(failures === 0 ? "\nall ends hold" : `\n${failures} failed`)
if (failures > 0) process.exit(1)
