import { setMarkup, setText, textNode } from "../../../i18n/dom.ts"
/** A labelled number in a panel, and a signed sum coloured by its sign. */
import type { GoodId } from "../../../game/content/index.ts"
import type { IconName } from "../../../view/icons.ts"
import { el } from "./dom.ts"
import { icon } from "./icons.ts"
import { signed } from "./text.ts"

/** Appends a row to `box` and returns the node its value goes in. */
export const row = (box: HTMLElement, label: string, glyph?: IconName | GoodId) => {
  const line = el("div", "row")
  const value = el("span", "count")
  const name = el("span", "label")
  if (glyph) setMarkup(name, icon(glyph, 16))
  name.append(textNode(label))
  line.append(name, value)
  box.append(line)
  return value
}

/** Sets a number with its sign, coloured by it. */
export const money = (node: HTMLElement, n: number, suffix = "") => {
  setText(node, `${signed(n)}${suffix}`)
  node.classList.toggle("up", n > 0)
  node.classList.toggle("down", n < 0)
}
