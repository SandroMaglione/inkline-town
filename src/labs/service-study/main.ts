import { assetById } from "../../render/pixi3d/assets/assets.ts"
import { buildAsset, exportAsset, floorScale, vertex3 } from "../../render/pixi3d/assets/renderer.ts"
import { triangleCount } from "../../render/pixi3d/mesh/geometry.ts"
import { aim, frame, labViewer } from "../viewer.ts"
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
const wrap = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180
const views = await Promise.all([...root.querySelectorAll<HTMLElement>("[data-model]")].map(async view => {
  const asset = assetById.get(view.dataset.model!)!
  const viewer = await labViewer(view, { width: view.clientWidth || 1, height: view.clientHeight || 1 })
  const model = buildAsset(asset, { batchFaces: true })
  viewer.view.root.addChild(model.group)
  let drag: { x: number; y: number } | null = null
  view.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; view.setPointerCapture(e.pointerId) }
  view.onpointermove = e => {
    if (!drag) return
    yaw = wrap(yaw + (e.clientX - drag.x) * 0.6)
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
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") yaw = wrap(yaw + (e.key === "ArrowLeft" ? -15 : 15))
    else pitch = Math.max(15, Math.min(65, pitch + (e.key === "ArrowUp" ? 5 : -5)))
    render()
  }
  return { id: asset.id, view, viewer, model }
}))

function render() {
  heading.value = String(yaw)
  tilt.value = String(pitch)
  root.querySelector("#heading-value")!.textContent = `${Math.round(yaw)}°`
  root.querySelector("#tilt-value")!.textContent = `${Math.round(pitch)}°`
  for (const { view, viewer } of views) {
    const width = view.clientWidth, height = view.clientHeight
    if (!width || !height) continue
    viewer.resize(width, height)
    // Shared projection and ground target keep tier height differences honest.
    const span = (street ? 335 : 195) / zoom
    const angle = ((45 + yaw) * Math.PI) / 180, altitude = (pitch * Math.PI) / 180
    aim(viewer.camera, vertex3([0, 0, 49]), [Math.cos(angle) * Math.cos(altitude), Math.sin(altitude), Math.sin(angle) * Math.cos(altitude)], 700)
    frame(viewer.camera, span / 2, width, height)
    viewer.render()
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
  stats: () => ({ yaw, pitch, street, scale: floorScale, models: views.map(v => ({ id: v.id, triangles: v.model.parts.reduce((n, p) => n + triangleCount(p.part.mesh), 0) })) }),
  capture: (id: string) => {
    const v = views.find(v => v.id === id)!
    render()
    return v.viewer.canvas.toDataURL("image/png")
  }
} })
if (import.meta.hot) import.meta.hot.dispose(() => {
  observer.disconnect()
  views.forEach(({ viewer, model }) => { model.dispose(); viewer.dispose() })
})
