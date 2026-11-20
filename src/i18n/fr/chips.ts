/**
 * Buildings and goods as chips in a French sentence. A chip holds the noun
 * alone, and its article or preposition stands outside it, bent to the
 * noun as French bends it: "le [marché]", "l'[entrepôt]", "la [halle]",
 * "du [moulin]", "aux [pêcheries]", "de la [farine]", "d'[outils]". An
 * elided article meets its chip with no space between. Every part of the
 * catalog writes its chips through these, so an article never disagrees
 * with its noun.
 */
import type { GoodId, KindId } from "../../game/content/index.ts"
import * as token from "../token.ts"
import { anArticle, before, form, ofArticle, someArticle, theArticle, withArticle, type Noun, type Preposition } from "./grammar.ts"
import { built, goods, measured } from "./nouns.ts"

const noun = (id: KindId, level: number): Noun => built(id, level).noun

/** A building's chip, by what it is called at its level: "[halle]". */
export const kind = (id: KindId, level = 0): string => token.kind(id, noun(id, level).one)
/** Many of a building: "[pêcheries]". */
export const kinds = (id: KindId, level = 0): string => token.kind(id, noun(id, level).other)
/** "le [marché]", "l'[entrepôt]", "la [ferme]". */
export const theKind = (id: KindId, level = 0): string => before(theArticle(noun(id, level)), kind(id, level))
/** "les [moulins]". */
export const theKinds = (id: KindId, level = 0): string => before(theArticle(noun(id, level), true), kinds(id, level))
/** "un [marché]", "une [ferme]". */
export const aKind = (id: KindId, level = 0): string => before(anArticle(noun(id, level)), kind(id, level))
/** "du [marché]", "de l'[entrepôt]", "à la [ferme]", "au [moulin]". */
export const toKind = (preposition: Preposition, id: KindId, level = 0): string => before(withArticle(preposition, noun(id, level)), kind(id, level))
/** "de [pêcheries]", "d'[entrepôts]": after a quantity ("moins de", "deux"). */
export const ofKinds = (id: KindId, level = 0): string => before(ofArticle(noun(id, level)), kinds(id, level))

/** A good as the town speaks of it is one noun, in the number it is spoken of in: "les planches" (many), "le pain" (one). */
const ware = (id: GoodId): { readonly word: Noun; readonly many: boolean } => ({ word: goods[id], many: goods[id].counted })
/** A good's chip: "[planches]", "[pain]". */
export const good = (id: GoodId): string => token.good(id)
/** "les [planches]", "le [pain]", "les [outils]", "la [laine]". */
export const theGood = (id: GoodId): string => before(theArticle(ware(id).word, ware(id).many), good(id))
/** "des [planches]", "du [pain]", "aux [outils]", "à la [laine]". */
export const toGood = (preposition: Preposition, id: GoodId): string => before(withArticle(preposition, ware(id).word, ware(id).many), good(id))
/** Some of a good: "des [planches]", "du [bois]", "de la [pierre]". */
export const someGood = (id: GoodId): string => before(someArticle(ware(id).word, ware(id).many), good(id))
/** "de [planches]", "d'[outils]", "de [farine]": after a quantity or a negation. */
export const ofGood = (id: GoodId): string => before(ofArticle(ware(id).word), good(id))
/** So many of a good, the good as a chip: "3 [planches]", "1 [planche]", "3 [poissons]", "5 sacs de [farine]". */
export const some = (id: GoodId, n: number): string => {
  const word = goods[id]
  if (word.measure !== null) return before(measured(id, n), good(id))
  return `${n} ${token.good(id, form(n, word))}`
}
