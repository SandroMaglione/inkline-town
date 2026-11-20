/**
 * Spanish grammar: what a noun needs to be used in a sentence (its two
 * forms and its gender), and what a sentence needs of it: a count, an
 * article, a preposition that may join its article, a list. Nothing here
 * is shared with English: Spanish nouns have a gender English nouns lack,
 * their articles follow it ("el molino", "la granja"), "de" and "a" join
 * "el" ("del", "al"), and a feminine noun that opens on a stressed a- takes
 * "el" and "un" in the singular ("el agua", "un hacha").
 *
 * The `Intl` formatters are made once, here: making one is the slow part,
 * and messages are worded every frame.
 */
const cardinal = new Intl.PluralRules("es")
const conjunction = new Intl.ListFormat("es", { type: "conjunction" })
const disjunction = new Intl.ListFormat("es", { type: "disjunction" })
const grouped = new Intl.NumberFormat("es")
const tenths = new Intl.NumberFormat("es", { maximumFractionDigits: 1 })

export type Gender = "m" | "f"

/** A noun as Spanish uses it: one of it, any other number of it, and its gender (which its articles and adjectives follow). */
export interface Noun {
  readonly one: string
  readonly other: string
  readonly gender: Gender
  /** A feminine noun that opens on a stressed a- or ha- ("agua", "hacha"): "el" and "un" before it in the singular, though it stays feminine. */
  readonly stressedA: boolean
}
/** A masculine noun: "molino", "molinos". */
export const m = (one: string, other: string): Noun => ({ one, other, gender: "m", stressedA: false })
/** A feminine noun: "granja", "granjas". */
export const f = (one: string, other: string): Noun => ({ one, other, gender: "f", stressedA: false })
/** A feminine noun that opens on a stressed a-: "el agua", "las aguas". */
export const fa = (one: string, other: string): Noun => ({ one, other, gender: "f", stressedA: true })

/** The form of a noun for a number of it. */
export const form = (n: number, word: Noun): string => (cardinal.select(n) === "one" ? word.one : word.other)
/** "1 casa", "3 casas". */
export const count = (n: number, word: Noun): string => `${n} ${form(n, word)}`

// ── Articles ──────────────────────────────────────────────────────────────

/** How an article (or a preposition joined to one) meets a word. */
export const before = (article: string, word: string) => `${article} ${word}`

/** The article alone, for a word shown as a chip after it (`many`: of its plural): "el", "la", "los", "las". Join the two with `before`. */
export const theArticle = (word: Noun, many = false): string =>
  word.gender === "f" ? (many ? "las" : word.stressedA ? "el" : "la") : many ? "los" : "el"
/** "un", "una": the article alone, as `theArticle`. */
export const anArticle = (word: Noun): string => (word.gender === "f" && !word.stressedA ? "una" : "un")

/** "el molino", "la granja", "el agua". */
export const the = (word: Noun): string => before(theArticle(word), word.one)
/** "los molinos", "las granjas". */
export const theMany = (word: Noun): string => before(theArticle(word, true), word.other)
/** "un molino", "una granja". */
export const a = (word: Noun): string => before(anArticle(word), word.one)

/** A preposition before a definite article: only "de" and "a" join it, and only "el" ("del", "al"). */
export type Preposition = "de" | "a" | "en" | "con" | "por" | "para" | "desde" | "hasta" | "sin" | "sobre" | "junto a" | "cerca de"
const joined = (preposition: Preposition, article: string): string => {
  if (article === "el" && preposition === "de") return "del"
  if (article === "el" && preposition === "a") return "al"
  if (article === "el" && preposition === "junto a") return "junto al"
  if (article === "el" && preposition === "cerca de") return "cerca del"
  return `${preposition} ${article}`
}
/** The preposition with a word's article, alone (`many`: of its plural): "del", "al", "en la", "de los". Join it to the word with `before`. */
export const withArticle = (preposition: Preposition, word: Noun, many = false): string => joined(preposition, theArticle(word, many))
/** "del molino", "al mercado", "en la granja", "de las granjas". */
export const to = (preposition: Preposition, word: Noun): string => before(withArticle(preposition, word), word.one)
/** "de los molinos", "a las granjas". */
export const toMany = (preposition: Preposition, word: Noun): string => before(withArticle(preposition, word, true), word.other)

/** An adjective or a pronoun that follows its noun's gender: "nuevo" or "nueva", "lo" or "la". */
export const agree = (word: Noun, masculine: string, feminine: string): string => (word.gender === "f" ? feminine : masculine)

// ── Numbers and lists ─────────────────────────────────────────────────────

const numerals = ["", "", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"] as const
/** A small number spelt out, a larger one in figures: "dos", "diez", "12". (One and none agree with their noun: see `spelt`.) */
export const numeral = (n: number): string => (n >= 2 && n <= 10 ? numerals[n]! : `${n}`)
/** Small counts in the news, spelt out: "una casa", "dos edificios", "12 casas", "ningún edificio". */
export const spelt = (n: number, word: Noun): string =>
  n === 0 ? `${word.gender === "f" && !word.stressedA ? "ninguna" : "ningún"} ${word.one}` : n === 1 ? a(word) : `${numeral(n)} ${form(n, word)}`

/** A sentence's first letter. */
export const capital = (text: string): string => text.charAt(0).toLocaleUpperCase("es") + text.slice(1)
/** "un parque, una capilla y el empedrado". */
export const and = (words: ReadonlyArray<string>): string => conjunction.format(words)
/** "un parque, una capilla o el empedrado". */
export const or = (words: ReadonlyArray<string>): string => disjunction.format(words)
/** A number to a tenth, as Spanish writes it: "4,5". */
export const decimal = (n: number): string => tenths.format(n)
/** A large number as Spanish groups it: "12.500" (four figures stand ungrouped: "1500"). */
export const grouping = (n: number): string => grouped.format(n)
/** A number with its sign, the minus a true minus: "+3", "−2", "0". */
export const signed = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`
