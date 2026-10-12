import { Application, Graphics } from "pixi.js"
import * as THREE from "three"
import { drawBuilding, drawCrate, drawHouse, drawTree, homeVariant, plate, plateHalf } from "../art.ts"
import { kinds } from "../content.ts"
import { U, toScreen } from "../iso.ts"
import { inkAssets, type InkAsset } from "./assets.ts"
import { buildAsset, exportAsset, reloadExportedAsset } from "./renderer.ts"
import "./style.css"

const root = document.querySelector<HTMLDivElement>("#lab")!
root.innerHTML = `
  <header><a href="/">Inkline Town</a><span>ART STUDY / 01</span></header>
  <div class="intro"><div><h1>The same ink.<br>A different angle.</h1><p>Original game drawings and complete 3D assets, side by side.</p></div><span class="tag">Procedural · Orthographic · Rotatable</span></div>
  <nav class="assets" aria-label="Choose an asset"></nav>
  <section class="comparison" aria-label="Compare the original drawing with the 3D model">
    <div class="view"><div class="view-label"><span>01 / CURRENT GAME</span><span>Fixed isometric drawing</span></div><canvas id="reference" aria-label="Original 2D asset"></canvas><span class="view-foot">Original art.ts drawing</span></div>
    <div class="view"><div class="view-label"><span>02 / 3D STUDY</span><span id="angle-label">Original angle</span></div><div id="viewer" role="img" aria-label="Rotatable 3D asset. Drag horizontally to rotate."></div><span class="view-foot">Drag to rotate · wheel to zoom</span></div>
  </section>
  <section class="controls" aria-label="Camera controls"><button id="reset">Match original view</button><label>Rotation <input id="rotation" type="range" min="-180" max="180" value="0" step="1"><output id="rotation-value">0°</output></label><label>Elevation <input id="elevation" type="range" min="10" max="65" value="30" step="1"><output id="elevation-value">30°</output></label><button id="rear">See the back</button></section>
  <section class="caption"><div><h2 id="asset-title"></h2><p id="asset-note"></p></div><div class="downloads"><button id="download-glb">Download GLB</button><button id="download-source">Download geometry</button><button id="download-png">Save comparison</button></div></section>
  <footer><span>Same palette, dimensions and two ink weights. New faces complete the volume.</span><span>Three.js prototype · PixiJS 3D integration pending</span></footer>
`
const viewer = document.querySelector<HTMLDivElement>("#viewer")!
const reference = document.querySelector<HTMLCanvasElement>("#reference")!
const rotation = document.querySelector<HTMLInputElement>("#rotation")!
const elevation = document.querySelector<HTMLInputElement>("#elevation")!
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setClearColor(0xf0f2ec, 0)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
viewer.append(renderer.domElement)
const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 4000)
const pixi = new Application()
await pixi.init({ width: 32, height: 32, antialias: true, resolution: 3, backgroundAlpha: 0 })

function original(asset: InkAsset) {
  const g = new Graphics()
  if (asset.id === "cottage" || asset.id === "citizen") {
    const tier = asset.id === "cottage" ? 1 : 2
    plate(g, plateHalf(1))
    drawHouse(g, tier, 1, { right: true, left: false }, homeVariant(tier === 1 ? 0.03 : 0.28))
  } else if (asset.id === "fir") drawTree(g, 0, 0, 1)
  else if (asset.id === "goods") {
    plate(g, plateHalf(2))
    // Exact crate drawings from the game; planks/stone use their original projected faces.
    drawCrate(g, 0x2f8c87, 3 * U, 12, 0, 0.35, 0.3)
    drawCrate(g, 0x8a58a8, 3 * U, 12, 0, -0.15, 0.3)
    drawCrate(g, 0xd27a34, 3 * U, 12, 12, 0.1, 0.3)
    const box = (u: number, v: number, a: number, b: number, z: number, h: number, top: number, left: number, right: number) => {
      const poly = (ps: Array<[number, number, number]>, fill: number) =>
        g
          .poly(
            ps.flatMap(([u, v, z]) => {
              const p = toScreen(u, v, z)
              return [p.x, p.y]
            })
          )
          .fill(fill)
          .stroke({ color: 0x3d4943, width: 1, join: "round" })
      poly(
        [
          [u - a, v + b, z],
          [u + a, v + b, z],
          [u + a, v + b, z + h],
          [u - a, v + b, z + h]
        ],
        left
      )
      poly(
        [
          [u + a, v - b, z],
          [u + a, v + b, z],
          [u + a, v + b, z + h],
          [u + a, v - b, z + h]
        ],
        right
      )
      poly(
        [
          [u - a, v - b, z + h],
          [u + a, v - b, z + h],
          [u + a, v + b, z + h],
          [u - a, v + b, z + h]
        ],
        top
      )
    }
    for (let i = 0; i < 3; i++) box(0.3, -0.4, 1.1 * U, 3 * U, i * 2.5, 2.5, 0xf0c59a, 0xe2a873, 0xd2945c)
    box(-0.4, -0.35, 1.2 * U, 1.2 * U, 0, 5, 0xeeefea, 0xdcded7, 0xc9ccc4)
  } else {
    const kind = kinds[asset.id as "townhall" | "mill" | "market"]
    plate(g, plateHalf(kind.size))
    drawBuilding(g, kind, 1, 0, 1.2, { right: true, left: true })
  }
  return g
}

