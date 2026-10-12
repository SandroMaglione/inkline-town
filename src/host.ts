/**
 * The page around the town: the Pixi stage and its layers, the camera (drag
 * to pan, wheel or pinch to zoom), the pointer turned into gestures, and the
 * top bar, toolbar, build menu, panel, tooltip, and toasts; the dialog a new
 * town is founded from, and the reckoning at the end of its term.
 */
import { Application, Container, Graphics } from "pixi.js"

import { seaFill, type Stage } from "./art.ts"
import {
  categoryColor, categoryOrder, costText, defaultCharter, goodIds, goods, home, kindOrder, kinds, landIds, lands, mood as moodRules, needTitle,
  RESERVES, ROAD_COST, sizeIds, sizes, TAX_STEPS, TERMS, type CharterValue, type GoodId, type Kind, type KindId
} from "./content.ts"
import { GRID, toScreen, type Point } from "./iso.ts"
import { generate } from "./mapgen.ts"
import { askOf, priceOf } from "./sim/index.ts"
import type { Stats, Tool, TradeMode, UiValue } from "./ui.ts"
import { emptyPreview } from "./ui.ts"

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
  await app.init({
    resizeTo: window,
    antialias: true,
    background: seaFill,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true
  })
  mount.appendChild(app.canvas)

  // ── Layers ──
  const world = new Container()
  const floor = new Graphics()
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
  const stage: Stage = { world, floor, ground, plates, roads, preview, objects, labels, overlay, ghost }

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
  const clock = el("div", "cell clock")
  const approval = el("div", "cell")
  bar.append(clock, coins, approval, people, jobs)
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
  hud.append(bar, stock, request, alarm)
  hud.title = "Open the town's numbers, goals, and levers"
  hud.onclick = () => toggleMenu("town")
  const tooltip = el("div", "tooltip")
  const toastBox = el("div", "toast")
  const toolbar = el("div", "toolbar")
  const panel = el("aside", "panel")
  const dialog = el("div", "dialog")
  const reckoning = el("div", "dialog")
  const result = el("button", "result", "")
  result.onclick = () => showReckoning(true)
  document.body.append(hud, tooltip, toastBox, toolbar, panel, result, dialog, reckoning)

  let toastTimer = 0
  const ui: UiValue = {
    tool: "select",
    placing: null,
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
  const speeds = [
    { speed: 0, label: "pause", key: "space" },
    { speed: 1, label: "1×", key: "1" },
    { speed: 2, label: "2×", key: "2" },
    { speed: 4, label: "4×", key: "3" }
  ].map(({ speed, label, key }) => {
    const button = el("button", "", label)
    button.title = speed === 0 ? "Pause the town (space)" : `Run the town at ${label} (${key})`
    button.onclick = () => setSpeed(speed)
    toolbar.append(button)
    return { speed, button }
  })
  let lastSpeed = 1
  const setSpeed = (speed: number) => {
    if (speed > 0) lastSpeed = speed
    ui.speed = speed
    for (const s of speeds) s.button.classList.toggle("on", s.speed === speed)
  }
  setSpeed(1)
  toolbar.append(el("span", "sep"))
  const action = (label: string, tip: string, run: () => void) => {
    const button = el("button", "", label)
    button.title = tip
    button.onclick = run
    toolbar.append(button)
  }
  action("new town", "Found a new town on new land", () => openCharter(true))
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
    if (ui.founding || reckoning.classList.contains("open")) return
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

    // The goals that complete the town, and how near each one is.
    const goals = section("to complete the town")
    const goalNote = el("p", "empty")
    goals.append(goalNote)
    const goalRows: Array<{ line: HTMLElement; mark: HTMLElement; text: HTMLElement; value: HTMLElement }> = []
    panel.append(goals)

    const mood = section("approval")
    const moodLine = el("div", "row")
    const moodValue = el("span", "count")
    moodLine.append(el("span", "", "now, heading for"), moodValue)
    const moodTrack = el("div", "meter")
    const moodFill = el("span", "fill")
    moodTrack.append(moodFill)
    const moodParts = el("div", "")
    mood.append(moodLine, moodTrack, moodParts, el("p", "empty", `Homes hold more residents when approval is high and fewer when it is low. At −50 for two minutes, the town turns the mayor out.`))
    panel.append(mood)

    const treasury = section("treasury")
    const taxes = row(treasury, "taxes")
    const traded = row(treasury, "trade")
    const upkeep = row(treasury, "upkeep")
    const admin = row(treasury, "administration")
    const net = row(treasury, "a minute")
    const coinLine = el("div", "spark")
    treasury.append(coinLine, el("p", "empty", "Administration grows faster than the town. Three minutes in debt and the town is bankrupt."))
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
        const sway = Math.round((100 - rate) * moodRules.perTaxPoint)
        effect.textContent = sway === 0 ? "the usual rate" : `${sway > 0 ? "+" : ""}${sway} approval from ${tier} (weighed by how many there are)`
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
    const larderLine = row(needs, "food in store")
    panel.append(needs)

    const crown = section("the crown")
    const crownLine = row(crown, "requests met · missed")
    const crownNext = el("p", "empty")
    crown.append(crownNext)
    panel.append(crown)

    const store = section("goods and trade")
    const reserveLine = el("div", "row lever")
    const reserveControls = el("span", "controls")
    const fewer = el("button", "frame step", "−")
    const reserveValue = el("span", "rate")
    const more = el("button", "frame step", "+")
    reserveControls.append(fewer, reserveValue, more)
    reserveLine.append(el("span", "", "keep in store"), reserveControls)
    store.append(reserveLine)
    const stepReserve = (by: number) => {
      const now = ui.stats?.policy.reserve ?? 25
      const i = RESERVES.indexOf(now as (typeof RESERVES)[number])
      ui.edits.push({ type: "reserve", amount: RESERVES[Math.min(RESERVES.length - 1, Math.max(0, (i < 0 ? 1 : i) + by))]! })
    }
    fewer.onclick = () => stepReserve(-1)
    more.onclick = () => stepReserve(1)
    store.append(el("p", "empty", "Traders buy what the town sells beyond what it keeps, and sell it what it buys up to that, at half again the price. Prices fall as the town sells and rise as it buys."))
    const modes: ReadonlyArray<TradeMode> = ["none", "sell", "buy"]
    const goodRows = goodIds.map((g) => {
      const line = el("div", "row good-row")
      const mode = el("button", "frame mode", "")
      mode.onclick = () => {
        const s = ui.stats
        if (!s) return
        const now: TradeMode = s.policy.sells.includes(g) ? "sell" : s.policy.buys.includes(g) ? "buy" : "none"
        ui.edits.push({ type: "trade", good: g, mode: modes[(modes.indexOf(now) + 1) % modes.length]! })
      }
      const name = el("span", "")
      const left = el("span", "")
      left.append(mode, name)
      const value = el("span", "count")
      line.append(left, value)
      store.append(line)
      return { g, value, mode, name }
    })
    panel.append(store)

    const chronicle = section("chronicle")
    const lines = el("div", "chronicle")
    chronicle.append(lines)
    panel.append(chronicle)

    live.push(() => {
      const s = ui.stats
      if (!s) return
      sub.textContent = `${sizes[s.charter.size].title}, ${lands[s.charter.land].title} land · a ${s.charter.term}-minute term · seed ${s.charter.seed}`
      // Goals.
      while (goalRows.length < s.goals.length) {
        const line = el("div", "row goal")
        const mark = el("span", "mark")
        const text = el("span", "")
        const value = el("span", "count")
        const left = el("span", "")
        left.append(mark, text)
        line.append(left, value)
        goals.append(line)
        goalRows.push({ line, mark, text, value })
      }
      s.goals.forEach((g, i) => {
        const r = goalRows[i]!
        r.mark.textContent = g.met ? "✓" : "·"
        r.line.classList.toggle("met", g.met)
        r.text.textContent = g.text
        r.value.textContent = g.value
      })
      goalNote.textContent = s.fate.governing
        ? "Complete: the mayor governs on to the end of the term."
        : s.fate.complete !== null
        ? `Every goal is met: hold them ${clockText(s.fate.complete)} more.`
        : `Meet every goal at once and hold them for two minutes to complete the town.`
      // Approval.
      moodValue.textContent = `${signed(s.mood.approval)} → ${signed(s.mood.target)}`
      moodFill.style.left = `${Math.min(50, 50 + s.mood.approval / 2)}%`
      moodFill.style.width = `${Math.abs(s.mood.approval) / 2}%`
      moodFill.classList.toggle("low", s.mood.approval < 0)
      const parts = s.mood.parts.map((p) => `<div class="row"><span>${p.label}</span><span class="count">${signed(p.value)}</span></div>`).join("")
      if (moodParts.dataset.html !== parts) {
        moodParts.dataset.html = parts
        moodParts.innerHTML = parts
      }
      taxes.textContent = `+${s.taxes}`
      traded.textContent = signed(s.trade)
      upkeep.textContent = signed(-s.upkeep)
      admin.textContent = signed(-s.admin)
      net.textContent = `${signed(s.net)} coins`
      settlers.textContent = String(s.settlers)
      citizens.textContent = String(s.citizens)
      homes.textContent = String(s.homes)
      work.textContent = `${s.employed} of ${s.jobs}`
      for (const b of bars) {
        const share = s.homes > 0 ? s.needs[b.n] / s.homes : 0
        b.fill.style.width = `${Math.round(share * 100)}%`
        b.value.textContent = `${s.needs[b.n]} of ${s.homes}`
      }
      larderLine.textContent = `${s.larder} fish and bread`
      crownLine.textContent = `${s.crown.met} · ${s.crown.missed}`
      crownNext.textContent = s.crown.open
        ? `Asking for ${s.crown.amount} ${goods[s.crown.good].title}: ${clockText(s.crown.left)} left, ${s.crown.reward} coins when sent.`
        : `The next request in ${clockText(s.crown.next)}. A missed one is a fine, and the town remembers the snub for a while.`
      // Goods' change over the last minute of samples.
      const ago = history[Math.max(0, history.length - 1 - Math.round(60 / SAMPLE_SECONDS))]
      reserveValue.textContent = String(s.policy.reserve)
      for (const r of goodRows) {
        const change = ago ? s.stock[r.g] - ago.stock[r.g] : 0
        r.value.textContent = `${s.stock[r.g]}${change !== 0 ? `  ${change > 0 ? "+" : ""}${change}/min` : ""}`
        const now: TradeMode = s.policy.sells.includes(r.g) ? "sell" : s.policy.buys.includes(r.g) ? "buy" : "none"
        r.mode.textContent = now === "none" ? "—" : now
        r.mode.classList.toggle("on", now !== "none")
        const price = now === "buy" ? askOf(r.g, s.prices[r.g]) : Math.round(priceOf(r.g, s.prices[r.g]) * 10) / 10
        r.name.textContent = `${goods[r.g].title} · ${price}c${s.prices[r.g] !== 100 ? ` (${s.prices[r.g]}%)` : ""}`
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
      const recent = s.chronicle.slice(-10).reverse().map((l) => `<p><b>${clockText(Math.round(l.tick / 60))}</b> ${l.text}</p>`).join("")
      if (lines.dataset.html !== recent) {
        lines.dataset.html = recent
        lines.innerHTML = recent
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
        g.fillStyle = water.has(k) ? "#b9cfcb" : trees.has(k) ? "#9bb08a" : rocks.has(k) ? (rocks.get(k) ? "#5a6479" : "#8f9891") : "#f7f8f4"
        g.fillRect(x * scale, y * scale, scale, scale)
      }
    }
    return land
  }
  const openCharter = (cancellable: boolean) => {
    ui.founding = true
    dialog.replaceChildren()
    const card = el("div", "sheet")
    card.append(el("h2", "", "found a town"), el("p", "sub", "Choose the land and how long the term runs. Grow the town until it is complete, or keep it from bankruptcy, revolt, and ruin until the term is out."))
    const body = el("div", "charter")
    const options = el("div", "")
    const preview = el("div", "preview")
    const map = document.createElement("canvas")
    const facts = el("p", "sub")
    preview.append(map, facts)
    body.append(options, preview)
    const group = <T extends string | number>(title: string, values: ReadonlyArray<T>, label: (v: T) => string, blurb: (v: T) => string, get: () => T, set: (v: T) => void) => {
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
      group("land", sizeIds, (v) => sizes[v].title, (v) => `${sizes[v].goal.residents} residents and ${sizes[v].goal.coins} coins to complete it`, () => choice.size, (v) => (choice.size = v)),
      group("term", TERMS, (v) => `${v} min`, (v) => `${v} minutes of the town at 1×: six years, a winter at the end of each after the first`, () => choice.term, (v) => (choice.term = v)),
      group("richness", landIds, (v) => lands[v].title, (v) => lands[v].blurb, () => choice.land, (v) => (choice.land = v))
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
      const points = s.history.map((p, i) => `${((p.tick / end) * w).toFixed(1)},${(h - 4 - ((values[i]! - lo) / span) * (h - 8)).toFixed(1)}`).join(" ")
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
      return `<rect x="${from.toFixed(1)}" y="0" width="${(w * 0.3 / 6).toFixed(1)}" height="${h}" fill="#3d6db5" opacity="0.06"/>`
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
    result.textContent = s.fate.state === "won" ? "the town is complete · see how" : s.fate.state === "lost" ? "the term is lost · see how" : "the term is over · see how"
    if (id === reckoned) return
    reckoned = id
    const title = s.fate.state === "won" ? "the town is complete" : s.fate.state === "lost" ? s.fate.reason.split(":")[0]!.toLowerCase() : `the term is over: ${verdictOf(s)}`
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
      const left = Math.max(0, s.charter.term * 60 - Math.floor(s.minute * 60))
      clock.innerHTML = `year ${s.season.year} · ${s.season.winter ? `<span class="winter">winter, spring in ${clockText(s.season.left)}</span>` : `winter in ${clockText(s.season.left)}`} · <b>${clockText(left)}</b> left`
      clock.title = s.season.winter ? "Winter: fields lie still, fishing is slow, and homes eat faster" : `Winter comes in ${clockText(s.season.left)}`
      approval.innerHTML = `approval <b class="${s.mood.approval < 0 ? "down" : ""}">${signed(s.mood.approval)}</b> <span class="${s.mood.target >= s.mood.approval ? "up" : "down"}">${s.mood.target > s.mood.approval ? "↑" : s.mood.target < s.mood.approval ? "↓" : ""}</span>`
      for (const [g, count] of goodCells) count.textContent = String(s.stock[g])
      // The crown's request.
      request.classList.toggle("show", s.crown.open && s.fate.state === "playing")
      if (s.crown.open) {
        const have = s.stock[s.crown.good]
        requestText.innerHTML = `the crown asks for <b>${s.crown.amount} ${goods[s.crown.good].title}</b> (${have} in store) · <b>${clockText(s.crown.left)}</b> · ${s.crown.reward} coins`
        send.disabled = have < s.crown.amount
      }
      // What threatens the term, or is about to complete it.
      const warnings: Array<string> = []
      if (s.fate.state === "playing") {
        if (s.fate.bankrupt !== null) warnings.push(`<b>In debt:</b> bankrupt in ${clockText(s.fate.bankrupt)} unless the treasury recovers`)
        else if (s.coins < 0) warnings.push("<b>In debt:</b> wages are going unpaid")
        if (s.fate.revolt !== null) warnings.push(`<b>Uproar:</b> the town turns the mayor out in ${clockText(s.fate.revolt)}`)
        else if (s.mood.approval < -30) warnings.push("<b>Restless:</b> approval is falling towards revolt")
        if (s.fate.peak >= 40 && s.settlers + s.citizens < s.fate.peak * 0.4) warnings.push("<b>Emptying:</b> people are leaving the town")
        if (s.fate.complete !== null) warnings.push(`<b>Every goal met:</b> the town is complete in ${clockText(s.fate.complete)}`)
      }
      const html = warnings.map((w) => `<div class="cell">${w}</div>`).join("")
      if (alarm.dataset.html !== html) {
        alarm.dataset.html = html
        alarm.innerHTML = html
      }
      alarm.classList.toggle("show", warnings.length > 0)
      alarm.classList.toggle("good", warnings.length === 1 && s.fate.complete !== null)
      syncReckoning(s)
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
