import * as THREE from "three"
import { assetById } from "../asset-lab/assets.ts"
import { buildAsset, exportAsset } from "../asset-lab/renderer.ts"
import "./style.css"

const families = {
  fixes: { title: "Review fixes", ids: ["mill","bakery","weaver","warehouse","mine","farm","chapel","hospital","smokehouse","builder","townhouse","quarry","stone-full","stone-quarried","ore-full","ore-quarried","stone-full-2x1","stone-full-2x2","stone-full-3x3","ore-full-2x1","ore-full-2x2","ore-full-3x3","problem-marker","smoke","firewatch"] },
  buildings: { title: "Buildings", ids: ["granary", "smokehouse", "firewatch", "healer", "hospital", "watchhouse", "builder"] },
  ornaments: { title: "Parks", ids: ["park-sample", "park-lamp", "park-fountain", "park-statue", "paved-street"] },
  homes: { title: "Homes & neighbourhoods", ids: ["cottage", "citizen", "townhouse", "cottage-fine", "citizen-fine", "townhouse-fine", "cottage-poor", "citizen-worn", "townhouse-worn"] },
  winter: { title: "Winter", ids: ["cottage-winter", "citizen-winter", "townhouse-winter", "granary-winter", "smokehouse-winter", "firewatch-winter", "healer-winter", "hospital-winter", "watchhouse-winter", "builder-winter"] },
  hazards: { title: "Ruins", ids: ["ruin-burnt-1", "ruin-collapsed-1", "ruin-derelict-1"] },
  people: { title: "People & cargo", ids: ["service-watchman", "service-firefighter", "service-physician", "service-constable", "service-builder", "goods-smoked", "cart-smoked-4", "barrow-smoked-4"] },
  wear: { title: "Building condition", ids: ["granary-worn", "smokehouse-worn", "firewatch-worn", "healer-worn", "hospital-worn", "watchhouse-worn", "builder-worn"] }
} as const
type Family = keyof typeof families
const root = document.querySelector<HTMLElement>("#review")!
root.innerHTML = `<header><a href="/">Inkline Town</a><span>PR 03 / MODEL REVIEW</span><a href="/map-lab.html">Town map ↗</a></header>
  <section class="intro"><div><p class="eyebrow">A town with a little more life</p><h1>New places.<br>The same ink.</h1><p>Inspect the models together, turn them around, then open any one for a closer look.</p></div><aside>7 buildings<br>3 park furnishings<br>3 home tiers<br><span>Plus people, hazards, paving,<br>snow and signs of wear.</span></aside></section>
  <nav aria-label="Model collections"></nav><section class="camera"><label>Turn the models <input aria-label="Model rotation" type="range" min="-180" max="180" value="0"><output>0°</output></label><button id="rear">See the back</button><button id="reset">Reset view</button><button id="sheet">Save model sheet</button><a id="sheet-link" hidden download>Download sheet ↗</a><label>View <select aria-label="View elevation"><option value="30">Street angle</option><option value="50">From above</option><option value="15">Near the ground</option></select></label></section>
  <section class="grid" aria-label="3D models"></section><footer><a href="/park-lab.html">Built park & running water ↗</a> · <a href="/effects-lab.html">Animated house effects ↗</a> · Drag a model to turn the collection · <a href="/asset-lab.html">Full asset catalogue ↗</a> · <a href="/">Play this town ↗</a></footer>`
