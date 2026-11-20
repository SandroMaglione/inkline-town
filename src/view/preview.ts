/**
 * What the map shows besides the world while the player works: ghosts of
 * what would be laid, the road being dragged, outlines of what is picked and
 * what it reaches, and cells that will not take it.
 */
import { COMMUTE, grounds, home, kinds, nextUpgrade, PAVE_COST, props, ROAD_COST, type Kind, type Tier } from "../game/content/index.ts"
import { upgradeChanges } from "../game/rules/upgrades.ts"
import { capacity, lockReason, taxOf, upgradeBlock } from "../game/schedule.ts"
import { moreAdmin } from "../game/rules/households.ts"
import { appealAt, type ParkCell } from "../game/world/appeal.ts"
import { canPlace, cellOf, doors, key, lPath, reach, useAt, type TileLike } from "../game/world/grid.ts"
import { inside, type Point } from "../game/world/iso.ts"
import { emptyPreview, type Interaction } from "./contracts.ts"
import { reachOf } from "./facts.ts"
import type { Frame } from "./frame.ts"
import { cellAt, footprintAt, rectangle } from "./interaction/geometry.ts"
import { say } from "../i18n/index.ts"
import { placeProblem, refuses } from "./interaction/placing.ts"

/**
 * What new cottages would bring in, fed, at the settlers' rate on their streets, less what they add to the
 * town hall's administration for their residents (see `moreAdmin`): the sum that turns once a town is large.
 */
const homesWorth = (frame: Frame, at: ReadonlyArray<Point>) => {
  const { houses, cells, approval, rates } = frame
  if (at.length === 0) return ""
  const words = frame.t.view.tooltip
  const standing = houses.filter((row) => row.data.closed === undefined).reduce((n, row) => n + row.data.house.residents, 0)
  const fed = { tier: 1 as Tier, food: 1, bread: 0, cloth: 0, faith: 0, furniture: 0, residents: home.tiers[1].residents }
  let people = 0
  const pays = at.reduce((sum, c) => {
    const d = appealAt(cells, c.x, c.y), residents = capacity(fed, approval, d, undefined, rates.settlers)
    people += residents
    return sum + taxOf({ ...fed, residents }, rates, undefined, d)
  }, 0)
  return words.homesWorth(Math.round(pays - moreAdmin(standing, people)))
}

