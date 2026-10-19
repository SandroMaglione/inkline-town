/**
 * The player's edits, applied at the start of a step: building, laying
 * roads and homes, laying out parks, bulldozing, pausing, the town's policy, answering the
 * crown, putting guide steps away, and founding a new town. Costs are checked against the treasury
 * and the town's stock and paid up front in coins; the materials are
 * carried to the site afterwards. Upgrading a building is paid at once.
 * Once the term has ended, only a new town, or another term, is taken.
 */
export { ApplyEdits, lockReason, unlocked, upgradeBlock } from "./apply-edits.ts"
