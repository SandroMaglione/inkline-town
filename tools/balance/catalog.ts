import { amounts, type KindId } from "../../src/content.ts"
import type { Rules } from "../../src/rules/config.ts"
import { district } from "./scenario.ts"
import type { BuildAction, Scenario } from "./types.ts"

export const citizensDistrict = (rules: Rules, gardens = true): Scenario => {
  const s = district(gardens ? "zoned-citizens" : "industrial-citizens", Array(12).fill(1), ["farm", "mill", "bakery", "sheep", "weaver", "market", "chapel"], false, rules)
  return gardens ? { ...s, buildings: [...s.buildings, ...s.homes.slice(0, 4).map((h, i) => ({ id: 300 + i, kind: "garden" as const,
    tile: { x: h.tile.x, y: h.tile.y - 1, size: 1 }, condition: rules.conditionMax, site: false, paused: false, stock: amounts({}) }))] } : s
}

/** Authored flat-land starting district. Roads/homes are charged; it is not a generated-map or human-win claim. */
export const buildScenario = (rules: Rules) => {
  const kinds: KindId[] = ["farm", "mill", "bakery", "sheep", "weaver", "market", "chapel", "lumberjack", "sawmill", "quarry", "fishery"]
  const template = district("authored-bootstrap", Array(12).fill(1), kinds, false, rules)
  const hall = template.buildings.find((b) => b.kind === "townhall")!
  const initial = { ...rules.lands.fair.stock, planks: rules.lands.fair.stock.planks - template.homes.length }
  const land: Scenario["land"][number][] = [...template.land.filter((l) => l.type === "water")]
  const lumber = template.buildings.find((b) => b.kind === "lumberjack")!, quarry = template.buildings.find((b) => b.kind === "quarry")!
  for (let x = lumber.tile.x - 3; x < lumber.tile.x + 3; x++) for (let y = 35; y < 39; y++) land.push({ tile: { x, y, size: 1 }, type: "tree", amount: 1, growth: rules.grown.tree })
  for (let x = quarry.tile.x; x < quarry.tile.x + 2; x++) land.push({ tile: { x, y: 34, size: 1 }, type: "stone", amount: rules.lands.fair.rock, growth: 0 })
  const scenario: Scenario = { ...template, land, name: "authored-bootstrap", coins: rules.lands.fair.coins - template.homes.length * rules.home.cost.coins - template.roads.length * rules.roadCost,
    buildings: [{ ...hall, stock: initial }], trade: { buys: ["tools"], sells: [], reserve: 10 } }
  const order: ReadonlyArray<readonly [KindId, number]> = [["sawmill", 0], ["lumberjack", 0], ["fishery", 0], ["quarry", 30], ["mill", 60], ["bakery", 90], ["farm", 120], ["sheep", 150], ["weaver", 180], ["market", 210], ["chapel", 240]]
  const builds: BuildAction[] = order.map(([kind, at]) => ({ kind, at, tile: template.buildings.find((b) => b.kind === kind)!.tile }))
  for (const h of scenario.homes.slice(0, 4)) builds.push({ kind: "garden", at: 0, tile: { x: h.tile.x, y: h.tile.y - 1, size: 1 } })
  return { scenario, builds }
}
