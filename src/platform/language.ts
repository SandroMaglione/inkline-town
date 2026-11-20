/**
 * The language the mayor chose, kept in the browser between visits. Until
 * one is chosen there is none, and the page takes the browser's own (see
 * `pick` in `i18n`). A browser that will not keep it (storage blocked or
 * full) only forgets the choice: the game plays on in the language picked.
 */
import type { Locale } from "../i18n/index.ts"

const KEY = "inkline-town/language"
/** Set for the one reload a change of language makes: the town in play was saved, and is to be carried on with. */
const CARRY_KEY = "inkline-town/carry-on"

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

/**
 * A change of language reloads the page (every label is made anew in the
 * new language). The town in play is saved first, and this marks the tab
 * so the page that comes back carries on with it instead of asking for a
 * charter, looking where the mayor was looking (`camera`, as the page
 * wrote it). Kept for the tab only (`sessionStorage`), and taken once.
 */
export const carryOver = (store: Pick<Storage, "setItem">, camera: string): boolean => {
  try {
    store.setItem(CARRY_KEY, camera)
    return true
  } catch {
    return false
  }
}

/**
 * Whether this page came back from a change of language with a town to carry on with: where the mayor was
 * looking (as `carryOver` was given it), or `null`. Asked once, it is forgotten.
 */
export const carriedOver = (store: Pick<Storage, "getItem" | "removeItem">): string | null => {
  try {
    const camera = store.getItem(CARRY_KEY)
    if (camera !== null) store.removeItem(CARRY_KEY)
    return camera
  } catch {
    return null
  }
}
