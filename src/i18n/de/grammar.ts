/**
 * German grammar: what a noun needs to be used in a sentence, and what a
 * sentence needs of it. A German noun has a gender (der, die, das), a
 * plural of its own, and forms for its cases: the genitive singular of a
 * masculine or neuter noun takes -s or -es ("des Marktes"), the dative
 * plural takes -n ("mit Brettern"), and a weak noun takes -n in every case
 * but the first ("den Boten"). Articles follow the gender, the number, and
 * the case; a preposition joins its article where German joins them ("im",
 * "am", "zum", "zur", "vom", "beim", "ins"); an adjective takes the ending
 * its article leaves it ("ein harter Winter", "auf kleinem Land").
 *
 * Nothing here is shared with English or Italian. The `Intl` formatters
 * are made once, here: making one is the slow part, and messages are
 * worded every frame.
 */
const cardinal = new Intl.PluralRules("de")
const conjunction = new Intl.ListFormat("de", { type: "conjunction" })
const disjunction = new Intl.ListFormat("de", { type: "disjunction" })
const grouped = new Intl.NumberFormat("de")
const tenths = new Intl.NumberFormat("de", { maximumFractionDigits: 1 })

export type Gender = "m" | "f" | "n"
/** The four cases, in the order German grammars list them. */
export type Case = "nom" | "acc" | "dat" | "gen"
const cases = { nom: 0, acc: 1, dat: 2, gen: 3 } as const satisfies Record<Case, 0 | 1 | 2 | 3>

/**
 * A noun as German uses it: its gender, its singular and plural (as the
 * subject of a sentence names them), and the singular's other forms: the
 * genitive ("Marktes"), and the accusative and dative (a weak noun's
 * "Boten"; for most nouns the singular itself).
 */
export interface Noun {
  readonly one: string
  readonly other: string
  readonly gender: Gender
  readonly genitive: string
  readonly oblique: string
}

/** Strong masculine and neuter nouns take -s in the genitive, or -es after a hissing sound or a short stem ("Marktes", "Hauses"). */
const genitiveOf = (one: string): string => (/(s|ß|x|z|sch)$/.test(one) ? `${one}es` : `${one}s`)

/** A masculine noun: "Markt", "Märkte"; its genitive given when it is not the usual "-s". */
export const m = (one: string, other: string, genitive = genitiveOf(one)): Noun => ({ one, other, gender: "m", genitive, oblique: one })
/** A neuter noun: "Sägewerk", "Sägewerke". */
export const n = (one: string, other: string, genitive = genitiveOf(one)): Noun => ({ one, other, gender: "n", genitive, oblique: one })
/** A feminine noun: "Mühle", "Mühlen". Its singular is the same in every case. */
export const f = (one: string, other: string): Noun => ({ one, other, gender: "f", genitive: one, oblique: one })
/** A weak masculine noun: "Bote", "den Boten", "des Boten". */
export const weak = (one: string, other: string, oblique = other): Noun => ({ one, other, gender: "m", genitive: oblique, oblique })

/** The plural in the dative: -n, unless it already ends in -n or -s ("Brettern", "Mühlen", "Autos"). */
const dativePlural = (other: string): string => (/[ns]$/.test(other) ? other : `${other}n`)

/** A noun in a case, one or many of it: "Markt", "Marktes", "Märkten". */
export const form = (word: Noun, c: Case = "nom", many = false): string => {
  if (many) return c === "dat" ? dativePlural(word.other) : word.other
  return c === "nom" ? word.one : c === "gen" ? word.genitive : word.oblique
}
/** The form of a noun for a number of it, in a case: "1 Haus", "3 Häuser", "mit 3 Häusern". */
export const counted = (n: number, word: Noun, c: Case = "nom"): string => form(word, c, cardinal.select(n) !== "one")
/** "1 Haus", "3 Häuser". */
export const count = (n: number, word: Noun, c: Case = "nom"): string => `${n} ${counted(n, word, c)}`

// ── Articles ──────────────────────────────────────────────────────────────

type Row = readonly [string, string, string, string]
const definite: Readonly<Record<Gender | "pl", Row>> = {
  m: ["der", "den", "dem", "des"],
  f: ["die", "die", "der", "der"],
  n: ["das", "das", "dem", "des"],
  pl: ["die", "die", "den", "der"]
}
const indefinite: Readonly<Record<Gender, Row>> = {
  m: ["ein", "einen", "einem", "eines"],
  f: ["eine", "eine", "einer", "einer"],
  n: ["ein", "ein", "einem", "eines"]
}
const noPlural: Row = ["keine", "keine", "keinen", "keiner"]

/** The definite article alone, for a word shown as a chip after it: "der", "den", "dem", "des"; "die" of many. */
export const theArticle = (word: Noun, c: Case = "nom", many = false): string => definite[many ? "pl" : word.gender][cases[c]]
/** The indefinite article alone: "ein", "einen", "einer". */
export const anArticle = (word: Noun, c: Case = "nom"): string => indefinite[word.gender][cases[c]]
/** "kein", "keine", "keinen", and of many "keine". */
export const noArticle = (word: Noun, c: Case = "nom", many = false): string => (many ? noPlural[cases[c]] : `k${indefinite[word.gender][cases[c]]}`)

/** "none of it", standing alone for a word: "keiner", "keine", "keines"; of many "keine". */
export const none = (word: Noun, many = false): string => (many ? "keine" : word.gender === "m" ? "keiner" : word.gender === "f" ? "keine" : "keines")