const references = new Map<string, { image: HTMLImageElement; x: number; y: number; width: number; height: number }>()
for (const asset of inkAssets) {
  const g = original(asset),
    b = g.getLocalBounds(),
    image = new Image()
  image.src = await pixi.renderer.extract.base64({ target: g, resolution: 4 })
  await image.decode()
  references.set(asset.id, { image, x: b.minX, y: b.minY, width: b.width, height: b.height })
  g.destroy()
}
pixi.destroy(true)

const models = new Map(inkAssets.map((asset) => [asset.id, buildAsset(asset)]))
let selected = inkAssets[2]!,
  yaw = 0,
  pitch = 30,
  zoom = 1,
  drawCount = 0
const nav = root.querySelector<HTMLElement>("nav")!
for (const asset of inkAssets) {
  const button = document.createElement("button")
  button.dataset.asset = asset.id
  button.innerHTML = `<img alt="" src="${references.get(asset.id)!.image.src}"><span>${asset.title}</span>`
  button.onclick = () => select(asset.id)
  nav.append(button)
}

function render() {
  const width = viewer.clientWidth,
    height = viewer.clientHeight
  if (!width || !height) return
  const ref = references.get(selected.id)!
  const vertical = Math.max(110, ref.height * 1.45, ((ref.width * height) / width) * 1.3) / zoom
  renderer.setSize(width, height, false)
  camera.left = (-vertical * width) / height / 2
  camera.right = -camera.left
  camera.top = vertical / 2
  camera.bottom = -camera.top
  const heading = ((45 + yaw) * Math.PI) / 180,
    altitude = (pitch * Math.PI) / 180
  const target = new THREE.Vector3(0, -(ref.y + ref.height / 2) / Math.cos(Math.PI / 6), 0)
  camera.position
    .copy(target)
    .add(
      new THREE.Vector3(
        Math.sin(heading) * Math.cos(altitude) * 1000,
        Math.sin(altitude) * 1000,
        Math.cos(heading) * Math.cos(altitude) * 1000
      )
    )
  camera.lookAt(target)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  const model = models.get(selected.id)!
  for (const { material, width: lineWidth } of model.lineMaterials) material.linewidth = lineWidth
  model.updateContours(camera)
  renderer.render(scene, camera)
  const dpr = Math.min(devicePixelRatio, 2),
    ctx = reference.getContext("2d")!
  reference.width = Math.round(width * dpr)
  reference.height = Math.round(height * dpr)
  ctx.scale(dpr, dpr)
  const scale = height / vertical
  ctx.drawImage(ref.image, (width - ref.width * scale) / 2, (height - ref.height * scale) / 2, ref.width * scale, ref.height * scale)
  rotation.value = String(yaw)
  elevation.value = String(pitch)
  root.querySelector("#rotation-value")!.textContent = `${Math.round(yaw)}°`
  root.querySelector("#elevation-value")!.textContent = `${Math.round(pitch)}°`
  root.querySelector("#angle-label")!.textContent =
    yaw === 0 && pitch === 30 ? "Original angle" : `${Math.round(yaw)}° rotation · ${Math.round(pitch)}° elevation`
  drawCount++
}
function select(id: string) {
  selected = inkAssets.find((asset) => asset.id === id)!
  scene.clear()
  scene.add(models.get(id)!.group)
  yaw = 0
  pitch = 30
  zoom = 1
  nav.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.asset === id)
    button.setAttribute("aria-pressed", String(button.dataset.asset === id))
  })
  root.querySelector("#asset-title")!.textContent = selected.title
  root.querySelector("#asset-note")!.textContent = selected.note
  render()
}
rotation.oninput = () => {
  yaw = Number(rotation.value)
  render()
}
elevation.oninput = () => {
  pitch = Number(elevation.value)
  render()
}
root.querySelector<HTMLButtonElement>("#reset")!.onclick = () => {
  yaw = 0
  pitch = 30
  zoom = 1
  render()
}
root.querySelector<HTMLButtonElement>("#rear")!.onclick = () => {
  yaw = 180
  render()
}
let drag: { x: number; yaw: number } | null = null
viewer.onpointerdown = (event) => {
  drag = { x: event.clientX, yaw }
  viewer.setPointerCapture(event.pointerId)
}
viewer.onpointermove = (event) => {
  if (drag) {
    yaw = ((drag.yaw + (event.clientX - drag.x) * 0.5 + 540) % 360) - 180
    render()
  }
}
viewer.onpointerup = viewer.onpointercancel = () => {
  drag = null
}
viewer.onwheel = (event) => {
  event.preventDefault()
  zoom = Math.max(0.65, Math.min(2, zoom * Math.exp(-event.deltaY * 0.001)))
  render()
}
const resize = new ResizeObserver(render)
resize.observe(viewer)

