/**
 * Founding a town: the charter dialog. Pick the land's size, the term, and
 * its richness; the land is drawn small as it would be founded. On the way
 * in, a town saved in this browser can be carried on instead.
 */
import { defaultCharter, landIds, lands, sizeIds, sizes, TERMS, YEARS_PER_TERM, type CharterValue } from "../../../game/content/index.ts"
import type { Edit } from "../../../game/edits.ts"
import type { Catalog } from "../../../i18n/index.ts"
import { GRID } from "../../../game/world/iso.ts"
import { generate } from "../../../game/world/mapgen.ts"
import type { Interaction } from "../../../view/contracts.ts"
import type { IconName } from "../../../view/icons.ts"
import type { Controls } from "../controls.ts"
import { createCreditLine } from "../brand/credit.ts"
import { el, escapeHtml, setHtml } from "../kit/dom.ts"
import { icon } from "../kit/icons.ts"
import { section } from "../kit/section.ts"
import { ago, compose } from "../kit/text.ts"
import type { TownHistory } from "../panels/town.ts"

/**
 * `savedTown`: the newest town saved in this browser, which the first charter offers to carry on with.
 * `founded`: a town is about to be founded from the dialog (a visit to a shared town ends).
 * `languageButton`: makes the button that opens the language's menu: a new mayor meets this screen first, and
 * must be able to read it. It sits at the foot of the sheet, across from the maker's credit.
 */
