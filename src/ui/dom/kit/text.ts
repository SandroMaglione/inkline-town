/**
 * The town's messages as markup: amounts as icons, the buildings and goods
 * they name as chips, keys as keys, and "[homes]"-style references as chips
 * that pick what they name (see `view/tools.ts`).
 */
import { goodIds, goods, kindOrder, kinds, type GoodId, type KindId } from "../../../game/content/index.ts"
import { refLook, refOf } from "../../../view/tools.ts"
import { escapeHtml } from "./dom.ts"
import { goodIcon, icon } from "./icons.ts"

/** Words in the town's messages that name a building or a good, longest first, so "smoked fish" wins over "fish". */
const namedThings: ReadonlyArray<{ readonly word: string; readonly ref: { readonly kind: KindId } | { readonly good: GoodId } }> = [
  ...kindOrder.flatMap((id) => {
    const title = kinds[id].title.toLowerCase()
    return [title, `${title}s`].map((word) => ({ word, ref: { kind: id } }))
  }),
  ...goodIds.map((id) => ({ word: goods[id].title, ref: { good: id } })),
  { word: "loaves", ref: { good: "bread" as GoodId } },
  { word: "loaf", ref: { good: "bread" as GoodId } }
].sort((a, b) => b.word.length - a.word.length)
const namedPattern = new RegExp(
  `\\b(${namedThings.map((t) => t.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b|\\(([A-Z])\\)|\\[([a-z]+(?::[a-z]+)?)\\]`,
  "gi"
)
/** Goods as numbers name them ("2 planks", "1 plank"), and as recipes do ("flour → bread"), by title. */
const goodWords: ReadonlyArray<readonly [string, GoodId]> = [
  ...goodIds.map((id) => [goods[id].title, id] as const),
  ...goodIds.filter((id) => goods[id].title.endsWith("s")).map((id) => [goods[id].title.slice(0, -1), id] as const)
].sort((a, b) => b[0].length - a[0].length)
const goodAlternatives = goodWords.map(([w]) => w).join("|")
const goodOf = (word: string) => goodWords.find(([w]) => w === word)![1]

/**
 * Amounts in a line of (escaped) text as icons, where the icon says it as
 * well as the word: "3 coins a minute" as a coin and 3/min, "2 planks" as a
 * plank and 2, "flour → bread" with each good's icon.
 */
export const iconize = (html: string): string =>
  html
    .replace(/([+−-]?)(\d+) coins a minute/g, (_, sign: string, n: string) => `<span class="amount">${sign}${icon("coins", 13)}${n}/min</span>`)
    .replace(/(\d+) coins\b/g, (_, n: string) => `<span class="amount">${icon("coins", 13)}${n}</span>`)
    .replace(new RegExp(`(\\d+) (${goodAlternatives})\\b`, "g"), (_, n: string, w: string) => `<span class="amount">${goodIcon(goodOf(w), 13)}${n}</span>`)
    .replace(new RegExp(`\\b(${goodAlternatives}) → (${goodAlternatives})\\b`, "g"), (_, a: string, b: string) => `<span class="amount">${goodIcon(goodOf(a), 13)}${a}</span> → <span class="amount">${goodIcon(goodOf(b), 13)}${b}</span>`)
    // A cost as icons side by side: the dots between them only crowd it.
    .replace(/<\/span> · <span class="amount">/g, '</span> <span class="amount">')

/** A finger rather than a mouse: messages say "tap", and keys are left out. */
export const touchScreen = () => matchMedia("(pointer: coarse)").matches
/** `{tap|click}`: the first on a touch screen, the second with a mouse. */
const forDevice = (text: string) => text.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, touch: string, mouse: string) => (touchScreen() ? touch : mouse))

/**
 * A message as markup: each building it names becomes a chip to click (to
 * build one), each good a chip with its icon, each key in round brackets a
 * key, and each tool in square brackets a chip that picks it.
 * `standing`: buildings the line is about, which stand already; their chips go to them rather than placing another.
 * `asks`: when given, only these buildings become chips to place one; others it names are plain words.
 */
export const callouts = (text: string, standing: ReadonlySet<KindId> = new Set(), asks?: ReadonlySet<KindId>): string =>
  escapeHtml(forDevice(text)).replace(namedPattern, (match, word: string | undefined, key: string | undefined, tool: string | undefined) => {
    if (key) return `<kbd class="key">${key}</kbd>`
    if (tool) {
      const ref = refOf(tool)
      if (!ref) return match
      const look = refLook(ref)
      return `<button class="ref tool" data-tool="${tool}" title="${escapeHtml(look.title)}">${icon(look.icon, 13)}${look.label}${look.key ? `<kbd>${look.key}</kbd>` : ""}</button>`
    }
    const thing = namedThings.find((t) => t.word === word!.toLowerCase())
    if (!thing) return match
    if ("good" in thing.ref) return `<span class="ref ware" title="${goods[thing.ref.good].title}">${goodIcon(thing.ref.good, 13)}${match}</span>`
    const kind = kinds[thing.ref.kind]
    if (standing.has(thing.ref.kind)) return `<button class="ref kind go" data-go="${thing.ref.kind}" title="Go to the ${kind.title.toLowerCase()}">${icon("locate", 13)}${match}</button>`
    return kind.buildable && (!asks || asks.has(thing.ref.kind))
      ? `<button class="ref kind" data-kind="${thing.ref.kind}" title="Build a ${kind.title.toLowerCase()}: ${escapeHtml(kind.blurb)}">${icon("build", 13)}${match}</button>`
      : `<span class="ref kind" title="${escapeHtml(kind.blurb)}">${icon("town", 13)}${match}</span>`
  })

/** Seconds as m:ss. */
export const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

/** How long ago a save was made, roughly: "just now", "12 min ago", "3 h ago", "2 days ago". */
export const ago = (at: number): string => {
  const minutes = Math.floor((Date.now() - at) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? "yesterday" : `${days} days ago`
}