/** The preview for this frame, and whether a stroke is being let go off the map (`dropping`). */
export const previewOf = (frame: Frame, ui: Interaction) => {
  const { grid, buildings, t } = frame
  const words = t.view.tooltip

  const preview = emptyPreview()
  const pointer = ui.pointer
  const cell = pointer ? cellAt(pointer) : null
  preview.hover = pointer && (ui.tool === "select" || ui.tool === "bulldoze" || ui.tool === "upgrade") ? frame.pickAt(pointer, ui.pointerHit) : null
  const showReach = (tile: TileLike, kind: Kind) => {
    const r = reachOf(kind)
    if (r !== null) preview.plots.push({ x: tile.x - r, y: tile.y - r, size: tile.size + 2 * r, look: "reach" })
  }
  const pavedCells = new Set(frame.paved.map(({ data }) => key(data.tile.x, data.tile.y)))
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
    if (kind.service && range !== undefined) rangeFrom(tile, range, words.walkersReach(range))
    else if (kind.workers > 0) rangeFrom(tile, COMMUTE + 1, words.workersFrom)
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
  // Let go off the map (over the tool bar, say) and the stroke is dropped: it shows as blocked.
  const dropping = ui.stroke === "cancel" && ui.dragFrom !== null
  if (dropping && cell && (ui.tool === "road" || ui.tool === "home" || ui.tool === "pave" || ui.tool === "ground")) {
    for (const c of ui.tool === "ground" ? rectangle(ui.dragFrom!, cell) : lPath(ui.dragFrom!, cell))
      if (inside(c.x, c.y)) preview.plots.push({ ...c, size: 1, look: "blocked" })
    preview.tooltip = words.cancel
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
      rangeFrom({ ...(ui.dragFrom ?? cell), size: 1 }, COMMUTE + 1, words.residentsWalk)
      preview.tooltip = words.homes(home.cost, preview.rangeNote ? homesWorth(frame, preview.ghosts.map((g) => g.cell)) : null)
    }
    if (ui.tool === "road" && cell) preview.tooltip = words.road(ROAD_COST)
    if (ui.dragFrom && cell) {
      const n = ui.tool === "road" ? preview.roads.length : ui.tool === "home" ? preview.ghosts.length : preview.plots.filter((p) => p.look === "reach").length
      preview.stroke =
        ui.tool === "road"
          ? words.roadStroke(n, { coins: n * ROAD_COST, materials: {} })
          : ui.tool === "home"
            ? words.homesStroke(n, times(home.cost, n), homesWorth(frame, preview.ghosts.map((g) => g.cell)))
            : words.paveStroke(n, { coins: n * PAVE_COST.coins, materials: { stone: n * PAVE_COST.stone } })
    }
  } else if (ui.tool === "ground" && cell) {
    const laid: Array<ParkCell> = []
    for (const c of ui.dragFrom ? rectangle(ui.dragFrom, cell) : [cell]) {
      if (!inside(c.x, c.y)) continue
      const there = frame.parkAt.get(key(c.x, c.y))?.data.park
      if (there ? there.ground !== ui.ground : canPlace(grid, { ...c, size: 1 })) laid.push({ ...c, ground: ui.ground, prop: there?.prop ?? "none" })
      else if (!there) preview.plots.push({ ...c, size: 1, look: "blocked" })
    }
    preview.parks.push(...laid)
    const after = laid.length > 0 ? frame.parkOf(laid[0]!, laid) : undefined
    const cost = times(grounds[ui.ground].cost, laid.length)
    if (ui.dragFrom) preview.stroke = words.groundStroke(ui.ground, laid.length, cost)
    preview.tooltip = words.ground(ui.ground, cost, after ? after.value : null)
    if (after) preview.plots.push(...frame.reachPlots(after))
  } else if (ui.tool === "prop" && cell && inside(cell.x, cell.y)) {
    const there = frame.parkAt.get(key(cell.x, cell.y))?.data.park
    if (there) {
      const placed = { ...cell, ground: there.ground, prop: ui.prop }
      preview.parks.push(placed)
      const before = frame.parkOf(cell)
      const after = frame.parkOf(cell, [placed])
      preview.tooltip = words.prop(ui.prop, props[ui.prop].cost, after ? { value: after.value, before: before && before.value !== after.value ? before.value : null, crowded: after.crowded > 0 } : null)
      if (after) preview.plots.push(...frame.reachPlots(after))
    } else {
      preview.plots.push({ ...cell, size: 1, look: "blocked" })
      preview.tooltip = words.propNeedsPark(ui.prop)
    }
  } else if (ui.tool === "place" && ui.placing && pointer) {
    const kind = kinds[ui.placing]
    const at = footprintAt(pointer, kind.size)
    const tile = { ...at, size: kind.size }
    showReach(tile, kind)
    rangeOfKind(tile, kind)
    if (kind.appeal) preview.plots.push({ x: tile.x - kind.appeal.reach, y: tile.y - kind.appeal.reach, size: tile.size + 2 * kind.appeal.reach, look: kind.appeal.value > 0 ? "reach" : "hover" })
    if (lockReason(kind, frame.world.census)) preview.plots.push({ ...tile, look: "blocked" })
    else if (canPlace(grid, tile)) {
      preview.ghosts.push({ what: ui.placing, cell: at })
      // No road at a side's middle: shown red under the ghost, as it will not be laid there.
      if (refuses(placeProblem(frame, kind, tile))) preview.plots.push({ ...tile, look: "blocked" })
    } else preview.plots.push({ ...tile, look: "blocked" })
  } else if (ui.tool === "upgrade" && ui.upgrading) {
    // Every building the upgrade can go to, outlined; the one under the pointer says what it would give and cost.
    const rank = frame.world.fate.rank, coins = frame.world.treasury.coins
    for (const row of buildings) {
      const { data } = row
      if (data.building.kind !== ui.upgrading || data.site !== undefined || data.rising !== undefined) continue
      const kind = kinds[ui.upgrading], level = data.upgraded?.level ?? 0, up = nextUpgrade(kind, level)
      const tile = data.tile
      if (!up) continue
      const blocked = upgradeBlock(up, rank)
      const hovered = preview.hover === row.entity.id
      preview.plots.push({ ...tile, look: data.works !== undefined || blocked !== null ? "blocked" : hovered ? "picked" : "reach" })
      if (!hovered) continue
      const said = t.view.upgrade, path = said.path(kind.id, level)
      preview.tooltip = data.works !== undefined
        ? `${path} · ${said.underWay}`
        : [path, said.price(up.cost), ...upgradeChanges(kind, level).map((c) => `· ${said.line(say(said.change, c))}`),
            blocked !== null ? t.needsRank(blocked) : coins < up.cost.coins ? said.short(up.cost.coins - coins) : said.begin].join("\n")
    }
    if (!preview.tooltip) preview.tooltip = t.view.upgrade.pick(ui.upgrading)
  } else if (ui.tool === "bulldoze") {
    preview.danger = true
    if ((preview.hover === null || useAt(grid, cell?.x ?? -1, cell?.y ?? -1) === "park") && cell && ["road", "tree", "field", "park"].includes(useAt(grid, cell.x, cell.y)))
      preview.plots.push({ ...cell, size: 1, look: "blocked" })
    const there = cell ? frame.parkAt.get(key(cell.x, cell.y))?.data.park : undefined
    if (there) preview.tooltip = there.prop !== "none" ? words.removeProp(there.prop) : words.removeGround(there.ground)
    const rock = cell ? frame.rockAt.get(key(cell.x, cell.y)) : undefined
    if (rock && cell) {
      const worked = rock.amount <= 1
      if (worked) preview.plots.push({ ...cell, size: 1, look: "blocked" })
      preview.tooltip = worked ? words.workedFace(rock.ore) : words.rock(rock.ore, rock.amount)
    }
  }
  if (ui.selected !== null) {
    const row = buildings.find((b) => b.entity.id === ui.selected)
    const tile = frame.tileOf(ui.selected)
    const whole = tile && useAt(grid, tile.x, tile.y) === "park" ? frame.parkOf(tile) : undefined
    if (whole) {
      // A park is picked whole: every cell of it, and how far it reaches.
      for (const c of whole.cells) preview.plots.push({ x: c.x, y: c.y, size: 1, look: "hover" })
      preview.plots.push(...frame.reachPlots(whole))
    } else if (tile) preview.plots.push({ ...tile, look: "picked" })
    if (row && tile) {
      showReach(tile, kinds[row.data.building.kind])
      rangeOfKind(tile, kinds[row.data.building.kind], row.data.service?.range)
    }
  }
  return { preview, dropping }
}
