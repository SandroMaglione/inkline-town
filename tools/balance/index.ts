/** Public offline API. Runtime verification is a separate import under ./verify/. */
export { analyze, type Analysis, type AnalysisOptions } from "./model/analyze.ts"
export { project } from "./model/project.ts"
export { assessTransfers, type Transfer } from "./model/transport.ts"
export { recipeCapacity } from "./model/throughput.ts"
export { serviceProfile, missProbability } from "./model/services.ts"
export { searchParameters, searchDistricts } from "./model/search.ts"
export { fromSnapshot, scenarioGrid, validateScenario, district } from "./scenario.ts"
export type { Scenario, Inputs, Finding, Confidence, BuildAction, ProjectionOptions } from "./types.ts"

export { parkValue, parksOf, parkSources, parkUpkeep, type ParkCell } from "../../src/game/world/appeal.ts"
