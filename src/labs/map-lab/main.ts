import { Plane, Vector3 } from "@pixi/3d"
import { OrbitCamera } from "@pixi/3d/extras"
import { buildAsset, floorScale } from "../../render/pixi3d/assets/renderer.ts"
import { inkAssets } from "../../render/pixi3d/assets/assets.ts"
import { makePerson } from "../../render/pixi3d/assets/people.ts"
import { testMap, districts } from "./map.ts"
import { drawCounter } from "../../render/pixi3d/scene.ts"
import { triangleCount } from "../../render/pixi3d/mesh/geometry.ts"
import { labViewer } from "../viewer.ts"
import "./style.css"

const root = document.querySelector<HTMLElement>("#map-lab")!
root.innerHTML = `
  <div id="viewport"></div>
  <header class="card"><div><h1>Inkline harbour</h1><p>${inkAssets.length} models · complete world asset study</p></div><a href="/asset-lab.html">Asset study ↗</a></header>
  <section class="review card"><label>Explore <select id="district"></select></label><label>Inspect <select id="inspect"><option value="">Choose an asset…</option></select></label><div><button id="motion" aria-pressed="true">People moving</button><a id="asset-link" href="/asset-lab.html">Compare with original ↗</a></div></section>
  <aside class="compass card" aria-label="Camera orientation"><span id="north" aria-hidden="true">↑</span><span id="heading">0°</span></aside>
  <div class="hint card"><span class="desktop-hint">Drag to pan · right-drag to rotate · scroll to zoom</span><span class="touch-hint">Drag to pan · pinch to zoom · switch to Rotate to turn</span><span>WASD / arrows pan · Q / E turn · double-click to focus</span></div>
  <nav class="card controls" aria-label="Map camera controls">
    <div class="group"><button id="pan" aria-pressed="true" title="Left-drag or one finger pans the map">Pan</button><button id="rotate" aria-pressed="false" title="Left-drag or one finger rotates the map">Rotate</button></div>
    <div class="group"><button id="zoom-out" aria-label="Zoom out">−</button><output id="zoom">1.0×</output><button id="zoom-in" aria-label="Zoom in">+</button></div>
    <div class="group"><button id="turn-left" aria-label="Rotate left 45 degrees">↶</button><button id="turn-right" aria-label="Rotate right 45 degrees">↷</button></div>
    <label class="tilt">Tilt <input id="tilt" type="range" min="15" max="65" step="1" value="30" aria-label="Camera elevation"><output id="tilt-value">30°</output></label>
    <button id="reset" title="Restore the original view (Home)">Reset view</button>
  </nav>
  <span class="scene-note">Every model on the island · Original scale</span>
`
const viewport = root.querySelector<HTMLDivElement>("#viewport")!
const viewer = await labViewer(viewport, { width: viewport.clientWidth || 1, height: viewport.clientHeight || 1, background: 0xe2e9e6 })
const canvas = viewer.canvas, scene = viewer.view.root, camera = viewer.camera, counter = drawCounter(viewer.app.renderer)
canvas.tabIndex = 0
canvas.setAttribute("aria-label", "3D island map. Drag to pan, right-drag to rotate, scroll to zoom.")
const map = buildAsset(testMap.asset, { batchFaces: true })
scene.addChild(map.group)
const effects = testMap.effects.map((p) => {
  const model = buildAsset(
    inkAssets.find((a) => a.id === p.asset)!,
    { batchFaces: true }
  )
  model.group.position.set(p.x * floorScale, p.height / Math.cos(Math.PI / 6), p.y * floorScale)
  scene.addChild(model.group)
  return model
})
const degrees = (radians: number) => (radians * 180) / Math.PI, radians = (degrees: number) => (degrees * Math.PI) / 180
const controls = new OrbitCamera({
  view: viewer.view,
  target: { x: 0, y: 0, z: 0 },
  autoUpdate: false,
  screenSpacePanning: false,
  zoomToCursor: true,
  minZoom: 0.65,
  maxZoom: 28,
  minPolarAngle: radians(25),
  maxPolarAngle: radians(75),
  panSpeed: 0.85,
  rotateSpeed: 0.65,
  zoomSpeed: 0.85,
  mouseButtons: { left: "pan", middle: "zoom", right: "rotate" },
  touches: { one: "pan", two: "zoom-pan" }
})
const tilt = root.querySelector<HTMLInputElement>("#tilt")!
const district = root.querySelector<HTMLSelectElement>("#district")!
const inspect = root.querySelector<HTMLSelectElement>("#inspect")!
for (const [id, d] of Object.entries(districts)) {
  const option = document.createElement("option")
  option.value = id
  option.textContent = d.title
  district.append(option)
}
for (const a of [...inkAssets].sort((a, b) => a.title.localeCompare(b.title))) {
  const option = document.createElement("option")
  option.value = a.id
  option.textContent = a.title
  inspect.append(option)
}
let moving = true
const actors = inkAssets
  .filter((a) => a.category === "people")
  .slice(0, 8)
  .map((a, i) => {
    const r = a.reference!
    if (r.type !== "walker") throw new Error("Actor requires walker reference")
    const frames = [0, 1].map((phase) => buildAsset(makePerson(a.id, a.title, r.dress, r.load, r.cart, phase), { batchFaces: true }))
    frames.forEach((f) => scene.addChild(f.group))
    return { frames, offset: i / 8 }
  })
