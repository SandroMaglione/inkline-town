/**
 * Choosing the language. Every language the game speaks is listed by what
 * it calls itself (a reader looks for their own language's name, not for
 * its name in the one on the page), with the one in use marked. Picking
 * another hands it to the page (`choose`), which keeps the choice, saves
 * the town in play, and comes back in that language; if it cannot (the
 * browser would not keep the choice, or the town could not be saved), it
 * says why, and nothing changes. The town waits while the dialog is open.
 */
import { languageName, localeOf, locales, type Catalog, type Locale } from "../../../i18n/index.ts"
import type { Controls } from "../controls.ts"
import { el } from "../kit/dom.ts"
import { iconEl } from "../kit/icons.ts"

/** `choose`: changes the language (the page reloads), or says why it could not. */
export const createLanguage = (t: Catalog, choose: (locale: Locale) => string | null, speed: () => number, controls: Pick<Controls, "setSpeed" | "toast">) => {
  const said = t.page.language
  const current = localeOf(t)
  const box = el("div", "dialog language")
  let wasSpeed = 1
  const close = () => {
    if (!box.classList.contains("open")) return
    box.classList.remove("open")
    controls.setSpeed(wasSpeed)
  }
  const open = () => {
    wasSpeed = speed()
    controls.setSpeed(0)
    box.replaceChildren()
    const card = el("div", "sheet narrow")
    card.append(el("h2", "", said.title), el("p", "sub", said.sub))
    const list = el("div", "choices")
    for (const locale of locales) {
      const name = languageName(locale)
      const button = el("button", "frame choice", name)
      // Each name is in its own language: said so, for a screen reader's voice and the browser's fonts.
      button.lang = locale
      button.classList.toggle("on", locale === current)
      if (locale === current) button.setAttribute("aria-current", "true")
      button.setAttribute("aria-label", locale === current ? said.current(name) : name)
      button.onclick = () => {
        if (locale === current) return close()
        const failed = choose(locale)
        if (failed !== null) controls.toast(failed)
      }
      list.append(button)
    }
    const actions = el("div", "actions")
    const done = el("button", "frame primary", t.page.common.close)
    done.onclick = close
    actions.append(done)
    card.append(list, el("p", "note", said.keeps), actions)
    box.append(card)
    box.classList.add("open")
    done.focus()
  }
  /** A button that opens the dialog, saying the language in use: for the founding screen, where there is no system bar yet. */
  const button = () => {
    const b = el("button", "frame language-button")
    b.title = t.page.system.language.tip
    b.append(iconEl("language", 14), document.createTextNode(languageName(current)))
    b.onclick = open
    return b
  }
  return { element: box, open, close, isOpen: () => box.classList.contains("open"), button }
}
