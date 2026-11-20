/**
 * Buildings and goods as chips in an Italian sentence. A chip holds the
 * noun alone, and its article or preposition stands outside it, bent to
 * the noun as Italian bends it: "il [mercato]", "l'[ovile]", "della
 * [fattoria]", "le [tavole]". Every part of the catalog writes its chips
 * through these, so an article never disagrees with its noun.
 */
import type { GoodId, KindId } from "../../game/content/index.ts"
import * as token from "../token.ts"
import { anArticle, before, theArticle, withArticle, type Noun, type Preposition } from "./grammar.ts"
import { built, goods } from "./nouns.ts"

/** A building's chip, by what it is called at its level: "[mercato coperto]". */
export const kind = (id: KindId, level = 0): string => token.kind(id, built(id, level).noun.one)
/** Many of a building: "[mercati]". */
export const kinds = (id: KindId, level = 0): string => token.kind(id, built(id, level).noun.other)
/** "il [mercato]", "l'[ovile]", "la [fattoria]". */
export const theKind = (id: KindId, level = 0): string => before(theArticle(built(id, level).noun), kind(id, level))
/** "i [mercati]", "gli [ovili]", "le [fattorie]". */
export const theKinds = (id: KindId, level = 0): string => before(theArticle(built(id, level).noun, true), kinds(id, level))
/** "un [mercato]", "un'[infermeria]", "una [fattoria]". */
export const aKind = (id: KindId, level = 0): string => before(anArticle(built(id, level).noun), kind(id, level))
/** "del [mercato]", "all'[ovile]", "nella [fattoria]", "sul [municipio]". */
export const toKind = (preposition: Preposition, id: KindId, level = 0): string => before(withArticle(preposition, built(id, level).noun), kind(id, level))
/** "dei [mercati]", "agli [ovili]", "delle [fattorie]". */
export const toKinds = (preposition: Preposition, id: KindId, level = 0): string => before(withArticle(preposition, built(id, level).noun, true), kinds(id, level))

/** A good as the town speaks of it is one noun, in the number it is spoken of in: "le tavole" (many), "il pane" (one). */
const ware = (id: GoodId): { readonly word: Noun; readonly many: boolean } => ({ word: goods[id], many: goods[id].counted })
/** A good's chip: "[tavole]", "[pane]". */
export const good = (id: GoodId): string => token.good(id)
/** "le [tavole]", "il [pane]", "gli [attrezzi]", "la [stoffa]". */
export const theGood = (id: GoodId): string => before(theArticle(ware(id).word, ware(id).many), good(id))
/** "delle [tavole]", "del [pane]", "agli [attrezzi]", "con la" is not joined: only di, a, da, in, su are. */
export const toGood = (preposition: Preposition, id: GoodId): string => before(withArticle(preposition, ware(id).word, ware(id).many), good(id))
/** So many of a good, the good as a chip: "3 [tavole]", "1 [tavola]", "5 di [farina]". */
export const some = (id: GoodId, n: number): string =>
  goods[id].counted ? `${n} ${token.good(id, n === 1 ? goods[id].one : goods[id].other)}` : `${n} di ${good(id)}`
