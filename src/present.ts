/**
 * What runs once a frame, after the simulation's steps: the pointer's
 * gestures become a selection, a preview, and edits for the next step; the
 * panel, tooltip, and top bar are filled in; and the views follow the world.
 */
import { RenderSync } from "@typeonce/bevy-ts-render"

import {
  BuildingView, drawFloor, drawGhost, drawPlot, drawRoads, drawWater, FieldView, homeHeight, HouseView, RockView, topOf, TreeView, WalkerView,
  type Doors, type Emphasis
} from "./art.ts"
import { BUILD_TICKS, fate, goods, home, kinds, needTitle, total, type Kind } from "./content.ts"
import { around, canPlace, entrances, isRoad, key, lPath, useAt, type TileLike } from "./grid.ts"
import { inside, TILE_H, TILE_W, toGrid, toScreen, U, type Point } from "./iso.ts"
import {
  Building, BuildingNodes, Census, Charter, Chronicle, Clock, Crown, Errand, Fate, Field, FieldNodes, Figure, Game, Grid, History, House,
  HouseNodes, Inventory, Land, Ledger, Market, Mood, Paused, Policy, Recipe, Rising, Road, Roam, Rock, RockNodes, Route, Service, Site,
  Staff, StageService, Status, Stock, Tile, Time, TownHall, Treasury, Tree, TreeNodes, Ui, WalkerNodes, WalkerOf, Water, maybe,
  type GridValue, type Status as StatusValue
} from "./schema.ts"
import { capacity, CELL_STEPS, elapsed, goalsOf, larder, met, seasonAt, SITE_SHARE, taxOf, termTicks } from "./sim/index.ts"
import { emptyPreview, type HitBox } from "./ui.ts"

const cellAt = (at: Point): Point => {
  const g = toGrid(at.x, at.y)
  return { x: Math.floor(g.x), y: Math.floor(g.y) }
}

/** The footprint `size` cells a side centred on a point, by its top cell. */
const footprintAt = (at: Point, size: number): Point => {
  const g = toGrid(at.x, at.y)
  return { x: Math.floor(g.x - (size - 1) / 2), y: Math.floor(g.y - (size - 1) / 2) }
}

/** A thing's hit area: its footprint on the floor, or its body as drawn. */
const hitBox = (id: number, tile: TileLike, half: number, height: number): HitBox => {
  const centre = toScreen(tile.x + tile.size / 2, tile.y + tile.size / 2)
  const a = half * U
  const top = centre.y - a * TILE_H - height
  return {
    id,
    depth: tile.x + tile.y + tile.size,
    contains: (at) => {
      const g = toGrid(at.x, at.y)
      if (g.x >= tile.x && g.x <= tile.x + tile.size && g.y >= tile.y && g.y <= tile.y + tile.size) return true
      return Math.abs(at.x - centre.x) <= a * TILE_W && at.y >= top && at.y <= centre.y
    }
  }
}

const hitAt = (hits: ReadonlyArray<HitBox>, at: Point): number | null => hits.find((h) => h.contains(at))?.id ?? null

/** The walls facing the viewer a road meets: the +x side's entrances and the +y side's. */
const doorsOf = (grid: GridValue, tile: TileLike): Doors => {
  const open = entrances(tile).filter((c) => isRoad(grid, c.x, c.y))
  return { right: open.some((c) => c.side === 0), left: open.some((c) => c.side === 1) }
}

/** How far a kind's work reaches, if it works the land around it. */
const reachOf = (kind: Kind): number | null => kind.gathers?.radius ?? kind.plants?.radius ?? null

const sourceTitle = { tree: "grown trees", stone: "stone", ore: "ore", field: "ripe fields", water: "water" } as const

