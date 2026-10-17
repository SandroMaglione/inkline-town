import type { ParkCell } from "../../src/appeal.ts"
import { amounts, goodIds, type KindId, type Tier } from "../../src/content.ts"
import { GridBuilder, canPlace, doors, key, nearest, reach, type Use, type TileLike } from "../../src/grid.ts"
import { GRID } from "../../src/iso.ts"
import { shippedRules, type Rules } from "../../src/rules/config.ts"
import type { Snapshot } from "../../src/sim/headless.ts"
import type { ModelBuilding, ModelHome, Scenario } from "./types.ts"

export const scenarioGrid = (s: Scenario, rules: Rules = shippedRules): GridBuilder => {
  const grid = new GridBuilder(s.mask)
  for (const [i, l] of s.land.entries()) grid.claim(l.tile, -1 - i, l.type === "stone" || l.type === "ore" ? "rock" : l.type)
  for (const [i, p] of s.roads.entries()) grid.claim({ ...p, size: 1 }, -100000 - i, "road")
  for (const h of s.homes) grid.claim(h.tile, h.id, "house")
  for (const b of s.buildings) grid.claim({ ...b.tile, size: rules.kinds[b.kind].size }, b.id, "building")
  for (const [i, r] of (s.ruins ?? []).entries()) grid.claim(r, -200000 - i, "ruin")
  for (const [i, p] of (s.parks ?? []).entries()) grid.claim({ ...p, size: 1 }, -300000 - i, "park")
  return grid
}

export const validateScenario = (s: Scenario, rules: Rules = shippedRules) => {
  if (!Number.isFinite(s.coins) || !Number.isFinite(s.approval) || !Number.isInteger(s.tick) || s.tick < 0) throw new Error("Invalid scenario state")
  const ids = [...s.homes.map((h) => h.id), ...s.buildings.map((b) => b.id)]
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) throw new Error("Scenario ids must be unique positive integers")
  const grid = new GridBuilder(s.mask)
  const lay = (tile: { readonly x: number; readonly y: number; readonly size: number }, id: number, use: Use) => {
    if (![tile.x, tile.y, tile.size].every(Number.isInteger) || tile.x < 0 || tile.y < 0 || tile.x + tile.size > GRID || tile.y + tile.size > GRID || tile.size <= 0 || !canPlace(grid.value(), tile)) throw new Error(`Invalid or overlapping tile: ${id}`)
    grid.claim(tile, id, use)
  }
  // Roads and construction may intentionally replace natural resources; buildings may not overlap one another.
  for (const [i, r] of s.roads.entries()) lay({ ...r, size: 1 }, -100000 - i, "road")
  for (const h of s.homes) {
    if (h.tile.size !== 1 || ![1, 2, 3].includes(h.tier) || h.residents < 0 || h.residents > rules.home.tiers[h.tier].residents || !Number.isInteger(h.residents)) throw new Error(`Invalid home: ${h.id}`)
    lay(h.tile, h.id, "house")
  }
  for (const b of s.buildings) {
    if (!rules.kinds[b.kind]) throw new Error(`Unknown kind: ${b.kind}`)
    if (b.tile.size !== rules.kinds[b.kind].size) throw new Error(`Invalid footprint: ${b.id}`)
    for (const g of goodIds) if (!Number.isFinite(b.stock[g]) || b.stock[g] < 0) throw new Error(`Invalid stock: ${b.id}/${g}`)
    lay({ ...b.tile, size: rules.kinds[b.kind].size }, b.id, "building")
  }
  for (const [i, r] of (s.ruins ?? []).entries()) lay(r, -200000 - i, "ruin")
  for (const [i, p] of (s.parks ?? []).entries()) {
    if (!rules.grounds[p.ground] || (p.prop !== "none" && !rules.props[p.prop])) throw new Error("Unknown park piece")
    lay({ ...p, size: 1 }, -300000 - i, "park")
  }
}

/** Read-only adapter; loading a snapshot never starts the runtime. */
export const fromSnapshot = (snapshot: Snapshot, name = "saved-town", rules: Rules = shippedRules): Scenario => {
  const r = snapshot.resources, homes: ModelHome[] = [], buildings: ModelBuilding[] = [], land: Scenario["land"][number][] = [], roads: Scenario["roads"][number][] = []
  const ruins: TileLike[] = [], parks: ParkCell[] = []
  for (const { id, components: c } of snapshot.entities) {
    const tile = c["Town/Tile"]
    if (!tile) continue
    if (c["Town/Road"]) roads.push({ x: tile.x, y: tile.y, ...(c["Town/Paved"] ? { paved: true } : {}) })
    if (c["Town/Park"]) parks.push({ x: tile.x, y: tile.y, ...c["Town/Park"] })
    if (c["Town/Ruin"]) ruins.push(tile)
    if (c["Town/House"] && !c["Town/Site"] && !c["Town/Rising"] && !c["Town/Burning"]) homes.push({ id, tile, ...c["Town/House"], condition: c["Town/Condition"]?.value ?? rules.conditionMax, meters: c["Town/Risk"] ?? { fire: 0, health: 0, order: 0 }, ...(c["Town/Sick"] ? { sick: true } : {}) })
    if (c["Town/Building"] && !c["Town/Burning"]) buildings.push({ id, kind: c["Town/Building"].kind, tile, stock: amounts(c["Town/Inventory"]?.stock ?? {}), condition: c["Town/Condition"]?.value ?? rules.conditionMax, paused: !!c["Town/Paused"], site: !!c["Town/Site"] || !!c["Town/Rising"] })
    const type = c["Town/Tree"] ? "tree" : c["Town/Rock"] ? c["Town/Rock"].ore ? "ore" : "stone" : c["Town/Water"] ? "water" : c["Town/Field"] ? "field" : null
    if (type) land.push({ tile, type, amount: c["Town/Rock"]?.amount ?? 1, growth: c["Town/Tree"]?.growth ?? c["Town/Field"]?.growth ?? 0 })
  }
  const charter = r["Town/Charter"]
  return { name, charter, tick: r["Town/Time"].step - charter.founded, coins: r["Town/Treasury"].coins, approval: r["Town/Mood"].approval,
    policy: r["Town/Policy"], trade: { ...r["Town/Policy"], prices: r["Town/Market"].prices }, homes, buildings, roads, land, ruins, parks, mask: r["Town/Land"].mask }
}

