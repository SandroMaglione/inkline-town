import { setTitle, textNode } from "../../../i18n/dom.ts"
/** A box of a panel or a sheet, under a heading with an icon. */
import type { IconName } from "../../../view/icons.ts"
import { el } from "./dom.ts"
import { iconEl } from "./icons.ts"

/** `help` is kept behind an ⓘ rather than spelled out. */
export const section = (heading: string, glyph?: IconName, help?: string) => {
  const box = el("section", "")
  const h3 = el("h3", "")
  if (glyph) h3.append(iconEl(glyph))
  h3.append(textNode(heading))
  box.append(h3)
  if (help) {
    const info = el("button", "help")
    info.append(iconEl("info", 15))
    setTitle(info, "What this means")
    info.setAttribute("aria-expanded", "false")
    const text = el("p", "help-text", help)
    info.onclick = () => {
      const open = !text.classList.contains("open")
      text.classList.toggle("open", open)
      info.setAttribute("aria-expanded", String(open))
    }
    h3.append(info)
    box.append(text)
  }
  return box
}
