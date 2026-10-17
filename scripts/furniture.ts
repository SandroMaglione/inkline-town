/**
 * How furniture keeps up with the townhouses, in the real simulation,
 * headless: a street of homes beside the town hall, a market and a carpenter
 * across it, planks kept in the store. Everything else a townhouse asks
 * (desirability, the three services, bread, cloth, faith) is given, by rule
 * patches, full larders and homes kept in repair, so what is measured is furniture alone: how soon
 * the homes become townhouses, how many stay townhouses, and what the
 * carpenter makes and the townhouses use.
 *
 *   node scripts/furniture.ts [minutes]
 */
import { kinds } from "../src/content.ts"
import { resolveRules } from "../src/rules/config.ts"
import { headless, type Snapshot } from "../src/sim/headless.ts"

const minutes = Number(process.argv[2] ?? 30)
const FOREVER = 1e9
const rules = [
  // Every street fits a townhouse, every service calls, and bread, cloth and faith never run out.
  { path: "home.tiers.2.appeal", value: 0 },
  { path: "home.tiers.3.appeal", value: 0 },
  { path: "risk.kept", value: FOREVER },
  { path: "home.lasts.bread", value: FOREVER },
  { path: "home.lasts.cloth", value: FOREVER },
  { path: "home.lasts.faith", value: FOREVER }
]

const kindOf = (e: Snapshot["entities"][number]) => e.components["Town/Building"]?.kind as string | undefined
const hallOf = (s: Snapshot) => s.entities.find((e) => e.components["Town/TownHall"])!

const run = (homes: number, carpenters: number) => {
  const t = headless({ size: "medium", term: 90, land: "fair", seed: 7 }, { rules: resolveRules(rules) })
  const hall = hallOf(t.snapshot()).components["Town/Tile"]
  const top = () =>
    t.change((s) => {
      const h = hallOf(s)
      const stock = h.components["Town/Inventory"].stock
      h.components["Town/Inventory"].stock = { ...stock, planks: Math.max(stock.planks, 60), stone: Math.max(stock.stone, 60), tools: Math.max(stock.tools, 20) }
      s.resources["Town/Treasury"].coins = Math.max(s.resources["Town/Treasury"].coins, 5000)
      // Nothing wears out or burns: a builder and a fire watch are given too.
      for (const e of s.entities) {
        if (e.components["Town/Condition"]) e.components["Town/Condition"] = { value: 1000 }
        delete e.components["Town/Burning"]
      }
    })
  top()
  // A street east of the hall's ring road, its homes on the south side.
  const length = Math.max(homes, 6 + 2 * carpenters) + 2
  t.edit(
    { type: "roads", cells: Array.from({ length: length + 1 }, (_, i) => ({ x: hall.x + 4 + i, y: hall.y + 1 })) },
    { type: "homes", cells: Array.from({ length: homes }, (_, i) => ({ x: hall.x + 5 + i, y: hall.y + 2 })) }
  )
  t.run(60)
  // The homes as citizens' homes, their larders full for good.
  t.change((s) => {
    for (const e of s.entities) {
      const h = e.components["Town/House"]
      if (!h || e.components["Town/Site"]) continue
      e.components["Town/House"] = { ...h, tier: 2, residents: 8, bread: FOREVER, cloth: FOREVER, faith: FOREVER, food: FOREVER }
      e.components["Town/Rebuilt"] = { tier: 2 }
    }
  })
  t.run(10)
  // Across the street: a market, then the carpenters.
  t.edit({ type: "building", kind: "market", cell: { x: hall.x + 4, y: hall.y - 1 }, open: false })
  for (let i = 0; i < carpenters; i++) t.edit({ type: "building", kind: "carpenter", cell: { x: hall.x + 6 + 2 * i, y: hall.y - 1 }, open: false })
  const started = t.snapshot().resources["Town/Time"].step
  const samples: Array<Record<string, number | string> & { townhouses: number; made: number }> = []
  let firstAll = -1
  for (let m = 1; m <= minutes; m++) {
    for (let k = 0; k < 6; k++) {
      top()
      t.run(10)
    }
    const s = t.snapshot()
    const houses = s.entities.filter((e) => e.components["Town/House"] && !e.components["Town/Site"])
    const townhouses = houses.filter((e) => e.components["Town/House"].tier === 3).length
    const shops = s.entities.filter((e) => kindOf(e) === "carpenter")
    const market = s.entities.find((e) => kindOf(e) === "market")
    const sample = {
      minute: m,
      townhouses,
      furnished: houses.filter((e) => e.components["Town/House"].furniture > 0).length,
      hall: hallOf(s).components["Town/Inventory"].stock.furniture,
      market: market?.components["Town/Inventory"]?.stock.furniture ?? 0,
      made: shops.reduce((n, e) => n + (e.components["Town/Recipe"]?.made ?? 0), 0),
      working: shops.filter((e) => e.components["Town/Status"] === "working").length,
      status: shops.map((e) => e.components["Town/Status"]).join(","),
      planks: hallOf(s).components["Town/Inventory"].stock.planks,
      tiers: houses.map((e) => `${e.components["Town/House"].tier}/${e.components["Town/House"].residents}/${Math.round(e.components["Town/House"].furniture / 60)}`).join(" ")
    }
    samples.push(sample)
    if (firstAll < 0 && townhouses === homes) firstAll = m
  }
  const ticks = t.snapshot().resources["Town/Time"].step - started
  const last = samples.at(-1)!
  const tail = samples.slice(Math.floor(samples.length / 2))
  const held = tail.reduce((n, x) => n + x.townhouses, 0) / tail.length
  return { homes, carpenters, firstAll, held, made: last.made, perMinute: last.made / minutes, samples }
}

console.log(`Furniture over ${minutes} minutes: ${kinds.carpenter.recipe!.inputs} planks → 1 furniture every ${kinds.carpenter.recipe!.seconds} s; a piece lasts 300 s, topped up at half.`)
console.log("homes · carpenters · all townhouses by · townhouses held (second half) · furniture made · made a minute")
for (const [homes, carpenters] of (process.env.ONLY ? [JSON.parse(process.env.ONLY)] : [[4, 1], [8, 1], [16, 1], [24, 1], [24, 2]]) as Array<[number, number]>) {
  const r = run(homes, carpenters)
  console.log(`${String(homes).padStart(5)} · ${String(carpenters).padStart(10)} · ${r.firstAll < 0 ? "never" : `minute ${r.firstAll}`} · ${r.held.toFixed(1)} of ${homes} · ${r.made} · ${r.perMinute.toFixed(1)}`)
  if (process.env.VERBOSE) for (const x of r.samples) console.log("   ", JSON.stringify(x))
}
