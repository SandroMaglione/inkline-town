import { goodIds, type Amounts } from "../../content/index.ts"

/** An amount of every good, each from `f`: the flow of goods is reckoned good by good. */
export const each = (f: (g: (typeof goodIds)[number]) => number): Amounts => Object.fromEntries(goodIds.map((g) => [g, f(g)])) as Amounts
