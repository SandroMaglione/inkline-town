export interface SurfaceState {
  wear: number
  care: number
  snow: number
  burning: number
  fireRisk: number
  health: number
  order: number
  sick: number
}
export const surfaceState = (state: Partial<SurfaceState> = {}): SurfaceState => {
  const bound = (n = 0) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
  return { wear: bound(state.wear), care: bound(state.care), snow: bound(state.snow), burning: bound(state.burning), fireRisk: bound(state.fireRisk), health: bound(state.health), order: bound(state.order), sick: bound(state.sick) }
}
/** A warning is visible as soon as the simulation's warning threshold is met. */
export const hazardStrength = (value: number, threshold: number, maximum: number) =>
  value < threshold || maximum <= threshold ? 0 : Math.min(1,0.35+0.65*(value-threshold)/(maximum-threshold))
