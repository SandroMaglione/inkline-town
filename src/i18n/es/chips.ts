/**
 * Buildings and goods as chips in a Spanish sentence. A chip holds the noun
 * alone, and its article or preposition stands outside it, agreeing with
 * the noun as Spanish has it: "el [mercado]", "la [granja]", "del
 * [molino]", "al [mercado]", "las [tablas]". Every part of the catalog
 * writes its chips through these, so an article never disagrees with its
 * noun.
 */
import type { GoodId, KindId } from "../../game/content/index.ts"
import * as token from "../token.ts"
import { agree, anArticle, before, theArticle, withArticle, type Noun, type Preposition } from "./grammar.ts"
import { built, goods } from "./nouns.ts"

/** A building's chip, by what it is called at its level: "[mercado cubierto]". */
export const kind = (id: KindId, level = 0): string => token.kind(id, built(id, level).noun.one)
/** Many of a building: "[mercados]". */
export const kinds = (id: KindId, level = 0): string => token.kind(id, built(id, level).noun.other)
/** "el [mercado]", "la [granja]". */
export const theKind = (id: KindId, level = 0): string => before(theArticle(built(id, level).noun), kind(id, level))
/** "los [mercados]", "las [granjas]". */
export const theKinds = (id: KindId, level = 0): string => before(theArticle(built(id, level).noun, true), kinds(id, level))
/** "un [mercado]", "una [granja]". */
export const aKind = (id: KindId, level = 0): string => before(anArticle(built(id, level).noun), kind(id, level))
/** "otro [mercado]", "otra [pesquería]": one more of a building (Spanish puts no article before "otro"). */
export const anotherKind = (id: KindId, level = 0): string => before(agree(built(id, level).noun, "otro", "otra"), kind(id, level))
/** "del [mercado]", "al [molino]", "en la [granja]". */
export const toKind = (preposition: Preposition, id: KindId, level = 0): string => before(withArticle(preposition, built(id, level).noun), kind(id, level))
/** "de los [mercados]", "a las [granjas]". */
export const toKinds = (preposition: Preposition, id: KindId, level = 0): string => before(withArticle(preposition, built(id, level).noun, true), kinds(id, level))

/** A good as the town speaks of it is one noun, in the number it is spoken of in: "las tablas" (many), "el pan" (one). */
const ware = (id: GoodId): { readonly word: Noun; readonly many: boolean } => ({ word: goods[id], many: goods[id].counted })
/** A good's chip: "[tablas]", "[pan]". */
export const good = (id: GoodId): string => token.good(id)
/** "las [tablas]", "el [pan]", "las [herramientas]", "la [tela]". */
export const theGood = (id: GoodId): string => before(theArticle(ware(id).word, ware(id).many), good(id))
/** "de las [tablas]", "del [pan]", "a la [madera]". */
export const toGood = (preposition: Preposition, id: GoodId): string => before(withArticle(preposition, ware(id).word, ware(id).many), good(id))
/** So many of a good, the good as a chip: "3 [tablas]", "1 [tabla]", "5 de [harina]". */
export const some = (id: GoodId, n: number): string =>
  goods[id].counted ? `${n} ${token.good(id, n === 1 ? goods[id].one : goods[id].other)}` : `${n} de ${good(id)}`
