/**
 * What runs once a frame, after the simulation's steps: the pointer's
 * gestures become a selection, a preview, and edits for the next step; the
 * panel, tooltip, top bar, map views, and the town's alerts are filled in;
 * and the views follow the world.
 */
import { RenderSync } from "@typeonce/bevy-ts-render"

import { appealAt, appealParts, buildingSource, landSource, type AppealSource } from "./appeal.ts"
import { homeHeight, topOf, type Alert, type Load, type Emphasis } from "./art.ts"
import { BuildingView, HouseView, WalkerView, TreeView, RockView, FieldView, RuinView } from "./render3d/views.ts"
import type { DoorSet, OverlayCell } from "./render3d/models.ts"
import {
  BUILD_TICKS, COMMUTE, condition as wear, CONDITION_MAX, crewOf, crown as crownRules, fate, goodIds, goods, home, kinds, needTitle, risk,
  RISK_MAX, tierHome, total, winters, type Kind, type Tier
} from "./content.ts"
import { around, canPlace, doors, entrances, isRoad, key, lPath, reach, useAt, type TileLike } from "./grid.ts"
import { GRID, inside, U, type Point } from "./iso.ts"
import {
  Appeal,
  Building,
  BuildingNodes,
  Burning,
  Census,
  Charter,
  Chronicle,
  Clock,
  Condition,
  Crown,
  Errand,
  Fate,
  Field,
  FieldNodes,
  Figure,
  Game,
  Grid,
  History,
  House,
  HouseNodes,
  Inventory,
  Land,
  Ledger,
  Market,
  Mood,
  Pantry,
  Paused,
  Paved,
  Policy,
  Recipe,
  Rescue,
  Rising,
  Risk,
  Road,
  Roam,
  Rock,
  RockNodes,
  Route,
  Ruin,
  RuinNodes,
  Service,
  Sick,
  Site,
  Staff,
  StageService,
  Status,
  Stock,
  Tile,
  Time,
  TownHall,
  Treasury,
  Tree,
  TreeNodes,
  Ui,
  WalkerNodes,
  WalkerOf,
  Water,
  maybe,
  type GridValue,
  type Status as StatusValue
} from "./schema.ts"
import { capacity, CELL_STEPS, elapsed, goalsOf, larder, met, seasonAt, SITE_SHARE, taxOf, termTicks, winterOf } from "./sim/index.ts"
import { Townsfolk } from "./townsfolk.ts"
import { emptyPreview, type HitBox, type Legend, type View } from "./ui.ts"

const cellAt = (at: Point): Point => {
  return { x: Math.floor(at.x), y: Math.floor(at.y) }
}

/** The footprint `size` cells a side centred on a point, by its top cell. */
const footprintAt = (at: Point, size: number): Point => {
  return { x: Math.floor(at.x - (size - 1) / 2), y: Math.floor(at.y - (size - 1) / 2) }
}

/** A thing's hit area: its footprint on the floor, or its body as drawn. */
const hitBox = (id: number, tile: TileLike, _half: number, _height: number): HitBox => ({
  id,
  depth: tile.x + tile.y + tile.size,
  contains: (at) => at.x >= tile.x && at.x <= tile.x + tile.size && at.y >= tile.y && at.y <= tile.y + tile.size
})
const hitAt = (hits: ReadonlyArray<HitBox>, at: Point, entity?: number | null) =>
  entity === undefined ? (hits.find((h) => h.contains(at))?.id ?? null) : entity

/** Doors follow road entrances on all four sides as the camera turns. */
const doorsOf = (grid: GridValue, tile: TileLike): DoorSet => {
  const open = entrances(tile).filter((c) => isRoad(grid, c.x, c.y))
  return {
    right: open.some((c) => c.side === 0),
    left: open.some((c) => c.side === 1),
    backRight: open.some((c) => c.side === 2),
    backLeft: open.some((c) => c.side === 3)
  }
}

/** How far a kind's work reaches, if it works the land around it. */
const reachOf = (kind: Kind): number | null => kind.gathers?.radius ?? kind.plants?.radius ?? null

const sourceTitle = { tree: "grown trees", stone: "stone", ore: "ore", field: "ripe fields", water: "water" } as const

/** What a building's crew is short of, for its problem line. */
interface Crewing {
  readonly nearby: number
  readonly crew: "settlers" | "citizens"
}

/** Why a building is not working, in a line, or `null` when it is fine. */
const problemOf = (kind: Kind, status: StatusValue, growing = false, crewing?: Crewing): string | null => {
  switch (status) {
    case "unconnected":
      return "needs a road at the middle of one of its sides"
    case "unstaffed":
      if (crewing && crewing.nearby === 0)
        return `no workers nearby: no ${crewing.crew === "citizens" ? "citizens' (or settlers') homes" : "settlers' cottages"} within ${COMMUTE} road cells`
      return "no workers: every one nearby already has a job"
    case "blocked":
      return "full: nowhere to take what it makes"
    case "paused":
      return "paused: no workers, a quarter of its upkeep"
    case "starved":
      if (kind.gathers && growing) return `the ${kind.gathers.source === "tree" ? "trees" : "fields"} in reach are still growing`
      if (kind.gathers)
        return `no ${sourceTitle[kind.gathers.source]} within ${kind.gathers.radius} cells${kind.gathers.source === "tree" ? ": a forester nearby replants" : ""}`
      if (kind.recipe?.input) return `waiting for ${kind.recipe.input}`
      if (kind.service?.service === "goods") return "nothing to hand out: no fish, bread, or cloth here"
      if (kind.service?.service === "repair") return "no planks to mend with"
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
    paused: Game.Query.optional(Paused),
    risk: Game.Query.optional(Risk),
    condition: Game.Query.optional(Condition),
    burning: Game.Query.optional(Burning)
  }
})
const HouseRead = Game.Query({
  selection: {
    tile: Game.Query.read(Tile),
    house: Game.Query.read(House),
    site: Game.Query.optional(Site),
    rising: Game.Query.optional(Rising),
    risk: Game.Query.optional(Risk),
    condition: Game.Query.optional(Condition),
    burning: Game.Query.optional(Burning),
    sick: Game.Query.optional(Sick)
  }
})
const RuinRead = Game.Query({ selection: { tile: Game.Query.read(Tile), ruin: Game.Query.read(Ruin) } })

