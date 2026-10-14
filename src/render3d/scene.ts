import * as THREE from "three"
import { NodeRegistry } from "@typeonce/bevy-ts-render"
import { buildAsset, floorScale, vertex3, type BuiltAsset } from "../asset-lab/renderer.ts"
import { house } from "../asset-lab/homes.ts"
import { makeBuilding } from "../asset-lab/buildings.ts"
import type { InkAsset } from "../asset-lab/primitives.ts"
import { GRID, type Point } from "../iso.ts"
import { key } from "../grid.ts"
import { kinds } from "../content.ts"
import type { Preview, UiValue } from "../ui.ts"
import { ModelHandle, ModelPool } from "./pool.ts"
import { groundAsset, landAsset, overlayAsset, previewAsset, type OverlayCell } from "./models.ts"
import { parkAsset } from "../asset-lab/town-props.ts"
import type { ParkCell } from "../appeal.ts"

/** Where the camera stands: the grid cell it looks at, its zoom, and its angles. */
export interface CameraView {
  readonly x: number
  readonly y: number
  readonly zoom: number
  readonly heading: number
  readonly elevation: number
}

export interface SceneNode {
  readonly group: THREE.Group
  orient(): void
  destroy(): void
}

/** The world renderer has no simulation authority. It accepts visual state,
 * renders shared models, and translates screen coordinates back to the grid. */
