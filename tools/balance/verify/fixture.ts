/** This is the only layer that imports the ECS runtime. Model inputs stay plain data. */
import { goodIds } from "../../../src/content.ts"
import { GRID } from "../../../src/iso.ts"
import { ownerAt } from "../../../src/grid.ts"
import { rolesOf, wearOf } from "../../../src/archetypes.ts"
import { headless, type Headless, type Snapshot } from "../../../src/sim/headless.ts"
import type { Rules } from "../../../src/rules/config.ts"
import { scenarioGrid, validateScenario } from "../scenario.ts"
import type { BuildAction, Scenario } from "../types.ts"

export const fixture = (scenario: Scenario, rules: Rules): Headless => {
  validateScenario(scenario, rules)
  if (scenario.buildings.some((b) => b.site)) throw new Error("Controlled fixtures require completed buildings; a construction site needs its original owed materials and progress")
  const town = headless(scenario.charter, { rules })
  town.change((s) => {
    s.entities = []; s.relations = {}; s.nextEntity = Math.max(0, ...scenario.homes.map((h) => h.id), ...scenario.buildings.map((b) => b.id)) + 1
    const add = (components: Record<string, unknown>, id = s.nextEntity++) => s.entities.push({ id, components })
    for (const h of scenario.homes) add({
      "Town/Tile": h.tile, "Town/House": { tier: h.tier, residents: h.residents, food: h.food, bread: h.bread, cloth: h.cloth, faith: h.faith, clock: h.clock },
      ...Object.fromEntries(wearOf(rules).map(([d, v]) => [d.name, structuredClone(v)])),
      "Town/Risk": { ...h.meters, thefts: 0 }, "Town/Condition": { value: h.condition },
      ...(h.sick ? { "Town/Sick": { left: rules.risk.health.lasts } } : {})
    }, h.id)
    for (const b of scenario.buildings) {
      const kind = rules.kinds[b.kind]
      const components: Record<string, unknown> = {
        "Town/Tile": b.tile, "Town/Building": { kind: b.kind }, "Town/Status": "idle",
        "Town/Staff": { needed: kind.workers, assigned: 0, apprentices: 0, nearby: 0 },
        ...Object.fromEntries(rolesOf(kind, rules).map(([d, v]) => [d.name, structuredClone(v)])),
        ...(b.kind === "townhall" ? { "Town/TownHall": {} } : {}), ...(b.paused ? { "Town/Paused": {} } : {})
      }
      if (components["Town/Inventory"]) (components["Town/Inventory"] as { stock: unknown }).stock = structuredClone(b.stock)
      if (components["Town/Condition"]) components["Town/Condition"] = { value: b.condition }
      add(components, b.id)
    }
    for (const p of scenario.roads) add({ "Town/Tile": { x: p.x, y: p.y, size: 1 }, "Town/Road": {}, ...(p.paved ? { "Town/Paved": {} } : {}) })
    for (const p of scenario.parks ?? []) add({ "Town/Tile": { x: p.x, y: p.y, size: 1 }, "Town/Park": { ground: p.ground, prop: p.prop } })
    for (const tile of scenario.ruins ?? []) add({ "Town/Tile": tile, "Town/Ruin": { cause: "burnt" } })
    const grid = scenarioGrid(scenario, rules).value()
    for (const [i, l] of scenario.land.entries()) {
      if (ownerAt(grid, l.tile.x, l.tile.y) !== -1 - i) continue
      const component = l.type === "tree" ? { "Town/Tree": { growth: l.growth } } : l.type === "field" ? { "Town/Field": { growth: l.growth } } : l.type === "water" ? { "Town/Water": {} } : { "Town/Rock": { amount: l.amount, ore: l.type === "ore" } }
      add({ "Town/Tile": l.tile, ...component })
    }
    s.resources["Town/Land"] = { mask: scenario.mask ?? "1".repeat(GRID * GRID), cells: GRID * GRID }
    s.resources["Town/Time"] = { tick: scenario.tick + 1 }
    s.resources["Town/Charter"] = { ...scenario.charter, founded: 1, winters: scenario.charter.winters ?? s.resources["Town/Charter"].winters }
    s.resources["Town/Treasury"] = { coins: scenario.coins }
    s.resources["Town/Mood"] = { ...s.resources["Town/Mood"], approval: scenario.approval }
    s.resources["Town/Policy"] = { settlers: scenario.policy.settlers, citizens: scenario.policy.citizens, sells: scenario.trade?.sells ?? [], buys: scenario.trade?.buys ?? [], reserve: scenario.trade?.reserve ?? rules.trade.reserve, loads: Object.fromEntries(goodIds.map((g) => [g, scenario.trade?.loads?.[g] ?? rules.tradeLoad])) }
    if (scenario.trade?.prices) s.resources["Town/Market"] = { prices: scenario.trade.prices }
    s.resources["Town/Appeal"] = { cells: [] }
  })
  return town
}

export const pushBuild = (town: Headless, action: BuildAction) => {
  if (action.kind === "ground") town.edit({ type: "ground", ground: action.ground, cells: [action.tile] })
  else if (action.kind === "prop") town.edit({ type: "prop", prop: action.prop, cell: action.tile })
  else town.edit(action.kind === "home" ? { type: "homes", cells: [action.tile] } : { type: "building", kind: action.kind, cell: action.tile, open: false })
}
export const component = (snapshot: Snapshot, id: number, name: string): any => snapshot.entities.find((e) => e.id === id)?.components[name]
