import { type KindId } from "../../src/content.ts"
import type { Rules } from "../../src/rules/config.ts"
import { district } from "./scenario.ts"
import type { BuildAction, Scenario } from "./types.ts"

/** A three-cell planted park beside four homes; uses the actual cell/prop rules. */
export const citizenPark = () => [
  { x: 9, y: 28, ground: "flowers" as const, prop: "fountain" as const },
  { x: 10, y: 28, ground: "flowers" as const, prop: "lamp" as const },
  { x: 11, y: 28, ground: "flowers" as const, prop: "none" as const }
]
export const citizensDistrict = (rules: Rules, parks = true): Scenario => {
  const s = district(parks ? "zoned-citizens" : "industrial-citizens", Array(12).fill(1), ["farm", "mill", "bakery", "sheep", "weaver", "market", "chapel"], false, rules)
  return parks ? { ...s, parks: citizenPark() } : s
}

/**
 * What the authored district has to spend: its own budget, not a land's starting treasury, so the fixture
 * measures the model against the game rather than the opening's difficulty.
 */
export const AUTHORED_BUDGET = 2000

/** Authored flat-land starting district. Roads/homes are charged; it is not a generated-map or human-win claim. */
export const buildScenario = (rules: Rules) => {
  const kinds: KindId[] = ["farm", "mill", "bakery", "sheep", "weaver", "market", "chapel", "lumberjack", "sawmill", "quarry", "fishery"]
  // Sixteen cottages: enough residents to open the bread chain.
  const template = district("authored-bootstrap", Array(16).fill(1), kinds, false, rules)
  const hall = template.buildings.find((b) => b.kind === "townhall")!
  const initial = { ...rules.lands.fair.stock, planks: rules.lands.fair.stock.planks - template.homes.length }
  const land: Scenario["land"][number][] = [...template.land.filter((l) => l.type === "water")]
  const lumber = template.buildings.find((b) => b.kind === "lumberjack")!, quarry = template.buildings.find((b) => b.kind === "quarry")!
  for (let x = lumber.tile.x - 3; x < lumber.tile.x + 3; x++) for (let y = 35; y < 39; y++) land.push({ tile: { x, y, size: 1 }, type: "tree", amount: 1, growth: rules.grown.tree })
  for (let x = quarry.tile.x; x < quarry.tile.x + 2; x++) land.push({ tile: { x, y: 34, size: 1 }, type: "stone", amount: rules.lands.fair.rock, growth: 0 })
  const scenario: Scenario = { ...template, land, name: "authored-bootstrap", coins: AUTHORED_BUDGET - template.homes.length * rules.home.cost.coins - template.roads.length * rules.roadCost,
    buildings: [{ ...hall, stock: initial }], trade: { buys: ["tools", "planks"], sells: [], reserve: 10 } }
  const order: ReadonlyArray<readonly [KindId, number]> = [["sawmill", 0], ["lumberjack", 0], ["fishery", 0], ["quarry", 30], ["mill", 60], ["bakery", 90], ["farm", 120], ["sheep", 150], ["weaver", 180], ["market", 210], ["chapel", 240]]
  const builds: BuildAction[] = order.map(([kind, at]) => ({ kind, at, tile: template.buildings.find((b) => b.kind === kind)!.tile }))
  builds.push({ kind: "firewatch", at: 30, tile: { x: 6, y: 29, size: 2 } })
  for (const p of citizenPark()) builds.push({ kind: "ground", ground: p.ground, at: 0, tile: { x: p.x, y: p.y, size: 1 } })
  // Ground commands must have been applied before a furnishing can address their entities.
  for (const p of citizenPark()) if (p.prop !== "none") builds.push({ kind: "prop", prop: p.prop, at: 1, tile: { x: p.x, y: p.y, size: 1 } })
  return { scenario, builds }
}