export class GameScene {
  readonly scene = new THREE.Scene()
  readonly objects = new THREE.Group()
  readonly pool = new ModelPool()
  readonly camera = new THREE.OrthographicCamera(-500, 500, 400, -400, 0.1, 14000)
  readonly renderer: THREE.WebGLRenderer
  readonly nodes = new Set<SceneNode>()
  readonly target = new THREE.Vector3((GRID / 2) * floorScale, 0, (GRID / 2) * floorScale)
  heading = Math.PI / 4
  elevation = Math.PI / 6
  generation = 0
  groundDirty = true
  /** Winter: the land is frosted and everything standing tinted cold. */
  frost = false
  private overlayKey = ""
  private overlay: BuiltAsset | null = null
  private landKey: string | null = null
  private groundKey = ""
  private previewKey = ""
  private land: BuiltAsset | null = null
  private ground: BuiltAsset | null = null
  private parks: BuiltAsset | null = null
  private parksKey = ""
  private parkPreview: BuiltAsset | null = null
  private overlays: BuiltAsset | null = null
  private roadPreview: BuiltAsset | null = null
  private ghostHandles: Array<ModelHandle> = []
  private raycaster = new THREE.Raycaster()
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private width = 1
  private height = 1
  private observer: ResizeObserver
  private mount: HTMLElement
  private previous = 0
  private frames = 0
  private frameMS = 16.67
  constructor(mount: HTMLElement) {
    this.mount = mount
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: import.meta.env.DEV })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0xe2e9e6)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.domElement.className = "world-canvas"
    this.renderer.domElement.setAttribute("aria-label", "Inkline Town 3D map. Drag to pan, right-drag to rotate, wheel to zoom.")
    this.renderer.domElement.tabIndex = 0
    mount.append(this.renderer.domElement)
    this.scene.add(this.objects, this.pool.root)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(mount)
    this.camera.zoom = innerWidth >= 1000 ? 1 : 0.65
    this.resize()
    this.placeCamera()
  }
  get canvas() {
    return this.renderer.domElement
  }
  private resize() {
    this.width = Math.max(1, this.mount.clientWidth)
    this.height = Math.max(1, this.mount.clientHeight)
    this.renderer.setSize(this.width, this.height, false)
    this.camera.left = -this.width / 2
    this.camera.right = this.width / 2
    this.camera.top = this.height / 2
    this.camera.bottom = -this.height / 2
    this.camera.updateProjectionMatrix()
  }
  private placeCamera() {
    const distance = 6000
    this.camera.position
      .copy(this.target)
      .add(
        new THREE.Vector3(
          Math.sin(this.heading) * Math.cos(this.elevation) * distance,
          Math.sin(this.elevation) * distance,
          Math.cos(this.heading) * Math.cos(this.elevation) * distance
        )
      )
    this.camera.lookAt(this.target)
    this.camera.updateMatrixWorld(true)
  }
  groundAt(sx: number, sy: number): Point {
    const rect = this.canvas.getBoundingClientRect()
    this.raycaster.setFromCamera(
      new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, 1 - ((sy - rect.top) / rect.height) * 2),
      this.camera
    )
    const point = this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3()) ?? this.target
    return { x: point.x / floorScale, y: point.z / floorScale }
  }
  inputAt(sx: number, sy: number, tool: UiValue["tool"]) {
    let at = this.groundAt(sx, sy)
    let hit: number | null = null
    const intersects = this.raycaster.intersectObjects(this.pool.pickables(), false)
    for (const intersection of intersects) {
      const handle = (intersection.object.userData.handles as Array<ModelHandle>)[intersection.instanceId ?? 0]
      if (!handle || handle.entity === null || handle.alpha <= 0) continue
      hit = handle.entity
      if ((tool === "select" || tool === "bulldoze") && handle.pickCell) at = { ...handle.pickCell }
      break
    }
    return { at, hit }
  }
  project(x: number, y: number, height = 0): Point {
    const p = vertex3([x, y, height]).project(this.camera),
      rect = this.canvas.getBoundingClientRect()
    return { x: rect.left + ((p.x + 1) * rect.width) / 2, y: rect.top + ((1 - p.y) * rect.height) / 2 }
  }
  pan(dx: number, dy: number) {
    const cx = this.width / 2,
      cy = this.height / 2,
      a = this.groundAt(cx, cy),
      b = this.groundAt(cx + dx, cy + dy)
    this.target.x += (a.x - b.x) * floorScale
    this.target.z += (a.y - b.y) * floorScale
    this.placeCamera()
  }
  panGrid(dx: number, dy: number) {
    this.target.x += dx * floorScale
    this.target.z += dy * floorScale
    this.placeCamera()
  }
  rotate(dx: number, dy = 0) {
    this.heading += dx
    this.elevation = THREE.MathUtils.clamp(this.elevation + dy, Math.PI / 12, (Math.PI / 180) * 65)
    this.placeCamera()
  }
  zoomAt(sx: number, sy: number, factor: number) {
    const before = this.groundAt(sx, sy)
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * factor, 0.35, 4)
    this.camera.updateProjectionMatrix()
    const after = this.groundAt(sx, sy)
    this.target.x += (before.x - after.x) * floorScale
    this.target.z += (before.y - after.y) * floorScale
    this.placeCamera()
  }
  zoomBy(factor: number) {
    this.zoomAt(this.width / 2, this.height / 2, factor)
  }
  resetCamera() {
    this.heading = Math.PI / 4
    this.elevation = Math.PI / 6
    this.target.set((GRID / 2) * floorScale, 0, (GRID / 2) * floorScale)
    this.camera.zoom = innerWidth >= 1000 ? 1 : 0.65
    this.camera.updateProjectionMatrix()
    this.placeCamera()
  }
  focus(x: number, y: number) {
    this.target.set(x * floorScale, 0, y * floorScale)
    this.placeCamera()
  }
  registry<T extends SceneNode>(): NodeRegistry.NodeRegistry<T> {
    return NodeRegistry.make<T>({
      attach: (node) => {
        this.nodes.add(node)
        this.objects.add(node.group)
      },
      detach: (node) => {
        this.nodes.delete(node)
        node.destroy()
      }
    })
  }
  add(node: SceneNode) {
    this.nodes.add(node)
    this.objects.add(node.group)
  }
  remove(node: SceneNode) {
    this.nodes.delete(node)
  }
  private replace(old: BuiltAsset | null, asset: InkAsset): BuiltAsset | null {
    if (old) {
      old.group.removeFromParent()
      old.dispose()
    }
    if (!asset.faces.length && !asset.strokes.length) return null
    const model = buildAsset(asset, { batchFaces: true })
    this.scene.add(model.group)
    return model
  }
  setLand(mask: string, frost = false) {
    const id = `${frost}|${mask}`
    if (id === this.landKey) return
    this.landKey = id
    this.frost = frost
    this.renderer.setClearColor(frost ? 0xe6edf1 : 0xe2e9e6)
    this.land = this.replace(this.land, landAsset(mask, frost))
  }
  setGround(roads: ReadonlySet<number>, water: ReadonlySet<number>, paved: ReadonlySet<number> = new Set()) {
    const id = [...roads].join(",") + "|" + [...water].join(",") + "|" + [...paved].join(",")
    if (!this.groundDirty && id === this.groundKey) return
    this.groundDirty = false
    this.groundKey = id
    this.ground = this.replace(this.ground, groundAsset(roads, water, false, paved))
  }
  /** The parks, redrawn whenever a cell of one (or a road beside one) changes. */
  setParks(cells: ReadonlyMap<number, ParkCell>, roads: ReadonlySet<number>) {
    const id = [...cells].map(([k, c]) => `${k}:${c.ground}:${c.prop}`).join(",") + "|" + [...roads].join(",")
    if (id === this.parksKey) return
    this.parksKey = id
    this.parks = this.replace(this.parks, parkAsset(cells, roads))
  }
  /** A map view: each cell (or footprint) washed in a colour, or nothing. */
  setOverlay(id: string, cells: ReadonlyArray<OverlayCell>) {
    if (id === this.overlayKey) return
    this.overlayKey = id
    this.overlay = this.replace(this.overlay, overlayAsset(cells))
  }
  setPreview(preview: Preview, time: number) {
    const beat = preview.plots.some((p) => p.look === "picked" || p.look === "blocked") ? Math.floor(time * 8) : 0
    const id = JSON.stringify([preview.plots, preview.ghosts, preview.roads, preview.parks, beat])
    if (id === this.previewKey) return
    this.previewKey = id
    this.overlays = this.replace(this.overlays, previewAsset(preview, time))
    this.roadPreview = this.replace(this.roadPreview, groundAsset(new Set(preview.roads.map((p) => key(p.x, p.y))), new Set(), true))
    this.parkPreview = this.replace(this.parkPreview, parkAsset(new Map(preview.parks.map((c) => [key(c.x, c.y), c])), new Set(), true))
    for (const handle of this.ghostHandles) handle.dispose()
    this.ghostHandles = []
    for (const ghost of preview.ghosts) {
      const handle = new ModelHandle(this.pool),
        size = ghost.what === "home" ? 1 : kinds[ghost.what].size
      handle.alpha = 0.45
      handle.use("ghost/" + ghost.what, () => (ghost.what === "home" ? house(1, 0.03) : makeBuilding(ghost.what, { motion: false })))
      handle.root.position.copy(vertex3([ghost.cell.x + size / 2, ghost.cell.y + size / 2, 0.2]))
      this.objects.add(handle.root)
      this.ghostHandles.push(handle)
    }
  }
  resetPresentation() {
    this.generation++
    this.landKey = null
    this.groundDirty = true
    this.parksKey = ""
    this.previewKey = ""
    for (const node of [...this.nodes]) node.destroy()
    this.nodes.clear()
    for (const handle of this.ghostHandles) handle.dispose()
    this.ghostHandles = []
    this.overlays = this.replace(this.overlays, { id: "empty", title: "", note: "", faces: [], strokes: [] })
    this.overlayKey = ""
    this.overlay = this.replace(this.overlay, { id: "empty", title: "", note: "", faces: [], strokes: [] })
    this.roadPreview = this.replace(this.roadPreview, { id: "empty", title: "", note: "", faces: [], strokes: [] })
    this.parkPreview = this.replace(this.parkPreview, { id: "empty", title: "", note: "", faces: [], strokes: [] })
  }
  subscribe(onTick: (tick: { deltaMS: number }) => void) {
    this.previous = 0
    this.renderer.setAnimationLoop((now) => {
      const delta = this.previous ? Math.max(0, now - this.previous) : 1000 / 60
      this.previous = now
      this.frameMS = this.frameMS * 0.95 + Math.min(delta, 250) * 0.05
      onTick({ deltaMS: delta })
      for (const node of this.nodes) node.orient()
      this.camera.getWorldDirection(this.pool.viewDirection).negate()
      this.pool.time.value = now / 1000
      this.parks?.updateEffects(now/1000)
      this.parkPreview?.updateEffects(now/1000)
      this.pool.flush()
      this.renderer.render(this.scene, this.camera)
      this.frames++
    })
    return { stop: () => this.renderer.setAnimationLoop(null) }
  }
  stats() {
    return {
      renderer: "three",
      frames: this.frames,
      frameMS: this.frameMS,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      nodes: this.nodes.size,
      ...this.pool.stats(),
      zoom: this.camera.zoom,
      heading: THREE.MathUtils.radToDeg(this.heading),
      elevation: THREE.MathUtils.radToDeg(this.elevation),
      target: [this.target.x / floorScale, this.target.z / floorScale],
      generation: this.generation
    }
  }
  capture() {
    return this.canvas.toDataURL("image/webp", 0.94)
  }
  /** Where the camera looks from, to share along with the town. */
  view(): CameraView {
    return { x: this.target.x / floorScale, y: this.target.z / floorScale, zoom: this.camera.zoom, heading: this.heading, elevation: this.elevation }
  }
  /** Looks from a shared view, kept within the limits the controls keep to. */
  setView(view: CameraView) {
    const finite = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback)
    this.target.set(THREE.MathUtils.clamp(finite(view.x, GRID / 2), 0, GRID) * floorScale, 0, THREE.MathUtils.clamp(finite(view.y, GRID / 2), 0, GRID) * floorScale)
    this.camera.zoom = THREE.MathUtils.clamp(finite(view.zoom, 1), 0.35, 4)
    this.heading = finite(view.heading, Math.PI / 4)
    this.elevation = THREE.MathUtils.clamp(finite(view.elevation, Math.PI / 6), Math.PI / 12, (Math.PI / 180) * 65)
    this.camera.updateProjectionMatrix()
    this.placeCamera()
  }
  /**
   * The town as the camera sees it, drawn afresh at `width` × `height`
   * (times `scale`) into a canvas of its own. The view is widened or
   * narrowed so all of what the mayor sees on screen fits the picture.
   * The drawing buffer is read right after the render, so this works
   * without keeping the buffer between frames.
   */
  picture(width: number, height: number, scale = 2): HTMLCanvasElement {
    const ratio = this.renderer.getPixelRatio(),
      zoom = this.camera.zoom,
      fit = Math.min(width / this.width, height / this.height)
    this.renderer.setPixelRatio(scale)
    this.renderer.setSize(width, height, false)
    this.camera.left = -width / 2
    this.camera.right = width / 2
    this.camera.top = height / 2
    this.camera.bottom = -height / 2
    this.camera.zoom = Math.max(0.3, zoom * fit)
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)
    const out = document.createElement("canvas")
    out.width = width * scale
    out.height = height * scale
    out.getContext("2d")!.drawImage(this.canvas, 0, 0, out.width, out.height)
    this.camera.zoom = zoom
    this.renderer.setPixelRatio(ratio)
    this.resize()
    this.renderer.render(this.scene, this.camera)
    return out
  }
  dispose() {
    this.renderer.setAnimationLoop(null)
    this.observer.disconnect()
    this.resetPresentation()
    for (const model of [this.land, this.ground, this.parks]) model?.dispose()
    this.pool.dispose()
    this.renderer.dispose()
  }
}
