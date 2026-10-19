import * as THREE from "three"
import { assetById } from "../../render/three/assets/assets.ts"
import { buildAsset, exportAsset, floorScale, vertex3 } from "../../render/three/assets/renderer.ts"
import "./style.css"

const root = document.querySelector<HTMLElement>("#service-study")!
root.innerHTML = `
  <header><a href="/">Inkline Town</a><span>BUILDING STUDY / 02</span></header>
  <section class="intro"><p class="eyebrow">Room to grow</p><h1>A familiar town.<br>A little more established.</h1><p>Two service upgrades, in the same pale stone and ink.<br>Both tiers keep their 2×2 plot. All four views share one scale.</p></section>
  <nav class="study-controls" aria-label="Model camera controls">
    <button id="reset">Original angle</button><button id="back">See the back</button>
    <label>Turn <input id="heading" type="range" min="-180" max="180" value="0"><output id="heading-value">0°</output></label>
    <label>Tilt <input id="tilt" type="range" min="15" max="65" value="30"><output id="tilt-value">30°</output></label>
    <button id="scale" aria-pressed="false">Street scale</button>
  </nav>
  <section class="family" aria-labelledby="market-heading"><div class="family-heading"><h2 id="market-heading">A place to trade</h2><p>Striped stalls become a covered hall.</p></div><div class="model-pair">
    ${card("market", "01", "Market", "The familiar striped stall and goods yard.")}
    ${card("market-hall", "02", "Market hall", "A pitched roof, covered arcade and upper windows. The stripes stay.")}
  </div></section>
  <section class="family" aria-labelledby="chapel-heading"><div class="family-heading"><h2 id="chapel-heading">A place to gather</h2><p>A small cupola becomes a proper bell tower.</p></div><div class="model-pair">
    ${card("chapel", "01", "Chapel", "Blue glass, pale walls and the original small cupola.")}
    ${card("church", "02", "Church", "A pitched nave, stone buttresses and an open belfry with a bronze bell.")}
  </div></section>
  <footer><p>Drag any model to turn all four. Scroll over a model to zoom.</p><div><a href="/asset-lab.html?asset=market-hall">Full asset catalogue ↗</a><a href="/map-lab.html">See them in the town ↗</a></div><p class="note">Asset preview. Gameplay upgrade rules will be connected separately.</p></footer>
`

function card(id: string, tier: string, title: string, note: string) {
  return `<article class="model-card"><div class="model-label"><span>TIER ${tier}</span><span>2 × 2 PLOT</span></div><div class="model-view" data-model="${id}" role="img" aria-label="${title}, rotatable 3D model" tabindex="0"></div><div class="model-caption"><div><h3>${title}</h3><p>${note}</p></div><button data-export="${id}" aria-label="Download ${title} GLB">GLB ↓</button></div></article>`
}

let yaw = 0, pitch = 30, zoom = 1, street = false
const heading = root.querySelector<HTMLInputElement>("#heading")!
const tilt = root.querySelector<HTMLInputElement>("#tilt")!
const views = [...root.querySelectorAll<HTMLElement>("[data-model]")].map(view => {
  const asset = assetById.get(view.dataset.model!)!
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.setClearColor(0xf0f2ec, 0)
  view.append(renderer.domElement)
  const model = buildAsset(asset, { batchFaces: true })
  const scene = new THREE.Scene()
  scene.add(model.group)
  const camera = new THREE.OrthographicCamera(-130, 130, 130, -130, 0.1, 4000)
  let drag: { x: number; y: number } | null = null
  view.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; view.setPointerCapture(e.pointerId) }
  view.onpointermove = e => {
    if (!drag) return
    yaw = THREE.MathUtils.euclideanModulo(yaw + (e.clientX - drag.x) * 0.6 + 180, 360) - 180
    pitch = Math.max(15, Math.min(65, pitch + (e.clientY - drag.y) * 0.25))
    drag = { x: e.clientX, y: e.clientY }
    render()
  }
  view.onpointerup = view.onpointercancel = view.onlostpointercapture = () => { drag = null }
  view.addEventListener("wheel", e => {
    e.preventDefault()
    zoom = Math.max(0.65, Math.min(1.75, zoom * Math.exp(-e.deltaY * 0.001)))
    render()
  }, { passive: false })
  view.onkeydown = e => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(e.key)) return
    e.preventDefault()
    if (e.key === "Home") { yaw = 0; pitch = 30; zoom = 1 }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") yaw = THREE.MathUtils.euclideanModulo(yaw + (e.key === "ArrowLeft" ? -15 : 15) + 180, 360) - 180
    else pitch = Math.max(15, Math.min(65, pitch + (e.key === "ArrowUp" ? 5 : -5)))
    render()
  }
  return { id: asset.id, view, renderer, model, scene, camera }
})

