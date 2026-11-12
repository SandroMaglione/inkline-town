import { Container3D, Plane, Vector3, View3D, type Camera3D } from "@pixi/3d"
import { Application, RenderTexture, type Renderer } from "pixi.js"
import { NodeRegistry } from "@typeonce/ritmo-render"
import { buildAsset, floorScale, vertex3, type BuiltAsset } from "./assets/renderer.ts"
import { house } from "./assets/homes.ts"
import { makeBuilding } from "./assets/buildings.ts"
import type { InkAsset } from "./assets/primitives.ts"
import { GRID, type Point } from "../../game/world/iso.ts"
import { key } from "../../game/world/grid.ts"
import { kinds } from "../../game/content/index.ts"
import type { OverlayCell, Preview, Tool } from "../../view/contracts.ts"
import { ModelHandle, ModelPool } from "./pool.ts"
import { groundAsset, landAsset, overlayAsset, previewAsset } from "./models.ts"
import { parkAsset } from "./assets/town-props.ts"
import { FishWater } from "./fish-effects.ts"
import { channels } from "./gpu.ts"
import type { ParkCell } from "../../game/world/appeal.ts"

/** Where the camera stands: the grid cell it looks at, its zoom, and its angles. */
export interface CameraView {
  readonly x: number
  readonly y: number
  readonly zoom: number
  readonly heading: number
  readonly elevation: number
}

