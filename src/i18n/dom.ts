import { localization, translate } from "./index.ts"

interface Binding {
  text?: string
  html?: string
  attributes?: Map<string, string>
}
const bindings = new WeakMap<Node, Binding>()
const binding = (node: Node) => {
  let value = bindings.get(node)
  if (!value) {
    value = {}
    bindings.set(node, value)
  }
  return value
}
export const t = (source: string) => translate(source, localization.language)

export const setText = (node: Node, source: string) => {
  binding(node).text = source
  const text = t(source)
  if (node.textContent !== text) node.textContent = text
}

export const textNode = (source: string) => {
  const node = document.createTextNode("")
  setText(node, source)
  return node
}

export const setAttribute = (node: Element, name: string, source: string) => {
  const value = binding(node)
  value.attributes ??= new Map()
  value.attributes.set(name, source)
  const text = t(source)
  if (node.getAttribute(name) !== text) node.setAttribute(name, text)
}

export const setTitle = (node: HTMLElement, source: string) => setAttribute(node, "title", source)

const bindMarkup = (root: Node) => {
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) setText(node, node.textContent ?? "")
    if (node instanceof Element) {
      for (const name of ["title", "aria-label", "alt", "placeholder"]) {
        const value = node.getAttribute(name)
        if (value) setAttribute(node, name, value)
      }
    }
    for (const child of node.childNodes) visit(child)
  }
  for (const child of root.childNodes) visit(child)
}

export const setMarkup = (node: HTMLElement, source: string) => {
  const value = binding(node)
  if (value.html === source) return
  value.html = source
  node.innerHTML = source
  bindMarkup(node)
}

/** Replay only registered presentation bindings: identifiers, inputs and event handlers are untouched. */
export const refreshTranslations = (root: Node) => {
  const value = bindings.get(root)
  if (value?.text !== undefined) setText(root, value.text)
  if (root instanceof Element) {
    for (const [name, source] of value?.attributes ?? []) setAttribute(root, name, source)
  }
  for (const child of root.childNodes) refreshTranslations(child)
}