function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data),
    a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
root.querySelector<HTMLButtonElement>("#download-glb")!.onclick = async () =>
  download(new Blob([await exportAsset(selected)], { type: "model/gltf-binary" }), `inkline-${selected.id}.glb`)
root.querySelector<HTMLButtonElement>("#download-source")!.onclick = () =>
  download(new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" }), `inkline-${selected.id}.json`)
root.querySelector<HTMLButtonElement>("#download-png")!.onclick = () => {
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d")!,
    w = reference.width,
    h = reference.height
  canvas.width = w * 2
  canvas.height = h + 80
  ctx.fillStyle = "#f0f2ec"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(reference, 0, 60)
  ctx.drawImage(renderer.domElement, w, 60, w, h)
  ctx.fillStyle = "#3d4943"
  ctx.font = "24px monospace"
  ctx.fillText(`${selected.title} / original`, 24, 38)
  ctx.fillText(`3D / ${Math.round(yaw)}°`, w + 24, 38)
  canvas.toBlob((blob) => {
    if (blob) download(blob, `inkline-${selected.id}-comparison.png`)
  })
}

// A local inspection/export bridge for reproducible visual checks and GLB delivery.
const capture = (side: "reference" | "model", width = 480) => {
  const input = side === "reference" ? reference : renderer.domElement
  const output = document.createElement("canvas")
  output.width = width
  output.height = Math.round((width * input.height) / input.width)
  const crop = 0.8
  output.getContext("2d")!.drawImage(
    input,
    (input.width * (1 - crop)) / 2,
    (input.height * (1 - crop)) / 2,
    input.width * crop,
    input.height * crop,
    0,
    0,
    output.width,
    output.height
  )
  return output.toDataURL()
}
Object.assign(window, {
  inkLab: {
    assets: inkAssets,
    select,
    rotate: (angle: number, altitude = 30) => {
      yaw = angle
      pitch = altitude
      render()
    },
    exportAsset,
    showExported: async () => {
      const model = await reloadExportedAsset(selected)
      scene.clear()
      scene.add(model)
      render()
      return { meshes: model.children.length }
    },
    stats: () => ({ selected: selected.id, yaw, pitch, drawCount, triangles: renderer.info.render.triangles }),
    capture
  }
})
select(selected.id)
