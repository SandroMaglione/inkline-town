/**
 * English grammar: what a noun needs to be used in a sentence (its two
 * forms), and the little a sentence needs of it (a count, an article, a
 * list). Every locale has a file like this one, with its own `Noun` and its
 * own helpers: grammar is not shared between languages, only the shape of
 * what the catalog says.
 *
 * The `Intl` formatters are made once, here: making one is the slow part,
 * and messages are worded every frame.
 */
const cardinal = new Intl.PluralRules("en")
const conjunction = new Intl.ListFormat("en", { type: "conjunction" })
const disjunction = new Intl.ListFormat("en", { type: "disjunction" })
const grouped = new Intl.NumberFormat("en")

/** A noun as English counts it: one of it, and any other number. */
export interface Noun {
  readonly one: string
  readonly other: string
}
/** A noun with a regular plural, or the plural given. */
export const noun = (one: string, other = `${one}s`): Noun => ({ one, other })
/** A noun that reads the same however many there are (stone, fish). */
export const mass = (word: string): Noun => ({ one: word, other: word })

/** The form of a noun for a number of it. */
export const form = (n: number, word: Noun): string => (cardinal.select(n) === "one" ? word.one : word.other)
/** "1 home", "3 homes". */
export const count = (n: number, word: Noun): string => `${n} ${form(n, word)}`
/** Small counts in the news, spelt out: "one home", "two buildings", "12 homes". */
export const spelt = (n: number, word: Noun): string =>
  `${n <= 10 ? ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] : n} ${form(n, word)}`

/** A word with its article: "a guildhall", "an estate". */
export const a = (word: string): string => `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`
/** A sentence's first letter. */
export const capital = (text: string): string => text.charAt(0).toLocaleUpperCase("en") + text.slice(1)

/** "a park, a chapel, and paving". */
export const and = (words: ReadonlyArray<string>): string => conjunction.format(words)
/** "a park, a chapel, or paving". */
export const or = (words: ReadonlyArray<string>): string => disjunction.format(words)
/** A large number as English groups it: "12,500". */
export const grouping = (n: number): string => grouped.format(n)
/** A number with its sign, the minus a true minus: "+3", "−2", "0". */
export const signed = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`
