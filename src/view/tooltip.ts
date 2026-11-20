/**
 * What the pointer is over, said in a line: a building's state, a home's
 * residents, a park's worth, or (bulldozing) what pulling it down gives back.
 * It takes over from the preview's own line only where the preview has none
 * to say (the upgrade tool says what an upgrade gives instead).
 */
import { builtCost, home, kinds, PAVE_COST } from "../game/content/index.ts"
import { lockReason } from "../game/schedule.ts"
import { appealAt } from "../game/world/appeal.ts"
import { canPlace } from "../game/world/grid.ts"
import { inside } from "../game/world/iso.ts"
import type { Interaction, Preview } from "./contracts.ts"
import { salvageFor, worksShare } from "./facts.ts"
import type { Frame } from "./frame.ts"
import { cellAt, footprintAt } from "./interaction/geometry.ts"
import { say } from "../i18n/index.ts"
import { placeProblem } from "./interaction/placing.ts"
import { describeBuilding } from "./panels/building.ts"

/** Sets the preview's tooltip for what is hovered; `dropping`: a stroke is being let go off the map. */
export const tooltipOf = (frame: Frame, ui: Interaction, preview: Preview, dropping: boolean) => {
  const { grid, buildings, houses, ruins, parkRows, cells, t } = frame
  const words = t.view.tooltip
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
    const level = hoveredBuilding.data.upgraded?.level ?? 0, works = hoveredBuilding.data.works
    preview.tooltip = ui.tool === "bulldoze"
      ? words.bulldozeBuilding(kind.id, level, hoveredBuilding.data.hall !== undefined ? words.hallStays : salvageFor(t, builtCost(kind, level), hoveredBuilding.data.site, works && { kind, ...works }))
      : words.building({ kind: kind.id, level, state: problem ?? t.view.status[status], works: works ? { level: works.level, percent: Math.round(worksShare(works)! * 100) } : null })
  } else if (hoveredHouse) {
    const h = hoveredHouse.data.house
    const at = hoveredHouse.data.tile
    preview.tooltip = ui.tool === "bulldoze"
      ? words.bulldozeHome(h.tier, salvageFor(t, home.cost, hoveredHouse.data.site))
      : hoveredHouse.data.closed !== undefined
      ? words.homeClosed(h.tier)
      : words.home({ tier: h.tier, residents: h.residents, desirability: appealAt(cells, at.x, at.y), burning: hoveredHouse.data.burning !== undefined, sick: hoveredHouse.data.sick !== undefined })
  } else if (hoveredRuin) {
    preview.tooltip = words.ruin(hoveredRuin.data.ruin.cause)
  } else if (hovered !== null && ui.tool === "select" && parkRows.some((row) => row.entity.id === hovered)) {
    const row = parkRows.find((r) => r.entity.id === hovered)!
    const p = frame.parkOf(row.data.tile)
    const here = row.data.park
    preview.tooltip = words.park(here.prop !== "none" ? { prop: here.prop } : { ground: here.ground }, p ? { cells: p.cells.length, value: p.value, reach: p.reach } : null)
  } else if (ui.tool === "place" && ui.placing) {
    const kind = kinds[ui.placing]
    const lock = lockReason(kind, frame.world.census)
    const tile = pointer ? { ...footprintAt(pointer, kind.size), size: kind.size } : null
    const problem = tile ? placeProblem(frame, kind, tile) : null
    if (lock) preview.tooltip = words.placeLocked(kind.id, lock)
    else if (tile && !canPlace(grid, tile)) preview.tooltip = words.placeNoRoom(kind.id)
    else if (problem) preview.tooltip = words.placeProblem(kind.id, say(t.view.place.problem, problem))
    else preview.tooltip = words.placeCost(kind.id, kind.cost)
  } else if (ui.tool === "pave" && !dropping) preview.tooltip = words.pave(PAVE_COST)
  else if (cell && ui.view === "appeal" && inside(cell.x, cell.y)) preview.tooltip = words.desirability(appealAt(cells, cell.x, cell.y))
}
