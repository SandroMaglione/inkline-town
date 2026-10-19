import { type InkAsset } from "./primitives.ts"
import { surfaceState } from "../surface-state.ts"
export interface Appearance { worn?: boolean; band?: "poor" | "plain" | "fine"; winter?: boolean }
/** State is material data. The original mesh and its ink stay identical. */
export function withAppearance(asset: InkAsset, a: number, H: number, look: Appearance = {}, _home = false): InkAsset {
  return { ...asset, effects: { half: a, height: H, state: surfaceState({wear:look.worn?0.9:look.band==="poor"?0.55:0,care:look.band==="fine"?1:0,snow:look.winter?1:0}) } }
}