/** How far up a building or home is: a site rises to its frame as materials come in, then the rest of the way. */
const buildOf = (
  site: { readonly owed: Parameters<typeof total>[0]; readonly total: number } | undefined,
  rising: { readonly ticks: number } | undefined
) => (site ? PLATE_SHARE + (SITE_SHARE - PLATE_SHARE) * delivered(site) : rising ? rising.ticks / BUILD_TICKS : 1)

const siteShare = (site: { readonly owed: Parameters<typeof total>[0]; readonly total: number } | undefined) =>
  site ? delivered(site) : null

/** A site's plate is marked out the moment it is placed. */
const PLATE_SHARE = 0.12
/** The share of a site's materials that has arrived. */
const delivered = (site: { readonly owed: Parameters<typeof total>[0]; readonly total: number }) =>
  1 - total(site.owed) / Math.max(1, site.total)

const percent = (n: number, of: number) => `${Math.round((n / of) * 100)}%`
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

/** The sign over a home or building: what is wrong now, or the risk nearest the top past `risk.warn`. */
const alertOf = (r: { readonly fire: number; readonly health: number; readonly order: number } | undefined, sick: boolean, worn: boolean): Alert | null => {
  if (sick) return "sick"
  if (r) {
    const worst = (["fire", "health", "order"] as const).reduce((a, b) => (r[b] > r[a] ? b : a))
    if (r[worst] >= risk.warn) return worst
  }
  return worn ? "worn" : null
}

/** How a risk reads: "low", "40%", or "high: 85%". */
const riskText = (value: number) => (value < RISK_MAX * 0.35 ? "ok" : value >= risk.warn ? `high, ${percent(value, RISK_MAX)}` : percent(value, RISK_MAX))

// ── Map views ─────────────────────────────────────────────────────────────

const GOOD = 0x4f9a6a
const FAIR = 0xc9b45a
const BAD = 0xc4523f
const COOL = 0x3d6db5
/** A meter 0 → `of` as a colour: green when low, amber, red past the warning line. */
const meterColor = (value: number, of: number, warn: number) => (value >= warn ? BAD : value >= of * 0.35 ? FAIR : GOOD)

const legends: Readonly<Record<Exclude<View, "none">, Legend>> = {
  appeal: {
    title: "desirability",
    keys: [
      { color: 0x2f7a43, label: `${home.tiers[3].appeal}+: townhouses` },
      { color: GOOD, label: `${home.tiers[2].appeal}+: citizens` },
      { color: 0xc9d6a0, label: "0 to 4" },
      { color: 0xe0a060, label: "below 0" },
      { color: BAD, label: `${home.squalid} or less: squalid` }
    ],
    note: "Industry pushes homes away; gardens, parks, fountains, statues, a chapel, and paved streets draw them in."
  },
  workers: {
    title: "workers",
    keys: [
      { color: GOOD, label: "fully staffed" },
      { color: FAIR, label: "short of workers" },
      { color: BAD, label: "no workers" },
      { color: 0xd6b48a, label: "settlers' homes" },
      { color: COOL, label: "citizens' homes" }
    ],
    note: `Residents walk at most ${COMMUTE} road cells to work. Select a workplace to see its reach and the homes inside it.`
  },
  fire: {
    title: "fire",
    keys: [
      { color: GOOD, label: "watched" },
      { color: FAIR, label: "rising" },
      { color: BAD, label: "at risk, or burning" }
    ],
    note: "A fire watch's watchman resets the risk of every home and workshop along the way. Wooden cottages, ovens, forges, and crowding raise it."
  },
  health: {
    title: "health",
    keys: [
      { color: GOOD, label: "visited" },
      { color: FAIR, label: "rising" },
      { color: BAD, label: "at risk, or sick" }
    ],
    note: "A healer's physician resets the risk and cures the sick. Hunger, crowding, squalor, quarry dust, and still water raise it."
  },
  order: {
    title: "order",
    keys: [
      { color: GOOD, label: "kept" },
      { color: FAIR, label: "rising" },
      { color: BAD, label: "thieves about" }
    ],
    note: "A watch house's constable keeps order. Low approval, squalor, and homes not full raise it; theft first, then the home is left derelict."
  },
  condition: {
    title: "condition",
    keys: [
      { color: GOOD, label: "well kept" },
      { color: FAIR, label: "needs mending" },
      { color: BAD, label: "run down: half pace" }
    ],
    note: "A builder's yard mends what its builder passes with planks and stone. At nothing it falls down."
  }
}

