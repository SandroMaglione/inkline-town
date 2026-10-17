/**
 * The player's edits, applied at the start of a step: building, laying
 * roads and homes, laying out parks, bulldozing, pausing, the town's policy, answering the
 * crown, and founding a new town. Costs are checked against the treasury
 * and the town's stock and paid up front in coins; the materials are
 * carried to the site afterwards. Upgrading a building is paid at once.
 * Once the term has ended, only a new town, or another term, is taken.
 */
import { BuildingParts, buildingDraft, houseDraft, HouseParts, houseStart, ParkParts, parkDraft, RoadParts, roadDraft, RockParts, rockDraft, RoleParts, rolesOf, StartParts, startOf, TreeParts, treeDraft, WaterParts, waterDraft } from "../archetypes.ts"
import * as Random from "@typeonce/ritmo-math/Random"
import { amounts, anA, builtCost, costText, goodIds, nextUpgrade, RESERVE_MAX, TAX_STEPS, stepsOf, total, upgradeAt, type Amounts, type Kind, type ParkPiece, type Upgrade } from "../content.ts"
import { canPlace, cellsOf, GridBuilder, ownerAt, useAt } from "../grid.ts"
import { inside } from "../iso.ts"
import { generate } from "../mapgen.ts"
import { Appeal, Building, Tile, Census, Charter, Chronicle, Crown, Fate, Fires, Game, Guide, Rules, History, House, Inventory, Land, Ledger, Market, maybe, Mood, Pantry, Park, Paved, Paused, Policy, Rising, Rng, Rock, Service, Site, Status, Stock, Storage, Time, TownHall, Toast, Treasury, Upgraded, Works, Edits, Selection } from "../schema.ts"
import { salvageOf, salvageText, withWorks } from "../rules/salvage.ts"
import { elapsed, rollWinters, termTicks, TileRead, useOf, write } from "./shared.ts"
import type { Rules as RuleInputs } from "../rules/config.ts"
import { crownGap, foundedFate } from "./term.ts"

export const unlocked = (kind: Pick<Kind, "unlock"> | ParkPiece, census: { readonly settlers: number; readonly citizens: number }) =>
  census.settlers + census.citizens >= kind.unlock.residents && census.citizens >= kind.unlock.citizens
/** What a town still lacks before it can build `kind`, or `null` when it can. */
export const lockReason = (kind: Pick<Kind, "unlock"> | ParkPiece, census: { readonly settlers: number; readonly citizens: number }): string | null => {
  const residents = census.settlers + census.citizens
  if (residents < kind.unlock.residents) return `needs ${kind.unlock.residents} residents (the town has ${residents})`
  if (census.citizens < kind.unlock.citizens) return `needs ${kind.unlock.citizens} citizens (the town has ${census.citizens})`
  return null
}

/** What keeps a town from an upgrade now, or `null` when nothing does. */
export const upgradeBlock = (up: Pick<Upgrade, "rank">, rank: number, rules: Pick<RuleInputs, "ranks">): string | null =>
  rank >= up.rank ? null : `needs the town to be a ${rules.ranks[up.rank]!.title}`

/** Samples of history a long reign keeps in full detail before it thins the older half. */
const HISTORY_KEPT = 1200

