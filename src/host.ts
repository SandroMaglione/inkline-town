/**
 * The page around the yard: the Pixi stage and its layers, the camera (drag
 * to pan, wheel or pinch to zoom), the pointer turned into intents, and the
 * toolbar, stats, tooltip, and toasts.
 */
import { Application, Container, Graphics } from "pixi.js"

import { drawFloor, type Stage } from "./art.ts"
import { GRID, toScreen, type Point } from "./iso.ts"
import { kindOrder, kinds } from "./kinds.ts"
import type { Intent, Mode, PanelLink, UiValue } from "./schema.ts"

/** A small yard to start from, like a repository's packages feeding each other. */
const demo: ReadonlyArray<Intent> = [
  { type: "place", kind: "source", cell: { x: 2, y: 12 } },
  { type: "place", kind: "source", cell: { x: 3, y: 4 } },
  { type: "place", kind: "plant", cell: { x: 9, y: 9 } },
  { type: "place", kind: "workshop", cell: { x: 10, y: 2 } },
  { type: "place", kind: "workshop", cell: { x: 16, y: 7 } },
  { type: "place", kind: "workshop", cell: { x: 9, y: 16 } },
  { type: "place", kind: "depot", cell: { x: 20, y: 13 } },
  { type: "place", kind: "depot", cell: { x: 16, y: 19 } },
  { type: "link", from: { x: 2, y: 12 }, to: { x: 9, y: 9 } },
  { type: "link", from: { x: 3, y: 4 }, to: { x: 9, y: 9 } },
  { type: "link", from: { x: 3, y: 4 }, to: { x: 10, y: 2 } },
  { type: "link", from: { x: 10, y: 2 }, to: { x: 16, y: 7 } },
  { type: "link", from: { x: 9, y: 9 }, to: { x: 16, y: 7 } },
  { type: "link", from: { x: 9, y: 9 }, to: { x: 9, y: 16 } },
  { type: "link", from: { x: 16, y: 7 }, to: { x: 20, y: 13 } },
  { type: "link", from: { x: 9, y: 16 }, to: { x: 16, y: 19 } }
]

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

