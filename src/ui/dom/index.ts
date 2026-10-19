/**
 * The page's UI: one way to show the town, on the DOM. It reads what the
 * view shows (`TownView`), writes what the player does with the map
 * (`Interaction`), and sends edits; it knows nothing of how the map is drawn,
 * only the narrow `MapPort` the app hands it. This module composes the parts
 * and wires the page's controls (`controls.ts`) to them.
 */
import { defaultCharter, grounds, kinds, props, type GroundId, type KindId, type PropId } from "../../game/content/index.ts"
import type { Edit } from "../../game/edits.ts"
import type { Point } from "../../game/world/iso.ts"
import type { Interaction, Shown, Tool, View } from "../../view/contracts.ts"
import { commands, refOf } from "../../view/tools.ts"
import type { Controls } from "./controls.ts"
import { createFolds, phone } from "./folds.ts"
import { createHud } from "./hud.ts"
import { bindKeys } from "./keys.ts"
import { el, escapeHtml, setHtml } from "./kit/dom.ts"
import { iconEl } from "./kit/icons.ts"
import type { Pictures } from "./kit/picture.ts"
import { iconize, touchScreen } from "./kit/text.ts"
import { createMapViews } from "./map-views.ts"
import { createPanel } from "./panels/frame.ts"
import { townHistory } from "./panels/town.ts"
import { createCharter } from "./screens/charter.ts"
import { createConfirm } from "./screens/confirm.ts"
import { createReckoning } from "./screens/reckoning.ts"
import { createShare } from "./screens/share.ts"
import { createVisit } from "./screens/visit.ts"
import { createSystemMenu } from "./system-menu.ts"
import { createTicker } from "./ticker.ts"
import { createToast } from "./toast.ts"
import { createToolbar } from "./toolbar.ts"

export interface Persistence<Camera> {
  readonly save: () => string | null
  readonly load: () => string | null
  /** The town as a save file (as text), with where the camera stands, to share. */
  readonly shareFile: (camera: Camera) => string
}

/** What the page needs of the map, whatever draws it. */
export interface MapPort<Camera> {
  /** The element the map is drawn in: a tap on it folds a phone's HUD and puts a toast away. */
  readonly surface: HTMLElement
  readonly focus: (x: number, y: number) => void
  readonly resetCamera: () => void
  readonly camera: () => Camera
  readonly picture: (width: number, height: number, scale: number) => HTMLCanvasElement
  /** Where the pointer is on the screen, for the tooltip; `null` off the map. */
  readonly pointer: () => Point | null
  /** A touch stroke let go of and held: lay it, or drop it. */
  readonly confirmStroke: () => void
  readonly cancelStroke: () => void
  /** Puts the map input back as it starts: no stroke, the camera's mode reset. */
  readonly reset: () => void
  /** Follows the tool once a frame (the cursor, a held stroke). */
  readonly sync: () => void
}

/**
 * `shared`: the page opened on a shared town's link, so it loads that rather than asking for a charter.
 * `saved`: the newest town saved in this browser, which the first charter offers to carry on with.
 */