/** "der Markt", "den Markt", "des Marktes", "die Märkte". */
export const the = (word: Noun, c: Case = "nom", many = false): string => `${theArticle(word, c, many)} ${form(word, c, many)}`
/** "ein Markt", "einen Markt", "eine Mühle". */
export const a = (word: Noun, c: Case = "nom"): string => `${anArticle(word, c)} ${form(word, c)}`
/** "kein Markt", "keine Mühle", "keine Häuser". */
export const no = (word: Noun, c: Case = "nom", many = false): string => `${noArticle(word, c, many)} ${form(word, c, many)}`

// ── Prepositions ──────────────────────────────────────────────────────────

/** A preposition that takes the definite article after it. Which case it governs is the sentence's to say (an, in, auf: where, or where to). */
export type Preposition = "an" | "auf" | "aus" | "bei" | "für" | "in" | "mit" | "nach" | "neben" | "von" | "vor" | "zu"
/** Where German joins a preposition to the article after it. */
const joined: Readonly<Record<string, string>> = {
  "an dem": "am",
  "an das": "ans",
  "in dem": "im",
  "in das": "ins",
  "zu dem": "zum",
  "zu der": "zur",
  "von dem": "vom",
  "bei dem": "beim"
}
/** The preposition with a word's article, joined where German joins them: "im", "zur", "an der", "für die". */
export const withArticle = (preposition: Preposition, c: Case, word: Noun, many = false): string => {
  const both = `${preposition} ${theArticle(word, c, many)}`
  return joined[both] ?? both
}
/** "im Sägewerk", "zur Mühle", "an der Kapelle", "für den Markt". */
export const to = (preposition: Preposition, c: Case, word: Noun, many = false): string => `${withArticle(preposition, c, word, many)} ${form(word, c, many)}`

// ── Pronouns ──────────────────────────────────────────────────────────────

const personal: Readonly<Record<Gender | "pl", Row>> = {
  m: ["er", "ihn", "ihm", "seiner"],
  f: ["sie", "sie", "ihr", "ihrer"],
  n: ["es", "es", "ihm", "seiner"],
  pl: ["sie", "sie", "ihnen", "ihrer"]
}
/** The pronoun that stands for a word: "er", "sie", "es"; "ihn", "ihm". */
export const pronoun = (word: Noun, c: Case = "nom", many = false): string => personal[many ? "pl" : word.gender][cases[c]]
/** The possessive of a word, before a thing of the given gender and case: "sein Läufer", "ihr Läufer", "seine Läufer". */
export const its = (owner: Noun, owned: Noun, c: Case = "nom", many = false): string => {
  const stem = owner.gender === "f" ? "ihr" : "sein"
  // A possessive ends as "kein" does.
  return `${stem}${noArticle(owned, c, many).slice(4)} ${form(owned, c, many)}`
}

// ── Adjectives ────────────────────────────────────────────────────────────

/** What stands before an adjective decides its ending: nothing (strong), a definite article (weak), or an "ein"-word (mixed). */
export type Determiner = "none" | "the" | "a"
const endings: Readonly<Record<Determiner, Readonly<Record<Gender | "pl", Row>>>> = {
  none: { m: ["er", "en", "em", "en"], f: ["e", "e", "er", "er"], n: ["es", "es", "em", "en"], pl: ["e", "e", "en", "er"] },
  the: { m: ["e", "en", "en", "en"], f: ["e", "e", "en", "en"], n: ["e", "e", "en", "en"], pl: ["en", "en", "en", "en"] },
  a: { m: ["er", "en", "en", "en"], f: ["e", "e", "en", "en"], n: ["es", "es", "en", "en"], pl: ["en", "en", "en", "en"] }
}
/** An adjective's stem with the ending a noun of this gender, case, and article gives it: "hart" before "ein Winter" is "harter". */
export const adjective = (stem: string, word: Noun, c: Case = "nom", determiner: Determiner = "none", many = false): string =>
  `${stem}${endings[determiner][many ? "pl" : word.gender][cases[c]]}`

// ── Numbers and lists ─────────────────────────────────────────────────────

const numerals = ["null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"] as const
/** A small number spelt out, a larger one in figures: "zwei", "zwölf", "14". */
export const numeral = (n: number): string => numerals[n] ?? `${n}`
/** Small counts in the news, spelt out: "kein Haus", "ein Haus", "zwei Gebäude", "14 Häuser". One takes its article. */
export const spelt = (n: number, word: Noun, c: Case = "nom"): string => (n === 0 ? no(word, c) : n === 1 ? a(word, c) : `${numeral(n)} ${form(word, c, true)}`)

/** A sentence's first letter. */
export const capital = (text: string): string => text.charAt(0).toLocaleUpperCase("de") + text.slice(1)
/** "ein Park, eine Kapelle und Pflaster". */
export const and = (words: ReadonlyArray<string>): string => conjunction.format(words)
/** "ein Park, eine Kapelle oder Pflaster". */
export const or = (words: ReadonlyArray<string>): string => disjunction.format(words)
/** A number to a tenth, as German writes it: "4,5". */
export const decimal = (n: number): string => tenths.format(n)
/** A large number as German groups it: "12.500". */
export const grouping = (n: number): string => grouped.format(n)
/** A share, as German sets it: the number, a space that does not break, and the sign: "40 %". */
export const percent = (n: number | string): string => `${n}\u00a0%`
/** A number with its sign, the minus a true minus: "+3", "−2", "0". */
export const signed = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`
