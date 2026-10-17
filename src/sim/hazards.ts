import { near, riskIncrements } from "../rules/risks.ts"
/**
 * The neighbourhood and its dangers. Every so often the town's desirability
 * is reckoned cell by cell (`Appraise`). Once a second every home's risk of
 * fire, sickness, and disorder rises, and every building's risk of fire
 * (`Hazards`): the matching service walker resets it (see `Wander`). A
 * risk at the top is a disaster: a fire that burns the home down and may
 * spread, a sickness that thins it out and may spread, a theft, and then a
 * home left derelict. A fire watch sends firefighters running to any blaze
 * (`Douse`): when they arrive, that house is lost but the fire is out.
 */
import * as Random from "@typeonce/bevy-ts-math/Random"

import { appealGrid, appealAt, buildingSource, homeSource, landSource, parkSources, type AppealSource } from "../appeal.ts"
import { ruinDraft } from "../archetypes.ts"
import { goodIds, risk, upgradeAt, type GoodId } from "../content.ts"
import { doors, nearest, pathTo, reach, useAt } from "../grid.ts"
import { counted, placeName, type Landmark } from "../places.ts"
import type { Point } from "../iso.ts"
import { Appeal, Building, Burning, Charter, Chronicle, Condition, Figure, Fires, Game, Rules, Grid, House, Inventory, Mood, Park, Paused, Paved, Rescue, Rising, Risk, Rng, Road, Route, Ruin, Service, Sick, Site, Staff, Storage, Tile, Time, Tree, Treasury, Upgraded, WalkerOf, Water, maybe } from "../schema.ts"
import { elapsed, seasonAt, write } from "./shared.ts"

// ── Desirability ──────────────────────────────────────────────────────────

/** Reckons every cell's desirability, every `appeal.every` steps (and at once when there is none yet). */
export const Appraise = Game.System(
  "Town/Appraise",
  {
    queries: {
      buildings: Game.Query({ selection: { tile: Game.Query.read(Tile), building: Game.Query.read(Building), upgraded: Game.Query.optional(Upgraded) }, without: [Site, Rising] }),
      trees: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Tree] }),
      water: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Water] }),
      paved: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road, Paved] }),
      parks: Game.Query({ selection: { tile: Game.Query.read(Tile), park: Game.Query.read(Park) } }),
      roads: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road] }),
      ruins: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Ruin] }),
      homes: Game.Query({ selection: { tile: Game.Query.read(Tile), condition: Game.Query.read(Condition), house: Game.Query.read(House), closed: Game.Query.optional(Paused) }, without: [Site, Rising] })
    },
    resources: { time: Game.System.readResource(Time), appeal: Game.System.writeResource(Appeal) },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules
    const { appeal, condition: wear } = rules

    if (resources.time.get().tick % appeal.every !== 0 && resources.appeal.get().cells.length > 0) return
    const sources: Array<AppealSource> = []
    for (const { data } of queries.buildings.each()) {
      const s = buildingSource(data.building.get().kind, data.tile.get(), rules, maybe(data.upgraded)?.level ?? 0)
      if (s) sources.push(s)
    }
    for (const { data } of queries.trees.each()) sources.push(landSource("forest", data.tile.get(), rules))
    for (const { data } of queries.water.each()) sources.push(landSource("water", data.tile.get(), rules))
    for (const { data } of queries.paved.each()) sources.push(landSource("paved", data.tile.get(), rules))
    const roads = new Set(queries.roads.each().map(({ data }) => `${data.tile.get().x},${data.tile.get().y}`))
    sources.push(...parkSources(queries.parks.each().map(({ data }) => ({ ...data.tile.get(), ...data.park.get() })), (x, y) => roads.has(`${x},${y}`), rules))
    for (const { data } of queries.ruins.each()) sources.push(landSource("ruin", data.tile.get(), rules))
    for (const { data } of queries.homes.each()) {
      if (data.condition.get().value < wear.worn) sources.push(landSource("worn", data.tile.get(), rules))
      const fine = data.closed.present ? null : homeSource(data.house.get().tier, data.tile.get(), rules)
      if (fine) sources.push(fine)
    }
    resources.appeal.set({ cells: appealGrid(sources, rules) })
  }
)

// ── Risks ─────────────────────────────────────────────────────────────────

/** The risks are reckoned this often (once a second). */
export const RISK_TICKS = 60

export { paceAt } from "../rules/risks.ts"

