/**
 * Simplified Chinese grammar: what a noun needs to be used in a sentence,
 * and the little a sentence needs of it. Chinese has no articles, no
 * plural, and no gender, and no capitals to set a heading apart; what it
 * has instead is the measure word a number takes: homes are counted in 栋,
 * buildings in 座, people in 位, cells in 格. A `Noun` is its word and that
 * measure word, and a count is the number, then the measure word and the
 * word ("3 栋住宅", "12 位居民").
 *
 * Spacing follows the community translation this catalog comes from: no
 * space between Chinese words, full-width punctuation (，。：；！？（）) with
 * no space beside it, and a space between a Chinese character and a digit or
 * a Latin letter ("需要 20 位居民", "Esc 取消"), but none before "%" or "×".
 * A good is counted bare, as that translation counts it ("20 木板"), and so
 * are coins ("25 金币"). A token chip sits inline, with no space around it.
 *
 * The `Intl` formatters are made once, here: making one is the slow part,
 * and messages are worded every frame.
 */
const conjunction = new Intl.ListFormat("zh", { type: "conjunction" })
const disjunction = new Intl.ListFormat("zh", { type: "disjunction" })
const grouped = new Intl.NumberFormat("zh")

/** A noun as Chinese counts it: the word, and the measure word a number of it takes ("" when it is counted bare). */
export interface Noun {
  readonly word: string
  readonly measure: string
}
/** A noun and its measure word: `noun("住宅", "栋")`. */
export const noun = (word: string, measure = ""): Noun => ({ word, measure })

/** A number with its measure word and the word: "3 栋住宅", "12 位居民", "20 木板". */
export const count = (n: number, word: Noun): string => (word.measure === "" ? `${n} ${word.word}` : `${n} ${word.measure}${word.word}`)
/** A number with its measure word alone, where the word is already said: "3 栋", "12 位". */
export const counted = (n: number, word: Noun): string => `${n} ${word.measure}`

/** "公园、教堂和石铺道路": a list as Chinese sets it, with the enumeration comma. */
export const and = (words: ReadonlyArray<string>): string => conjunction.format(words)
/** "公园、教堂或石铺道路". */
export const or = (words: ReadonlyArray<string>): string => disjunction.format(words)
/** A large number as Chinese groups it: "12,500". */
export const grouping = (n: number): string => grouped.format(n)
/** A number with its sign, the minus a true minus: "+3", "−2", "0". */
export const signed = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`
