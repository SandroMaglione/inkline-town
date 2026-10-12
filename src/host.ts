/**
 * The page around the town: the Pixi stage and its layers, the camera (drag
 * to pan, wheel or pinch to zoom), the pointer turned into gestures, and the
 * top bar, toolbar, build menu, panel, tooltip, and toasts.
 */
import { Application, Container, Graphics } from "pixi.js"

import { drawFloor, type Stage } from "./art.ts"
import {
  appealOf, categoryColor, categoryOrder, costText, goodIds, goods, home, kindOrder, kinds, needTitle, RESERVES, ROAD_COST, TAX_STEPS,
  type GoodId, type Kind, type KindId
} from "./content.ts"
import { GRID, toScreen, type Point } from "./iso.ts"
import type { Tool, UiValue } from "./ui.ts"
import { emptyPreview } from "./ui.ts"

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`

export interface Persistence {
  readonly save: () => string | null
  readonly load: () => string | null
}

export const createHost = async (mount: HTMLElement, persistence: () => Persistence) => {
  const app = new Application()
  await app.init({
    resizeTo: window,
    antialias: true,
    background: 0xf0f2ec,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true
  })
  mount.appendChild(app.canvas)

  // ── Layers ──
  const world = new Container()
  const floor = new Graphics()
  drawFloor(floor)
  const ground = new Graphics()
  const plates = new Container()
  const roads = new Graphics()
  const preview = new Container()
  const overlay = new Graphics()
  preview.addChild(overlay)
  const objects = new Container({ sortableChildren: true })
  const ghost = new Graphics()
  ghost.zIndex = 1e6
  objects.addChild(ghost)
  const labels = new Container()
  world.addChild(floor, ground, plates, roads, preview, objects, labels)
  app.stage.addChild(world)
  const stage: Stage = { world, ground, plates, roads, preview, objects, labels, overlay, ghost }

  // ── Camera ──
  const centre = toScreen(GRID / 2, GRID / 2)
  // Zoom steps at which a unit (2 × 1 px at 1×) is still a whole number of
  // device pixels on a 2× screen, so the drawing stays on its lattice.
  const zooms = [0.5, 1, 1.5, 2] as const
  let zoom: number = window.innerWidth >= 1200 && window.innerHeight >= 800 ? 1 : 0.5
  const look = { x: centre.x, y: centre.y }
  const placeCamera = () => {
    world.scale.set(zoom)
    const dpr = app.renderer.resolution
    world.position.set(
      Math.round((app.screen.width / 2 - look.x * zoom) * dpr) / dpr,
      Math.round((app.screen.height / 2 - look.y * zoom) * dpr) / dpr
    )
  }
  placeCamera()
  app.renderer.on("resize", placeCamera)
  const toWorld = (sx: number, sy: number): Point => ({ x: (sx - world.position.x) / zoom, y: (sy - world.position.y) / zoom })
  const zoomTo = (sx: number, sy: number, next: number) => {
    const before = toWorld(sx, sy)
    zoom = Math.min(2, Math.max(0.5, next))
    look.x = before.x - (sx - app.screen.width / 2) / zoom
    look.y = before.y - (sy - app.screen.height / 2) / zoom
    placeCamera()
  }

  // ── DOM ──
  // The top bar: treasury, people, and jobs in one strip; the goods in stock below, grouped.
  const hud = el("div", "hud")
  const bar = el("div", "card bar")
  const coins = el("div", "cell coins")
  const people = el("div", "cell")
  const jobs = el("div", "cell")
  bar.append(coins, people, jobs)
  const stock = el("div", "card stock")
  const groups: ReadonlyArray<ReadonlyArray<GoodId>> = [["wood", "planks", "stone", "tools"], ["fish", "bread"], ["wool", "cloth"]]
  const goodCells = new Map<GoodId, HTMLElement>()
  for (const group of groups) {
    const cell = el("div", "cell")
    for (const g of group) {
      const item = el("span", "good")
      const swatch = el("span", "label")
      swatch.style.background = hex(goods[g].color)
      const count = el("span", "count", "0")
      item.append(swatch, document.createTextNode(goods[g].title), count)
      cell.append(item)
      goodCells.set(g, count)
    }
    stock.append(cell)
  }
  hud.append(bar, stock)
  hud.title = "Open the town's numbers and taxes"
  hud.onclick = () => toggleMenu("town")
  const tooltip = el("div", "tooltip")
  const toastBox = el("div", "toast")
  const toolbar = el("div", "toolbar")
  const panel = el("aside", "panel")
  document.body.append(hud, tooltip, toastBox, toolbar, panel)

  let toastTimer = 0
  const ui: UiValue = {
    tool: "select",
    placing: null,
    menu: null,
    pointer: null,
    dragFrom: null,
    selected: null,
    gestures: [],
    edits: [{ type: "newTown", seed: (Date.now() & 0x7fffffff) >>> 0 }],
    preview: emptyPreview(),
    hits: [],
    panel: null,
    centres: new Map(),
    stats: null,
    toast: (message) => {
      toastBox.textContent = message
      toastBox.classList.add("show")
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => toastBox.classList.remove("show"), 1800)
    }
  }

  const tools: ReadonlyArray<{ readonly tool: Tool | "build" | "town"; readonly label: string; readonly key: string; readonly swatch: string; readonly tip: string }> = [
    { tool: "select", label: "select", key: "S", swatch: "round", tip: "Click a building or home to see what it does · drag to pan · wheel to zoom" },
    { tool: "road", label: "road", key: "R", swatch: "#e6e8e2", tip: `Drag to lay a road · ${ROAD_COST} coins a cell` },
    { tool: "home", label: "homes", key: "H", swatch: "#c4523f", tip: `Drag to lay a row of homes along a road · ${costText(home.cost)} each` },
    { tool: "build", label: "build", key: "B", swatch: "#3d6db5", tip: "Choose a building, then click to place it · Esc to stop" },
    { tool: "bulldoze", label: "bulldoze", key: "X", swatch: "#8f9891", tip: "Click a building, home, road, tree, or field to remove it" },
    { tool: "town", label: "town", key: "T", swatch: "#8a58a8", tip: "The town's numbers, history, and taxes" }
  ]
  const buttons = tools.map((tool) => {
    const button = el("button", "")
    button.title = tool.tip
    const swatch = el("span", "swatch")
    if (tool.swatch === "round") swatch.style.borderRadius = "50%"
    else swatch.style.background = tool.swatch
    button.append(swatch, document.createTextNode(tool.label), el("kbd", "", tool.key))
    button.onclick = () => (tool.tool === "build" || tool.tool === "town" ? toggleMenu(tool.tool) : choose(tool.tool))
    toolbar.append(button)
    return { tool, button }
  })
  toolbar.append(el("span", "sep"))
  const action = (label: string, tip: string, run: () => void) => {
    const button = el("button", "", label)
    button.title = tip
    button.onclick = run
    toolbar.append(button)
  }
  action("new town", "Found a new town on new land", () => {
    ui.edits.push({ type: "newTown", seed: (Date.now() & 0x7fffffff) >>> 0 })
    history.length = 0
    choose("select")
  })
  action("save", "Save the town in this browser", () => ui.toast(persistence().save() ?? "Saved"))
  action("load", "Load the saved town", () => ui.toast(persistence().load() ?? "Loaded"))

  const refreshTools = () => {
    for (const { tool, button } of buttons) {
      const on = tool.tool === "build" ? ui.menu === "build" || ui.tool === "place" : tool.tool === "town" ? ui.menu === "town" : tool.tool === ui.tool
      button.classList.toggle("on", on)
    }
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
  choose("select")

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (ui.tool !== "select") choose("select")
      else if (ui.menu) ui.menu = null
      else ui.selected = null
      refreshTools()
    }
    const key = event.key.toLowerCase()
    if (key === "s") choose("select")
    if (key === "r") choose("road")
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
    const points = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join(" ")
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="#3d4943" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`
  }

  // ── Panel ──
  /** Volatile parts of the panel, updated in place without rebuilding it. */
  let live: Array<() => void> = []
  let shape = ""

  const section = (heading: string) => {
    const box = el("section", "")
    box.append(el("h3", "", heading))
    return box
  }
  const header = (title: string) => {
    const head = el("header", "")
    const closeButton = el("button", "frame", "Close")
    closeButton.onclick = () => {
      ui.selected = null
      ui.menu = null
      refreshTools()
    }
    head.append(el("h2", "", title), closeButton)
    return head
  }

  const lockText = (kind: Kind): string | null => {
    const s = ui.stats
    if (!s) return null
    const residents = s.settlers + s.citizens
    if (residents < kind.unlock.residents) return `needs ${kind.unlock.residents} residents`
    if (s.citizens < kind.unlock.citizens) return `needs ${kind.unlock.citizens} citizens`
    return null
  }
  const shortText = (cost: Kind["cost"]): string | null => {
    const s = ui.stats
    if (!s) return null
    if (s.coins < cost.coins) return "not enough coins"
    for (const [g, n] of Object.entries(cost.materials)) if (s.stock[g as keyof typeof s.stock] < (n ?? 0)) return `not enough ${g}`
    return null
  }

  const buildMenu = () => {
    panel.append(header("build"))
    panel.append(el("p", "sub", `Choose, then click on the map to place · Esc to stop. Roads ${ROAD_COST} coins a cell (R), homes ${costText(home.cost)} (H).`))
    for (const category of categoryOrder) {
      const options = kindOrder.filter((id) => kinds[id].category === category && kinds[id].buildable)
      if (options.length === 0) continue
      const box = section(category)
      box.querySelector("h3")!.style.borderBottomColor = hex(categoryColor[category])
      for (const id of options) {
        const kind = kinds[id]
        const option = el("button", "option")
        const top = el("span", "row")
        top.append(el("span", "name", kind.title.toLowerCase()), el("span", "count", costText(kind.cost)))
        const blurb = el("span", "blurb", "")
        option.append(top, blurb)
        option.onclick = () => place(id)
        live.push(() => {
          const lock = lockText(kind)
          const short = lock ? null : shortText(kind.cost)
          option.disabled = lock !== null
          option.classList.toggle("short", short !== null)
          blurb.textContent = lock ?? `${kind.blurb} · ${kind.workers} workers · ${kind.upkeep}/min${short ? ` · ${short}` : ""}`
        })
        box.append(option)
      }
      panel.append(box)
    }
  }

  const row = (box: HTMLElement, label: string) => {
    const line = el("div", "row")
    const value = el("span", "count")
    line.append(el("span", "", label), value)
    box.append(line)
    return value
  }

  const townPanel = () => {
    panel.append(header("town"))
    const sub = el("p", "sub")
    panel.append(sub)

    const treasury = section("treasury")
    const taxes = row(treasury, "taxes")
    const traded = row(treasury, "trade")
    const upkeep = row(treasury, "upkeep")
    const net = row(treasury, "a minute")
    const coinLine = el("div", "spark")
    treasury.append(coinLine)
    panel.append(treasury)

    const levers = section("taxes")
    for (const tier of ["settlers", "citizens"] as const) {
      const line = el("div", "row lever")
      const minus = el("button", "frame step", "−")
      const value = el("span", "rate")
      const plus = el("button", "frame step", "+")
      const controls = el("span", "controls")
      controls.append(minus, value, plus)
      line.append(el("span", "", tier), controls)
      const effect = el("p", "empty")
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
        const appeal = Math.round((appealOf(rate) - 1) * 100)
        effect.textContent = appeal === 0
          ? "the usual rate"
          : appeal > 0
          ? `homes keep up to ${appeal}% more residents when short of needs`
          : `homes hold ${-appeal}% fewer residents`
      })
    }
    panel.append(levers)

    const town = section("people")
    const settlers = row(town, "settlers")
    const citizens = row(town, "citizens")
    const homes = row(town, "homes")
    const work = row(town, "jobs filled")
    const peopleLine = el("div", "spark")
    town.append(peopleLine)
    panel.append(town)

    const needs = section("homes supplied")
    const bars = (["food", "bread", "cloth", "faith"] as const).map((n) => {
      const line = el("div", "need")
      const label = el("span", "", needTitle[n])
      const track = el("span", "track")
      const fill = el("span", "fill")
      track.append(fill)
      const value = el("span", "count")
      line.append(label, track, value)
      needs.append(line)
      return { n, fill, value }
    })
    panel.append(needs)

    const store = section("goods and trade")
    const reserveLine = el("div", "row lever")
    const reserveControls = el("span", "controls")
    const fewer = el("button", "frame step", "−")
    const reserveValue = el("span", "rate")
    const more = el("button", "frame step", "+")
    reserveControls.append(fewer, reserveValue, more)
    reserveLine.append(el("span", "", "keep before selling"), reserveControls)
    store.append(reserveLine)
    const stepReserve = (by: number) => {
      const now = ui.stats?.policy.reserve ?? 25
      const i = RESERVES.indexOf(now as (typeof RESERVES)[number])
      ui.edits.push({ type: "reserve", amount: RESERVES[Math.min(RESERVES.length - 1, Math.max(0, (i < 0 ? 1 : i) + by))]! })
    }
    fewer.onclick = () => stepReserve(-1)
    more.onclick = () => stepReserve(1)
    store.append(el("p", "empty", "Ticked goods are sold to traders beyond what the town keeps, for the price shown."))
    const goodRows = goodIds.map((g) => {
      const line = el("label", "row good-row")
      const box = el("input", "")
      box.type = "checkbox"
      box.onchange = () => ui.edits.push({ type: "sell", good: g, on: box.checked })
      const name = el("span", "", `${goods[g].title} · ${goods[g].price}c`)
      const left = el("span", "")
      left.append(box, name)
      const value = el("span", "count")
      line.append(left, value)
      store.append(line)
      return { g, value, box }
    })
    panel.append(store)

    live.push(() => {
      const s = ui.stats
      if (!s) return
      sub.textContent = `${s.settlers + s.citizens} residents · ${s.coins} coins`
      taxes.textContent = `+${s.taxes}`
      traded.textContent = `+${s.trade}`
      upkeep.textContent = `−${s.upkeep}`
      net.textContent = `${s.net >= 0 ? "+" : ""}${s.net} coins`
      settlers.textContent = String(s.settlers)
      citizens.textContent = String(s.citizens)
      homes.textContent = String(s.homes)
      work.textContent = `${s.employed} of ${s.jobs}`
      for (const b of bars) {
        const share = s.homes > 0 ? s.needs[b.n] / s.homes : 0
        b.fill.style.width = `${Math.round(share * 100)}%`
        b.value.textContent = `${s.needs[b.n]} of ${s.homes}`
      }
      // Goods' change over the last minute of samples.
      const ago = history[Math.max(0, history.length - 1 - Math.round(60 / SAMPLE_SECONDS))]
      reserveValue.textContent = String(s.policy.reserve)
      for (const r of goodRows) {
        const change = ago ? s.stock[r.g] - ago.stock[r.g] : 0
        r.value.textContent = `${s.stock[r.g]}${change !== 0 ? `  ${change > 0 ? "+" : ""}${change}/min` : ""}`
        const selling = s.policy.sells.includes(r.g)
        if (r.box.checked !== selling) r.box.checked = selling
      }
      const coinsSvg = sparkline(history.map((h) => h.coins))
      if (coinLine.dataset.svg !== coinsSvg) {
        coinLine.dataset.svg = coinsSvg
        coinLine.innerHTML = coinsSvg
      }
      const peopleSvg = sparkline(history.map((h) => h.residents))
      if (peopleLine.dataset.svg !== peopleSvg) {
        peopleLine.dataset.svg = peopleSvg
        peopleLine.innerHTML = peopleSvg
      }
    })
  }

  const buildPanel = () => {
    const p = ui.panel
    live = []
    panel.replaceChildren()
    if (!p) return
    if (p.type === "build") return buildMenu()
    if (p.type === "town") return townPanel()

    const title = p.type === "building" ? kinds[p.kind].title.toLowerCase() : `${home.tiers[p.tier].title}' home`
    const status = el("p", "sub")
    panel.append(header(title), status)
    const box = section(p.type === "building" ? "at work" : "household")
    const rows: Array<HTMLElement> = []
    panel.append(box)
    live.push(() => {
      const now = ui.panel
      if (!now || now.type === "build" || now.type === "town" || now.type !== p.type) return
      if (now.type === "building") {
        status.textContent = now.problem ?? `${now.status} · ${kinds[now.kind].blurb}`
        status.classList.toggle("warn", now.problem !== null)
      } else status.textContent = now.tier === 1 ? "settlers: fish or bread from a market keeps them" : "citizens: they need bread, cloth, and faith"
      while (rows.length < now.lines.length) {
        const line = el("div", "row")
        rows.push(line)
        box.append(line)
      }
      rows.forEach((row, i) => (row.textContent = now.lines[i] ?? ""))
    })
    if (!(p.type === "building" && p.kind === "townhall")) {
      const actions = el("div", "actions")
      const remove = el("button", "frame danger", "Remove")
      remove.onclick = () => ui.edits.push({ type: "remove", cell: p.cell })
      actions.append(remove)
      panel.append(actions)
    }
  }

  /** Rebuilds the panel when what it shows changes, and refreshes its numbers every frame. */
  const syncPanel = () => {
    const p = ui.panel
    const next = p === null ? "" : p.type === "build" || p.type === "town" ? p.type : `${p.type}|${p.id}|${p.type === "house" ? p.tier : ""}`
    if (next !== shape) {
      shape = next
      // Keep the old contents while the closed panel slides away.
      if (p !== null) buildPanel()
      panel.classList.toggle("open", p !== null)
      refreshTools()
    }
    for (const update of live) update()
  }

  // ── Pointer ──
  const canvas = app.canvas
  const pointers = new Map<number, Point>()
  let press: { id: number; start: Point; last: Point; pan: boolean; panned: boolean } | null = null
  let pinch: { distance: number } | null = null
  let screenPointer: Point | null = null
  let wheel = 0

  const spread = () => {
    const [a, b] = [...pointers.values()]
    return a && b ? { distance: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } : null
  }

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId)
    const at = { x: event.clientX, y: event.clientY }
    pointers.set(event.pointerId, at)
    screenPointer = at
    ui.pointer = toWorld(at.x, at.y)
    if (pointers.size === 2) {
      pinch = { distance: spread()!.distance }
      press = null
      ui.dragFrom = null
      return
    }
    // Roads and homes are laid by dragging; with any other tool a drag pans.
    const pan = event.button !== 0 || (ui.tool !== "road" && ui.tool !== "home")
    press = { id: event.pointerId, start: at, last: at, pan, panned: false }
    if (event.button === 0) ui.gestures.push({ type: "press", at: toWorld(at.x, at.y) })
  })

  canvas.addEventListener("pointermove", (event) => {
    const at = { x: event.clientX, y: event.clientY }
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, at)
    if (pinch && pointers.size === 2) {
      const now = spread()!
      zoomTo(now.mid.x, now.mid.y, zoom * (now.distance / pinch.distance))
      pinch.distance = now.distance
      return
    }
    screenPointer = at
    ui.pointer = toWorld(at.x, at.y)
    if (press && press.id === event.pointerId && press.pan) {
      if (!press.panned && Math.hypot(at.x - press.start.x, at.y - press.start.y) > 6) press.panned = true
      if (press.panned) {
        look.x -= (at.x - press.last.x) / zoom
        look.y -= (at.y - press.last.y) / zoom
        placeCamera()
      }
    }
    if (press) press.last = at
  })

  const release = (event: PointerEvent, cancelled: boolean) => {
    pointers.delete(event.pointerId)
    if (pinch && pointers.size < 2) {
      pinch = null
      const nearest = zooms.reduce((best, z) => (Math.abs(z - zoom) < Math.abs(best - zoom) ? z : best), zooms[0])
      zoomTo(event.clientX, event.clientY, nearest)
    }
    if (press && press.id === event.pointerId) {
      const at = toWorld(event.clientX, event.clientY)
      ui.gestures.push({ type: "release", at, panned: press.panned || cancelled || event.button !== 0 })
      press = null
    }
    if (event.pointerType !== "mouse") {
      ui.pointer = null
      screenPointer = null
    }
  }
  canvas.addEventListener("pointerup", (event) => release(event, false))
  canvas.addEventListener("pointercancel", (event) => release(event, true))
  canvas.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" && !press) {
      ui.pointer = null
      screenPointer = null
    }
  })
  canvas.addEventListener("contextmenu", (event) => event.preventDefault())
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault()
    wheel += event.deltaY
    if (Math.abs(wheel) < 40) return
    const index = zooms.findIndex((z) => z >= zoom - 1e-6)
    const next = zooms[Math.min(zooms.length - 1, Math.max(0, index + (wheel > 0 ? -1 : 1)))]!
    wheel = 0
    zoomTo(event.clientX, event.clientY, next)
  }, { passive: false })

  /** Copies the town's numbers and preview into the page, once a frame. */
  const syncPage = () => {
    syncPanel()
    const s = ui.stats
    if (s) {
      coins.innerHTML = `<b>${s.coins}</b> coins <span class="${s.net >= 0 ? "up" : "down"}">${s.net >= 0 ? "+" : ""}${s.net}/min</span>`
      coins.classList.toggle("debt", s.coins < 0)
      people.textContent = `${s.settlers} settlers · ${s.citizens} citizens`
      jobs.textContent = `${s.employed}/${s.jobs} jobs`
      for (const [g, count] of goodCells) count.textContent = String(s.stock[g])
    }
    const text = ui.preview.tooltip
    if (text && screenPointer) {
      tooltip.textContent = text
      tooltip.style.display = "block"
      tooltip.style.left = `${Math.min(screenPointer.x, window.innerWidth - tooltip.offsetWidth - 20)}px`
      tooltip.style.top = `${screenPointer.y}px`
    } else tooltip.style.display = "none"
    canvas.style.cursor = press?.panned ? "grabbing" : ui.preview.hover !== null || ui.tool !== "select" ? "pointer" : "default"
  }

  return { app, stage, ui, syncPage }
}