export const createDomUi = <Camera>(
  view: { readonly interaction: Interaction; readonly shown: Shown; readonly send: (edit: Edit) => void },
  map: MapPort<Camera>,
  pictures: Pictures,
  persistence: () => Persistence<Camera>,
  options: { readonly shared?: boolean; readonly saved?: { readonly title: string; readonly savedAt: number } | null } = {}
) => {
  const ui = view.interaction
  const town = view.shown.town
  const send = view.send
  const stats = () => town.stats

  // The page's controls, carried out by the parts below once they exist.
  let lastSpeed = 1
  const controls: Controls = {
    toast: (message) => toast.show(message),
    choose: (tool: Tool) => {
      ui.tool = tool
      ui.dragFrom = null
      if (tool !== "place") ui.placing = null
      if (tool !== "upgrade") ui.upgrading = null
      if (tool !== "select") ui.selected = null
      controls.refreshTools()
    },
    toggleMenu: (menu) => {
      folds.setFold(null)
      ui.menu = ui.menu === menu ? null : menu
      if (ui.menu) ui.selected = null
      controls.refreshTools()
    },
    place: (kind: KindId) => {
      ui.placing = kind
      ui.menu = null
      controls.choose("place")
      const title = kinds[kind].title.toLowerCase()
      controls.toast(touchScreen() ? `Tap a spot for the ${title}, then tap it again to build it` : `Click to place a ${title} · Esc to stop`)
    },
    layGround: (ground: GroundId) => {
      ui.ground = ground
      ui.menu = null
      controls.choose("ground")
      const title = grounds[ground].title.toLowerCase()
      controls.toast(touchScreen() ? `Drag a rectangle to lay ${title}, then tap Build` : `Drag a rectangle to lay ${title} · Esc to stop`)
    },
    furnish: (prop: PropId) => {
      ui.prop = prop
      ui.menu = null
      controls.choose("prop")
      const title = props[prop].title.toLowerCase()
      controls.toast(touchScreen() ? `Tap a cell of park for the ${title}, then tap it again to set it` : `Click a cell of park to set a ${title} · Esc to stop`)
    },
    setSpeed: (speed) => {
      if (speed > 0) lastSpeed = speed
      ui.speed = speed
      toolbar.showSpeed(speed, lastSpeed)
    },
    togglePause: () => controls.setSpeed(ui.speed === 0 ? lastSpeed : 0),
    cycleSpeed: () => controls.setSpeed(ui.speed === 0 ? lastSpeed : ui.speed === 4 ? 1 : ui.speed * 2),
    setView: (shown: View) => {
      ui.view = shown
      mapViews.show(shown)
      // On a phone the list folds away once one is chosen, so the map shows.
      if (folds.fold() === "views") folds.setFold(null)
      layersButton.classList.toggle("on", shown !== "none")
    },
    setFold: (fold) => folds.setFold(fold),
    toggleFold: (fold) => folds.toggleFold(fold),
    goTo: (at, size, id) => {
      folds.setFold(null)
      map.focus(at.x + size / 2, at.y + size / 2)
      ui.flash = { cell: { x: at.x, y: at.y }, size, until: Date.now() + 4000 }
      if (id !== null) {
        ui.selected = id
        ui.menu = null
        controls.refreshTools()
      }
    },
    useRef: (name) => {
      folds.setFold(null)
      const ref = refOf(name)
      if (!ref) return
      if ("view" in ref) return controls.setView(ui.view === ref.view ? "none" : ref.view)
      const action = commands[ref.command].action
      if ("menu" in action) return ui.menu === action.menu ? undefined : controls.toggleMenu(action.menu)
      if ("clock" in action) return action.clock === "speed" ? controls.cycleSpeed() : controls.togglePause()
      ui.menu = null
      controls.choose(action.tool)
    },
    refreshTools: () => toolbar.refresh(),
    openCharter: (cancellable) => charter.open(cancellable),
    openShare: () => void share.open(),
    showReckoning: (open) => reckoning.show(open),
    confirmLeave: (title, text, go, run) => confirm.ask(title, text, go, run)
  }

  const toast = createToast()
  const history = townHistory(stats)
  const ticker = createTicker(ui, () => folds.fold(), controls)
  const hud = createHud(ticker.element, send, stats, controls)
  const toolbar = createToolbar(ui, controls)
  const mapViews = createMapViews(ui, controls)
  const panel = createPanel(ui, town, send, pictures, history, controls)
  const confirm = createConfirm(() => persistence().save(), () => ui.speed, controls)
  const reckoning = createReckoning(ui, stats, send, controls)
  const visit = createVisit({ ...controls, closeCharter: () => charter.close(), resetPage: () => resetPage() })
  const charter = createCharter(ui, send, () => persistence().load(), history, options.saved ?? null, () => {
    if (visit.visiting()) visit.endVisit()
  }, controls)
  const share = createShare(stats, () => ui.speed, visit.visiting, map, (camera) => persistence().shareFile(camera), controls)
  const tooltip = el("div", "tooltip")
  // A phone's buttons for what stays folded away: the guide and the map views.
  const foldButtons = el("div", "fold-buttons")
  const layersButton = el("button", "card")
  layersButton.title = "Map overlays"
  layersButton.append(iconEl("layers", 16))
  layersButton.onclick = () => folds.toggleFold("views")
  foldButtons.append(ticker.bulb, layersButton)
  const folds = createFolds(ui, { goods: hud.goodsChip, guide: ticker.bulb, views: layersButton, more: toolbar.moreButton }, ticker.element, () => {
    ui.menu = null
    ui.selected = null
    controls.refreshTools()
  })
  const system = createSystemMenu(ui, persistence, map.resetCamera, folds.fold, controls)
  document.body.append(
    hud.left, hud.right, tooltip, toast.element, toolbar.element, system.element, panel.element, reckoning.result, charter.element, confirm.element,
    reckoning.element, share.element, visit.element, mapViews.list, mapViews.legend, foldButtons
  )

  // A tap on the map folds the HUD and puts a toast away; a pan or a pinch, to look around with the goods or the guide open, does not.
  let mapPress: { id: number; x: number; y: number; moved: boolean } | null = null
  map.surface.addEventListener("pointerdown", (e) => {
    mapPress = mapPress === null && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false } : null
  })
  map.surface.addEventListener("pointermove", (e) => {
    if (mapPress?.id === e.pointerId && Math.hypot(e.clientX - mapPress.x, e.clientY - mapPress.y) > 8) mapPress.moved = true
  })
  map.surface.addEventListener("pointerup", (e) => {
    if (mapPress?.id === e.pointerId && !mapPress.moved) toast.tapped()
    if (mapPress?.id === e.pointerId && !mapPress.moved && folds.fold() !== null) folds.setFold(null)
    if (mapPress?.id === e.pointerId) mapPress = null
  })
  map.surface.addEventListener("pointercancel", () => (mapPress = null))
  hud.placeFolk()
  phone.addEventListener("change", hud.placeFolk)

  // A town is founded behind the dialog, so there is land to look at while choosing.
  ui.founding = true
  send({ type: "newTown", charter: defaultCharter((Date.now() & 0x7fffffff) >>> 0) })
  controls.setSpeed(1)
  controls.choose("select")
  bindKeys(
    ui,
    {
      escape: () => {
        if (confirm.open()) confirm.dismiss()
        if (share.isOpen()) share.close()
      },
      blocked: () => ui.founding || reckoning.isOpen() || confirm.open() || share.isOpen() || visit.visiting()
    },
    map.cancelStroke,
    controls
  )
  if (!options.shared) charter.open(false)

  // A road, a row of homes, or a patch of park let go of on a touch screen is held here until built or
  // dropped; the tooltip says what it lays and costs.
  const strokeBar = el("div", "stroke-bar")
  const strokeBuild = el("button", "primary", "Build")
  strokeBuild.onclick = () => map.confirmStroke()
  const strokeDrop = el("button", "", "Cancel")
  strokeDrop.onclick = () => map.cancelStroke()
  strokeBar.append(strokeDrop, strokeBuild)
  document.body.append(strokeBar)

  const resetPage = () => {
    controls.choose("select")
    ui.menu = null
    ui.selected = null
    map.reset()
  }

  /** Copies the town's numbers and preview into the page, once a frame. */
  const syncPage = () => {
    for (const message of town.toasts.splice(0)) toast.show(message)
    panel.sync()
    const s = town.stats
    if (s) {
      hud.update(s, ui.speed, folds.fold())
      ticker.update(s)
      system.update(s)
      mapViews.showLegend(town.legend)
      reckoning.sync(s)
    }
    map.sync()
    const screenPointer = map.pointer()
    // A stroke being drawn says what it lays and costs.
    const text = ui.dragFrom && ui.stroke !== "cancel" && town.stroke ? town.stroke : town.tooltip
    // A held touch stroke waits for its build button.
    const held = ui.stroke === "held" && town.stroke !== null
    strokeBar.classList.toggle("open", held)
    document.body.classList.toggle("stroke-held", held)
    if (text && screenPointer) {
      setHtml(tooltip, iconize(escapeHtml(text)))
      tooltip.style.display = "block"
      tooltip.style.left = `${Math.min(screenPointer.x, window.innerWidth - tooltip.offsetWidth - 20)}px`
      tooltip.style.top = `${screenPointer.y}px`
    } else tooltip.style.display = "none"
  }

  return {
    syncPage,
    resetPage,
    toast: controls.toast,
    visit: visit.visit,
    visitFailed: visit.visitFailed,
    visiting: visit.visiting,
    /** A dialog is open over the map: the keyboard is not the map's. */
    blocked: () => document.querySelector(".dialog.open") !== null
  }
}
