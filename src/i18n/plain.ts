/**
 * A message in words alone: where markup cannot go (a tooltip, a `title`, a
 * line of a log), each token is said as the language says it: `[coins:25]`
 * as "25 coins", a building by its name, a tool by its label.
 */
import type { Catalog } from "./en/index.ts"
import { parse, type Part } from "./token.ts"

const word = (t: Catalog, part: Part): string => {
  switch (part.type) {
    case "text":
      return part.text
    case "coins":
      return t.amount.coins(part.n, part.signed)
    case "rate":
      return t.amount.rate(part.n, part.signed)
    case "amount":
      return t.amount.good(part.good, part.n)
    case "kind":
      return part.shown ?? t.kind.name(part.kind)
    case "good":
      return part.shown ?? t.good.name(part.good)
    case "command":
      return t.commands[part.command].label
    case "view":
      return t.mapViews[part.view].chip
    case "key":
      return `(${part.key})`
  }
}

/** A message with every token said in words. */
export const plain = (t: Catalog, message: string): string => parse(message).map((part) => word(t, part)).join("")