/** Why a building is not working, in a line, or `null` when it is fine. */
const problemOf = (kind: Kind, status: StatusValue, growing = false): string | null => {
  switch (status) {
    case "unconnected":
      return "needs a road at the middle of one of its sides"
    case "unstaffed":
      return "no workers: the town needs more residents"
    case "blocked":
      return "full: nowhere to take what it makes"
    case "paused":
      return "paused: no workers, a quarter of its upkeep"
    case "starved":
      if (kind.gathers && growing) return `the ${kind.gathers.source === "tree" ? "trees" : "fields"} in reach are still growing`
      if (kind.gathers) return `no ${sourceTitle[kind.gathers.source]} within ${kind.gathers.radius} cells${kind.gathers.source === "tree" ? ": a forester nearby replants" : ""}`
      if (kind.recipe?.input) return `waiting for ${kind.recipe.input}`
      if (kind.service?.service === "goods") return "nothing to hand out: no fish, bread, or cloth here"
      return "waiting"
    default:
      return null
  }
}

/** A tree or field gatherer has young ones within reach: it is waiting on them to grow, not on a forester. */
const growingNear = (grid: GridValue, tile: TileLike, kind: Kind): boolean => {
  const g = kind.gathers
  if (!g || (g.source !== "tree" && g.source !== "field")) return false
  return around(tile, g.radius).some((c) => useAt(grid, c.x, c.y) === g.source)
}

const BuildingRead = Game.Query({
  selection: {
    tile: Game.Query.read(Tile),
    building: Game.Query.read(Building),
    status: Game.Query.read(Status),
    staff: Game.Query.read(Staff),
    site: Game.Query.optional(Site),
    rising: Game.Query.optional(Rising),
    recipe: Game.Query.optional(Recipe),
    inventory: Game.Query.optional(Inventory),
    service: Game.Query.optional(Service),
    walkers: Game.Query.optionalRelated(WalkerOf),
    hall: Game.Query.optional(TownHall),
    paused: Game.Query.optional(Paused)
  }
})
const HouseRead = Game.Query({
  selection: { tile: Game.Query.read(Tile), house: Game.Query.read(House), site: Game.Query.optional(Site), rising: Game.Query.optional(Rising) }
})

/** How far up a building or home is: a site rises to its frame as materials come in, then the rest of the way. */
const buildOf = (site: { readonly owed: Parameters<typeof total>[0]; readonly total: number } | undefined, rising: { readonly ticks: number } | undefined) =>
  site ? PLATE_SHARE + (SITE_SHARE - PLATE_SHARE) * delivered(site) : rising ? rising.ticks / BUILD_TICKS : 1

const siteShare = (site: { readonly owed: Parameters<typeof total>[0]; readonly total: number } | undefined) => (site ? delivered(site) : null)

/** A site's plate is marked out the moment it is placed. */
const PLATE_SHARE = 0.12
/** The share of a site's materials that has arrived. */
const delivered = (site: { readonly owed: Parameters<typeof total>[0]; readonly total: number }) => 1 - total(site.owed) / Math.max(1, site.total)

