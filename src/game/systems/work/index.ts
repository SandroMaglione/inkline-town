/**
 * Building and working: the grid and the town's stock are indexed, sites
 * whose materials are in start going up, workers are assigned, recipes
 * turn inputs (or the land) into goods, planters sow trees and fields, and
 * what is sown grows.
 */
export { effort, paced } from "../../rules/production.ts"

export { IndexGrid } from "./index-grid.ts"
export { CountStock } from "./count-stock.ts"

// ── Going up ──────────────────────────────────────────────────────────────

export { Raise, SITE_SHARE } from "./raise.ts"

// ── Workers ───────────────────────────────────────────────────────────────

export { AssignStaff, STAFF_TICKS } from "./assign-staff.ts"

// ── Recipes ───────────────────────────────────────────────────────────────

export { Work } from "./work.ts"

// ── The land ──────────────────────────────────────────────────────────────

export { Plant } from "./plant.ts"
export { Spread } from "./spread.ts"
export { Grow } from "./grow.ts"