let draws = 0
let mode: "pan" | "rotate" = "pan"

function render() {
  for (const effect of effects) effect.group.rotation.y = controls.azimuthAngle - Math.PI / 4
  counter.calls = counter.triangles = 0
  viewer.render()
  draws++
  const turned = degrees(controls.azimuthAngle) - 45
  const heading = ((turned + 540) % 360) - 180
  const elevation = 90 - degrees(controls.polarAngle)
  root.querySelector("#zoom")!.textContent = `${camera.zoom.toFixed(1)}×`
  root.querySelector("#heading")!.textContent = `${Math.round(heading)}°`
  root.querySelector<HTMLElement>("#north")!.style.transform = `rotate(${-heading}deg)`
  tilt.value = String(Math.round(elevation))
  root.querySelector("#tilt-value")!.textContent = `${Math.round(elevation)}°`
}
controls.on("change", render)

function reset() {
  district.value = "all"
  inspect.value = ""
  controls.target.set(0, 0, 0)
  camera.position.set(1600, Math.sqrt(2) * 1600 * Math.tan(Math.PI / 6), 1600)
  camera.zoom = 1
  controls.update()
  render()
}
function resize() {
  const width = viewport.clientWidth || 1,
    height = viewport.clientHeight || 1
  viewer.resize(width, height)
  const viewHeight = Math.max(1350, (2150 * height) / width)
  camera.orthographicSize = (viewHeight * width) / height / 2
  render()
}
/** Moves the camera and its target together by `(dx, dy, dz)`. */
function shift(dx: number, dy: number, dz: number) {
  controls.target.set(controls.target.x + dx, controls.target.y + dy, controls.target.z + dz)
  camera.position.set(camera.position.x + dx, camera.position.y + dy, camera.position.z + dz)
}
function focus(x: number, y: number, zoom: number) {
  shift(x * floorScale - controls.target.x, -controls.target.y, y * floorScale - controls.target.z)
  camera.zoom = zoom
  controls.update()
  render()
}
function focusDistrict(id: keyof typeof districts) {
  const d = districts[id]
  focus(d.x, d.y, d.zoom)
  district.value = id
  inspect.value = ""
}
district.onchange = () => focusDistrict(district.value as keyof typeof districts)
inspect.onchange = () => {
  const p = testMap.buildings.find((p) => p.asset === inspect.value)
  if (!p) return
  const a = inkAssets.find((a) => a.id === p.asset)!
  focus(p.x, p.y, a.category === "people" ? 24 : a.category === "cargo" ? 18 : 6)
  district.value = ""
  root.querySelector<HTMLAnchorElement>("#asset-link")!.href = `/asset-lab.html?asset=${p.asset}`
}
root.querySelector<HTMLButtonElement>("#motion")!.onclick = () => {
  moving = !moving
  root.querySelector("#motion")!.textContent = moving ? "People moving" : "People paused"
  root.querySelector("#motion")!.setAttribute("aria-pressed", String(moving))
}
function zoomBy(amount: number) {
  camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom * amount))
  controls.update()
  render()
}
function rotateBy(angle: number) {
  const t = controls.target, x = camera.position.x - t.x, z = camera.position.z - t.z, a = radians(angle)
  camera.position.set(t.x + x * Math.cos(a) + z * Math.sin(a), camera.position.y, t.z - x * Math.sin(a) + z * Math.cos(a))
  controls.update()
}
function setTilt(angle: number) {
  const t = controls.target, x = camera.position.x - t.x, y = camera.position.y - t.y, z = camera.position.z - t.z
  const r = Math.hypot(x, y, z), theta = Math.atan2(x, z), phi = radians(90 - angle)
  camera.position.set(t.x + r * Math.sin(phi) * Math.sin(theta), t.y + r * Math.cos(phi), t.z + r * Math.sin(phi) * Math.cos(theta))
  controls.update()
}
function setMode(next: "pan" | "rotate") {
  mode = next
  controls.mouseButtons.left = mode === "pan" ? "pan" : "rotate"
  controls.touches.one = mode === "pan" ? "pan" : "rotate"
  controls.touches.two = mode === "pan" ? "zoom-pan" : "zoom-rotate"
  root.querySelector("#pan")!.setAttribute("aria-pressed", String(mode === "pan"))
  root.querySelector("#rotate")!.setAttribute("aria-pressed", String(mode === "rotate"))
  canvas.style.cursor = mode === "pan" ? "grab" : "ew-resize"
}
function panBy(right: number, forward: number) {
  // Along the ground: the camera's forward (towards its target) and its right, level.
  const fx = controls.target.x - camera.position.x, fz = controls.target.z - camera.position.z, l = Math.hypot(fx, fz) || 1
  const dx = fx / l, dz = fz / l
  shift(-dz * right + dx * forward, 0, dx * right + dz * forward)
  controls.update()
  render()
}
root.querySelector<HTMLButtonElement>("#pan")!.onclick = () => setMode("pan")
root.querySelector<HTMLButtonElement>("#rotate")!.onclick = () => setMode("rotate")
root.querySelector<HTMLButtonElement>("#reset")!.onclick = reset
root.querySelector<HTMLButtonElement>("#zoom-in")!.onclick = () => zoomBy(1.25)
root.querySelector<HTMLButtonElement>("#zoom-out")!.onclick = () => zoomBy(0.8)
root.querySelector<HTMLButtonElement>("#turn-left")!.onclick = () => rotateBy(-45)
root.querySelector<HTMLButtonElement>("#turn-right")!.onclick = () => rotateBy(45)
tilt.oninput = () => setTilt(Number(tilt.value))
canvas.addEventListener("pointerdown", () => canvas.focus({ preventScroll: true }))
const onKeyDown = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLElement && event.target.closest("input,select,button,a")) return
  const amount = 45 / camera.zoom
  switch (event.key.toLowerCase()) {
    case "a":
    case "arrowleft":
      panBy(-amount, 0)
      break
    case "d":
    case "arrowright":
      panBy(amount, 0)
      break
    case "w":
    case "arrowup":
      panBy(0, amount)
      break
    case "s":
    case "arrowdown":
      panBy(0, -amount)
      break
    case "q":
      rotateBy(-15)
      break
    case "e":
      rotateBy(15)
      break
    case "+":
    case "=":
      zoomBy(1.2)
      break
    case "-":
      zoomBy(1 / 1.2)
      break
    case "home":
      reset()
      break
    default:
      return
  }
  event.preventDefault()
}
window.addEventListener("keydown", onKeyDown)
const ground = new Plane(new Vector3(0, 1, 0), 0)
canvas.addEventListener("dblclick", (event) => {
  const rect = canvas.getBoundingClientRect()
  const point = viewer.view.screenToWorld({ x: ((event.clientX - rect.left) / rect.width) * viewer.width, y: ((event.clientY - rect.top) / rect.height) * viewer.height }, ground)
  if (point) {
    shift(point.x - controls.target.x, point.y - controls.target.y, point.z - controls.target.z)
    controls.update()
    render()
  }
})
let previous = 0,
  elapsed = 0
