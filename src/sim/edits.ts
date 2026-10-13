/**
 * The player's edits, applied at the start of a step: building, laying
 * roads and homes, bulldozing, pausing, the town's policy, answering the
 * crown, and founding a new town. Costs are checked against the treasury
 * and the town's stock and paid up front in coins; the materials are
 * carried to the site afterwards. Once the term has ended, only a new town
 * (or carrying on after completing this one) is taken.
 */
import {
  buildingDraft, houseDraft, houseStart, roadDraft, rockDraft, rolesOf, startOf, treeDraft, waterDraft
} from "../archetypes.ts"
import * as Random from "@typeonce/bevy-ts-math/Random"

import { amounts, goodIds, goods, home, kinds, lands, PAVE_COST, ROAD_COST, sizes, trade, type Amounts, type Kind } from "../content.ts"
import { canPlace, cellsOf, GridBuilder, ownerAt, useAt } from "../grid.ts"
import { inside } from "../iso.ts"
import { generate } from "../mapgen.ts"
import {
  Appeal, Building, Census, Charter, Chronicle, Crown, Fate, Fires, Game, History, Inventory, Land, Ledger, Market, Mood, Pantry, Paved, Paused,
  Policy, Rising, Rng, Status, Stock, Storage, Time, TownHall, Treasury, Ui
} from "../schema.ts"
import { elapsed, rollWinters, TileRead, useOf, write } from "./shared.ts"
import { crownGap, foundedFate } from "./term.ts"

export const unlocked = (kind: Kind, census: { readonly settlers: number; readonly citizens: number }) =>
  census.settlers + census.citizens >= kind.unlock.residents && census.citizens >= kind.unlock.citizens

