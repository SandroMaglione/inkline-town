/**
 * The maker's credit: the Typeonce pixel lockup, a link to typeonce.games,
 * and "Made with ritmo", a link to the GitHub repository of the ECS runtime
 * the town is built on. Two places carry it, both out of the way of play:
 *
 * - `corner`: a small, pale note just above the system bar in the bottom
 *   right, quieter than the town's own cards. It rides with the bar, never
 *   asks for anything, and steps aside while the panel is open and on a phone.
 * - `line`: a footer along the bottom of the charter and the reckoning, the two
 *   moments the town is waiting anyway.
 *
 * The sign-up for news of the next game (`signup.ts`) wears the same mark
 * (`createMark`), so the two read as one studio.
 *
 * Every link is a real `<a>` that opens a new tab, so the town is never left.
 * While that tab is in front the town's frames stop (the loop clamps a frame to
 * a quarter of a second), so the term does not run on while the mayor is away.
 */
import type { Catalog } from "../../../i18n/index.ts"
import { PIXEL_LETTERS, PIXEL_MARK_32, PIXEL_WORDMARK } from "./pixel-mark.ts"

/** The home of the maker's games. */
export const typeonceSite = "https://typeonce.games"
/** The ECS runtime the simulation runs on: its GitHub repository. */
export const ritmoSite = "https://github.com/typeonce-dev/ritmo"

// The brand's own layout: the letters' x-height starts on row 13 of the 32 px
// mark, two pixels after the mark and two between letters.
const MARK_SIZE = 32
const MARK_TO_TEXT = 2
const LETTER_GAP = 2
const TEXT_TOP = 13

/** The filled runs of one row of pixel art, as path commands at (`x`, `y`). */
const rowPath = (row: string, x: number, y: number): string => {
  let path = ""
  for (let from = 0; from < row.length; from++) {
    if (row[from] !== "#") continue
    let to = from
    while (row[to + 1] === "#") to++
    path += `M${x + from} ${y}h${to - from + 1}v1h${-(to - from + 1)}z`
    from = to
  }
  return path
}
const art = (rows: ReadonlyArray<string>, x: number, y: number): string => rows.map((row, i) => rowPath(row, x, y + i)).join("")

let letterX = MARK_SIZE + MARK_TO_TEXT
const letters = PIXEL_WORDMARK.map((letter) => {
  const rows = PIXEL_LETTERS[letter]
  const path = art(rows, letterX, TEXT_TOP)
  letterX += (rows[0]?.length ?? 0) + LETTER_GAP
  return path
}).join("")
const lockupWidth = letterX - LETTER_GAP
const lockupPath = art(PIXEL_MARK_32, 0, 0) + letters

/** An arrow pointing up and out, in the lockup's own pixels. */
const ARROW = ["..#####", "..#####", "....###", "...####", "..##.##", ".##....", "##....."]
const arrowPath = art(ARROW, 0, 0)

const svg = (path: string, width: number, height: number, size: number, className: string): SVGSVGElement => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  node.setAttribute("viewBox", `0 0 ${width} ${height}`)
  node.setAttribute("width", String((size * width) / height))
  node.setAttribute("height", String(size))
  node.setAttribute("shape-rendering", "crispEdges")
  node.setAttribute("aria-hidden", "true")
  node.classList.add(className)
  const fill = document.createElementNS("http://www.w3.org/2000/svg", "path")
  fill.setAttribute("d", path)
  fill.setAttribute("fill", "currentColor")
  node.append(fill)
  return node
}

const link = (t: Catalog, href: string, label: string, ...content: Array<Node>): HTMLAnchorElement => {
  const a = document.createElement("a")
  a.href = href
  a.target = "_blank"
  a.rel = "noopener"
  a.setAttribute("aria-label", t.page.credit.newTab(label))
  a.append(...content)
  // The keys belong to the town again as soon as the link has been used.
  a.addEventListener("click", () => a.blur())
  return a
}

const text = (className: string, value: string): HTMLSpanElement => {
  const span = document.createElement("span")
  span.className = className
  span.textContent = value
  return span
}

/** The two links, `lockup` CSS pixels tall for the mark. The names (Typeonce, ritmo) are names: only what is said around them is the language's. */
const links = (t: Catalog, lockup: number): Array<Node> => [
  link(t, typeonceSite, t.page.credit.typeonce, svg(lockupPath, lockupWidth, MARK_SIZE, lockup, "lockup")),
  text("dot", "·"),
  link(t, ritmoSite, t.page.credit.ritmo, text("what", t.page.credit.madeWith), text("name", "ritmo"), svg(arrowPath, ARROW.length, ARROW.length, 7, "arrow"))
]

/** The Typeonce mark alone, `size` CSS pixels square: the lockup's own pixels. */
export const createMark = (size: number): SVGSVGElement => svg(art(PIXEL_MARK_32, 0, 0), MARK_SIZE, MARK_SIZE, size, "mark")

/** The note in the bottom-right corner. */
export const createCreditCorner = (t: Catalog): HTMLElement => {
  const note = document.createElement("nav")
  note.className = "credit corner"
  note.setAttribute("aria-label", t.page.credit.madeBy)
  note.append(...links(t, 16))
  return note
}

/** The footer of a dialog. */
export const createCreditLine = (t: Catalog): HTMLElement => {
  const line = document.createElement("footer")
  line.className = "credit line"
  line.append(...links(t, 16))
  return line
}
