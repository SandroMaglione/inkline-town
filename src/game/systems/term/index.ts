/**
 * The term in office: the seasons turn, the crown asks for goods, the
 * town's approval follows how it is treated, the town's history is kept,
 * the town rises through its ranks, and the term ends: lost, or run out.
 */

// ── Time ──────────────────────────────────────────────────────────────────

export { Seasons } from "./seasons.ts"

// ── The crown ─────────────────────────────────────────────────────────────

export { crownGap, Requests } from "./requests.ts"

// ── Approval ──────────────────────────────────────────────────────────────

export { Approve } from "./approve.ts"

// ── The end of the term ───────────────────────────────────────────────────

export { goalsOf, larder, nextRank, scoreOf, steadyNet } from "../../rules/goals.ts"

export { foundedFate, Judge } from "./judge.ts"
export { Record } from "./record.ts"
