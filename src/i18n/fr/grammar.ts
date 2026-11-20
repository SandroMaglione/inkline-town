/**
 * French grammar: what a noun needs to be used in a sentence (its two
 * forms, its gender, and whether the word before it elides), and what a
 * sentence needs of it: a count, an article, a preposition joined to its
 * article, a list. Nothing here is shared with English: French nouns have
 * a gender, and the little words before them bend to it and to the sound
 * the noun begins with ("le moulin", "l'entrepôt", "la ferme", "le
 * hameau"; "du bois", "de la farine", "aux outils").
 *
 * The `Intl` formatters are made once, here: making one is the slow part,
 * and messages are worded every frame.
 *
 * French sets a narrow no-break space (U+202F) before ; : ! ? and %, and
 * inside « »: the catalog's strings hold the character itself.
 */
const cardinal = new Intl.PluralRules("fr")
const conjunction = new Intl.ListFormat("fr", { type: "conjunction" })
const disjunction = new Intl.ListFormat("fr", { type: "disjunction" })
const grouped = new Intl.NumberFormat("fr")
const tenths = new Intl.NumberFormat("fr", { maximumFractionDigits: 1 })

export type Gender = "m" | "f"

/**
 * A noun as French uses it: one of it, any other number of it, its gender
 * (which its articles and adjectives follow), and whether the word before
 * it elides ("l'entrepôt", "d'outils"): it does before a vowel and a mute
 * h, not before an aspirated one ("le hameau", "la halle").
 */
export interface Noun {
  readonly one: string
  readonly other: string
  readonly gender: Gender
  readonly elides: boolean
}

/** A word that begins with a vowel sound, as it is spelt: the h is taken as mute, as it mostly is (`aspirate` says otherwise). */
const vowel = /^[aeiouyàâäéèêëîïôöùûüœæh]/i
const noun = (one: string, other: string, gender: Gender): Noun => ({ one, other, gender, elides: vowel.test(one) })
/** A masculine noun: "moulin", "moulins" (the plural an s, unless given). */
export const m = (one: string, other = `${one}s`): Noun => noun(one, other, "m")
/** A feminine noun: "ferme", "fermes". */
export const f = (one: string, other = `${one}s`): Noun => noun(one, other, "f")
/** A noun whose h is aspirated, so nothing elides before it: "le hameau", "la halle", "de halle". */
export const aspirate = (word: Noun): Noun => ({ ...word, elides: false })

/** The form of a noun for a number of it: French counts 0 and 1 (and 1,5) as one. */
export const form = (n: number, word: Noun): string => (cardinal.select(n) === "one" ? word.one : word.other)
/** "1 maison", "0 maison", "3 maisons". */
export const count = (n: number, word: Noun): string => `${n} ${form(n, word)}`

// ── Articles ──────────────────────────────────────────────────────────────

/** How an article (or a preposition joined to one) meets a word: a space after a whole word, none after an apostrophe. */
export const before = (article: string, word: string): string => (article.endsWith("'") ? `${article}${word}` : `${article} ${word}`)

/** The definite article, alone (`many`: of the plural): "le", "la", "l'", "les". */
export const theArticle = (word: Noun, many = false): string => (many ? "les" : word.elides ? "l'" : word.gender === "f" ? "la" : "le")
/** The indefinite article, alone: "un", "une"; "des" of many. */
export const anArticle = (word: Noun, many = false): string => (many ? "des" : word.gender === "f" ? "une" : "un")
/** The partitive, alone: some of a thing ("du", "de la", "de l'"), or of many ("des"). */
export const someArticle = (word: Noun, many = false): string => (many ? "des" : word.elides ? "de l'" : word.gender === "f" ? "de la" : "du")
/** "de" with nothing after it but the word, as after a quantity or a negation: "de", "d'". */
export const ofArticle = (word: Noun): string => (word.elides ? "d'" : "de")

/** "le moulin", "l'entrepôt", "la ferme", "le hameau". */
export const the = (word: Noun): string => before(theArticle(word), word.one)
/** "les moulins", "les entrepôts". */
export const theMany = (word: Noun): string => before(theArticle(word, true), word.other)
/** "un moulin", "une ferme". */
export const a = (word: Noun): string => before(anArticle(word), word.one)
/** "du bois", "de la farine", "de l'eau"; with `many`, "des planches". */
export const some = (word: Noun, many = false): string => before(someArticle(word, many), many ? word.other : word.one)
/** "de pierre", "d'outils" (`many`: of the plural). */
export const of = (word: Noun, many = false): string => before(ofArticle(word), many ? word.other : word.one)

/** A preposition that joins the definite article after it. */
export type Preposition = "de" | "à"
/** A preposition joined to an article: de + le = du, de + les = des, à + le = au, à + les = aux; la and l' stay apart. */
const joined = (preposition: Preposition, article: string): string => {
  if (article === "le") return preposition === "de" ? "du" : "au"
  if (article === "les") return preposition === "de" ? "des" : "aux"
  return `${preposition} ${article}`
}
/** The preposition joined to a word's article, alone (`many`: of its plural): "du", "de la", "de l'", "aux". Join it to the word with `before`. */
export const withArticle = (preposition: Preposition, word: Noun, many = false): string => joined(preposition, theArticle(word, many))
/** "du moulin", "de l'entrepôt", "à la ferme", "au hameau". */
export const to = (preposition: Preposition, word: Noun): string => before(withArticle(preposition, word), word.one)
/** "des moulins", "aux entrepôts". */
export const toMany = (preposition: Preposition, word: Noun): string => before(withArticle(preposition, word, true), word.other)
/** "d'un village", "d'une cité": "de" before the indefinite article, which always elides it. */
export const ofA = (word: Noun): string => before("d'", a(word))

/** An adjective or a participle that follows its noun's gender: "construit" or "construite", "il" or "elle". */
export const agree = (word: Noun, masculine: string, feminine: string): string => (word.gender === "f" ? feminine : masculine)

// ── Numbers and lists ─────────────────────────────────────────────────────

const numerals = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"] as const
/** A small number spelt out, a larger one in figures: "deux", "dix", "12". */
export const numeral = (n: number): string => numerals[n] ?? `${n}`
/** Small counts in the news, spelt out: "aucune maison", "une maison", "deux bâtiments", "12 maisons". None and one agree with the noun. */
export const spelt = (n: number, word: Noun): string =>
  n === 0 ? `${agree(word, "aucun", "aucune")} ${word.one}` : n === 1 ? a(word) : `${numeral(n)} ${form(n, word)}`

/** A sentence's first letter. */
export const capital = (text: string): string => text.charAt(0).toLocaleUpperCase("fr") + text.slice(1)
/** "un parc, une chapelle et des pavés". */
export const and = (words: ReadonlyArray<string>): string => conjunction.format(words)
/** "un parc, une chapelle ou des pavés". */
export const or = (words: ReadonlyArray<string>): string => disjunction.format(words)
/** A number to a tenth, as French writes it: "4,5". */
export const decimal = (n: number): string => tenths.format(n)
/** A large number as French groups it: "12 500", with a narrow no-break space. */
export const grouping = (n: number): string => grouped.format(n)
/** A number with its sign, the minus a true minus: "+3", "−2", "0". */
export const signed = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`
/** A percentage, a narrow no-break space before its sign: "40 %". */
export const percent = (n: number): string => `${n} %`
