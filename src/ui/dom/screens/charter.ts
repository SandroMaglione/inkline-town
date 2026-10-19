/**
 * Founding a town: the charter dialog. Pick the land's size, the term, and
 * its richness; the land is drawn small as it would be founded. On the way
 * in, a town saved in this browser can be carried on instead.
 */
import { defaultCharter, landIds, lands, sizeIds, sizes, TERMS, YEARS_PER_TERM, type CharterValue } from "../../../game/content/index.ts"
import type { Edit } from "../../../game/edits.ts"
import { GRID } from "../../../game/world/iso.ts"
import { generate } from "../../../game/world/mapgen.ts"
import type { Interaction } from "../../../view/contracts.ts"
import type { IconName } from "../../../view/icons.ts"
import type { Controls } from "../controls.ts"
import { el, escapeHtml, setHtml } from "../kit/dom.ts"
import { icon } from "../kit/icons.ts"
import { section } from "../kit/section.ts"
import { ago } from "../kit/text.ts"
import type { TownHistory } from "../panels/town.ts"

/**
 * `savedTown`: the newest town saved in this browser, which the first charter offers to carry on with.
 * `founded`: a town is about to be founded from the dialog (a visit to a shared town ends).
 */
export const createCharter = (
  ui: Interaction,
  send: (edit: Edit) => void,
  load: () => string | null,
  history: TownHistory,
  savedTown: { readonly title: string; readonly savedAt: number } | null,
  founded: () => void,
  controls: Pick<Controls, "toast" | "showReckoning" | "choose" | "setSpeed">
) => {
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
    const by = el("small", "by", "by ")
    const author = el("a", "", "Sandro Maglione") as HTMLAnchorElement
    author.href = "https://www.sandromaglione.com/"
    author.target = "_blank"
    author.rel = "noopener"
    by.append(author)
    title.append(by)
    card.append(title, el("p", "sub", "Pick the land, then grow the town to its goal before the term runs out."))
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
      const box = section(title, glyph)
      const row = el("div", "choices")
      const said = el("p", "note")
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
      box.append(row, said)
      options.append(box)
      return () => {
        for (const { v, b } of buttons) b.classList.toggle("on", v === get())
        setHtml(said, note(get()))
      }
    }
    const refreshers = [
      group(
        "land",
        "pave",
        sizeIds,
        (v) => sizes[v].title,
        (v) => `a town at ${chip("people", `${sizes[v].goal.residents} residents`)}${chip("coins", `+${sizes[v].goal.income}/min`)}`,
        (v) => `The town rank asks ${sizes[v].goal.residents} residents and an income of ${sizes[v].goal.income} coins a minute; a village less, a city more`,
        () => choice.size,
        (v) => (choice.size = v)
      ),
      group(
        "term",
        "clock",
        TERMS,
        (v) => `${v} min`,
        (v) => `${chip("clock", `${YEARS_PER_TERM} years of ${Number((v / YEARS_PER_TERM).toFixed(1))} min`)}${chip("winter", `${YEARS_PER_TERM - 1} winters`)}`,
        (v) => `${v} minutes at 1×: ${YEARS_PER_TERM} years, a winter at the end of each after the first`,
        () => choice.term,
        (v) => (choice.term = v)
      ),
      group(
        "richness",
        "wood",
        landIds,
        (v) => lands[v].title,
        (v) => chip("coins", `${lands[v].coins} coins to start`),
        (v) => lands[v].blurb,
        () => choice.land,
        (v) => (choice.land = v)
      )
    ]
    // The land is drawn from a seed: a fresh one on a click; the number itself only on hover, for whoever wants it.
    const reroll = el("button", "frame reroll", "↻ other land")
    reroll.onclick = () => {
      choice.seed = (Math.random() * 0x7fffffff) >>> 0
      refresh()
    }
    mapBox.append(reroll)
    const refresh = () => {
      for (const r of refreshers) r()
      const land = drawLand(map)
      reroll.title = `Draw other land (this is seed ${choice.seed})`
      const rocks = land.rocks.filter((r) => !r.ore).length
      setHtml(cells, `${icon("pave", 13)}${land.cells} cells`)
      setHtml(facts, chip("wood", `${land.trees.length} trees`) + chip("stone", `${rocks} stone`) + chip("ore", `${land.rocks.length - rocks} ore`))
    }
    refresh()
    const actions = el("div", "actions")
    const found = el("button", "frame primary", "Start new")
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
      const resume = el("button", "frame", "Continue saved")
      resume.title = `Carry on with the town saved in this browser: ${saved.title}${saved.savedAt > 0 ? `, saved ${ago(saved.savedAt)}` : ""}`
      resume.onclick = () => {
        const said = load() ?? "Loaded"
        controls.toast(said)
        if (!said.startsWith("Loaded")) return
        history.clear()
        ui.selected = null
        ui.menu = null
        closeCharter()
        controls.choose("select")
        controls.setSpeed(1)
      }
      actions.append(resume)
    }
    if (cancellable) {
      const cancel = el("button", "frame", "Cancel")
      cancel.onclick = () => closeCharter()
      actions.append(cancel)
    }
    card.append(body, actions)
    dialog.append(card)
    dialog.classList.add("open")
  }
  const closeCharter = () => {
    ui.founding = false
    dialog.classList.remove("open")
  }
  return { element: dialog, open: openCharter, close: closeCharter }
}
