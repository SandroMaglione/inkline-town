/**
 * Buildings and goods as chips in a German sentence. A chip holds the noun
 * alone, in the form its case needs ("[Marktes]", "[Brettern]"), and its
 * article or preposition stands outside it, bent to the noun's gender,
 * number, and case: "den [Markt]", "einer [Mühle]", "zum [Sägewerk]", "zur
 * [Mühle]", "mit den [Brettern]". Every part of the catalog writes its
 * chips through these, so an article never disagrees with its noun.
 */
import type { GoodId, KindId } from "../../game/content/index.ts"
import * as token from "../token.ts"
import { anArticle, form, noArticle, theArticle, withArticle, type Case, type Noun, type Preposition } from "./grammar.ts"
import { built, goods, type Good } from "./nouns.ts"

const noun = (id: KindId, level: number): Noun => built(id, level).noun

/** A building's chip, in a case, by what it is called at its level: "[Markthalle]", "[Marktes]". */
export const kind = (id: KindId, c: Case = "nom", level = 0): string => token.kind(id, form(noun(id, level), c))
/** Many of a building: "[Mühlen]", "[Fischereien]". */
export const kinds = (id: KindId, c: Case = "nom", level = 0): string => token.kind(id, form(noun(id, level), c, true))
/** "der [Markt]", "den [Markt]", "des [Marktes]", "die [Mühle]". */
export const theKind = (id: KindId, c: Case = "nom", level = 0): string => `${theArticle(noun(id, level), c)} ${kind(id, c, level)}`
/** "die [Mühlen]", "den [Mühlen]". */
export const theKinds = (id: KindId, c: Case = "nom", level = 0): string => `${theArticle(noun(id, level), c, true)} ${kinds(id, c, level)}`
/** "ein [Markt]", "einen [Markt]", "eine [Mühle]", "einem [Sägewerk]". */
export const aKind = (id: KindId, c: Case = "nom", level = 0): string => `${anArticle(noun(id, level), c)} ${kind(id, c, level)}`
/** "kein [Markt]", "keine [Mühle]". */
export const noKind = (id: KindId, c: Case = "nom", level = 0): string => `${noArticle(noun(id, level), c)} ${kind(id, c, level)}`
/** "zum [Markt]", "im [Sägewerk]", "an der [Kapelle]", "für den [Holzfäller]". */
export const toKind = (preposition: Preposition, c: Case, id: KindId, level = 0): string => `${withArticle(preposition, c, noun(id, level))} ${kind(id, c, level)}`
/** "zu den [Mühlen]", "in den [Fischereien]". */
export const toKinds = (preposition: Preposition, c: Case, id: KindId, level = 0): string => `${withArticle(preposition, c, noun(id, level), true)} ${kinds(id, c, level)}`
/** "des [Marktes]", "der [Kapelle]": a building something belongs to, after what it is ("der Läufer des [Marktes]"). */
export const ofKind = (id: KindId, level = 0): string => theKind(id, "gen", level)

/** A good as the town speaks of it is one noun, in the number it is spoken of in: "die Bretter" (many), "das Holz" (one). */
const ware = (id: GoodId): Good => goods[id]
/** A good's chip, in a case: "[Bretter]", "[Brettern]", "[Holz]". The plain chip where the word is the ware's own name. */
export const good = (id: GoodId, c: Case = "nom"): string => {
  const shown = form(ware(id), c, ware(id).many)
  return shown === ware(id).name ? token.good(id) : token.good(id, shown)
}
/** "die [Bretter]", "das [Holz]", "den [Weizen]", "den [Brettern]". */
export const theGood = (id: GoodId, c: Case = "nom"): string => `${theArticle(ware(id), c, ware(id).many)} ${good(id, c)}`
/** "aus dem [Holz]", "mit den [Brettern]", "zum [Mehl]". */
export const toGood = (preposition: Preposition, c: Case, id: GoodId): string => `${withArticle(preposition, c, ware(id), ware(id).many)} ${good(id, c)}`
/** So many of a good, the good as a chip: "3 [Bretter]", "1 [Brett]", "5 [Holz]". */
export const some = (id: GoodId, count: number): string => {
  const word = count === 1 ? ware(id).unit.one : ware(id).unit.other
  return `${count} ${word === ware(id).name ? token.good(id) : token.good(id, word)}`
}