export const createCharter = (
  t: Catalog,
  ui: Interaction,
  send: (edit: Edit) => void,
  load: () => { readonly loaded: boolean; readonly said: string },
  history: TownHistory,
  savedTown: { readonly title: string; readonly savedAt: number } | null,
  founded: () => void,
  languageButton: () => HTMLElement,
  controls: Pick<Controls, "toast" | "showReckoning" | "choose" | "setSpeed">
) => {
  const said = t.page.charter
  const dialog = el("div", "dialog")
  const choice: { -readonly [K in keyof CharterValue]: CharterValue[K] } = defaultCharter((Date.now() & 0x7fffffff) >>> 0)
  /** The land a charter would found, drawn small: a dot a cell. */
  const drawLand = (canvas: HTMLCanvasElement) => {
    const land = generate(choice)
    const water = new Set(land.water.map((c) => c.y * GRID + c.x))
    const trees = new Set(land.trees.map((t) => t.cell.y * GRID + t.cell.x))
    const rocks = new Map(land.rocks.map((r) => [r.cell.y * GRID + r.cell.x, r.ore]))
    const scale = 3
    canvas.width = GRID * scale
    canvas.height = GRID * scale
    const g = canvas.getContext("2d")!
    g.clearRect(0, 0, canvas.width, canvas.height)
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const k = y * GRID + x
        if (land.mask[k] !== "1") continue
        g.fillStyle = water.has(k)
          ? "#b9cfcb"
          : trees.has(k)
            ? "#9bb08a"
            : rocks.has(k)
              ? rocks.get(k)
                ? "#5a6479"
                : "#8f9891"
              : "#f7f8f4"
        g.fillRect(x * scale, y * scale, scale, scale)
      }
    }
    return land
  }
  const openCharter = (cancellable: boolean) => {
    ui.founding = true
    dialog.replaceChildren()
    const card = el("div", "sheet wide")
    const title = el("h2", "title", "Inkline Town ")
    const by = el("small", "by", `${said.by} `)
    const author = el("a", "", "Sandro Maglione") as HTMLAnchorElement
    author.href = "https://www.sandromaglione.com/"
    author.target = "_blank"
    author.rel = "noopener"
    by.append(author)
    title.append(by)
    card.append(title, el("p", "sub", said.sub))
    const body = el("div", "charter")
    const options = el("div", "")
    const preview = el("div", "preview")
    const mapBox = el("div", "map")
    const map = document.createElement("canvas")
    mapBox.append(map)
    const facts = el("p", "note facts")
    const cells = el("span", "ref ware cells")
    mapBox.append(cells)
    preview.append(mapBox, facts)
    body.append(options, preview)
    /** A figure of the charter as the town's messages name things: an icon and a few words. */
    const chip = (glyph: IconName, text: string) => `<span class="ref ware">${icon(glyph, 13)}${escapeHtml(text)}</span>`
    const group = <T extends string | number>(
      title: string,
      glyph: IconName,
      values: ReadonlyArray<T>,
      label: (v: T) => string,
      note: (v: T) => string,
      tip: (v: T) => string,
      get: () => T,
      set: (v: T) => void
    ) => {
      const box = section(t, title, glyph)
      const row = el("div", "choices")
      const under = el("p", "note")
      const buttons = values.map((v) => {
        const b = el("button", "frame choice", label(v))
        b.title = tip(v)
        b.onclick = () => {
          set(v)
          refresh()
        }
        row.append(b)
        return { v, b }
      })
      box.append(row, under)
      options.append(box)
      return () => {
        for (const { v, b } of buttons) b.classList.toggle("on", v === get())
        setHtml(under, note(get()))
      }
    }
    const refreshers = [
      group(
        said.land.title,
        "pave",
        sizeIds,
        (v) => t.size(v),
        (v) => compose(said.land.note, chip("people", said.land.residents(sizes[v].goal.residents)), chip("coins", said.land.income(sizes[v].goal.income))),
        (v) => said.land.tip(sizes[v].goal.residents, sizes[v].goal.income),
        () => choice.size,
        (v) => (choice.size = v)
      ),
      group(
        said.term.title,
        "clock",
        TERMS,
        (v) => said.term.label(v),
        (v) => `${chip("clock", said.term.years(YEARS_PER_TERM, Number((v / YEARS_PER_TERM).toFixed(1))))}${chip("winter", said.term.winters(YEARS_PER_TERM - 1))}`,
        (v) => said.term.tip(v, YEARS_PER_TERM),
        () => choice.term,
        (v) => (choice.term = v)
      ),
      group(
        said.richness.title,
        "wood",
        landIds,
        (v) => t.land.name(v),
        (v) => chip("coins", said.richness.coins(lands[v].coins)),
        (v) => t.land.blurb(v),
        () => choice.land,
        (v) => (choice.land = v)
      )
    ]
    // The land is drawn from a seed: a fresh one on a click; the number itself only on hover, for whoever wants it.
    const reroll = el("button", "frame reroll", said.reroll)
    reroll.onclick = () => {
      choice.seed = (Math.random() * 0x7fffffff) >>> 0
      refresh()
    }
    mapBox.append(reroll)
    const refresh = () => {
      for (const r of refreshers) r()
      const land = drawLand(map)
      reroll.title = said.rerollTitle(choice.seed)
      const rocks = land.rocks.filter((r) => !r.ore).length
      setHtml(cells, `${icon("pave", 13)}${escapeHtml(said.cells(land.cells))}`)
      setHtml(facts, chip("wood", said.trees(land.trees.length)) + chip("stone", said.stone(rocks)) + chip("ore", said.ore(land.rocks.length - rocks)))
    }
    refresh()
    const actions = el("div", "actions")
    const found = el("button", "frame primary", said.start)
    found.onclick = () => {
      founded()
      send({ type: "newTown", charter: { ...choice } })
      history.clear()
      ui.selected = null
      ui.menu = null
      closeCharter()
      controls.showReckoning(false)
      controls.choose("select")
      controls.setSpeed(1)
    }
    actions.append(found)
    // On the way in, a town saved in this browser: carry on with it instead.
    if (!cancellable && savedTown) {
      const saved = savedTown
      const resume = el("button", "frame", said.resume)
      resume.title = said.resumeTitle(saved.title, saved.savedAt > 0 ? ago(t, saved.savedAt) : null)
      resume.onclick = () => void carryOn()
      actions.append(resume)
    }
    if (cancellable) {
      const cancel = el("button", "frame", t.page.common.cancel)
      cancel.onclick = () => closeCharter()
      actions.append(cancel)
    }
    card.append(body, actions, createCreditLine(t, languageButton()))
    dialog.append(card)
    dialog.classList.add("open")
  }
  const closeCharter = () => {
    ui.founding = false
    dialog.classList.remove("open")
  }
  /** Carries on with the town saved last instead of founding one: says how the load went, and whether there is a town to play. */
  const carryOn = (): boolean => {
    const result = load()
    controls.toast(result.said)
    if (!result.loaded) return false
    history.clear()
    ui.selected = null
    ui.menu = null
    closeCharter()
    controls.choose("select")
    controls.setSpeed(1)
    return true
  }
  return { element: dialog, open: openCharter, close: closeCharter, carryOn }
}