const appealColor = (v: number) =>
  v >= home.tiers[3].appeal ? 0x2f7a43 : v >= home.tiers[2].appeal ? GOOD : v >= 0 ? 0xc9d6a0 : v > home.squalid ? 0xe0a060 : BAD

export const Interact = Game.System(
  "Town/Interact",
  {
    queries: {
      buildings: BuildingRead,
      houses: HouseRead,
      ruins: RuinRead,
      trees: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Tree] }),
      water: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Water] }),
      paved: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road, Paved] })
    },
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
      chronicle: Game.System.readResource(Chronicle),
      appeal: Game.System.readResource(Appeal),
      pantry: Game.System.readResource(Pantry)
    },
    services: { ui: Game.System.service(Ui) }
  },
  ({ queries, resources, services }) => {
    const ui = services.ui
    const grid = resources.grid.get()
    const rates = resources.policy.get()
    const approval = resources.mood.get().approval
    const cells = resources.appeal.get().cells
    const buildings = queries.buildings.each()
    const houses = queries.houses.each()
    const ruins = queries.ruins.each()

    const hits: Array<HitBox> = [
      ...buildings.map(({ entity, data }) => {
        const kind = kinds[data.building.get().kind]
        return hitBox(entity.id, data.tile.get(), kind.half, topOf(kind))
      }),
      ...houses.map(({ entity, data }) => hitBox(entity.id, data.tile.get(), home.half, homeHeight(data.house.get().tier))),
      ...ruins.map(({ entity, data }) => hitBox(entity.id, data.tile.get(), 0, 0))
    ].sort((l, r) => r.depth - l.depth)
    ui.hits = hits
    const tileOf = (id: number) => [...buildings, ...houses, ...ruins].find((row) => row.entity.id === id)?.data.tile.get()

    // ── Gestures ──
    for (const gesture of ui.gestures.splice(0)) {
      const cell = cellAt(gesture.at)
      if (gesture.type === "press") {
        ui.dragFrom = (ui.tool === "road" || ui.tool === "home" || ui.tool === "pave") && inside(cell.x, cell.y) ? cell : null
        continue
      }
      switch (ui.tool) {
        case "road":
        case "pave":
        case "home": {
          if (ui.dragFrom) {
            const cells = lPath(ui.dragFrom, cell).filter((c) => inside(c.x, c.y))
            ui.edits.push(ui.tool === "road" ? { type: "roads", cells } : ui.tool === "pave" ? { type: "pave", cells } : { type: "homes", cells })
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
          const hit = hitAt(hits, gesture.at, gesture.hit)
          ui.edits.push({ type: "remove", cell: (hit !== null ? tileOf(hit) : undefined) ?? cell })
          break
        }
        case "select": {
          if (gesture.panned) break
          ui.selected = hitAt(hits, gesture.at, gesture.hit)
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
    preview.hover = pointer && (ui.tool === "select" || ui.tool === "bulldoze") ? hitAt(hits, pointer, ui.pointerHit) : null
    const showReach = (tile: TileLike, kind: Kind) => {
      const r = reachOf(kind)
      if (r !== null) preview.plots.push({ x: tile.x - r, y: tile.y - r, size: tile.size + 2 * r, look: "reach" })
    }
    const pavedCells = new Set(queries.paved.each().map(({ data }) => key(data.tile.get().x, data.tile.get().y)))

    if (ui.tool === "road" || ui.tool === "home" || ui.tool === "pave") {
      const cells = cell === null ? [] : ui.dragFrom ? lPath(ui.dragFrom, cell) : [cell]
      for (const c of cells) {
        if (!inside(c.x, c.y)) continue
        const free = canPlace(grid, { ...c, size: 1 })
        if (ui.tool === "road") {
          if (free) preview.roads.push(c)
          else if (useAt(grid, c.x, c.y) !== "road") preview.plots.push({ ...c, size: 1, look: "blocked" })
        } else if (ui.tool === "pave") {
          const road = useAt(grid, c.x, c.y) === "road"
          if (road && !pavedCells.has(key(c.x, c.y))) preview.plots.push({ ...c, size: 1, look: "reach" })
          else if (!road) preview.plots.push({ ...c, size: 1, look: "blocked" })
        } else if (free) preview.ghosts.push({ what: "home", cell: c })
        else preview.plots.push({ ...c, size: 1, look: "blocked" })
      }
    } else if (ui.tool === "place" && ui.placing && pointer) {
      const kind = kinds[ui.placing]
      const at = footprintAt(pointer, kind.size)
      const tile = { ...at, size: kind.size }
      showReach(tile, kind)
      if (kind.appeal && kind.appeal.value > 0) preview.plots.push({ x: tile.x - kind.appeal.reach, y: tile.y - kind.appeal.reach, size: tile.size + 2 * kind.appeal.reach, look: "reach" })
      if (canPlace(grid, tile)) preview.ghosts.push({ what: ui.placing, cell: at })
      else preview.plots.push({ ...tile, look: "blocked" })
    } else if (ui.tool === "bulldoze") {
      preview.danger = true
      if (preview.hover === null && cell && ["road", "tree", "field"].includes(useAt(grid, cell.x, cell.y)))
        preview.plots.push({ ...cell, size: 1, look: "blocked" })
    }
    if (ui.selected !== null) {
      const row = buildings.find((b) => b.entity.id === ui.selected)
      const tile = tileOf(ui.selected)
      if (tile) preview.plots.push({ ...tile, look: "picked" })
      if (row && tile) showReach(tile, kinds[row.data.building.get().kind])
    }

    // ── The neighbourhood, explained (only when a home asks) ──
    let sources: Array<AppealSource> | null = null
    const appealSources = () => {
      if (sources) return sources
      sources = []
      for (const { data } of buildings) {
        if (data.site.present || data.rising.present) continue
        const s = buildingSource(data.building.get().kind, data.tile.get())
        if (s) sources.push(s)
      }
      for (const { data } of queries.trees.each()) sources.push(landSource("forest", data.tile.get()))
      for (const { data } of queries.water.each()) sources.push(landSource("water", data.tile.get()))
      for (const { data } of queries.paved.each()) sources.push(landSource("paved", data.tile.get()))
      for (const { data } of ruins) sources.push(landSource("ruin", data.tile.get()))
      for (const { data } of houses) if ((maybe(data.condition)?.value ?? CONDITION_MAX) < wear.worn) sources.push(landSource("worn", data.tile.get()))
      return sources
    }
    /** Where a home's residents work: the nearest workplace of their crew in reach that has them. */
    const workOf = (tile: TileLike, tier: Tier) => {
      const ds = doors(grid, tile)
      if (ds.length === 0) return null
      const roads = reach(grid, ds)
      let best: { title: string; distance: number } | null = null
      for (const { data } of buildings) {
        const kind = kinds[data.building.get().kind]
        const staff = data.staff.get()
        if (staff.needed === 0 || staff.assigned === 0 || (kind.crew !== crewOf(tier) && !(tier === 1 && staff.apprentices > 0))) continue
        for (const d of doors(grid, data.tile.get())) {
          const n = roads.distance[key(d.x, d.y)]!
          if (n >= 0 && n <= COMMUTE && (best === null || n < best.distance)) best = { title: kind.title.toLowerCase(), distance: n }
        }
      }
      return best
    }

    // ── Tooltip and panel ──
    const describeBuilding = (row: (typeof buildings)[number]) => {
      const kind = kinds[row.data.building.get().kind]
      const status = row.data.status.get()
      const site = maybe(row.data.site)
      const lines: Array<string> = []
      if (site) {
        const owed = Object.entries(site.owed)
          .filter(([, n]) => n > 0)
          .map(([g, n]) => `${n} ${g}`)
        lines.push(owed.length > 0 ? `waiting for ${owed.join(", ")}` : "going up")
        return { kind, status, problem: null, lines }
      }
      const staff = row.data.staff.get()
      if (staff.needed > 0) {
        lines.push(`workers ${staff.assigned} of ${staff.needed}${staff.apprentices > 0 ? ` (${staff.apprentices} settler apprentice${staff.apprentices > 1 ? "s" : ""}: slower)` : ""}`)
        lines.push(`${kind.crew} within ${COMMUTE} cells: ${staff.nearby}`)
      }
      const recipe = maybe(row.data.recipe)
      const inventory = maybe(row.data.inventory)
      if (recipe)
        lines.push(
          `${recipe.input ? `${recipe.inputs} ${recipe.input} → ` : ""}${recipe.batch} ${goods[recipe.output].title} · ${recipe.made} made`
        )
      if (inventory && !maybe(row.data.hall)) {
        const held = inventory.accepts.filter((g) => inventory.stock[g] > 0).map((g) => `${inventory.stock[g]} ${goods[g].title}`)
        lines.push(held.length > 0 ? `holds ${held.join(", ")}` : "holds nothing yet")
      }
      if (kind.wear && inventory) lines.push(inventory.stock.tools > 0 ? `tools on hand ${inventory.stock.tools} · one wears out every ${kind.wear} jobs` : "no tools: half pace until a carrier brings one")
      const condition = maybe(row.data.condition)
      if (condition) lines.push(`condition ${percent(condition.value, CONDITION_MAX)}${condition.value < wear.worn ? ": run down, half pace" : condition.value < wear.mend ? ": a builder would mend it" : ""}`)
      const r = maybe(row.data.risk)
      if (r) lines.push(`fire risk ${riskText(r.fire)}${kind.hot ? " · an oven or a forge" : ""}`)
      if (kind.appeal) lines.push(`desirability ${signed(kind.appeal.value)} beside it, out to ${kind.appeal.reach} cells`)
      const walkers = maybe(row.data.walkers)?.length ?? 0
      if (walkers > 0) lines.push(`${walkers} out on the roads`)
      if (kind.upkeep > 0) lines.push(`upkeep ${kind.upkeep} coins a minute`)
      const growing = status === "starved" && growingNear(grid, row.data.tile.get(), kind)
      const problem = row.data.burning.present ? "on fire!" : problemOf(kind, status, growing, { nearby: staff.nearby, crew: kind.crew })
      return { kind, status, problem, lines }
    }
    const describeHouse = (row: (typeof houses)[number]) => {
      const h = row.data.house.get()
      const site = maybe(row.data.site)
      if (site) return { h, lines: ["waiting for its planks"] }
      const tile = row.data.tile.get()
      const tier = home.tiers[h.tier]
      const next = h.tier < 3 ? home.tiers[(h.tier + 1) as Tier] : null
      const mark = (n: Parameters<typeof met>[1]) => `${needTitle[n]} ${met(h, n) ? "✓" : "–"}`
      const there = appealParts(appealSources(), tile)
      const desirability = appealAt(cells, tile.x, tile.y)
      const r = maybe(row.data.risk)
      const work = workOf(tile, h.tier)
      const condition = maybe(row.data.condition)
      return {
        h,
        lines: [
          ...(row.data.burning.present ? ["on fire: everyone has fled"] : row.data.sick.present ? ["sick: it holds half as many until it passes or a physician calls, and it may spread"] : []),
          `${h.residents} of ${capacity(h, approval, desirability)} residents (${tier.residents} at most)`,
          `needs: ${tier.needs.map(mark).join(" · ")}`,
          ...(next ? [`to become ${next.title}: ${next.needs.map(mark).join(" · ")} · desirability ${next.appeal}${h.tier === 2 ? " · fire, health, and order kept" : ""}`] : []),
          `desirability ${desirability}${there.parts.length > 0 ? ` (${there.parts.slice(0, 5).map((p) => `${p.label} ${signed(p.value)}`).join(", ")})` : ""}`,
          ...(r ? [`fire ${riskText(r.fire)} · health ${riskText(r.health)} · order ${riskText(r.order)}${r.thefts > 0 ? " · robbed" : ""}`] : []),
          ...(condition ? [`condition ${percent(condition.value, CONDITION_MAX)}`] : []),
          work ? `work: ${work.title}, ${work.distance} cells` : `work: none within ${COMMUTE} cells`,
          `pays ${Math.round(taxOf(h, rates))} coins a minute`
        ]
      }
    }

    const hovered = preview.hover
    const hoveredBuilding = hovered !== null ? buildings.find((row) => row.entity.id === hovered) : undefined
    const hoveredHouse = hovered !== null ? houses.find((row) => row.entity.id === hovered) : undefined
    const hoveredRuin = hovered !== null ? ruins.find((row) => row.entity.id === hovered) : undefined
    if (hoveredBuilding) {
      const { kind, status, problem } = describeBuilding(hoveredBuilding)
      preview.tooltip = `${kind.title.toLowerCase()} · ${problem ?? status}`
    } else if (hoveredHouse) {
      const h = hoveredHouse.data.house.get()
      const t = hoveredHouse.data.tile.get()
      preview.tooltip = `${tierHome[h.tier]} · ${h.residents} residents · desirability ${appealAt(cells, t.x, t.y)}${hoveredHouse.data.burning.present ? " · on fire!" : hoveredHouse.data.sick.present ? " · sick" : ""}`
    } else if (hoveredRuin) {
      preview.tooltip = `ruin · ${hoveredRuin.data.ruin.get().cause} · bulldoze to clear`
    } else if (ui.tool === "place" && ui.placing) {
      const kind = kinds[ui.placing]
      const r = reachOf(kind)
      const a = kind.appeal
      preview.tooltip = `${kind.title.toLowerCase()}${r !== null ? ` · works ${r} cells around` : ""}${a ? ` · desirability ${signed(a.value)} out to ${a.reach} cells` : ""}`
    } else if (ui.tool === "pave") preview.tooltip = "drag along a road to pave it · 3 coins and a stone a cell"
    else if (cell && ui.view === "appeal" && inside(cell.x, cell.y)) preview.tooltip = `desirability ${appealAt(cells, cell.x, cell.y)}`
    ui.preview = preview

    const pickedBuilding = ui.selected !== null ? buildings.find((row) => row.entity.id === ui.selected) : undefined
    const pickedHouse = ui.selected !== null ? houses.find((row) => row.entity.id === ui.selected) : undefined
    const pickedRuin = ui.selected !== null ? ruins.find((row) => row.entity.id === ui.selected) : undefined
    if (pickedBuilding) {
      const { kind, status, problem, lines } = describeBuilding(pickedBuilding)
      const pausable = kind.id !== "townhall" && !kind.decor && !pickedBuilding.data.site.present && !pickedBuilding.data.rising.present
      ui.panel = {
        type: "building",
        id: pickedBuilding.entity.id,
        cell: pickedBuilding.data.tile.get(),
        kind: kind.id,
        status,
        problem,
        lines,
        pausable,
        paused: pickedBuilding.data.paused.present
      }
    } else if (pickedHouse) {
      const { h, lines } = describeHouse(pickedHouse)
      ui.panel = { type: "house", id: pickedHouse.entity.id, cell: pickedHouse.data.tile.get(), tier: h.tier, lines }
    } else if (pickedRuin) {
      const r = pickedRuin.data.ruin.get()
      ui.panel = {
        type: "ruin",
        id: pickedRuin.entity.id,
        cell: pickedRuin.data.tile.get(),
        cause: r.cause,
        lines: [
          r.cause === "burnt" ? "burned down" : r.cause === "collapsed" ? "fell down for want of mending" : "left derelict after its thefts",
          `desirability −3 around it until it is cleared`
        ]
      }
    } else ui.panel = ui.menu ? { type: ui.menu } : null

    const centres = new Map<number, Point>()
    for (const { entity, data } of [...buildings, ...houses]) {
      const t = data.tile.get()
      centres.set(entity.id, { x: t.x + t.size / 2, y: t.y + t.size / 2 })
    }
    ui.centres = centres

    // ── Map views ──
    const view = ui.view
    const tick = resources.time.get().tick
    const overlayKey = `${view}|${Math.floor(tick / 30)}|${ui.selected}|${buildings.length}|${houses.length}`
    if (view === "none") {
      if (ui.overlay.key !== "none") ui.overlay = { key: "none", cells: [] }
      ui.legend = null
    } else if (ui.overlay.key !== overlayKey) {
      const out: Array<OverlayCell> = []
      const standing = <T extends { readonly data: { readonly site: { readonly present: boolean }; readonly rising: { readonly present: boolean } } }>(rows: ReadonlyArray<T>) =>
        rows.filter(({ data }) => !data.site.present && !data.rising.present)
      if (view === "appeal") {
        for (let y = 0; y < GRID; y++)
          for (let x = 0; x < GRID; x++) {
            const use = useAt(grid, x, y)
            if (use === "void" || use === "water") continue
            out.push({ x, y, size: 1, color: appealColor(appealAt(cells, x, y)), alpha: 0.32 })
          }
      } else if (view === "workers") {
        const picked = pickedBuilding && pickedBuilding.data.staff.get().needed > 0 ? pickedBuilding : undefined
        let inReach: ((t: TileLike) => boolean) | null = null
        if (picked) {
          const roads = reach(grid, doors(grid, picked.data.tile.get()))
          for (let k = 0; k < roads.distance.length; k++) {
            const d = roads.distance[k]!
            if (d >= 0 && d <= COMMUTE) out.push({ x: k % GRID, y: Math.floor(k / GRID), size: 1, color: COOL, alpha: 0.18 })
          }
          inReach = (t) => doors(grid, t).some((c) => {
            const n = roads.distance[key(c.x, c.y)]!
            return n >= 0 && n <= COMMUTE
          })
        }
        for (const { data } of standing(houses)) {
          const t = data.tile.get()
          const h = data.house.get()
          const ring = inReach !== null && inReach(t)
          out.push({ ...t, color: h.tier === 1 ? 0xd6b48a : COOL, alpha: ring ? 0.75 : 0.45, ...(ring ? { ring: true } : {}) })
        }
        for (const { entity, data } of standing(buildings)) {
          const s = data.staff.get()
          if (s.needed === 0) continue
          const color = s.assigned >= s.needed ? GOOD : s.assigned > 0 ? FAIR : BAD
          out.push({ ...data.tile.get(), color, alpha: 0.45, ...(entity.id === picked?.entity.id ? { ring: true } : {}) })
        }
      } else if (view === "fire" || view === "health" || view === "order") {
        for (const { data } of standing(houses)) {
          const r = maybe(data.risk)
          if (!r) continue
          const struck = view === "fire" ? data.burning.present : view === "health" ? data.sick.present : r.thefts > 0
          out.push({ ...data.tile.get(), color: struck ? BAD : meterColor(r[view], RISK_MAX, risk.warn), alpha: struck ? 0.8 : 0.5 })
        }
        for (const { data } of standing(buildings)) {
          const service = maybe(data.service)?.service
          const r = maybe(data.risk)
          if (service === view) out.push({ ...data.tile.get(), color: COOL, alpha: 0.55, ring: true })
          else if (view === "fire" && r) out.push({ ...data.tile.get(), color: data.burning.present ? BAD : meterColor(r.fire, RISK_MAX, risk.warn), alpha: 0.4 })
        }
      } else if (view === "condition") {
        for (const row of [...standing(houses), ...standing(buildings)]) {
          const c = maybe(row.data.condition)
          if (!c) continue
          out.push({ ...row.data.tile.get(), color: c.value < wear.worn ? BAD : c.value < wear.mend ? FAIR : GOOD, alpha: 0.5 })
        }
        for (const { data } of standing(buildings)) if (maybe(data.service)?.service === "repair") out.push({ ...data.tile.get(), color: COOL, alpha: 0.55, ring: true })
        for (const { data } of ruins) out.push({ ...data.tile.get(), color: BAD, alpha: 0.8 })
      }
      ui.overlay = { key: overlayKey, cells: out }
      ui.legend = legends[view]
    }

    // ── What needs looking at ──
    const alerts: Array<string> = []
    const census = resources.census.get()
    const stock = resources.stock.get()
    if (census.burning > 0) alerts.push(`${census.burning} on fire`)
    if (census.sick > 0) alerts.push(`${census.sick} home${census.sick > 1 ? "s" : ""} sick`)
    const waiting = new Map<string, number>()
    const remote = new Map<string, number>()
    for (const { data } of buildings) {
      if (data.site.present || data.rising.present || data.paused.present) continue
      const kind = kinds[data.building.get().kind]
      const status = data.status.get()
      if (status === "starved" && kind.recipe?.input) waiting.set(`${kind.title.toLowerCase()} (${kind.recipe.input})`, (waiting.get(`${kind.title.toLowerCase()} (${kind.recipe.input})`) ?? 0) + 1)
      if (status === "unstaffed" && data.staff.get().nearby === 0) remote.set(kind.title.toLowerCase(), (remote.get(kind.title.toLowerCase()) ?? 0) + 1)
    }
    const list = (m: Map<string, number>) => [...m].map(([k, n]) => `${k}${n > 1 ? ` ×${n}` : ""}`).join(", ")
    if (waiting.size > 0) alerts.push(`waiting for inputs: ${list(waiting)}`)
    if (remote.size > 0) alerts.push(`no workers nearby: ${list(remote)}`)
    if (census.homes > 0 && larder(stock) === 0) alerts.push("no food in store")

    const ledger = resources.ledger.get()
    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    const coins = resources.treasury.get().coins
    const net = ledger.taxes + ledger.trade - ledger.upkeep - ledger.admin
    const mood = resources.mood.get()
    const crown = resources.crown.get()
    const f = resources.fate.get()
    const pantry = resources.pantry.get()
    const season = seasonAt(Math.min(Math.max(0, t), termTicks(charter) - 1), charter)
    const seconds = (steps: number) => Math.max(0, Math.ceil(steps / 60))
    const danger = (since: number, minutes: number) => (since < 0 ? null : seconds(since + minutes * 3600 - t))
    // The winter after the coming one, for the almanac.
    const comingYear = season.winter || winterOf(charter, season.year) === null ? season.year + 1 : season.year
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
      burghers: census.burghers,
      jobs: census.jobs,
      employed: census.employed,
      charter: { size: charter.size, term: charter.term, land: charter.land, seed: charter.seed },
      minute: t / 3600,
      season: {
        year: season.year,
        winter: season.winter,
        left: seconds(season.left),
        severity: season.severity,
        coming: season.coming,
        after: winterOf(charter, comingYear + 1)
      },
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
        open: crown.open,
        good: crown.good,
        amount: crown.amount,
        left: seconds(crown.due - t),
        reward: crown.reward,
        met: crown.met,
        missed: crown.missed,
        streak: crown.streak,
        patience: crownRules.patience,
        next: seconds(crown.next - t)
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
      eaten: pantry.eatenLast,
      rotted: pantry.rottedLast,
      sick: census.sick,
      burning: census.burning,
      history: resources.history.get().samples,
      chronicle: resources.chronicle.get().lines,
      alerts
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
  create: ({ renderable, services, entity }) => new BuildingView(renderable.kind, services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderHouses = RenderSync.system(Game, {
  name: "Town/RenderHouses",
  renderable: House,
  transform: Tile,
  registry: HouseNodes,
  services: { stage: StageService },
  create: ({ services, entity }) => new HouseView(services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderWalkers = RenderSync.system(Game, {
  name: "Town/RenderWalkers",
  renderable: Figure,
  registry: WalkerNodes,
  services: { stage: StageService },
  create: ({ renderable, services, entity }) => WalkerView.forFigure(renderable.role, renderable.color, services.stage, entity),
  apply: () => {}
})

export const RenderTrees = RenderSync.system(Game, {
  name: "Town/RenderTrees",
  renderable: Tree,
  transform: Tile,
  registry: TreeNodes,
  services: { stage: StageService },
  create: ({ services, entity }) => new TreeView(services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderRocks = RenderSync.system(Game, {
  name: "Town/RenderRocks",
  renderable: Rock,
  transform: Tile,
  registry: RockNodes,
  services: { stage: StageService },
  create: ({ services, entity }) => new RockView(services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

export const RenderRuins = RenderSync.system(Game, {
  name: "Town/RenderRuins",
  renderable: Ruin,
  transform: Tile,
  registry: RuinNodes,
  services: { stage: StageService },
  create: ({ renderable, services, entity }) => new RuinView(renderable.cause, services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y, transform.size)
})

export const RenderFields = RenderSync.system(Game, {
  name: "Town/RenderFields",
  renderable: Field,
  transform: Tile,
  registry: FieldNodes,
  services: { stage: StageService },
  create: ({ services, entity }) => new FieldView(services.stage, entity),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

/** The land, redrawn when a new town is founded (or one loaded), and frosted through winter. */
export const DrawLand = Game.System(
  "Town/DrawLand",
  {
    resources: { land: Game.System.readResource(Land), time: Game.System.readResource(Time), charter: Game.System.readResource(Charter) },
    services: { stage: Game.System.service(StageService) }
  },
  ({ resources, services }) => {
    const mask = resources.land.get().mask
    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    services.stage.setLand(mask, t > 0 && seasonAt(Math.min(t, termTicks(charter) - 1), charter).winter)
  }
)

/** The map view, washed over the town. */
export const DrawOverlay = Game.System(
  "Town/DrawOverlay",
  { services: { ui: Game.System.service(Ui), stage: Game.System.service(StageService) } },
  ({ services }) => {
    services.stage.setOverlay(services.ui.overlay.key, services.ui.overlay.cells)
  }
)

/** Roads and water, each redrawn as one layer whenever one is laid or anything is removed. */
export const DrawGround = Game.System(
  "Town/DrawGround",
  {
    queries: {
      roads: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road] }),
      paved: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road, Paved] }),
      added: Game.Query({ selection: { paved: Game.Query.read(Paved) }, filters: [Game.Query.added(Paved)] }),
      water: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Water] }),
      laid: Game.Query({ selection: { tile: Game.Query.read(Tile) }, filters: [Game.Query.added(Tile)] })
    },
    despawned: { entities: Game.System.readDespawned() },
    services: { stage: Game.System.service(StageService) }
  },
  ({ queries, despawned, services }) => {
    if (!services.stage.groundDirty && queries.laid.each().length === 0 && queries.added.each().length === 0 && despawned.entities.all().length === 0) return
    const cellsOf = (rows: ReadonlyArray<{ readonly data: { readonly tile: { get(): TileLike } } }>) =>
      new Set(rows.map(({ data }) => key(data.tile.get().x, data.tile.get().y)))
    services.stage.setGround(cellsOf(queries.roads.each()), cellsOf(queries.water.each()), cellsOf(queries.paved.each()))
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
      ruins: RuinRead,
      walkers: Game.Query({
        selection: {
          route: Game.Query.read(Route),
          errand: Game.Query.optional(Errand),
          roam: Game.Query.optional(Roam),
          rescue: Game.Query.optional(Rescue)
        }
      }),
      trees: Game.Query({ selection: { tree: Game.Query.read(Tree) } }),
      rocks: Game.Query({ selection: { rock: Game.Query.read(Rock) } }),
      fields: Game.Query({ selection: { field: Game.Query.read(Field) } })
    },
    resources: { grid: Game.System.readResource(Grid), appeal: Game.System.readResource(Appeal) },
    services: {
      ui: Game.System.service(Ui),
      clock: Game.System.service(Clock),
      ruinNodes: Game.System.service(RuinNodes),
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
    const cells = resources.appeal.get().cells
    const { hover, danger } = services.ui.preview
    const emphasis = (id: number): Emphasis => (danger && hover === id ? "danger" : "normal")
    const dt = services.clock.deltaSeconds

    for (const { entity, data } of queries.buildings.each()) {
      const kind = kinds[data.building.get().kind]
      const status = data.status.get()
      const recipe = maybe(data.recipe)
      const walkers = maybe(data.walkers)?.length ?? 0
      const worn = (maybe(data.condition)?.value ?? CONDITION_MAX) < wear.worn
      const r = maybe(data.risk)
      services.buildingNodes.get(entity.id)?.update(
        {
          alert: alertOf(r ? { fire: r.fire, health: 0, order: 0 } : undefined, false, worn),
          burning: data.burning.present,
          worn,
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
      const tile = data.tile.get()
      const worn = (maybe(data.condition)?.value ?? CONDITION_MAX) < wear.worn
      const desirability = appealAt(cells, tile.x, tile.y)
      services.houseNodes
        .get(entity.id)
        ?.update(
          {
            tier: data.house.get().tier,
            build: buildOf(maybe(data.site), maybe(data.rising)),
            doors: doorsOf(grid, tile),
            site: siteShare(maybe(data.site)),
            alert: data.site.present ? null : alertOf(maybe(data.risk), data.sick.present, worn),
            burning: data.burning.present,
            worn,
            band: desirability < 0 ? "poor" : desirability >= home.tiers[2].appeal ? "fine" : "plain"
          },
          emphasis(entity.id)
        )
    }
    for (const { entity } of queries.ruins.each()) services.ruinNodes.get(entity.id)?.update(emphasis(entity.id))
    for (const { entity, data } of queries.walkers.each()) {
      const p = walkerAt(data.route.get())
      const errand = maybe(data.errand)
      const roam = maybe(data.roam)
      const load: Load = errand
        ? { kind: "cart", good: errand.good, count: !errand.back || errand.count > 0 ? errand.count : 0 }
        : roam?.service === "faith" || roam?.service === "health"
          ? { kind: "bell" }
          : roam && total(roam.basket) > 0
            ? { kind: "basket", goods: goodIds.filter((g) => roam.basket[g] > 0) }
            : { kind: "none" }
      services.walkerNodes.get(entity.id)?.update(p.x, p.y, p.dir, p.phase, load)
    }
    for (const { entity, data } of queries.trees.each())
      services.treeNodes.get(entity.id)?.update(data.tree.get().growth, emphasis(entity.id))
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
    services.stage.setPreview(services.ui.preview, services.clock.elapsed)
  }
)

/** Residents out walking (see `townsfolk.ts`), on the town's time: still while it waits. */
let townsfolk: { readonly folk: Townsfolk; land: string; generation: number; stage: unknown } | null = null
export const Stroll = Game.System(
  "Town/Stroll",
  {
    queries: { houses: HouseRead },
    resources: { grid: Game.System.readResource(Grid), land: Game.System.readResource(Land) },
    services: { ui: Game.System.service(Ui), clock: Game.System.service(Clock), stage: Game.System.service(StageService) }
  },
  ({ queries, resources, services }) => {
    const ui = services.ui
    if (townsfolk?.stage !== services.stage) {
      townsfolk?.folk.clear()
      townsfolk = { folk: new Townsfolk(services.stage), land: "", generation: -1, stage: services.stage }
    }
    const mask = resources.land.get().mask
    if (mask !== townsfolk.land || townsfolk.generation !== services.stage.generation) {
      townsfolk.generation = services.stage.generation
      townsfolk.land = mask
      townsfolk.folk.clear()
    }
    const waiting = ui.founding || (ui.stats !== null && ui.stats.fate.state !== "playing")
    const homes = queries.houses
      .each()
      .filter(({ data }) => !maybe(data.site) && !maybe(data.rising))
      .map(({ data }) => ({ ...data.tile.get(), tier: data.house.get().tier, residents: data.house.get().residents }))
    townsfolk.folk.step(waiting ? 0 : services.clock.deltaSeconds * ui.speed, homes, resources.grid.get())
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
  RenderRuins,
  DrawGround,
  DrawOverlay,
  Animate,
  Stroll,
  DrawPreview
)