const nav = root.querySelector("nav")!, grid = root.querySelector<HTMLElement>(".grid")!, rotation = root.querySelector<HTMLInputElement>("input")!, elevation = root.querySelector<HTMLSelectElement>("select")!
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.setClearColor(0xf0f2ec, 0); renderer.setScissorTest(true)
renderer.domElement.className = "models"; document.body.append(renderer.domElement)
let family: Family = "buildings", yaw = 0, pitch = 30, renders = 0
let sheetUrl = ""
let models: Array<{ scene: THREE.Scene; camera: THREE.OrthographicCamera; built: ReturnType<typeof buildAsset>; view: HTMLElement; center: THREE.Vector3; size: THREE.Vector3 }> = []
function render() {
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true)
  for (const model of models) {
    const r = model.view.getBoundingClientRect()
    if (r.bottom <= 0 || r.top >= innerHeight) continue
    const heading = (45 + yaw) * Math.PI / 180, angle = pitch * Math.PI / 180,
      extent = Math.max(model.size.y, Math.hypot(model.size.x, model.size.z) * 0.75, 18) * 1.3,
      vertical = Math.max(extent, Math.hypot(model.size.x, model.size.z) * r.height / r.width * 1.4), camera = model.camera
    camera.top = vertical / 2; camera.bottom = -camera.top; camera.left = -vertical * r.width / r.height / 2; camera.right = -camera.left
    camera.position.copy(model.center).add(new THREE.Vector3(Math.sin(heading) * Math.cos(angle), Math.sin(angle), Math.cos(heading) * Math.cos(angle)).multiplyScalar(1000))
    camera.lookAt(model.center); camera.updateProjectionMatrix(); camera.updateMatrixWorld()
    model.built.updateContours(camera)
    model.built.updateEffects(performance.now()/1000)
    renderer.setViewport(r.left, innerHeight - r.bottom, r.width, r.height)
    renderer.setScissor(Math.max(0, r.left), Math.max(0, innerHeight - r.bottom), Math.min(innerWidth, r.right) - Math.max(0, r.left), Math.min(innerHeight, r.bottom) - Math.max(0, r.top))
    renderer.render(model.scene, camera)
  }
  root.querySelector("output")!.textContent = `${Math.round(yaw)}°`; rotation.value = String(yaw); renders++
}
function select(next: Family) {
  if (sheetUrl) URL.revokeObjectURL(sheetUrl)
  sheetUrl = ""; root.querySelector<HTMLAnchorElement>("#sheet-link")!.hidden = true
  family = next; models.forEach(m => m.built.dispose()); models = []; grid.replaceChildren()
  for (const [i, id] of families[family].ids.entries()) {
    const asset = assetById.get(id)!
    if (!asset) throw new Error(`Missing review model: ${id}`)
    const card = document.createElement("article")
    card.innerHTML = `<div class="card-top"><span>${String(i + 1).padStart(2, "0")}</span><a href="/asset-lab.html?asset=${id}">Inspect ↗</a></div><div class="model-view" role="img" aria-label="${asset.title} 3D model"></div><div class="caption"><h2>${asset.title}</h2><p>${asset.note}</p><button class="export">Download GLB</button></div>`
    grid.append(card)
    const built = buildAsset(asset, {batchFaces: true}), scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 4000)
    scene.add(built.group); scene.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(built.group)
    models.push({built, scene, camera, view: card.querySelector<HTMLElement>(".model-view")!, center: bounds.getCenter(new THREE.Vector3()), size: bounds.getSize(new THREE.Vector3())})
    card.querySelector<HTMLButtonElement>(".export")!.onclick = async () => {
      const url = URL.createObjectURL(new Blob([await exportAsset(asset)], {type: "model/gltf-binary"})), a = document.createElement("a")
      a.href = url; a.download = `inkline-${id}.glb`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
  nav.querySelectorAll("button").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.family === next)) })
  history.replaceState(null, "", `?collection=${next}`); render()
}
for (const [id, group] of Object.entries(families)) {
  const b = document.createElement("button"); b.textContent = group.title; b.dataset.family = id; b.onclick = () => select(id as Family); nav.append(b)
}
rotation.oninput = () => { yaw = Number(rotation.value); render() }
elevation.onchange = () => { pitch = Number(elevation.value); render() }
root.querySelector<HTMLButtonElement>("#rear")!.onclick = () => { yaw = yaw === 180 ? 0 : 180; render() }
root.querySelector<HTMLButtonElement>("#reset")!.onclick = () => { yaw = 0; pitch = 30; elevation.value = "30"; render() }
root.querySelector<HTMLButtonElement>("#sheet")!.onclick = () => {
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d")!, columns = 3, width = 400, height = 350
  canvas.width = columns * width; canvas.height = 100 + Math.ceil(models.length / columns) * height
  ctx.fillStyle = "#f0f2ec"; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#3d4943"; ctx.font = "30px Georgia"; ctx.fillText(`Inkline Town / ${families[family].title}`, 30, 48)
  ctx.font = "13px monospace"; ctx.fillText(`PR 03 · ${Math.round(yaw)}° rotation · ${pitch}° elevation`, 30, 76)
  renderer.setSize(width, 270, false); renderer.setScissorTest(false)
  models.forEach((model, i) => {
    const camera = model.camera, heading = (45 + yaw) * Math.PI / 180, angle = pitch * Math.PI / 180,
      vertical = Math.max(model.size.y, Math.hypot(model.size.x, model.size.z) * 0.75, 18) * 1.3
    camera.top = vertical / 2; camera.bottom = -camera.top; camera.left = -vertical * width / 270 / 2; camera.right = -camera.left
    camera.position.copy(model.center).add(new THREE.Vector3(Math.sin(heading) * Math.cos(angle), Math.sin(angle), Math.cos(heading) * Math.cos(angle)).multiplyScalar(1000))
    camera.lookAt(model.center); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); model.built.updateContours(camera)
    model.built.updateEffects(performance.now()/1000)
    renderer.setViewport(0, 0, width, 270); renderer.render(model.scene, camera)
    const x = (i % columns) * width, y = 100 + Math.floor(i / columns) * height
    ctx.drawImage(renderer.domElement, x, y, width, 270)
    ctx.fillStyle = "#3d4943"; ctx.font = "21px Georgia"; ctx.fillText(assetById.get(families[family].ids[i]!)!.title, x + 24, y + 305)
    ctx.strokeStyle = "#cbd1c5"; ctx.strokeRect(x + 12, y + 8, width - 24, height - 20)
  })
  render()
  canvas.toBlob(blob => {
    if (!blob) return
    if (sheetUrl) URL.revokeObjectURL(sheetUrl)
    sheetUrl = URL.createObjectURL(blob)
    const link = root.querySelector<HTMLAnchorElement>("#sheet-link")!
    link.href = sheetUrl; link.download = `inkline-${family}-review.png`; link.hidden = false
  })
}
let drag: { x: number; yaw: number } | null = null
grid.onpointerdown = e => { if (!(e.target as HTMLElement).classList.contains("model-view")) return; drag = {x: e.clientX, yaw}; grid.setPointerCapture(e.pointerId) }
grid.onpointermove = e => { if (drag) { yaw = ((drag.yaw + (e.clientX - drag.x) * 0.5 + 540) % 360) - 180; render() } }
grid.onpointerup = grid.onpointercancel = () => { drag = null }
let frame = 0
const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(render) }
addEventListener("scroll", schedule, {passive: true}); addEventListener("resize", schedule)
const query = new URLSearchParams(location.search).get("collection")
select(query && query in families ? query as Family : "buildings")
let effectFrame=0
const animateEffects=()=>{if(families[family].ids.some(id=>assetById.get(id)?.smokeEffect||assetById.get(id)?.fountains?.length))render();effectFrame=requestAnimationFrame(animateEffects)}
effectFrame=requestAnimationFrame(animateEffects)
Object.assign(window, { townModelReview: { stats: () => ({ family, models: models.length, renders, yaw, pitch }) } })
if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(effectFrame);models.forEach(m => m.built.dispose()); renderer.dispose(); renderer.domElement.remove(); removeEventListener("scroll", schedule); removeEventListener("resize", schedule) })
