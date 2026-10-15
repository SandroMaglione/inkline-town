/**
 * What runs once a frame, after the simulation's steps: the pointer's
 * gestures become a selection, a preview, and edits for the next step; the
 * panel, tooltip, top bar, map views, and the town's alerts are filled in;
 * and the views follow the world.
 */
import { RenderSync } from "@typeonce/bevy-ts-render"
import { hazardStrength } from "./render3d/surface-state.ts"

import { appealAt, appealParts, buildingSource, homeSource, landSource, parkSources, parksOf, type AppealSource, type ParkCell, type ParkValue } from "./appeal.ts"
import { homeHeight, topOf, type Alert, type Load, type Emphasis } from "./art.ts"
import { BuildingView, HouseView, WalkerView, TreeView, RockView, FieldView, RuinView } from "./render3d/views.ts"
import type { DoorSet, OverlayCell } from "./render3d/models.ts"
import {
  amounts, BUILD_TICKS, builtCost, COMMUTE, condition as wear, CONDITION_MAX, costText, crewOf, crown as crownRules, fate, goodIds, goods, grounds, home, kinds, needTitle,
  PAVE_COST, propIds, props, ranks, risk, RISK_MAX, ROAD_COST, tierHome, total, upkeepOf, winters, type Amounts, type GoodId, type Kind, type KindId, type Need, type Tier
} from "./content.ts"
import { around, canPlace, cellOf, doors, entrances, isRoad, key, lPath, nearest, reach, useAt, type TileLike } from "./grid.ts"
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
  Guide,
  History,
  House,
  HouseNodes,
  Inventory,
  Land,
  Ledger,
  Market,
  Mood,
  Pantry,
  Park,
  Paused,
  Upgraded,
  Paved,
  Policy,
  Recipe,
  Rescue,
  Rebuilt, Rising,
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
  Flow,
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
import { capacity, CELL_STEPS, elapsed, goalsOf, larder, lockReason, met, seasonAt, SITE_SHARE, steadyNet, taxOf, termTicks, upgradeBlock, winterOf } from "./sim/index.ts"
import { Townsfolk } from "./townsfolk.ts"
import { emptyPreview, type Alert as Notice, type Group, type HitBox, type Legend, type Line, type View } from "./ui.ts"
import { blockers as blockersOf, streetAdvice, streetShort, whyUnmet, type InTown, type Served, type Street } from "./rules/explain.ts"
import { breadBonus, moreAdmin, shortOf, streetTax, suppliedTaxOf, taxOutlook, type TaxedHome } from "./rules/households.ts"
import { approvalTarget } from "./rules/approval.ts"
import { salvageOf, salvageText } from "./rules/salvage.ts"
import { rockBlocks, type RockPart } from "./render3d/rock-blocks.ts"
import { courseCount, GUIDE_QUIET, guideDone, guideStep, guideSteps, lockedNote, upcoming, type GuideFacts, type GuideFocus } from "./rules/guide.ts"
import { TAX_STEPS, ticks } from "./content.ts"

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
      if (kind.gathers && growing && (kind.gathers.source === "stone" || kind.gathers.source === "ore"))
        return `the worked faces in reach give a little ${kind.gathers.source} now and then; traders sell it`
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

/**
 * A tree or field gatherer has young ones within reach: it is waiting on
 * them to grow, not on a forester. A quarry or mine has rocks in reach,
 * worked down to their faces: it is waiting on the next one.
 */
const growingNear = (grid: GridValue, tile: TileLike, kind: Kind, rocks: ReadonlyMap<number, { readonly ore: boolean }>): boolean => {
  const g = kind.gathers
  if (!g || g.source === "water") return false
  if (g.source === "stone" || g.source === "ore") return around(tile, g.radius).some((c) => rocks.get(key(c.x, c.y))?.ore === (g.source === "ore"))
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
    upgraded: Game.Query.optional(Upgraded),
    risk: Game.Query.optional(Risk),
    condition: Game.Query.optional(Condition),
    burning: Game.Query.optional(Burning)
  }
})
const HouseRead = Game.Query({
  selection: {
    tile: Game.Query.read(Tile),
    house: Game.Query.read(House),
    rebuilt: Game.Query.optional(Rebuilt),
    site: Game.Query.optional(Site),
    rising: Game.Query.optional(Rising),
    risk: Game.Query.optional(Risk),
    condition: Game.Query.optional(Condition),
    burning: Game.Query.optional(Burning),
    sick: Game.Query.optional(Sick),
    closed: Game.Query.optional(Paused)
  }
})
const RuinRead = Game.Query({ selection: { tile: Game.Query.read(Tile), ruin: Game.Query.read(Ruin) } })
const ParkRead = Game.Query({ selection: { tile: Game.Query.read(Tile), park: Game.Query.read(Park) } })

/** Every cell between two corners, both included. */
const rectangle = (a: Point, b: Point): Array<Point> => {
  const out: Array<Point> = []
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y })
  return out
}

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

// Blue for fine, sand for worth a look, vermilion for wrong: a scale that still reads with
// red-green colour blindness, unlike green to red.
const GOOD = 0x3a78c2
const FAIR = 0xe2c25c
const BAD = 0xc8553d
/** Citizens' homes, in the workers view. */
const COOL = 0x8a58a8
/** The buildings that serve a view (its fire watch, its healer), and a workplace's reach: ink, apart from the scale. */
const MARK = 0x3d4943
/** A meter 0 → `of` as a colour: blue when low, sand, vermilion past the warning line. */
const meterColor = (value: number, of: number, warn: number) => (value >= warn ? BAD : value >= of * 0.35 ? FAIR : GOOD)

