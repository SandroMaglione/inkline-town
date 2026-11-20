/**
 * The game's languages. A locale is a catalog: one object, checked against
 * English's shape (`Catalog`), that names everything the town is made of
 * and words everything the game says. The simulation never sees one (it
 * says things as data: `game/said.ts`); the view words the town through
 * the catalog in use (the `Words` service), and the page its own labels.
 *
 * English is bundled, and is what a town reads in until another language
 * is chosen; every other locale is a module loaded when it is picked, so
 * nobody downloads a language they do not read.
 *
 * To add a language: a folder beside `en/` exporting an object that
 * `satisfies Catalog`, and a line in `languages` below. The compiler lists
 * what is still to translate.
 */
import { en, type Catalog } from "./en/index.ts"

export type { Catalog }
export { en }
export { plain } from "./plain.ts"
export { say, type Wording } from "./wording.ts"

/** A language the game speaks: what it calls itself (for the language menu, before its catalog is loaded), and how its catalog is loaded. */
interface Language {
  readonly name: string
  readonly load: () => Promise<Catalog>
}

/** Each language, by its tag (BCP 47). */
const languages = {
  en: { name: "English", load: () => Promise.resolve(en) }
} satisfies Record<string, Language>

export type Locale = keyof typeof languages
export const locales = Object.keys(languages) as ReadonlyArray<Locale>
export const DEFAULT_LOCALE: Locale = "en"

const isLocale = (tag: string): tag is Locale => tag in languages

/** What a language calls itself: "English", "Italiano". Never translated: a reader looks for their own language's name. */
export const languageName = (locale: Locale): string => languages[locale].name
/** The language a catalog is in. A catalog's tag is always one the game speaks; English stands in if it ever is not. */
export const localeOf = (t: Catalog): Locale => (isLocale(t.locale) ? t.locale : DEFAULT_LOCALE)

/**
 * The language to play in: the one chosen before (`saved`), else the first
 * of the reader's own (`wanted`: `navigator.languages`, most wanted first)
 * the game speaks, by its tag ("it-IT") or its language alone ("it"), else
 * English.
 */
export const pick = (saved: string | null, wanted: ReadonlyArray<string> = []): Locale => {
  if (saved !== null && isLocale(saved)) return saved
  for (const tag of wanted) {
    const lower = tag.toLowerCase()
    const language = lower.split("-")[0] ?? lower
    const found = locales.find((l) => l.toLowerCase() === lower) ?? locales.find((l) => l.toLowerCase() === language)
    if (found) return found
  }
  return DEFAULT_LOCALE
}

/** A language's catalog, loaded. */
export const load = (locale: Locale): Promise<Catalog> => languages[locale].load()

/**
 * The catalog in use, held where the view and the page read it. A holder,
 * not a value: the catalog is swapped in it when the language changes, and
 * whatever words the town on the next frame reads the new one.
 */
export interface Words {
  current: Catalog
}
