/**
 * The language the mayor chose, kept in the browser between visits. Until
 * one is chosen there is none, and the page takes the browser's own (see
 * `pick` in `i18n`). A browser that will not keep it (storage blocked or
 * full) only forgets the choice: the game plays on in the language picked.
 */
import type { Locale } from "../i18n/index.ts"

const KEY = "inkline-town/language"

/** The language chosen before, or `null`: none yet, or the browser's storage cannot be read. */
export const preferred = (store: Pick<Storage, "getItem">): string | null => {
  try {
    return store.getItem(KEY)
  } catch {
    return null
  }
}

/** Keeps the choice for the next visit; `false` when the browser would not keep it. */
export const prefer = (store: Pick<Storage, "setItem">, locale: Locale): boolean => {
  try {
    store.setItem(KEY, locale)
    return true
  } catch {
    return false
  }
}