const legends: Readonly<Record<Exclude<View, "none">, Legend>> = {
  appeal: {
    title: "desirability",
    keys: [
      { color: 0x1f4f8f, label: `${home.tiers[3].appeal}+: townhouses` },
      { color: GOOD, label: `${home.tiers[2].appeal}+: citizens` },
      { color: 0xc6d4e4, label: "0 to 4: settlers only" },
      { color: 0xeaa26a, label: "below 0: fewer people, less tax" },
      { color: BAD, label: `${home.squalid} or less: squalid` }
    ],
    note: "Every point counts: a cottage holds fewer and pays less for each point below 0, and pays more above it. Industry pushes homes away; parks (the more they hold, the further they reach), a chapel, a market, and paved streets draw them in."
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
    note: "Buildings take the colour too. A fire watch's watchman resets the risk of every home and workshop along the way; vermilion means past half way, so there is still time. Wooden cottages, ovens, forges, and crowding raise it."
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

/** When each workshop began waiting for its input: a shelf runs empty for a moment all the time, so the ticker only says so after `ALERT_PATIENCE`. */
const starvedSince = new Map<number, number>()
const ALERT_PATIENCE = ticks(30)
/** Since when the store has held no food (`null`: it has some). Fish comes in and goes out in handfuls, so the ticker waits `HUNGER_PATIENCE` before saying so. */
let emptySince: number | null = null
/** Once said, it stays said a while, so a handful of fish arriving does not flick it off and on. */
let hungryUntil = 0
const HUNGER_PATIENCE = ticks(20)
/** A view's colour over a model: pale, so the ink still reads. */
const TINT = { good: 0xbcd2ee, fair: 0xf3e3a8, bad: 0xf2b9a0, cool: 0xdccbe8, mark: 0xd5dad3, settlers: 0xead7bd, fine: 0xa9c4e8, plain: 0xffffff }
const needIcons = { food: "food", bread: "bread", cloth: "cloth", faith: "faith" } as const

const appealColor = (v: number) =>
  v >= home.tiers[3].appeal ? 0x1f4f8f : v >= home.tiers[2].appeal ? GOOD : v >= 0 ? 0xc6d4e4 : v > home.squalid ? 0xeaa26a : BAD

export const Interact = Game.System(
  "Town/Interact",
  {
    queries: {
      buildings: BuildingRead,
      houses: HouseRead,
      ruins: RuinRead,
      parks: ParkRead,
      trees: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Tree] }),
      water: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Water] }),
      rocks: Game.Query({ selection: { tile: Game.Query.read(Tile), rock: Game.Query.read(Rock) } }),
      paved: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road, Paved] })
    },
    resources: {
      grid: Game.System.readResource(Grid),
      census: Game.System.readResource(Census),
      treasury: Game.System.readResource(Treasury),
      ledger: Game.System.readResource(Ledger),
      stock: Game.System.readResource(Stock),
      flow: Game.System.readResource(Flow),
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
      pantry: Game.System.readResource(Pantry),
      guide: Game.System.writeResource(Guide)
    },
    services: { ui: Game.System.service(Ui) }
  },
  ({ queries, resources, services }) => {
    const ui = services.ui
    const grid = resources.grid.get()
    const rates = resources.policy.get()
    const approval = resources.mood.get().approval
    const cells = resources.appeal.get().cells
    // The rocks by cell: which are ore, and which are worked down to their faces.
    const rockAt = new Map(queries.rocks.each().map(({ data }) => [key(data.tile.get().x, data.tile.get().y), data.rock.get()]))
    const tick = resources.time.get().tick
    const buildings = queries.buildings.each()
    const houses = queries.houses.each()
    const ruins = queries.ruins.each()
    const parkRows = queries.parks.each()
    const parkCells: Array<ParkCell> = parkRows.map(({ data }) => ({ ...data.tile.get(), ...data.park.get() }))
    const parkAt = new Map(parkRows.map((row) => [key(row.data.tile.get().x, row.data.tile.get().y), row] as const))
    const road = (x: number, y: number) => isRoad(grid, x, y)
    /** The park a cell belongs to, as it is, or as it would be with `changed` cells laid over it. */
    const parkOf = (cell: Point, changed: ReadonlyArray<ParkCell> = []): ParkValue | undefined => {
      const over = new Map(parkCells.map((c) => [key(c.x, c.y), c]))
      for (const c of changed) over.set(key(c.x, c.y), c)
      return parksOf([...over.values()], road).find((p) => p.cells.some((c) => c.x === cell.x && c.y === cell.y))
    }
    /** How far a park reaches, as one square around it. */
    const reachPlots = (p: ParkValue) => {
      const xs = p.cells.map((c) => c.x)
      const ys = p.cells.map((c) => c.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      const size = Math.max(Math.max(...xs) - x, Math.max(...ys) - y) + 1
      return [{ x: x - p.reach, y: y - p.reach, size: size + 2 * p.reach, look: "reach" as const }]
    }
    /** A park, for its panel: what it is worth, why, and what would make it better. */
    const describePark = (p: ParkValue): Array<Line> => {
      const has = new Set(p.cells.map((c) => c.prop))
      const missing = propIds.filter((id) => !has.has(id)).map((id) => props[id].title.toLowerCase())
      const upkeep = p.cells.reduce((n, c) => n + grounds[c.ground].upkeep + (c.prop === "none" ? 0 : props[c.prop].upkeep), 0)
      const placed = p.cells.filter((c) => c.prop !== "none").length - p.crowded
      return [
        { icon: "decor", label: "size", value: `${p.cells.length} cell${p.cells.length === 1 ? "" : "s"} · beauty ${p.beauty}` },
        { icon: "appeal", label: "made of", value: p.parts.map((part) => `${part.label} ${part.value}`).join(", ") || "nothing yet" },
        { icon: "homes", label: "the streets around", value: parkText(p), tone: "ok" },
        p.entrances > 0
          ? { icon: "road", label: "ways in from the street", value: `${p.entrances}${p.entrances > 2 ? " (2 count)" : ""}` }
          : { icon: "road", label: "ways in from the street", value: "none", tone: "warn", note: "lay a gravel walk or a paved square out to a road: +1.5 each, two count" },
        { icon: "decor", label: "furnishings that count", value: `${placed} of ${Math.floor(p.cells.length / 2)}`, tone: p.crowded > 0 ? "warn" : undefined, note: p.crowded > 0 ? `${p.crowded} too many: one counts for every 2 cells of park, so lay more ground` : undefined },
        ...(missing.length > 0 ? [{ icon: "info", label: "nicer with", value: missing.join(", "), tone: "dim" } as Line] : []),
        { icon: "upkeep", label: "upkeep", value: `${Math.round(upkeep * 10) / 10} coins a minute` }
      ]
    }
    /** What the pointer is on: the model the camera ray hit, or else (parks have nothing standing to hit) the park on the cell. */
    const pickAt = (at: Point, entity?: number | null) => {
      const hit = hitAt(hits, at, entity)
      return hit ?? parkAt.get(key(Math.floor(at.x), Math.floor(at.y)))?.entity.id ?? null
    }
    const parkText = (p: ParkValue) => `desirability ${signed(p.value)} out to ${p.reach} cells`
    /**
     * What new cottages would bring in, fed, at the settlers' rate on their streets, less what they add to the
     * town hall's administration for their residents (see `moreAdmin`): the sum that turns once a town is large.
     */
    const homesWorth = (at: ReadonlyArray<Point>) => {
      if (at.length === 0) return ""
      const standing = houses.filter((row) => !row.data.closed.present).reduce((n, row) => n + row.data.house.get().residents, 0)
      const fed = { tier: 1 as Tier, food: 1, bread: 0, cloth: 0, faith: 0, residents: home.tiers[1].residents }
      let people = 0
      const pays = at.reduce((sum, c) => {
        const d = appealAt(cells, c.x, c.y), residents = capacity(fed, approval, d, undefined, rates.settlers)
        people += residents
        return sum + taxOf({ ...fed, residents }, rates, undefined, d)
      }, 0)
      const worth = Math.round(pays - moreAdmin(standing, people))
      return worth > 0 ? ` · ${signed(worth)} coins a minute once fed` : " · costs more to run than it pays: finer homes pay better"
    }

    const hits: Array<HitBox> = [
      ...buildings.map(({ entity, data }) => {
        const kind = kinds[data.building.get().kind]
        return hitBox(entity.id, data.tile.get(), kind.half, topOf(kind))
      }),
      ...houses.map(({ entity, data }) => hitBox(entity.id, data.tile.get(), home.half, homeHeight(data.house.get().tier))),
      ...ruins.map(({ entity, data }) => hitBox(entity.id, data.tile.get(), 0, 0)),
      ...parkRows.map(({ entity, data }) => hitBox(entity.id, data.tile.get(), 0, 0))
    ].sort((l, r) => r.depth - l.depth)
    ui.hits = hits
    const tileOf = (id: number) => [...buildings, ...houses, ...ruins, ...parkRows].find((row) => row.entity.id === id)?.data.tile.get()

    /**
     * What is wrong with a building where it would stand, before it is laid: no road at the middle of a side (it is
     * not laid: nobody could bring its materials or work there), or nothing in reach to gather (laid, but said).
     */
    const placeProblem = (kind: Kind, tile: TileLike): { readonly refuse: boolean; readonly text: string } | null => {
      if (!canPlace(grid, tile) || lockReason(kind, resources.census.get())) return null
      if (doors(grid, tile).length === 0) return { refuse: true, text: "needs a road at the middle of one side" }
      const source = kind.gathers?.source
      if (!source || source === "field") return null
      const reachCells = around(tile, kind.gathers!.radius)
      const found =
        source === "stone" || source === "ore"
          ? queries.rocks.each().some(({ data }) => {
              const t = data.tile.get()
              return data.rock.get().ore === (source === "ore") && reachCells.some((c) => c.x >= t.x && c.x < t.x + t.size && c.y >= t.y && c.y < t.y + t.size)
            })
          : reachCells.some((c) => useAt(grid, c.x, c.y) === source)
      const what = { tree: "trees", stone: "pale stone rocks", ore: "dark ore rocks", water: "water" }[source]
      return found ? null : { refuse: false, text: `no ${what} within ${kind.gathers!.radius} cells` }
    }

    // ── Gestures ──
    for (const gesture of ui.gestures.splice(0)) {
      const cell = cellAt(gesture.at)
      if (gesture.type === "press") {
        ui.dragFrom = (ui.tool === "road" || ui.tool === "home" || ui.tool === "pave" || ui.tool === "ground") && inside(cell.x, cell.y) ? cell : null
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
        case "ground": {
          if (ui.dragFrom) ui.edits.push({ type: "ground", ground: ui.ground, cells: rectangle(ui.dragFrom, cell).filter((c) => inside(c.x, c.y)) })
          ui.dragFrom = null
          break
        }
        case "prop": {
          if (gesture.panned) break
          ui.edits.push({ type: "prop", prop: ui.prop, cell })
          break
        }
        case "place": {
          if (gesture.panned || !ui.placing) break
          const kind = kinds[ui.placing]
          const at = footprintAt(gesture.at, kind.size)
          const problem = placeProblem(kind, { ...at, size: kind.size })
          if (problem?.refuse) {
            ui.toast(`A ${kind.title.toLowerCase()} ${problem.text}`)
            break
          }
          ui.edits.push({ type: "building", kind: ui.placing, cell: at, open: false })
          break
        }
        case "bulldoze": {
          if (gesture.panned) break
          const hit = pickAt(gesture.at, gesture.hit)
          ui.edits.push({ type: "remove", cell: (hit !== null ? tileOf(hit) : undefined) ?? cell })
          break
        }
        case "select": {
          if (gesture.panned) break
          ui.selected = pickAt(gesture.at, gesture.hit)
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
    preview.hover = pointer && (ui.tool === "select" || ui.tool === "bulldoze") ? pickAt(pointer, ui.pointerHit) : null
    const showReach = (tile: TileLike, kind: Kind) => {
      const r = reachOf(kind)
      if (r !== null) preview.plots.push({ x: tile.x - r, y: tile.y - r, size: tile.size + 2 * r, look: "reach" })
    }
    const pavedCells = new Set(queries.paved.each().map(({ data }) => key(data.tile.get().x, data.tile.get().y)))
    /** The road cells within `limit` of a tile's doors: what a service's walkers, or a commute, would reach from here. */
    const rangeFrom = (tile: TileLike, limit: number, note: string) => {
      const ds = doors(grid, tile)
      if (ds.length === 0) return
      const roads = reach(grid, ds)
      for (let k = 0; k < roads.distance.length; k++) {
        const d = roads.distance[k]!
        if (d >= 0 && d < limit) preview.range.push(cellOf(k))
      }
      preview.rangeNote = note
    }
    const rangeOfKind = (tile: TileLike, kind: Kind, range = kind.service?.range) => {
      if (kind.service && range !== undefined) rangeFrom(tile, range, `its walkers reach ${range} road cells from the door`)
      else if (kind.workers > 0) rangeFrom(tile, COMMUTE + 1, `its workers come from homes within ${COMMUTE} road cells`)
    }
    // Where the page is pointing (from the ticker): outlined for a few seconds.
    if (ui.flash) {
      if (Date.now() < ui.flash.until) preview.plots.push({ x: ui.flash.cell.x, y: ui.flash.cell.y, size: ui.flash.size, look: "picked" })
      else ui.flash = null
    }

    /** A cost `n` times over. */
    const times = (cost: Kind["cost"], n: number): Kind["cost"] => ({
      coins: cost.coins * n,
      materials: Object.fromEntries(Object.entries(cost.materials).map(([g, m]) => [g, (m ?? 0) * n]))
    })
    const counted = (n: number, what: string) => `${n} ${what}${n === 1 ? "" : "s"}`
    // Let go off the map (over the tool bar, say) and the stroke is dropped: it shows as blocked.
    const dropping = ui.stroke === "cancel" && ui.dragFrom !== null
    if (dropping && cell && (ui.tool === "road" || ui.tool === "home" || ui.tool === "pave" || ui.tool === "ground")) {
      for (const c of ui.tool === "ground" ? rectangle(ui.dragFrom!, cell) : lPath(ui.dragFrom!, cell))
        if (inside(c.x, c.y)) preview.plots.push({ ...c, size: 1, look: "blocked" })
      preview.tooltip = "let go here to cancel"
    } else if (ui.tool === "road" || ui.tool === "home" || ui.tool === "pave") {
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
      if (ui.tool === "home" && cell && inside(cell.x, cell.y)) {
        rangeFrom({ ...(ui.dragFrom ?? cell), size: 1 }, COMMUTE + 1, `residents walk to work within ${COMMUTE} road cells`)
        preview.tooltip = `homes · ${costText(home.cost)} each${preview.rangeNote ? homesWorth(preview.ghosts.map((g) => g.cell)) : " · lay them beside a road"}`
      }
      if (ui.tool === "road" && cell) preview.tooltip = `road · ${ROAD_COST} coins a cell`
      if (ui.dragFrom && cell) {
        const n = ui.tool === "road" ? preview.roads.length : ui.tool === "home" ? preview.ghosts.length : preview.plots.filter((p) => p.look === "reach").length
        preview.stroke =
          ui.tool === "road"
            ? `${counted(n, "road cell")} · ${costText({ coins: n * ROAD_COST, materials: {} })}`
            : ui.tool === "home"
              ? `${counted(n, "home")} · ${costText(times(home.cost, n))}${homesWorth(preview.ghosts.map((g) => g.cell))}`
              : `pave ${counted(n, "cell")} · ${costText({ coins: n * PAVE_COST.coins, materials: { stone: n * PAVE_COST.stone } })}`
      }
    } else if (ui.tool === "ground" && cell) {
      const laid: Array<ParkCell> = []
      for (const c of ui.dragFrom ? rectangle(ui.dragFrom, cell) : [cell]) {
        if (!inside(c.x, c.y)) continue
        const there = parkAt.get(key(c.x, c.y))?.data.park.get()
        if (there ? there.ground !== ui.ground : canPlace(grid, { ...c, size: 1 })) laid.push({ ...c, ground: ui.ground, prop: there?.prop ?? "none" })
        else if (!there) preview.plots.push({ ...c, size: 1, look: "blocked" })
      }
      preview.parks.push(...laid)
      const after = laid.length > 0 ? parkOf(laid[0]!, laid) : undefined
      const cost = costText(times(grounds[ui.ground].cost, laid.length))
      if (ui.dragFrom) preview.stroke = `${grounds[ui.ground].title.toLowerCase()} · ${counted(laid.length, "cell")} · ${cost}`
      preview.tooltip = `${grounds[ui.ground].title.toLowerCase()} · ${cost}${after ? ` · park ${signed(after.value)} desirability` : ""}`
      if (after) preview.plots.push(...reachPlots(after))
    } else if (ui.tool === "prop" && cell && inside(cell.x, cell.y)) {
      const there = parkAt.get(key(cell.x, cell.y))?.data.park.get()
      if (there) {
        const placed = { ...cell, ground: there.ground, prop: ui.prop }
        preview.parks.push(placed)
        const before = parkOf(cell)
        const after = parkOf(cell, [placed])
        preview.tooltip = `${props[ui.prop].title.toLowerCase()} · ${costText(props[ui.prop].cost)}${after ? ` · park ${signed(after.value)} desirability${before && before.value !== after.value ? ` (now ${signed(before.value)})` : ""}` : ""}${after && after.crowded > 0 ? " · too crowded" : ""}`
        if (after) preview.plots.push(...reachPlots(after))
      } else {
        preview.plots.push({ ...cell, size: 1, look: "blocked" })
        preview.tooltip = `${props[ui.prop].title.toLowerCase()} · lay park ground first`
      }
    } else if (ui.tool === "place" && ui.placing && pointer) {
      const kind = kinds[ui.placing]
      const at = footprintAt(pointer, kind.size)
      const tile = { ...at, size: kind.size }
      showReach(tile, kind)
      rangeOfKind(tile, kind)
      if (kind.appeal) preview.plots.push({ x: tile.x - kind.appeal.reach, y: tile.y - kind.appeal.reach, size: tile.size + 2 * kind.appeal.reach, look: kind.appeal.value > 0 ? "reach" : "hover" })
      if (lockReason(kind, resources.census.get())) preview.plots.push({ ...tile, look: "blocked" })
      else if (canPlace(grid, tile)) {
        preview.ghosts.push({ what: ui.placing, cell: at })
        // No road at a side's middle: shown red under the ghost, as it will not be laid there.
        if (placeProblem(kind, tile)?.refuse) preview.plots.push({ ...tile, look: "blocked" })
      } else preview.plots.push({ ...tile, look: "blocked" })
    } else if (ui.tool === "bulldoze") {
      preview.danger = true
      if ((preview.hover === null || useAt(grid, cell?.x ?? -1, cell?.y ?? -1) === "park") && cell && ["road", "tree", "field", "park"].includes(useAt(grid, cell.x, cell.y)))
        preview.plots.push({ ...cell, size: 1, look: "blocked" })
      const there = cell ? parkAt.get(key(cell.x, cell.y))?.data.park.get() : undefined
      if (there) preview.tooltip = there.prop !== "none" ? `remove the ${props[there.prop].title.toLowerCase()}` : `remove the ${grounds[there.ground].title.toLowerCase()}`
      const rock = cell ? rockAt.get(key(cell.x, cell.y)) : undefined
      if (rock && cell) {
        const worked = rock.amount <= 1
        if (worked) preview.plots.push({ ...cell, size: 1, look: "blocked" })
        preview.tooltip = worked ? `worked ${rock.ore ? "ore" : "stone"} face · bulldoze to clear it` : `${rock.ore ? "ore" : "stone"} · ${rock.amount} left`
      }
    }
    if (ui.selected !== null) {
      const row = buildings.find((b) => b.entity.id === ui.selected)
      const tile = tileOf(ui.selected)
      const whole = tile && useAt(grid, tile.x, tile.y) === "park" ? parkOf(tile) : undefined
      if (whole) {
        // A park is picked whole: every cell of it, and how far it reaches.
        for (const c of whole.cells) preview.plots.push({ x: c.x, y: c.y, size: 1, look: "hover" })
        preview.plots.push(...reachPlots(whole))
      } else if (tile) preview.plots.push({ ...tile, look: "picked" })
      if (row && tile) {
        showReach(tile, kinds[row.data.building.get().kind])
        rangeOfKind(tile, kinds[row.data.building.get().kind], maybe(row.data.service)?.range)
      }
    }

    // ── The neighbourhood, explained (only when a home asks) ──
    let sources: Array<AppealSource> | null = null
    const appealSources = () => {
      if (sources) return sources
      sources = []
      for (const { data } of buildings) {
        if (data.site.present || data.rising.present) continue
        const s = buildingSource(data.building.get().kind, data.tile.get(), undefined, data.upgraded.present)
        if (s) sources.push(s)
      }
      for (const { data } of queries.trees.each()) sources.push(landSource("forest", data.tile.get()))
      for (const { data } of queries.water.each()) sources.push(landSource("water", data.tile.get()))
      for (const { data } of queries.paved.each()) sources.push(landSource("paved", data.tile.get()))
      sources.push(...parkSources(parkCells, road))
      for (const { data } of ruins) sources.push(landSource("ruin", data.tile.get()))
      for (const { data } of houses) {
        if (data.site.present || data.rising.present) continue
        if ((maybe(data.condition)?.value ?? CONDITION_MAX) < wear.worn) sources.push(landSource("worn", data.tile.get()))
        const fine = data.closed.present ? null : homeSource(data.house.get().tier, data.tile.get())
        if (fine) sources.push(fine)
      }
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
    /**
     * A building, for its panel: what it is doing (workers, what it makes, what it holds), then what it costs to run
     * (upkeep, wear, fire, its street). Each row is a value; a note only when something wants doing.
     */
    const describeBuilding = (row: (typeof buildings)[number]) => {
      const kind = kinds[row.data.building.get().kind]
      const status = row.data.status.get()
      const site = maybe(row.data.site)
      if (site) {
        const owed = (Object.entries(site.owed) as Array<[GoodId, number]>).filter(([, n]) => n > 0)
        const line: Line =
          owed.length > 0
            ? { icon: "build", label: "waiting for", goods: owed.map(([good, count]) => ({ good, count })), tone: "warn", note: "carriers bring them from storage: buy what the town lacks in the town panel" }
            : { icon: "build", label: "builders", value: "at work", tone: "ok" }
        return { kind, status, problem: null, groups: [{ title: "being built", icon: "build", lines: [line] }] as Array<Group> }
      }
      const staff = row.data.staff.get()
      const work: Array<Line> = []
      if (staff.needed > 0) {
        const crew = kind.crew
        const short = staff.assigned < staff.needed
        work.push({
          icon: "workers",
          label: "workers",
          value: `${staff.assigned} of ${staff.needed}`,
          tone: !short ? "ok" : staff.assigned > 0 ? "warn" : "bad",
          note: short
            ? staff.nearby === 0
              ? `no ${crew} live within ${COMMUTE} road cells: lay homes nearer`
              : `everyone nearby has a job: lay more homes within ${COMMUTE} road cells`
            : staff.apprentices > 0
              ? `settlers stand in for citizens, at three-quarters pace`
              : undefined
        })
      }
      const recipe = maybe(row.data.recipe)
      if (recipe)
        work.push({ icon: recipe.output, label: "makes", value: recipe.input ? `${goods[recipe.input].title} → ${goods[recipe.output].title}` : goods[recipe.output].title })
      const service = maybe(row.data.service)
      if (service)
        work.push({
          icon: service.service === "goods" ? "trade" : service.service === "faith" ? "faith" : service.service === "repair" ? "repair" : service.service,
          label: "walkers out",
          value: `${maybe(row.data.walkers)?.length ?? 0}`
        })
      const inventory = maybe(row.data.inventory)
      if (inventory) {
        const held = inventory.accepts.filter((g) => inventory.stock[g] > 0).map((g) => ({ good: g, count: inventory.stock[g] }))
        work.push(held.length > 0 ? { icon: "jobs", label: "holds", goods: held } : { icon: "jobs", label: "holds", value: "nothing yet", tone: "dim" })
      }
      if (kind.wear && inventory)
        work.push(
          inventory.stock.tools > 0
            ? { icon: "tools", label: "tools", value: `${inventory.stock.tools}`, tone: "ok" }
            : { icon: "tools", label: "tools", value: "none", tone: "bad", note: "half pace until one comes: a smithy makes them, or buy them in the town panel" }
        )
      const running: Array<Line> = []
      const upgraded = row.data.upgraded.present
      const upkeep = upkeepOf(kind, upgraded)
      if (upkeep > 0) running.push({ icon: "upkeep", label: "upkeep", value: `${upkeep} coins a minute` })
      const condition = maybe(row.data.condition)
      if (condition)
        running.push({
          icon: "condition",
          label: "condition",
          value: percent(condition.value, CONDITION_MAX),
          tone: condition.value < wear.worn ? "bad" : condition.value < wear.mend ? "warn" : "ok",
          note: condition.value < wear.worn ? "half pace, and it may fall: a builder's yard mends it" : condition.value < wear.mend ? "a builder's yard mends it as its builder passes" : undefined
        })
      const r = maybe(row.data.risk)
      if (r)
        running.push({
          icon: "fire",
          label: "fire risk",
          value: riskText(r.fire),
          tone: r.fire >= risk.warn ? "bad" : r.fire >= RISK_MAX * 0.35 ? "warn" : "ok",
          note: r.fire >= RISK_MAX * 0.35 ? "a fire watch's watchman lowers it as he passes" : undefined
        })
      const appealHere = (upgraded ? kind.upgrade?.appeal : undefined) ?? kind.appeal
      if (appealHere) running.push({ icon: "appeal", label: "desirability nearby", value: signed(appealHere.value) })
      const help = [
        upkeep > 0 ? "Upkeep is paid every minute it stands, a quarter of it while paused." : "",
        condition ? "Everything wears down; a builder's yard mends it." : "",
        kind.hot ? "An oven or a forge: a fire risk to itself and to homes within 2 cells." : "",
        appealHere ? `It changes how nice the streets are out to ${appealHere.reach} cells${appealHere.value < 0 ? ": homes close by hold fewer people and pay less" : ""}.` : ""
      ]
        .filter((t) => t !== "")
        .join(" ")
      const groups: Array<Group> = [
        ...(work.length > 0 ? [{ title: "at work", icon: "jobs", lines: work } as Group] : []),
        ...(running.length > 0 ? [{ title: "running it", icon: "coins", help, lines: running } as Group] : [])
      ]
      const growing = status === "starved" && growingNear(grid, row.data.tile.get(), kind, rockAt)
      const problem = row.data.burning.present ? "on fire!" : problemOf(kind, status, growing, { nearby: staff.nearby, crew: kind.crew })
      return { kind, status, problem, groups }
    }
    /** What the town has of each provision, in storage and on market shelves. */
    const inTown = (): InTown => {
      const stock = resources.stock.get()
      const sum = { fish: stock.fish, smoked: stock.smoked, bread: stock.bread, cloth: stock.cloth }
      for (const { data } of buildings) {
        const inv = maybe(data.inventory)
        if (!inv || maybe(data.service)?.service !== "goods" || data.site.present || data.rising.present) continue
        sum.fish += inv.stock.fish
        sum.smoked += inv.stock.smoked
        sum.bread += inv.stock.bread
        sum.cloth += inv.stock.cloth
      }
      return sum
    }
    /** Which services have a walker that can reach a home: a standing market (or the town hall), and a chapel, within their walks of its door. */
    const servedAt = (tile: TileLike): Served => {
      const ds = doors(grid, tile)
      if (ds.length === 0) return { goods: false, faith: false }
      const way = reach(grid, ds)
      const served = { goods: false, faith: false }
      for (const { data } of buildings) {
        const service = maybe(data.service)
        if (!service || data.site.present || data.rising.present || data.burning.present) continue
        if (service.service !== "goods" && service.service !== "faith") continue
        if (served[service.service]) continue
        const found = nearest(way, doors(grid, data.tile.get()))
        if (found && found.distance < service.range) served[service.service] = true
      }
      return served
    }
    /**
     * A home, for its panel: its household (who lives there, what it pays, where they work); what it needs, as one
     * checklist with what it lacks now in red and what it lacks to grow in amber, each with its cause; and its risks
     * and wear. Each row is a value; a note only when something wants doing.
     */
    const describeHouse = (row: (typeof houses)[number]) => {
      const h = row.data.house.get()
      const site = maybe(row.data.site)
      const quiet = (summary: string, line: Line) => ({ h, summary, trouble: false, groups: [{ title: "household", icon: "homes", lines: [line] }] as Array<Group> })
      if (site) return quiet("being built", { icon: "planks", label: "builders", value: "waiting for its plank", tone: "warn" })
      if (row.data.closed.present)
        return quiet("closed", { icon: "settlers", label: "closed", value: "empty", tone: "warn", note: "it pays no taxes and costs the town hall nothing: reopen it and settlers move back in" })
      const tile = row.data.tile.get()
      const tier = home.tiers[h.tier]
      const nextTier = h.tier < 3 ? ((h.tier + 1) as Tier) : null
      const there = appealParts(appealSources(), tile)
      const desirability = appealAt(cells, tile.x, tile.y)
      const street: Street = { desirability, parts: there.parts }
      const r = maybe(row.data.risk)
      const work = workOf(tile, h.tier)
      const condition = maybe(row.data.condition)
      const town = inTown()
      const served = servedAt(tile)
      const rate = h.tier === 1 ? rates.settlers : rates.citizens
      const cap = capacity(h, approval, desirability, undefined, rate)
      const whyFewer =
        cap >= tier.residents
          ? undefined
          : row.data.sick.present
            ? "half as many while it is sick"
            : approval < 0
              ? "fewer while the town disapproves of its mayor"
              : desirability < 0
                ? `fewer on a poor street: ${streetAdvice(street)}`
                : rate > 100 && capacity(h, approval, desirability) > cap
                  ? `fewer while taxed at ${rate}%: some move away`
                  : "fewer until every need is met"
      const hungry = h.food <= 0
      const pays = Math.round(taxOf(h, rates, undefined, desirability))
      const could = Math.round(suppliedTaxOf(h, rates, undefined, desirability))
      const household: Array<Line> = [
        ...(row.data.burning.present ? [{ icon: "fire", label: "on fire", value: "everyone fled", tone: "bad" } as Line] : []),
        ...(row.data.sick.present ? [{ icon: "health", label: "sick", value: "half as many", tone: "bad", note: "it passes in a minute, or when a healer's physician calls" } as Line] : []),
        { icon: "people", label: "residents", value: `${h.residents} of ${cap}`, tone: whyFewer ? "warn" : "ok", note: whyFewer },
        {
          icon: "coins",
          label: "pays",
          value: `${pays} coins a minute`,
          tone: hungry ? "bad" : undefined,
          note: hungry ? "hungry: no food, no taxes" : could > pays ? `${could} coins a minute with every need met` : undefined
        },
        work ? { icon: "jobs", label: "works at", value: `${work.title.toLowerCase()}` } : { icon: "jobs", label: "works at", value: "nothing nearby", tone: "dim" }
      ]
      // What it needs: what it must have now, then what it must have to grow, in the order the town makes them.
      const needs: Array<Line> = []
      const nowNeeds = new Set<Need>(tier.needs)
      const growNeeds = new Set<Need>(nextTier ? home.tiers[nextTier].needs : [])
      for (const n of ["food", "bread", "cloth", "faith"] as const) {
        if (!nowNeeds.has(n) && !growNeeds.has(n)) continue
        if (met(h, n)) {
          needs.push({ icon: needIcons[n], label: needTitle[n], value: "✓", tone: "ok" })
          continue
        }
        const now = nowNeeds.has(n)
        needs.push({
          icon: needIcons[n],
          label: needTitle[n],
          value: now ? "missing" : `for ${home.tiers[nextTier!].title}`,
          tone: now ? "bad" : "warn",
          note: whyUnmet(n, h, street, town, served) ?? undefined
        })
      }
      const blocks = blockersOf(h, street, town, served, r)
      const streetBlock = blocks.find((b) => b.what === "street")
      if (nextTier)
        needs.push({
          icon: "appeal",
          label: "street",
          value: streetBlock ? `${signed(desirability)} of ${home.tiers[nextTier].appeal}` : "✓",
          tone: streetBlock ? "warn" : "ok",
          note: streetBlock ? `${streetShort(street, home.tiers[nextTier].appeal)}: ${streetAdvice(street)}` : undefined
        })
      else needs.push({ icon: "appeal", label: "street", value: signed(desirability), tone: "ok" })
      const services = blocks.find((b) => b.what === "services")
      if (services) needs.push({ icon: "order", label: "services", value: `for ${home.tiers[3].title}`, tone: "warn", note: services.text })
      // Rising is a rebuilding, paid at once from the treasury and the store, once.
      const rebuilt = nextTier !== null && (maybe(row.data.rebuilt)?.tier ?? 1) >= nextTier
      const short = nextTier && !rebuilt ? shortOf(home.tiers[nextTier].rise, resources.treasury.get().coins, resources.stock.get()) : null
      if (nextTier)
        needs.push({
          icon: "upkeep", label: "rebuilding", value: rebuilt ? "done ✓" : costText(home.tiers[nextTier].rise), tone: short ? "warn" : "ok",
          note: short ? `the town is short of ${short}: it waits at its tier until the store can pay` : rebuilt ? "rebuilt already: it rises back for nothing" : undefined
        })
      if (nextTier && blocks.length === 0 && !short)
        needs.push({ icon: "citizens", label: `ready for ${home.tiers[nextTier].title}`, value: "✓", tone: "ok", note: "it grows as the next resident moves in, and pays for its rebuilding then" })
      const risky = r ? (["fire", "health", "order"] as const).filter((k) => r[k] >= RISK_MAX * 0.35) : []
      const cure = { fire: "a fire watch's watchman lowers it", health: "a healer's physician lowers it", order: "a watch house's constable lowers it" } as const
      const safety: Array<Line> = [
        ...(r && risky.length === 0 ? [{ icon: "fire", label: "risks", value: "all low", tone: "ok" } as Line] : []),
        ...risky.map(
          (k): Line => ({
            icon: k,
            label: `${k === "order" ? "theft" : k} risk`,
            value: riskText(r![k]),
            tone: r![k] >= risk.warn ? "bad" : "warn",
            note: cure[k]
          })
        ),
        ...(r && r.thefts > 0 ? [{ icon: "order", label: "robbed", value: `${r.thefts}×`, tone: "warn" } as Line] : []),
        ...(condition
          ? [{
              icon: "condition",
              label: "condition",
              value: percent(condition.value, CONDITION_MAX),
              tone: condition.value < wear.worn ? "bad" : condition.value < wear.mend ? "warn" : "ok",
              note: condition.value < wear.worn ? "it drags the street down and may fall: a builder's yard mends it" : condition.value < wear.mend ? "a builder's yard mends it as its builder passes" : undefined
            } as Line]
          : [])
      ]
      const needHelp =
        h.tier === 1
          ? `Red: it needs this now. Amber: it needs this to become a citizens' home, which holds and pays twice as much. Bread alone already makes a cottage pay half again. Walkers bring needs along the road; the street is how nice the place is (desirability ${home.tiers[2].appeal} for citizens).`
          : h.tier === 2
            ? `Red: it needs this now, or goes back to settlers. Amber: it needs this to become a townhouse of burghers, on a street of ${home.tiers[3].appeal} with a fire watch, a healer, and a watch house all calling.`
            : "Red: it needs this now, or goes back to citizens."
      const summary = row.data.burning.present ? "on fire" : row.data.sick.present ? "sick" : hungry ? "hungry" : `${h.residents} resident${h.residents === 1 ? "" : "s"}`
      return {
        h,
        summary,
        trouble: row.data.burning.present || row.data.sick.present || hungry,
        groups: [
          { title: "household", icon: "homes", lines: household },
          { title: "needs", icon: "citizens", help: needHelp, lines: needs },
          { title: "risks and wear", icon: "condition", help: "Every home's risk of fire, sickness, and theft rises slowly; a walker from the matching service lowers it as it passes.", lines: safety }
        ] as Array<Group>
      }
    }

    /** What pulling a building or home down would cost and give back, for the bulldozer and the panel. */
    const salvageFor = (cost: Kind["cost"], site: { readonly owed: Amounts } | undefined) => {
      const s = salvageOf(cost, site?.owed ?? null)
      const said = salvageText(s)
      return `${site ? "cancel" : "pull down"}${said ? `: ${said}` : ""}`
    }
    const hovered = preview.hover
    const hoveredBuilding = hovered !== null ? buildings.find((row) => row.entity.id === hovered) : undefined
    const hoveredHouse = hovered !== null ? houses.find((row) => row.entity.id === hovered) : undefined
    const hoveredRuin = hovered !== null ? ruins.find((row) => row.entity.id === hovered) : undefined
    if (hoveredBuilding) {
      const { kind, status, problem } = describeBuilding(hoveredBuilding)
      preview.tooltip = ui.tool === "bulldoze"
        ? `${kind.title.toLowerCase()} · ${hoveredBuilding.data.hall.present ? "the town hall stays" : salvageFor(builtCost(kind, hoveredBuilding.data.upgraded.present), maybe(hoveredBuilding.data.site))}`
        : `${kind.title.toLowerCase()} · ${problem ?? status}`
    } else if (hoveredHouse) {
      const h = hoveredHouse.data.house.get()
      const t = hoveredHouse.data.tile.get()
      preview.tooltip = ui.tool === "bulldoze"
        ? `${tierHome[h.tier]} · ${salvageFor(home.cost, maybe(hoveredHouse.data.site))}`
        : hoveredHouse.data.closed.present
        ? `${tierHome[h.tier]} · closed`
        : `${tierHome[h.tier]} · ${h.residents} resident${h.residents === 1 ? "" : "s"} · desirability ${appealAt(cells, t.x, t.y)}${hoveredHouse.data.burning.present ? " · on fire!" : hoveredHouse.data.sick.present ? " · sick" : ""}`
    } else if (hoveredRuin) {
      preview.tooltip = `ruin · ${hoveredRuin.data.ruin.get().cause} · bulldoze to clear`
    } else if (hovered !== null && ui.tool === "select" && parkRows.some((row) => row.entity.id === hovered)) {
      const row = parkRows.find((r) => r.entity.id === hovered)!
      const p = parkOf(row.data.tile.get())
      const here = row.data.park.get()
      preview.tooltip = `park · ${here.prop !== "none" ? props[here.prop].title.toLowerCase() : grounds[here.ground].title.toLowerCase()}${p ? ` · ${p.cells.length} cells · ${parkText(p)}` : ""}`
    } else if (ui.tool === "place" && ui.placing) {
      const kind = kinds[ui.placing]
      const lock = lockReason(kind, resources.census.get())
      const tile = pointer ? { ...footprintAt(pointer, kind.size), size: kind.size } : null
      const problem = tile ? placeProblem(kind, tile) : null
      if (lock) preview.tooltip = `${kind.title.toLowerCase()} · ${lock}`
      else if (tile && !canPlace(grid, tile)) preview.tooltip = `${kind.title.toLowerCase()} · no room here`
      else if (problem) preview.tooltip = `${kind.title.toLowerCase()} · ${problem.text}`
      else preview.tooltip = `${kind.title.toLowerCase()} · ${costText(kind.cost)}`
    } else if (ui.tool === "pave" && !dropping) preview.tooltip = `pave · ${PAVE_COST.coins} coins and a stone a cell · faster walking`
    else if (cell && ui.view === "appeal" && inside(cell.x, cell.y)) preview.tooltip = `desirability ${appealAt(cells, cell.x, cell.y)}`
    ui.preview = preview

    const pickedBuilding = ui.selected !== null ? buildings.find((row) => row.entity.id === ui.selected) : undefined
    const pickedHouse = ui.selected !== null ? houses.find((row) => row.entity.id === ui.selected) : undefined
    const pickedRuin = ui.selected !== null ? ruins.find((row) => row.entity.id === ui.selected) : undefined
    const pickedPark = ui.selected !== null ? parkRows.find((row) => row.entity.id === ui.selected) : undefined
    const picked = pickedPark ? parkOf(pickedPark.data.tile.get()) : undefined
    if (pickedBuilding) {
      const { kind, status, problem, groups } = describeBuilding(pickedBuilding)
      const standing = !pickedBuilding.data.site.present && !pickedBuilding.data.rising.present
      const pausable = kind.id !== "townhall" && standing
      const upgraded = pickedBuilding.data.upgraded.present
      const up = kind.upgrade
      const upgradeOffer = up && standing && !upgraded ? { title: up.title, cost: costText(up.cost), blocked: upgradeBlock(up, resources.fate.get().rank, { ranks }) } : null
      // The upgrade it could have, as a box of its own: what it is, what it costs, and what keeps it from it now.
      if (up && upgradeOffer)
        groups.push({
          title: `upgrade to ${up.title.toLowerCase()}`,
          icon: "build",
          lines: [{ icon: "coins", label: "costs", value: upgradeOffer.cost, tone: upgradeOffer.blocked ? "dim" : undefined, note: upgradeOffer.blocked ?? up.blurb }]
        })
      ui.panel = {
        type: "building",
        id: pickedBuilding.entity.id,
        cell: pickedBuilding.data.tile.get(),
        kind: kind.id,
        status,
        problem,
        groups,
        pausable,
        paused: pickedBuilding.data.paused.present,
        salvage: salvageFor(builtCost(kind, upgraded), maybe(pickedBuilding.data.site)),
        upgraded,
        upgrade: upgradeOffer
      }
    } else if (pickedHouse) {
      const { h, summary, trouble, groups } = describeHouse(pickedHouse)
      ui.panel = {
        type: "house", id: pickedHouse.entity.id, cell: pickedHouse.data.tile.get(), tier: h.tier, summary, trouble, groups,
        closable: !pickedHouse.data.site.present && !pickedHouse.data.rising.present && !pickedHouse.data.burning.present,
        closed: pickedHouse.data.closed.present,
        salvage: salvageFor(home.cost, maybe(pickedHouse.data.site))
      }
    } else if (pickedPark && picked) {
      ui.panel = {
        type: "park",
        id: pickedPark.entity.id,
        cell: pickedPark.data.tile.get(),
        cells: picked.cells.length,
        value: picked.value,
        reach: picked.reach,
        lines: describePark(picked)
      }
    } else if (pickedRuin) {
      const r = pickedRuin.data.ruin.get()
      ui.panel = {
        type: "ruin",
        id: pickedRuin.entity.id,
        cell: pickedRuin.data.tile.get(),
        cause: r.cause,
        lines: [
          { icon: "condition", label: "what happened", value: r.cause === "burnt" ? "it burned down" : r.cause === "collapsed" ? "it fell down for want of mending" : "it was left derelict after its thefts", tone: "bad" },
          { icon: "appeal", label: "desirability nearby", value: "−3", tone: "warn", note: "until it is cleared: bulldoze it" }
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
    const overlayKey = `${view}|${Math.floor(tick / 30)}|${ui.selected}|${buildings.length}|${houses.length}`
    if (view === "none") {
      if (ui.overlay.key !== "none") ui.overlay = { key: "none", cells: [] }
      if (ui.tints.size > 0) ui.tints = new Map()
      ui.legend = null
    } else if (ui.overlay.key !== overlayKey) {
      const out: Array<OverlayCell> = []
      // The same reading washed over each model, so the view is legible where buildings hide the ground.
      const tints = new Map<number, number>()
      const tintOf = (color: number) => (color === GOOD ? TINT.good : color === FAIR ? TINT.fair : color === BAD ? TINT.bad : color === COOL ? TINT.cool : TINT.plain)
      const standing = <T extends { readonly data: { readonly site: { readonly present: boolean }; readonly rising: { readonly present: boolean } } }>(rows: ReadonlyArray<T>) =>
        rows.filter(({ data }) => !data.site.present && !data.rising.present)
      if (view === "appeal") {
        for (let y = 0; y < GRID; y++)
          for (let x = 0; x < GRID; x++) {
            const use = useAt(grid, x, y)
            if (use === "void" || use === "water") continue
            out.push({ x, y, size: 1, color: appealColor(appealAt(cells, x, y)), alpha: 0.32 })
          }
        for (const { entity, data } of standing(houses)) {
          const t = data.tile.get()
          const d = appealAt(cells, t.x, t.y)
          tints.set(entity.id, d >= home.tiers[2].appeal ? TINT.fine : d >= 0 ? TINT.plain : d > home.squalid ? TINT.fair : TINT.bad)
        }
      } else if (view === "workers") {
        const picked = pickedBuilding && pickedBuilding.data.staff.get().needed > 0 ? pickedBuilding : undefined
        let inReach: ((t: TileLike) => boolean) | null = null
        if (picked) {
          const roads = reach(grid, doors(grid, picked.data.tile.get()))
          for (let k = 0; k < roads.distance.length; k++) {
            const d = roads.distance[k]!
            if (d >= 0 && d <= COMMUTE) out.push({ x: k % GRID, y: Math.floor(k / GRID), size: 1, color: MARK, alpha: 0.14 })
          }
          inReach = (t) => doors(grid, t).some((c) => {
            const n = roads.distance[key(c.x, c.y)]!
            return n >= 0 && n <= COMMUTE
          })
        }
        for (const { entity, data } of standing(houses)) {
          const t = data.tile.get()
          const h = data.house.get()
          const ring = inReach !== null && inReach(t)
          out.push({ ...t, color: h.tier === 1 ? 0xd6b48a : COOL, alpha: ring ? 0.75 : 0.45, ...(ring ? { ring: true } : {}) })
          tints.set(entity.id, h.tier === 1 ? TINT.settlers : TINT.cool)
        }
        for (const { entity, data } of standing(buildings)) {
          const s = data.staff.get()
          if (s.needed === 0) continue
          const color = s.assigned >= s.needed ? GOOD : s.assigned > 0 ? FAIR : BAD
          out.push({ ...data.tile.get(), color, alpha: 0.45, ...(entity.id === picked?.entity.id ? { ring: true } : {}) })
          tints.set(entity.id, tintOf(color))
        }
      } else if (view === "fire" || view === "health" || view === "order") {
        for (const { entity, data } of standing(houses)) {
          const r = maybe(data.risk)
          if (!r) continue
          const struck = view === "fire" ? data.burning.present : view === "health" ? data.sick.present : r.thefts > 0
          const color = struck ? BAD : meterColor(r[view], RISK_MAX, risk.warn)
          out.push({ ...data.tile.get(), color, alpha: struck ? 0.8 : 0.5 })
          tints.set(entity.id, tintOf(color))
        }
        for (const { entity, data } of standing(buildings)) {
          const service = maybe(data.service)?.service
          const r = maybe(data.risk)
          if (service === view) {
            out.push({ ...data.tile.get(), color: MARK, alpha: 0.55, ring: true })
            tints.set(entity.id, TINT.mark)
          } else if (view === "fire" && r) {
            const color = data.burning.present ? BAD : meterColor(r.fire, RISK_MAX, risk.warn)
            out.push({ ...data.tile.get(), color, alpha: 0.4 })
            tints.set(entity.id, tintOf(color))
          }
        }
      } else if (view === "condition") {
        for (const row of [...standing(houses), ...standing(buildings)]) {
          const c = maybe(row.data.condition)
          if (!c) continue
          const color = c.value < wear.worn ? BAD : c.value < wear.mend ? FAIR : GOOD
          out.push({ ...row.data.tile.get(), color, alpha: 0.5 })
          tints.set(row.entity.id, tintOf(color))
        }
        for (const { entity, data } of standing(buildings)) if (maybe(data.service)?.service === "repair") {
          out.push({ ...data.tile.get(), color: MARK, alpha: 0.55, ring: true })
          tints.set(entity.id, TINT.mark)
        }
        for (const { data } of ruins) out.push({ ...data.tile.get(), color: BAD, alpha: 0.8 })
      }
      ui.overlay = { key: overlayKey, cells: out }
      ui.tints = tints
      ui.legend = legends[view]
    }

    // ── What needs looking at ──
    const alerts: Array<Notice> = []
    const census = resources.census.get()
    const stock = resources.stock.get()
    /** A building of this kind stands (built, not a site). */
    const stands = (k: KindId) => buildings.some(({ data }) => data.building.get().kind === k && !data.site.present && !data.rising.present)
    // Each line says what is wrong, then what to do about it.
    const burningRow = [...buildings, ...houses].find(({ data }) => data.burning.present)
    const fireText = `${census.burning} on fire: ${stands("firewatch") ? "the fire watch's firefighters are on their way" : "build a fire watch nearby, whose firefighters put fires out"}`
    if (census.burning > 0) alerts.push({ tone: "bad", text: fireText, at: burningRow?.data.tile.get() ?? null, size: burningRow?.data.tile.get().size ?? 1, id: burningRow?.entity.id ?? null })
    const sickRow = houses.find(({ data }) => data.sick.present)
    const sickText = `${census.sick} home${census.sick > 1 ? "s" : ""} sick, holding half as many people: ${stands("healer") || stands("hospital") ? "a healer within reach of its road cures it" : "build a healer among the homes"}`
    if (census.sick > 0) alerts.push({ tone: "warn", text: sickText, at: sickRow?.data.tile.get() ?? null, size: 1, id: sickRow?.entity.id ?? null })
    const waiting = new Map<string, { n: number; at: TileLike; id: number; kind: KindId }>()
    const remote = new Map<string, { n: number; at: TileLike; id: number; kind: KindId }>()
    const shortStaffed: Array<{ id: number; title: string; cell: Point; size: number; assigned: number; needed: number; nobodyNear: boolean }> = []
    const seen = new Set<number>()
    for (const { entity, data } of buildings) {
      if (data.site.present || data.rising.present || data.paused.present) continue
      const kind = kinds[data.building.get().kind]
      const status = data.status.get()
      const staff = data.staff.get()
      const tile = data.tile.get()
      if (status === "starved" && kind.recipe?.input) {
        seen.add(entity.id)
        const since = starvedSince.get(entity.id) ?? tick
        if (!starvedSince.has(entity.id)) starvedSince.set(entity.id, tick)
        if (tick - since >= ALERT_PATIENCE) {
          const label = `${kind.title.toLowerCase()} needs ${kind.recipe.input}`
          const was = waiting.get(label)
          waiting.set(label, was ? { ...was, n: was.n + 1 } : { n: 1, at: tile, id: entity.id, kind: kind.id })
        }
      }
      if (staff.needed > 0 && staff.assigned < staff.needed) shortStaffed.push({ id: entity.id, title: kind.title.toLowerCase(), cell: tile, size: tile.size, assigned: staff.assigned, needed: staff.needed, nobodyNear: staff.nearby === 0 })
      if (status === "unstaffed" && staff.nearby === 0) {
        const label = kind.title.toLowerCase()
        const was = remote.get(label)
        remote.set(label, was ? { ...was, n: was.n + 1 } : { n: 1, at: tile, id: entity.id, kind: kind.id })
      }
    }
    for (const id of [...starvedSince.keys()]) if (!seen.has(id)) starvedSince.delete(id)
    const list = (m: Map<string, { n: number }>) => [...m].map(([k, v]) => `${k}${v.n > 1 ? ` ×${v.n}` : ""}`).join(", ")
    const first = (m: Map<string, { at: TileLike; id: number }>) => [...m.values()][0]
    const placesOf = (m: Map<string, { at: TileLike; id: number; kind: KindId }>) =>
      Object.fromEntries([...m.values()].map((v) => [v.kind, { at: v.at, size: v.at.size, id: v.id }]))
    if (waiting.size > 0) alerts.push({ tone: "warn", text: `idle: the ${list(waiting)}. Build more of what makes it, or buy it in the [town] panel`, at: first(waiting)?.at ?? null, size: first(waiting)?.at.size ?? 1, id: first(waiting)?.id ?? null, places: placesOf(waiting) })
    if (remote.size > 0) alerts.push({ tone: "warn", text: `no workers for the ${list(remote)}: lay [homes] within ${COMMUTE} road cells of it, or a road to homes nearby`, at: first(remote)?.at ?? null, size: first(remote)?.at.size ?? 1, id: first(remote)?.id ?? null, places: placesOf(remote) })
    const hallRow = buildings.find(({ data }) => data.hall.present)
    const empty = census.homes > 0 && larder(stock) === 0
    if (!empty || (emptySince !== null && emptySince > tick)) emptySince = null
    if (empty && emptySince === null) emptySince = tick
    if (empty && tick - emptySince! >= HUNGER_PATIENCE) hungryUntil = tick + HUNGER_PATIENCE
    if (hungryUntil > tick + HUNGER_PATIENCE) hungryUntil = 0
    if (census.homes > 0 && tick < hungryUntil) alerts.push({ tone: "bad", text: "no food in store, so homes go hungry and pay no taxes: build another fishery, or buy fish in the [town] panel", at: hallRow?.data.tile.get() ?? null, size: hallRow?.data.tile.get().size ?? 1, id: hallRow?.entity.id ?? null })
    const ledger = resources.ledger.get()
    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    let suppliedTaxes = 0
    for (const { data } of houses) {
      if (data.site.present || data.rising.present || data.burning.present) continue
      const tile = data.tile.get()
      suppliedTaxes += suppliedTaxOf(data.house.get(), rates, undefined, appealAt(cells, tile.x, tile.y))
    }
    const coins = resources.treasury.get().coins
    const net = ledger.taxes + ledger.trade - ledger.upkeep - ledger.admin
    const mood = resources.mood.get()
    const crown = resources.crown.get()
    // What the homes would pay at each step of each tier's rate, once settled there (see `taxOutlook`).
    const taxed: Array<TaxedHome> = []
    for (const { data } of houses) {
      if (data.site.present || data.rising.present || data.burning.present || data.closed.present) continue
      const tile = data.tile.get()
      taxed.push({ ...data.house.get(), desirability: appealAt(cells, tile.x, tile.y), paying: true })
    }
    const f = resources.fate.get()
    const pantry = resources.pantry.get()
    const season = seasonAt(Math.min(Math.max(0, t), f.began + termTicks(charter) - 1), charter)
    const approvalAt = (r: { readonly settlers: number; readonly citizens: number }, memory: number) =>
      approvalTarget(taxed, r, coins, crown.snubs.length, season.winter, undefined, memory).target
    const outlookOf = (tier: "settlers" | "citizens") => taxed.some((h) => (h.tier === 1) === (tier === "settlers"))
      ? TAX_STEPS.map((rate) => ({ rate, taxes: Math.round(taxOutlook(taxed, rates, tier, rate, approvalAt)) }))
      : []
    const seconds = (steps: number) => Math.max(0, Math.ceil(steps / 60))
    const danger = (since: number, minutes: number) => (since < 0 ? null : seconds(since + minutes * 3600 - t))
    // The winter after the coming one, for the almanac.
    const comingYear = season.winter || winterOf(charter, season.year) === null ? season.year + 1 : season.year

    // ── The mayor's guide ──
    // The page writes what the mayor told it; then the guide puts away what the town has done, and picks the step to show.
    for (const action of ui.guide.splice(0)) {
      resources.guide.update((g) =>
        action.type === "skip" ? (g.done.includes(action.id) ? g : { ...g, done: [...g.done, action.id] }) : { ...g, off: action.type === "off" }
      )
    }
    const placedKinds = new Set(buildings.map(({ data }) => data.building.get().kind))
    const standingKinds = new Set(buildings.filter(({ data }) => !data.site.present && !data.rising.present).map(({ data }) => data.building.get().kind))
    const finished = (row: { readonly data: { readonly site: { readonly present: boolean }; readonly rising: { readonly present: boolean } } }) => !row.data.site.present && !row.data.rising.present
    const wornRow = buildings.find((row) => finished(row) && !row.data.hall.present && (maybe(row.data.condition)?.value ?? CONDITION_MAX) < wear.mend)
    // A settlers' home with bread, cloth, and faith, kept from citizens only by its street.
    const poorRow = houses.find((row) => {
      const h = row.data.house.get()
      if (h.tier !== 1 || !finished(row)) return false
      const tile = row.data.tile.get()
      return met(h, "bread") && met(h, "cloth") && met(h, "faith") && appealAt(cells, tile.x, tile.y) < home.tiers[2].appeal
    })
    const guide = resources.guide.get()
    const put = new Set(guide.done)
    /** A road within two cells of water: reckoned only until the guide's road step is put away. */
    const roadNearWater = () => {
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (useAt(grid, x, y) !== "road") continue
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (useAt(grid, x + dx, y + dy) === "water") return true
        }
      }
      return false
    }
    /** Built homes no food walker reaches: reckoned only until a market stands, as it is a walk from each walker's door. */
    const unreachedHomes = () => {
      const walks = buildings
        .filter((row) => maybe(row.data.service)?.service === "goods" && finished(row))
        .map((row) => ({ way: reach(grid, doors(grid, row.data.tile.get())), range: maybe(row.data.service)!.range }))
      return houses.filter((row) => {
        if (!finished(row)) return false
        const ds = doors(grid, row.data.tile.get())
        return ds.length > 0 && !walks.some((w) => (nearest(w.way, ds)?.distance ?? Infinity) < w.range)
      }).length
    }
    const facts: GuideFacts = {
      homes: houses.length,
      builtHomes: houses.filter(finished).length,
      residents: census.settlers + census.citizens,
      citizens: census.citizens,
      finerHomes: houses.filter((row) => row.data.house.get().tier > 1).length,
      placed: placedKinds,
      standing: standingKinds,
      stock,
      sick: census.sick,
      burning: census.burning,
      winter: season.winter,
      winterIn: season.coming === null ? null : seconds(season.left),
      worn: wornRow !== undefined,
      poorStreet: poorRow !== undefined,
      crown: { open: crown.open, met: crown.met },
      net: steadyNet(resources.history.get().samples, net),
      approval: mood.approval,
      trading: rates.sells.length > 0 || rates.buys.length > 0,
      buysTools: rates.buys.includes("tools"),
      taxed: rates.settlers !== 100 || rates.citizens !== 100,
      most: Math.max(...goodIds.map((g) => stock[g])),
      sawTown: ui.menu === "town",
      sawHome: houses.some((row) => row.entity.id === ui.selected),
      sawBuilding: buildings.some((row) => row.entity.id === ui.selected && !row.data.hall.present),
      roadToWater: put.has("road") || roadNearWater(),
      coins,
      unreached: put.has("market") || standingKinds.has("market") ? 0 : unreachedHomes(),
      rank: f.rank,
      upgraded: new Set(buildings.filter((row) => row.data.upgraded.present).map((row) => row.data.building.get().kind)),
      risk: {
        fire: houses.some((row) => (maybe(row.data.risk)?.fire ?? 0) >= RISK_MAX * 0.35),
        health: houses.some((row) => (maybe(row.data.risk)?.health ?? 0) >= RISK_MAX * 0.35),
        order: houses.some((row) => (maybe(row.data.risk)?.order ?? 0) >= RISK_MAX * 0.35)
      },
      fewTrees: buildings.some((row) => {
        if (row.data.building.get().kind !== "lumberjack" || !finished(row)) return false
        const tile = row.data.tile.get()
        const reach = kinds.lumberjack.gathers!.radius
        return queries.trees.each().map(({ data }) => data.tile.get()).filter((t) => t.x >= tile.x - reach && t.x < tile.x + tile.size + reach && t.y >= tile.y - reach && t.y < tile.y + tile.size + reach).length < 6
      })
    }
    const playing = f.state === "playing" && !ui.founding
    const newly = playing ? guideDone(facts, put) : []
    if (newly.length > 0) {
      resources.guide.update((g) => ({ ...g, done: [...g.done, ...newly] }))
      for (const id of newly) put.add(id)
    }
    // The guide keeps quiet a while after a step is put away; a new town (the clock gone back) starts it afresh.
    if (t < guidePace.since) Object.assign(guidePace, { shown: null, since: 0, quietUntil: 0 })
    if (guidePace.shown !== null && put.has(guidePace.shown)) Object.assign(guidePace, { shown: null, quietUntil: t + GUIDE_QUIET * 60 })
    const step = guide.off || !playing ? null : guideStep(facts, put, { shown: guidePace.shown, quiet: t < guidePace.quietUntil })
    if (step && !step.urgent?.(facts)) guidePace.shown = step.id
    guidePace.since = t
    const hallTile = hallRow?.data.tile.get()
    /** Of some tiles, the one nearest the town hall. */
    const nearestHall = (tiles: ReadonlyArray<TileLike>): TileLike | undefined => {
      if (!hallTile) return tiles[0]
      let best: TileLike | undefined
      let far = Infinity
      for (const tile of tiles) {
        const d = Math.abs(tile.x - hallTile.x) + Math.abs(tile.y - hallTile.y)
        if (d < far) [best, far] = [tile, d]
      }
      return best
    }
    const focusOf = (focus: GuideFocus | null): { at: TileLike | null; id: number | null } => {
      if (focus === null) return { at: null, id: null }
      if (focus === "hall") return { at: hallTile ?? null, id: null }
      if (focus === "water") return { at: nearestHall(queries.water.each().map(({ data }) => data.tile.get())) ?? null, id: null }
      if (focus === "trees") return { at: nearestHall(queries.trees.each().map(({ data }) => data.tile.get())) ?? null, id: null }
      if (focus === "stone" || focus === "ore") {
        const ore = focus === "ore"
        return { at: nearestHall(queries.rocks.each().filter(({ data }) => data.rock.get().ore === ore).map(({ data }) => data.tile.get())) ?? null, id: null }
      }
      const row = focus === "worn" ? wornRow : focus === "poorStreet" ? poorRow : buildings.find(({ data }) => data.building.get().kind === focus.kind)
      return row ? { at: row.data.tile.get(), id: row.entity.id } : { at: null, id: null }
    }
    const shown = step ? focusOf(step.focus) : null
    const flowNow = resources.flow.get().last
    const flowHeld = resources.flow.get().held
    ui.stats = {
      coins,
      taxes: ledger.taxes,
      suppliedTaxes: Math.round(suppliedTaxes),
      taxOutlook: { settlers: outlookOf("settlers"), citizens: outlookOf("citizens") },
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
      shortStaffed,
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
          { label: "taxes now", value: mood.taxes },
          { label: "a grudge over taxes past", value: mood.grudge },
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
        term: f.term,
        began: f.began / 3600,
        rank: f.rank,
        rankTitle: ranks[f.rank]?.title ?? "",
        nextTitle: f.rank + 1 < ranks.length ? ranks[f.rank + 1]!.title : null,
        score: f.score,
        bankrupt: danger(f.debtSince, fate.debt),
        revolt: danger(f.revoltSince, fate.revolt),
        rises: danger(f.goalSince, fate.hold),
        peak: f.peak
      },
      goals: goalsOf(
        charter,
        { settlers: census.settlers, citizens: census.citizens, burghers: census.burghers, coins, net: steadyNet(resources.history.get().samples, net), approval: mood.approval },
        undefined,
        f.rank
      ),
      larder: larder(stock),
      flow: flowNow === null ? null : { ...flowNow, elsewhere: amounts(Object.fromEntries(goodIds.map((g) => [g, Math.max(0, flowHeld[g] - stock[g])]))) },
      eaten: pantry.eatenLast,
      rotted: pantry.rottedLast,
      sick: census.sick,
      burning: census.burning,
      history: resources.history.get().samples,
      chronicle: resources.chronicle.get().lines,
      alerts,
      guide: {
        step:
          step && shown
            ? {
                key: step.id,
                chapter: step.chapter,
                goal: step.goal,
                text: step.action,
                why: step.why,
                waiting: step.waiting?.(facts) ?? null,
                locked: lockedNote(step, facts),
                next: upcoming(facts, put),
                asks: step.asks ?? [],
                near: step.focus !== null && typeof step.focus === "object" && shown.id !== null ? step.focus.kind : null,
                count: courseCount(step),
                at: shown.at,
                size: shown.at?.size ?? 1,
                id: shown.id
              }
            : null,
        done: guideSteps.filter((s) => put.has(s.id)).length,
        total: guideSteps.length,
        off: guide.off
      }
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
    resources: { land: Game.System.readResource(Land), time: Game.System.readResource(Time), charter: Game.System.readResource(Charter), fate: Game.System.readResource(Fate) },
    services: { stage: Game.System.service(StageService) }
  },
  ({ resources, services }) => {
    const mask = resources.land.get().mask
    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    services.stage.setLand(mask, t > 0 && seasonAt(Math.min(t, resources.fate.get().began + termTicks(charter) - 1), charter).winter)
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

/** Roads, water, and parks, each redrawn as one layer whenever one is laid or anything is removed. */
export const DrawGround = Game.System(
  "Town/DrawGround",
  {
    queries: {
      roads: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road] }),
      paved: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road, Paved] }),
      added: Game.Query({ selection: { paved: Game.Query.read(Paved) }, filters: [Game.Query.added(Paved)] }),
      water: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Water] }),
      parks: ParkRead,
      relaid: Game.Query({ selection: { park: Game.Query.read(Park) }, filters: [Game.Query.changed(Park)] }),
      laid: Game.Query({ selection: { tile: Game.Query.read(Tile) }, filters: [Game.Query.added(Tile)] })
    },
    despawned: { entities: Game.System.readDespawned() },
    services: { stage: Game.System.service(StageService) }
  },
  ({ queries, despawned, services }) => {
    const dirty = services.stage.groundDirty
    if (!dirty && queries.laid.each().length === 0 && queries.added.each().length === 0 && queries.relaid.each().length === 0 && despawned.entities.all().length === 0) return
    const cellsOf = (rows: ReadonlyArray<{ readonly data: { readonly tile: { get(): TileLike } } }>) =>
      new Set(rows.map(({ data }) => key(data.tile.get().x, data.tile.get().y)))
    const roads = cellsOf(queries.roads.each())
    services.stage.setGround(roads, cellsOf(queries.water.each()), cellsOf(queries.paved.each()))
    services.stage.setParks(new Map(queries.parks.each().map(({ data }) => [key(data.tile.get().x, data.tile.get().y), { ...data.tile.get(), ...data.park.get() }])), roads)
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
      rocks: Game.Query({ selection: { rock: Game.Query.read(Rock), tile: Game.Query.read(Tile) } }),
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
          effects: {
            wear: 1-(maybe(data.condition)?.value??CONDITION_MAX)/CONDITION_MAX,
            fireRisk: hazardStrength(r?.fire??0,risk.warn,RISK_MAX)
          },
          working: status === "working",
          tint: services.ui.tints.get(entity.id),
          problem: problemOf(kind, status) !== null,
          build: buildOf(maybe(data.site), maybe(data.rising)),
          beat: recipe ? recipe.made : maybe(data.service) ? walkers : 0,
          doors: doorsOf(grid, data.tile.get()),
          site: siteShare(maybe(data.site)),
          upgraded: data.upgraded.present
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
            effects: {
              wear: Math.max(desirability<0?0.55:0,1-(maybe(data.condition)?.value??CONDITION_MAX)/CONDITION_MAX),
              fireRisk: hazardStrength(maybe(data.risk)?.fire??0,risk.warn,RISK_MAX),
              health: hazardStrength(maybe(data.risk)?.health??0,risk.warn,RISK_MAX),
              order: hazardStrength(maybe(data.risk)?.order??0,risk.warn,RISK_MAX),
              sick: Number(data.sick.present)
            },
            band: desirability < 0 ? "poor" : desirability >= home.tiers[2].appeal ? "fine" : "plain",
            closed: data.closed.present,
            tint: services.ui.tints.get(entity.id)
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
        : maybe(data.rescue)
          ? { kind: "service", role: "firefighter" }
        : roam?.service === "fire"
          ? { kind: "service", role: "watchman" }
        : roam?.service === "health"
          ? { kind: "service", role: "physician" }
        : roam?.service === "order"
          ? { kind: "service", role: "constable" }
        : roam?.service === "repair"
          ? { kind: "service", role: "builder" }
        : roam?.service === "faith"
          ? { kind: "bell" }
          : roam && total(roam.basket) > 0
            ? { kind: "basket", goods: goodIds.filter((g) => roam.basket[g] > 0) }
            : { kind: "none" }
      services.walkerNodes.get(entity.id)?.update(p.x, p.y, p.dir, p.phase, load)
    }
    for (const { entity, data } of queries.trees.each())
      services.treeNodes.get(entity.id)?.update(data.tree.get().growth, emphasis(entity.id))
    // Neighbouring rocks are drawn as one big outcrop; the blocks are formed again only when a rock runs out (or the land changes).
    const rocks = queries.rocks.each()
    const rockKey = `${rocks.length}:${rocks.reduce((n, { entity }) => n + entity.id, 0)}`
    if (rockKey !== rockShapes.key) {
      rockShapes.key = rockKey
      rockShapes.parts = rockBlocks(rocks.map(({ entity, data }) => ({ id: entity.id, ...data.tile.get(), ore: data.rock.get().ore })))
    }
    const amounts = new Map<number, number>(rocks.map(({ entity, data }) => [entity.id, data.rock.get().amount]))
    for (const { entity, data } of rocks) {
      const r = data.rock.get()
      const part = rockShapes.parts.get(entity.id)
      if (!part || !part.draws) services.rockNodes.get(entity.id)?.update(r.ore, r.amount, part ? 0 : 1, part ? 0 : 1)
      else services.rockNodes.get(entity.id)?.update(r.ore, part.members.reduce((n, id) => n + (amounts.get(id) ?? 0), 0) / part.members.length, part.w, part.h)
    }
    for (const { entity, data } of queries.fields.each()) services.fieldNodes.get(entity.id)?.update(data.field.get().growth)
  }
)

/** The guide's pace (page-side, not saved): the step it is showing, and until when it keeps quiet. */
const guidePace: { shown: string | null; since: number; quietUntil: number } = { shown: null, since: 0, quietUntil: 0 }

const rockShapes: { key: string; parts: Map<number, RockPart> } = { key: "", parts: new Map() }

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