export const ApplyEdits = Game.System(
  "Town/ApplyEdits",
  {
    queries: {
      tiles: TileRead,
      paved: Game.Query({ selection: { paved: Game.Query.read(Paved) } }),
      halls: Game.Query({ selection: { hall: Game.Query.read(TownHall) } }),
      buildings: Game.Query({ selection: { building: Game.Query.read(Building), paused: Game.Query.optional(Paused) } }),
      stores: Game.Query({ selection: { inventory: Game.Query.write(Inventory) }, with: [Storage] })
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
      appeal: Game.System.writeResource(Appeal),
      pantry: Game.System.writeResource(Pantry),
      fires: Game.System.writeResource(Fires)
    },
    services: { ui: Game.System.service(Ui) }
  },
  ({ queries, resources, services, commands }) => {
    const ui = services.ui
    if (ui.edits.length === 0) return
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
    /** Fells the trees under a tile about to be built on. */
    const fell = (tile: { x: number; y: number; size: number }) => {
      for (const c of cellsOf(tile)) {
        if (useAt(grid.value(), c.x, c.y) !== "tree") continue
        const tree = entities.get(ownerAt(grid.value(), c.x, c.y))
        if (tree !== undefined) commands.despawn(tree)
      }
    }
    const spawn = (draft: Parameters<typeof commands.spawn>[0], tile: { x: number; y: number; size: number }, use: "building" | "house" | "road") => {
      fell(tile)
      const id = commands.spawn(draft)
      grid.claim(tile, id, use)
      entities.set(id, id)
      return id
    }

    const playing = () => resources.fate.get().state === "playing"
    const t = elapsed(resources.time.get(), resources.charter.get())

    edits: for (const edit of ui.edits.splice(0)) {
      if (edit.type !== "newTown" && edit.type !== "govern" && !playing()) continue
      switch (edit.type) {
        case "building": {
          const kind = kinds[edit.kind]
          const tile = { ...edit.cell, size: kind.size }
          if (!kind.buildable) break
          if (!unlocked(kind, resources.census.get())) {
            ui.toast(`${kind.title} needs a bigger town`)
            break
          }
          if (!canPlace(grid.value(), tile)) {
            ui.toast("No room there")
            break
          }
          const short = afford(kind.cost)
          if (short) {
            ui.toast(short)
            break
          }
          pay(kind.cost)
          const id = spawn(buildingDraft(kind, edit.cell), tile, "building")
          if (kind.decor) {
            // An ornament needs no road: its materials come out of storage at once, and it goes straight up.
            take(kind.cost.materials)
            commands.insert(id, Game.Command.entry(Rising, { ticks: 0 }), ...rolesOf(kind))
          } else commands.insert(id, startOf(kind), ...rolesOf(kind))
          if (edit.open) ui.selected = id
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
            const id = spawn(houseDraft(cell), tile, "house")
            commands.insert(id, ...houseStart())
          }
          if (short) ui.toast(short)
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
            spawn(roadDraft(cell), tile, "road")
          }
          if (short) ui.toast("Not enough coins")
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
          if (short) ui.toast(short)
          break
        }
        case "remove": {
          if (!inside(edit.cell.x, edit.cell.y)) break
          const use = useAt(grid.value(), edit.cell.x, edit.cell.y)
          const owner = entities.get(ownerAt(grid.value(), edit.cell.x, edit.cell.y))
          if (owner === undefined || use === "rock" || use === "water") break
          if (halls.has(owner)) {
            ui.toast("The town hall stays")
            break
          }
          // A building's walkers and a farm's fields are its children, and go with it.
          commands.despawn(owner)
          entities.delete(owner)
          for (let k = 0; k < grid.owner.length; k++) {
            if (grid.owner[k] === owner) {
              grid.owner[k] = 0
              grid.use[k] = "empty"
            }
          }
          if (ui.selected === owner) ui.selected = null
          break
        }
        case "tax":
          resources.policy.update((p) => ({ ...p, [edit.tier]: edit.rate }))
          break
        case "trade":
          resources.policy.update((p) => ({
            ...p,
            sells: edit.mode === "sell" ? [...p.sells.filter((g) => g !== edit.good), edit.good] : p.sells.filter((g) => g !== edit.good),
            buys: edit.mode === "buy" ? [...p.buys.filter((g) => g !== edit.good), edit.good] : p.buys.filter((g) => g !== edit.good)
          }))
          break
        case "pause": {
          const owner = ownerAt(grid.value(), edit.cell.x, edit.cell.y)
          const row = queries.buildings.each().find((b) => b.entity.id === owner)
          if (!row || halls.has(owner) || row.data.paused.present === edit.on) break
          if (edit.on) commands.insert(row.entity.id, Game.Command.entry(Paused, {}))
          else commands.remove(row.entity.id, Paused)
          break
        }
        case "deliver": {
          const c = resources.crown.get()
          if (!c.open) break
          if ((left[c.good] ?? 0) < c.amount) {
            ui.toast(`Not enough ${goods[c.good].title}`)
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
          ui.toast(`Sent · +${c.reward} coins`)
          break
        }
        case "govern": {
          const f = resources.fate.get()
          if (f.state !== "won") break
          resources.fate.set({ ...f, state: "playing", governing: true, won: f.at, reason: "" })
          write(resources.chronicle, t, "The mayor stays on to govern the town to the end of the term.")
          break
        }
        case "reserve":
          resources.policy.update((p) => ({ ...p, reserve: edit.amount }))
          break
        case "newTown": {
          for (const id of entities.values()) commands.despawn(id)
          entities.clear()
          const charter = edit.charter
          const richness = lands[charter.land]
          const land = generate(charter)
          for (const c of land.water) commands.spawn(waterDraft(c))
          for (const tree of land.trees) commands.spawn(treeDraft(tree.cell, tree.growth))
          for (const r of land.rocks) commands.spawn(rockDraft(r.cell, r.ore, r.amount))
          for (const c of land.roads) commands.spawn(roadDraft(c))
          const hall = kinds.townhall
          const id = commands.spawn(buildingDraft(hall, land.hall))
          commands.insert(id, ...rolesOf(hall))
          const stock: Amounts = amounts(richness.stock)
          commands.insert(id, Game.Command.entry(TownHall, {}), Game.Command.entry(Status, "idle"), Game.Command.entry(Inventory, { stock, accepts: goodIds, cap: hall.holds?.cap ?? 60 }))
          coins = richness.coins
          const founded = resources.time.get().tick
          // The almanac: each year's winter, from the seed (on its own stream, so the land's randomness is untouched).
          const almanac = Random.make((charter.seed ^ 0x5a17c3) >>> 0)
          resources.charter.set({ ...charter, founded, winters: rollWinters(() => almanac.next()) })
          resources.appeal.set({ cells: [] })
          resources.pantry.set({ eaten: 0, rotted: 0, eatenLast: 0, rottedLast: 0, warned: -1_000_000 })
          resources.fires.set({ fires: [], next: 1 })
          resources.land.set({ mask: land.mask, cells: land.cells })
          resources.ledger.set({ taxes: 0, trade: 0, upkeep: 0, admin: 0 })
          resources.policy.set({ settlers: 100, citizens: 100, sells: trade.sells, buys: [], reserve: trade.reserve })
          resources.market.set({ prices: amounts(Object.fromEntries(goodIds.map((g) => [g, 100]))) })
          resources.mood.set({ approval: 10, target: 10, base: 0, needs: 0, taxes: 0, debt: 0, crown: 0, winter: 0 })
          resources.crown.set({ open: false, good: "wood", amount: 0, issued: 0, due: 0, reward: 0, next: crownGap(charter), met: 0, missed: 0, streak: 0, snubs: [] })
          resources.fate.set(foundedFate())
          resources.history.set({ samples: [] })
          resources.chronicle.set({
            lines: [{ tick: 0, text: `Founded on ${sizes[charter.size].title}, ${richness.title} land, for a term of ${charter.term} minutes.`, alarm: false }]
          })
          resources.rng.set(charter.seed)
          ui.selected = null
          // Nothing else this step: the new land is not on the grid yet.
          break edits
        }
      }
    }
    resources.treasury.set({ coins })
  }
)
