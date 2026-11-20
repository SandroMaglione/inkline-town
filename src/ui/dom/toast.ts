/**
 * The toast: a message for a few seconds, long enough to read (about 15
 * letters a second, and a moment to look), and gone as soon as the mayor taps
 * the map again: by then they have read it, or are acting on it.
 */
import type { Catalog } from "../../i18n/index.ts"
import { el } from "./kit/dom.ts"
import { markup, words } from "./kit/text.ts"

export const createToast = (t: Catalog) => {
  const box = el("div", "toast")
  let timer = 0
  /** When the toast showing went up: a press on the map just after does not put it away. */
  let at = 0
  return {
    element: box,
    show: (message: string) => {
      box.innerHTML = markup(t, message)
      box.classList.add("show")
      at = Date.now()
      window.clearTimeout(timer)
      // As long as its words take to read: an amount shown as an icon is counted as the words it stands for.
      timer = window.setTimeout(() => box.classList.remove("show"), Math.min(8000, Math.max(2200, 1200 + words(t, message).length * 65)))
    },
    /** A toast is up: what waits its turn (the sign-up's card) holds off. */
    showing: () => box.classList.contains("show"),
    /** A tap on the map puts a toast away (one it raised itself stays). */
    tapped: () => {
      if (!box.classList.contains("show") || Date.now() - at <= 250) return
      window.clearTimeout(timer)
      box.classList.remove("show")
    }
  }
}
