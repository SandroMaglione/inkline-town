import { BatchedMesh3D, Container3D, Matrix4, RenderPassBit, type FlatMaterial, type Geometry3D } from "@pixi/3d"
import type { InkAsset } from "./assets/primitives.ts"
import { inkMesh, type InkPart } from "./assets/ink-mesh.ts"
import { surfaceState, type SurfaceState } from "./surface-state.ts"
import { tinted, toGeometry } from "./gpu.ts"
import { instanceMaterial } from "./materials.ts"
import { bounds, triangleCount, type MeshData } from "./mesh/geometry.ts"
import { rayHitsBox, rayTriangle, type Ray } from "./mesh/ray.ts"
import type { Vec3 } from "./mesh/vec3.ts"

interface Part {
  readonly part: InkPart
  readonly geometry: Geometry3D
  readonly opaque: FlatMaterial
  readonly blend: FlatMaterial
}
interface Template {
  readonly key: string
  readonly parts: ReadonlyArray<Part>
  /** The model's extent, in its own space, for picking. */
  readonly box: readonly [Vec3, Vec3]
  readonly triangles: number
  readonly handles: Set<ModelHandle>
  batch: BatchedMesh3D | null
  capacity: number
  /** Each slot's material: 0 none (drawn by no pass), 1 opaque, 2 blended. */
  modes: Uint8Array
  /** The copies drawn at the last flush, in slot order. */
  drawn: Array<ModelHandle>
  used: number
}

/** One logical model. Its root owns transforms; shared GPU instances draw it. */
export class ModelHandle {
  readonly root = new Container3D()
  /** A colour over the whole model (sRGB hex), multiplied in linear light. */
  tint = 0xffffff
  alpha = 1
  /** Colours swapped for others on this copy (a walker's coat): source colour to drawn colour. */
  colors: ReadonlyMap<number, number> | null = null
  effects: SurfaceState = surfaceState()
  /** Its structure's half width and height (world units), a noise seed, and 1 to shade it as one; or all 0. */
  effectBounds: [number, number, number, number] = [0, 0, 0, 0]
  template: Template | null = null
  readonly pool: ModelPool
  readonly entity: number | null
  readonly pickCell: { x: number; y: number } | null
  constructor(pool: ModelPool, entity: number | null = null, pickCell: { x: number; y: number } | null = null) {
    this.pool = pool
    this.entity = entity
    this.pickCell = pickCell
  }
  use(key: string, create: () => InkAsset) {
    if (this.template?.key === key) return
    this.pool.release(this)
    this.template = this.pool.acquire(key, create)
    this.template.handles.add(this)
  }
  dispose() {
    this.pool.release(this)
    this.root.removeFromParent()
  }
}

const visible = (node: Container3D) => {
  for (let p: Container3D | null = node; p; p = p.parent) if (!p.visible) return false
  return true
}
const pass = (mode: number) => (mode === 2 ? RenderPassBit.TRANSPARENT : mode === 1 ? RenderPassBit.OPAQUE : 0)

/**
 * Geometry and materials are built once per visual state. Repeated homes,
 * trees and walkers share one batch a model, a slot for each part of each
 * copy, with entity IDs kept for picking. Unused construction and animation
 * states have a bounded cache.
 */
