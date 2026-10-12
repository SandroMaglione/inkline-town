/**
 * A page of every drawing the town is made of, side by side, for working on
 * the art: open /gallery.html while `pnpm dev` runs. Scroll or drag to look
 * around, ctrl + wheel (or pinch) to zoom; `?zoom=2&x=…&y=…` to start
 * somewhere, `?icons=0` with the icon drawer closed. Not part of the game's
 * build.
 */
import { Application, Container, Graphics } from "pixi.js"

import { carrierDress, cartLook, drawBuilding, drawField, drawHouse, drawRoads, drawRock, drawTree, drawWalker, drawWater, homeVariant, plate, plateHalf, residentDress, serviceDress } from "./art.ts"
import { categoryColor, goodIds, kindIds, kinds } from "./content.ts"
import { key } from "./grid.ts"
import { icon, iconNames } from "./icons.ts"
import { toScreen } from "./iso.ts"

const app = new Application()
await app.init({ resizeTo: window, antialias: true, background: 0xf0f2ec, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true })
document.body.appendChild(app.canvas)
const world = new Container()
const params = new URLSearchParams(location.search)
world.scale.set(Number(params.get("zoom") ?? 1.5))
world.position.set(-Number(params.get("x") ?? 0), -Number(params.get("y") ?? 0))
app.stage.addChild(world)

/** Puts a drawing at (x, y) on the page, in unscaled pixels. */
const put = (g: Graphics, x: number, y: number) => {
  g.position.set(x, y)
  world.addChild(g)
}

// Buildings: no doors, then both doors.
kindIds.forEach((id, i) => {
  const kind = kinds[id]
  ;[{ right: false, left: false }, { right: true, left: true }].forEach((doors, j) => {
    const g = new Graphics()
    plate(g, plateHalf(kind.size))
    drawBuilding(g, kind, 1, 0.5, 1.2, doors)
    put(g, 70 + (i % 8) * 140, 110 + Math.floor(i / 8) * 230 + j * 110)
  })
})

// Homes: settlers and citizens in each variant.
for (let i = 0; i < 10; i++) {
  for (const tier of [1, 2] as const) {
    const g = new Graphics()
    plate(g, plateHalf(1))
    drawHouse(g, tier, 1, { right: i % 2 === 0, left: i % 3 === 0 }, homeVariant(i / 10 + 0.03))
    put(g, 40 + i * 50 + (tier - 1) * 520, 520)
  }
}

// Trees, grown and young; rocks, stone and ore, full and quarried; fields; crates and walkers.
for (let i = 0; i < 32; i++) {
  const g = new Graphics()
  drawTree(g, i * 3, i * 7, i < 24 ? 1 : i < 28 ? 0.6 : 0.3)
  put(g, 30 + i * 30, 590)
}
for (let i = 0; i < 16; i++) {
  const g = new Graphics()
  drawRock(g, i * 5, i * 3, i % 2 === 1, i < 10 ? 40 : 10)
  put(g, 40 + i * 50, 640)
}
for (let i = 0; i < 4; i++) {
  const g = new Graphics()
  drawField(g, i / 3)
  put(g, 860 + i * 70, 640)
}
// Walkers: carriers with each good (a full load, then one crate), facing each way; service walkers; residents.
const dirs = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
goodIds.forEach((good, i) => {
  for (const [j, count] of [[0, 4], [1, 1]] as const) {
    const w = new Graphics()
    drawWalker(w, carrierDress(i / 11), { kind: "cart", good, count }, cartLook((i * 0.37 + j * 0.5) % 1), dirs[(i + j) % 4]!, i % 2)
    put(w, 1050 + i * 60, 150 + j * 50)
  }
})
dirs.forEach((dir, i) => {
  const w = new Graphics()
  drawWalker(w, carrierDress(0.2 + i / 5), { kind: "none" }, cartLook(i / 4), dir, 0, 0.4)
  put(w, 1050 + i * 60, 250)
})
const basket = new Graphics()
drawWalker(basket, serviceDress(categoryColor.services, 0.3, false), { kind: "basket", goods: ["fish", "bread", "cloth"] }, null, dirs[0]!, 0)
put(basket, 1200, 250)
const bell = new Graphics()
drawWalker(bell, serviceDress(categoryColor.services, 0.6, true), { kind: "bell" }, null, dirs[1]!, 1)
put(bell, 1230, 250)
for (let i = 0; i < 16; i++) {
  const w = new Graphics()
  const tier = i < 8 ? 1 : 2
  drawWalker(w, residentDress(homeVariant(((i % 8) / 8) + 0.03).cloth, tier, (i * 0.37) % 1), { kind: "none" }, null, dirs[i % 4]!, i % 2)
  put(w, 1050 + i * 30, 310)
}

