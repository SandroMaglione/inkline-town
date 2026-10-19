/**
 * What the pointer is over, said in a line: a building's state, a home's
 * residents, a park's worth, or (bulldozing) what pulling it down gives back.
 * It takes over from the preview's own line only where the preview has none
 * to say (the upgrade tool says what an upgrade gives instead).
 */
import { anA, builtCost, costText, grounds, home, kinds, PAVE_COST, props, tierHome, upgradeAt } from "../game/content/index.ts"
import { lockReason } from "../game/schedule.ts"
import { appealAt } from "../game/world/appeal.ts"
import { canPlace } from "../game/world/grid.ts"
import { inside } from "../game/world/iso.ts"
import type { Interaction, Preview } from "./contracts.ts"
import { salvageFor, worksShare } from "./facts.ts"
import type { Frame } from "./frame.ts"
import { cellAt, footprintAt } from "./interaction/geometry.ts"
import { placeProblem } from "./interaction/placing.ts"
import { describeBuilding } from "./panels/building.ts"
import { parkText } from "./panels/park.ts"

/** Sets the preview's tooltip for what is hovered; `dropping`: a stroke is being let go off the map. */
export const tooltipOf = (frame: Frame, ui: Interaction, preview: Preview, dropping: boolean) => {
  const { grid, buildings, houses, ruins, parkRows, cells } = frame
  const pointer = ui.pointer
  const cell = pointer ? cellAt(pointer) : null
  const hovered = preview.hover
  const hoveredBuilding = hovered !== null ? buildings.find((row) => row.entity.id === hovered) : undefined
  const hoveredHouse = hovered !== null ? houses.find((row) => row.entity.id === hovered) : undefined
  const hoveredRuin = hovered !== null ? ruins.find((row) => row.entity.id === hovered) : undefined
  // The upgrade tool says what an upgrade gives and costs instead (see above).
  if (ui.tool === "upgrade") {
  } else if (hoveredBuilding) {
    const { kind, status, problem } = describeBuilding(frame, hoveredBuilding)
    const level = hoveredBuilding.data.upgraded.value()?.level ?? 0, works = hoveredBuilding.data.works.value()
    const title = (upgradeAt(kind, level)?.title ?? kind.title).toLowerCase()
    preview.tooltip = ui.tool === "bulldoze"
      ? `${title} · ${hoveredBuilding.data.hall.present ? "the town hall stays" : salvageFor(builtCost(kind, level), hoveredBuilding.data.site.value(), works && { kind, ...works })}`
      : `${title} · ${problem ?? status}${works ? ` · becoming ${anA(upgradeAt(kind, works.level)!.title.toLowerCase())}, ${Math.round(worksShare(works)! * 100)}% built` : ""}`
  } else if (hoveredHouse) {
    const h = hoveredHouse.data.house.get()
    const t = hoveredHouse.data.tile.get()
    preview.tooltip = ui.tool === "bulldoze"
      ? `${tierHome[h.tier]} · ${salvageFor(home.cost, hoveredHouse.data.site.value())}`
      : hoveredHouse.data.closed.present
      ? `${tierHome[h.tier]} · closed`
      : `${tierHome[h.tier]} · ${h.residents} resident${h.residents === 1 ? "" : "s"} · desirability ${appealAt(cells, t.x, t.y)}${hoveredHouse.data.burning.present ? " · on fire!" : hoveredHouse.data.sick.present ? " · sick" : ""}`
  } else if (hoveredRuin) {
    preview.tooltip = `ruin · ${hoveredRuin.data.ruin.get().cause} · bulldoze to clear`
  } else if (hovered !== null && ui.tool === "select" && parkRows.some((row) => row.entity.id === hovered)) {
    const row = parkRows.find((r) => r.entity.id === hovered)!
    const p = frame.parkOf(row.data.tile.get())
    const here = row.data.park.get()
    preview.tooltip = `park · ${here.prop !== "none" ? props[here.prop].title.toLowerCase() : grounds[here.ground].title.toLowerCase()}${p ? ` · ${p.cells.length} cells · ${parkText(p)}` : ""}`
  } else if (ui.tool === "place" && ui.placing) {
    const kind = kinds[ui.placing]
    const lock = lockReason(kind, frame.world.census)
    const tile = pointer ? { ...footprintAt(pointer, kind.size), size: kind.size } : null
    const problem = tile ? placeProblem(frame, kind, tile) : null
    if (lock) preview.tooltip = `${kind.title.toLowerCase()} · ${lock}`
    else if (tile && !canPlace(grid, tile)) preview.tooltip = `${kind.title.toLowerCase()} · no room here`
    else if (problem) preview.tooltip = `${kind.title.toLowerCase()} · ${problem.text}`
    else preview.tooltip = `${kind.title.toLowerCase()} · ${costText(kind.cost)}`
  } else if (ui.tool === "pave" && !dropping) preview.tooltip = `pave · ${PAVE_COST.coins} coins and a stone a cell · faster walking`
  else if (cell && ui.view === "appeal" && inside(cell.x, cell.y)) preview.tooltip = `desirability ${appealAt(cells, cell.x, cell.y)}`
}
