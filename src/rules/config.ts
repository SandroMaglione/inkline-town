/** Immutable inputs shared by the game and offline analysis. No tuning values live in the analyzer. */
import * as content from "../content.ts"

/** Formerly private execution constants, moved here without changing their values. */
export const transport = {
  cellSteps: 48, walk: 1, run: 3, basket: 10, active: 2, load: 4, dispatchTicks: 6
} as const

const inputs = () => ({
  kinds: content.kinds, home: content.home, goods: content.goods, lands: content.lands, sizes: content.sizes,
  appeal: content.appeal, grounds: content.grounds, props: content.props, park: content.park,
  risk: content.risk, condition: content.condition, winters: content.winters,
  admin: content.admin, mood: content.mood, crown: content.crown, market: content.market, fate: content.fate,
  spoils: content.spoils, trade: content.trade, tradeLoad: content.TRADE_LOAD, transport,
  stepSeconds: content.STEP_SECONDS, ledgerTicks: content.LEDGER_TICKS, spoilTicks: content.SPOIL_TICKS,
  commute: content.COMMUTE, apprentice: content.APPRENTICE, toolStock: content.TOOL_STOCK,
  conditionMax: content.CONDITION_MAX, riskMax: content.RISK_MAX, pausedUpkeep: content.PAUSED_UPKEEP, salvage: content.salvage,
  buildTicks: content.BUILD_TICKS, roadCost: content.ROAD_COST, paveCost: content.PAVE_COST, pavedPace: content.PAVED_PACE,
  grown: content.GROWN, yearsPerTerm: content.YEARS_PER_TERM, staffTicks: content.ticks(0.5), riskTicks: 60,
  spreadTicks: content.ticks(1.5), growTicks: 10
})

type NumericData<T> = T extends number ? number : T extends object ? { readonly [K in keyof T]: NumericData<T[K]> } : T
export type Rules = Omit<NumericData<ReturnType<typeof inputs>>, "kinds"> & { readonly kinds: typeof content.kinds }
export interface RulePatch { readonly path: string; readonly value: number }

const freeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

/** Fresh copies also preserve the existing bot's --set-before-start workflow. */
export const resolveRules = (patches: ReadonlyArray<RulePatch> = []): Rules => {
  const copy = structuredClone(inputs()) as unknown as Record<string, unknown>
  for (const { path, value } of patches) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid numeric rule: ${path}`)
    const parts = path.split(".")
    if (parts.some((p) => ["__proto__", "prototype", "constructor"].includes(p))) throw new Error(`Invalid rule path: ${path}`)
    let target = copy
    for (const part of parts.slice(0, -1)) {
      if (!Object.hasOwn(target, part) || typeof target[part] !== "object" || target[part] === null) throw new Error(`Unknown rule: ${path}`)
      target = target[part] as Record<string, unknown>
    }
    const key = parts.at(-1)!
    if (!Object.hasOwn(target, key) || typeof target[key] !== "number") throw new Error(`Unknown numeric rule: ${path}`)
    // Structural timing and identifier changes are outside numeric economy experiments.
    if (parts[0] === "transport" || ["size", "stories", "bays"].includes(key)) throw new Error(`Structural rule cannot be patched: ${path}`)
    if (["stepSeconds", "ledgerTicks", "spoilTicks", "yearsPerTerm", "staffTicks", "riskTicks", "spreadTicks", "growTicks"].includes(parts[0]!)) throw new Error(`Structural rule cannot be patched: ${path}`)
    if ((key === "seconds" || key === "growth" || key === "wear" || key === "every" || key === "lasts" || key === "perMeal" || key === "calms") && value === 0) throw new Error(`Rule must be positive: ${path}`)
    if ((path.startsWith("home.lasts.") || path.startsWith("spoils.")) && value === 0) throw new Error(`Rule must be positive: ${path}`)
    if ((["workers", "batch", "inputs", "cap", "carriers", "range", "residents", "settle", "perMeal"].includes(key) || path.includes(".cost.")) && !Number.isInteger(value)) throw new Error(`Rule must be an integer: ${path}`)
    if (path === "apprentice" && value > 1) throw new Error("Apprentice pace must be at most one")
    target[key] = value
  }
  return freeze(copy as unknown as Rules)
}

export const shippedRules = resolveRules()
export const ruleTicks = (seconds: number, rules: Rules = shippedRules) => Math.round(seconds / rules.stepSeconds)