function render() {
  heading.value = String(yaw)
  tilt.value = String(pitch)
  root.querySelector("#heading-value")!.textContent = `${Math.round(yaw)}°`
  root.querySelector("#tilt-value")!.textContent = `${Math.round(pitch)}°`
  for (const { view, renderer, model, scene, camera } of views) {
    const width = view.clientWidth, height = view.clientHeight
    if (!width || !height) continue
    renderer.setSize(width, height, false)
    // Shared projection and ground target keep tier height differences honest.
    const span = (street ? 335 : 195) / zoom
    camera.left = -span * width / height / 2
    camera.right = -camera.left
    camera.top = span / 2
    camera.bottom = -camera.top
    const target = vertex3([0, 0, 49])
    const angle = THREE.MathUtils.degToRad(45 + yaw), altitude = THREE.MathUtils.degToRad(pitch)
    camera.position.set(target.x + Math.cos(angle) * 700 * Math.cos(altitude), target.y + 700 * Math.sin(altitude), target.z + Math.sin(angle) * 700 * Math.cos(altitude))
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    for (const { material, width } of model.lineMaterials) material.linewidth = width
    model.updateContours(camera)
    renderer.render(scene, camera)
  }
}

heading.oninput = () => { yaw = Number(heading.value); render() }
tilt.oninput = () => { pitch = Number(tilt.value); render() }
root.querySelector<HTMLButtonElement>("#reset")!.onclick = () => { yaw = 0; pitch = 30; zoom = 1; render() }
root.querySelector<HTMLButtonElement>("#back")!.onclick = () => { yaw = yaw === -180 ? 0 : -180; render() }
root.querySelector<HTMLButtonElement>("#scale")!.onclick = e => {
  street = !street
  ;(e.currentTarget as HTMLButtonElement).setAttribute("aria-pressed", String(street))
  render()
}
for (const button of root.querySelectorAll<HTMLButtonElement>("[data-export]")) button.onclick = async () => {
  const asset = assetById.get(button.dataset.export!)!
  const blob = new Blob([await exportAsset(asset)], { type: "model/gltf-binary" })
  const url = URL.createObjectURL(blob), a = document.createElement("a")
  a.href = url; a.download = `inkline-${asset.id}.glb`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const observer = new ResizeObserver(render)
views.forEach(({ view }) => observer.observe(view))
render()
Object.assign(window, { serviceStudy: {
  rotate: (angle: number, elevation = 30) => { yaw = angle; pitch = elevation; render() },
  stats: () => ({ yaw, pitch, street, scale: floorScale, models: views.map(v => ({ id: v.id, triangles: v.renderer.info.render.triangles })) }),
  capture: (id: string) => views.find(v => v.id === id)!.renderer.domElement.toDataURL("image/png")
} })
if (import.meta.hot) import.meta.hot.dispose(() => {
  observer.disconnect()
  views.forEach(({ renderer, model }) => { model.dispose(); renderer.dispose() })
})
