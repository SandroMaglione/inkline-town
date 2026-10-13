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
  tierHome,
  winters,
  kinds,
  landIds,
  lands,
  mood as moodRules,
  needTitle,
  RESERVES,
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
import type { Stats, Tool, TradeMode, UiValue, View } from "./ui.ts"
import { emptyPreview } from "./ui.ts"
import { GameScene } from "./render3d/scene.ts"
import { MapInput } from "./render3d/input.ts"

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`
/** Seconds as m:ss. */
const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

export interface Persistence {
  readonly save: () => string | null
  readonly load: () => string | null
}

export const createHost = async (mount: HTMLElement, persistence: () => Persistence) => {
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
  const groups: ReadonlyArray<ReadonlyArray<GoodId>> = [
    ["wood", "planks", "stone", "tools"],
    ["fish", "smoked", "bread"],
    ["wool", "cloth"]
  ]
  const goodCells = new Map<GoodId, HTMLElement>()
  for (const group of groups) {
    const cell = el("div", "group")
    for (const g of group) {
      const item = el("span", "good")
      item.title = goods[g].title
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
  hud.append(bar, stock, request, alarm, ticker)
  const people = el("div", "hud right")
  const folk = el("div", "card bar")
  const approval = el("div", "cell")
  const settlerCell = el("div", "cell")
  const citizenCell = el("div", "cell")
  const jobs = el("div", "cell")
  folk.append(approval, settlerCell, citizenCell, jobs)
  people.append(folk)
  people.title = "Open the town's numbers, goals, and levers (T)"
  people.onclick = () => toggleMenu("town")
  const tooltip = el("div", "tooltip")
  const toastBox = el("div", "toast")
  const toolbar = el("div", "toolbar")
  const system = el("div", "system")
  const panel = el("aside", "panel")
  const dialog = el("div", "dialog")
  const confirmBox = el("div", "dialog")
  const reckoning = el("div", "dialog")
  const result = el("button", "result", "")
  result.onclick = () => showReckoning(true)
  // Map views, and the legend of the one shown.
  const views = el("div", "views")
  const legend = el("div", "card legend")
  document.body.append(hud, people, tooltip, toastBox, toolbar, system, panel, result, dialog, confirmBox, reckoning, views, legend)

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
    legend: null,
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
      tip: `Drag along a road to pave it: nicer to live beside · ${PAVE_COST.coins} coins and ${PAVE_COST.stone} stone a cell`
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
  const speedGroup = el("div", "group")
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
  let lastSpeed = 1
  const setSpeed = (speed: number) => {
    if (speed > 0) lastSpeed = speed
    ui.speed = speed
    for (const s of speeds) s.button.classList.toggle("on", s.speed === speed)
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
  views.append(iconEl("view", 16))
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
  }
  // New town, save, and load, out of the way in the bottom right. Founding or
  // loading replaces the town, so each asks first.
  const action = (name: IconName, label: string, tip: string, run: () => void) => {
    const button = el("button", "")
    button.title = tip
    button.append(iconEl(name), document.createTextNode(label))
    button.onclick = run
    system.append(button)
  }
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
    if (ui.founding || reckoning.classList.contains("open") || confirmBox.classList.contains("open")) return
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
    if (help) {
      const info = iconEl("info", 15)
      info.classList.add("help")
      info.title = help
      h3.append(info)
    }
    box.append(h3)
    return box
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
        const terms = el("span", "chips")
        terms.innerHTML = `${kind.workers > 0 ? `<span class="chip dim" title="workers: ${kind.crew}">${icon(kind.crew === "citizens" ? "citizens" : "settlers", 14)}${kind.workers}</span>` : ""}${kind.appeal ? `<span class="chip dim" title="desirability around it">${icon("appeal", 14)}${kind.appeal.value > 0 ? "+" : ""}${kind.appeal.value}</span>` : ""}<span class="chip dim" title="upkeep, coins a minute">${icon("upkeep", 14)}${kind.upkeep}/min</span>`
        const blurb = el("span", "blurb", kind.blurb)
        option.append(picture(id), el("span", "name", kind.title.toLowerCase()), cost.box, blurb)
        option.title = `${kind.title}: ${kind.blurb}${kind.workers > 0 ? ` · ${kind.workers} ${kind.crew === "citizens" ? "citizen" : "settler"} workers` : ""}${kind.appeal ? ` · desirability ${kind.appeal.value > 0 ? "+" : ""}${kind.appeal.value} out to ${kind.appeal.reach} cells` : ""} · ${kind.upkeep} coins a minute`
        cost.box.append(terms)
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
      const terms = el("span", "chips")
      terms.innerHTML = `<span class="chip dim" title="beauty it adds to its park">${icon("appeal", 14)}+${piece.beauty}</span><span class="chip dim" title="upkeep, coins a minute">${icon("upkeep", 14)}${piece.upkeep}/min</span>`
      const blurb = el("span", "blurb", piece.blurb)
      option.append(picture(`park:${id}`), el("span", "name", piece.title.toLowerCase()), cost.box, blurb)
      option.title = `${piece.title}: ${piece.blurb} · beauty +${piece.beauty}${ground ? " a cell" : ""} · ${piece.upkeep} coins a minute`
      cost.box.append(terms)
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
      "Coins a minute. Administration grows faster than the town. Three minutes in debt and the town is bankrupt."
    )
    const taxes = row(treasury, "taxes", "taxes")
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
      "Lower taxes raise approval, higher ones lower it, weighed by how many of each tier there are."
    )
    for (const tier of ["settlers", "citizens"] as const) {
      const line = el("div", "row lever")
      const minus = el("button", "frame step", "−")
      const value = el("span", "rate")
      const plus = el("button", "frame step", "+")
      const controls = el("span", "controls")
      controls.append(minus, value, plus)
      const name = el("span", "label")
      name.innerHTML = icon(tier, 16)
      name.append(document.createTextNode(tier))
      line.append(name, controls)
      const effect = el("p", "effect")
      levers.append(line, effect)
      const move = (by: number) => {
        const now = ui.stats?.policy[tier] ?? 100
        const i = TAX_STEPS.indexOf(now as (typeof TAX_STEPS)[number])
        const next = TAX_STEPS[Math.min(TAX_STEPS.length - 1, Math.max(0, (i < 0 ? 2 : i) + by))]!
        ui.edits.push({ type: "tax", tier, rate: next })
      }
      minus.onclick = () => move(-1)
      plus.onclick = () => move(1)
      live.push(() => {
        const rate = ui.stats?.policy[tier] ?? 100
        value.textContent = `${rate}%`
        const sway = Math.round((100 - rate) * moodRules.perTaxPoint)
        effect.textContent = sway === 0 ? "the usual rate" : `${signed(sway)} approval`
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
    const peopleLine = el("div", "spark")
    town.append(peopleLine)
    panel.append(town)

    const needs = section(
      "homes supplied",
      "homes",
      "Settlers need food (fish, smoked fish, or bread) from a market; citizens and burghers need bread, cloth, and faith. Fish rots in about three minutes and bread in five; a granary keeps them five times as long."
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
      "Traders buy what the town sells beyond what it keeps, and sell it what it buys up to that, at half again the price. Prices fall as the town sells and rise as it buys. Click sell / buy / — to change a good."
    )
    const reserveLine = el("div", "row lever")
    const reserveControls = el("span", "controls")
    const fewer = el("button", "frame step", "−")
    const reserveValue = el("span", "rate")
    const more = el("button", "frame step", "+")
    reserveControls.append(fewer, reserveValue, more)
    reserveLine.append(el("span", "label", "keep in store"), reserveControls)
    store.append(reserveLine)
    const stepReserve = (by: number) => {
      const now = ui.stats?.policy.reserve ?? 25
      const i = RESERVES.indexOf(now as (typeof RESERVES)[number])
      ui.edits.push({ type: "reserve", amount: RESERVES[Math.min(RESERVES.length - 1, Math.max(0, (i < 0 ? 1 : i) + by))]! })
    }
    fewer.onclick = () => stepReserve(-1)
    more.onclick = () => stepReserve(1)
    const modes: ReadonlyArray<TradeMode> = ["none", "sell", "buy"]
    const goodRows = goodIds.map((g) => {
      const line = el("div", "row good-row")
      const mode = el("button", "frame mode", "")
      mode.title = "Click to sell, buy, or neither"
      mode.onclick = () => {
        const s = ui.stats
        if (!s) return
        const now: TradeMode = s.policy.sells.includes(g) ? "sell" : s.policy.buys.includes(g) ? "buy" : "none"
        ui.edits.push({ type: "trade", good: g, mode: modes[(modes.indexOf(now) + 1) % modes.length]! })
      }
      const name = el("span", "label")
      name.innerHTML = goodIcon(g, 16)
      name.append(document.createTextNode(goods[g].title))
      const price = el("span", "price")
      name.append(price)
      const value = el("span", "count")
      const right = el("span", "label")
      right.append(value, mode)
      line.append(name, right)
      store.append(line)
      return { g, value, mode, price }
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
      money(traded, s.trade)
      money(upkeep, -s.upkeep)
      money(admin, -s.admin)
      money(net, s.net, " coins")
      settlers.textContent = String(s.settlers)
      citizens.textContent = String(s.citizens)
      burghers.textContent = String(s.burghers)
      homes.textContent = String(s.homes)
      work.textContent = `${s.employed} of ${s.jobs}`
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
      for (const r of goodRows) {
        const change = ago ? s.stock[r.g] - ago.stock[r.g] : 0
        r.value.innerHTML = `${s.stock[r.g]}${change !== 0 ? ` <small class="${change > 0 ? "up" : "down"}">${change > 0 ? "+" : ""}${change}/min</small>` : ""}`
        const now: TradeMode = s.policy.sells.includes(r.g) ? "sell" : s.policy.buys.includes(r.g) ? "buy" : "none"
        r.mode.textContent = now === "none" ? "—" : now
        r.mode.className = `frame mode ${now === "none" ? "" : now}`
        const price = now === "buy" ? askOf(r.g, s.prices[r.g]) : Math.round(priceOf(r.g, s.prices[r.g]) * 10) / 10
        r.price.textContent = `${price}c${s.prices[r.g] !== 100 ? ` (${s.prices[r.g]}%)` : ""}`
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

  /** An icon for a line of a building's or home's description, by what it is about. */
  const lineIcon = (text: string): IconName | GoodId => {
    if (text.startsWith("workers")) return "workers"
    if (text.startsWith("settlers within")) return "settlers"
    if (text.startsWith("citizens within")) return "citizens"
    if (text.startsWith("desirability")) return "appeal"
    if (text.startsWith("fire")) return "fire"
    if (text.startsWith("condition")) return "condition"
    if (text.startsWith("work:")) return "jobs"
    if (text.startsWith("tools") || text.startsWith("no tools")) return "tools"
    if (text.startsWith("on fire")) return "fire"
    if (text.startsWith("sick")) return "health"
    if (text.startsWith("upkeep")) return "upkeep"
    if (text.startsWith("pays")) return "coins"
    if (text.startsWith("needs")) return "homes"
    if (text.startsWith("to become")) return "citizens"
    if (text.startsWith("waiting")) return "planks"
    if (text.includes("residents")) return "people"
    if (text.includes("out on the roads")) return "settlers"
    if (text.startsWith("holds")) return "jobs"
    const made = goodIds.find((g) => text.includes(`${goods[g].title} ·`))
    return made ?? "info"
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
      while (rows.length < now.lines.length) {
        const line = el("div", "row")
        rows.push(line)
        box.append(line)
      }
      rows.forEach((row, i) => {
        const text = now.lines[i] ?? ""
        if (row.dataset.text === text) return
        row.dataset.text = text
        row.innerHTML = `<span class="label">${icon(lineIcon(text), 16)}<span></span></span>`
        row.querySelector(".label > span")!.textContent = text
      })
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
  openCharter(false)

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
  /** What became of a town whose term ran out. */
  const verdictOf = (s: Stats): string => {
    if (s.fate.governing) return "complete"
    const residents = s.settlers + s.citizens
    if (s.fate.peak < 40) return "the town never took root"
    if (residents >= sizes[s.charter.size].goal.residents * 0.75) return "flourishing"
    if (residents >= s.fate.peak * 0.7) return "holding on"
    return "declining"
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
    actions.append(again, look)
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

  /** The last chronicle line announced. */
  let lastNews = ""
  /** Copies the town's numbers and preview into the page, once a frame. */
  const syncPage = () => {
    syncPanel()
    const s = ui.stats
    if (s) {
      coins.innerHTML = `${icon("coins", 20)}<span class="stack"><b>${s.coins}</b><small class="${s.net >= 0 ? "up" : "down"}">${s.net >= 0 ? "+" : ""}${s.net}/min</small></span>`
      coins.title = "Coins in the treasury, and what it gains (or loses) a minute"
      coins.classList.toggle("debt", s.coins < 0)
      const left = Math.max(0, s.charter.term * 60 - Math.floor(s.minute * 60))
      const severity = (w: typeof s.season.coming) => (w === null ? "" : ` (${winters[w].title})`)
      const until = s.season.winter
        ? `${winters[s.season.severity ?? "normal"].title} winter · spring in ${clockText(s.season.left)}`
        : s.season.coming === null
          ? "no more winters this term"
          : `winter in ${clockText(s.season.left)}${severity(s.season.coming)}`
      clock.innerHTML = `${icon(s.season.winter ? "winter" : "clock", 20)}<span class="stack"><b>${clockText(left)}</b><small class="${s.season.winter ? "winter" : s.season.coming === "hard" ? "down" : ""}">year ${s.season.year} · ${until}</small></span>`
      clock.title = `${s.season.winter ? "Winter: fields lie still, fishing is slow, and homes eat faster" : "Time left in the term"}\nThe almanac: the coming winter is ${s.season.coming === null ? "beyond the term" : winters[s.season.coming].title}, the one after ${s.season.after === null ? "beyond the term" : winters[s.season.after].title}.\nMild: fishing at 75%. Normal: 50%. Hard: half as long again, fishing at 25%, and homes heating are a fire risk.`
      const trend = s.mood.target > s.mood.approval ? "↑" : s.mood.target < s.mood.approval ? "↓" : ""
      approval.innerHTML = `${icon("approval", 18)}<span class="stack"><b class="${s.mood.approval < 0 ? "down" : ""}">${signed(s.mood.approval)} <span class="${s.mood.target >= s.mood.approval ? "up" : "down"}">${trend}</span></b><small>approval</small></span>`
      settlerCell.innerHTML = `${icon("settlers", 18)}<span class="stack"><b>${s.settlers}</b><small>settlers</small></span>`
      citizenCell.innerHTML = `${icon("citizens", 18)}<span class="stack"><b>${s.citizens}</b><small>citizens${s.burghers > 0 ? ` · ${s.burghers} burghers` : ""}</small></span>`
      jobs.innerHTML = `${icon("jobs", 18)}<span class="stack"><b>${s.employed}<span class="of">/${s.jobs}</span></b><small>jobs</small></span>`
      for (const [g, count] of goodCells) {
        count.textContent = String(s.stock[g])
        count.parentElement!.classList.toggle("empty", s.stock[g] === 0)
      }
      // The crown's request.
      request.classList.toggle("show", s.crown.open && s.fate.state === "playing")
      if (s.crown.open) {
        const have = s.stock[s.crown.good]
        requestText.innerHTML = `${icon("crown", 18)}<span>the crown asks for <b>${s.crown.amount}</b> ${goodIcon(s.crown.good, 14)} <b>${goods[s.crown.good].title}</b> <span class="muted">(${have} in store)</span> · <b>${clockText(s.crown.left)}</b> · +${s.crown.reward} coins</span>`
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
      // The ticker: alerts now, and the news of the last minute and a half.
      const minute = Math.round(s.minute * 3600)
      const news = s.chronicle.filter((l) => l.alarm && minute - l.tick < 90 * 60).slice(-3).reverse()
      const tickerHtml = [
        ...s.alerts.map((a) => `<div class="cell">${icon("warning", 14)}<span>${a}</span></div>`),
        ...news.map((l) => `<div class="cell news">${icon("chronicle", 14)}<span>${l.text}</span></div>`)
      ].join("")
      if (ticker.dataset.html !== tickerHtml) {
        ticker.dataset.html = tickerHtml
        ticker.innerHTML = tickerHtml
      }
      ticker.classList.toggle("show", tickerHtml !== "" && s.fate.state === "playing")
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

  return { app, stage, ui, syncPage, resetPage, input }
}
