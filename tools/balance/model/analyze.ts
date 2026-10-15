import { amounts, goodIds, type GoodId, type WinterId } from "../../../src/content.ts"
import { appealAt, appealGrid, buildingSource, homeSource, landSource, parkSources, parkUpkeep } from "../../../src/appeal.ts"
import { doors, nearest, reach } from "../../../src/grid.ts"
import { assignWorkers, type Assignment } from "../../../src/rules/production.ts"
import { baseCollection, wantsCitizenGoods, mealRate, mealsOf, refreshLevel, taxOf, tierFor } from "../../../src/rules/households.ts"
import { riskIncrements, near } from "../../../src/rules/risks.ts"
import { seasonAt } from "../../../src/rules/seasons.ts"
import { spoilExpectation } from "../../../src/rules/decay.ts"
import { goalsOf } from "../../../src/rules/goals.ts"
import { scenarioGrid, validateScenario } from "../scenario.ts"
import { recipeCapacity, sourceCeiling } from "./throughput.ts"
import { missProbability, serviceProfile } from "./services.ts"
import type { Inputs, Finding } from "../types.ts"

export interface AnalysisOptions { readonly minutes?: number; readonly severity?: WinterId | null; readonly services?: boolean }
export const analyze = ({ rules, scenario: s }: Inputs, options: AnalysisOptions = {}) => {
  validateScenario(s, rules)
  const started = performance.now(), grid = scenarioGrid(s, rules), g = grid.value(), minutes = options.minutes ?? 10
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("Analysis horizon must be positive and finite")
  const severity = options.severity === undefined ? seasonAt(s.tick, s.charter, rules).severity : options.severity
  const homes = s.homes.map((h) => ({ id: h.id, crew: h.tier === 1 ? "settlers" as const : "citizens" as const, residents: h.residents }))
  const workplaces = s.buildings.filter((b) => !b.site).map((b) => {
    const starts = doors(g, b.tile), roads = reach(g, starts), kind = rules.kinds[b.kind]
    return { id: b.id, crew: kind.crew, needed: kind.workers,
      within: b.paused ? [] : s.homes.flatMap((h) => {
        const found = nearest(roads, doors(g, h.tile))
        return found && found.distance <= rules.commute ? [{ home: h.id, distance: found.distance }] : []
      }) }
  })
  const staff = assignWorkers(homes, workplaces)
  const zero: Assignment = { assigned: 0, apprentices: 0, nearby: 0 }
  const sources = s.buildings.filter((b) => !b.site).flatMap((b) => { const a = buildingSource(b.kind, b.tile, rules); return a ? [a] : [] })
  for (const l of s.land) if (l.type === "water" || l.type === "tree") sources.push(landSource(l.type === "tree" ? "forest" : "water", l.tile, rules))
  for (const r of s.roads) if (r.paved) sources.push(landSource("paved", r, rules))
  for (const r of s.ruins ?? []) sources.push(landSource("ruin", r, rules))
  for (const h of s.homes) {
    if (h.condition < rules.condition.worn) sources.push(landSource("worn", h.tile, rules))
    const fine = homeSource(h.tier, h.tile, rules)
    if (fine) sources.push(fine)
  }
  const roadCells = new Set(s.roads.map((p) => `${p.x},${p.y}`))
  sources.push(...parkSources(s.parks ?? [], (x, y) => roadCells.has(`${x},${y}`), rules))
  const appeal = appealGrid(sources, rules), findings: Finding[] = []
  const recipes = s.buildings.filter((b) => !b.site && !b.paused && rules.kinds[b.kind].recipe).map((b) => {
    const kind = rules.kinds[b.kind], crew = staff.get(b.id) ?? zero
    const capacity = doors(g, b.tile).length === 0 ? recipeCapacity(kind, zero, 0, 0, severity, rules) : recipeCapacity(kind, crew, b.stock.tools, b.condition, severity, rules)
    const source = sourceCeiling(b, s, grid, severity, minutes, rules)
    const cap = Math.min(capacity.outputPerMinute, source * kind.recipe!.batch)
    if (crew.assigned < kind.workers) findings.push({ code: "staff-shortage", confidence: "exact", detail: `${b.kind} #${b.id}: ${crew.assigned}/${kind.workers} workers within ${rules.commute} road cells` })
    if (crew.apprentices > 0) findings.push({ code: "apprentices", confidence: "exact", detail: `${b.kind} #${b.id}: ${crew.apprentices} apprentices; cadence-aware capacity ${cap.toFixed(2)} ${kind.recipe!.output}/min` })
    if (kind.wear && b.stock.tools === 0) findings.push({ code: "no-tools", confidence: "exact", detail: `${b.kind} #${b.id} lacks its working tool` })
    if (source === 0) findings.push({ code: "source-unavailable", confidence: "upper-bound", detail: `${b.kind} #${b.id}: no accessible ${kind.gathers!.source} supply during this horizon` })
    return { id: b.id, kind: b.kind, staff: crew, capacity, sourceCeiling: source === Infinity ? null : source, outputCeiling: cap }
  })
  // A steady-state relaxation: throttle recipes against upstream resource budgets. The placement cuts below are necessary conditions, not an optimal dispatcher.
  const supply = { ...amounts({}) }, inputs = { ...amounts({}) }
  const rates = new Map(recipes.map((r) => [r.id, r.outputCeiling]))
  for (let iteration = 0; iteration < 64; iteration++) {
    for (const g of goodIds) { supply[g] = s.imports?.[g] ?? 0; inputs[g] = 0 }
    for (const row of recipes) {
      const recipe = rules.kinds[row.kind].recipe!, rate = rates.get(row.id)!
      supply[recipe.output] += rate
      if (recipe.input) inputs[recipe.input] += rate * recipe.inputs / recipe.batch
    }
    let changed = false
    for (const row of recipes) {
      const recipe = rules.kinds[row.kind].recipe!, rate = rates.get(row.id)!
      if (recipe.input && inputs[recipe.input] > supply[recipe.input] + 1e-8) {
        rates.set(row.id, rate * supply[recipe.input] / inputs[recipe.input]); changed = true
      }
    }
    if (!changed) break
  }
  for (const g of goodIds) { supply[g] = s.imports?.[g] ?? 0; inputs[g] = s.exports?.[g] ?? 0 }
  for (const row of recipes) {
    const r = rules.kinds[row.kind].recipe!, rate = rates.get(row.id)!
    supply[r.output] += rate
    if (r.input) inputs[r.input] += rate * r.inputs / r.batch
    if (rules.kinds[row.kind].wear) inputs.tools += rate / r.batch / rules.kinds[row.kind].wear!
  }
  const storage = s.buildings.filter((b) => !b.site && (rules.kinds[b.kind].holds?.accepts === "all" || rules.kinds[b.kind].keeps))
  const toolWorkplaces = s.buildings.filter((b) => !b.site && !b.paused && rules.kinds[b.kind].wear)
  const workingTools = toolWorkplaces.filter((b) => b.stock.tools > 0).length
  const heldTools = s.buildings.reduce((n, b) => n + b.stock.tools, 0)
  if (heldTools < toolWorkplaces.length) findings.push({ code: "working-tool-capital", confidence: "exact", detail: `${toolWorkplaces.length} wearing workplaces need ${toolWorkplaces.length} working tools; only ${heldTools} tools are held across all buildings` })
  const spoil = { ...amounts({}) }
  for (const b of s.buildings.filter((b) => !b.site)) for (const g of goodIds) spoil[g] += spoilExpectation(b.stock[g], g, rules.kinds[b.kind].keeps ?? 1, rules) * 60 / (rules.spoilTicks * rules.stepSeconds)
  const foodDecay = mealRate(severity !== null)
  const meals = s.homes.reduce((n, h) => n + mealsOf(h, rules), 0)
  const clothHomes = s.homes.filter(h => wantsCitizenGoods(h, appealAt(appeal, h.tile.x, h.tile.y), rules)).length
  const needBounds = {
    clothRecipients: clothHomes,
    food: { min: meals * foodDecay * 60 / (rules.home.lasts.food * rules.stepSeconds), frequent: meals * foodDecay * 60 / ((rules.home.lasts.food - refreshLevel("food", rules)) * rules.stepSeconds) },
    cloth: { min: clothHomes * 60 / (rules.home.lasts.cloth * rules.stepSeconds), frequent: clothHomes * 60 / ((rules.home.lasts.cloth - refreshLevel("cloth", rules)) * rules.stepSeconds) },
    citizenCloth: { min: s.homes.filter((h) => h.tier >= 2).length * 60 / (rules.home.lasts.cloth * rules.stepSeconds), frequent: s.homes.filter((h) => h.tier >= 2).length * 60 / ((rules.home.lasts.cloth - refreshLevel("cloth", rules)) * rules.stepSeconds) }
  }
  const net = Object.fromEntries(goodIds.map((g) => [g, supply[g] - inputs[g] - spoil[g]])) as Record<GoodId, number>
  const foodCeiling = supply.fish + supply.smoked + supply.bread - inputs.fish - inputs.smoked - inputs.bread
  if (foodCeiling < needBounds.food.min) findings.push({ code: "food-impossible", confidence: "upper-bound", detail: `Even pooled food capacity ${foodCeiling.toFixed(2)}/min before spoilage is below the no-waste minimum ${needBounds.food.min.toFixed(2)}/min; existing reserves may bridge a finite interval` })
  if (net.cloth < needBounds.cloth.min) findings.push({ code: "cloth-capacity", confidence: "upper-bound", detail: `Cloth capacity ${net.cloth.toFixed(2)}/min cannot keep ${clothHomes} eligible homes supplied` })
  const hall = s.buildings.find((b) => b.kind === "townhall"), hallRoads = hall ? reach(g, doors(g, hall.tile)) : null
  const taxes = s.homes.reduce((sum, h) => sum + (hallRoads && nearest(hallRoads, doors(g, h.tile)) ? taxOf(h, s.policy, rules, appealAt(appeal, h.tile.x, h.tile.y)) : 0), 0)
  const upkeep = s.buildings.filter((b) => !b.site).reduce((sum, b) => sum + rules.kinds[b.kind].upkeep * (b.paused ? rules.pausedUpkeep : 1), 0)
  const parkCost = (s.parks ?? []).reduce((n, p) => n + parkUpkeep(p, rules), 0)
  const collection = baseCollection(taxes, upkeep + parkCost, s.homes.length, rules), cashPerMinute = collection.delta * 60 / (rules.ledgerTicks * rules.stepSeconds)
  const profiles = options.services === false ? [] : s.buildings.flatMap((b) => { const p = serviceProfile(s, b, staff.get(b.id) ?? zero, rules); return p ? [p] : [] })
  const household = s.homes.map((h) => {
    const desirable = appealAt(appeal, h.tile.x, h.tile.y)
    const increments = riskIncrements({ tile: h.tile, house: h, condition: h.condition, desirability: desirable, approval: s.approval,
      heating: severity !== null && rules.winters[severity].heating,
      hotNearby: s.buildings.filter((b) => !b.site && rules.kinds[b.kind].hot && near(b.tile, h.tile, rules.risk.fire.reach)).length,
      dusty: s.buildings.some((b) => !b.site && rules.kinds[b.kind].dusty && near(b.tile, h.tile, rules.risk.health.reach)),
      water: s.land.some((l) => l.type === "water" && Math.abs(l.tile.x - h.tile.x) <= 2 && Math.abs(l.tile.y - h.tile.y) <= 2)
    }, rules)
    const deadline = (service: "fire" | "health" | "order") => service === "health" && h.sick ? null : increments[service] > 0 ? Math.ceil((rules.riskMax - h.meters[service]) / increments[service]) : null
    const eligible = tierFor({ ...h, bread: 1, cloth: 1, faith: 1 }, desirable, h.meters, rules)
    if (h.tier === 1 && eligible === 1) findings.push({ code: "appeal-blocks-citizens", confidence: "exact", detail: `Home #${h.id}: desirability ${desirable} below ${rules.home.tiers[2].appeal}, even with bread, cloth and faith` })
    const goods = profiles.filter((p) => p.service === "goods"), faith = profiles.filter((p) => p.service === "faith")
    return { id: h.id, desirability: desirable, potentialTier: eligible, increments,
      roadConnected: doors(g, h.tile).length > 0, taxConnected: hallRoads !== null && nearest(hallRoads, doors(g, h.tile)) !== null,
      foodMissEstimate: missProbability(goods, h.id, rules.home.lasts.food * rules.stepSeconds / foodDecay),
      faithMissEstimate: missProbability(faith, h.id, rules.home.lasts.faith * rules.stepSeconds),
      unvisitedDisasterSeconds: { fire: deadline("fire"), health: deadline("health"), order: deadline("order") } }
  })
  const citizenHousingCeiling = household.reduce((n, h) => n + (h.desirability >= rules.home.tiers[3].appeal ? rules.home.tiers[3].residents : h.desirability >= rules.home.tiers[2].appeal ? rules.home.tiers[2].residents : 0), 0)
  const requiredCitizensAtPopulationGoal = rules.sizes[s.charter.size].goal.residents * rules.fate.citizens
  if (citizenHousingCeiling < requiredCitizensAtPopulationGoal) findings.push({ code: "citizen-goal-housing-cut", confidence: "upper-bound", detail: `With this frozen neighbourhood even fully supplied citizen/burgher homes hold at most ${citizenHousingCeiling} citizens; the population goal requires at least ${requiredCitizensAtPopulationGoal}` })
  // Carrier time is shared across goods, not a separate full capacity for every commodity.
  const transport = s.buildings.filter((b) => !b.site && !b.paused && rules.kinds[b.kind].carriers).map((b) => {
    const kind = rules.kinds[b.kind], roads = reach(g, doors(g, b.tile)), row = recipes.find((r) => r.id === b.id)
    const destinations = s.buildings.filter((d) => d.id !== b.id && !d.site).flatMap((d) => {
      const found = nearest(roads, doors(g, d.tile)); if (!found) return []
      const target = rules.kinds[d.kind]
      if (row && !(target.recipe?.input === kind.recipe?.output || target.holds?.accepts === "all" || target.holds?.accepts.includes(kind.recipe!.output))) return []
      return [{ id: d.id, kind: d.kind, distance: found.distance }]
    }).sort((a, b) => a.distance - b.distance)
    const nearestTarget = destinations[0]
    const capacity = nearestTarget ? kind.carriers! * rules.transport.load * 60 / Math.max(rules.transport.dispatchTicks * rules.stepSeconds, 2 * nearestTarget.distance * rules.transport.cellSteps * rules.stepSeconds / rules.transport.walk) : 0
    if (row && (rates.get(row.id) ?? 0) > capacity + 1e-8) findings.push({ code: "carrier-cut", confidence: "upper-bound", detail: `${b.kind} #${b.id}: nearest-destination carrier ceiling ${capacity.toFixed(2)}/min is below production ${(rates.get(row.id) ?? 0).toFixed(2)}/min` })
    return { id: b.id, nearestTarget, sharedGoodsPerMinuteCeiling: capacity }
  })
  if (storage.length === 0) findings.push({ code: "no-storage", confidence: "exact", detail: "No completed storage accepts town reserves" })
  return { name: s.name, severity, minutes, elapsedMs: performance.now() - started,
    assumptions: ["Resource flow is a steady-state pooled relaxation; it is an upper bound before household demand and transport cuts.", "Transport ceilings assume full loads and available destinations; shelf balancing and construction can lower realized throughput.", "Service coverage uses the actual deterministic tours; launch timing and unlimited baskets are estimates.", "Risk deadlines freeze hunger, approval, neighbourhood and condition; contagion and fire spread are excluded from these local deadlines."],
    staff: Object.fromEntries(staff), recipes: recipes.map((r) => ({ ...r, flowCeiling: rates.get(r.id)! })),
    supply, workshopDemand: inputs, spoilage: spoil, availableAfterWorkshops: net, needBounds,
    economy: { taxesPerMinute: taxes, upkeepPerMinute: upkeep + parkCost, parkUpkeepPerMinute: parkCost, administrationPerMinute: collection.admin, roundedNetPerMinute: cashPerMinute,
      noTradeRunwayMinutes: cashPerMinute < 0 ? Math.max(0, s.coins) / -cashPerMinute : null },
    currentGoalsWithoutTrade: goalsOf(s.charter, { settlers: s.homes.filter((h) => h.tier === 1).reduce((n, h) => n + h.residents, 0), citizens: s.homes.filter((h) => h.tier >= 2).reduce((n, h) => n + h.residents, 0), coins: s.coins, net: cashPerMinute, approval: s.approval }, rules),
    tools: { wearingWorkplaces: toolWorkplaces.length, equippedWorkplaces: workingTools, held: heldTools },
    repair: { upkeepCycleMinutes: (rules.conditionMax - rules.condition.mend) * rules.condition.every * rules.stepSeconds / 60,
      planksPerMinute: (s.homes.length + s.buildings.filter((b) => b.kind !== "townhall").length) * 60 / ((rules.conditionMax - rules.condition.mend) * rules.condition.every * rules.stepSeconds),
      stonePerMinute: s.buildings.filter((b) => b.kind !== "townhall").length * 60 / ((rules.conditionMax - rules.condition.mend) * rules.condition.every * rules.stepSeconds),
      graceBeforeHalfSpeedSeconds: (rules.condition.mend - rules.condition.worn) * rules.condition.every * rules.stepSeconds },
    citizenGoal: { housingCeilingAtCurrentDesirability: citizenHousingCeiling, minimumAtPopulationGoal: requiredCitizensAtPopulationGoal, scope: "Existing homes and frozen neighbourhood; assumes every need/service could be supplied. Clearing ruins, repairs, new homes or amenities can change this ceiling." },
    household, transport, services: profiles, findings }
}
export type Analysis = ReturnType<typeof analyze>
