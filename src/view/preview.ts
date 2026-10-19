/**
 * What the map shows besides the world while the player works: ghosts of
 * what would be laid, the road being dragged, outlines of what is picked and
 * what it reaches, and cells that will not take it.
 */
import { COMMUTE, costText, grounds, home, kinds, nextUpgrade, PAVE_COST, props, ranks, ROAD_COST, upgradeAt, type Kind, type Tier } from "../game/content/index.ts"
import { upgradeChanges, upgradePrice } from "../game/rules/upgrades.ts"
import { capacity, lockReason, taxOf, upgradeBlock } from "../game/schedule.ts"
import { moreAdmin } from "../game/rules/households.ts"
import { appealAt, type ParkCell } from "../game/world/appeal.ts"
import { canPlace, cellOf, doors, key, lPath, reach, useAt, type TileLike } from "../game/world/grid.ts"
import { inside, type Point } from "../game/world/iso.ts"
import { emptyPreview, type Interaction } from "./contracts.ts"
import { reachOf } from "./facts.ts"
import type { Frame } from "./frame.ts"
import { cellAt, footprintAt, rectangle } from "./interaction/geometry.ts"
import { placeProblem } from "./interaction/placing.ts"
import { counted, signed } from "./text.ts"

/**
 * What new cottages would bring in, fed, at the settlers' rate on their streets, less what they add to the
 * town hall's administration for their residents (see `moreAdmin`): the sum that turns once a town is large.
 */
const homesWorth = (frame: Frame, at: ReadonlyArray<Point>) => {
  const { houses, cells, approval, rates } = frame
  if (at.length === 0) return ""
  const standing = houses.filter((row) => !row.data.closed.present).reduce((n, row) => n + row.data.house.get().residents, 0)
  const fed = { tier: 1 as Tier, food: 1, bread: 0, cloth: 0, faith: 0, furniture: 0, residents: home.tiers[1].residents }
  let people = 0
  const pays = at.reduce((sum, c) => {
    const d = appealAt(cells, c.x, c.y), residents = capacity(fed, approval, d, undefined, rates.settlers)
    people += residents
    return sum + taxOf({ ...fed, residents }, rates, undefined, d)
  }, 0)
  const worth = Math.round(pays - moreAdmin(standing, people))
  return worth > 0 ? ` · ${signed(worth)} coins a minute once fed` : " · costs more to run than it pays: finer homes pay better"
}

