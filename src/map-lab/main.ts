import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { buildAsset, floorScale } from "../asset-lab/renderer.ts"
import { testMap } from "./map.ts"
import "./style.css"

const root = document.querySelector<HTMLElement>("#map-lab")!
root.innerHTML = `
  <div id="viewport"></div>
  <header class="card"><div><h1>Little harbour</h1><p>Inkline Town · 3D map test</p></div><a href="/asset-lab.html">Asset study ↗</a></header>
  <aside class="compass card" aria-label="Camera orientation"><span id="north" aria-hidden="true">↑</span><span id="heading">0°</span></aside>
  <div class="hint card"><span class="desktop-hint">Drag to pan · right-drag to rotate · scroll to zoom</span><span class="touch-hint">Drag to pan · pinch to zoom · switch to Rotate to turn</span><span>WASD / arrows pan · Q / E turn · double-click to focus</span></div>
  <nav class="card controls" aria-label="Map camera controls">
    <div class="group"><button id="pan" aria-pressed="true" title="Left-drag or one finger pans the map">Pan</button><button id="rotate" aria-pressed="false" title="Left-drag or one finger rotates the map">Rotate</button></div>
    <div class="group"><button id="zoom-out" aria-label="Zoom out">−</button><output id="zoom">1.0×</output><button id="zoom-in" aria-label="Zoom in">+</button></div>
    <div class="group"><button id="turn-left" aria-label="Rotate left 45 degrees">↶</button><button id="turn-right" aria-label="Rotate right 45 degrees">↷</button></div>
    <label class="tilt">Tilt <input id="tilt" type="range" min="15" max="65" step="1" value="30" aria-label="Camera elevation"><output id="tilt-value">30°</output></label>
    <button id="reset" title="Restore the original view (Home)">Reset view</button>
  </nav>
  <span class="scene-note">Static town · Camera test</span>
`
const viewport = root.querySelector<HTMLDivElement>("#viewport")!
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setClearColor(0xe2e9e6)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
renderer.domElement.tabIndex = 0
renderer.domElement.setAttribute("aria-label", "3D island map. Drag to pan, right-drag to rotate, scroll to zoom.")
viewport.append(renderer.domElement)
const scene = new THREE.Scene()
const map = buildAsset(testMap.asset, { batchFaces: true })
scene.add(map.group)
const camera = new THREE.OrthographicCamera(-600, 600, 450, -450, 0.1, 6000)
const controls = new OrbitControls(camera, renderer.domElement)
controls.screenSpacePanning = false
controls.zoomToCursor = true
controls.minZoom = 0.65
controls.maxZoom = 5
controls.minPolarAngle = THREE.MathUtils.degToRad(25)
controls.maxPolarAngle = THREE.MathUtils.degToRad(75)
controls.panSpeed = 0.85
controls.rotateSpeed = 0.65
controls.zoomSpeed = 0.85
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
controls.listenToKeyEvents(renderer.domElement)
const tilt = root.querySelector<HTMLInputElement>("#tilt")!
let draws = 0
let mode: "pan" | "rotate" = "pan"

function render() {
  map.updateContours(camera)
  renderer.render(scene, camera)
  draws++
  const degrees = THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()) - 45
  const heading = ((degrees + 540) % 360) - 180
  const elevation = 90 - THREE.MathUtils.radToDeg(controls.getPolarAngle())
  root.querySelector("#zoom")!.textContent = `${camera.zoom.toFixed(1)}×`
  root.querySelector("#heading")!.textContent = `${Math.round(heading)}°`
  root.querySelector<HTMLElement>("#north")!.style.transform = `rotate(${-heading}deg)`
  tilt.value = String(Math.round(elevation))
  root.querySelector("#tilt-value")!.textContent = `${Math.round(elevation)}°`
}
controls.addEventListener("change", render)

