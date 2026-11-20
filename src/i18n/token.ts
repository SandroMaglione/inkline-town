/**
 * Tokens: the things a message names that are more than words. An amount
 * of coins or of a good is shown as an icon and a number; a building, a
 * good, a tool, or a map view as a chip to click; a key as a key. A message
 * is still one string (so it compares, logs, and tests as one), with each
 * of these written in square brackets:
 *
 *     [coins:25]  [coins:+25]  [rate:-3]     coins, signed or not, and coins a minute
 *     [amount:planks:2]                      two planks, as an icon and a number
 *     [kind:fishery]  [kind:fishery|fisheries]   a building, by its name or the word given
 *     [good:planks]   [good:bread|loaves]        a good, likewise
 *     [homes]  [view:fire]                   a tool or a panel, and a map view
 *     (S)                                    a key
 *
 * A locale never types these by hand: it calls the helpers below, which
 * take the game's own ids, so a misspelt building or tool does not compile.
 * `parse` reads a message back into typed parts; the page renders the
 * parts as markup (`ui/dom/kit/text.ts`), and `plain` (in `plain.ts`) as
 * words, for a tooltip or a title. Nothing recognises a building by how
 * its name happens to be spelt in one language.
 *
 * `{tap|click}` is not a token but the device's choice, made by the page
 * before it parses (see `device`).
 */
import { goodIds, kindIds, type GoodId, type KindId } from "../game/content/index.ts"
import { commands, mapViews, type CommandId, type MapViewId } from "../view/tools.ts"

/** Coins: "25", or with `signed` "+25" and "−25" (a gain, a cost). */
export const coins = (n: number, signed = false): string => `[coins:${number(n, signed)}]`
/** Coins a minute. */
export const rate = (n: number, signed = false): string => `[rate:${number(n, signed)}]`
/** So many of a good, as its icon and the number. */
export const amount = (good: GoodId, n: number): string => `[amount:${good}:${n}]`
/** A building, as a chip: `shown` is the word in the sentence when it is not the plain name ("fisheries"). */
export const kind = (id: KindId, shown?: string): string => (shown === undefined ? `[kind:${id}]` : `[kind:${id}|${clean(shown)}]`)
/** A good, as a chip with its icon: `shown` as for `kind` ("loaves", for bread). */
export const good = (id: GoodId, shown?: string): string => (shown === undefined ? `[good:${id}]` : `[good:${id}|${clean(shown)}]`)
/** A tool, a panel, or the clock, as a chip that picks it. */
export const command = (id: CommandId): string => `[${id}]`
/** A map view, as a chip that shows it. */
export const view = (id: MapViewId): string => `[view:${id}]`
/** A key, as a keyboard shows it. */
export const key = (name: string): string => `(${name})`
/** What a finger does, and what a mouse does: the page says the one that fits ("tap", "click"). */
export const device = (touch: string, mouse: string): string => `{${touch}|${mouse}}`

const number = (n: number, signed: boolean) => (signed && n > 0 ? `+${n}` : `${n}`)
/** A token's own word cannot hold what ends or splits a token. */
const clean = (shown: string) => shown.replace(/[\]|]/g, "")

/** A message, read back: its words, and what it names. */
export type Part =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "coins"; readonly n: number; readonly signed: boolean }
  | { readonly type: "rate"; readonly n: number; readonly signed: boolean }
  | { readonly type: "amount"; readonly good: GoodId; readonly n: number }
  | { readonly type: "kind"; readonly kind: KindId; readonly shown: string | null }
  | { readonly type: "good"; readonly good: GoodId; readonly shown: string | null }
  | { readonly type: "command"; readonly command: CommandId }
  | { readonly type: "view"; readonly view: MapViewId }
  | { readonly type: "key"; readonly key: string }

const isKind = (id: string): id is KindId => (kindIds as ReadonlyArray<string>).includes(id)
const isGood = (id: string): id is GoodId => (goodIds as ReadonlyArray<string>).includes(id)
const isCommand = (id: string): id is CommandId => id in commands
const isView = (id: string): id is MapViewId => id in mapViews

const pattern = /\[([a-z]+)(?::([^\]|]*))?(?:\|([^\]]*))?\]|\(([A-Z]|space)\)/g
const signedNumber = /^([+-]?)(\d+(?:\.\d+)?)$/

/** One bracket as a part, or `null` when it names nothing the game knows (it is then left as it was written). */
const partOf = (head: string, body: string | undefined, shown: string | undefined): Part | null => {
  if (body === undefined) return shown === undefined && isCommand(head) ? { type: "command", command: head } : null
  switch (head) {
    case "coins":
    case "rate": {
      const n = signedNumber.exec(body)
      return n ? { type: head, n: Number(`${n[1]}${n[2]}`), signed: n[1] !== "" } : null
    }
    case "amount": {
      const [id = "", n = ""] = body.split(":")
      return isGood(id) && /^\d+$/.test(n) ? { type: "amount", good: id, n: Number(n) } : null
    }
    case "kind":
      return isKind(body) ? { type: "kind", kind: body, shown: shown ?? null } : null
    case "good":
      return isGood(body) ? { type: "good", good: body, shown: shown ?? null } : null
    case "view":
      return shown === undefined && isView(body) ? { type: "view", view: body } : null
    default:
      return null
  }
}

/** A message as its parts, in order. Whatever is not a token the game knows stays text. */
export const parse = (message: string): ReadonlyArray<Part> => {
  const parts: Array<Part> = []
  let from = 0
  const text = (to: number) => {
    if (to > from) parts.push({ type: "text", text: message.slice(from, to) })
  }
  for (const match of message.matchAll(pattern)) {
    const [whole, head, body, shown, keyName] = match
    const part: Part | null = keyName !== undefined ? { type: "key", key: keyName } : partOf(head!, body, shown)
    if (!part) continue
    text(match.index)
    parts.push(part)
    from = match.index + whole.length
  }
  text(message.length)
  return parts
}
