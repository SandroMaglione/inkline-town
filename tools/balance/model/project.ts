import { amounts, goodIds, type Amounts } from "../../../src/content.ts"
import { parkUpkeep } from "../../../src/appeal.ts"
import { ruleTicks } from "../../../src/rules/config.ts"
import { baseCollection, capacity, mealRate, rateOf, serveGoods, shortOf, taxOf, tierFor } from "../../../src/rules/households.ts"
import { seasonAt } from "../../../src/rules/seasons.ts"
import { spoilExpectation } from "../../../src/rules/decay.ts"
import { tradeCollection } from "../../../src/rules/trade.ts"
import { approvalTarget, nextApproval } from "../../../src/rules/approval.ts"
import { analyze } from "./analyze.ts"
import { around, cellsOf, key, ownerAt } from "../../../src/grid.ts"
import { scenarioGrid } from "../scenario.ts"
import type { Inputs, BuildingAction, ModelBuilding, ProjectionOptions, Scenario } from "../types.ts"

/** Rate-based forecast with explicit temporal assumptions. It never calls the game runtime. */
export const project = ({ rules, scenario }: Inputs, options: ProjectionOptions) => {
  const step = options.stepSeconds ?? 1
  if (!Number.isInteger(step) || step < 1 || step > 3 || !Number.isInteger(options.seconds) || options.seconds <= 0) throw new Error("Projection requires a 1..3 second step and a positive integer horizon")
  const stock = { ...amounts({}) }
  for (const b of scenario.buildings) if (!b.site) for (const g of goodIds) stock[g] += b.stock[g]
  let parks = [...scenario.parks ?? []]
  let homes = scenario.homes.map((h) => ({ ...h, meters: { ...h.meters } })), buildings = [...scenario.buildings], coins = scenario.coins, approval = scenario.approval
  /** The finest tier each home has been rebuilt for (see `Rebuilt`): a home already finer is taken as paid for. */
  const rebuilt = new Map(homes.map((h) => [h.id, h.tier as number]))
  const events: Array<{ second: number; type: string; detail: string }> = [], rows: Array<{ second: number; coins: number; residents: number; citizens: number; approval: number; stock: Amounts }> = []
  const builds = [...options.builds ?? []].sort((a, b) => a.at - b.at), crown = [...options.crown ?? []].sort((a, b) => a.at - b.at)
  const pending: Array<{ ready: number; action: BuildingAction }> = []
  let nextId = Math.max(0, ...homes.map((h) => h.id), ...buildings.map((b) => b.id)) + 1
  let analysis = analyze({ rules, scenario }, { services: true }), cachedKey = "", firstCitizen: number | null = null
  let prices = scenario.trade?.prices ?? amounts(Object.fromEntries(goodIds.map((g) => [g, 100])))
  const snubs: number[] = []
  const land = scenario.land.map((l) => ({ ...l, remaining: l.type === "stone" || l.type === "ore" ? l.amount : 1 }))
  const fields = new Map<number, { credit: number; slots: number; planting: number; growing: Array<{ left: number; credit: number }> }>()
  const crop = (b: ModelBuilding) => {
    let state = fields.get(b.id)
    if (!state) {
      const grid = scenarioGrid({ ...scenario, buildings, homes, parks }, rules).value()
      const k = rules.kinds[b.kind], ids = new Set(around(b.tile, k.gathers!.radius).map((p) => ownerAt(grid, p.x, p.y)))
      const existing = scenario.land.filter((l, i) => l.type === "field" && ids.has(-1 - i))
      state = { credit: existing.filter((l) => l.growth >= rules.grown.field).length, slots: existing.length, planting: 0,
        growing: existing.filter((l) => l.growth < rules.grown.field).map((l) => ({ left: (rules.grown.field - l.growth) * rules.stepSeconds, credit: 1 })) }
      fields.set(b.id, state)
    }
    return state
  }
  const goodsPeriods = new Map<number, number>(), faithPeriods = new Map<number, number>()
  const updatePeriods = () => {
    for (const h of homes) {
      const visitRate = (type: string) => analysis.services.filter((p) => p.service === type).reduce((n, p) => n + (p.contacts.find((c) => c.target === h.id)?.visitsPerMinute ?? 0), 0)
      const goods = visitRate("goods"), faith = visitRate("faith")
      goodsPeriods.set(h.id, options.visitSeconds ?? (goods > 0 ? Math.max(1, Math.round(60 / goods)) : Infinity))
      faithPeriods.set(h.id, options.faith === true ? options.visitSeconds ?? 20 : faith > 0 ? Math.max(1, Math.round(60 / faith)) : Infinity)
    }
  }
  updatePeriods()
  for (let second = 0; second <= options.seconds; second += step) {
    if (second % 60 === 0 || second === options.seconds) rows.push({ second, coins, residents: homes.reduce((n, h) => n + h.residents, 0), citizens: homes.filter((h) => h.tier >= 2).reduce((n, h) => n + h.residents, 0), approval, stock: { ...stock } })
    if (second === options.seconds) break
    const tick = scenario.tick + ruleTicks(second, rules), season = seasonAt(tick, scenario.charter, rules)
    while (builds.length > 0 && builds[0]!.at <= second) {
      const action = builds.shift()!
      const piece = action.kind === "ground" ? rules.grounds[action.ground] : action.kind === "prop" ? rules.props[action.prop] : null
      const k = action.kind === "home" || action.kind === "ground" || action.kind === "prop" ? null : rules.kinds[action.kind]
      const cost = piece?.cost ?? k?.cost ?? rules.home.cost
      if (k?.plants?.what === "field") {
        const plantingCells = new Set(around(action.tile, k.plants.radius).map((p) => key(p.x, p.y)))
        for (const future of builds) if (cellsOf(future.tile).some((p) => plantingCells.has(key(p.x, p.y)))) events.push({ second, type: "crop-placement-risk", detail: `${future.kind}'s future plot is inside ${action.kind}'s planting area; construct it first or clear fields later` })
      }
      const people = homes.reduce((n, h) => n + h.residents, 0), citizens = homes.filter((h) => h.tier >= 2).reduce((n, h) => n + h.residents, 0)
      const equipped = buildings.filter((b) => rules.kinds[b.kind].wear && b.stock.tools > 0).length
      if (((k || piece) && (people < (k ?? piece)!.unlock.residents || citizens < (k ?? piece)!.unlock.citizens)) || coins < cost.coins || Object.entries(cost.materials).some(([g, n]) => stock[g as keyof Amounts] - (g === "tools" ? equipped : 0) < n!)) {
        events.push({ second, type: "build-blocked", detail: `${action.kind}: unlock, coins or materials unavailable` }); continue
      }
      if (action.kind === "prop" && !parks.some((p) => p.x === action.tile.x && p.y === action.tile.y)) {
        events.push({ second, type: "build-blocked", detail: "A furnishing needs a park cell" }); continue
      }
      coins -= cost.coins
      for (const [g, n] of Object.entries(cost.materials)) stock[g as keyof Amounts] -= n!
      if (action.kind === "ground") {
        const cell = parks.find((p) => p.x === action.tile.x && p.y === action.tile.y)
        if (cell) parks = parks.map((p) => p === cell ? { ...p, ground: action.ground } : p)
        else parks.push({ x: action.tile.x, y: action.tile.y, ground: action.ground, prop: "none" })
      } else if (action.kind === "prop") parks = parks.map((p) => p.x === action.tile.x && p.y === action.tile.y ? { ...p, prop: action.prop } : p)
      else pending.push({ ready: second + rules.buildTicks * rules.stepSeconds, action })
      events.push({ second, type: "build-paid", detail: `${action.kind}: ${cost.coins} coins` })
    }
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i]!
      if (p.ready > second) continue
      const id = nextId++
      if (p.action.kind === "home") homes.push({ id, tile: p.action.tile, tier: 1, residents: 0, clock: 0, food: 0, bread: 0, cloth: 0, faith: 0, furniture: 0, condition: rules.conditionMax, meters: { fire: 0, health: 0, order: 0 } })
      else buildings.push({ id, kind: p.action.kind, tile: p.action.tile, paused: false, site: false, condition: rules.conditionMax, stock: amounts({}) })
      pending.splice(i, 1)
    }
    let toolSlots = Math.floor(stock.tools)
    buildings = buildings.map((b) => rules.kinds[b.kind].wear ? { ...b, stock: { ...b.stock, tools: toolSlots-- > 0 ? 1 : 0 } } : b)
    const stateKey = JSON.stringify([homes.map((h) => [h.id, h.tier, h.residents]), buildings.map((b) => [b.id, b.stock.tools, b.condition < rules.condition.worn]), season.severity, parks])
    if (stateKey !== cachedKey) {
      const current: Scenario = { ...scenario, tick, coins, approval, homes, buildings, parks }
      analysis = analyze({ rules, scenario: current }, { minutes: Math.max(1 / 60, (options.seconds - second) / 60), services: true })
      updatePeriods()
      cachedKey = stateKey
    }
    const share = Math.min(step, options.seconds - second) / 60
    // Sources first, then workshops. This is an optimistic pool, explicitly not the live dispatcher.
    const recipeRows = [...analysis.recipes].sort((a, b) => Number(rules.kinds[a.kind].recipe!.input !== null) - Number(rules.kinds[b.kind].recipe!.input !== null))
    for (const row of recipeRows) {
      const k = rules.kinds[row.kind], r = k.recipe!, transport = analysis.transport.find((t) => t.id === row.id)?.sharedGoodsPerMinuteCeiling ?? Infinity
      let jobs = Math.min(row.capacity.outputPerMinute, transport) * share / r.batch
      if (r.input) jobs = Math.min(jobs, stock[r.input] / Math.max(1, r.inputs))
      if (k.gathers?.source === "water") jobs = Math.min(jobs, (row.sourceCeiling ?? Infinity) * share)
      if (k.gathers?.source === "field") {
        const b = buildings.find((b) => b.id === row.id)!, state = crop(b)
        if (!season.winter) {
          state.planting += step
          while (state.slots < k.plants!.max && state.planting >= k.plants!.seconds) { state.planting -= k.plants!.seconds; state.slots += 1; state.growing.push({ left: rules.grown.field * rules.stepSeconds, credit: 1 }) }
          for (let i = state.growing.length - 1; i >= 0; i--) { const q = state.growing[i]!; q.left -= step; if (q.left <= 0) { state.credit += q.credit; state.growing.splice(i, 1) } }
        }
        jobs = Math.min(jobs, state.credit); state.credit -= jobs
        if (jobs > 0) state.growing.push({ left: rules.grown.field * rules.stepSeconds, credit: jobs })
      } else if (k.gathers && k.gathers.source !== "water") {
        const b = buildings.find((b) => b.id === row.id)!, grid = scenarioGrid({ ...scenario, buildings, homes, parks }, rules).value()
        const ids = new Set(around(b.tile, k.gathers.radius).map((p) => ownerAt(grid, p.x, p.y)))
        const sources = land.filter((l, i) => ids.has(-1 - i) && l.type === k.gathers!.source && (l.type !== "tree" || l.growth >= rules.grown.tree))
        jobs = Math.min(jobs, sources.reduce((n, l) => n + l.remaining, 0))
        let take = jobs
        for (const l of sources) { const n = Math.min(take, l.remaining); l.remaining -= n; take -= n }
      }
      if (r.input) stock[r.input] -= jobs * r.inputs
      stock[r.output] += jobs * r.batch
      if (k.wear) stock.tools = Math.max(0, stock.tools - jobs / k.wear)
    }
    for (const g of goodIds) stock[g] = Math.max(0, stock[g] + ((scenario.imports?.[g] ?? 0) - (scenario.exports?.[g] ?? 0)) * share)
    for (const l of land) if (l.type === "tree") l.growth += ruleTicks(step, rules)
    const oldTiers = homes.map((h) => h.tier)
    homes = homes.map((h) => {
      let next = { ...h, meters: { ...h.meters } }
      const goods = goodsPeriods.get(h.id) ?? Infinity, faith = faithPeriods.get(h.id) ?? Infinity
      if (Number.isFinite(goods) && Math.floor(second / goods) !== Math.floor((second + step) / goods)) {
        const basket = Object.fromEntries(goodIds.map((g) => [g, Math.max(0, Math.floor(stock[g]))])) as Record<keyof Amounts, number>
        if (options.feeding === "fish") basket.bread = 0
        const served = serveGoods(next, basket, rules, analysis.household.find(a => a.id === h.id)?.desirability ?? 0)
        for (const g of goodIds) stock[g] -= basket[g] - served.basket[g]
        next = { ...served.house }
      }
      if (Number.isFinite(faith) && Math.floor(second / faith) !== Math.floor((second + step) / faith)) next.faith = rules.home.lasts.faith
      const dt = ruleTicks(step, rules), eat = dt * mealRate(season.winter)
      next.clock += dt; next.food = Math.max(0, next.food - eat); next.bread = Math.max(0, next.bread - eat); next.cloth = Math.max(0, next.cloth - dt); next.faith = Math.max(0, next.faith - dt)
      const settleCount = Math.floor(next.clock / rules.home.settle) - Math.floor(h.clock / rules.home.settle)
      const appeal = analysis.household.find((a) => a.id === h.id)?.desirability ?? 0
      for (let n = 0; n < settleCount; n++) {
        const tier = tierFor(next, appeal, next.meters, rules), rise = rules.home.tiers[tier].rise
        // A rise is paid at once from the treasury and the store, once, as in the game; unpaid, the home waits.
        if (tier <= next.tier || tier <= (rebuilt.get(h.id) ?? 1)) next.tier = tier
        else if (shortOf(rise, coins, stock) === null) {
          coins -= rise.coins
          for (const [g, n] of Object.entries(rise.materials) as Array<[keyof Amounts, number]>) stock[g] -= n
          next.tier = tier
          rebuilt.set(h.id, tier)
        }
        const cap = analysis.household.find((a) => a.id === h.id)?.roadConnected ? capacity(next, approval, appeal, rules, rateOf(scenario.policy, next.tier)) : 0
        next.residents = Math.min(next.residents, rules.home.tiers[next.tier].residents)
        next.residents += Math.sign(cap - next.residents)
      }
      next.condition = Math.max(0, h.condition - step / (rules.condition.every * rules.stepSeconds))
      return next
    })
    if (firstCitizen === null && homes.some((h) => h.tier >= 2 && h.residents > 0)) firstCitizen = second + step
    for (let i = 0; i < homes.length; i++) if (homes[i]!.tier !== oldTiers[i]) events.push({ second: second + step, type: "tier", detail: `Home #${homes[i]!.id}: ${oldTiers[i]} → ${homes[i]!.tier}` })
    buildings = buildings.map((b) => ({ ...b, condition: b.kind === "townhall" ? b.condition : Math.max(0, b.condition - step / (rules.condition.every * rules.stepSeconds)) }))
    const elapsed = second + step
    if (Math.floor(elapsed / (rules.spoilTicks * rules.stepSeconds)) > Math.floor(second / (rules.spoilTicks * rules.stepSeconds))) {
      const keeps = buildings.some((b) => rules.kinds[b.kind].keeps) ? Math.max(...buildings.map((b) => rules.kinds[b.kind].keeps ?? 1)) : 1
      for (const g of goodIds) stock[g] = Math.max(0, stock[g] - spoilExpectation(stock[g], g, keeps, rules))
    }
    if (Math.floor(elapsed / (rules.ledgerTicks * rules.stepSeconds)) > Math.floor(second / (rules.ledgerTicks * rules.stepSeconds))) {
      const tax = homes.reduce((n, h) => { const a = analysis.household.find((a) => a.id === h.id); return n + (a?.taxConnected ? taxOf(h, scenario.policy, rules, a.desirability) : 0) }, 0), upkeep = buildings.reduce((n, b) => n + rules.kinds[b.kind].upkeep * (b.paused ? rules.pausedUpkeep : 1), 0)
      const parkCost = parks.reduce((n, p) => n + parkUpkeep(p, rules), 0)
      coins += baseCollection(tax, upkeep + parkCost, homes.reduce((n, h) => n + h.residents, 0), rules).delta
      if (scenario.trade) {
        const equipped = buildings.filter((b) => rules.kinds[b.kind].wear && b.stock.tools > 0).length
        const left = { ...stock, tools: Math.max(0, stock.tools - equipped) }, stores = buildings.filter((b) => rules.kinds[b.kind].holds?.accepts === "all" || rules.kinds[b.kind].keeps).map((b) => {
          const holds = rules.kinds[b.kind].holds!, accepts = holds.accepts === "all" ? goodIds : holds.accepts
          const stored = amounts(Object.fromEntries(goodIds.map((g) => { const n = accepts.includes(g) ? Math.max(0, Math.min(holds.cap, Math.floor(left[g]))) : 0; left[g] -= n; return [g, n] })))
          return { cap: holds.cap, accepts, stock: stored }
        })
        const traded = tradeCollection(stores, scenario.trade, prices, coins, rules)
        for (const g of goodIds) stock[g] += traded.stores.reduce((n, s) => n + s.stock[g], 0) - stores.reduce((n, s) => n + s.stock[g], 0)
        coins = traded.coins; prices = traded.prices
      }
      const recentSnubs = snubs.filter((at) => elapsed - at < rules.crown.memory * 60).length
      approval = nextApproval(approval, approvalTarget(homes, scenario.policy, coins, recentSnubs, season.winter, rules).target, rules)
    }
    while (crown.length > 0 && crown[0]!.at <= elapsed) {
      const c = crown.shift()!, met = stock[c.good] >= c.amount
      if (met) { stock[c.good] -= c.amount; coins += c.reward } else { coins -= c.fine; snubs.push(elapsed) }
      events.push({ second: elapsed, type: "crown", detail: `${c.good}: ${met ? "delivered" : "missed"}` })
    }
  }
  return { name: scenario.name, firstCitizenSecond: firstCitizen, rows, events,
    assumptions: ["One-second pooled rate model; integer recipe phases and local storage are approximated.", "Contacts use periodic mean visits from planned tours unless explicitly supplied; faith has no goods cost. Basket depletion and actual launch gaps can lower coverage.", "Construction spends materials at placement and ignores carrier latency; completion is optimistic.", "Granary protection and tool availability are pooled; source accessibility is frozen between analysis updates.", "Market prices and collection rules are shared; shelf allocation is pooled and optimistic. No disaster losses, repair recovery or victory classification are predicted. Explicit imports/exports and crown events are scenario conditions."] }
}
