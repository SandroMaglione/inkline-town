/** A box of a panel or a sheet, under a heading with an icon. */
import type { Catalog } from "../../../i18n/index.ts"
import type { IconName } from "../../../view/icons.ts"
import { el } from "./dom.ts"
import { iconEl } from "./icons.ts"

/** `help` is kept behind an ⓘ rather than spelled out. */
export const section = (t: Catalog, heading: string, glyph?: IconName, help?: string) => {
  const box = el("section", "")
  const h3 = el("h3", "")
  if (glyph) h3.append(iconEl(glyph))
  h3.append(document.createTextNode(heading))
  box.append(h3)
  if (help) {
    const info = el("button", "help")
    info.append(iconEl("info", 15))
    info.title = t.page.common.whatThisMeans
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