export const Hazards = Game.System(
  "Town/Hazards",
  {
    queries: {
      cared: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          risk: Game.Query.write(Risk),
          condition: Game.Query.read(Condition),
          house: Game.Query.optional(House),
          building: Game.Query.optional(Building),
          sick: Game.Query.optional(Sick),
          burning: Game.Query.optional(Burning),
          paused: Game.Query.optional(Paused)
        },
        without: [Site, Rising]
      }),
      sickness: Game.Query({ selection: { sick: Game.Query.write(Sick) } }),
      blazes: Game.Query({ selection: { burning: Game.Query.write(Burning) } }),
      landmarks: Game.Query({ selection: { tile: Game.Query.read(Tile), building: Game.Query.read(Building) }, without: [Site, Rising] }),
      watches: Game.Query({
        selection: { tile: Game.Query.read(Tile), service: Game.Query.read(Service), staff: Game.Query.read(Staff), upgraded: Game.Query.optional(Upgraded) },
        without: [Site, Rising, Burning]
      }),
      crews: Game.Query({ selection: { rescue: Game.Query.read(Rescue), home: Game.Query.readRelation(WalkerOf) } }),
      stores: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Storage], without: [Site, Rising] })
    },
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      grid: Game.System.readResource(Grid),
      appeal: Game.System.readResource(Appeal),
      mood: Game.System.readResource(Mood),
      rng: Game.System.writeResource(Rng),
      treasury: Game.System.writeResource(Treasury),
      fires: Game.System.writeResource(Fires),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { kinds, goods, risk, winters, riskMax: RISK_MAX, riskTicks: RISK_TICKS } = rules

    const tick = resources.time.get().tick
    if (tick % RISK_TICKS !== 0) return
    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    const grid = resources.grid.get()
    const cells = resources.appeal.get().cells
    const approval = resources.mood.get().approval
    const season = seasonAt(t, charter, rules)
    const heating = season.severity !== null && winters[season.severity].heating
    const random = Random.make(resources.rng.get())
    const news = (text: string, at: Point | null = null) => write(resources.chronicle, t, text, true, at)
    const landmarks: Array<Landmark> = queries.landmarks.each().map(({ data }) => ({ kind: data.building.get().kind, ...data.tile.get() }))
    const where = (cell: Point) => placeName(landmarks, cell)
    const fires = { ...resources.fires.get(), fires: resources.fires.get().fires.map((f) => ({ ...f })) }

    const rows = queries.cared.each()
    const hot = rows.filter(({ data }) => {
      const b = maybe(data.building)
      return b !== undefined && kinds[b.kind].hot === true && !data.burning.present
    }).map(({ data }) => data.tile.get())
    const dusty = landmarks.filter((l) => kinds[l.kind].dusty)
    const waterNear = (tile: { readonly x: number; readonly y: number }) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (useAt(grid, tile.x + dx, tile.y + dy) === "water") return true
      return false
    }
    const sickNow = rows.filter(({ data }) => data.sick.present).length

    /** Turns a home or building into a ruin. */
    const ruin = (row: (typeof rows)[number], cause: "burnt" | "collapsed" | "derelict") => {
      commands.despawn(row.entity.id)
      commands.spawn(ruinDraft(row.data.tile.get(), cause))
    }
    const lost = new Set<number>()
    const ignited = new Map<number, number>()

    // Rising risks, and what comes of them.
    for (const row of rows) {
      const { data } = row
      if (data.burning.present) continue
      const tile = data.tile.get()
      const h = maybe(data.house)
      // A closed home has nobody in it to fall sick, steal, or knock over a lamp.
      if (h && data.paused.present) continue
      const b = maybe(data.building)
      const r = { ...data.risk.get() }
      const increments = riskIncrements({
        tile, condition: data.condition.get().value, desirability: appealAt(cells, tile.x, tile.y), approval, heating,
        hotNearby: hot.filter((source) => near(source, tile, risk.fire.reach)).length,
        dusty: dusty.some((d) => near(d, tile, risk.health.reach)), water: waterNear(tile),
        ...(h ? { house: h } : {}), ...(b ? { kind: b.kind } : {})
      }, rules)
      if (h) {
        if (!data.sick.present) r.health = Math.min(RISK_MAX, r.health + increments.health)
        r.order = Math.min(RISK_MAX, r.order + increments.order)
      }
      r.fire = Math.min(RISK_MAX, r.fire + increments.fire)

      if (r.fire >= RISK_MAX) {
        // Fire!
        const id = fires.next
        fires.next += 1
        fires.fires.push({ id, x: tile.x, y: tile.y, homes: 0, buildings: 0 })
        commands.insert(row.entity.id, Game.Command.entry(Burning, { left: risk.fire.burns, fire: id }))
        ignited.set(row.entity.id, id)
        r.fire = 0
        news(`Fire on ${where(tile)}!`, tile)
      }
      if (h && r.health >= RISK_MAX && !data.sick.present) {
        commands.insert(row.entity.id, Game.Command.entry(Sick, { left: risk.health.lasts }))
        r.health = 0
        if (sickNow === 0) news(`Sickness on ${where(tile)}: a physician can cure it.`, tile)
      }
      if (h && r.order >= RISK_MAX) {
        if (r.thefts === 0) {
          // A theft: coins from the treasury, or goods from storage when it is empty.
          const coins = resources.treasury.get().coins
          const take = Math.min(risk.order.most, Math.max(0, coins), risk.order.coins + Math.floor(Math.max(0, coins) * risk.order.share))
          if (take > 0) {
            resources.treasury.set({ coins: coins - take })
            news(`Thieves on ${where(tile)} made off with ${take} coins.`, tile)
          } else {
            const stores = queries.stores.each()
            const held = (g: GoodId) => stores.reduce((n, s) => n + s.data.inventory.get().stock[g], 0)
            const good = [...goodIds].sort((a, b) => held(b) * goods[b].price - held(a) * goods[a].price)[0]!
            let owed = Math.min(risk.order.goods, held(good))
            for (const { data: s } of stores) {
              if (owed <= 0) break
              const inv = s.inventory.get()
              const n = Math.min(owed, inv.stock[good])
              s.inventory.set({ ...inv, stock: { ...inv.stock, [good]: inv.stock[good] - n } })
              owed -= n
            }
            if (held(good) > 0) news(`Thieves on ${where(tile)} made off with ${goods[good].title}.`, tile)
          }
          r.thefts += 1
          r.order = risk.order.after
        } else {
          news(`A home on ${where(tile)} stood empty after its thefts, and is left derelict.`, tile)
          ruin(row, "derelict")
          lost.add(row.entity.id)
          continue
        }
      }
      data.risk.set(r)
    }

    // Sickness runs its course, and spreads to homes close by.
    const homeRows = rows.filter(({ entity, data }) => data.house.present && !data.burning.present && !lost.has(entity.id))
    for (const { entity, data } of queries.sickness.each()) {
      const s = data.sick.get()
      const left = s.left - RISK_TICKS
      if (left <= 0) {
        commands.remove(entity.id, Sick)
        continue
      }
      data.sick.set({ left })
      if (random.next() >= risk.health.spreads) continue
      const me = rows.find((row) => row.entity.id === entity.id)
      if (!me) continue
      const at = me.data.tile.get()
      const target = random.pick(homeRows.filter(({ entity: e, data: d }) => e.id !== entity.id && !d.sick.present && near(d.tile.get(), at, 2)))
      if (target) {
        const r = target.data.risk.get()
        target.data.risk.set({ ...r, health: Math.min(RISK_MAX, r.health + risk.health.contagion) })
      }
    }

    // Fires burn down what they hold, and catch what stands beside them.
    const byId = new Map(rows.map((row) => [row.entity.id as number, row]))
    for (const { entity, data } of queries.blazes.each()) {
      const b = data.burning.get()
      const row = byId.get(entity.id)
      if (!row) continue
      const fire = fires.fires.find((f) => f.id === b.fire)
      const left = b.left - RISK_TICKS
      if (left <= 0) {
        ruin(row, "burnt")
        lost.add(entity.id)
        if (fire) {
          if (row.data.house.present) fire.homes += 1
          else fire.buildings += 1
        }
        continue
      }
      data.burning.set({ ...b, left })
      const tile = row.data.tile.get()
      const neighbour = random.pick(rows.filter(({ entity: e, data: d }) => e.id !== entity.id && !d.burning.present && !ignited.has(e.id) && !lost.has(e.id) && near(d.tile.get(), tile, 1)))
      if (!neighbour) continue
      const chance = risk.fire.catches + (risk.fire.spread * neighbour.data.risk.get().fire) / RISK_MAX
      if (random.next() < chance) {
        commands.insert(neighbour.entity.id, Game.Command.entry(Burning, { left: risk.fire.burns, fire: b.fire }))
        ignited.set(neighbour.entity.id, b.fire)
      }
    }

    // Firefighters run from the nearest fire watch to every blaze no one is running to.
    const out = new Map<number, number>()
    const crewed = new Set<number>()
    for (const { data } of queries.crews.each()) {
      out.set(data.home.get(), (out.get(data.home.get()) ?? 0) + 1)
      if (!data.rescue.get().back) crewed.add(data.rescue.get().target)
    }
    const watches = queries.watches.each().filter(({ data }) => data.service.get().service === "fire" && data.staff.get().assigned > 0)
    const burningNow = [...queries.blazes.each().map(({ entity }) => entity.id as number), ...ignited.keys()].filter((id) => !lost.has(id))
    for (const id of burningNow) {
      if (crewed.has(id)) continue
      const target = byId.get(id)
      if (!target) continue
      const goal = doors(grid, target.data.tile.get())
      let best: { readonly watch: (typeof watches)[number]; readonly roads: ReturnType<typeof reach>; readonly cell: Point; readonly distance: number } | null = null
      for (const watch of watches) {
        // A fire brigade sends more (see `Upgrade.crews`).
        const crews = upgradeAt(kinds.firewatch, maybe(watch.data.upgraded)?.level ?? 0)?.crews ?? risk.fire.crews
        if ((out.get(watch.entity.id) ?? 0) >= crews) continue
        const starts = doors(grid, watch.data.tile.get())
        if (starts.length === 0) continue
        const roads = reach(grid, starts)
        const found = nearest(roads, goal)
        if (found && (best === null || found.distance < best.distance)) best = { watch, roads, ...found }
      }
      if (!best) continue
      const draft = Game.Command.spawn(
        [Figure, { role: "walker", color: 0xc4523f }],
        [Route, { cells: pathTo(best.roads, best.cell), index: 0, step: 0 }],
        [Rescue, { target: Game.Entity.handle(target.entity.id, Tile), back: false }]
      )
      commands.spawn(Game.Command.relate(draft, WalkerOf, best.watch.entity.id))
      out.set(best.watch.entity.id, (out.get(best.watch.entity.id) ?? 0) + 1)
    }

    // A fire with nothing left burning is over: the news says what it took.
    const stillBurning = new Set<number>()
    for (const { entity, data } of queries.blazes.each()) if (!lost.has(entity.id)) stillBurning.add(data.burning.get().fire)
    for (const f of ignited.values()) stillBurning.add(f)
    const over = fires.fires.filter((f) => !stillBurning.has(f.id))
    for (const f of over) {
      const took = [f.homes > 0 ? counted(f.homes, "home") : "", f.buildings > 0 ? counted(f.buildings, "building") : ""].filter((s) => s !== "")
      news(`Fire on ${where(f)}: ${took.length > 0 ? `${took.join(" and ")} lost` : "put out"}.`, { x: f.x, y: f.y })
    }
    resources.fires.set({ fires: fires.fires.filter((f) => stillBurning.has(f.id)), next: fires.next })
    resources.rng.set(random.state)
  }
)

