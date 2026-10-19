import type { Amounts, CharterValue, GroundId, PropId, KindId } from "../../src/game/content/index.ts"
import type { ParkCell } from "../../src/game/world/appeal.ts"
import type { TileLike } from "../../src/game/world/grid.ts"
import type { Rules } from "../../src/game/rules/config.ts"
import type { Needs, Rates } from "../../src/game/rules/households.ts"
import type { TradePolicy } from "../../src/game/rules/trade.ts"

export interface ModelHome extends Needs {
  readonly id: number; readonly tile: TileLike; readonly residents: number; readonly clock: number
  readonly condition: number; readonly meters: { readonly fire: number; readonly health: number; readonly order: number }
  readonly sick?: boolean
}
export interface ModelBuilding {
  readonly id: number; readonly kind: KindId; readonly tile: TileLike; readonly stock: Amounts
  readonly condition: number; readonly paused: boolean; readonly site: boolean
}
export interface LandResource { readonly tile: TileLike; readonly type: "tree" | "stone" | "ore" | "water" | "field"; readonly amount: number; readonly growth: number }
export interface Scenario {
  readonly name: string; readonly charter: CharterValue & { readonly winters?: ReadonlyArray<"none" | "mild" | "normal" | "hard"> }
  readonly tick: number; readonly coins: number; readonly approval: number; readonly policy: Rates
  readonly roads: ReadonlyArray<{ readonly x: number; readonly y: number; readonly paved?: boolean }>
  readonly homes: ReadonlyArray<ModelHome>; readonly buildings: ReadonlyArray<ModelBuilding>
  readonly land: ReadonlyArray<LandResource>; readonly mask?: string
  readonly ruins?: ReadonlyArray<TileLike>
  readonly parks?: ReadonlyArray<ParkCell>
  readonly imports?: Partial<Record<keyof Amounts, number>>
  readonly exports?: Partial<Record<keyof Amounts, number>>
  readonly trade?: TradePolicy & { readonly prices?: Amounts }
}
export type Confidence = "exact" | "upper-bound" | "estimate"
export interface Finding { readonly code: string; readonly confidence: Confidence; readonly detail: string }
export interface Inputs { readonly rules: Rules; readonly scenario: Scenario }
export interface RecipeCapacity {
  readonly jobsPerMinute: number; readonly outputPerMinute: number; readonly inputPerMinute: number
  readonly toolsPerMinute: number; readonly meanJobTicks: number; readonly cadenceTicks: number
}
export type BuildingAction = { readonly at: number; readonly kind: KindId | "home"; readonly tile: TileLike }
export type BuildAction = BuildingAction |
  { readonly at: number; readonly kind: "ground"; readonly ground: GroundId; readonly tile: TileLike } |
  { readonly at: number; readonly kind: "prop"; readonly prop: PropId; readonly tile: TileLike }
export interface ProjectionOptions {
  readonly seconds: number; readonly stepSeconds?: number; readonly builds?: ReadonlyArray<BuildAction>
  readonly feeding?: "fish" | "bread"; readonly visitSeconds?: number; readonly faith?: boolean
  readonly crown?: ReadonlyArray<{ readonly at: number; readonly good: keyof Amounts; readonly amount: number; readonly reward: number; readonly fine: number }>
}
