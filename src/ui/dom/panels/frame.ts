/**
 * The side panel: the build menu, the town's panel, or what is picked. It is
 * built once for what it shows, and its numbers are refreshed in place every
 * frame (each part registers a `live` update), so nothing under the pointer
 * is replaced between press and release.
 */
import { kinds, type KindId } from "../../../game/content/index.ts"
import type { Edit } from "../../../game/edits.ts"
import type { Interaction, Panel, TownView } from "../../../view/contracts.ts"
import type { Controls } from "../controls.ts"
import { el } from "../kit/dom.ts"
import { iconEl } from "../kit/icons.ts"
import type { Pictures } from "../kit/picture.ts"
import { buildMenu } from "./build-menu.ts"
import { selectionPanel } from "./selection.ts"
import { townPanel, type TownHistory } from "./town.ts"

/** What a panel's parts are built with. */
export interface PanelParts {
  readonly town: TownView
  readonly ui: Interaction
  readonly send: (edit: Edit) => void
  readonly pictures: Pictures
  /** Registers an update to run every frame while this panel shows. */
  readonly live: (update: () => void) => void
  /** The panel's header: a picture or icon, the title and what goes under it, and the close button. */
  readonly header: (title: string, lead: HTMLElement, below?: HTMLElement) => HTMLElement
  readonly element: HTMLElement
}

export const createPanel = (
  ui: Interaction,
  town: TownView,
  send: (edit: Edit) => void,
  pictures: Pictures,
  history: TownHistory,
  controls: Pick<Controls, "refreshTools" | "place" | "layGround" | "furnish" | "useRef">
) => {
  const panel = el("aside", "panel")
  /** Volatile parts of the panel, updated in place without rebuilding it. */
  let live: Array<() => void> = []
  let shape = ""
  const header = (title: string, lead: HTMLElement, below?: HTMLElement) => {
    const head = el("header", "")
    const text = el("div", "title")
    text.append(el("h2", "", title))
    if (below) text.append(below)
    const closeButton = el("button", "close")
    closeButton.title = "Close (Esc)"
    closeButton.append(iconEl("close", 18))
    closeButton.onclick = () => {
      ui.selected = null
      ui.menu = null
      controls.refreshTools()
    }
    head.append(lead, text, closeButton)
    return head
  }
  const parts: PanelParts = { town, ui, send, pictures, live: (update) => live.push(update), header, element: panel }

  const build = (p: Panel) => {
    live = []
    panel.replaceChildren()
    if (p.type === "build") return buildMenu(parts, controls)
    if (p.type === "town") return townPanel(parts, history)
    selectionPanel(parts, p)
  }

  // A panel row's fix: place the building it names, or pick the tool or panel it names.
  panel.addEventListener("click", (event) => {
    const target = event.target as HTMLElement
    const tool = target.closest<HTMLElement>(".fix [data-tool]")
    if (tool) return controls.useRef(tool.dataset.tool!)
    const chosen = target.closest<HTMLElement>("[data-build], .fix [data-kind]")
    const kind = (chosen?.dataset.build ?? chosen?.dataset.kind) as KindId | undefined
    if (kind && kinds[kind].buildable) {
      ui.selected = null
      controls.place(kind)
    }
  })

  return {
    element: panel,
    /** Rebuilds the panel when what it shows changes, and refreshes its numbers every frame. */
    sync: () => {
      const p = town.panel
      const next =
        p === null
          ? ""
          : p.type === "build" || p.type === "town"
            ? p.type
            : `${p.type}|${p.id}|${p.type === "house" ? p.tier : p.type === "building" ? `${p.level}|${p.upgrade?.title ?? ""}|${p.works !== null}` : ""}`
      if (next !== shape) {
        shape = next
        // Keep the old contents while the closed panel slides away.
        if (p !== null) build(p)
        panel.classList.toggle("open", p !== null)
        document.body.classList.toggle("panel-open", p !== null)
        controls.refreshTools()
      }
      for (const update of live) update()
    }
  }
}
