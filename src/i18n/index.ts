import { french } from "./fr.ts"

export const languages = [
  { id: "en", name: "English", messages: {} },
  { id: "fr", name: "Français", messages: french }
] as const
export type Language = (typeof languages)[number]["id"]
export const LANGUAGE_KEY = "inkline-town/language"

export const isLanguage = (value: string | null): value is Language => languages.some((language) => language.id === value)

export const detectLanguage = (saved: string | null, preferred: readonly string[]): Language => {
  if (isLanguage(saved)) return saved
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0]!
    if (isLanguage(base)) return base
  }
  return "en"
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const catalogue = (messages: Readonly<Record<string, string>>) => ({
  messages,
  patterns: Object.entries(messages)
    .filter(([source]) => /\{\d+(?::number)?\}/.test(source))
    .sort(([a], [b]) => b.replace(/\{\d+(?::number)?\}/g, "").length - a.replace(/\{\d+(?::number)?\}/g, "").length)
    .map(([source, target]) => ({
      regex: new RegExp(`^${source.split(/(\{\d+(?::number)?\})/).map((part) => /^\{\d+:number\}$/.test(part) ? "([+−-]?[\\d.,]+)" : /^\{\d+\}$/.test(part) ? "(.+?)" : escapeRegex(part)).join("")}$`, "s"),
      slots: [...source.matchAll(/\{(\d+)(?::number)?\}/g)].map((match) => match[1]!),
      target
    }))
})
const catalogues = new Map(languages.map((language) => [language.id, catalogue(language.messages)]))

/** Source-language messages stay in the simulation and saves; only their presentation is translated. */
export const translate = (message: string, language: Language): string => {
  if (language === "en" || !/[a-z]/i.test(message)) return message
  const { messages, patterns } = catalogues.get(language)!
  const exact = Object.hasOwn(messages, message) ? messages[message] : undefined
  if (exact !== undefined) return exact
  const trimmed = message.trim()
  if (trimmed !== message) return message.replace(trimmed, () => translate(trimmed, language))
  for (const { regex, slots, target } of patterns) {
    const match = regex.exec(message)
    if (!match) continue
    return target.replace(/\{(\d+)\}/g, (_, slot: string) => translate(match[slots.indexOf(slot) + 1]!, language))
  }
  // Composite readouts and tooltips join independent messages with these separators.
  for (const separator of ["\n", " · ", ": "]) {
    if (message.includes(separator)) return message.split(separator).map((piece) => translate(piece, language)).join(separator)
  }
  return message
}

/** Page-owned preference; it never enters a town snapshot. */
export const localization: { language: Language } = { language: "en" }
