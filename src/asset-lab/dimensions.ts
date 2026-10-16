import type { KindId } from "../content.ts"

/** Authored vertical pixels. Walkers stay 17 units tall including their cap.
 * Floors, openings and furniture share a human reference; towers do not. */
export const human = { door: 20, floor: 22, publicFloor: 25, seat: 4.5, worktop: 8 } as const
export const residentialHeight = (tier: 1 | 2 | 3) => 24 + (tier - 1) * human.floor

/** Enclosed shells only. Plot sizes and simulation rules are independent. */
const heights: Partial<Record<KindId, number>> = {
    townhall: 52, granary: 48, chapel: 40, hospital: human.publicFloor*2, mill: 52,
    healer: human.publicFloor, watchhouse: 26, market: 26, smokehouse: 25,
    lumberjack: 24, forester: 24, farm: 25, sheep: 25, builder: 24, firewatch: 24,
    quarry: 25, mine: 32, smithy: 27, sawmill: 30
}
const halves: Partial<Record<KindId, number>> = { townhall: 18, chapel: 10, healer: 9, watchhouse: 9, market: 10 }
export function shellDimensions(id: KindId) {
  return { height: heights[id] ?? 28, half: halves[id] }
}
