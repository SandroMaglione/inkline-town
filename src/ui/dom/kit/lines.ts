/**
 * The view's lines (see `Line`) as rows: what on the left, its value on the
 * right, any goods as chips, a note underneath, and what to do about it.
 */
import { goods, kinds } from "../../../game/content/index.ts"
import type { Line } from "../../../view/contracts.ts"
import { el, escapeHtml } from "./dom.ts"
import { goodIcon, icon, iconEl } from "./icons.ts"
import { thumb, type Pictures } from "./picture.ts"
import { callouts, iconize } from "./text.ts"

/** A line of a description as a row: its icon and what it is about, its value, any goods as chips, and a note underneath saying why. */
export const renderLine = (pictures: Pictures, row: HTMLElement, l: Line) => {
  // Every row the same way: what on the left, its value on the right, any note under both.
  row.className = `line ${l.tone ?? ""}`
  const chips = l.goods ? `<span class="chips">${l.goods.map((g) => `<span class="chip" title="${goods[g.good].title}">${goodIcon(g.good, 14)}${g.count}</span>`).join("")}</span>` : ""
  // Goods take the value's place: chips on the right.
  row.innerHTML = `<span class="mark">${icon(l.icon, 16)}</span><span class="what"></span>${chips || `<span class="count"></span>`}${l.note ? `<small class="note"></small>` : ""}`
  row.querySelector<HTMLElement>(".what")!.textContent = l.label
  if (!chips) row.querySelector<HTMLElement>(".count")!.innerHTML = iconize(escapeHtml(l.value ?? ""))
  if (l.note) row.querySelector<HTMLElement>(".note")!.innerHTML = iconize(escapeHtml(l.note))
  // What to do about it, on a row of its own: a building to place shows its picture, and the row places one.
  if (l.fix) {
    const build = l.fix.build && kinds[l.fix.build].buildable ? l.fix.build : undefined
    const fix = el(build ? "button" : "div", "fix")
    if (build) {
      fix.dataset.build = build
      fix.title = `Build a ${kinds[build].title.toLowerCase()}`
      fix.append(thumb(pictures, build))
    } else fix.append(iconEl("hint", 14))
    const text = el("span", "do")
    text.innerHTML = iconize(callouts(l.fix.text))
    fix.append(text)
    row.append(fix)
  }
}

/** Keeps a box of rows in step with its lines, touching only the rows that changed. */
export const syncLines = (pictures: Pictures, box: HTMLElement, rows: Array<HTMLElement>, lines: ReadonlyArray<Line>) => {
  while (rows.length < lines.length) {
    const line = el("div", "line")
    rows.push(line)
    box.append(line)
  }
  rows.forEach((row, i) => {
    const l = lines[i]
    const text = l ? JSON.stringify(l) : ""
    if (row.dataset.text === text) return
    row.dataset.text = text
    row.style.display = l ? "" : "none"
    if (l) renderLine(pictures, row, l)
  })
}
