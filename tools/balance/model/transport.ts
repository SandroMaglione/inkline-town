import type { GoodId } from "../../../src/content.ts"
import { doors, nearest, reach } from "../../../src/grid.ts"
import { preferDelivery } from "../../../src/rules/transport.ts"
import { scenarioGrid } from "../scenario.ts"
import type { Inputs } from "../types.ts"

export interface Transfer { readonly source: number; readonly target: number; readonly good: GoodId; readonly goodsPerMinute: number; readonly construction?: boolean }

/** Necessary time-budget constraints for specified flows. All goods share each source's carrier pool. */
export const assessTransfers = ({ rules, scenario }: Inputs, transfers: ReadonlyArray<Transfer>) => {
  const grid = scenarioGrid(scenario, rules).value(), pools = new Map<number, { availableCarrierSeconds: number; requiredCarrierSeconds: number }>()
  const routes = transfers.map((transfer) => {
    if (!Number.isFinite(transfer.goodsPerMinute) || transfer.goodsPerMinute < 0) throw new Error("Transfer rate must be finite and nonnegative")
    const source = scenario.buildings.find((b) => b.id === transfer.source), target = scenario.buildings.find((b) => b.id === transfer.target)
    if (!source || !target) throw new Error("Transfer references an unknown building")
    if (source.id === target.id) throw new Error("A building does not dispatch carriers to itself")
    const found = nearest(reach(grid, doors(grid, source.tile)), doors(grid, target.tile))
    const carriers = source.site ? 0 : rules.kinds[source.kind].carriers ?? 0
    const pool = pools.get(source.id) ?? { availableCarrierSeconds: carriers * 60, requiredCarrierSeconds: 0 }
    const roundTripSeconds = found ? 2 * found.distance * rules.transport.cellSteps * rules.stepSeconds / rules.transport.walk : null
    const needed = roundTripSeconds === null ? transfer.goodsPerMinute > 0 ? Infinity : 0 : transfer.goodsPerMinute / rules.transport.load * Math.max(roundTripSeconds, rules.transport.dispatchTicks * rules.stepSeconds)
    pool.requiredCarrierSeconds += needed; pools.set(source.id, pool)
    return { ...transfer, distance: found?.distance ?? null, roundTripSeconds, carrierSecondsPerMinute: Number.isFinite(needed) ? needed : null }
  })
  // Use the runtime's exact construction/nearest ranking; throughput remains a full-load relaxation.
  const dispatchPriority = [...routes].sort((a, b) => a.source - b.source || (preferDelivery({ site: !!a.construction, distance: a.distance ?? Infinity }, { site: !!b.construction, distance: b.distance ?? Infinity }) ? -1 : preferDelivery({ site: !!b.construction, distance: b.distance ?? Infinity }, { site: !!a.construction, distance: a.distance ?? Infinity }) ? 1 : 0))
  return { routes, dispatchPriority, pools: [...pools].map(([source, p]) => ({ source, ...p, requiredCarrierSeconds: Number.isFinite(p.requiredCarrierSeconds) ? p.requiredCarrierSeconds : null,
    feasibleNecessaryCondition: p.requiredCarrierSeconds <= p.availableCarrierSeconds })),
    confidence: "Necessary full-load time budgets for caller-specified flows. They do not guarantee live greedy dispatch, avoid construction starvation, or remove inventory/basket constraints." }
}
