/** The few DOM helpers every part of the page builds with. */

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

/**
 * Sets a node's markup only when it changed. Rewriting it every frame would
 * replace the element under the pointer between press and release, and the
 * browser then drops the click.
 */
export const setHtml = (node: HTMLElement, html: string) => {
  if (node.dataset.html === html) return
  node.dataset.html = html
  node.innerHTML = html
}

export const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`