export class ModelPool {
  readonly root = new Container3D({ label: "models" })
  private templates = new Map<string, Template>()
  private stamp = 0
  private matrix = new Matrix4()
  private inverse = new Matrix4()
  acquire(key: string, create: () => InkAsset): Template {
    let entry = this.templates.get(key)
    if (!entry) {
      const pieces = inkMesh(create(), { batchFaces: true, meshInk: true, contours: true })
      for (const p of pieces) if (p.role === "line" && p.width > 0) throw new Error("Live model ink must be portable mesh geometry")
      const solid = pieces.filter((p) => p.role !== "line")
      const extents = solid.map((p) => bounds(p.mesh))
      entry = {
        key,
        parts: solid.map((part) => ({ part, geometry: toGeometry(part.mesh), opaque: instanceMaterial(part, false), blend: instanceMaterial(part, true) })),
        box: [
          [Math.min(...extents.map((e) => e[0][0])), Math.min(...extents.map((e) => e[0][1])), Math.min(...extents.map((e) => e[0][2]))],
          [Math.max(...extents.map((e) => e[1][0])), Math.max(...extents.map((e) => e[1][1])), Math.max(...extents.map((e) => e[1][2]))]
        ],
        triangles: solid.reduce((n, p) => n + triangleCount(p.mesh), 0),
        handles: new Set(),
        batch: null,
        capacity: 0,
        modes: new Uint8Array(),
        drawn: [],
        used: ++this.stamp
      }
      this.templates.set(key, entry)
    }
    entry.used = ++this.stamp
    return entry
  }
  release(handle: ModelHandle) {
    if (!handle.template) return
    handle.template.handles.delete(handle)
    handle.template.used = ++this.stamp
    handle.template = null
  }
  flush() {
    for (const entry of this.templates.values()) {
      const handles = [...entry.handles].filter((h) => h.alpha > 0 && visible(h.root))
      entry.drawn = handles
      if (!handles.length || !entry.parts.length) {
        if (entry.batch) entry.batch.visible = false
        continue
      }
      const P = entry.parts.length
      if (entry.capacity < handles.length) {
        entry.batch?.destroy()
        entry.capacity = 2 ** Math.ceil(Math.log2(Math.max(4, handles.length)))
        const vec4 = (value: [number, number, number, number]) => ({ value, type: "vec4<f32>" as const })
        entry.batch = new BatchedMesh3D({
          size: entry.capacity * P,
          label: entry.key,
          // Copies off screen are skipped: most of a large town is, close in.
          cull: "gpu",
          instanceData: { tint: vec4([1, 1, 1, 1]), state: vec4([0, 0, 0, 0]), hazards: vec4([0, 0, 0, 0]), bounds: vec4([0, 0, 0, 0]) }
        })
        for (let slot = 0; slot < entry.capacity * P; slot++) entry.batch.setGeometryAt(slot, entry.parts[slot % P]!.geometry)
        entry.modes = new Uint8Array(entry.capacity * P)
        this.root.addChild(entry.batch)
      }
      const batch = entry.batch!
      batch.visible = true
      const matrices = batch.matrices, data = batch.instanceData, f = data.fields
      handles.forEach((handle, i) => {
        const world = handle.root.getGlobalTransform(this.matrix).elements
        const alpha = Math.min(1, Math.max(0, handle.alpha)), e = handle.effects, b = handle.effectBounds
        for (let p = 0; p < P; p++) {
          const slot = i * P + p, part = entry.parts[p]!.part
          matrices.data.set(world, matrices.offset + slot * matrices.stride)
          const o = data.offset + slot * data.stride
          tinted(handle.colors?.get(part.color) ?? part.color, handle.tint, data.data, o + f.tint!)
          data.data[o + f.tint! + 3] = alpha
          data.data.set([e.wear, e.care, e.snow, e.burning], o + f.state!)
          data.data.set([e.fireRisk, e.health, e.order, e.sick], o + f.hazards!)
          data.data.set(b, o + f.bounds!)
          const mode = alpha < 1 || part.opacity < 1 ? 2 : 1
          if (entry.modes[slot] !== mode) {
            batch.setMaterialAt(slot, mode === 2 ? entry.parts[p]!.blend : entry.parts[p]!.opaque)
            batch.setPassesAt(slot, pass(mode))
            entry.modes[slot] = mode
          }
        }
      })
      for (let slot = handles.length * P; slot < entry.capacity * P; slot++)
        if (entry.modes[slot] !== 0) {
          batch.setPassesAt(slot, 0)
          entry.modes[slot] = 0
        }
      matrices.update()
      data.update()
    }
    const idle = [...this.templates.values()].filter((e) => !e.handles.size).sort((a, b) => a.used - b.used)
    for (const entry of idle.slice(0, Math.max(0, idle.length - 64))) {
      this.disposeEntry(entry)
      this.templates.delete(entry.key)
    }
  }
  /**
   * The nearest model under `ray` (world space) with an entity, as drawn at the
   * last flush: each copy's box first, then its triangles, in its own space.
   */
  pick(ray: Ray): { handle: ModelHandle; distance: number } | null {
    let best: { handle: ModelHandle; distance: number } | null = null
    for (const entry of this.templates.values())
      for (const handle of entry.drawn) {
        if (handle.entity === null || handle.alpha <= 0) continue
        const m = this.inverse.getInverse(handle.root.getGlobalTransform(this.matrix)).elements
        const point = (v: Vec3, w: number): Vec3 => [
          m[0]! * v[0] + m[4]! * v[1] + m[8]! * v[2] + m[12]! * w,
          m[1]! * v[0] + m[5]! * v[1] + m[9]! * v[2] + m[13]! * w,
          m[2]! * v[0] + m[6]! * v[1] + m[10]! * v[2] + m[14]! * w
        ]
        const local: Ray = { origin: point(ray.origin, 1), direction: point(ray.direction, 0) }
        if (!rayHitsBox(local, entry.box[0], entry.box[1])) continue
        for (const { part } of entry.parts) {
          const t = nearest(local, part.mesh, part.role !== "fill")
          if (t !== null && (!best || t < best.distance)) best = { handle, distance: t }
        }
      }
    return best
  }
  stats() {
    const drawn = [...this.templates.values()].filter((e) => e.drawn.length)
    return {
      templates: this.templates.size,
      models: [...this.templates.values()].reduce((n, e) => n + e.handles.size, 0),
      batches: drawn.reduce((n, e) => n + e.parts.length, 0),
      triangles: drawn.reduce((n, e) => n + e.triangles * e.drawn.length, 0)
    }
  }
  private disposeEntry(entry: Template) {
    entry.batch?.destroy()
    for (const { geometry } of entry.parts) geometry.destroy()
  }
  dispose() {
    for (const entry of this.templates.values()) this.disposeEntry(entry)
    this.templates.clear()
  }
}

const corner = (data: Float32Array, i: number): Vec3 => [data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!]
/** How far along `ray` it first meets `mesh` (both in the mesh's space), front faces only if `cull`. */
function nearest(ray: Ray, mesh: MeshData, cull: boolean): number | null {
  let best: number | null = null
  const count = mesh.index ? mesh.index.length : mesh.positions.length / 3
  for (let i = 0; i < count; i += 3) {
    const [a, b, c] = mesh.index ? [mesh.index[i]!, mesh.index[i + 1]!, mesh.index[i + 2]!] : [i, i + 1, i + 2]
    const t = rayTriangle(ray, corner(mesh.positions, a), corner(mesh.positions, b), corner(mesh.positions, c), cull)
    if (t !== null && (best === null || t < best)) best = t
  }
  return best
}
