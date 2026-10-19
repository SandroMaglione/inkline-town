/**
 * The town: homes grow, level up, or empty depending on what reaches them;
 * taxes are collected from homes connected to the town hall and upkeep paid
 * for every standing building and park; and the census counts it all.
 */
export { adminOf, appealOf, askOf, capacity, kept, met, priceOf, satisfaction, taxOf, tierFor, type Rates } from "../../rules/households.ts"

export { Households } from "./households.ts"
export { Collect } from "./collect.ts"
export { TakeCensus } from "./take-census.ts"
