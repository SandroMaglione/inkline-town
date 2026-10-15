import { Application, Graphics } from "pixi.js"
import * as THREE from "three"
import {
  drawBuilding,
  drawCrate,
  drawCargo,
  drawHouse,
  drawTree,
  drawRock,
  drawField,
  drawWalker,
  drawSite,
  drawRoads,
  drawWater,
  drawParkPiece,
  homeVariant,
  plate,
  plateHalf
} from "../art.ts"
import { kinds, goods } from "../content.ts"
import { key } from "../grid.ts"
import { samplePark } from "./town-props.ts"
import type { PropId } from "../content.ts"
import { drawPlot } from "../art.ts"
import { U, toScreen } from "../iso.ts"
import { inkAssets, assetCategoryTitles, type InkAsset } from "./assets.ts"
import { buildAsset, exportAsset, reloadExportedAsset } from "./renderer.ts"
import "./style.css"

const root = document.querySelector<HTMLDivElement>("#lab")!
root.innerHTML = `
  <header><a href="/model-review.html">Model review ↗</a><span>COMPLETE ASSET CATALOGUE</span><a href="/effects-lab.html">Animated house effects ↗</a></header>
  <div class="intro"><div><h1>The same ink.<br>A different angle.</h1><p>Original game drawings and complete 3D assets, side by side.</p></div><span class="tag">Procedural · Orthographic · Rotatable</span></div>
  <div class="filters"><label>Collection <select id="category"></select></label><label>Find <input id="search" type="search" placeholder="Name or material"></label><a href="/service-upgrades.html">Compare service tiers ↗</a><a href="/map-lab.html">See everything on the map ↗</a></div><nav class="assets" aria-label="Choose an asset"></nav>
  <section class="comparison" aria-label="Compare the original 2D drawing with the current 3D model">
    <div class="view"><div class="view-label"><span>01 / ORIGINAL 2D ART</span><span>Fixed isometric drawing</span></div><canvas id="reference" aria-label="Original 2D asset"></canvas><span class="view-foot">Original art.ts drawing</span></div>
    <div class="view"><div class="view-label"><span>02 / CURRENT 3D MODEL</span><span id="angle-label">Original angle</span></div><div id="viewer" role="img" aria-label="Rotatable 3D asset. Drag horizontally to rotate."></div><span class="view-foot">Drag to rotate · wheel to zoom</span></div>
  </section>
  <section class="controls" aria-label="Camera controls"><button id="reset">Match original view</button><label>Rotation <input id="rotation" type="range" min="-180" max="180" value="0" step="1"><output id="rotation-value">0°</output></label><label>Elevation <input id="elevation" type="range" min="10" max="65" value="30" step="1"><output id="elevation-value">30°</output></label><button id="rear">See the back</button></section>
  <section class="caption"><div><h2 id="asset-title"></h2><p id="asset-note"></p></div><div class="downloads"><button id="download-glb">Download GLB</button><button id="download-source">Download geometry</button><button id="download-png">Save comparison</button></div></section>
  <footer><span>Same palette, dimensions and two ink weights. New faces complete the volume.</span><span>These models are used in the live 3D game.</span></footer>
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
  if(asset.id.startsWith("park-")){
    if(asset.id==="park-sample")for(const c of samplePark){
      const p=toScreen(c.x-2,c.y-2);g.translateTransform(p.x,p.y);drawParkPiece(g,c.prop==="none"?c.ground:c.prop);g.resetTransform()
    }else drawParkPiece(g,asset.id.slice(5) as PropId)
    return g
  }
  const r = asset.reference
  if (r) {
    switch (r.type) {
      case "building":
        plate(g, plateHalf(kinds[r.kind].size))
        drawBuilding(g, kinds[r.kind], r.build ?? 1, 0, 1.2, { right: true, left: true })
        break
      case "house":
        plate(g, plateHalf(1))
        drawHouse(g, r.tier, r.build ?? 1, { right: true, left: false }, homeVariant(r.variant))
        break
      case "tree":
        drawTree(g, r.x, r.y, r.grown)
        break
      case "rock":
        drawRock(g, r.x, r.y, r.ore, r.amount)
        break
      case "field":
        drawField(g, r.grown)
        break
      case "walker":
        drawWalker(g, r.dress, r.load, r.cart, { x: 1, y: 0 }, r.phase)
        break
      case "crate":
        drawCrate(g, goods[r.good].color, 3 * U, 12)
        break
      case "cargo":
        drawCargo(g, 0, 0, { x: 1, y: 0 }, r.good, r.count, 0)
        break
      case "site":
        plate(g, plateHalf(2))
        drawSite(g, plateHalf(2), r.share)
        break
      case "plot":
        drawPlot(g, -1, -1, 2, r.look, 0)
        break
      case "roads": {
        const cells = new Set([key(8, 8), key(7, 8), key(9, 8), key(8, 7), key(8, 9)])
        const p = toScreen(8.5, 8.5)
        g.translateTransform(-p.x, -p.y)
        drawRoads(g, cells)
        g.resetTransform()
        break
      }
      case "water": {
        const cells = new Set<number>()
        for (let x = 7; x <= 9; x++) for (let y = 7; y <= 9; y++) cells.add(key(x, y))
        const p = toScreen(8.5, 8.5)
        g.translateTransform(-p.x, -p.y)
        drawWater(g, cells)
        g.resetTransform()
        break
      }
      case "none":
        if (asset.id === "problem-marker") {
          g.roundRect(-7.5, -15, 15, 15, 2).fill(0xf6f7f3).stroke({ color: 0xc4523f, width: 1 })
          g.rect(-1, -12, 2, 6).rect(-1, -5, 2, 2).fill(0xc4523f)
        } else
          for (const t of [0.1, 0.4, 0.7])
            g.circle(Math.sin(t * 5) * 1.5, -t * 34, 4 + t * 7).stroke({ color: 0x3d4943, width: 1, alpha: (1 - t) * 0.55 })
        break
    }
  } else if (asset.id === "cottage" || asset.id === "citizen") {
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
  image.src = await pixi.renderer.extract.base64({ target: g, resolution: Math.max(b.width, b.height) < 60 ? 12 : 4 })
  await image.decode()
  references.set(asset.id, { image, x: b.minX, y: b.minY, width: b.width, height: b.height })
  g.destroy()
}
pixi.destroy(true)

const models = new Map<string, ReturnType<typeof buildAsset>>()
let effectTimeOverride:number|null=null
let selected = inkAssets[2]!,
  yaw = 0,
  pitch = 30,
  zoom = 1,
  drawCount = 0
const nav = root.querySelector<HTMLElement>("nav")!
const category = root.querySelector<HTMLSelectElement>("#category")!
const search = root.querySelector<HTMLInputElement>("#search")!
for (const [id, title] of Object.entries(assetCategoryTitles)) {
  const option = document.createElement("option")
  option.value = id
  option.textContent = `${title} (${inkAssets.filter((a) => a.category === id).length})`
  category.append(option)
}
const filter = () =>
  nav.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    const a = inkAssets.find((a) => a.id === b.dataset.asset)!
    b.hidden = a.category !== category.value || !a.title.toLowerCase().includes(search.value.toLowerCase())
  })
category.onchange = filter
search.oninput = filter
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
  const model = models.get(selected.id)!
  const effectBounds=selected.smokeEffect||selected.fountains?.length?new THREE.Box3().setFromObject(model.group):null
  const bounds = selected.reference?.type === "building" ? new THREE.Box3().setFromObject(model.group).getBoundingSphere(new THREE.Sphere()) : null
  const vertical = Math.max(40, ref.height * 1.45, ((ref.width * height) / width) * 1.3, effectBounds?effectBounds.getSize(new THREE.Vector3()).y*1.45:0, bounds ? bounds.radius * 2.6 * Math.max(1, height / width) : 0) / zoom
  renderer.setSize(width, height, false)
  camera.left = (-vertical * width) / height / 2
  camera.right = -camera.left
  camera.top = vertical / 2
  camera.bottom = -camera.top
  const heading = ((45 + yaw) * Math.PI) / 180,
    altitude = (pitch * Math.PI) / 180
  const target = bounds?.center ?? (effectBounds?effectBounds.getCenter(new THREE.Vector3()):new THREE.Vector3(0, -(ref.y + ref.height / 2) / Math.cos(Math.PI / 6), 0))
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
  model.updateEffects(effectTimeOverride??performance.now()/1000)
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
  selected = inkAssets.find((asset) => asset.id === id) ?? inkAssets[2]!
  id = selected.id
  if (!models.has(id) && models.size >= 3) {
    const oldest = models.keys().next().value!
    models.get(oldest)!.dispose()
    models.delete(oldest)
  }
  if (!models.has(id)) models.set(id, buildAsset(selected, { batchFaces: true }))
  scene.clear()
  scene.add(models.get(id)!.group)
  category.value = selected.category ?? "buildings"
  search.value = ""
  filter()
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
  output
    .getContext("2d")!
    .drawImage(
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
    capture,
    captureEffect: (time:number)=>{effectTimeOverride=time;render();const image=capture("model");effectTimeOverride=null;return image}
  }
})
select(new URLSearchParams(location.search).get("asset") ?? selected.id)
let effectFrame=0
const animateEffect=()=>{if(selected.smokeEffect||selected.fountains?.length)render();effectFrame=requestAnimationFrame(animateEffect)}
effectFrame=requestAnimationFrame(animateEffect)
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(effectFrame)
    resize.disconnect()
    models.forEach((model) => model.dispose())
    renderer.dispose()
  })
