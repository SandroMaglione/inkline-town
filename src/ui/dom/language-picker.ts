import { LANGUAGE_KEY, languages, localization, isLanguage } from "../../i18n/index.ts"
import { el } from "./kit/dom.ts"
import { refreshTranslations, setAttribute, setMarkup, setTitle } from "../../i18n/dom.ts"

export const createLanguagePicker = (toast: (message: string) => void) => {
  const label = el("label", "language-picker")
  label.addEventListener("click", (event) => event.stopPropagation())
  setTitle(label, "Choose language")
  const globe = el("span", "glyph")
  setMarkup(globe, '<svg class="icon" aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="9" cy="9" r="7"/><ellipse cx="9" cy="9" rx="3" ry="7"/><path d="M2 9h14M3.5 4.5h11M3.5 13.5h11"/></svg>')
  const select = el("select", "")
  setAttribute(select, "aria-label", "Language")
  for (const language of languages) {
    const option = el("option", "", language.name)
    option.value = language.id
    option.lang = language.id
    select.append(option)
  }
  select.value = localization.language
  select.onchange = () => {
    if (!isLanguage(select.value)) return
    localization.language = select.value
    document.documentElement.lang = select.value
    refreshTranslations(document.body)
    for (const picker of document.querySelectorAll<HTMLSelectElement>(".language-picker select")) picker.value = select.value
    try {
      localStorage.setItem(LANGUAGE_KEY, select.value)
    } catch (error) {
      console.warn("Could not save the language preference", error)
      toast("Could not save the language preference")
    }
  }
  label.append(globe, select)
  return label
}