const BurningRead = Game.Query({ selection: { tile: Game.Query.read(Tile), burning: Game.Query.read(Burning), house: Game.Query.optional(House) } })

/**
 * A firefighter at the blaze puts it out: the house is lost, but the fire
 * goes no further. Then the firefighter walks back to the watch.
 */
export const Douse = Game.System(
  "Town/Douse",
  {
    queries: { crews: Game.Query({ selection: { route: Game.Query.write(Route), rescue: Game.Query.write(Rescue) } }), burning: BurningRead },
    resources: { fires: Game.System.writeResource(Fires) }
  },
  ({ queries, resources, commands }) => {
    for (const { entity, data } of queries.crews.each()) {
      const route = data.route.get()
      const rescue = data.rescue.get()
      const arrived = route.index >= route.cells.length - 1
      if (!arrived) continue
      if (rescue.back) {
        commands.despawn(entity.id)
        continue
      }
      const target = queries.burning.getHandle(rescue.target)
      if (target.ok) {
        const b = target.value.data.burning.get()
        commands.despawn(target.value.entity.id)
        commands.spawn(ruinDraft(target.value.data.tile.get(), "burnt"))
        const house = target.value.data.house.present
        resources.fires.update((f) => ({
          ...f,
          fires: f.fires.map((x) => (x.id === b.fire ? { ...x, homes: x.homes + (house ? 1 : 0), buildings: x.buildings + (house ? 0 : 1) } : x))
        }))
      }
      data.route.set({ cells: [...route.cells].reverse(), index: 0, step: 0 })
      data.rescue.set({ ...rescue, back: true })
    }
  }
)