// Water and roads, on their own patch of grid.
const water = new Set<number>()
for (let y = 0; y < 6; y++) for (let x = 0; x < 6 + (y % 3); x++) water.add(key(x, y))
const ground = new Graphics()
drawWater(ground, water)
const o = toScreen(0, 0)
put(ground, 260 - o.x, 680)
const roads = new Set<number>()
for (let x = 0; x < 10; x++) roads.add(key(x, 3))
for (let y = 0; y < 8; y++) roads.add(key(4, y))
for (let y = 1; y < 6; y++) roads.add(key(8, y))
const road = new Graphics()
drawRoads(road, roads)
put(road, 700, 680)

// The page's icons, large, in a drawer that opens and closes.
const drawer = document.createElement("details")
drawer.open = params.get("icons") !== "0"
drawer.style.cssText = "position:fixed;left:0;right:0;bottom:0;max-height:40vh;overflow:auto;background:#f7f8f4;border-top:1px solid #c9cec4;font:11px ui-monospace,monospace;color:#3d4943"
drawer.innerHTML = `<summary style="padding:8px 12px;cursor:pointer">icons</summary>`
const strip = document.createElement("div")
strip.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;padding:0 12px 12px"
for (const name of iconNames) {
  const cell = document.createElement("div")
  cell.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;width:64px"
  cell.innerHTML = `${icon(name, 32)}<span>${name}</span>`
  strip.append(cell)
}
drawer.append(strip)
document.body.append(drawer)

// Looking around: the wheel (or a trackpad) scrolls, dragging pans, ctrl + wheel (or pinch) zooms.
app.canvas.addEventListener("wheel", (event) => {
  event.preventDefault()
  if (event.ctrlKey) {
    const before = { x: (event.clientX - world.position.x) / world.scale.x, y: (event.clientY - world.position.y) / world.scale.y }
    const zoom = Math.min(6, Math.max(0.5, world.scale.x * Math.exp(-event.deltaY * 0.01)))
    world.scale.set(zoom)
    world.position.set(event.clientX - before.x * zoom, event.clientY - before.y * zoom)
    return
  }
  world.position.set(world.position.x - (event.shiftKey ? event.deltaY : event.deltaX), world.position.y - (event.shiftKey ? 0 : event.deltaY))
}, { passive: false })
let drag: { x: number; y: number } | null = null
app.canvas.addEventListener("pointerdown", (event) => {
  drag = { x: event.clientX, y: event.clientY }
  app.canvas.setPointerCapture(event.pointerId)
  app.canvas.style.cursor = "grabbing"
})
app.canvas.addEventListener("pointermove", (event) => {
  if (!drag) return
  world.position.set(world.position.x + event.clientX - drag.x, world.position.y + event.clientY - drag.y)
  drag = { x: event.clientX, y: event.clientY }
})
const stop = () => {
  drag = null
  app.canvas.style.cursor = "grab"
}
app.canvas.addEventListener("pointerup", stop)
app.canvas.addEventListener("pointercancel", stop)
app.canvas.style.cursor = "grab"
