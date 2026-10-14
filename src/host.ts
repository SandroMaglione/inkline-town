/**
 * The page around the town: the 3D scene, camera and pointer gestures, and the
 * top bar, toolbar, build menu, panel, tooltip, and toasts; the dialog a new
 * town is founded from, and the reckoning at the end of its term.
 */
import { Application, Graphics } from "pixi.js"

import { drawBuilding, drawHouse, drawParkPiece, homeVariant, plate, plateHalf } from "./art.ts"
import {
  categoryColor,
  categoryOrder,
  costText,
  defaultCharter,
  goodIds,
  goods,
  groundIds,
  grounds,
  home,
  kindOrder,
  park as parkRules,
  propIds,
  props,
  PAVE_COST,
  PAVED_PACE,
  tierHome,
  winters,
  kinds,
  landIds,
  lands,
  mood as moodRules,
  needTitle,
  LEDGER_TICKS,
  RESERVE_MAX,
  STEP_SECONDS,
  TRADE_LOAD,
  ROAD_COST,
  sizeIds,
  sizes,
  TAX_STEPS,
  TERMS,
  type Category,
  type CharterValue,
  type GoodId,
  type GroundId,
  type Kind,
  type KindId,
  type ParkPiece,
  type PropId,
  type Tier
} from "./content.ts"
import { GRID } from "./iso.ts"
import { goodIcon, icon, iconEl, type IconName } from "./icons.ts"
import { generate } from "./mapgen.ts"
import { askOf, priceOf } from "./sim/index.ts"
import type { Line, Stats, Tool, TradeMode, UiValue, View } from "./ui.ts"
import { emptyPreview } from "./ui.ts"
import { GameScene, type CameraView } from "./render3d/scene.ts"
import { blobOf, cardFacts, drawCard, metaOf, scaled, verdictOf } from "./share/card.ts"
import { handheld, offerLink, offerPicture, upload } from "./share/client.ts"
import { PICTURE_HEIGHT, PICTURE_QUALITY, PICTURE_WIDTH } from "./share/format.ts"
import { MapInput } from "./render3d/input.ts"

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") => {
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
const setHtml = (node: HTMLElement, html: string) => {
  if (node.dataset.html === html) return
  node.dataset.html = html
  node.innerHTML = html
}
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Words in the town's messages that name a building or a good, longest first, so "smoked fish" wins over "fish". */
const namedThings: ReadonlyArray<{ readonly word: string; readonly ref: { readonly kind: KindId } | { readonly good: GoodId } }> = [
  ...kindOrder.flatMap((id) => {
    const title = kinds[id].title.toLowerCase()
    return [title, `${title}s`].map((word) => ({ word, ref: { kind: id } }))
  }),
  ...goodIds.map((id) => ({ word: goods[id].title, ref: { good: id } })),
  { word: "loaves", ref: { good: "bread" as GoodId } },
  { word: "loaf", ref: { good: "bread" as GoodId } }
].sort((a, b) => b.word.length - a.word.length)
const namedPattern = new RegExp(`\\b(${namedThings.map((t) => t.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b|\\(([A-Z])\\)`, "gi")

/**
 * A message as markup: each building it names becomes a chip to click (to
 * build one), each good a chip with its icon, and each key in brackets a key.
 */