/** The preview for this frame, and whether a stroke is being let go off the map (`dropping`). */
export const previewOf = (frame: Frame, ui: Interaction) => {
  const { grid, buildings } = frame

  const preview = emptyPreview()
  const pointer = ui.pointer
  const cell = pointer ? cellAt(pointer) : null
  preview.hover = pointer && (ui.tool === "select" || ui.tool === "bulldoze" || ui.tool === "upgrade") ? frame.pickAt(pointer, ui.pointerHit) : null
  const showReach = (tile: TileLike, kind: Kind) => {
    const r = reachOf(kind)
    if (r !== null) preview.plots.push({ x: tile.x - r, y: tile.y - r, size: tile.size + 2 * r, look: "reach" })
  }
  const pavedCells = new Set(frame.paved.map(({ data }) => key(data.tile.get().x, data.tile.get().y)))
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
      preview.tooltip = `homes · ${costText(home.cost)} each${preview.rangeNote ? homesWorth(frame, preview.ghosts.map((g) => g.cell)) : " · lay them beside a road"}`
    }
    if (ui.tool === "road" && cell) preview.tooltip = `road · ${ROAD_COST} coins a cell`
    if (ui.dragFrom && cell) {
      const n = ui.tool === "road" ? preview.roads.length : ui.tool === "home" ? preview.ghosts.length : preview.plots.filter((p) => p.look === "reach").length
      preview.stroke =
        ui.tool === "road"
          ? `${counted(n, "road cell")} · ${costText({ coins: n * ROAD_COST, materials: {} })}`
          : ui.tool === "home"
            ? `${counted(n, "home")} · ${costText(times(home.cost, n))}${homesWorth(frame, preview.ghosts.map((g) => g.cell))}`
            : `pave ${counted(n, "cell")} · ${costText({ coins: n * PAVE_COST.coins, materials: { stone: n * PAVE_COST.stone } })}`
    }
  } else if (ui.tool === "ground" && cell) {
    const laid: Array<ParkCell> = []
    for (const c of ui.dragFrom ? rectangle(ui.dragFrom, cell) : [cell]) {
      if (!inside(c.x, c.y)) continue
      const there = frame.parkAt.get(key(c.x, c.y))?.data.park.get()
      if (there ? there.ground !== ui.ground : canPlace(grid, { ...c, size: 1 })) laid.push({ ...c, ground: ui.ground, prop: there?.prop ?? "none" })
      else if (!there) preview.plots.push({ ...c, size: 1, look: "blocked" })
    }
    preview.parks.push(...laid)
    const after = laid.length > 0 ? frame.parkOf(laid[0]!, laid) : undefined
    const cost = costText(times(grounds[ui.ground].cost, laid.length))
    if (ui.dragFrom) preview.stroke = `${grounds[ui.ground].title.toLowerCase()} · ${counted(laid.length, "cell")} · ${cost}`
    preview.tooltip = `${grounds[ui.ground].title.toLowerCase()} · ${cost}${after ? ` · park ${signed(after.value)} desirability` : ""}`
    if (after) preview.plots.push(...frame.reachPlots(after))
  } else if (ui.tool === "prop" && cell && inside(cell.x, cell.y)) {
    const there = frame.parkAt.get(key(cell.x, cell.y))?.data.park.get()
    if (there) {
      const placed = { ...cell, ground: there.ground, prop: ui.prop }
      preview.parks.push(placed)
      const before = frame.parkOf(cell)
      const after = frame.parkOf(cell, [placed])
      preview.tooltip = `${props[ui.prop].title.toLowerCase()} · ${costText(props[ui.prop].cost)}${after ? ` · park ${signed(after.value)} desirability${before && before.value !== after.value ? ` (now ${signed(before.value)})` : ""}` : ""}${after && after.crowded > 0 ? " · too crowded" : ""}`
      if (after) preview.plots.push(...frame.reachPlots(after))
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
    if (lockReason(kind, frame.world.census)) preview.plots.push({ ...tile, look: "blocked" })
    else if (canPlace(grid, tile)) {
      preview.ghosts.push({ what: ui.placing, cell: at })
      // No road at a side's middle: shown red under the ghost, as it will not be laid there.
      if (placeProblem(frame, kind, tile)?.refuse) preview.plots.push({ ...tile, look: "blocked" })
    } else preview.plots.push({ ...tile, look: "blocked" })
  } else if (ui.tool === "upgrade" && ui.upgrading) {
    // Every building the upgrade can go to, outlined; the one under the pointer says what it would give and cost.
    const rank = frame.world.fate.rank, coins = frame.world.treasury.coins
    for (const row of buildings) {
      const { data } = row
      if (data.building.get().kind !== ui.upgrading || data.site.present || data.rising.present) continue
      const kind = kinds[ui.upgrading], level = data.upgraded.value()?.level ?? 0, up = nextUpgrade(kind, level)
      const tile = data.tile.get()
      if (!up) continue
      const blocked = upgradeBlock(up, rank, { ranks })
      const hovered = preview.hover === row.entity.id
      preview.plots.push({ ...tile, look: data.works.present || blocked ? "blocked" : hovered ? "picked" : "reach" })
      if (!hovered) continue
      const from = (upgradeAt(kind, level)?.title ?? kind.title).toLowerCase()
      preview.tooltip = data.works.present
        ? `${from} → ${up.title.toLowerCase()} · under way: carriers are bringing its materials`
        : [`${from} → ${up.title.toLowerCase()}`, upgradePrice(up), ...upgradeChanges(kind, level).map((c) => `· ${c}`),
            blocked ?? (coins < up.cost.coins ? `${up.cost.coins - coins} coins short` : "click to begin: it goes on working meanwhile")].join("\n")
    }
    if (!preview.tooltip) preview.tooltip = `upgrade: pick a ${kinds[ui.upgrading].title.toLowerCase()} · Esc to stop`
  } else if (ui.tool === "bulldoze") {
    preview.danger = true
    if ((preview.hover === null || useAt(grid, cell?.x ?? -1, cell?.y ?? -1) === "park") && cell && ["road", "tree", "field", "park"].includes(useAt(grid, cell.x, cell.y)))
      preview.plots.push({ ...cell, size: 1, look: "blocked" })
    const there = cell ? frame.parkAt.get(key(cell.x, cell.y))?.data.park.get() : undefined
    if (there) preview.tooltip = there.prop !== "none" ? `remove the ${props[there.prop].title.toLowerCase()}` : `remove the ${grounds[there.ground].title.toLowerCase()}`
    const rock = cell ? frame.rockAt.get(key(cell.x, cell.y)) : undefined
    if (rock && cell) {
      const worked = rock.amount <= 1
      if (worked) preview.plots.push({ ...cell, size: 1, look: "blocked" })
      preview.tooltip = worked ? `worked ${rock.ore ? "ore" : "stone"} face · bulldoze to clear it` : `${rock.ore ? "ore" : "stone"} · ${rock.amount} left`
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
      showReach(tile, kinds[row.data.building.get().kind])
      rangeOfKind(tile, kinds[row.data.building.get().kind], row.data.service.value()?.range)
    }
  }
  return { preview, dropping }
}
