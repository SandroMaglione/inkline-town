/**
 * English: the catalog every other language is checked against. It is the
 * game's own language (the one its messages were written in), and
 * `Catalog` is its shape: another locale is an object that `satisfies
 * Catalog`, so a message it lacks, or one whose numbers it reads wrongly,
 * does not compile.
 *
 * The catalog is put together from one file for each part of the game:
 * names (`nouns.ts`), what the simulation says (`said.ts`), the tools
 * (`tools.ts`), the guide (`guide.ts`), what the view reads off the town
 * (`view.ts`), and the page itself (`page.ts`). Grammar (`grammar.ts`)
 * stays inside the locale.
 */
import { and, grouping, or, signed } from "./grammar.ts"
import { guide } from "./guide.ts"
import { names } from "./nouns.ts"
import { page } from "./page.ts"
import { amount, chronicle, cost, ended, lock, needsRank, notice, salvage } from "./said.ts"
import { commands, mapViews, toolbar } from "./tools.ts"
import { view } from "./view.ts"

export const en = {
  /** The language's tag (BCP 47), for `<html lang>` and for `Intl`. */
  locale: "en",
  /** Numbers and lists as the language writes them. */
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
}

/** What every language says: English's shape. */
export type Catalog = typeof en