function reset() {
  controls.target.set(0, 0, 0)
  camera.position.set(1600, Math.sqrt(2) * 1600 * Math.tan(Math.PI / 6), 1600)
  camera.zoom = 1
  camera.updateProjectionMatrix()
  controls.update()
  render()
}
function resize() {
  const width = viewport.clientWidth,
    height = viewport.clientHeight
  renderer.setSize(width, height, false)
  const viewHeight = Math.max(860, (1150 * height) / width)
  camera.top = viewHeight / 2
  camera.bottom = -viewHeight / 2
  camera.right = (viewHeight * width) / height / 2
  camera.left = -camera.right
  camera.updateProjectionMatrix()
  render()
}
function zoomBy(amount: number) {
  camera.zoom = THREE.MathUtils.clamp(camera.zoom * amount, controls.minZoom, controls.maxZoom)
  camera.updateProjectionMatrix()
  controls.update()
  render()
}
function rotateBy(angle: number) {
  const offset = camera.position.clone().sub(controls.target)
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(angle))
  camera.position.copy(controls.target).add(offset)
  controls.update()
}
function setTilt(angle: number) {
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
  spherical.phi = THREE.MathUtils.degToRad(90 - angle)
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical))
  controls.update()
}
function setMode(next: "pan" | "rotate") {
  mode = next
  controls.mouseButtons.LEFT = mode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
  controls.touches.ONE = mode === "pan" ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE
  controls.touches.TWO = mode === "pan" ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_ROTATE
  root.querySelector("#pan")!.setAttribute("aria-pressed", String(mode === "pan"))
  root.querySelector("#rotate")!.setAttribute("aria-pressed", String(mode === "rotate"))
  renderer.domElement.style.cursor = mode === "pan" ? "grab" : "ew-resize"
}
function panBy(right: number, forward: number) {
  const direction = camera.getWorldDirection(new THREE.Vector3())
  direction.y = 0
  direction.normalize()
  const side = new THREE.Vector3().crossVectors(direction, camera.up).normalize()
  const delta = side.multiplyScalar(right).add(direction.multiplyScalar(forward))
  controls.target.add(delta)
  camera.position.add(delta)
  controls.update()
}
root.querySelector<HTMLButtonElement>("#pan")!.onclick = () => setMode("pan")
root.querySelector<HTMLButtonElement>("#rotate")!.onclick = () => setMode("rotate")
root.querySelector<HTMLButtonElement>("#reset")!.onclick = reset
root.querySelector<HTMLButtonElement>("#zoom-in")!.onclick = () => zoomBy(1.25)
root.querySelector<HTMLButtonElement>("#zoom-out")!.onclick = () => zoomBy(0.8)
root.querySelector<HTMLButtonElement>("#turn-left")!.onclick = () => rotateBy(-45)
root.querySelector<HTMLButtonElement>("#turn-right")!.onclick = () => rotateBy(45)
tilt.oninput = () => setTilt(Number(tilt.value))
renderer.domElement.addEventListener("pointerdown", () => renderer.domElement.focus({ preventScroll: true }))
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLElement && event.target.closest("input,button,a")) return
  const amount = 45 / camera.zoom
  switch (event.key.toLowerCase()) {
    case "a":
      panBy(-amount, 0)
      break
    case "d":
      panBy(amount, 0)
      break
    case "w":
      panBy(0, amount)
      break
    case "s":
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
})
const raycaster = new THREE.Raycaster()
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
renderer.domElement.addEventListener("dblclick", (event) => {
  const rect = renderer.domElement.getBoundingClientRect()
  raycaster.setFromCamera(
    new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, (-(event.clientY - rect.top) / rect.height) * 2 + 1),
    camera
  )
  const point = raycaster.ray.intersectPlane(ground, new THREE.Vector3())
  if (point) {
    const delta = point.clone().sub(controls.target)
    controls.target.copy(point)
    camera.position.add(delta)
    controls.update()
  }
})
new ResizeObserver(resize).observe(viewport)
reset()
resize()

// Reproducible camera/scene checks, without adding diagnostics to the map UI.
Object.assign(window, {
  mapLab: {
    reset,
    rotateBy,
    zoomBy,
    setTilt,
    panBy,
    setMode,
    stats: () => ({
      buildings: testMap.buildings.length,
      trees: testMap.trees,
      roadCells: testMap.roads,
      zoom: camera.zoom,
      heading: THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()),
      elevation: 90 - THREE.MathUtils.radToDeg(controls.getPolarAngle()),
      target: controls.target.toArray().map((value) => value / floorScale),
      draws,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      mode
    })
  }
})
