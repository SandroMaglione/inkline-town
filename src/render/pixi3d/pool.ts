import { Container3D, Matrix4, Mesh3D, type FlatMaterial, type Geometry3D } from "@pixi/3d"
import type { InkAsset } from "./assets/primitives.ts"
import { inkMesh, type InkPart } from "./assets/ink-mesh.ts"
import { surfaceState, type SurfaceState } from "./surface-state.ts"
import { tinted, toGeometry } from "./gpu.ts"
import { copyMaterial, releaseMaterial } from "./materials.ts"
import { bounds, triangleCount, type MeshData } from "./mesh/geometry.ts"
import { rayHitsBox, rayTriangle, type Ray } from "./mesh/ray.ts"
import type { Vec3 } from "./mesh/vec3.ts"

interface Part {
  readonly part: InkPart
  readonly geometry: Geometry3D
}
interface Template {
  readonly key: string
  readonly parts: ReadonlyArray<Part>
  /** The model's extent, in its own space, for picking. */
  readonly box: readonly [Vec3, Vec3]
  readonly triangles: number
  readonly handles: Set<ModelHandle>
  /** The copies drawn at the last flush. */
  drawn: Array<ModelHandle>
  /** The copies holding meshes of this model, shown or hidden. */
  readonly dressed: Set<ModelHandle>
  used: number
}
/** One part of one copy: a mesh under the copy's root, with materials of its own. */
interface Piece {
  readonly part: InkPart
  readonly mesh: Mesh3D
  readonly opaque: FlatMaterial
  /** Made the first time the copy fades. */
  blend: FlatMaterial | null
}

/** One logical model. Its root owns transforms; its parts are meshes under it that share the model's geometry. */
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
  pieces: Array<Piece> = []
  /** Its meshes for every model it has been, hidden while it is another: a walker steps through a few, over and over. */
  readonly sets = new Map<Template, Array<Piece>>()
  /** What its materials were last given, to write them only when something changes. */
  sent: { values: Float64Array; colors: ReadonlyMap<number, number> | null } | null = null
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
    this.pool.leave(this)
    const template = this.pool.acquire(key, create)
    this.template = template
    template.handles.add(this)
    let pieces = this.sets.get(template)
    if (!pieces) {
      pieces = template.parts.map(({ part, geometry }) => {
        const opaque = copyMaterial(part, false), mesh = new Mesh3D({ geometry, material: opaque, castShadow: false })
        this.root.addChild(mesh)
        return { part, mesh, opaque, blend: null }
      })
      this.sets.set(template, pieces)
      template.dressed.add(this)
    }
    this.pieces = pieces
    this.sent = null
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

/**
 * Geometry is built once per visual state and shared by every copy. Each copy
 * is plain meshes under its own root, so the scene graph places it and the
 * engine draws the copies of a part together. Entity IDs are kept for picking.
 * Unused construction and animation states have a bounded cache.
 */
export class ModelPool {
  private templates = new Map<string, Template>()
  private stamp = 0
  private matrix = new Matrix4()
  private inverse = new Matrix4()
  private color = new Float32Array(4)
  acquire(key: string, create: () => InkAsset): Template {
    let entry = this.templates.get(key)
    if (!entry) {
      const pieces = inkMesh(create(), { batchFaces: true, meshInk: true, contours: true, contourRods: true })
      for (const p of pieces) if (p.role === "line" && p.width > 0) throw new Error("Live model ink must be portable mesh geometry")
      const solid = pieces.filter((p) => p.role !== "line")
      const extents = solid.map((p) => bounds(p.mesh))
      entry = {
        key,
        parts: solid.map((part) => ({ part, geometry: toGeometry(part.mesh) })),
        box: [
          [Math.min(...extents.map((e) => e[0][0])), Math.min(...extents.map((e) => e[0][1])), Math.min(...extents.map((e) => e[0][2]))],
          [Math.max(...extents.map((e) => e[1][0])), Math.max(...extents.map((e) => e[1][1])), Math.max(...extents.map((e) => e[1][2]))]
        ],
        triangles: solid.reduce((n, p) => n + triangleCount(p.mesh), 0),
        handles: new Set(),
        drawn: [],
        dressed: new Set(),
        used: ++this.stamp
      }
      this.templates.set(key, entry)
    }
    entry.used = ++this.stamp
    return entry
  }
  /** The copy stops being its model, and keeps that model's meshes hidden. */
  leave(handle: ModelHandle) {
    if (!handle.template) return
    for (const { mesh } of handle.pieces) mesh.visible = false
    handle.pieces = []
    handle.template.handles.delete(handle)
    handle.template.used = ++this.stamp
    handle.template = null
  }
  private strip(handle: ModelHandle, template: Template) {
    for (const { mesh, opaque, blend } of handle.sets.get(template) ?? []) {
      mesh.destroy()
      releaseMaterial(opaque)
      if (blend) releaseMaterial(blend)
    }
    handle.sets.delete(template)
    template.dressed.delete(handle)
  }
  release(handle: ModelHandle) {
    this.leave(handle)
    for (const template of [...handle.sets.keys()]) this.strip(handle, template)
  }
  /** Gives each copy's materials its colour, opacity and surface state, where they changed. */
  flush() {
    for (const entry of this.templates.values()) {
      entry.drawn = [...entry.handles].filter((h) => h.alpha > 0 && visible(h.root))
      for (const handle of entry.handles) {
        const alpha = Math.min(1, Math.max(0, handle.alpha)), e = handle.effects, b = handle.effectBounds
        const values = [handle.tint, alpha, e.wear, e.care, e.snow, e.burning, e.fireRisk, e.health, e.order, e.sick, b[0], b[1], b[2], b[3]]
        if (handle.sent && handle.sent.colors === handle.colors && values.every((v, i) => v === handle.sent!.values[i])) continue
        handle.sent = { values: Float64Array.from(values), colors: handle.colors }
        for (const piece of handle.pieces) {
          const { part, mesh } = piece
          if (mesh.visible !== alpha > 0) mesh.visible = alpha > 0
          const material = alpha < 1 || part.opacity < 1 ? (piece.blend ??= copyMaterial(part, true)) : piece.opaque
          if (mesh.material !== material) mesh.material = material
          tinted(handle.colors?.get(part.color) ?? part.color, handle.tint, this.color, 0)
          material.data.color = [this.color[0]!, this.color[1]!, this.color[2]!, alpha * part.opacity]
          if (part.role === "fill") {
            material.data.surfaceState = [e.wear, e.care, e.snow, e.burning]
            material.data.surfaceHazards = [e.fireRisk, e.health, e.order, e.sick]
            material.data.surfaceBounds = [...b]
          }
        }
      }
    }
    const idle = [...this.templates.values()].filter((e) => !e.handles.size).sort((a, b) => a.used - b.used)
    for (const entry of idle.slice(0, Math.max(0, idle.length - 64))) {
      for (const handle of [...entry.dressed]) this.strip(handle, entry)
      for (const { geometry } of entry.parts) geometry.destroy()
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
  dispose() {
    for (const entry of this.templates.values()) {
      for (const handle of [...entry.dressed]) this.release(handle)
      for (const { geometry } of entry.parts) geometry.destroy()
    }
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