let frameId = 0
const loop = (now: number) => {
  frameId = requestAnimationFrame(loop)
  if (!previous) previous = now
  if (moving) elapsed += Math.min(0.05, (now - previous) / 1000)
  previous = now
  controls.update()
  if (!moving && draws > 0) return
  for (const actor of actors) {
    const t = (elapsed * 0.035 + actor.offset) % 1,
      forward = t < 0.5
    const x = -8 + 16 * (forward ? t * 2 : (1 - t) * 2),
      phase = Math.floor(elapsed * 5) % 2
    actor.frames.forEach((f, i) => {
      f.group.visible = i === phase
      f.group.position.set(x * floorScale, 0, 4 * floorScale)
      f.group.rotation.y = forward ? 0 : Math.PI
    })
  }
  map.updateEffects(elapsed)
  effects.forEach(e=>e.updateEffects(elapsed))
  render()
}
frameId = requestAnimationFrame(loop)
const resizeObserver = new ResizeObserver(resize)
resizeObserver.observe(viewport)
reset()
resize()

// Reproducible camera/scene checks, without adding diagnostics to the map UI.
Object.assign(window, {
  mapLab: {
    reset,
    focusDistrict,
    focus,
    capture: () => {
      render()
      return canvas.toDataURL("image/webp", 0.95)
    },
    rotateBy,
    zoomBy,
    setTilt,
    panBy,
    setMode,
    stats: () => ({
      buildings: inkAssets.filter((a) => a.category === "buildings").length,
      assets: inkAssets.length,
      represented: testMap.coverage,
      people: inkAssets.filter((a) => a.category === "people").length,
      actors: actors.length,
      trees: testMap.trees,
      roadCells: testMap.roads,
      zoom: camera.zoom,
      heading: degrees(controls.azimuthAngle),
      elevation: 90 - degrees(controls.polarAngle),
      target: [controls.target.x, controls.target.y, controls.target.z].map((value) => value / floorScale),
      draws,
      drawCalls: counter.calls,
      triangles: counter.triangles || [map, ...effects].reduce((n, m) => n + m.parts.reduce((k, p) => k + triangleCount(p.part.mesh), 0), 0),
      mode
    })
  }
})

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(frameId)
    controls.destroy()
    resizeObserver.disconnect()
    window.removeEventListener("keydown", onKeyDown)
    map.dispose()
    effects.forEach((model) => model.dispose())
    actors.forEach((actor) => actor.frames.forEach((frame) => frame.dispose()))
    viewer.dispose()
  })