/** Small authored districts. The same geometry is used by analysis and controlled runtime verification. */
export const district = (name: string, tiers: ReadonlyArray<Tier>, kinds: ReadonlyArray<KindId>, branch = false, rules: Rules = shippedRules): Scenario => {
  const roads: Array<{ x: number; y: number; paved?: boolean }> = []
  for (let x = 8; x <= 54; x++) roads.push({ x, y: 30 })
  if (branch) for (const x of [15, 23, 31, 39, 47]) for (let y = 24; y <= 36; y++) if (y !== 30) roads.push({ x, y })
  const homeCells = Array.from({ length: 44 }, (_, i) => ({ x: 9 + i, y: 29, size: 1 })).filter((p) => !roads.some((r) => r.x === p.x && r.y === p.y))
  const houses = tiers.map((tier, i): ModelHome => ({ id: i + 1, tile: homeCells[i]!, tier, residents: rules.home.tiers[tier].residents,
    food: rules.home.lasts.food, bread: tier >= 2 ? rules.home.lasts.bread : 0, cloth: tier >= 2 ? rules.home.lasts.cloth : 0, faith: tier >= 2 ? rules.home.lasts.faith : 0, furniture: tier >= 3 ? rules.home.lasts.furniture : 0,
    clock: 0, condition: rules.conditionMax, meters: { fire: 0, health: 0, order: 0 } }))
  const buildings: ModelBuilding[] = [], grid = new GridBuilder()
  for (const p of roads) grid.claim({ ...p, size: 1 }, -1, "road")
  for (const h of houses) grid.claim(h.tile, h.id, "house")
  const all = ["townhall" as const, ...kinds]
  for (const [i, kind] of all.entries()) {
    const k = rules.kinds[kind]
    let tile: { x: number; y: number; size: number } | undefined
    for (let x = 8; x <= 54 - k.size; x++) {
      const candidate = { x, y: 31, size: k.size }
      if (canPlace(grid.value(), candidate) && doors(grid.value(), candidate).length > 0) { tile = candidate; break }
    }
    if (!tile) throw new Error("District has no room for another building")
    const id = 100 + i
    buildings.push({ id, kind, tile, condition: rules.conditionMax, paused: false, site: false,
      stock: amounts(kind === "townhall" ? rules.lands.fair.stock : { tools: k.wear ? 1 : 0 }) })
    grid.claim(tile, id, "building")
  }
  const land: Scenario["land"][number][] = []
  for (const b of buildings) if (b.kind === "farm") {
    for (let i = 0; i < rules.kinds.farm.plants!.max; i++) land.push({ tile: { x: b.tile.x + i % 4, y: b.tile.y + b.tile.size + Math.floor(i / 4), size: 1 }, type: "field", amount: 1, growth: rules.grown.field })
  }
  // A fishery's own stretch of shore, two cells deep and wide enough to fish at full pace (see `RESTOCK_TICKS`).
  const taken = new Set(land.map((l) => key(l.tile.x, l.tile.y)))
  for (const b of buildings) if (b.kind === "fishery")
    for (let x = b.tile.x - 2; x < b.tile.x + b.tile.size + 2; x++)
      for (let y = b.tile.y + b.tile.size; y < b.tile.y + b.tile.size + 2; y++)
        if (!taken.has(key(x, y))) land.push({ tile: { x, y, size: 1 }, type: "water", amount: 1, growth: 0 })
  return { name, charter: { size: "medium", term: 60, land: "fair", seed: 1000 }, tick: 0, coins: rules.lands.fair.coins, approval: 40,
    policy: { settlers: 100, citizens: 100 }, homes: houses, buildings, roads, land }
}

export const roadDistance = (s: Scenario, from: ModelBuilding, to: ModelBuilding | ModelHome, rules: Rules): number | null => {
  const grid = scenarioGrid(s, rules).value(), found = nearest(reach(grid, doors(grid, from.tile)), doors(grid, to.tile))
  return found?.distance ?? null
}
