/**
 * The player's edits, applied at the start of a step: building, laying
 * roads and homes, bulldozing, and founding a new town. Costs are checked
 * against the treasury and the town's stock and paid up front in coins; the
 * materials are carried to the site afterwards.
 */
import {
  buildingDraft, houseDraft, houseStart, roadDraft, rockDraft, rolesOf, startOf, treeDraft, waterDraft
} from "../archetypes.ts"
import { amounts, goodIds, home, kinds, ROAD_COST, ROCK_AMOUNT, start, trade, type Amounts, type Kind } from "../content.ts"
import { canPlace, cellsOf, GridBuilder, ownerAt, useAt } from "../grid.ts"
import { inside } from "../iso.ts"
import { generate } from "../mapgen.ts"
import { Census, Game, Inventory, Ledger, Policy, Rng, Status, Stock, TownHall, Treasury, Ui } from "../schema.ts"
import { TileRead, useOf } from "./shared.ts"

export const unlocked = (kind: Kind, census: { readonly settlers: number; readonly citizens: number }) =>
  census.settlers + census.citizens >= kind.unlock.residents && census.citizens >= kind.unlock.citizens

export const ApplyEdits = Game.System(
  "Town/ApplyEdits",
  {
    queries: {
      tiles: TileRead,
      halls: Game.Query({ selection: { hall: Game.Query.read(TownHall) } })
    },
    resources: {
      treasury: Game.System.writeResource(Treasury),
      ledger: Game.System.writeResource(Ledger),
      policy: Game.System.writeResource(Policy),
      rng: Game.System.writeResource(Rng),
      stock: Game.System.readResource(Stock),
      census: Game.System.readResource(Census)
    },
    services: { ui: Game.System.service(Ui) }
  },
  ({ queries, resources, services, commands }) => {
    const ui = services.ui
    if (ui.edits.length === 0) return
    const grid = new GridBuilder()
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

    edits: for (const edit of ui.edits.splice(0)) {
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
          commands.insert(id, startOf(kind), ...rolesOf(kind))
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
            commands.insert(id, houseStart())
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
        case "sell":
          resources.policy.update((p) => ({ ...p, sells: edit.on ? [...p.sells.filter((g) => g !== edit.good), edit.good] : p.sells.filter((g) => g !== edit.good) }))
          break
        case "reserve":
          resources.policy.update((p) => ({ ...p, reserve: edit.amount }))
          break
        case "newTown": {
          for (const id of entities.values()) commands.despawn(id)
          entities.clear()
          const land = generate(edit.seed)
          for (const c of land.water) commands.spawn(waterDraft(c))
          for (const t of land.trees) commands.spawn(treeDraft(t.cell, t.growth))
          for (const r of land.rocks) commands.spawn(rockDraft(r.cell, r.ore, ROCK_AMOUNT))
          for (const c of land.roads) commands.spawn(roadDraft(c))
          const hall = kinds.townhall
          const id = commands.spawn(buildingDraft(hall, land.hall))
          commands.insert(id, ...rolesOf(hall))
          const stock: Amounts = amounts(start.stock)
          commands.insert(id, Game.Command.entry(TownHall, {}), Game.Command.entry(Status, "idle"), Game.Command.entry(Inventory, { stock, accepts: goodIds, cap: hall.holds?.cap ?? 60 }))
          coins = start.coins
          resources.ledger.set({ taxes: 0, trade: 0, upkeep: 0 })
          resources.policy.set({ settlers: 100, citizens: 100, sells: trade.sells, reserve: trade.reserve })
          resources.rng.set(edit.seed)
          ui.selected = null
          // Nothing else this step: the new land is not on the grid yet.
          break edits
        }
      }
    }
    resources.treasury.set({ coins })
  }
)