export interface SceneNode {
  readonly group: Container3D
  orient(): void
  destroy(): void
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const DISTANCE = 6000, NEAR = 0.1, FAR = 14000
const LAND = 0xe2e9e6, FROSTED = 0xe6edf1

/**
 * Counts what the GPU is asked to draw each frame (Pixi has no `renderer.info`):
 * draw calls, and triangles, instances included.
 */
export function drawCounter(renderer: Renderer) {
  const counts = { calls: 0, triangles: 0 }
  const gl = "gl" in renderer ? renderer.gl : null
  if (gl) {
    const drawElements = gl.drawElements.bind(gl), drawElementsInstanced = gl.drawElementsInstanced.bind(gl), drawArrays = gl.drawArrays.bind(gl)
    gl.drawElements = (mode, count, type, offset) => {
      counts.calls++
      if (mode === gl.TRIANGLES) counts.triangles += count / 3
      drawElements(mode, count, type, offset)
    }
    gl.drawElementsInstanced = (mode, count, type, offset, instances) => {
      counts.calls++
      if (mode === gl.TRIANGLES) counts.triangles += (count / 3) * instances
      drawElementsInstanced(mode, count, type, offset, instances)
    }
    gl.drawArrays = (mode, first, count) => {
      counts.calls++
      if (mode === gl.TRIANGLES) counts.triangles += count / 3
      drawArrays(mode, first, count)
    }
  }
  return counts
}

/** The world renderer has no simulation authority. It accepts visual state,
 * renders shared models, and translates screen coordinates back to the grid. */
export class GameScene {
  readonly app: Application
  /** The 3D view on the Pixi stage: its camera, and the root everything hangs from. */
  readonly world: View3D
  readonly objects = new Container3D({ label: "objects" })
  readonly pool = new ModelPool()
  readonly camera: Camera3D
  readonly nodes = new Set<SceneNode>()
  readonly target = new Vector3((GRID / 2) * floorScale, 0, (GRID / 2) * floorScale)
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
  private fish = new FishWater()
  private plane = new Plane(new Vector3(0, 1, 0), 0)
  private width = 1
  private height = 1
  private observer: ResizeObserver
  private mount: HTMLElement
  private previous = 0
  private frames = 0
  private frameMS = 16.67
  private frame = 0
  private drawn = { calls: 0, triangles: 0 }
  private counter: { calls: number; triangles: number }
  /** The renderer draws into `mount`, at its size. */
  static async create(mount: HTMLElement) {
    const app = new Application()
    await app.init({
      preference: "webgl",
      antialias: true,
      backgroundColor: LAND,
      resolution: Math.min(devicePixelRatio || 1, 2),
      autoDensity: true,
      autoStart: false,
      preserveDrawingBuffer: import.meta.env.DEV,
      width: Math.max(1, mount.clientWidth),
      height: Math.max(1, mount.clientHeight)
    })
    return new GameScene(mount, app)
  }
  private constructor(mount: HTMLElement, app: Application) {
    this.mount = mount
    this.app = app
    this.counter = drawCounter(app.renderer)
    this.world = new View3D({ autoResize: false, width: Math.max(1, mount.clientWidth), height: Math.max(1, mount.clientHeight) })
    this.camera = this.world.camera
    this.camera.useOrthographic(this.world.width / 2, NEAR, FAR)
    app.stage.addChild(this.world)
    const canvas = app.canvas
    canvas.className = "world-canvas"
    canvas.setAttribute("aria-label", "Inkline Town 3D map. Drag to pan, right-drag to rotate, wheel to zoom.")
    canvas.tabIndex = 0
    mount.append(canvas)
    this.world.root.addChild(this.objects, this.pool.root, this.fish.group)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(mount)
    this.camera.zoom = innerWidth >= 1000 ? 1 : 0.65
    this.resize()
    this.placeCamera()
  }
  get canvas(): HTMLCanvasElement {
    return this.app.canvas
  }
  private resize() {
    this.width = Math.max(1, this.mount.clientWidth)
    this.height = Math.max(1, this.mount.clientHeight)
    this.app.renderer.resize(this.width, this.height)
    this.world.setSize(this.width, this.height)
    this.camera.orthographicSize = this.width / 2
  }
  private placeCamera() {
    this.camera.position.set(
      this.target.x + Math.sin(this.heading) * Math.cos(this.elevation) * DISTANCE,
      this.target.y + Math.sin(this.elevation) * DISTANCE,
      this.target.z + Math.cos(this.heading) * Math.cos(this.elevation) * DISTANCE
    )
    this.camera.lookAt(this.target)
  }
  /** A point on the page (client pixels) as a point on the view (its own pixels). */
  private local(sx: number, sy: number) {
    const rect = this.canvas.getBoundingClientRect()
    return { x: ((sx - rect.left) / Math.max(1, rect.width)) * this.width, y: ((sy - rect.top) / Math.max(1, rect.height)) * this.height }
  }
  groundAt(sx: number, sy: number): Point {
    const point = this.world.screenToWorld(this.local(sx, sy), this.plane) ?? this.target
    return { x: point.x / floorScale, y: point.z / floorScale }
  }
  inputAt(sx: number, sy: number, tool: Tool) {
    let at = this.groundAt(sx, sy)
    let hit: number | null = null
    const ray = this.world.screenToRay(this.local(sx, sy))
    const picked = this.pool.pick({ origin: [ray.origin.x, ray.origin.y, ray.origin.z], direction: [ray.direction.x, ray.direction.y, ray.direction.z] })
    if (picked) {
      hit = picked.handle.entity
      if ((tool === "select" || tool === "bulldoze") && picked.handle.pickCell) at = { ...picked.handle.pickCell }
    }
    return { at, hit }
  }
  project(x: number, y: number, height = 0): Point {
    const [px, py, pz] = vertex3([x, y, height]), p = this.world.worldToScreen({ x: px, y: py, z: pz }) ?? { x: 0, y: 0 }
    const rect = this.canvas.getBoundingClientRect()
    return { x: rect.left + (p.x / this.width) * rect.width, y: rect.top + (p.y / this.height) * rect.height }
  }
  pan(dx: number, dy: number) {
    const cx = this.width / 2,
      cy = this.height / 2,
      rect = this.canvas.getBoundingClientRect(),
      a = this.groundAt(rect.left + cx, rect.top + cy),
      b = this.groundAt(rect.left + cx + dx, rect.top + cy + dy)
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
    this.elevation = clamp(this.elevation + dy, Math.PI / 12, (Math.PI / 180) * 65)
    this.placeCamera()
  }
  zoomAt(sx: number, sy: number, factor: number) {
    const before = this.groundAt(sx, sy)
    this.camera.zoom = clamp(this.camera.zoom * factor, 0.35, 4)
    const after = this.groundAt(sx, sy)
    this.target.x += (before.x - after.x) * floorScale
    this.target.z += (before.y - after.y) * floorScale
    this.placeCamera()
  }
  zoomBy(factor: number) {
    const rect = this.canvas.getBoundingClientRect()
    this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
  }
  resetCamera() {
    this.heading = Math.PI / 4
    this.elevation = Math.PI / 6
    this.target.set((GRID / 2) * floorScale, 0, (GRID / 2) * floorScale)
    this.camera.zoom = innerWidth >= 1000 ? 1 : 0.65
    this.placeCamera()
  }
  focus(x: number, y: number) {
    this.target.set(x * floorScale, 0, y * floorScale)
    this.placeCamera()
  }
  registry<T extends SceneNode>(): NodeRegistry.NodeRegistry<T> {
    return NodeRegistry.make<T>({
      // `parent` is the parent entity's node under a `RenderSync` hierarchy (none is given today): every node is on the root.
      attach: (node, parent) => {
        const into = parent?.group ?? this.objects
        this.nodes.add(node)
        into.addChild(node.group)
      },
      detach: (node) => {
        this.nodes.delete(node)
        node.destroy()
      }
    })
  }
  add(node: SceneNode) {
    this.nodes.add(node)
    this.objects.addChild(node.group)
  }
  remove(node: SceneNode) {
    this.nodes.delete(node)
  }
  private replace(old: BuiltAsset | null, asset: InkAsset): BuiltAsset | null {
    old?.dispose()
    if (!asset.faces.length && !asset.strokes.length) return null
    // The ground layers' ink is ribbons, and their faces' contours are left to the faces.
    const model = buildAsset(asset, { batchFaces: true, contours: false })
    this.world.root.addChild(model.group)
    return model
  }
  setLand(mask: string, frost = false) {
    const id = `${frost}|${mask}`
    if (id === this.landKey) return
    this.landKey = id
    this.frost = frost
    this.app.renderer.background.color = frost ? FROSTED : LAND
    this.land = this.replace(this.land, landAsset(mask, frost))
  }
  setGround(roads: ReadonlySet<number>, water: ReadonlySet<number>, paved: ReadonlySet<number> = new Set()) {
    const id = [...roads].join(",") + "|" + [...water].join(",") + "|" + [...paved].join(",")
    if (!this.groundDirty && id === this.groundKey) return
    this.groundDirty = false
    this.groundKey = id
    this.ground = this.replace(this.ground, groundAsset(roads, water, false, paved))
  }
  /** The water that would give a catch now: ripples on it (see `FishWater`). */
  setFish(cells: ReadonlyArray<Point>) {
    this.fish.set(cells)
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
      handle.root.position.set(...vertex3([ghost.cell.x + size / 2, ghost.cell.y + size / 2, 0.2]))
      this.objects.addChild(handle.root)
      this.ghostHandles.push(handle)
    }
  }
  resetPresentation() {
    this.generation++
    this.landKey = null
    this.groundDirty = true
    this.parksKey = ""
    this.previewKey = ""
    this.fish.set([])
    for (const node of [...this.nodes]) node.destroy()
    this.nodes.clear()
    for (const handle of this.ghostHandles) handle.dispose()
    this.ghostHandles = []
    const empty: InkAsset = { id: "empty", title: "", note: "", faces: [], strokes: [] }
    this.overlays = this.replace(this.overlays, empty)
    this.overlayKey = ""
    this.overlay = this.replace(this.overlay, empty)
    this.roadPreview = this.replace(this.roadPreview, empty)
    this.parkPreview = this.replace(this.parkPreview, empty)
  }
  /** Brings every view and effect up to `now` (milliseconds) and draws the frame. */
  private render(now: number) {
    for (const node of this.nodes) node.orient()
    this.parks?.updateEffects(now / 1000)
    this.fish.update(now / 1000)
    this.parkPreview?.updateEffects(now / 1000)
    this.pool.flush()
    this.counter.calls = 0
    this.counter.triangles = 0
    this.app.render()
    this.drawn = { ...this.counter }
  }
  subscribe(onTick: (tick: { deltaMS: number }) => void) {
    this.previous = 0
    const loop = (now: number) => {
      const delta = this.previous ? Math.max(0, now - this.previous) : 1000 / 60
      this.previous = now
      this.frameMS = this.frameMS * 0.95 + Math.min(delta, 250) * 0.05
      onTick({ deltaMS: delta })
      this.render(now)
      this.frames++
      this.frame = requestAnimationFrame(loop)
    }
    this.frame = requestAnimationFrame(loop)
    return { stop: () => cancelAnimationFrame(this.frame) }
  }
  stats() {
    const pool = this.pool.stats()
    return {
      renderer: "pixi3d",
      frames: this.frames,
      frameMS: this.frameMS,
      drawCalls: this.drawn.calls,
      triangles: this.drawn.triangles,
      nodes: this.nodes.size,
      templates: pool.templates,
      models: pool.models,
      batches: pool.batches,
      zoom: this.camera.zoom,
      heading: (this.heading * 180) / Math.PI,
      elevation: (this.elevation * 180) / Math.PI,
      target: [this.target.x / floorScale, this.target.z / floorScale],
      generation: this.generation
    }
  }
  capture() {
    this.render(performance.now())
    return this.canvas.toDataURL("image/webp", 0.94)
  }
  /** Where the camera looks from, to share along with the town. */
  view(): CameraView {
    return { x: this.target.x / floorScale, y: this.target.z / floorScale, zoom: this.camera.zoom, heading: this.heading, elevation: this.elevation }
  }
  /** Looks from a shared view, kept within the limits the controls keep to. */
  setView(view: CameraView) {
    const finite = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback)
    this.target.set(clamp(finite(view.x, GRID / 2), 0, GRID) * floorScale, 0, clamp(finite(view.y, GRID / 2), 0, GRID) * floorScale)
    this.camera.zoom = clamp(finite(view.zoom, 1), 0.35, 4)
    this.heading = finite(view.heading, Math.PI / 4)
    this.elevation = clamp(finite(view.elevation, Math.PI / 6), Math.PI / 12, (Math.PI / 180) * 65)
    this.placeCamera()
  }
  /**
   * The town as the camera sees it, drawn afresh at `width` × `height`
   * (times `scale`) into a canvas of its own. The view is widened or
   * narrowed so all of what the mayor sees on screen fits the picture.
   */
  picture(width: number, height: number, scale = 2): HTMLCanvasElement {
    const zoom = this.camera.zoom,
      fit = Math.min(width / this.width, height / this.height)
    this.pool.flush()
    this.world.setSize(width, height)
    this.camera.orthographicSize = width / 2
    this.camera.zoom = Math.max(0.3, zoom * fit)
    const target = RenderTexture.create({ width, height, resolution: scale, antialias: true })
    const [r, g, b] = channels(this.frost ? FROSTED : LAND)
    this.app.renderer.render({ container: this.world, target, clearColor: [r, g, b, 1] })
    const out = document.createElement("canvas")
    out.width = width * scale
    out.height = height * scale
    out.getContext("2d")!.drawImage(this.app.renderer.extract.canvas(target) as HTMLCanvasElement, 0, 0, out.width, out.height)
    target.destroy(true)
    this.camera.zoom = zoom
    this.resize()
    return out
  }
  dispose() {
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    this.resetPresentation()
    for (const model of [this.land, this.ground, this.parks]) model?.dispose()
    this.fish.dispose()
    this.pool.dispose()
    this.app.destroy(true, { children: true })
  }
}
