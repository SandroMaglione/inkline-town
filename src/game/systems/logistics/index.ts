/**
 * Carriers: every good that moves walks along the roads in a carrier's
 * crate. What a building wants — a site's materials, a workshop's input, a
 * market's provisions — is a demand; a producer sends what it makes to the
 * emptiest operating shelf, or else to the nearest storage with room, and a
 * storage balances the demands it can meet. Construction comes first. Crates
 * already on their way count against a demand, so no one is sent twice.
 */
export { Dispatch } from "./dispatch.ts"
export { Deliver, turnAround } from "./deliver.ts"