export const createHost = async (mount: HTMLElement) => {
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
  const plates = new Container()
  const belts = new Container()
  const preview = new Container()
  const overlay = new Graphics()
  preview.addChild(overlay)
  const objects = new Container({ sortableChildren: true })
  const ghost = new Graphics()
  objects.addChild(ghost)
  const labels = new Container()
  world.addChild(floor, plates, belts, preview, objects, labels)
  app.stage.addChild(world)
  const stage: Stage = { world, plates, belts, preview, objects, labels, overlay, ghost }

  // ── Camera ──
  const centre = toScreen(GRID / 2, GRID / 2)
  // Zoom steps at which a unit (2 × 1 px at 1×) is still a whole number of
  // device pixels on a 2× screen, so the drawing stays on its lattice.
  const zooms = [0.5, 1, 1.5, 2] as const
  let zoom: number = window.innerWidth >= 1200 && window.innerHeight >= 800 ? 1 : 0.5
  const look = { x: centre.x, y: centre.y }
  const placeCamera = () => {
    world.scale.set(zoom)
    // Whole device pixels, so lines land where the lattice puts them.
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

  /** Glides the camera to a world point, leaving room for the panel on the right. */
  let glide: Point | null = null
  const lookAt = (at: Point) => {
    glide = { x: at.x + panelWidth() / 2 / zoom, y: at.y - 30 }
  }

  // ── DOM ──
  const hud = el("div", "hud")
  const title = el("h1", "", "factory yard")
  const stats = el("div", "stats")
  hud.append(title, stats)
  const hint = el("div", "hint")
  hint.innerHTML = "tap the ground: build there<br>tap a factory: what it takes and feeds<br>drag factory → factory: belt<br>drag empty ground: pan · wheel: zoom<br>X bulldoze · Esc close"
  const tooltip = el("div", "tooltip")
  const toastBox = el("div", "toast")
  const toolbar = el("div", "toolbar")
  const panel = el("aside", "panel")
  document.body.append(hud, hint, tooltip, toastBox, toolbar, panel)
  const panelWidth = () => (panel.classList.contains("open") ? panel.offsetWidth : 0)

  let toastTimer = 0
  const ui: UiValue = {
    mode: "select",
    plot: null,
    plotKind: null,
    linkFrom: null,
    pointer: null,
    dragFrom: null,
    selected: null,
    intents: [...demo],
    preview: { ghost: null, plots: [], path: null, hoverFactory: null, hoverBelt: null, focus: null, danger: false, tooltip: null },
    hits: [],
    panel: null,
    centres: new Map(),
    stats: { factories: 0, belts: 0, crates: 0, shipped: 0 },
    toast: (message) => {
      toastBox.textContent = message
      toastBox.classList.add("show")
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => toastBox.classList.remove("show"), 1600)
    }
  }

  const tools: ReadonlyArray<{ readonly mode: Mode; readonly label: string; readonly key: string }> = [
    { mode: "select", label: "select", key: "S" },
    { mode: "bulldoze", label: "bulldoze", key: "X" }
  ]
  const buttons = tools.map((tool) => {
    const button = el("button", "")
    const swatch = el("span", "swatch")
    if (tool.mode === "select") swatch.style.borderRadius = "50%"
    if (tool.mode === "bulldoze") swatch.style.background = "#c4523f"
    button.append(swatch, document.createTextNode(tool.label), el("kbd", "", tool.key))
    button.onclick = () => choose(tool.mode)
    toolbar.append(button)
    return { tool, button }
  })
  toolbar.append(el("span", "sep"))
  const demoButton = el("button", "", "demo")
  demoButton.onclick = () => ui.intents.push({ type: "clear" }, ...demo)
  const clearButton = el("button", "", "clear")
  clearButton.onclick = () => ui.intents.push({ type: "clear" })
  toolbar.append(demoButton, clearButton)

  const close = () => {
    ui.selected = null
    ui.plot = null
    ui.plotKind = null
    ui.linkFrom = null
  }

  const choose = (mode: Mode) => {
    ui.mode = mode
    ui.dragFrom = null
    if (mode === "bulldoze") close()
    for (const { tool, button } of buttons) button.classList.toggle("on", tool.mode === mode)
  }
  choose("select")

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (ui.linkFrom !== null) ui.linkFrom = null
      else if (ui.mode !== "select") choose("select")
      else close()
    }
    if (event.key === "s" || event.key === "S") choose("select")
    if (event.key === "x" || event.key === "X") choose("bulldoze")
  })

  // ── Panel ──
  /** Volatile numbers the panel shows, updated in place without rebuilding it. */
  let live: Array<() => void> = []
  let shape = ""

  const section = (heading: string) => {
    const box = el("section", "")
    box.append(el("h3", "", heading))
    return box
  }

  const openFactory = (id: number) => {
    ui.selected = id
    ui.plot = null
    ui.linkFrom = null
    const at = ui.centres.get(id)
    if (at) lookAt(at)
  }

  const factoryRows = (box: HTMLElement, links: ReadonlyArray<PanelLink>, which: "takes" | "feeds") => {
    links.forEach((link, index) => {
      const row = el("div", "row")
      const name = el("button", "link", `${kinds[link.kind].title.toLowerCase()}/${link.name}`)
      name.onclick = () => openFactory(link.id)
      const count = el("span", "count")
      row.append(name, count)
      box.append(row)
      live.push(() => {
        const p = ui.panel
        const now = p?.type === "factory" ? p[which][index] : undefined
        count.textContent = now ? `${now.crates} crate${now.crates === 1 ? "" : "s"}` : ""
      })
    })
  }

  const buildPanel = () => {
    const p = ui.panel
    live = []
    panel.replaceChildren()
    if (!p) return
    const head = el("header", "")
    const closeButton = el("button", "frame", "Close")
    closeButton.onclick = close
    if (p.type === "plot") {
      head.append(el("h2", "", `plot ${p.x},${p.y}`), closeButton)
      panel.append(head, el("p", p.free ? "sub" : "sub warn", p.reason))
      const box = section("build here")
      for (const id of kindOrder) {
        const kind = kinds[id]
        const row = el("button", "option")
        row.disabled = !p.free
        const top = el("span", "row")
        top.append(el("span", "name", kind.title.toLowerCase()), el("span", "count", kind.needs === 0 ? `makes ${kind.makes}` : kind.makes === 0 ? `ships ${kind.needs}` : `takes ${kind.needs}, makes ${kind.makes}`))
        row.append(top, el("span", "blurb", `${kind.blurb} · ${kind.period}s a job`))
        row.onmouseenter = () => (ui.plotKind = id)
        row.onmouseleave = () => {
          if (ui.plotKind === id) ui.plotKind = null
        }
        row.onclick = () => ui.intents.push({ type: "build", kind: id })
        box.append(row)
      }
      panel.append(box)
      return
    }

    const kind = kinds[p.kind]
    head.append(el("h2", "", `${kind.title.toLowerCase()}/${p.name}`), closeButton)
    const status = el("p", "sub")
    const numbers = el("p", "sub")
    panel.append(head, status, numbers)
    live.push(() => {
      const now = ui.panel
      if (now?.type !== "factory") return
      status.textContent = `${now.status} · ${kind.blurb}`
      numbers.textContent = now.kind === "depot"
        ? `${now.inputs} waiting · ${now.made} shipped`
        : now.kind === "source"
        ? `${now.outputs} ready · ${now.made} made`
        : `${now.inputs} in · ${now.outputs} out · ${now.made} jobs done`
    })

    const takes = section("takes from")
    if (kind.needs === 0) takes.append(el("p", "empty", "nothing: it makes crates from nothing"))
    else if (p.takes.length === 0) takes.append(el("p", "empty", "no belts in yet: drag one here from another factory"))
    factoryRows(takes, p.takes, "takes")
    const feeds = section("feeds")
    if (kind.makes === 0) feeds.append(el("p", "empty", "nothing: it ships crates out of the yard"))
    else if (p.feeds.length === 0) feeds.append(el("p", "empty", "no belts out yet: connect it to send its crates on"))
    factoryRows(feeds, p.feeds, "feeds")
    panel.append(takes, feeds)

    const actions = el("div", "actions")
    if (kind.makes > 0) {
      const connect = el("button", "frame", p.linking ? "Tap a factory… (cancel)" : "Connect to…")
      connect.onclick = () => {
        ui.linkFrom = p.linking ? null : p.id
        if (!p.linking) ui.toast("Tap the factory to send crates to")
      }
      actions.append(connect)
    }
    const remove = el("button", "frame danger", "Remove")
    remove.onclick = () => ui.intents.push({ type: "remove", factory: p.id })
    actions.append(remove)
    panel.append(actions)
  }

  /** Rebuilds the panel when what it lists changes, and refreshes its numbers every frame. */
  const syncPanel = () => {
    const p = ui.panel
    const next = p === null
      ? ""
      : p.type === "plot"
      ? `plot|${p.x},${p.y}|${p.free}|${p.reason}`
      : `factory|${p.id}|${p.linking}|${p.takes.map((l) => l.id).join(",")}|${p.feeds.map((l) => l.id).join(",")}`
    if (next !== shape) {
      shape = next
      // Keep the old contents while the closed panel slides away.
      if (p !== null) buildPanel()
      panel.classList.toggle("open", p !== null)
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
      // A second finger: pinch, and forget what the first one was doing.
      pinch = { distance: spread()!.distance }
      press = null
      ui.dragFrom = null
      return
    }
    const world = toWorld(at.x, at.y)
    const onFactory = ui.hits.some((h) => h.contains(world))
    // Dragging from a factory draws a belt; dragging anywhere else pans.
    const pan = event.button === 1 || event.button === 2 || !(ui.mode === "select" && onFactory && ui.linkFrom === null)
    glide = null
    press = { id: event.pointerId, start: at, last: at, pan, panned: false }
    if (event.button === 0) ui.intents.push({ type: "press", at: world })
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
      // A pinch settles on the nearest zoom step.
      pinch = null
      const nearest = zooms.reduce((best, z) => (Math.abs(z - zoom) < Math.abs(best - zoom) ? z : best), zooms[0])
      zoomTo(event.clientX, event.clientY, nearest)
    }
    if (press && press.id === event.pointerId) {
      const at = toWorld(event.clientX, event.clientY)
      ui.intents.push({ type: "release", at, panned: press.panned || cancelled || event.button !== 0 })
      press = null
    }
    // Touch has no hover: clear it when the finger lifts.
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
    // One wheel notch (or a trackpad's worth of scrolling) is one zoom step.
    wheel += event.deltaY
    if (Math.abs(wheel) < 40) return
    const index = zooms.findIndex((z) => z >= zoom - 1e-6)
    const next = zooms[Math.min(zooms.length - 1, Math.max(0, index + (wheel > 0 ? -1 : 1)))]!
    wheel = 0
    zoomTo(event.clientX, event.clientY, next)
  }, { passive: false })

  /** Copies the yard's preview and numbers into the page, once a frame. */
  const syncPage = () => {
    syncPanel()
    if (glide) {
      look.x += (glide.x - look.x) * 0.14
      look.y += (glide.y - look.y) * 0.14
      if (Math.hypot(glide.x - look.x, glide.y - look.y) < 0.5) glide = null
      placeCamera()
    }
    const s = ui.stats
    stats.textContent = `${s.factories} factories · ${s.belts} belts · ${s.crates} in transit · ${s.shipped} shipped`
    const text = ui.preview.tooltip
    if (text && screenPointer) {
      tooltip.textContent = text
      tooltip.style.display = "block"
      tooltip.style.left = `${Math.min(screenPointer.x, window.innerWidth - tooltip.offsetWidth - 20)}px`
      tooltip.style.top = `${screenPointer.y}px`
    } else tooltip.style.display = "none"
    canvas.style.cursor = press?.panned ? "grabbing" : ui.preview.hoverFactory !== null || ui.mode !== "select" ? "pointer" : "default"
  }

  return { app, stage, ui, syncPage }
}