/** `standing`: buildings the line is about, which stand already; their chips go to them rather than placing another. */
const callouts = (text: string, standing: ReadonlySet<KindId> = new Set()): string =>
  escapeHtml(text).replace(namedPattern, (match, word: string | undefined, key: string | undefined) => {
    if (key) return `<kbd class="key">${key}</kbd>`
    const thing = namedThings.find((t) => t.word === word!.toLowerCase())
    if (!thing) return match
    if ("good" in thing.ref) return `<span class="ref ware" title="${goods[thing.ref.good].title}">${goodIcon(thing.ref.good, 13)}${match}</span>`
    const kind = kinds[thing.ref.kind]
    if (standing.has(thing.ref.kind)) return `<button class="ref kind go" data-go="${thing.ref.kind}" title="Go to the ${kind.title.toLowerCase()}">${icon("locate", 13)}${match}</button>`
    return kind.buildable
      ? `<button class="ref kind" data-kind="${thing.ref.kind}" title="Build a ${kind.title.toLowerCase()}: ${escapeHtml(kind.blurb)}">${icon("build", 13)}${match}</button>`
      : `<span class="ref kind" title="${escapeHtml(kind.blurb)}">${icon("town", 13)}${match}</span>`
  })

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`
/** Seconds as m:ss. */
const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

export interface Persistence {
  readonly save: () => string | null
  readonly load: () => string | null
  /** The town as a save file (as text), with where the camera stands, to share. */
  readonly shareFile: (camera: CameraView) => string
}

/** `shared`: the page opened on a shared town's link, so it loads that rather than asking for a charter. */
export const createHost = async (mount: HTMLElement, persistence: () => Persistence, options: { readonly shared?: boolean } = {}) => {
  const app = new Application()
  // Pixi remains an offscreen thumbnail renderer for the unchanged menus.
  await app.init({ width: 64, height: 64, antialias: true, resolution: 2, autoStart: false, backgroundAlpha: 0 })
  app.stop()
  const stage = new GameScene(mount)

  // ── DOM ──
  // Top left: the term's clock and the treasury, the goods in stock below, then the crown's request and any alarm.
  // Top right: the people and their mood, which opens the town's panel.
  const hud = el("div", "hud left")
  const bar = el("div", "card bar")
  const clock = el("div", "cell clock")
  const coins = el("div", "cell coins")
  bar.append(clock, coins)
  const stock = el("div", "card stock")
  /** What each good is for, for the stock bar's tooltips: who makes it, who takes it. */
  const goodHelp: Readonly<Record<GoodId, string>> = {
    wood: "lumberjacks fell it; a sawmill saws it into planks",
    planks: "what homes and buildings are built from: a sawmill makes them from wood",
    stone: "for building and paving: quarries cut it from rocks, which run out",
    ore: "only for tools: once the town has 10 citizens, a mine digs it from the rust-red deposits, and a smithy forges it into tools",
    tools: "for building, and workshops wear one out every 50 or 60 jobs: a smithy forges them, or buy them",
    fish: "food for settlers: fisheries catch it by the water; it rots in about three minutes",
    smoked: "fish that keeps all winter: a smokehouse smokes it",
    wheat: "farms grow it; a mill grinds it into flour (not in winter)",
    flour: "a mill's; a bakery bakes it into bread",
    bread: "food that citizens need, and a cottage with bread pays half again: it rots in about five minutes",
    wool: "sheep farms shear it; a weaver weaves it into cloth",
    cloth: "citizens need it: only brought to streets with desirability 5 or more"
  }
  const groups: ReadonlyArray<ReadonlyArray<GoodId>> = [
    ["wood", "planks", "stone", "ore", "tools"],
    ["fish", "smoked", "wheat", "flour", "bread"],
    ["wool", "cloth"]
  ]
  stock.title = "Goods in the town's storage · hover one for what it is for"
  const goodCells = new Map<GoodId, HTMLElement>()
  for (const group of groups) {
    const cell = el("div", "group")
    for (const g of group) {
      const item = el("span", "good")
      item.title = `${goods[g].title}: ${goodHelp[g]}`
      item.setAttribute("aria-label", goods[g].title)
      const glyph = el("span", "glyph")
      glyph.innerHTML = goodIcon(g, 18)
      const count = el("span", "count", "0")
      item.append(glyph, count)
      cell.append(item)
      goodCells.set(g, count)
    }
    stock.append(cell)
  }
  // The crown's request, when there is one, and what threatens (or is about to complete) the term.
  const request = el("div", "card request")
  const requestText = el("div", "cell")
  const send = el("button", "send", "send")
  send.onclick = (event) => {
    event.stopPropagation()
    ui.edits.push({ type: "deliver" })
  }
  request.append(requestText, send)
  const alarm = el("div", "card alarm")
  // The town ticker: what needs looking at now, and the latest news.
  const ticker = el("div", "card ticker")
  // The top line: the clock and treasury (on a phone, the people and a chip of the building goods beside them).
  const topline = el("div", "topline")
  const goodsChip = el("button", "card goods-chip")
  goodsChip.title = "The goods in storage"
  topline.append(bar, goodsChip)
  hud.append(topline, stock, request, alarm, ticker)
  const people = el("div", "hud right")
  const folk = el("div", "card bar folk")
  const approval = el("div", "cell")
  const settlerCell = el("div", "cell")
  const citizenCell = el("div", "cell")
  const jobs = el("div", "cell jobs")
  folk.append(approval, settlerCell, citizenCell, jobs)
  people.append(folk)
  folk.title = "Open the town's numbers, goals, and levers (T)"
  folk.onclick = () => toggleMenu("town")
  /** Points the page at a place: the camera goes there, it is outlined for a moment, and (when it is a thing) it is selected. */
  const goTo = (at: { readonly x: number; readonly y: number }, size: number, id: number | null) => {
    setFold(null)
    stage.focus(at.x + size / 2, at.y + size / 2)
    ui.flash = { cell: { x: at.x, y: at.y }, size, until: Date.now() + 4000 }
    if (id !== null) {
      ui.selected = id
      ui.menu = null
      refreshTools()
    }
  }
  let shortCursor = 0
  jobs.onclick = (event) => {
    event.stopPropagation()
    const short = ui.stats?.shortStaffed ?? []
    if (short.length === 0) return toggleMenu("town")
    const next = short[shortCursor % short.length]!
    shortCursor += 1
    goTo(next.cell, next.size, next.id)
  }
  const tooltip = el("div", "tooltip")
  const toastBox = el("div", "toast")
  const toolbar = el("div", "toolbar")
  const system = el("div", "system")
  const panel = el("aside", "panel")
  const dialog = el("div", "dialog")
  const confirmBox = el("div", "dialog")
  const reckoning = el("div", "dialog")
  const shareBox = el("div", "dialog share")
  const visitBar = el("div", "card visit")
  const result = el("button", "result", "")
  result.onclick = () => showReckoning(true)
  // Map views, and the legend of the one shown.
  const views = el("div", "views")
  const legend = el("div", "card legend")
  // A phone's buttons for what stays folded away: the guide and the map views.
  const foldButtons = el("div", "fold-buttons")
  const guideBulb = el("button", "card")
  guideBulb.title = "The guide, and what needs looking at now"
  const guideBadge = el("span", "badge")
  guideBulb.append(iconEl("hint", 16), guideBadge)
  const layersButton = el("button", "card")
  layersButton.title = "Map overlays"
  layersButton.append(iconEl("layers", 16))
  foldButtons.append(guideBulb, layersButton)
  document.body.append(hud, people, tooltip, toastBox, toolbar, system, panel, result, dialog, confirmBox, reckoning, shareBox, visitBar, views, legend, foldButtons)

  // ── Phones: the HUD folds away ──
  // On a small screen only the top line and the tool bar stay out; the goods,
  // the guide, the map views, and the system buttons each open on a tap, one
  // at a time, and a tap on the map folds them again.
  const phone = window.matchMedia("(max-width: 760px), (max-height: 500px)")
  type Fold = "goods" | "guide" | "views" | "more"
  let fold: Fold | null = null
  const setFold = (next: Fold | null) => {
    fold = next
    for (const f of ["goods", "guide", "views", "more"] as const) document.body.classList.toggle(`fold-${f}`, f === next)
    goodsChip.classList.toggle("on", next === "goods")
    guideBulb.classList.toggle("on", next === "guide")
    layersButton.classList.toggle("on", next === "views" || ui.view !== "none")
    moreButton.classList.toggle("on", next === "more")
    if (next !== null) {
      ticker.classList.remove("peek")
      // The panel and a fold would cover each other: the fold wins.
      if (ui.menu !== null || ui.selected !== null) {
        ui.menu = null
        ui.selected = null
        refreshTools()
      }
    }
  }
  const toggleFold = (f: Fold) => setFold(fold === f ? null : f)
  goodsChip.onclick = (event) => {
    event.stopPropagation()
    toggleFold("goods")
  }
  guideBulb.onclick = () => toggleFold("guide")
  layersButton.onclick = () => toggleFold("views")
  mount.addEventListener("pointerdown", () => {
    if (fold !== null) setFold(null)
  })
  // The people's card joins the top line on a phone, and goes back to the top right on a wider screen.
  const placeFolk = () => {
    if (phone.matches) topline.insertBefore(folk, goodsChip)
    else people.append(folk)
    if (!phone.matches) setFold(null)
  }

  let toastTimer = 0
  const ui: UiValue = {
    tool: "select",
    placing: null,
    ground: "lawn",
    prop: "lamp",
    menu: null,
    pointer: null,
    dragFrom: null,
    selected: null,
    gestures: [],
    guide: [],
    // A town is founded behind the dialog, so there is land to look at while choosing.
    edits: [{ type: "newTown", charter: defaultCharter((Date.now() & 0x7fffffff) >>> 0) }],
    preview: emptyPreview(),
    hits: [],
    panel: null,
    centres: new Map(),
    stats: null,
    speed: 1,
    founding: true,
    view: "none",
    overlay: { key: "", cells: [] },
    tints: new Map(),
    legend: null,
    flash: null,
    toast: (message) => {
      toastBox.textContent = message
      toastBox.classList.add("show")
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => toastBox.classList.remove("show"), 1800)
    }
  }

  const tools: ReadonlyArray<{
    readonly tool: Tool | "build"
    readonly label: string
    readonly key: string
    readonly icon: IconName
    readonly tip: string
  }> = [
    {
      tool: "select",
      label: "select",
      key: "S",
      icon: "select",
      tip: "Click a building or home to see what it does · drag to pan · wheel to zoom"
    },
    { tool: "road", label: "road", key: "R", icon: "road", tip: `Drag to lay a road · ${ROAD_COST} coins a cell` },
    {
      tool: "pave",
      label: "pave",
      key: "P",
      icon: "pave",
      tip: `Drag along a road to pave it: carriers and walkers go ${PAVED_PACE}× as fast on it, and homes beside it like it · ${PAVE_COST.coins} coins and ${PAVE_COST.stone} stone a cell`
    },
    { tool: "home", label: "homes", key: "H", icon: "homes", tip: `Drag to lay a row of homes along a road · ${costText(home.cost)} each` },
    { tool: "build", label: "build", key: "B", icon: "build", tip: "Choose a building, then click to place it · Esc to stop" },
    { tool: "bulldoze", label: "bulldoze", key: "X", icon: "bulldoze", tip: "Click a building, home, road, tree, or field to remove it" }
  ]
  // The town's panel is opened most: it has a button of its own, first and larger.
  const townButton = el("button", "town-button")
  townButton.title = "The town's goals, numbers, taxes, and trade (T)"
  townButton.append(iconEl("town", 22), el("span", "", "town"), el("kbd", "", "T"))
  townButton.onclick = () => toggleMenu("town")
  // Everything the bottom-right buttons do, folded into one menu on a phone.
  const moreButton = el("button", "more")
  moreButton.title = "Share, the guide, save, load, new town"
  moreButton.append(iconEl("more"))
  moreButton.onclick = () => toggleFold("more")
  const toolGroup = el("div", "group")
  toolbar.append(townButton, toolGroup)
  const buttons = tools.map((tool) => {
    const button = el("button", "")
    button.title = tool.tip
    button.append(iconEl(tool.icon), document.createTextNode(tool.label), el("kbd", "", tool.key))
    button.onclick = () => (tool.tool === "build" ? toggleMenu("build") : choose(tool.tool))
    toolGroup.append(button)
    return { tool, button }
  })
  const speedGroup = el("div", "group speed")
  toolbar.append(speedGroup)
  const speeds = [
    { speed: 0, label: "", key: "space" },
    { speed: 1, label: "1×", key: "1" },
    { speed: 2, label: "2×", key: "2" },
    { speed: 4, label: "4×", key: "3" }
  ].map(({ speed, label, key }) => {
    const button = el("button", speed === 0 ? "pause" : "", label)
    if (speed === 0) button.append(iconEl("pause", 14))
    button.title = speed === 0 ? "Pause the town (space)" : `Run the town at ${label} (${key})`
    button.onclick = () => setSpeed(speed)
    speedGroup.append(button)
    return { speed, button }
  })
  // A phone has room for one speed button: it runs a paused town, else goes on to the next speed.
  const cycle = el("button", "cycle")
  cycle.title = "Change speed: 1×, 2×, 4×"
  cycle.onclick = () => setSpeed(ui.speed === 0 ? lastSpeed : ui.speed === 4 ? 1 : ui.speed * 2)
  speedGroup.append(cycle)
  toolbar.append(moreButton)
  let lastSpeed = 1
  const setSpeed = (speed: number) => {
    if (speed > 0) lastSpeed = speed
    ui.speed = speed
    for (const s of speeds) s.button.classList.toggle("on", s.speed === speed)
    cycle.textContent = `${speed === 0 ? lastSpeed : speed}×`
    cycle.classList.toggle("paused", speed === 0)
  }
  setSpeed(1)

  // ── Map views ──
  const viewButtons: ReadonlyArray<{ readonly view: Exclude<View, "none">; readonly label: string; readonly key: string; readonly icon: IconName }> = [
    { view: "appeal", label: "desirability", key: "D", icon: "appeal" },
    { view: "workers", label: "workers", key: "W", icon: "workers" },
    { view: "fire", label: "fire", key: "F", icon: "fire" },
    { view: "health", label: "health", key: "A", icon: "health" },
    { view: "order", label: "order", key: "O", icon: "order" },
    { view: "condition", label: "condition", key: "C", icon: "condition" }
  ]
  const viewsTitle = el("div", "views-title", "map overlays")
  viewsTitle.title = "Colour the map by one of these, to see where the town is doing well or badly. Press the key again (or click) to hide it."
  views.append(viewsTitle)
  const viewEls = viewButtons.map((v) => {
    const button = el("button", "")
    button.title = `Show ${v.label} over the map (${v.key}); again to hide it`
    button.append(iconEl(v.icon, 15), document.createTextNode(v.label), el("kbd", "", v.key))
    button.onclick = () => setView(ui.view === v.view ? "none" : v.view)
    views.append(button)
    return { ...v, button }
  })
  const setView = (view: View) => {
    ui.view = view
    for (const v of viewEls) v.button.classList.toggle("on", v.view === view)
    // On a phone the list folds away once one is chosen, so the map shows.
    if (fold === "views") setFold(null)
    layersButton.classList.toggle("on", view !== "none")
  }
  // Share, the guide, save, load, and new town: a row of icons in the bottom
  // right. Founding or loading replaces the town, so each asks first.
  const action = (name: IconName, label: string, tip: string, run: () => void) => {
    const button = el("button", name === "share" ? "labelled" : "")
    button.title = tip
    button.append(iconEl(name), document.createTextNode(label))
    button.onclick = run
    system.append(button)
  }
  action("share", "share", "Share a picture of the town, or a link anyone can open to watch it and play on", () => void openShare())
  // The guide, on or off (it is on for a new mayor).
  const guideButton = el("button", "guide-toggle")
  guideButton.title = "Turn the guide on or off: it tells a new mayor what to do next, and why"
  guideButton.append(iconEl("hint"), document.createTextNode("guide"))
  guideButton.onclick = () => ui.guide.push({ type: ui.stats?.guide.off ? "on" : "off" })
  system.append(guideButton)
  action("save", "save", "Save the town in this browser (it also autosaves every two minutes)", () =>
    ui.toast(persistence().save() ?? "Saved")
  )
  action("load", "load", "Load the latest save: yours or the autosave, whichever is newer", () =>
    confirmLeave("load the latest save?", "The town as it is now is replaced by the latest save (yours or the autosave).", "Load", () =>
      ui.toast(persistence().load() ?? "Loaded")
    )
  )
  action("newTown", "new town", "Found a new town on new land", () =>
    confirmLeave("found a new town?", "This town is left behind for good unless it is saved first.", "Choose new land", () =>
      openCharter(true)
    )
  )
  // A phone has no camera bar: this puts the camera back.
  action("view", "recentre", "Back to the original angle and centre", () => stage.resetCamera())
  system.lastElementChild!.classList.add("phone-only")
  // A choice from the menu folds it.
  system.addEventListener("click", () => {
    if (fold === "more") setFold(null)
  })
  placeFolk()
  phone.addEventListener("change", placeFolk)

  /** Asks before something that replaces the town: save first, go ahead, or stay. */
  const confirmLeave = (title: string, text: string, go: string, run: () => void) => {
    const wasSpeed = ui.speed
    setSpeed(0)
    confirmBox.replaceChildren()
    const card = el("div", "sheet narrow")
    card.append(el("h2", "", title), el("p", "sub", text))
    const actions = el("div", "actions")
    const close = (resume: boolean) => {
      confirmBox.classList.remove("open")
      if (resume) setSpeed(wasSpeed)
    }
    const stay = el("button", "frame primary", "Keep playing")
    stay.onclick = () => close(true)
    const saveFirst = el("button", "frame", `Save, then ${go.toLowerCase()}`)
    saveFirst.onclick = () => {
      const failed = persistence().save()
      if (failed) return ui.toast(failed)
      close(true)
      run()
    }
    const leave = el("button", "frame danger", `${go} without saving`)
    leave.onclick = () => {
      close(true)
      run()
    }
    actions.append(stay, saveFirst, leave)
    card.append(actions)
    confirmBox.append(card)
    confirmBox.classList.add("open")
    stay.focus()
  }

  const refreshTools = () => {
    for (const { tool, button } of buttons) {
      const on = tool.tool === "build" ? ui.menu === "build" || ui.tool === "place" || ui.tool === "ground" || ui.tool === "prop" : tool.tool === ui.tool
      button.classList.toggle("on", on)
    }
    townButton.classList.toggle("on", ui.menu === "town")
  }
  const choose = (tool: Tool) => {
    ui.tool = tool
    ui.dragFrom = null
    if (tool !== "place") ui.placing = null
    if (tool !== "select") ui.selected = null
    refreshTools()
  }
  const toggleMenu = (menu: "build" | "town") => {
    setFold(null)
    ui.menu = ui.menu === menu ? null : menu
    if (ui.menu) ui.selected = null
    refreshTools()
  }
  const place = (kind: KindId) => {
    ui.placing = kind
    ui.menu = null
    choose("place")
    ui.toast(`Click to place a ${kinds[kind].title.toLowerCase()} · Esc to stop`)
  }
  const layGround = (ground: GroundId) => {
    ui.ground = ground
    ui.menu = null
    choose("ground")
    ui.toast(`Drag a rectangle to lay ${grounds[ground].title.toLowerCase()} · Esc to stop`)
  }
  const furnish = (prop: PropId) => {
    ui.prop = prop
    ui.menu = null
    choose("prop")
    ui.toast(`Click a cell of park to set a ${props[prop].title.toLowerCase()} · Esc to stop`)
  }
  choose("select")

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest("input,select,textarea,[contenteditable=true]")) return
    if (event.key === " " && event.target instanceof HTMLButtonElement) return
    if (confirmBox.classList.contains("open") && event.key === "Escape") confirmBox.querySelector<HTMLButtonElement>(".primary")?.click()
    if (shareBox.classList.contains("open") && event.key === "Escape") closeShare()
    if (ui.founding || reckoning.classList.contains("open") || confirmBox.classList.contains("open") || shareBox.classList.contains("open") || visiting) return
    if (event.key === " ") {
      event.preventDefault()
      setSpeed(ui.speed === 0 ? lastSpeed : 0)
    }
    if (event.key === "1") setSpeed(1)
    if (event.key === "2") setSpeed(2)
    if (event.key === "3") setSpeed(4)
    if (event.key === "Escape") {
      if (ui.tool !== "select") choose("select")
      else if (ui.menu) ui.menu = null
      else ui.selected = null
      refreshTools()
    }
    const key = event.key.toLowerCase()
    if (key === "s") choose("select")
    if (key === "r") choose("road")
    if (key === "p") choose("pave")
    const viewKey = viewButtons.find((v) => v.key.toLowerCase() === key)
    if (viewKey) setView(ui.view === viewKey.view ? "none" : viewKey.view)
    if (key === "h") choose("home")
    if (key === "x") choose("bulldoze")
    if (key === "b") toggleMenu("build")
    if (key === "t") toggleMenu("town")
  })

  // ── History, for the town panel's lines ──
  interface Sample {
    readonly coins: number
    readonly residents: number
    readonly stock: Readonly<Record<GoodId, number>>
  }
  /** One sample every `SAMPLE_SECONDS`, the last ten minutes of them. */
  const history: Array<Sample> = []
  const SAMPLE_SECONDS = 4
  const HISTORY = 150
  window.setInterval(() => {
    const s = ui.stats
    if (!s) return
    history.push({ coins: s.coins, residents: s.settlers + s.citizens, stock: s.stock })
    if (history.length > HISTORY) history.shift()
  }, SAMPLE_SECONDS * 1000)

  /** A thin ink line of `values`, scaled to its own range. */
  const sparkline = (values: ReadonlyArray<number>): string => {
    if (values.length < 2) return ""
    const w = 300
    const h = 36
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const span = hi - lo || 1
    const points = values
      .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`)
      .join(" ")
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="#3d4943" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`
  }

  // ── Pictures of buildings, for the build menu and the panel ──
  const pictures = new Map<string, Promise<string>>()
  /** A building (or a home of a tier) drawn as the town draws it, as an image. */
  const picture = (what: KindId | Tier | `park:${GroundId | PropId}`): HTMLImageElement => {
    const img = document.createElement("img")
    img.className = "thumb"
    img.alt = ""
    const id = String(what)
    let url = pictures.get(id)
    if (!url) {
      const g = new Graphics()
      if (typeof what === "string" && what.startsWith("park:")) drawParkPiece(g, what.slice(5) as GroundId | PropId)
      else if (what === 1 || what === 2 || what === 3) {
        plate(g, plateHalf(1))
        drawHouse(g, what, 1, { right: true, left: false }, homeVariant(0.1))
      } else {
        const kind = kinds[what as KindId]
        plate(g, plateHalf(kind.size))
        drawBuilding(g, kind, 1, 0, 0.6, { right: true, left: true })
      }
      url = app.renderer.extract.base64({ target: g, resolution: 2 })
      void url.finally(() => g.destroy())
      pictures.set(id, url)
    }
    void url.then((src) => (img.src = src))
    return img
  }

  // ── Panel ──
  /** Volatile parts of the panel, updated in place without rebuilding it. */
  let live: Array<() => void> = []
  let shape = ""

  /** A section of the panel, its heading with an icon; `help` is kept behind an ⓘ rather than spelled out. */
  const section = (heading: string, glyph?: IconName, help?: string) => {
    const box = el("section", "")
    const h3 = el("h3", "")
    if (glyph) h3.append(iconEl(glyph))
    h3.append(document.createTextNode(heading))
    box.append(h3)
    if (help) {
      const info = el("button", "help")
      info.append(iconEl("info", 15))
      info.title = "What this means"
      info.setAttribute("aria-expanded", "false")
      const text = el("p", "help-text", help)
      info.onclick = () => {
        const open = !text.classList.contains("open")
        text.classList.toggle("open", open)
        info.setAttribute("aria-expanded", String(open))
      }
      h3.append(info)
      box.append(text)
    }
    return box
  }
  /**
   * A slider for one of the town's levers. While it is held, the town's
   * numbers do not move it back; `sync` sets it otherwise.
   */
  const slider = (min: number, max: number, step: number, onInput: (value: number) => void) => {
    const input = el("input", "slider")
    input.type = "range"
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    let held = false
    input.addEventListener("pointerdown", () => (held = true))
    input.addEventListener("pointerup", () => (held = false))
    input.addEventListener("blur", () => (held = false))
    const paint = () => input.style.setProperty("--at", `${((Number(input.value) - min) / (max - min)) * 100}%`)
    input.oninput = () => {
      paint()
      onInput(Number(input.value))
    }
    const sync = (value: number) => {
      if (held || input.value === String(value)) return
      input.value = String(value)
      paint()
    }
    paint()
    return { input, sync }
  }
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
      refreshTools()
    }
    head.append(lead, text, closeButton)
    return head
  }

  const lockText = (kind: Pick<Kind, "unlock"> | ParkPiece): string | null => {
    const s = ui.stats
    if (!s) return null
    const residents = s.settlers + s.citizens
    if (residents < kind.unlock.residents) return `needs ${kind.unlock.residents} residents`
    if (s.citizens < kind.unlock.citizens) return `needs ${kind.unlock.citizens} citizens`
    return null
  }

  /** A cost as icon chips, each marked when the town is short of it. */
  const costChips = (cost: Kind["cost"]) => {
    const box = el("span", "chips")
    const chips: Array<{ chip: HTMLElement; short: () => boolean }> = []
    if (cost.coins > 0) {
      const chip = el("span", "chip")
      chip.innerHTML = `${icon("coins", 14)}${cost.coins}`
      chips.push({ chip, short: () => (ui.stats?.coins ?? 0) < cost.coins })
    }
    for (const [g, n] of Object.entries(cost.materials) as Array<[GoodId, number]>) {
      const chip = el("span", "chip")
      chip.title = goods[g].title
      chip.innerHTML = `${goodIcon(g, 14)}${n}`
      chips.push({ chip, short: () => (ui.stats?.stock[g] ?? 0) < n })
    }
    box.append(...chips.map((c) => c.chip))
    const refresh = () => {
      let short = false
      for (const c of chips) {
        const now = c.short()
        c.chip.classList.toggle("short", now)
        short ||= now
      }
      return short
    }
    return { box, refresh }
  }

  const categoryIcon: Readonly<Record<Category, IconName>> = {
    storage: "jobs",
    gathering: "wood",
    crafts: "tools",
    food: "bread",
    services: "faith"
  }

  const buildMenu = () => {
    panel.append(header("build", iconEl("build", 30), el("p", "sub", "Pick one, then click the map · Esc to stop")))
    for (const category of categoryOrder) {
      const options = kindOrder.filter((id) => kinds[id].category === category && kinds[id].buildable)
      if (options.length === 0) continue
      const box = section(category, categoryIcon[category])
      box.style.borderTop = `3px solid ${hex(categoryColor[category])}`
      for (const id of options) {
        const kind = kinds[id]
        const option = el("button", "option")
        const cost = costChips(kind.cost)
        cost.box.prepend(el("span", "cap", "cost"))
        const terms = el("span", "chips")
        const r = kind.recipe
        const does = [
          r ? `<span class="chip" title="${r.input ? `turns ${r.inputs} ${goods[r.input].title} into ${r.batch} ${goods[r.output].title}` : `makes ${r.batch} ${goods[r.output].title}`} every ${r.seconds} s">${r.input ? `${goodIcon(r.input, 14)}<i>→</i>` : ""}${goodIcon(r.output, 14)}${r.batch > 1 ? r.batch : ""}</span>` : "",
          kind.service ? `<span class="chip" title="its walkers serve the homes within ${kind.service.range} road cells of its door">${icon(kind.service.service === "goods" ? "trade" : kind.service.service === "faith" ? "faith" : kind.service.service === "repair" ? "repair" : kind.service.service, 14)}${kind.service.range}</span>` : "",
          kind.holds && !kind.recipe && !kind.service ? `<span class="chip" title="holds up to ${kind.holds.cap} of each good${kind.keeps ? `, and keeps food ${kind.keeps} times as long` : ""}">${icon("jobs", 14)}${kind.holds.cap}</span>` : "",
          kind.workers > 0 ? `<span class="chip dim" title="${kind.workers} ${kind.crew} to work it, from homes within 15 road cells">${icon(kind.crew === "citizens" ? "citizens" : "settlers", 14)}${kind.workers}</span>` : "",
          kind.appeal ? `<span class="chip ${kind.appeal.value < 0 ? "bad" : "good"}" title="desirability ${kind.appeal.value > 0 ? "+" : ""}${kind.appeal.value} beside it, out to ${kind.appeal.reach} cells${kind.appeal.value < 0 ? ": keep homes away" : ": homes like it"}">${icon("appeal", 14)}${kind.appeal.value > 0 ? "+" : ""}${kind.appeal.value}</span>` : "",
          `<span class="chip dim" title="upkeep: coins a minute while it stands (a quarter when paused)">${icon("upkeep", 14)}${kind.upkeep}/min</span>`
        ].join("")
        terms.innerHTML = `<span class="cap">does</span>${does}`
        const blurb = el("span", "blurb", kind.blurb)
        option.append(picture(id), el("span", "name", kind.title.toLowerCase()), cost.box, terms, blurb)
        option.title = `${kind.title}: ${kind.blurb}${kind.workers > 0 ? ` · ${kind.workers} ${kind.crew === "citizens" ? "citizen" : "settler"} workers from within 15 road cells` : ""}${kind.service ? ` · walkers reach ${kind.service.range} road cells` : ""}${kind.appeal ? ` · desirability ${kind.appeal.value > 0 ? "+" : ""}${kind.appeal.value} out to ${kind.appeal.reach} cells` : ""} · ${kind.upkeep} coins a minute`
        option.onclick = () => place(id)
        live.push(() => {
          const lock = lockText(kind)
          const short = cost.refresh()
          option.disabled = lock !== null
          option.classList.toggle("short", lock === null && short)
          blurb.textContent = lock ?? kind.blurb
        })
        box.append(option)
      }
      panel.append(box)
    }
    // Parks are laid out piece by piece: ground first, then what stands on it.
    const parks = section(
      "parks",
      "decor",
      `Lay ground, then set furnishings on it. Ground that touches is one park: the more it holds the nicer the streets around it (citizens need 5, townhouses 15). One furnishing counts for every ${parkRules.cellsPerProp} cells.`
    )
    parks.style.borderTop = "3px solid #4f9a6a"
    const pieces: ReadonlyArray<{ readonly id: GroundId | PropId; readonly piece: ParkPiece; readonly pick: () => void; readonly ground: boolean }> = [
      ...groundIds.map((id) => ({ id, piece: grounds[id], pick: () => layGround(id), ground: true })),
      ...propIds.map((id) => ({ id, piece: props[id], pick: () => furnish(id), ground: false }))
    ]
    for (const { id, piece, pick, ground } of pieces) {
      if (ground && id === "lawn") parks.append(el("p", "empty", "ground · drag a rectangle"))
      if (!ground && id === "lamp") parks.append(el("p", "empty", "furnishings · click a cell of park"))
      const option = el("button", "option")
      const cost = costChips(piece.cost)
      cost.box.prepend(el("span", "cap", "cost"))
      const terms = el("span", "chips")
      terms.innerHTML = `<span class="cap">does</span><span class="chip good" title="beauty it adds to its park">${icon("appeal", 14)}+${piece.beauty}</span><span class="chip dim" title="upkeep, coins a minute">${icon("upkeep", 14)}${piece.upkeep}/min</span>`
      const blurb = el("span", "blurb", piece.blurb)
      option.append(picture(`park:${id}`), el("span", "name", piece.title.toLowerCase()), cost.box, terms, blurb)
      option.title = `${piece.title}: ${piece.blurb} · beauty +${piece.beauty}${ground ? " a cell" : ""} · ${piece.upkeep} coins a minute`
      option.onclick = pick
      live.push(() => {
        const lock = lockText(piece)
        const short = cost.refresh()
        option.disabled = lock !== null
        option.classList.toggle("short", lock === null && short)
        option.classList.toggle("on", (ground ? ui.tool === "ground" && ui.ground === id : ui.tool === "prop" && ui.prop === id))
        blurb.textContent = lock ?? piece.blurb
      })
      parks.append(option)
    }
    panel.append(parks)
  }

  const row = (box: HTMLElement, label: string, glyph?: IconName | GoodId) => {
    const line = el("div", "row")
    const value = el("span", "count")
    const name = el("span", "label")
    if (glyph) name.innerHTML = icon(glyph, 16)
    name.append(document.createTextNode(label))
    line.append(name, value)
    box.append(line)
    return value
  }
  /** Sets a number with its sign, coloured by it. */
  const money = (node: HTMLElement, n: number, suffix = "") => {
    node.textContent = `${signed(n)}${suffix}`
    node.classList.toggle("up", n > 0)
    node.classList.toggle("down", n < 0)
  }

  const townPanel = () => {
    const sub = el("p", "sub")
    panel.append(header("town", iconEl("town", 30), sub))

    // The goals that complete the town, and how near each one is.
    const goals = section("goals", "goal", "Meet every goal at once and hold them for two minutes to complete the town.")
    const goalRows: Array<{ line: HTMLElement; mark: HTMLElement; text: HTMLElement; value: HTMLElement }> = []
    const goalNote = el("p", "empty")
    panel.append(goals)

    const mood = section(
      "approval",
      "approval",
      `Homes hold more residents when approval is high and fewer when it is low. At −50 for two minutes, the town turns the mayor out.`
    )
    const moodLine = el("div", "row")
    const moodValue = el("span", "count total")
    moodLine.append(el("span", "label", "now → heading for"), moodValue)
    const moodTrack = el("div", "meter")
    const moodFill = el("span", "fill")
    moodTrack.append(moodFill)
    const moodParts = el("div", "")
    mood.append(moodLine, moodTrack, moodParts)
    panel.append(mood)

    const treasury = section(
      "treasury",
      "treasury",
      "Coins a minute. Taxes come only from homes that are fed, in proportion to the needs they have met. Administration grows faster than the town. Three minutes in debt and the town is bankrupt."
    )
    const taxes = row(treasury, "taxes", "taxes")
    const supplied = row(treasury, "if every home were supplied", "homes")
    supplied.classList.add("dim")
    const suppliedNote = el("p", "empty")
    treasury.append(suppliedNote)
    const traded = row(treasury, "trade", "trade")
    const upkeep = row(treasury, "upkeep", "upkeep")
    const admin = row(treasury, "administration", "town")
    const net = row(treasury, "a minute", "coins")
    net.classList.add("total")
    const coinLine = el("div", "spark")
    treasury.append(coinLine)
    panel.append(treasury)

    const levers = section(
      "tax rates",
      "taxes",
      `Lower taxes raise approval, higher ones lower it, weighed by how many of each tier there are. Above ${moodRules.grudge.above}% the town also keeps a grudge that outlasts the rate: cutting taxes at the end does not undo a term of squeezing.`
    )
    for (const tier of ["settlers", "citizens"] as const) {
      const line = el("div", "row lever")
      const value = el("span", "rate")
      const name = el("span", "label")
      name.innerHTML = icon(tier, 16)
      name.append(document.createTextNode(tier))
      line.append(name, value)
      const rate = slider(TAX_STEPS[0], TAX_STEPS.at(-1)!, 5, (to) => ui.edits.push({ type: "tax", tier, rate: to }))
      rate.input.classList.add("tax")
      rate.input.title = "Drag to set the rate; double-click for the usual 100%"
      rate.input.ondblclick = () => ui.edits.push({ type: "tax", tier, rate: 100 })
      const effect = el("p", "effect")
      levers.append(line, rate.input, effect)
      live.push(() => {
        const now = ui.stats?.policy[tier] ?? 100
        rate.sync(now)
        value.textContent = `${now}%`
        const sway = Math.round((100 - now) * moodRules.perTaxPoint)
        const grudge = now > moodRules.grudge.above ? " · a grudge builds while it stays this high, and fades slowly" : ""
        effect.textContent = (sway === 0 ? "the usual rate" : `${signed(sway)} approval`) + grudge
        effect.className = `effect ${sway > 0 ? "up" : sway < 0 ? "down" : ""}`
      })
    }
    panel.append(levers)

    const town = section("people", "people")
    const settlers = row(town, "settlers", "settlers")
    const citizens = row(town, "citizens", "citizens")
    const burghers = row(town, "of them, burghers", "burghers")
    const homes = row(town, "homes", "homes")
    const work = row(town, "jobs filled", "jobs")
    const workNote = el("p", "empty")
    town.append(workNote)
    const peopleLine = el("div", "spark")
    town.append(peopleLine)
    panel.append(town)

    const needs = section(
      "homes supplied",
      "homes",
      "A hungry home pays no taxes. Settlers need food (fish, smoked fish, or bread) from a market, and a cottage with bread besides pays half again; citizens and burghers need bread, cloth, and faith. Cloth is only brought to streets with desirability 5 or more. Fish rots in about three minutes and bread in five; a granary keeps them five times as long."
    )
    const needIcons: Readonly<Record<"food" | "bread" | "cloth" | "faith", IconName>> = {
      food: "fish",
      bread: "bread",
      cloth: "cloth",
      faith: "faith"
    }
    const bars = (["food", "bread", "cloth", "faith"] as const).map((n) => {
      const line = el("div", "need")
      const label = el("span", "label")
      label.innerHTML = icon(needIcons[n], 16)
      label.append(document.createTextNode(needTitle[n]))
      const track = el("span", "track")
      const fill = el("span", "fill")
      track.append(fill)
      const value = el("span", "count")
      line.append(label, track, value)
      needs.append(line)
      return { n, fill, value }
    })
    const larderLine = row(needs, "food in store", "flour")
    const eatenLine = row(needs, "eaten · rotted last minute", "fish")
    const troubleLine = row(needs, "sick homes · on fire", "health")
    panel.append(needs)

    const crown = section(
      "the crown",
      "crown",
      `Sending what the crown asks for earns coins. A missed request is a fine, and the town remembers the snub for a while; too many missed in a row and the crown dismisses the mayor.`
    )
    const crownLine = row(crown, "requests met · missed", "goal")
    const crownNext = el("p", "empty")
    crown.append(crownNext)
    panel.append(crown)

    const store = section(
      "goods and trade",
      "trade",
      "Traders call every few seconds. Drag a good's slider left to sell it beyond what the town keeps, right to buy it up to that (at half again the price), the further the more each call; the middle neither sells nor buys. Prices fall as the town sells and rise as it buys."
    )
    const reserveLine = el("div", "row lever")
    const reserveValue = el("span", "rate")
    reserveLine.append(el("span", "label", "keep in store"), reserveValue)
    const reserve = slider(0, RESERVE_MAX, 5, (amount) => ui.edits.push({ type: "reserve", amount }))
    reserve.input.title = "How much of each good the town keeps: it sells only beyond this, and buys only up to it"
    store.append(reserveLine, reserve.input, el("p", "effect", "of each good: sold only above this, bought only up to it"))
    /** Collections a minute: the traders come at every ledger. */
    const perMinute = 60 / (LEDGER_TICKS * STEP_SECONDS)
    const goodRows = goodIds.map((g) => {
      const line = el("div", "trade-row")
      const name = el("span", "label")
      name.innerHTML = goodIcon(g, 16)
      name.append(document.createTextNode(goods[g].title))
      const value = el("span", "count")
      const price = el("span", "price")
      const top = el("div", "row")
      const change = el("small", "change")
      const right = el("span", "label")
      right.append(change, value, price)
      top.append(name, right)
      // Left of the middle sells, right of it buys, the middle neither; how far out is how much a collection.
      const deal = slider(-TRADE_LOAD, TRADE_LOAD, 1, (v) =>
        ui.edits.push(v === 0 ? { type: "trade", good: g, mode: "none" } : { type: "trade", good: g, mode: v < 0 ? "sell" : "buy", amount: Math.abs(v) })
      )
      deal.input.classList.add("deal")
      deal.input.title = `Drag left to sell ${goods[g].title}, right to buy it; the further, the more each time the traders call. Double-click to stop trading it.`
      deal.input.ondblclick = () => ui.edits.push({ type: "trade", good: g, mode: "none" })
      const mode = el("span", "mode")
      const bottom = el("div", "deal-line")
      bottom.append(deal.input, mode)
      line.append(top, bottom)
      store.append(line)
      return { g, value, change, mode, price, deal, line }
    })
    panel.append(store)

    const chronicle = section("chronicle", "chronicle")
    const lines = el("div", "chronicle")
    chronicle.append(lines)
    panel.append(chronicle)

    live.push(() => {
      const s = ui.stats
      if (!s) return
      sub.textContent = `${sizes[s.charter.size].title}, ${lands[s.charter.land].title} land · ${s.charter.term}-minute term`
      sub.title = `seed ${s.charter.seed}`
      // Goals.
      while (goalRows.length < s.goals.length) {
        const line = el("div", "row goal")
        const mark = el("span", "mark", "✓")
        const text = el("span", "")
        const value = el("span", "count")
        const left = el("span", "label")
        left.append(mark, text)
        line.append(left, value)
        goals.append(line)
        goalRows.push({ line, mark, text, value })
      }
      goals.append(goalNote)
      s.goals.forEach((g, i) => {
        const r = goalRows[i]!
        r.line.classList.toggle("met", g.met)
        r.text.textContent = g.text
        r.value.textContent = g.value
      })
      goalNote.textContent = s.fate.governing
        ? "Complete: the mayor governs on to the end of the term."
        : s.fate.complete !== null
          ? `All met: hold them ${clockText(s.fate.complete)} more.`
          : ""
      goalNote.style.display = goalNote.textContent ? "" : "none"
      // Approval.
      moodValue.textContent = `${signed(s.mood.approval)} → ${signed(s.mood.target)}`
      moodValue.classList.toggle("down", s.mood.approval < 0)
      moodFill.style.left = `${Math.min(50, 50 + s.mood.approval / 2)}%`
      moodFill.style.width = `${Math.abs(s.mood.approval) / 2}%`
      moodFill.classList.toggle("low", s.mood.approval < 0)
      const parts = s.mood.parts
        .map(
          (p) =>
            `<div class="row"><span class="label">${p.label}</span><span class="count ${p.value > 0 ? "up" : p.value < 0 ? "down" : ""}">${signed(p.value)}</span></div>`
        )
        .join("")
      if (moodParts.dataset.html !== parts) {
        moodParts.dataset.html = parts
        moodParts.innerHTML = parts
      }
      money(taxes, s.taxes)
      supplied.textContent = `+${s.suppliedTaxes}`
      const gap = s.suppliedTaxes - s.taxes
      suppliedNote.textContent = gap > Math.max(10, s.taxes * 0.1) ? `${gap} coins a minute left on the table: a hungry home pays nothing, a cottage with bread pays half again, a fine street a quarter more` : ""
      suppliedNote.style.display = suppliedNote.textContent ? "" : "none"
      money(traded, s.trade)
      money(upkeep, -s.upkeep)
      money(admin, -s.admin)
      money(net, s.net, " coins")
      settlers.textContent = String(s.settlers)
      citizens.textContent = String(s.citizens)
      burghers.textContent = String(s.burghers)
      homes.textContent = String(s.homes)
      work.textContent = `${s.employed} of ${s.jobs}`
      workNote.textContent = s.shortStaffed.length === 0
        ? "every workplace has its crew"
        : `${s.shortStaffed.length} short of workers: ${s.shortStaffed.slice(0, 4).map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? " (nobody within reach)" : ""}`).join(", ")}${s.shortStaffed.length > 4 ? ", …" : ""} · click the jobs counter to visit them`
      for (const b of bars) {
        const share = s.homes > 0 ? s.needs[b.n] / s.homes : 0
        b.fill.style.width = `${Math.round(share * 100)}%`
        b.fill.className = `fill ${share < 0.34 ? "none" : share < 0.67 ? "low" : ""}`
        b.value.textContent = `${s.needs[b.n]}/${s.homes}`
      }
      larderLine.textContent = `${s.larder}`
      eatenLine.textContent = `${s.eaten} · ${s.rotted}`
      troubleLine.textContent = `${s.sick} · ${s.burning}`
      crownLine.textContent = `${s.crown.met} · ${s.crown.missed}`
      crownNext.innerHTML = s.crown.open
        ? `Wants <b>${s.crown.amount} ${goods[s.crown.good].title}</b> · ${clockText(s.crown.left)} left · +${s.crown.reward} coins`
        : `Next request in ${clockText(s.crown.next)} · ${s.crown.patience} missed in a row ends the term`
      // Goods' change over the last minute of samples.
      const ago = history[Math.max(0, history.length - 1 - Math.round(60 / SAMPLE_SECONDS))]
      reserveValue.textContent = String(s.policy.reserve)
      reserve.sync(s.policy.reserve)
      for (const r of goodRows) {
        const change = ago ? s.stock[r.g] - ago.stock[r.g] : 0
        r.change.textContent = change !== 0 ? `${change > 0 ? "+" : ""}${change}/min` : ""
        r.change.className = `change ${change > 0 ? "up" : "down"}`
        r.value.textContent = String(s.stock[r.g])
        const now: TradeMode = s.policy.sells.includes(r.g) ? "sell" : s.policy.buys.includes(r.g) ? "buy" : "none"
        const load = s.policy.loads[r.g]
        r.deal.sync(now === "sell" ? -load : now === "buy" ? load : 0)
        r.mode.textContent = now === "none" ? "no trade" : `${now} ≤${Math.round(load * perMinute)}/min`
        r.mode.className = `mode ${now}`
        r.line.className = `trade-row ${now}`
        const price = now === "buy" ? askOf(r.g, s.prices[r.g]) : Math.round(priceOf(r.g, s.prices[r.g]) * 10) / 10
        r.price.textContent = `${price}c${s.prices[r.g] !== 100 ? ` (${s.prices[r.g]}%)` : ""}`
        r.price.title = now === "buy" ? "what traders ask for one" : "what traders pay for one"
      }
      const samples = s.history
      const coinsSvg = sparkline(samples.map((h) => h.coins))
      if (coinLine.dataset.svg !== coinsSvg) {
        coinLine.dataset.svg = coinsSvg
        coinLine.innerHTML = coinsSvg
      }
      const peopleSvg = sparkline(samples.map((h) => h.residents))
      if (peopleLine.dataset.svg !== peopleSvg) {
        peopleLine.dataset.svg = peopleSvg
        peopleLine.innerHTML = peopleSvg
      }
      const recent = s.chronicle
        .slice(-10)
        .reverse()
        .map((l) => `<p><b>${clockText(Math.round(l.tick / 60))}</b> ${l.text}</p>`)
        .join("")
      if (lines.dataset.html !== recent) {
        lines.dataset.html = recent
        lines.innerHTML = recent
      }
    })
  }

  /** A line of a description as a row: its icon and what it is about, its value, any goods as chips, and a note underneath saying why. */
  const renderLine = (row: HTMLElement, l: Line) => {
    // A value too long to sit beside the label goes under it, aligned with it.
    row.className = `line ${l.tone ?? ""}${(l.value ?? "").length > 14 ? " long" : ""}`
    const chips = l.goods ? `<span class="chips">${l.goods.map((g) => `<span class="chip" title="${goods[g.good].title}">${goodIcon(g.good, 14)}${g.count}</span>`).join("")}</span>` : ""
    row.innerHTML = `<span class="mark">${icon(l.icon, 16)}</span><span class="what"></span><span class="count"></span>${chips}${l.note ? `<small class="note"></small>` : ""}`
    row.querySelector<HTMLElement>(".what")!.textContent = l.label
    row.querySelector<HTMLElement>(".count")!.textContent = l.value ?? ""
    if (l.note) row.querySelector<HTMLElement>(".note")!.textContent = l.note
  }
  /** Keeps a box of rows in step with its lines, touching only the rows that changed. */
  const syncLines = (box: HTMLElement, rows: Array<HTMLElement>, lines: ReadonlyArray<Line>) => {
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
      if (l) renderLine(row, l)
    })
  }

  const buildPanel = () => {
    const p = ui.panel
    live = []
    panel.replaceChildren()
    if (!p) return
    if (p.type === "build") return buildMenu()
    if (p.type === "town") return townPanel()

    const title = p.type === "building" ? kinds[p.kind].title.toLowerCase() : p.type === "house" ? tierHome[p.tier] : p.type === "park" ? "park" : "ruin"
    const status = el("span", "pill")
    const about = el(
      "p",
      "sub",
      p.type === "building"
        ? kinds[p.kind].blurb
        : p.type === "ruin"
          ? "bulldoze it to clear the plot"
          : p.type === "park"
            ? "every cell of ground that touches this one: lay more, or set furnishings on it, to make the streets around it nicer"
          : p.tier === 1
            ? "settlers: fish or bread from a market keeps them; they do the rough work"
            : p.tier === 2
              ? "citizens: they need bread, cloth, and faith, and a street with desirability 5; they do the skilled work"
              : "burghers: a citizens' home on a fine street (desirability 15) that every service calls on"
    )
    const below = el("div", "")
    below.append(status, about)
    panel.append(header(title, p.type === "ruin" ? iconEl("condition", 30) : p.type === "park" ? iconEl("decor", 30) : picture(p.type === "building" ? p.kind : p.tier), below))
    const box = section(p.type === "building" ? "at work" : p.type === "ruin" ? "what is left" : p.type === "park" ? "what makes it" : "household", p.type === "building" ? "jobs" : p.type === "park" ? "appeal" : "homes")
    box.classList.add("lines")
    const rows: Array<HTMLElement> = []
    panel.append(box)
    // A home: what keeps it from the next tier, in its own box, so the cause is never a word in a longer line.
    const nextBox = p.type === "house" && p.tier < 3 ? section(`to become ${home.tiers[(p.tier + 1) as Tier].title}`, "citizens", "Every line here must clear before the home grows. Needs come from walkers; the street from what stands around it.") : null
    const nextRows: Array<HTMLElement> = []
    const nextNote = el("p", "empty")
    if (nextBox) {
      nextBox.classList.add("lines")
      nextBox.append(nextNote)
      panel.append(nextBox)
    }
    live.push(() => {
      const now = ui.panel
      if (!now || now.type === "build" || now.type === "town" || now.type !== p.type) return
      if (now.type === "building") {
        status.textContent = now.problem ?? now.status
        status.className = `pill ${now.problem !== null ? "problem" : now.status === "working" ? "working" : ""}`
      } else if (now.type === "house") {
        status.textContent = `${home.tiers[now.tier].residents} at most`
        status.className = "pill working"
      } else if (now.type === "park") {
        status.textContent = `${now.value > 0 ? "+" : ""}${now.value} out to ${now.reach} cells`
        status.className = "pill working"
      } else {
        status.textContent = now.cause
        status.className = "pill problem"
      }
      syncLines(box, rows, now.lines)
      if (nextBox && now.type === "house") {
        syncLines(nextBox, nextRows, now.blockers)
        nextNote.textContent = now.blockers.length === 0 ? "nothing stands in the way: it grows when the next resident settles in" : ""
        nextNote.style.display = now.blockers.length === 0 ? "" : "none"
        nextBox.append(nextNote)
      }
    })
    if (!(p.type === "building" && p.kind === "townhall")) {
      const actions = el("div", "actions")
      if (p.type === "building") {
        const pause = el("button", "frame", "Pause work")
        pause.title = "A paused building has no workers and pays a quarter of its upkeep"
        pause.onclick = () => {
          const now = ui.panel
          if (now?.type === "building") ui.edits.push({ type: "pause", cell: now.cell, on: !now.paused })
        }
        live.push(() => {
          const now = ui.panel
          if (now?.type !== "building") return
          pause.textContent = now.paused ? "Resume work" : "Pause work"
          pause.style.display = now.pausable ? "" : "none"
        })
        actions.append(pause)
      }
      const remove = el("button", "frame danger", "Remove")
      remove.onclick = () => ui.edits.push({ type: "remove", cell: p.cell })
      actions.append(remove)
      panel.append(actions)
    }
  }

  /** Rebuilds the panel when what it shows changes, and refreshes its numbers every frame. */
  const syncPanel = () => {
    const p = ui.panel
    const next =
      p === null ? "" : p.type === "build" || p.type === "town" ? p.type : `${p.type}|${p.id}|${p.type === "house" ? p.tier : ""}`
    if (next !== shape) {
      shape = next
      // Keep the old contents while the closed panel slides away.
      if (p !== null) buildPanel()
      panel.classList.toggle("open", p !== null)
      document.body.classList.toggle("panel-open", p !== null)
      refreshTools()
    }
    for (const update of live) update()
  }

  // ── Founding a town ──
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
    const card = el("div", "sheet")
    card.append(
      el("h2", "", "found a town"),
      el(
        "p",
        "sub",
        "Choose the land and how long the term runs. Grow the town until it is complete, or keep it from bankruptcy, revolt, and ruin until the term is out."
      )
    )
    const body = el("div", "charter")
    const options = el("div", "")
    const preview = el("div", "preview")
    const map = document.createElement("canvas")
    const facts = el("p", "sub")
    preview.append(map, facts)
    body.append(options, preview)
    const group = <T extends string | number>(
      title: string,
      values: ReadonlyArray<T>,
      label: (v: T) => string,
      blurb: (v: T) => string,
      get: () => T,
      set: (v: T) => void
    ) => {
      const box = section(title)
      const row = el("div", "choices")
      const note = el("p", "empty")
      const buttons = values.map((v) => {
        const b = el("button", "frame choice", label(v))
        b.onclick = () => {
          set(v)
          refresh()
        }
        row.append(b)
        return { v, b }
      })
      box.append(row, note)
      options.append(box)
      return () => {
        for (const { v, b } of buttons) b.classList.toggle("on", v === get())
        note.textContent = blurb(get())
      }
    }
    const refreshers = [
      group(
        "land",
        sizeIds,
        (v) => sizes[v].title,
        (v) => `${sizes[v].goal.residents} residents and ${sizes[v].goal.coins} coins to complete it`,
        () => choice.size,
        (v) => (choice.size = v)
      ),
      group(
        "term",
        TERMS,
        (v) => `${v} min`,
        (v) => `${v} minutes of the town at 1×: six years, a winter at the end of each after the first`,
        () => choice.term,
        (v) => (choice.term = v)
      ),
      group(
        "richness",
        landIds,
        (v) => lands[v].title,
        (v) => lands[v].blurb,
        () => choice.land,
        (v) => (choice.land = v)
      )
    ]
    const seedLine = el("div", "row")
    const seedText = el("span", "")
    const reroll = el("button", "frame", "other land")
    reroll.onclick = () => {
      choice.seed = (Math.random() * 0x7fffffff) >>> 0
      refresh()
    }
    seedLine.append(seedText, reroll)
    preview.append(seedLine)
    const refresh = () => {
      for (const r of refreshers) r()
      const land = drawLand(map)
      seedText.textContent = `seed ${choice.seed}`
      facts.textContent = `${land.cells} cells of land · ${land.trees.length} trees · ${land.rocks.filter((r) => !r.ore).length} stone · ${land.rocks.filter((r) => r.ore).length} ore · ${lands[choice.land].coins} coins to start`
    }
    refresh()
    const actions = el("div", "actions")
    const found = el("button", "frame primary", "Found the town")
    found.onclick = () => {
      if (visiting) endVisit()
      ui.edits.push({ type: "newTown", charter: { ...choice } })
      history.length = 0
      ui.selected = null
      ui.menu = null
      closeCharter()
      showReckoning(false)
      choose("select")
      setSpeed(1)
    }
    actions.append(found)
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
  if (!options.shared) openCharter(false)

  // ── Sharing ──
  // A picture of the town (the card), to post anywhere; and, on asking, a link
  // that opens the town itself, running, for anyone to watch and play on.
  let shareSpeed = 1
  const closeShare = () => {
    if (!shareBox.classList.contains("open")) return
    shareBox.classList.remove("open")
    for (const img of shareBox.querySelectorAll("img")) URL.revokeObjectURL(img.src)
    if (!visiting) setSpeed(shareSpeed)
  }
  shareBox.onclick = (event) => {
    if (event.target === shareBox) closeShare()
  }
  const openShare = async () => {
    const s = ui.stats
    if (!s || shareBox.classList.contains("open")) return
    shareSpeed = ui.speed
    setSpeed(0)
    const facts = cardFacts(s)
    let card: HTMLCanvasElement, png: Blob
    try {
      card = await drawCard(stage.picture(PICTURE_WIDTH, PICTURE_HEIGHT, 2), facts, location.host)
      png = await blobOf(card, "image/png")
    } catch (error) {
      setSpeed(shareSpeed)
      return ui.toast(error instanceof Error ? error.message : "The picture could not be made")
    }
    const name = `inkline-town-${s.fate.state === "playing" ? `year-${s.season.year}` : s.fate.state === "won" ? "complete" : "reckoning"}.png`
    const caption = `${metaOf(facts).title} · ${metaOf(facts).description}`
    shareBox.replaceChildren()
    const sheet = el("div", "sheet")
    sheet.append(el("h2", "", "share the town"))
    const preview = document.createElement("img")
    preview.className = "card-preview"
    preview.alt = caption
    preview.src = URL.createObjectURL(png)
    sheet.append(preview)
    sheet.append(el("p", "sub", "Post the picture anywhere, or make a link: whoever opens it sees this town running, from where you look at it now, and can play on from here."))
    const actions = el("div", "actions")
    const picture = el("button", "frame primary", "")
    picture.append(iconEl("picture", 15), document.createTextNode(handheld() ? "Share the picture" : "Save the picture"))
    picture.onclick = async () => ui.toast(await offerPicture(png, name, caption))
    const link = el("button", "frame", "")
    link.append(iconEl("link", 15), document.createTextNode("Make a link"))
    const linkRow = el("div", "link-row")
    link.onclick = async () => {
      link.disabled = true
      link.lastChild!.textContent = "Making a link…"
      try {
        const small = await blobOf(scaled(card, PICTURE_WIDTH, PICTURE_HEIGHT), "image/jpeg", PICTURE_QUALITY)
        const made = await upload(persistence().shareFile(stage.view()), small, metaOf(facts))
        link.remove()
        const field = document.createElement("input")
        field.readOnly = true
        field.value = made.url
        field.onfocus = () => field.select()
        const copy = el("button", "frame primary", handheld() ? "Share the link" : "Copy the link")
        copy.onclick = async () => ui.toast(await offerLink(made.url, metaOf(facts).title))
        const open = el("a", "frame", "Open")
        open.setAttribute("href", made.url)
        open.setAttribute("target", "_blank")
        open.setAttribute("rel", "noopener")
        linkRow.replaceChildren(field, copy, open)
        linkRow.classList.add("show")
        copy.focus()
      } catch (error) {
        link.disabled = false
        link.lastChild!.textContent = "Try the link again"
        ui.toast(error instanceof Error ? error.message : "Could not share the town")
      }
    }
    const close = el("button", "frame", "Close")
    close.onclick = () => closeShare()
    actions.append(picture, link, close)
    sheet.append(actions, linkRow)
    shareBox.append(sheet)
    shareBox.classList.add("open")
    picture.focus()
  }

  // ── Visiting a shared town ──
  // The town runs as its mayor left it, with the building tools put away,
  // until the visitor plays on from here (it becomes theirs, and autosaves)
  // or founds a town of their own.
  let visiting = false
  const endVisit = () => {
    visiting = false
    document.body.classList.remove("visiting")
    visitBar.classList.remove("show")
    window.history.replaceState(null, "", "/")
  }
  /** The shared town is loaded: show it running. */
  const visit = (title: string) => {
    visiting = true
    closeCharter()
    resetPage()
    document.body.classList.add("visiting")
    visitBar.replaceChildren()
    const text = el("div", "cell")
    text.append(iconEl("town", 18))
    const words = el("span", "stack")
    words.append(el("b", "", "a shared town"), el("small", "", title))
    text.append(words)
    const play = el("button", "frame primary", "Play from here")
    play.title = "Make this town yours: build, govern, and it autosaves in this browser"
    play.onclick = () => {
      endVisit()
      ui.toast("The town is yours: it autosaves as you play")
    }
    const own = el("button", "frame", "Found your own")
    own.onclick = () => openCharter(true)
    const buttons = el("div", "cell")
    buttons.append(play, own)
    visitBar.append(text, buttons)
    visitBar.classList.add("show")
    setSpeed(1)
  }
  /** The shared town could not be opened: say why, and found a town instead. */
  const visitFailed = (message: string) => {
    window.history.replaceState(null, "", "/")
    openCharter(false)
    ui.toast(message)
  }

  // ── The end of the term ──
  /** Lines of residents, coins, and approval over the term, on the term's own time axis. */
  const chart = (s: Stats): string => {
    const w = 520
    const h = 150
    const end = Math.max(s.charter.term * 3600, ...s.history.map((p) => p.tick))
    const line = (values: ReadonlyArray<number>, lo: number, hi: number, color: string, dash = "") => {
      if (values.length < 2) return ""
      const span = hi - lo || 1
      const points = s.history
        .map((p, i) => `${((p.tick / end) * w).toFixed(1)},${(h - 4 - ((values[i]! - lo) / span) * (h - 8)).toFixed(1)}`)
        .join(" ")
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="${dash}" vector-effect="non-scaling-stroke"/>`
    }
    const residents = s.history.map((p) => p.residents)
    const coinsLine = s.history.map((p) => p.coins)
    const approvalLine = s.history.map((p) => p.approval)
    const top = Math.max(1, ...residents, sizes[s.charter.size].goal.residents)
    const goal = h - 4 - (sizes[s.charter.size].goal.residents / top) * (h - 8)
    const winters = Array.from({ length: 5 }, (_, i) => {
      const y = i + 1
      const from = ((y + 0.7) / 6) * w
      return `<rect x="${from.toFixed(1)}" y="0" width="${((w * 0.3) / 6).toFixed(1)}" height="${h}" fill="#3d6db5" opacity="0.06"/>`
    }).join("")
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${winters}<line x1="0" x2="${w}" y1="${goal}" y2="${goal}" stroke="#77817a" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>${line(coinsLine, Math.min(0, ...coinsLine), Math.max(1, ...coinsLine), "#d6ae2e")}${line(approvalLine, -100, 100, "#3d6db5", "4 3")}${line(residents, 0, top, "#3d4943")}</svg>`
  }
  let reckoned = ""
  let reckoningOpen = false
  const showReckoning = (open: boolean) => {
    reckoningOpen = open
    reckoning.classList.toggle("open", open && ui.stats !== null && ui.stats.fate.state !== "playing")
  }
  const syncReckoning = (s: Stats) => {
    const over = s.fate.state !== "playing"
    result.classList.toggle("show", over && !reckoningOpen && !ui.founding)
    if (!over) {
      reckoned = ""
      reckoning.classList.remove("open")
      return
    }
    const id = `${s.charter.seed}|${s.fate.state}|${s.fate.at}`
    result.textContent =
      s.fate.state === "won"
        ? "the town is complete · see how"
        : s.fate.state === "lost"
          ? "the term is lost · see how"
          : "the term is over · see how"
    if (id === reckoned) return
    reckoned = id
    const title =
      s.fate.state === "won"
        ? "the town is complete"
        : s.fate.state === "lost"
          ? s.fate.reason.split(":")[0]!.toLowerCase()
          : `the term is over: ${verdictOf(s)}`
    reckoning.replaceChildren()
    const card = el("div", "sheet wide")
    card.append(el("h2", "", title), el("p", "sub", s.fate.reason))
    const facts = el("div", "facts")
    const fact = (label: string, value: string) => {
      const f = el("div", "fact")
      f.append(el("b", "", value), el("span", "", label))
      facts.append(f)
    }
    fact("minutes in office", `${Math.round(s.fate.at)}`)
    fact("residents", `${s.settlers + s.citizens}`)
    fact("citizens", `${s.citizens}`)
    fact("coins", `${s.coins}`)
    fact("approval", signed(s.mood.approval))
    fact("crown met · missed", `${s.crown.met} · ${s.crown.missed}`)
    fact("score", `${s.fate.score}`)
    card.append(facts)
    const graph = el("div", "chart")
    graph.innerHTML = chart(s)
    card.append(graph, el("p", "legend", "— residents (dashed: the goal) · coins · - - approval · shaded: winters"))
    const story = el("div", "chronicle")
    story.innerHTML = s.chronicle.map((l) => `<p><b>${clockText(Math.round(l.tick / 60))}</b> ${l.text}</p>`).join("")
    card.append(story)
    const actions = el("div", "actions")
    if (s.fate.state === "won") {
      const govern = el("button", "frame primary", "Keep governing")
      govern.title = "Stay on to the end of the term: the town is already complete"
      govern.onclick = () => {
        ui.edits.push({ type: "govern" })
        showReckoning(false)
      }
      actions.append(govern)
    }
    const again = el("button", "frame" + (s.fate.state === "won" ? "" : " primary"), "Found a new town")
    again.onclick = () => {
      showReckoning(false)
      openCharter(true)
    }
    const look = el("button", "frame", "Look at the town")
    look.onclick = () => showReckoning(false)
    const share = el("button", "frame", "Share the town")
    share.title = "A picture of the town and its verdict, or a link anyone can open"
    share.onclick = () => void openShare()
    actions.append(again, look, share)
    card.append(actions)
    reckoning.append(card)
    showReckoning(true)
  }

  const input = new MapInput(stage, ui)
  const resetPage = () => {
    choose("select")
    ui.menu = null
    ui.selected = null
    input.reset()
  }

  /** Ticker lines the mayor has put away, by what they say (and, for news, when). */
  const dismissed = new Set<string>()
  let tickerLines: { guide: Stats["guide"]["step"]; alerts: Stats["alerts"]; news: Stats["chronicle"] } = { guide: null, alerts: [], news: [] }
  ticker.onclick = (event) => {
    event.stopPropagation()
    // On a phone the peeking line opens the guide in full.
    if (ticker.classList.contains("peek")) return setFold("guide")
    const target = event.target as HTMLElement
    const off = target.closest<HTMLElement>("[data-dismiss]")
    if (off) {
      dismissed.add(off.dataset.dismiss!)
      return
    }
    // The guide: put this step away, or turn the guide off (the bottom-right button turns it back on).
    const skip = target.closest<HTMLElement>("[data-skip]")
    if (skip) {
      ui.guide.push({ type: "skip", id: skip.dataset.skip! })
      return
    }
    if (target.closest("[data-guide-off]")) {
      ui.guide.push({ type: "off" })
      ui.toast("Guide off · turn it back on from the bottom right")
      return
    }
    // A building the line is about: go to it.
    const go = target.closest<HTMLElement>("[data-go]")
    if (go) {
      const row = go.closest<HTMLElement>("[data-alert]")
      const there = row ? tickerLines.alerts[Number(row.dataset.alert)]?.places?.[go.dataset.go as KindId] : undefined
      if (there) goTo(there.at, there.size, there.id)
      return
    }
    const ref = target.closest<HTMLElement>("[data-kind]")
    if (ref) {
      const kind = ref.dataset.kind as KindId
      // Straight to placing it: the placement itself says if the town cannot build it yet.
      if (kinds[kind].buildable) place(kind)
      return
    }
    const line = target.closest<HTMLElement>(".cell.place")
    if (!line) return
    if (line.dataset.guide !== undefined && tickerLines.guide?.at) return goTo(tickerLines.guide.at, tickerLines.guide.size, tickerLines.guide.id)
    const alert = line.dataset.alert !== undefined ? tickerLines.alerts[Number(line.dataset.alert)] : undefined
    if (alert?.at) return goTo(alert.at, alert.size, alert.id)
    const news = line.dataset.news !== undefined ? tickerLines.news[Number(line.dataset.news)] : undefined
    if (news?.at) goTo(news.at, 1, null)
  }

  /** The last chronicle line announced. */
  let lastNews = ""
  /** The guide step last shown, and the timer that hides its peek. */
  let lastStep = ""
  let peekTimer = 0
  /** Copies the town's numbers and preview into the page, once a frame. */
  const syncPage = () => {
    syncPanel()
    const s = ui.stats
    if (s) {
      setHtml(coins, `${icon("coins", 20)}<span class="stack"><b>${s.coins}</b><small class="${s.net >= 0 ? "up" : "down"}">${s.net >= 0 ? "+" : ""}${s.net}/min</small></span>`)
      coins.title = "Coins in the treasury, and what it gains (or loses) a minute"
      coins.classList.toggle("debt", s.coins < 0)
      const left = Math.max(0, s.charter.term * 60 - Math.floor(s.minute * 60))
      const severity = (w: typeof s.season.coming) => (w === null ? "" : ` (${winters[w].title})`)
      const until = s.season.winter
        ? `${winters[s.season.severity ?? "normal"].title} winter · spring in ${clockText(s.season.left)}`
        : s.season.coming === null
          ? "no more winters this term"
          : `winter in ${clockText(s.season.left)}${severity(s.season.coming)}`
      setHtml(clock, `${icon(s.season.winter ? "winter" : "clock", 20)}<span class="stack"><b>${clockText(left)}</b><small class="${s.season.winter ? "winter" : s.season.coming === "hard" ? "down" : ""}">year ${s.season.year} · ${until}</small></span>`)
      clock.title = `${s.season.winter ? "Winter: fields lie still, fishing is slow, and homes eat faster" : "Time left in the term"}\nThe almanac: the coming winter is ${s.season.coming === null ? "beyond the term" : winters[s.season.coming].title}, the one after ${s.season.after === null ? "beyond the term" : winters[s.season.after].title}.\nMild: fishing at ${Math.round(winters.mild.fishing * 100)}%. Normal: ${Math.round(winters.normal.fishing * 100)}%. Hard: half as long again, fishing at ${Math.round(winters.hard.fishing * 100)}%, and homes heating are a fire risk.`
      const trend = s.mood.target > s.mood.approval ? "↑" : s.mood.target < s.mood.approval ? "↓" : ""
      setHtml(approval, `${icon("approval", 18)}<span class="stack"><b class="${s.mood.approval < 0 ? "down" : ""}">${signed(s.mood.approval)} <span class="${s.mood.target >= s.mood.approval ? "up" : "down"}">${trend}</span></b><small>approval</small></span>`)
      setHtml(settlerCell, `${icon("settlers", 18)}<span class="stack"><b>${s.settlers}</b><small>settlers</small></span>`)
      setHtml(citizenCell, `${icon("citizens", 18)}<span class="stack"><b>${s.citizens}</b><small>citizens${s.burghers > 0 ? ` · ${s.burghers} burghers` : ""}</small></span>`)
      const short = s.shortStaffed.length
      setHtml(jobs, `${icon("jobs", 18)}<span class="stack"><b>${s.employed}<span class="of">/${s.jobs}</span></b><small class="${short > 0 ? "down" : ""}">${short > 0 ? `${short} short · click` : "jobs filled"}</small></span>`)
      jobs.title = short > 0
        ? `Workers at work over workers needed. ${short} workplace${short > 1 ? "s are" : " is"} short: ${s.shortStaffed.slice(0, 5).map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? " (no homes within 15 road cells)" : ""}`).join(", ")}. Click to visit them in turn.`
        : "Workers at work over workers needed: every workplace has its crew. Residents walk at most 15 road cells to work."
      const chipHtml = (["planks", "stone", "tools"] as const)
        .map((g) => `<span class="${s.stock[g] === 0 ? "short" : ""}">${goodIcon(g, 14)}${s.stock[g]}</span>`)
        .join("")
      if (goodsChip.dataset.html !== chipHtml) {
        goodsChip.dataset.html = chipHtml
        goodsChip.innerHTML = chipHtml
      }
      for (const [g, count] of goodCells) {
        count.textContent = String(s.stock[g])
        count.parentElement!.classList.toggle("empty", s.stock[g] === 0)
      }
      // The crown's request.
      request.classList.toggle("show", s.crown.open && s.fate.state === "playing")
      if (s.crown.open) {
        const have = s.stock[s.crown.good]
        // What is asked on top, in one line; the terms under it.
        setHtml(
          requestText,
          `${icon("crown", 18)}<span class="lines"><span class="ask">the crown asks for <b>${s.crown.amount}</b> ${goodIcon(s.crown.good, 14)} <b>${goods[s.crown.good].title}</b></span>` +
            `<span class="terms"><span class="${have < s.crown.amount ? "down" : "up"}">${have} in store</span> · due in <b>${clockText(s.crown.left)}</b> · +${s.crown.reward} coins</span></span>`
        )
        send.title = have < s.crown.amount ? `Not enough ${goods[s.crown.good].title} in store yet` : `Send ${s.crown.amount} ${goods[s.crown.good].title} to the crown for ${s.crown.reward} coins`
        send.disabled = have < s.crown.amount
      }
      // What threatens the term, or is about to complete it.
      const warnings: Array<string> = []
      if (s.fate.state === "playing") {
        if (s.fate.bankrupt !== null)
          warnings.push(`<b>In debt:</b> bankrupt in ${clockText(s.fate.bankrupt)} unless the treasury recovers`)
        else if (s.coins < 0) warnings.push("<b>In debt:</b> wages are going unpaid")
        if (s.fate.revolt !== null) warnings.push(`<b>Uproar:</b> the town turns the mayor out in ${clockText(s.fate.revolt)}`)
        else if (s.mood.approval < -30) warnings.push("<b>Restless:</b> approval is falling towards revolt")
        if (s.fate.peak >= 40 && s.settlers + s.citizens < s.fate.peak * 0.4) warnings.push("<b>Emptying:</b> people are leaving the town")
        if (s.crown.streak > 0 && s.crown.streak >= s.crown.patience - 1) {
          warnings.push(`<b>The crown's patience:</b> ${s.crown.streak} requests missed in a row; one more and the mayor is dismissed`)
        }
        if (s.fate.complete !== null) warnings.push(`<b>Every goal met:</b> the town is complete in ${clockText(s.fate.complete)}`)
      }
      const html = warnings
        .map((w) => `<div class="cell">${icon(w.startsWith("<b>Every goal") ? "goal" : "warning", 16)}<span>${w}</span></div>`)
        .join("")
      if (alarm.dataset.html !== html) {
        alarm.dataset.html = html
        alarm.innerHTML = html
      }
      alarm.classList.toggle("show", warnings.length > 0)
      alarm.classList.toggle("good", warnings.length === 1 && s.fate.complete !== null)
      // The ticker: what needs looking at now, then the news of the last minute and a half; click a line to go there.
      const minute = Math.round(s.minute * 3600)
      const news = s.chronicle.filter((l) => l.alarm && minute - l.tick < 90 * 60).slice(-3).reverse()
      const ago = (tick: number) => {
        const sec = Math.max(0, Math.round((minute - tick) / 60))
        return sec < 5 ? "just now" : sec < 60 ? `${sec} s ago` : `${Math.round(sec / 60)} min ago`
      }
      const alerts = s.alerts.filter((a) => !dismissed.has(`a:${a.text}`))
      // The crown's request has its own card while it is open, and is settled after: its news line would only repeat it.
      const fresh = news.filter((l) => !dismissed.has(`n:${l.tick}:${l.text}`) && !l.text.startsWith("The crown asks"))
      const toneIcon = { hint: "hint", warn: "caution", bad: "warning" } as const
      const row = (kind: string, tone: string, glyph: IconName, text: string, place: boolean, key: string, data: string) =>
        `<div class="cell ${kind} ${tone}${place ? " place" : ""}" ${data}>${icon(glyph, 16, "mark")}<span class="text">${text}</span><span class="acts">${place ? `<button class="act locate" title="Show me where">${icon("locate", 14)}</button>` : ""}<button class="act dismiss" data-dismiss="${escapeHtml(key)}" title="Dismiss">${icon("close", 12)}</button></span></div>`
      // The guide's step first: what to do next, and why.
      const g = s.guide.step
      const guideHtml = g
        ? [
            `<div class="head guide"><span>guide · ${escapeHtml(g.chapter)}</span><span class="progress" title="Steps of the guide done">${s.guide.done} of ${s.guide.total} done</span><button class="quiet" data-guide-off title="Turn the guide off (the guide button in the bottom right turns it back on)">hide guide</button></div>`,
            `<div class="cell alert hint guide${g.at !== null ? " place" : ""}" data-guide>${icon("hint", 16, "mark")}<span class="text">${callouts(g.text)}<span class="goal">${icon("goal", 12)}<span>done when ${callouts(g.goal)}</span></span></span><span class="acts">${g.at !== null ? `<button class="act locate" title="Show me where">${icon("locate", 14)}</button>` : ""}<button class="act dismiss" data-skip="${escapeHtml(g.key)}" title="Skip this step">${icon("close", 12)}</button></span></div>`
          ]
        : []
      const tickerHtml = [
        ...guideHtml,
        ...(alerts.length > 0 ? [`<div class="head">now</div>`] : []),
        ...alerts.map((a) => row("alert", a.tone, toneIcon[a.tone], callouts(a.text, new Set(Object.keys(a.places ?? {}) as Array<KindId>)), a.at !== null, `a:${a.text}`, `data-alert="${s.alerts.indexOf(a)}"`)),
        ...(fresh.length > 0 ? [`<div class="head">lately</div>`] : []),
        ...fresh.map((l) => row("news", "", "chronicle", `${callouts(l.text)} <em data-tick="${l.tick}"></em>`, l.at !== null, `n:${l.tick}:${l.text}`, `data-news="${news.indexOf(l)}"`))
      ].join("")
      if (ticker.dataset.html !== tickerHtml) {
        ticker.dataset.html = tickerHtml
        ticker.innerHTML = tickerHtml
      }
      for (const em of ticker.querySelectorAll<HTMLElement>("em[data-tick]")) {
        const text = ago(Number(em.dataset.tick))
        if (em.textContent !== text) em.textContent = text
      }
      tickerLines = { guide: g, alerts: s.alerts, news }
      guideButton.classList.toggle("on", !s.guide.off)
      guideButton.title = s.guide.off ? "Turn the guide back on: a next step to take, and why, at the top of the ticker" : "Turn the guide off"
      ticker.classList.toggle("show", tickerHtml !== "" && s.fate.state === "playing")
      // The phone's guide button: the step it is on, or how many things need looking at.
      const bad = alerts.some((a) => a.tone === "bad")
      const badge = g ? `${s.guide.done + 1}/${s.guide.total}` : alerts.length > 0 ? String(alerts.length) : ""
      if (guideBadge.textContent !== badge) guideBadge.textContent = badge
      guideBulb.classList.toggle("alert", bad)
      // A new step peeks out above the tool bar for a few seconds.
      const stepKey = g?.key ?? ""
      // Not behind the town picker: the step waits until the town is founded.
      if (stepKey !== lastStep && !ui.founding) {
        lastStep = stepKey
        window.clearTimeout(peekTimer)
        ticker.classList.toggle("peek", stepKey !== "" && phone.matches && fold === null)
        if (stepKey !== "") peekTimer = window.setTimeout(() => ticker.classList.remove("peek"), 7000)
      }
      // News as it happens: a toast for each new alarm line.
      const latest = s.chronicle.at(-1)
      const seen = `${s.charter.seed}|${latest?.tick ?? -1}|${s.chronicle.length}`
      if (seen !== lastNews) {
        if (lastNews !== "" && latest?.alarm && minute - latest.tick < 120) ui.toast(latest.text)
        lastNews = seen
      }
      // The map view's legend.
      const l = ui.legend
      const legendHtml = l
        ? `<b>${l.title}</b>${l.keys.map((k) => `<span class="key"><i style="background:${hex(k.color)}"></i>${k.label}</span>`).join("")}<small>${l.note}</small>`
        : ""
      if (legend.dataset.html !== legendHtml) {
        legend.dataset.html = legendHtml
        legend.innerHTML = legendHtml
      }
      legend.classList.toggle("show", l !== null)
      syncReckoning(s)
    }
    input.sync()
    const screenPointer = input.pointer
    const text = ui.preview.tooltip
    if (text && screenPointer) {
      tooltip.textContent = text
      tooltip.style.display = "block"
      tooltip.style.left = `${Math.min(screenPointer.x, window.innerWidth - tooltip.offsetWidth - 20)}px`
      tooltip.style.top = `${screenPointer.y}px`
    } else tooltip.style.display = "none"
  }

  return { app, stage, ui, syncPage, resetPage, input, visit, visitFailed, visiting: () => visiting }
}
