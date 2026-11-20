/**
 * Choosing the language: a small menu that opens at the button it was
 * asked from (the founding screen's, beside the maker's credit; the system
 * bar's globe), listing every language the game speaks by what it calls
 * itself (a reader looks for their own language's name, not for its name
 * in the one on the page), the one in use marked. Picking another hands it
 * to the page (`choose`), which keeps the choice, saves the town in play,
 * and comes back in that language; if it cannot (the browser would not
 * keep the choice, or the town could not be saved), it says why, and
 * nothing changes. A press anywhere else, or Esc, puts the menu away.
 */
import { languageName, localeOf, locales, type Catalog, type Locale } from "../../../i18n/index.ts"
import type { Controls } from "../controls.ts"
import { el } from "../kit/dom.ts"
import { iconEl } from "../kit/icons.ts"

/** The gap between the menu and its button, and between the menu and the screen's edge. */
const GAP = 6
const EDGE = 8

/** `choose`: changes the language (the page reloads), or says why it could not. */
export const createLanguage = (t: Catalog, choose: (locale: Locale) => string | null, controls: Pick<Controls, "toast">) => {
  const said = t.page.language
  const current = localeOf(t)
  const menu = el("div", "language-menu")
  menu.setAttribute("role", "menu")
  menu.setAttribute("aria-label", t.page.system.language.label)
  /** The button the menu is open at, to tell it so and to give the keyboard back to it. */
  let opener: HTMLElement | null = null
  const close = () => {
    if (!opener) return
    menu.classList.remove("open")
    opener.setAttribute("aria-expanded", "false")
    opener = null
  }
  for (const locale of locales) {
    const name = languageName(locale)
    const item = el("button", locale === current ? "on" : "", name)
    item.type = "button"
    item.setAttribute("role", "menuitemradio")
    item.setAttribute("aria-checked", locale === current ? "true" : "false")
    item.setAttribute("aria-label", locale === current ? said.current(name) : name)
    // Each name is in its own language: said so, for a screen reader's voice and the browser's fonts.
    item.lang = locale
    item.onclick = () => {
      const from = opener
      close()
      if (locale === current) return from?.focus()
      const failed = choose(locale)
      if (failed !== null) controls.toast(failed)
    }
    menu.append(item)
  }
  /** Opens the menu at a button: above it where there is room (both buttons sit at the bottom of what they are on), else below, and within the screen. */
  const open = (at: HTMLElement) => {
    if (opener === at) return close()
    close()
    opener = at
    at.setAttribute("aria-expanded", "true")
    const box = at.getBoundingClientRect()
    menu.classList.add("open")
    const above = box.top - GAP - menu.offsetHeight >= EDGE
    menu.style.top = `${above ? box.top - GAP - menu.offsetHeight : Math.min(box.bottom + GAP, window.innerHeight - EDGE - menu.offsetHeight)}px`
    // From the button's left edge; from its right edge where that would run off the screen (the system bar's is at the right).
    const left = box.left + menu.offsetWidth <= window.innerWidth - EDGE ? box.left : box.right - menu.offsetWidth
    menu.style.left = `${Math.max(EDGE, Math.min(left, window.innerWidth - EDGE - menu.offsetWidth))}px`
    menu.querySelector<HTMLButtonElement>("button.on")?.focus()
  }
  // A press anywhere but the menu and its button puts it away; the button's own press is its to answer.
  document.addEventListener("pointerdown", (event) => {
    if (!opener || !(event.target instanceof Node) || menu.contains(event.target) || opener.contains(event.target)) return
    close()
  }, true)
  window.addEventListener("resize", close)
  /** A button that opens the menu, saying the language in use: for the founding screen, where there is no system bar yet. */
  const button = () => {
    const b = el("button", "language-button")
    b.type = "button"
    b.title = t.page.system.language.tip
    b.setAttribute("aria-haspopup", "menu")
    b.setAttribute("aria-expanded", "false")
    b.append(iconEl("language", 14), document.createTextNode(languageName(current)))
    b.onclick = () => open(b)
    return b
  }
  return { element: menu, open, close, isOpen: () => opener !== null, button }
}
