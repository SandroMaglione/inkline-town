/**
 * The neighbourhood and its dangers. Every so often the town's desirability
 * is reckoned cell by cell (`Appraise`). Once a second every home's risk of
 * fire, sickness, and disorder rises, and every building's risk of fire
 * (`Hazards`): the matching service walker resets it (see `Wander`). A
 * risk at the top is a disaster: a fire that burns the home down and may
 * spread, a sickness that thins it out and may spread, a theft, and then a
 * home left derelict. A fire watch sends firefighters running to any blaze
 * (`Douse`): when they arrive, that house is lost but the fire is out.
 */

// ── Desirability ──────────────────────────────────────────────────────────

export { Appraise } from "./appraise.ts"

// ── Risks ─────────────────────────────────────────────────────────────────

export { paceAt } from "../../rules/risks.ts"

export { Hazards, RISK_TICKS } from "./hazards.ts"
export { Douse } from "./douse.ts"