export const ApplyEdits = Game.System(
  "Town/ApplyEdits",
  {
    queries: {
      tiles: TileRead,
      paved: Game.Query({ selection: { paved: Game.Query.read(Paved) } }),
      parks: Game.Query({ selection: { park: Game.Query.write(Park) } }),
      halls: Game.Query({ selection: { hall: Game.Query.read(TownHall) } }),
      /** Whatever was built at a cost, standing or a site: what pulling it down gives back. */
      built: Game.Query({
        selection: { building: Game.Query.optional(Building), house: Game.Query.optional(House), site: Game.Query.optional(Site), paused: Game.Query.optional(Paused), upgraded: Game.Query.optional(Upgraded), works: Game.Query.optional(Works) }
      }),
      stores: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Storage] }),
      rocks: Game.Query({ selection: { rock: Game.Query.read(Rock) } }),
      upgradable: Game.Query({
        selection: {
          building: Game.Query.read(Building),
          service: Game.Query.optional(Service),
          upgraded: Game.Query.optional(Upgraded),
          works: Game.Query.optional(Works),
          site: Game.Query.optional(Site),
          rising: Game.Query.optional(Rising)
        }
      })
    },
    resources: {
      time: Game.System.readResource(Time),
      treasury: Game.System.writeResource(Treasury),
      ledger: Game.System.writeResource(Ledger),
      policy: Game.System.writeResource(Policy),
      rng: Game.System.writeResource(Rng),
      stock: Game.System.readResource(Stock),
      census: Game.System.readResource(Census),
      charter: Game.System.writeResource(Charter),
      land: Game.System.writeResource(Land),
      market: Game.System.writeResource(Market),
      mood: Game.System.writeResource(Mood),
      crown: Game.System.writeResource(Crown),
      fate: Game.System.writeResource(Fate),
      history: Game.System.writeResource(History),
      chronicle: Game.System.writeResource(Chronicle),
      guide: Game.System.writeResource(Guide),
      appeal: Game.System.writeResource(Appeal),
      pantry: Game.System.writeResource(Pantry),
      fires: Game.System.writeResource(Fires)
    },
    events: { toast: Game.System.writeEvent(Toast), selection: Game.System.writeEvent(Selection) },
    services: { edits: Game.System.service(Edits), rules: Game.System.service(Rules) },
    commands: Game.System.commands(
      Game.System.spawns(...BuildingParts, ...HouseParts, ...RoadParts, ...ParkParts, ...WaterParts, ...TreeParts, ...RockParts),
      Game.System.inserts(...StartParts, ...RoleParts, Paved, Paused, Works, TownHall, Status, Inventory),
      Game.System.removes(Paused),
      Game.System.despawns(Tile)
    )
  },
  ({ queries, resources, events, services, commands }) => {
    const rules = services.rules
    const { kinds, home, goods, grounds, props, lands, sizes, trade, roadCost: ROAD_COST, paveCost: PAVE_COST } = rules

    const queued = services.edits.snapshot()
    if (queued.length === 0) return
    const grid = new GridBuilder(resources.land.get().mask)
    const rows = queries.tiles.each()
    type Id = (typeof rows)[number]["entity"]["id"]
    const entities = new Map<number, Id>()
    for (const { entity, data } of rows) {
      grid.claim(data.tile.get(), entity.id, useOf(data))
      entities.set(entity.id, entity.id)
    }
    const halls = new Set<number>(queries.halls.each().map((row) => row.entity.id))
    let coins = resources.treasury.get().coins
    // Works begun in this step: they are in the world only once it ends, so a second click on the same building is refused here.
    const begun = new Set<number>()
    // What is left to spend this step: placing several things at once draws on the same stock.
    const left: Record<string, number> = { ...resources.stock.get() }

    const afford = (cost: Kind["cost"]): string | null => {
      if (coins < cost.coins) return "Not enough coins"
      for (const [g, n] of Object.entries(cost.materials)) if ((left[g] ?? 0) < (n ?? 0)) return `Not enough ${g}`
      return null
    }
    const pay = (cost: Kind["cost"]) => {
      coins -= cost.coins
      for (const [g, n] of Object.entries(cost.materials)) left[g] = (left[g] ?? 0) - (n ?? 0)
    }
    /** Takes goods out of storage at once, fullest first. */
    const take = (materials: Partial<Record<string, number>>) => {
      for (const [g, n] of Object.entries(materials) as Array<[keyof Amounts, number]>) {
        let owed = n
        for (const { data } of [...queries.stores.each()].sort((a, b) => b.data.inventory.get().stock[g] - a.data.inventory.get().stock[g])) {
          if (owed <= 0) break
          const inv = data.inventory.get()
          const n = Math.min(owed, inv.stock[g])
          data.inventory.set({ ...inv, stock: { ...inv.stock, [g]: inv.stock[g] - n } })
          owed -= n
        }
      }
    }
    /** Puts goods into storage at once, where there is most room; returns how many found none. */
    const stash = (materials: Partial<Record<string, number>>) => {
      let lost = 0
      for (const [g, n] of Object.entries(materials) as Array<[keyof Amounts, number]>) {
        let owed = n
        for (const { data } of [...queries.stores.each()].sort((a, b) => a.data.inventory.get().stock[g] - b.data.inventory.get().stock[g])) {
          if (owed <= 0) break
          const inv = data.inventory.get()
          const k = Math.max(0, Math.min(owed, inv.cap - inv.stock[g]))
          if (k > 0) data.inventory.set({ ...inv, stock: { ...inv.stock, [g]: inv.stock[g] + k } })
          left[g] = (left[g] ?? 0) + k
          owed -= k
        }
        lost += owed
      }
      return lost
    }
    /** Fells the trees under a tile about to be built on. */
    const fell = (tile: { x: number; y: number; size: number }) => {
      for (const c of cellsOf(tile)) {
        if (useAt(grid.value(), c.x, c.y) !== "tree") continue
        const tree = entities.get(ownerAt(grid.value(), c.x, c.y))
        const row = tree === undefined ? undefined : queries.tiles.get(tree)
        if (row?.ok) commands.despawn(row.value.entity)
      }
    }
    /**
     * What this run queued, by id, with how to take it back: no query matches it
     * before the next `applyDeferred()`, so pulling it down (or a new town) in
     * the same step despawns it through the id `spawn` returned.
     */
    const queuedHere = new Map<number, () => void>()
    /** Fells what stands on `tile`, spawns what `make` queues there, and claims the tile for it. */
    const place = <Spawned extends Id>(tile: { x: number; y: number; size: number }, use: "building" | "house" | "road" | "park", make: () => Spawned): Spawned => {
      fell(tile)
      const id = make()
      grid.claim(tile, id, use)
      entities.set(id, id)
      return id
    }

    const playing = () => resources.fate.get().state === "playing"
    const t = elapsed(resources.time.get(), resources.charter.get())

    edits: for (const edit of queued) {
      if (edit.type !== "newTown" && edit.type !== "nextTerm" && !playing()) continue
      switch (edit.type) {
        case "building": {
          const kind = kinds[edit.kind]
          const tile = { ...edit.cell, size: kind.size }
          if (!kind.buildable) break
          if (!unlocked(kind, resources.census.get())) {
            events.toast.emit(`${kind.title} ${lockReason(kind, resources.census.get())}`)
            break
          }
          if (!canPlace(grid.value(), tile)) {
            events.toast.emit("No room there")
            break
          }
          const short = afford(kind.cost)
          if (short) {
            events.toast.emit(short)
            break
          }
          pay(kind.cost)
          const id = place(tile, "building", () => commands.spawn(buildingDraft(kind, edit.cell)))
          queuedHere.set(id, () => commands.despawn(id))
          commands.insert(id, startOf(kind), ...rolesOf(kind, rules))
          if (edit.open) events.selection.emit({ select: id })
          break
        }
        case "homes": {
          let short: string | null = null
          for (const cell of edit.cells) {
            const tile = { ...cell, size: 1 }
            if (!canPlace(grid.value(), tile)) continue
            short = afford(home.cost)
            if (short) break
            pay(home.cost)
            const id = place(tile, "house", () => commands.spawn(houseDraft(cell)))
            queuedHere.set(id, () => commands.despawn(id))
            commands.insert(id, ...houseStart(rules))
          }
          if (short) events.toast.emit(short)
          break
        }
        case "roads": {
          let short = false
          for (const cell of edit.cells) {
            const tile = { ...cell, size: 1 }
            if (!canPlace(grid.value(), tile)) continue
            if (coins < ROAD_COST) {
              short = true
              break
            }
            coins -= ROAD_COST
            const id = place(tile, "road", () => commands.spawn(roadDraft(cell)))
            queuedHere.set(id, () => commands.despawn(id))
          }
          if (short) events.toast.emit("Not enough coins")
          break
        }
        case "pave": {
          // Stone comes out of storage at once, fullest first.
          const paved = new Set<number>(queries.paved.each().map((row) => row.entity.id))
          let short: string | null = null
          let stone = 0
          for (const cell of edit.cells) {
            if (!inside(cell.x, cell.y) || useAt(grid.value(), cell.x, cell.y) !== "road") continue
            const road = entities.get(ownerAt(grid.value(), cell.x, cell.y))
            if (road === undefined || paved.has(road)) continue
            short = afford({ coins: PAVE_COST.coins, materials: { stone: PAVE_COST.stone } })
            if (short) break
            coins -= PAVE_COST.coins
            left.stone = (left.stone ?? 0) - PAVE_COST.stone
            stone += PAVE_COST.stone
            paved.add(road)
            commands.insert(road, Game.Command.entry(Paved, {}))
          }
          take({ stone })
          if (short) events.toast.emit(short)
          break
        }
        case "ground": {
          // Park needs no road: it is laid at once, its materials straight out of storage.
          const piece = grounds[edit.ground]
          const parks = new Map(queries.parks.each().map((row) => [row.entity.id as number, row] as const))
          let short: string | null = null
          const spent: Record<string, number> = {}
          for (const cell of edit.cells) {
            const tile = { ...cell, size: 1 }
            const relay = useAt(grid.value(), cell.x, cell.y) === "park" ? parks.get(ownerAt(grid.value(), cell.x, cell.y)) : undefined
            if (relay ? relay.data.park.get().ground === edit.ground : !canPlace(grid.value(), tile)) continue
            short = afford(piece.cost)
            if (short) break
            pay(piece.cost)
            for (const [g, n] of Object.entries(piece.cost.materials)) spent[g] = (spent[g] ?? 0) + (n ?? 0)
            if (relay) relay.data.park.set({ ...relay.data.park.get(), ground: edit.ground })
            else {
              const id = place(tile, "park", () => commands.spawn(parkDraft(cell, edit.ground)))
              queuedHere.set(id, () => commands.despawn(id))
            }
          }
          take(spent)
          if (short) events.toast.emit(short)
          break
        }
        case "prop": {
          const piece = props[edit.prop]
          if (!unlocked(piece, resources.census.get())) {
            events.toast.emit(`${piece.title} needs a bigger town`)
            break
          }
          const row = useAt(grid.value(), edit.cell.x, edit.cell.y) === "park"
            ? queries.parks.each().find((r) => r.entity.id === ownerAt(grid.value(), edit.cell.x, edit.cell.y))
            : undefined
          if (!row) {
            events.toast.emit("Lay park ground first")
            break
          }
          if (row.data.park.get().prop === edit.prop) break
          const short = afford(piece.cost)
          if (short) {
            events.toast.emit(short)
            break
          }
          pay(piece.cost)
          take(piece.cost.materials)
          row.data.park.set({ ...row.data.park.get(), prop: edit.prop })
          break
        }
        case "remove": {
          if (!inside(edit.cell.x, edit.cell.y)) break
          const use = useAt(grid.value(), edit.cell.x, edit.cell.y)
          const owner = entities.get(ownerAt(grid.value(), edit.cell.x, edit.cell.y))
          if (owner === undefined || use === "water") break
          // A rock goes only once it is quarried down to a worked face, and gives nothing more after.
          if (use === "rock") {
            const rock = queries.rocks.get(owner)
            if (!rock.ok || rock.value.data.rock.get().amount > 1) {
              events.toast.emit("Quarry it down first: only a worked face can be cleared")
              break
            }
          }
          if (halls.has(owner)) {
            events.toast.emit("The town hall stays")
            break
          }
          // A park's furnishing goes before its ground.
          const furnished = use === "park" ? queries.parks.each().find((r) => r.entity.id === owner && r.data.park.get().prop !== "none") : undefined
          if (furnished) {
            furnished.data.park.set({ ...furnished.data.park.get(), prop: "none" })
            break
          }
          // A building or a home: a fee, and part of its materials back (a site's, all of it).
          const built = queries.built.get(owner)
          if (built.ok && (built.value.data.building.present || built.value.data.house.present)) {
            const b = maybe(built.value.data.building)
            const own = salvageOf(b ? builtCost(kinds[b.kind], maybe(built.value.data.upgraded)?.level ?? 0) : home.cost, maybe(built.value.data.site)?.owed ?? null, rules)
            const s = b ? withWorks(own, kinds[b.kind], maybe(built.value.data.works), rules) : own
            if (s.fee > 0 && coins < s.fee) {
              events.toast.emit(`Pulling it down costs ${s.fee} coins`)
              break
            }
            coins -= s.fee
            const lost = stash(s.back)
            const said = salvageText(s)
            if (said !== "") events.toast.emit(`${built.value.data.site.present ? "Cancelled" : "Pulled down"} · ${said}${lost > 0 ? ` (${lost} found no room in storage)` : ""}`)
          }
          // A building's walkers and a farm's fields are its children, and go with it.
          const gone = queries.tiles.get(owner)
          if (gone.ok) commands.despawn(gone.value.entity)
          else queuedHere.get(owner)?.()
          queuedHere.delete(owner)
          entities.delete(owner)
          for (let k = 0; k < grid.owner.length; k++) {
            if (grid.owner[k] === owner) {
              grid.owner[k] = 0
              grid.use[k] = "empty"
            }
          }
          events.selection.emit({ clearIf: owner })
          break
        }
        case "tax":
          resources.policy.update((p) => ({ ...p, [edit.tier]: Math.max(TAX_STEPS[0], Math.min(TAX_STEPS.at(-1)!, Math.round(edit.rate))) }))
          break
        case "trade":
          resources.policy.update((p) => ({
            ...p,
            sells: edit.mode === "sell" ? [...p.sells.filter((g) => g !== edit.good), edit.good] : p.sells.filter((g) => g !== edit.good),
            buys: edit.mode === "buy" ? [...p.buys.filter((g) => g !== edit.good), edit.good] : p.buys.filter((g) => g !== edit.good),
            loads: edit.amount === undefined ? p.loads : { ...p.loads, [edit.good]: Math.max(0, Math.min(rules.tradeLoad, Math.round(edit.amount))) }
          }))
          break
        case "pause": {
          const owner = ownerAt(grid.value(), edit.cell.x, edit.cell.y)
          // A building stops work; a home is closed, and stands empty (see `Households`).
          const id = entities.get(owner)
          const row = id === undefined ? undefined : queries.built.get(id)
          if (!row?.ok || halls.has(owner) || row.value.data.site.present || row.value.data.paused.present === edit.on) break
          if (!row.value.data.building.present && !row.value.data.house.present) break
          if (edit.on) commands.insert(row.value.entity.id, Game.Command.entry(Paused, {}))
          else commands.remove(row.value.entity.id, Paused)
          break
        }
        case "deliver": {
          const c = resources.crown.get()
          if (!c.open) break
          if ((left[c.good] ?? 0) < c.amount) {
            events.toast.emit(`Not enough ${goods[c.good].title}`)
            break
          }
          let owed = c.amount
          for (const { data } of [...queries.stores.each()].sort((a, b) => b.data.inventory.get().stock[c.good] - a.data.inventory.get().stock[c.good])) {
            if (owed <= 0) break
            const inv = data.inventory.get()
            const take = Math.min(owed, inv.stock[c.good])
            data.inventory.set({ ...inv, stock: { ...inv.stock, [c.good]: inv.stock[c.good] - take } })
            owed -= take
          }
          left[c.good] = (left[c.good] ?? 0) - c.amount
          coins += c.reward
          resources.crown.set({ ...c, open: false, met: c.met + 1, streak: 0 })
          write(resources.chronicle, t, `Sent the crown ${c.amount} ${goods[c.good].title}, for ${c.reward} coins.`)
          events.toast.emit(`Sent · +${c.reward} coins`)
          break
        }
        case "nextTerm": {
          const f = resources.fate.get()
          if (f.state !== "over") break
          const charter = resources.charter.get()
          const term = f.term + 1
          const began = f.began + termTicks(charter, rules)
          // The new term's winters, from the seed and the term, on the almanac's own stream; its first year is not spared.
          const almanac = Random.make((charter.seed ^ 0x5a17c3 ^ Math.imul(term, 0x9e3779b1)) >>> 0)
          const winters = [...charter.winters]
          while (winters.length < term * rules.yearsPerTerm) winters.push(...rollWinters(() => almanac.next(), rules, false))
          resources.charter.set({ ...charter, winters: winters.slice(0, term * rules.yearsPerTerm) })
          // The crown starts the term afresh: an open request lapses, unfined, and its tally of requests met and missed begins again.
          resources.crown.update((c) => ({ ...c, open: false, next: began + crownGap(charter, rules), met: 0, missed: 0, streak: 0 }))
          resources.fate.set({ ...f, state: "playing", reason: "", term, began, debtSince: -1, revoltSince: -1, goalSince: -1, score: 0 })
          // A long reign keeps its history in less detail the further back it is.
          const samples = resources.history.get().samples
          if (samples.length > HISTORY_KEPT) {
            const half = Math.floor(samples.length / 2)
            resources.history.set({ samples: [...samples.slice(0, half).filter((_, i) => i % 2 === 0), ...samples.slice(half)] })
          }
          write(resources.chronicle, t, `Term ${term}: the mayor stands for another ${charter.term} minutes.`)
          break
        }
        case "upgrade": {
          // The coins are paid now; carriers bring the materials while it goes on working (see `Works`).
          if (!inside(edit.cell.x, edit.cell.y)) break
          const id = entities.get(ownerAt(grid.value(), edit.cell.x, edit.cell.y))
          const row = id === undefined ? undefined : queries.upgradable.get(id)
          if (!row?.ok) break
          const { data } = row.value
          const kind = kinds[data.building.get().kind]
          const level = maybe(data.upgraded)?.level ?? 0
          const up = nextUpgrade(kind, level)
          if (!up || data.works.present || begun.has(row.value.entity.id) || data.site.present || data.rising.present) break
          const blocked = upgradeBlock(up, resources.fate.get().rank, rules)
          if (blocked) {
            events.toast.emit(`${up.title} ${blocked}`)
            break
          }
          if (coins < up.cost.coins) {
            events.toast.emit("Not enough coins")
            break
          }
          coins -= up.cost.coins
          begun.add(row.value.entity.id)
          const owed = amounts(up.cost.materials)
          commands.insert(row.value.entity.id, Game.Command.entry(Works, { owed, total: total(owed), done: 0, level: (level + 1) as 1 | 2 }))
          const was = (upgradeAt(kind, level)?.title ?? kind.title).toLowerCase()
          write(resources.chronicle, t, `Works begin on the ${was}: it is to be ${anA(up.title.toLowerCase())}.`)
          events.toast.emit(`${up.title} · −${up.cost.coins} coins · carriers bring ${costText({ coins: 0, materials: up.cost.materials })}`)
          break
        }
        case "reserve":
          resources.policy.update((p) => ({ ...p, reserve: Math.max(0, Math.min(RESERVE_MAX, Math.round(edit.amount))) }))
          break
        case "newTown": {
          for (const { entity } of rows) commands.despawn(entity)
          for (const drop of queuedHere.values()) drop()
          queuedHere.clear()
          entities.clear()
          const charter = edit.charter
          const richness = lands[charter.land]
          const land = generate(charter, rules)
          for (const c of land.water) commands.spawn(waterDraft(c))
          for (const tree of land.trees) commands.spawn(treeDraft(tree.cell, tree.growth))
          for (const r of land.rocks) commands.spawn(rockDraft(r.cell, r.ore, r.amount))
          for (const c of land.roads) commands.spawn(roadDraft(c))
          const hall = kinds.townhall
          const id = commands.spawn(buildingDraft(hall, land.hall))
          commands.insert(id, ...rolesOf(hall, rules))
          const stock: Amounts = amounts(richness.stock)
          commands.insert(id, Game.Command.entry(TownHall, {}), Game.Command.entry(Status, "idle"), Game.Command.entry(Inventory, { stock, accepts: goodIds, cap: hall.holds?.cap ?? 60 }))
          coins = richness.coins
          const founded = resources.time.get().step
          // The almanac: each year's winter, from the seed (on its own stream, so the land's randomness is untouched).
          const almanac = Random.make((charter.seed ^ 0x5a17c3) >>> 0)
          resources.charter.set({ ...charter, founded, winters: rollWinters(() => almanac.next(), rules) })
          resources.appeal.set({ cells: [] })
          resources.pantry.set({ eaten: 0, rotted: 0, eatenLast: 0, rottedLast: 0, warned: -1_000_000 })
          resources.fires.set({ fires: [], next: 1 })
          // A new town starts the guide over, unless the mayor turned it off.
          resources.guide.update((g) => ({ done: [], off: g.off }))
          resources.land.set({ mask: land.mask, cells: land.cells })
          resources.ledger.set({ taxes: 0, trade: 0, upkeep: 0, admin: 0 })
          resources.policy.set({ settlers: 100, citizens: 100, sells: trade.sells, buys: [], reserve: trade.reserve, loads: amounts(Object.fromEntries(goodIds.map((g) => [g, rules.tradeLoad]))) })
          resources.market.set({ prices: amounts(Object.fromEntries(goodIds.map((g) => [g, 100]))) })
          resources.mood.set({ approval: 10, target: 10, base: 0, needs: 0, taxes: 0, debt: 0, crown: 0, winter: 0, grudge: 0, memory: 0 })
          resources.crown.set({ open: false, good: "wood", amount: 0, issued: 0, due: 0, reward: 0, next: crownGap(charter, rules), met: 0, missed: 0, streak: 0, snubs: [] })
          resources.fate.set(foundedFate())
          resources.history.set({ samples: [] })
          resources.chronicle.set({
            lines: [{ tick: 0, text: `Founded on ${sizes[charter.size].title}, ${richness.title} land, for a term of ${charter.term} minutes.`, alarm: false, at: null }]
          })
          resources.rng.set(charter.seed)
          events.selection.emit({ clear: true })
          // Nothing else this step: the new land is not on the grid yet.
          break edits
        }
      }
    }
    resources.treasury.set({ coins })
  }
)
