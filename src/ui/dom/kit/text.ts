/**
 * The town's messages as markup. A message is one string in the page's
 * language, and what it names beyond words is written as tokens (see
 * `i18n/token.ts`): amounts become an icon and a number, and, where the
 * message is one to act on (`chips`), the buildings and goods it names
 * become chips, keys become keys, and "[homes]"-style references chips that
 * pick what they name (see `view/tools.ts`). Nothing here reads a
 * building's name out of the prose: the message says what it names.
 */
import { kinds, type KindId } from "../../../game/content/index.ts"
import type { Catalog } from "../../../i18n/index.ts"
import { plain } from "../../../i18n/index.ts"
import { parse, type Part } from "../../../i18n/token.ts"
import { commands, mapViews } from "../../../view/tools.ts"
import { escapeHtml } from "./dom.ts"
import { goodIcon, icon } from "./icons.ts"

/** A finger rather than a mouse: messages say "tap", and keys are left out. */
export const touchScreen = () => matchMedia("(pointer: coarse)").matches
/** `{tap|click}`: the first on a touch screen, the second with a mouse. */
export const forDevice = (text: string) => text.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, touch: string, mouse: string) => (touchScreen() ? touch : mouse))

/** A message in words alone, for where markup cannot go (a `title`, `textContent`). */
export const words = (t: Catalog, message: string): string => plain(t, forDevice(message))

export interface Markup {
  /** The message is one to act on: buildings, goods, tools, and keys become chips. Without it they are said in words. */
  readonly chips?: boolean
  /** Buildings the line is about, which stand already: their chips go to them rather than placing another. */
  readonly standing?: ReadonlySet<KindId>
  /** When given, only these buildings become chips to place one; others it names are chips that only say what they are. */
  readonly asks?: ReadonlySet<KindId>
}

const sign = (part: { readonly n: number; readonly signed: boolean }) => (part.n < 0 ? "−" : part.signed && part.n > 0 ? "+" : "")

const piece = (t: Catalog, part: Part, { chips = false, standing, asks }: Markup): string => {
  switch (part.type) {
    case "text":
      return escapeHtml(part.text)
    case "coins":
      return `<span class="amount">${sign(part)}${icon("coins", 13)}${Math.abs(part.n)}</span>`
    case "rate":
      return `<span class="amount">${sign(part)}${icon("coins", 13)}${Math.abs(part.n)}${escapeHtml(t.amount.perMinute)}</span>`
    case "amount":
      return `<span class="amount">${goodIcon(part.good, 13)}${part.n}</span>`
    case "good": {
      const shown = escapeHtml(part.shown ?? t.good.name(part.good))
      return chips
        ? `<span class="ref ware" title="${escapeHtml(t.good.name(part.good))}">${goodIcon(part.good, 13)}${shown}</span>`
        : `<span class="amount">${goodIcon(part.good, 13)}${shown}</span>`
    }
    case "kind": {
      const shown = escapeHtml(part.shown ?? t.kind.name(part.kind))
      if (!chips) return shown
      if (standing?.has(part.kind)) return `<button class="ref kind go" data-go="${part.kind}" title="${escapeHtml(t.page.chips.goTo(part.kind))}">${icon("locate", 13)}${shown}</button>`
      return kinds[part.kind].buildable && (!asks || asks.has(part.kind))
        ? `<button class="ref kind" data-kind="${part.kind}" title="${escapeHtml(t.page.chips.build(part.kind))}">${icon("build", 13)}${shown}</button>`
        : `<span class="ref kind" title="${escapeHtml(t.kind.blurb(part.kind))}">${icon("town", 13)}${shown}</span>`
    }
    case "command": {
      const look = commands[part.command], said = t.commands[part.command]
      if (!chips) return escapeHtml(said.label)
      const key = "key" in look ? `<kbd>${look.key}</kbd>` : ""
      return `<button class="ref tool" data-tool="${part.command}" title="${escapeHtml(said.title)}">${icon(look.icon, 13)}${escapeHtml(said.label)}${key}</button>`
    }
    case "view": {
      const look = mapViews[part.view], said = t.mapViews[part.view]
      if (!chips) return escapeHtml(said.chip)
      return `<button class="ref tool" data-tool="view:${part.view}" title="${escapeHtml(said.title)}">${icon(look.icon, 13)}${escapeHtml(said.chip)}<kbd>${look.key}</kbd></button>`
    }
    case "key":
      return chips ? `<kbd class="key">${part.key}</kbd>` : `(${part.key})`
  }
}

/**
 * A message as markup: its amounts as icons, and (with `chips`) what it
 * names as chips to click. A cost's amounts sit side by side: the dots
 * between them only crowd it.
 */
export const markup = (t: Catalog, message: string, options: Markup = {}): string =>
  parse(forDevice(message))
    .map((part) => piece(t, part, options))
    .join("")
    .replace(/<\/span> · <span class="amount">/g, '</span> <span class="amount">')

const slot = (i: number) => `\u0000${i}\u0000`

/**
 * A sentence of the language's with the page's own markup set into it: a
 * bold number, a good's icon, a line that is itself markup. The sentence
 * (a catalog function) says where each piece goes, so a language orders
 * them as it reads; its words are escaped, and each piece (`parts`, markup
 * already) is put where the sentence placed it.
 */
export function compose(sentence: (a: string) => string, a: string): string
export function compose(sentence: (a: string, b: string) => string, a: string, b: string): string
export function compose(sentence: (a: string, b: string, c: string) => string, a: string, b: string, c: string): string
export function compose(sentence: (...slots: Array<string>) => string, ...parts: Array<string>): string {
  return escapeHtml(sentence(...parts.map((_, i) => slot(i)))).replace(/\u0000(\d+)\u0000/g, (_, i: string) => parts[Number(i)] ?? "")
}

/** Seconds as m:ss. */
export const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

/** How long ago a save was made, roughly: "just now", "12 min ago", "3 h ago", "2 days ago". */
export const ago = (t: Catalog, at: number): string => {
  const minutes = Math.floor((Date.now() - at) / 60000)
  if (minutes < 1) return t.page.ago.now
  if (minutes < 60) return t.page.ago.minutes(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t.page.ago.hours(hours)
  const days = Math.floor(hours / 24)
  return days === 1 ? t.page.ago.yesterday : t.page.ago.days(days)
}
