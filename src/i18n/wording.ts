/**
 * How a locale words what the game says as data. The game names what
 * happened as a tagged union (`{ _tag: "fire", place }`: see
 * `game/said.ts`, and the causes and notes the rules give); a locale holds
 * one function for each tag, and `say` picks it. A table must word every
 * tag (`Wording<M>` is checked with `satisfies`), so a new thing the game
 * can say fails to compile in every language until each has put it into
 * words, and a tag's numbers are typed where they are used.
 */

/** Anything the game says as data: a tag, and what goes with it. */
export interface Tagged {
  readonly _tag: string
}

/** A union by its tags: each tag's own member. */
type Members<M extends Tagged> = { readonly [T in M["_tag"]]: Extract<M, { readonly _tag: T }> }

/** A locale's words for a union: for each tag, what that member says (`Out`: a line, or a line with more to it). */
export type Wording<M extends Tagged, Out = string> = { readonly [T in M["_tag"]]: (said: Members<M>[T]) => Out }

/** The entry for a tag takes that tag's member: indexing both by the same `T` is what lets the compiler see it. */
const worded = <M extends Tagged, T extends M["_tag"], Out>(wording: Wording<M, Out>, tag: T, said: Members<M>[T]): Out => wording[tag](said)

/** What a table says: whatever its entries return (a line, or a line with more to it). */
type Said<W> = W extends { readonly [tag: string]: (said: never) => infer Out } ? Out : never

/**
 * What the game said, in the locale's words. The table is taken as it is
 * written (so what it returns is read off the table itself, however it was
 * declared), and held to wording every tag of what was said.
 */
export function say<M extends Tagged, W extends Wording<M, unknown>>(wording: W, said: M): Said<W>
export function say<M extends Tagged, Out>(wording: Wording<M, Out>, said: Members<M>[M["_tag"]]): Out {
  return worded<M, M["_tag"], Out>(wording, said._tag, said)
}