export const Interact = Game.System(
  "Town/Interact",
  {
    queries: { buildings: BuildingRead, houses: HouseRead },
    resources: {
      grid: Game.System.readResource(Grid),
      census: Game.System.readResource(Census),
      treasury: Game.System.readResource(Treasury),
      ledger: Game.System.readResource(Ledger),
      stock: Game.System.readResource(Stock),
      policy: Game.System.readResource(Policy),
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      market: Game.System.readResource(Market),
      mood: Game.System.readResource(Mood),
      crown: Game.System.readResource(Crown),
      fate: Game.System.readResource(Fate),
      history: Game.System.readResource(History),
      chronicle: Game.System.readResource(Chronicle)
    },
    services: { ui: Game.System.service(Ui) }
  },
  ({ queries, resources, services }) => {
    const ui = services.ui
    const grid = resources.grid.get()
    const rates = resources.policy.get()
    const approval = resources.mood.get().approval
    const buildings = queries.buildings.each()
    const houses = queries.houses.each()

    const hits: Array<HitBox> = [
      ...buildings.map(({ entity, data }) => {
        const kind = kinds[data.building.get().kind]
        return hitBox(entity.id, data.tile.get(), kind.half, topOf(kind))
      }),
      ...houses.map(({ entity, data }) => hitBox(entity.id, data.tile.get(), home.half, homeHeight(data.house.get().tier)))
    ].sort((l, r) => r.depth - l.depth)
    ui.hits = hits
    const tileOf = (id: number) => [...buildings, ...houses].find((row) => row.entity.id === id)?.data.tile.get()

    // ── Gestures ──
    for (const gesture of ui.gestures.splice(0)) {
      const cell = cellAt(gesture.at)
      if (gesture.type === "press") {
        ui.dragFrom = (ui.tool === "road" || ui.tool === "home") && inside(cell.x, cell.y) ? cell : null
        continue
      }
      switch (ui.tool) {
        case "road":
        case "home": {
          if (ui.dragFrom) {
            const cells = lPath(ui.dragFrom, cell).filter((c) => inside(c.x, c.y))
            ui.edits.push(ui.tool === "road" ? { type: "roads", cells } : { type: "homes", cells })
          }
          ui.dragFrom = null
          break
        }
        case "place": {
          if (gesture.panned || !ui.placing) break
          ui.edits.push({ type: "building", kind: ui.placing, cell: footprintAt(gesture.at, kinds[ui.placing].size), open: false })
          break
        }
        case "bulldoze": {
          if (gesture.panned) break
          const hit = hitAt(hits, gesture.at)
          ui.edits.push({ type: "remove", cell: (hit !== null ? tileOf(hit) : undefined) ?? cell })
          break
        }
        case "select": {
          if (gesture.panned) break
          ui.selected = hitAt(hits, gesture.at)
          if (ui.selected !== null) ui.menu = null
          break
        }
      }
    }
    if (ui.selected !== null && tileOf(ui.selected) === undefined) ui.selected = null

    // ── Preview ──
    const preview = emptyPreview()
    const pointer = ui.pointer
    const cell = pointer ? cellAt(pointer) : null
    preview.hover = pointer && (ui.tool === "select" || ui.tool === "bulldoze") ? hitAt(hits, pointer) : null
    const showReach = (tile: TileLike, kind: Kind) => {
      const r = reachOf(kind)
      if (r !== null) preview.plots.push({ x: tile.x - r, y: tile.y - r, size: tile.size + 2 * r, look: "reach" })
    }

    if (ui.tool === "road" || ui.tool === "home") {
      const cells = cell === null ? [] : ui.dragFrom ? lPath(ui.dragFrom, cell) : [cell]
      for (const c of cells) {
        if (!inside(c.x, c.y)) continue
        const free = canPlace(grid, { ...c, size: 1 })
        if (ui.tool === "road") {
          if (free) preview.roads.push(c)
          else if (useAt(grid, c.x, c.y) !== "road") preview.plots.push({ ...c, size: 1, look: "blocked" })
        } else if (free) preview.ghosts.push({ what: "home", cell: c })
        else preview.plots.push({ ...c, size: 1, look: "blocked" })
      }
    } else if (ui.tool === "place" && ui.placing && pointer) {
      const kind = kinds[ui.placing]
      const at = footprintAt(pointer, kind.size)
      const tile = { ...at, size: kind.size }
      showReach(tile, kind)
      if (canPlace(grid, tile)) preview.ghosts.push({ what: ui.placing, cell: at })
      else preview.plots.push({ ...tile, look: "blocked" })
    } else if (ui.tool === "bulldoze") {
      preview.danger = true
      if (preview.hover === null && cell && ["road", "tree", "field"].includes(useAt(grid, cell.x, cell.y))) preview.plots.push({ ...cell, size: 1, look: "blocked" })
    }
    if (ui.selected !== null) {
      const row = buildings.find((b) => b.entity.id === ui.selected)
      const tile = tileOf(ui.selected)
      if (tile) preview.plots.push({ ...tile, look: "picked" })
      if (row && tile) showReach(tile, kinds[row.data.building.get().kind])
    }

    // ── Tooltip and panel ──
    const describeBuilding = (row: (typeof buildings)[number]) => {
      const kind = kinds[row.data.building.get().kind]
      const status = row.data.status.get()
      const site = maybe(row.data.site)
      const lines: Array<string> = []
      if (site) {
        const owed = Object.entries(site.owed).filter(([, n]) => n > 0).map(([g, n]) => `${n} ${g}`)
        lines.push(owed.length > 0 ? `waiting for ${owed.join(", ")}` : "going up")
        return { kind, status, problem: null, lines }
      }
      const staff = row.data.staff.get()
      if (staff.needed > 0) lines.push(`workers ${staff.assigned} of ${staff.needed}`)
      const recipe = maybe(row.data.recipe)
      const inventory = maybe(row.data.inventory)
      if (recipe) lines.push(`${recipe.input ? `${recipe.inputs} ${recipe.input} → ` : ""}${recipe.batch} ${goods[recipe.output].title} · ${recipe.made} made`)
      if (inventory && !maybe(row.data.hall)) {
        const held = inventory.accepts.filter((g) => inventory.stock[g] > 0).map((g) => `${inventory.stock[g]} ${g}`)
        lines.push(held.length > 0 ? `holds ${held.join(", ")}` : "holds nothing yet")
      }
      const walkers = maybe(row.data.walkers)?.length ?? 0
      if (walkers > 0) lines.push(`${walkers} out on the roads`)
      if (kind.upkeep > 0) lines.push(`upkeep ${kind.upkeep} coins a minute`)
      return { kind, status, problem: problemOf(kind, status, status === "starved" && growingNear(grid, row.data.tile.get(), kind)), lines }
    }
    const describeHouse = (row: (typeof houses)[number]) => {
      const h = row.data.house.get()
      const site = maybe(row.data.site)
      if (site) return { h, lines: ["waiting for its planks"] }
      const tier = home.tiers[h.tier]
      const next = h.tier === 1 ? home.tiers[2] : null
      const mark = (n: Parameters<typeof met>[1]) => `${needTitle[n]} ${met(h, n) ? "✓" : "–"}`
      return {
        h,
        lines: [
          `${h.residents} of ${capacity(h, approval)} residents (${tier.residents} at most)`,
          `needs: ${tier.needs.map(mark).join(" · ")}`,
          ...(next ? [`to become citizens: ${next.needs.map(mark).join(" · ")}`] : []),
          `pays ${Math.round(taxOf(h, rates))} coins a minute`
        ]
      }
    }

    const hovered = preview.hover
    const hoveredBuilding = hovered !== null ? buildings.find((row) => row.entity.id === hovered) : undefined
    const hoveredHouse = hovered !== null ? houses.find((row) => row.entity.id === hovered) : undefined
    if (hoveredBuilding) {
      const { kind, status, problem } = describeBuilding(hoveredBuilding)
      preview.tooltip = `${kind.title.toLowerCase()} · ${problem ?? status}`
    } else if (hoveredHouse) {
      const h = hoveredHouse.data.house.get()
      preview.tooltip = `${home.tiers[h.tier].title}' home · ${h.residents} residents`
    } else if (ui.tool === "place" && ui.placing) {
      const kind = kinds[ui.placing]
      const r = reachOf(kind)
      preview.tooltip = `${kind.title.toLowerCase()}${r !== null ? ` · works ${r} cells around` : ""}`
    }
    ui.preview = preview

    const pickedBuilding = ui.selected !== null ? buildings.find((row) => row.entity.id === ui.selected) : undefined
    const pickedHouse = ui.selected !== null ? houses.find((row) => row.entity.id === ui.selected) : undefined
    if (pickedBuilding) {
      const { kind, status, problem, lines } = describeBuilding(pickedBuilding)
      const pausable = kind.id !== "townhall" && !pickedBuilding.data.site.present && !pickedBuilding.data.rising.present
      ui.panel = {
        type: "building", id: pickedBuilding.entity.id, cell: pickedBuilding.data.tile.get(), kind: kind.id, status, problem, lines,
        pausable, paused: pickedBuilding.data.paused.present
      }
    } else if (pickedHouse) {
      const { h, lines } = describeHouse(pickedHouse)
      ui.panel = { type: "house", id: pickedHouse.entity.id, cell: pickedHouse.data.tile.get(), tier: h.tier, lines }
    } else ui.panel = ui.menu ? { type: ui.menu } : null

    const centres = new Map<number, Point>()
    for (const { entity, data } of [...buildings, ...houses]) {
      const t = data.tile.get()
      centres.set(entity.id, toScreen(t.x + t.size / 2, t.y + t.size / 2))
    }
    ui.centres = centres

    const census = resources.census.get()
    const ledger = resources.ledger.get()
    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    const coins = resources.treasury.get().coins
    const net = ledger.taxes + ledger.trade - ledger.upkeep - ledger.admin
    const mood = resources.mood.get()
    const crown = resources.crown.get()
    const f = resources.fate.get()
    const stock = resources.stock.get()
    const season = seasonAt(Math.min(Math.max(0, t), termTicks(charter) - 1), charter)
    const seconds = (steps: number) => Math.max(0, Math.ceil(steps / 60))
    const danger = (since: number, minutes: number) => (since < 0 ? null : seconds(since + minutes * 3600 - t))
    ui.stats = {
      coins,
      taxes: ledger.taxes,
      trade: ledger.trade,
      upkeep: ledger.upkeep,
      admin: ledger.admin,
      net,
      homes: census.homes,
      needs: { food: census.food, bread: census.bread, cloth: census.cloth, faith: census.faith },
      policy: rates,
      stock,
      prices: resources.market.get().prices,
      settlers: census.settlers,
      citizens: census.citizens,
      jobs: census.jobs,
      employed: census.employed,
      charter: { size: charter.size, term: charter.term, land: charter.land, seed: charter.seed },
      minute: t / 3600,
      season: { year: season.year, winter: season.winter, left: seconds(season.left) },
      mood: {
        approval: mood.approval,
        target: mood.target,
        parts: [
          { label: "mood of the town", value: mood.base },
          { label: "needs met", value: mood.needs },
          { label: "taxes", value: mood.taxes },
          { label: "unpaid wages", value: mood.debt },
          { label: "the crown's displeasure", value: mood.crown },
          { label: "a hungry winter", value: mood.winter }
        ].filter((p) => p.value !== 0)
      },
      crown: {
        open: crown.open, good: crown.good, amount: crown.amount, left: seconds(crown.due - t), reward: crown.reward, met: crown.met,
        missed: crown.missed, next: seconds(crown.next - t)
      },
      fate: {
        state: f.state,
        reason: f.reason,
        at: f.at / 3600,
        governing: f.governing,
        score: f.score,
        bankrupt: danger(f.debtSince, fate.debt),
        revolt: danger(f.revoltSince, fate.revolt),
        complete: danger(f.goalSince, fate.hold),
        peak: f.peak
      },
      goals: goalsOf(charter, { settlers: census.settlers, citizens: census.citizens, coins, net, approval: mood.approval }),
      larder: larder(stock),
      history: resources.history.get().samples,
      chronicle: resources.chronicle.get().lines
    }
  }
)

