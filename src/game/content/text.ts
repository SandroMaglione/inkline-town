/** Content put into words: a cost, a word with its article. */
import type { Kind } from "./kinds/index.ts"

export const costText = (cost: Kind["cost"]): string =>
  [cost.coins > 0 ? `${cost.coins} coins` : "", ...Object.entries(cost.materials).map(([g, n]) => `${n} ${n === 1 && g.endsWith("s") ? g.slice(0, -1) : g}`)].filter((s) => s !== "").join(" · ")

/** A word with its article: "a guildhall", "an estate". */
export const anA = (word: string): string => `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`
