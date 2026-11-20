/**
 * Simplified Chinese. The same catalog as English, part for part
 * (`satisfies Catalog` holds it to every message, and to reading each one's
 * numbers as English does), with a grammar of its own: no articles, plurals,
 * or gender, but a measure word for every number of something
 * (`grammar.ts`), and words, chips, and full-width punctuation set with no
 * space between them. Most of its wording comes from the community's
 * translations of the game (see `nouns.ts`).
 */
import type { Catalog } from "../en/index.ts"
import { and, grouping, or, signed } from "./grammar.ts"
import { guide } from "./guide.ts"
import { names } from "./nouns.ts"
import { page } from "./page.ts"
import { amount, chronicle, cost, ended, lock, needsRank, notice, salvage } from "./said.ts"
import { commands, mapViews, toolbar } from "./tools.ts"
import { view } from "./view.ts"

export const zh = {
  locale: "zh",
  format: { signed, grouping, and, or },
  ...names,
  cost,
  salvage,
  amount,
  chronicle,
  ended,
  notice,
  lock,
  needsRank,
  commands,
  toolbar,
  mapViews,
  guide,
  view,
  page
} satisfies Catalog