// ── Views ─────────────────────────────────────────────────────────────────

export const RenderBuildings = RenderSync.system(Game, {
  name: "Town/RenderBuildings",
  renderable: Building,
  transform: Tile,
  registry: BuildingNodes,
  services: { stage: StageService },
  create: ({ renderable, services }) => new BuildingView(renderable.kind, services.stage),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderHouses = RenderSync.system(Game, {
  name: "Town/RenderHouses",
  renderable: House,
  transform: Tile,
  registry: HouseNodes,
  services: { stage: StageService },
  create: ({ services }) => new HouseView(services.stage),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderWalkers = RenderSync.system(Game, {
  name: "Town/RenderWalkers",
  renderable: Figure,
  registry: WalkerNodes,
  create: ({ renderable }) => new WalkerView(renderable.role, renderable.color),
  apply: () => {}
})

export const RenderTrees = RenderSync.system(Game, {
  name: "Town/RenderTrees",
  renderable: Tree,
  transform: Tile,
  registry: TreeNodes,
  create: () => new TreeView(),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderRocks = RenderSync.system(Game, {
  name: "Town/RenderRocks",
  renderable: Rock,
  transform: Tile,
  registry: RockNodes,
  create: () => new RockView(),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderFields = RenderSync.system(Game, {
  name: "Town/RenderFields",
  renderable: Field,
  transform: Tile,
  registry: FieldNodes,
  create: () => new FieldView(),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

/** The land, redrawn when a new town is founded (or one loaded). */
let floorFor = ""
export const DrawLand = Game.System(
  "Town/DrawLand",
  { resources: { land: Game.System.readResource(Land) }, services: { stage: Game.System.service(StageService) } },
  ({ resources, services }) => {
    const mask = resources.land.get().mask
    if (mask === floorFor) return
    floorFor = mask
    services.stage.floor.clear()
    drawFloor(services.stage.floor, mask)
  }
)

/** Roads and water, each redrawn as one layer whenever one is laid or anything is removed. */
export const DrawGround = Game.System(
  "Town/DrawGround",
  {
    queries: {
      roads: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road] }),
      water: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Water] }),
      laid: Game.Query({ selection: { tile: Game.Query.read(Tile) }, filters: [Game.Query.added(Tile)] })
    },
    despawned: { entities: Game.System.readDespawned() },
    services: { stage: Game.System.service(StageService) }
  },
  ({ queries, despawned, services }) => {
    if (queries.laid.each().length === 0 && despawned.entities.all().length === 0) return
    const cellsOf = (rows: ReadonlyArray<{ readonly data: { readonly tile: { get(): TileLike } } }>) =>
      new Set(rows.map(({ data }) => key(data.tile.get().x, data.tile.get().y)))
    services.stage.roads.clear()
    drawRoads(services.stage.roads, cellsOf(queries.roads.each()))
    services.stage.ground.clear()
    drawWater(services.stage.ground, cellsOf(queries.water.each()))
  }
)

/**
 * Where a walker stands, in cells: on the lattice, a little to one side of
 * the road's middle; which way it faces; and which foot is forward.
 */
const walkerAt = (route: { readonly cells: ReadonlyArray<Point>; readonly index: number; readonly step: number }) => {
  const here = route.cells[route.index]!
  const next = route.cells[route.index + 1]
  const before = route.cells[route.index - 1]
  const dir = next ? { x: next.x - here.x, y: next.y - here.y } : before ? { x: here.x - before.x, y: here.y - before.y } : { x: 0, y: 0 }
  const units = next ? Math.floor(route.step / (CELL_STEPS / 16)) : 0
  const along = units * U
  const side = 2 * U
  return {
    x: here.x + 0.5 + dir.x * along - dir.y * side,
    y: here.y + 0.5 + dir.y * along + dir.x * side,
    dir,
    phase: next ? Math.floor(units / 3) % 2 : 0
  }
}

export const Animate = Game.System(
  "Town/Animate",
  {
    queries: {
      buildings: BuildingRead,
      houses: HouseRead,
      walkers: Game.Query({ selection: { route: Game.Query.read(Route), errand: Game.Query.optional(Errand), roam: Game.Query.optional(Roam) } }),
      trees: Game.Query({ selection: { tree: Game.Query.read(Tree) } }),
      rocks: Game.Query({ selection: { rock: Game.Query.read(Rock) } }),
      fields: Game.Query({ selection: { field: Game.Query.read(Field) } })
    },
    resources: { grid: Game.System.readResource(Grid) },
    services: {
      ui: Game.System.service(Ui),
      clock: Game.System.service(Clock),
      buildingNodes: Game.System.service(BuildingNodes),
      houseNodes: Game.System.service(HouseNodes),
      walkerNodes: Game.System.service(WalkerNodes),
      treeNodes: Game.System.service(TreeNodes),
      rockNodes: Game.System.service(RockNodes),
      fieldNodes: Game.System.service(FieldNodes)
    }
  },
  ({ queries, resources, services }) => {
    const grid = resources.grid.get()
    const { hover, danger } = services.ui.preview
    const emphasis = (id: number): Emphasis => (danger && hover === id ? "danger" : "normal")
    const dt = services.clock.deltaSeconds

    for (const { entity, data } of queries.buildings.each()) {
      const kind = kinds[data.building.get().kind]
      const status = data.status.get()
      const recipe = maybe(data.recipe)
      const walkers = maybe(data.walkers)?.length ?? 0
      services.buildingNodes.get(entity.id)?.update(
        {
          working: status === "working",
          problem: problemOf(kind, status) !== null,
          build: buildOf(maybe(data.site), maybe(data.rising)),
          beat: recipe ? recipe.made : maybe(data.service) ? walkers : 0,
          doors: doorsOf(grid, data.tile.get()),
          site: siteShare(maybe(data.site))
        },
        dt,
        emphasis(entity.id)
      )
    }
    for (const { entity, data } of queries.houses.each()) {
      services.houseNodes.get(entity.id)?.update(
        { tier: data.house.get().tier, build: buildOf(maybe(data.site), maybe(data.rising)), doors: doorsOf(grid, data.tile.get()), site: siteShare(maybe(data.site)) },
        emphasis(entity.id)
      )
    }
    for (const { entity, data } of queries.walkers.each()) {
      const p = walkerAt(data.route.get())
      const errand = maybe(data.errand)
      const roam = maybe(data.roam)
      const cargo = errand ? !errand.back || errand.count > 0 : roam ? total(roam.basket) > 0 : false
      services.walkerNodes.get(entity.id)?.update(p.x, p.y, p.dir, p.phase, cargo)
    }
    for (const { entity, data } of queries.trees.each()) services.treeNodes.get(entity.id)?.update(data.tree.get().growth, emphasis(entity.id))
    for (const { entity, data } of queries.rocks.each()) {
      const r = data.rock.get()
      services.rockNodes.get(entity.id)?.update(r.ore, r.amount)
    }
    for (const { entity, data } of queries.fields.each()) services.fieldNodes.get(entity.id)?.update(data.field.get().growth)
  }
)

/** Ghosts, the road being dragged, and outlines, redrawn every frame. */
export const DrawPreview = Game.System(
  "Town/DrawPreview",
  { services: { ui: Game.System.service(Ui), stage: Game.System.service(StageService), clock: Game.System.service(Clock) } },
  ({ services }) => {
    const { plots, ghosts, roads } = services.ui.preview
    const { overlay, ghost } = services.stage
    overlay.clear()
    ghost.clear()
    for (const plot of plots) drawPlot(overlay, plot.x, plot.y, plot.size, plot.look, services.clock.elapsed)
    if (roads.length > 0) drawRoads(overlay, new Set(roads.map((c) => key(c.x, c.y))), 0.6, 0x8f9891)
    for (const g of ghosts) drawGhost(ghost, g.what, g.cell.x, g.cell.y)
    ghost.alpha = 0.5
  }
)

export const present = Game.Schedule(
  Interact,
  DrawLand,
  RenderBuildings,
  RenderHouses,
  RenderWalkers,
  RenderTrees,
  RenderRocks,
  RenderFields,
  DrawGround,
  Animate,
  DrawPreview
)
