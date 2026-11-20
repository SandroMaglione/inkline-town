/**
 * Italian grammar: what a noun needs to be used in a sentence (its two
 * forms and its gender), and what a sentence needs of it: a count, an
 * article, a preposition joined to its article, a list. Nothing here is
 * shared with English: Italian nouns have a gender English nouns lack, and
 * its articles and prepositions bend to the word that follows.
 *
 * The `Intl` formatters are made once, here: making one is the slow part,
 * and messages are worded every frame.
 */
const cardinal = new Intl.PluralRules("it")
const conjunction = new Intl.ListFormat("it", { type: "conjunction" })
const disjunction = new Intl.ListFormat("it", { type: "disjunction" })
const grouped = new Intl.NumberFormat("it")

export type Gender = "m" | "f"

/** A noun as Italian uses it: one of it, any other number of it, and its gender (which its articles and adjectives follow). */
export interface Noun {
  readonly one: string
  readonly other: string
  readonly gender: Gender
}
/** A masculine noun: "mulino", "mulini". */
export const m = (one: string, other: string): Noun => ({ one, other, gender: "m" })
/** A feminine noun: "fattoria", "fattorie". */
export const f = (one: string, other: string): Noun => ({ one, other, gender: "f" })

/** The form of a noun for a number of it. */
export const form = (n: number, word: Noun): string => (cardinal.select(n) === "one" ? word.one : word.other)
/** "1 casa", "3 case". */
export const count = (n: number, word: Noun): string => `${n} ${form(n, word)}`

// ── Articles ──────────────────────────────────────────────────────────────

const vowel = /^[aeiouàèéìòù]/i
/** A masculine word that takes "lo", "uno", and "gli": it begins with s and a consonant, z, gn, ps, pn, x, or y. */
const impure = /^(s[^aeiouàèéìòù]|z|gn|ps|pn|x|y)/i

/** How an article (or a preposition joined to one) meets a word: a space after a whole word, none after an apostrophe. */
export const before = (article: string, word: string) => (article.endsWith("'") ? `${article}${word}` : `${article} ${word}`)

/** The definite article for a word, one or many of it: il, lo, l', la; i, gli, le. */
const definite = (word: string, gender: Gender, many: boolean): string => {
  if (gender === "f") return many ? "le" : vowel.test(word) ? "l'" : "la"
  if (many) return vowel.test(word) || impure.test(word) ? "gli" : "i"
  return vowel.test(word) ? "l'" : impure.test(word) ? "lo" : "il"
}
/** The indefinite article for a word: un, uno, una, un'. */
const indefinite = (word: string, gender: Gender): string =>
  gender === "f" ? (vowel.test(word) ? "un'" : "una") : impure.test(word) ? "uno" : "un"

/** "il mulino", "lo scalpellino", "l'ovile", "la fattoria". */
export const the = (word: Noun): string => before(theArticle(word), word.one)
/** "i mulini", "gli ovili", "le fattorie". */
export const theMany = (word: Noun): string => before(theArticle(word, true), word.other)
/** "un mulino", "uno scalpellino", "una fattoria", "un'infermeria". */
export const a = (word: Noun): string => before(anArticle(word), word.one)
/** The article alone, for a word shown as a chip after it (`many`: of its plural): "il", "l'", "le". Join the two with `before`. */
export const theArticle = (word: Noun, many = false): string => definite(many ? word.other : word.one, word.gender, many)
/** "un", "uno", "una", "un'": the article alone, as `theArticle`. */
export const anArticle = (word: Noun): string => indefinite(word.one, word.gender)

/** A preposition that joins the definite article after it. */
export type Preposition = "di" | "a" | "da" | "in" | "su"
const stems: Readonly<Record<Preposition, string>> = { di: "de", a: "a", da: "da", in: "ne", su: "su" }
/** A preposition joined to an article: di + il = del, a + lo = allo, in + l' = nell', su + le = sulle. */
const joined = (preposition: Preposition, article: string): string => {
  const stem = stems[preposition]
  switch (article) {
    case "il":
      return `${stem}l`
    case "i":
      return `${stem}i`
    case "gli":
      return `${stem}gli`
    default:
      // lo, la, l', le: the l doubles (dello, alla, nell', sulle).
      return `${stem}l${article}`
  }
}
/** The preposition joined to a word's article, alone (`many`: of its plural): "del", "all'", "nelle". Join it to the word with `before`. */
export const withArticle = (preposition: Preposition, word: Noun, many = false): string => joined(preposition, theArticle(word, many))
/** "del mulino", "all'ovile", "nella fattoria", "sullo scalpellino". */
export const to = (preposition: Preposition, word: Noun): string => before(withArticle(preposition, word), word.one)
/** "dei mulini", "agli ovili", "nelle fattorie". */
export const toMany = (preposition: Preposition, word: Noun): string => before(withArticle(preposition, word, true), word.other)

/** An adjective that follows its noun's gender: "nuovo" or "nuova", "costruito" or "costruita". */
export const agree = (word: Noun, masculine: string, feminine: string): string => (word.gender === "f" ? feminine : masculine)

// ── Numbers and lists ─────────────────────────────────────────────────────

const numerals = ["nessun", "un", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci"] as const
/** A small number spelt out, a larger one in figures: "due", "dieci", "12". */
export const numeral = (n: number): string => numerals[n] ?? `${n}`
/** Small counts in the news, spelt out: "una casa", "due edifici", "12 case". One of something takes its article. */
export const spelt = (n: number, word: Noun): string => (n === 1 ? a(word) : `${numeral(n)} ${form(n, word)}`)

/** A sentence's first letter. */
export const capital = (text: string): string => text.charAt(0).toLocaleUpperCase("it") + text.slice(1)
/** "un parco, una cappella e il selciato". */
export const and = (words: ReadonlyArray<string>): string => conjunction.format(words)
/** "un parco, una cappella o il selciato". */
export const or = (words: ReadonlyArray<string>): string => disjunction.format(words)
const tenths = new Intl.NumberFormat("it", { maximumFractionDigits: 1 })
/** A number to a tenth, as Italian writes it: "4,5". */
export const decimal = (n: number): string => tenths.format(n)
/** A large number as Italian groups it: "12.500". */
export const grouping = (n: number): string => grouped.format(n)
/** A number with its sign, the minus a true minus: "+3", "−2", "0". */
export const signed = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`
