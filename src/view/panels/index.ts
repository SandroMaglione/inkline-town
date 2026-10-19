/**
 * The side panel: what is picked (a building, a home, a park, a ruin), or
 * else the menu the toolbar opened.
 */
import type { Interaction, Panel } from "../contracts.ts"
import type { Frame } from "../frame.ts"
import { buildingPanel } from "./building.ts"
import { housePanel } from "./house.ts"
import { parkPanel } from "./park.ts"
import { ruinPanel } from "./ruin.ts"

/** `wanted`: why the town needs each building's upgrade now (see `upgradesWanted`). */
export const panelOf = (frame: Frame, ui: Interaction, wanted: () => ReadonlyMap<number, string>): Panel | null => {
  const picked = ui.selected
  if (picked === null) return ui.menu ? { type: ui.menu } : null
  const building = frame.buildings.find((row) => row.entity.id === picked)
  if (building) return buildingPanel(frame, building, wanted().get(building.entity.id) ?? null)
  const house = frame.houses.find((row) => row.entity.id === picked)
  if (house) return housePanel(frame, house)
  const park = frame.parkRows.find((row) => row.entity.id === picked)
  const parkShown = park ? parkPanel(frame, park) : null
  if (parkShown) return parkShown
  const ruin = park ? undefined : frame.ruins.find((row) => row.entity.id === picked)
  if (ruin) return ruinPanel(ruin)
  return ui.menu ? { type: ui.menu } : null
}
