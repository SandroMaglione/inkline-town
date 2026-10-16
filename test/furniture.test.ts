/**
 * Furniture reaching the townhouses, in the real simulation, headless:
 * everything else a townhouse asks is given by rule patches and full
 * larders (as `scripts/furniture.ts` does), so this is furniture alone.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveRules } from "../src/rules/config.ts"
import { headless, type Snapshot } from "../src/sim/headless.ts"

const FOREVER = 1e9
const hallOf = (s: Snapshot) => s.entities.find((e) => e.components["Town/TownHall"])!

test("a market's walker brings home what it did not hand out, so furniture reaches the store and homes can rise into townhouses", () => {
  const rules = resolveRules([
    { path: "home.tiers.2.appeal", value: 0 },
    { path: "home.tiers.3.appeal", value: 0 },
    { path: "risk.kept", value: FOREVER },
    { path: "home.lasts.bread", value: FOREVER },
    { path: "home.lasts.cloth", value: FOREVER },
    { path: "home.lasts.faith", value: FOREVER }
  ])
  const t = headless({ size: "medium", term: 90, land: "fair", seed: 7 }, { rules })
  const hall = hallOf(t.snapshot()).components["Town/Tile"]
  const top = () =>
    t.change((s) => {
      const h = hallOf(s), stock = h.components["Town/Inventory"].stock
      h.components["Town/Inventory"].stock = { ...stock, planks: Math.max(stock.planks, 60), stone: 60, tools: 20 }
      s.resources["Town/Treasury"].coins = 5000
      for (const e of s.entities) if (e.components["Town/Condition"]) e.components["Town/Condition"] = { value: 1000 }
    })
  top()
  t.edit(
    { type: "roads", cells: Array.from({ length: 11 }, (_, i) => ({ x: hall.x + 4 + i, y: hall.y + 1 })) },
    { type: "homes", cells: Array.from({ length: 8 }, (_, i) => ({ x: hall.x + 5 + i, y: hall.y + 2 })) }
  )
  t.run(60)
  t.change((s) => {
    for (const e of s.entities) {
      const h = e.components["Town/House"]
      if (!h || e.components["Town/Site"]) continue
      e.components["Town/House"] = { ...h, tier: 2, residents: 8, bread: FOREVER, cloth: FOREVER, faith: FOREVER, food: FOREVER }
      e.components["Town/Rebuilt"] = { tier: 2 }
    }
  })
  t.run(10)
  t.edit(
    { type: "building", kind: "market", cell: { x: hall.x + 4, y: hall.y - 1 }, open: false },
    { type: "building", kind: "carpenter", cell: { x: hall.x + 6, y: hall.y - 1 }, open: false }
  )
  for (let i = 0; i < 6 * 14; i++) {
    top()
    t.run(10)
  }
  const s = t.snapshot()
  // Its walker away, a market refills; what the walker brings back once was lost over the shelf's room.
  assert(s.entities.filter((e) => e.components["Town/House"]?.tier === 3).length >= 6, JSON.stringify(s.entities.filter((e) => e.components["Town/House"]).map((e) => e.components["Town/House"].tier)))
})
