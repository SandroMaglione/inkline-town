/**
 * Japanese grammar: what a noun needs to be used in a sentence, and the
 * little a sentence needs of it. Japanese has no articles, no plural, and
 * no gender; what it has instead is the counter a number takes: homes are
 * counted in 軒, buildings in 棟, people in 人, cells in マス, coins in 枚,
 * and each good in the unit it comes in (`nouns.ts`). A `Noun` is its word
 * and that counter, and a count is the word, the number, and the counter
 * ("家3軒"), or the number and the counter alone where the word is already
 * said ("3軒").
 *
 * `capital` has nothing to do (the script has no case). Words are never
 * spaced: a particle follows its noun, and a chip, directly.
 *
 * The `Intl` formatters are made once, here: making one is the slow part,
 * and messages are worded every frame.
 */
const conjunction = new Intl.ListFormat("ja", { type: "conjunction" })
const disjunction = new Intl.ListFormat("ja", { type: "disjunction" })
const grouped = new Intl.NumberFormat("ja")

/** A noun as Japanese counts it: the word, and the counter a number of it takes. */
export interface Noun {
  readonly word: string
  readonly counter: string
}
/** A noun and its counter: `noun("家", "軒")`. */
export const noun = (word: string, counter: string): Noun => ({ word, counter })

/** A number with its counter: "3軒", "12人". */
export const counted = (n: number, word: Noun): string => `${n}${word.counter}`
/** The word, then how many: "家3軒", "住民12人". */
export const count = (n: number, word: Noun): string => `${word.word}${counted(n, word)}`

/** Nothing to change: Japanese has no capitals. Kept so a sentence reads as English's does where it is ported. */
export const capital = (text: string): string => text

/** "公園、礼拝堂、舗装": a list as Japanese sets it, with the reading comma. */
export const and = (words: ReadonlyArray<string>): string => conjunction.format(words)
/** "公園、礼拝堂、または舗装". */
export const or = (words: ReadonlyArray<string>): string => disjunction.format(words)
/** A large number as Japanese groups it: "12,500". */
export const grouping = (n: number): string => grouped.format(n)
/** A number with its sign, the minus a true minus: "+3", "−2", "0". */
export const signed = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`
