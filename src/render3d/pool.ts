import * as THREE from "three"
import { buildAsset, type BuiltAsset } from "../asset-lab/renderer.ts"
import type { InkAsset } from "../asset-lab/primitives.ts"
import { surfaceState, type SurfaceState } from "./surface-state.ts"
import { installSurfaceShader } from "./surface-shader.ts"

interface Part {
  source: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  material: THREE.MeshBasicMaterial
  mesh: THREE.InstancedMesh | null
  color: number
}
interface Template {
  key: string
  model: BuiltAsset
  group: THREE.Group
  parts: Array<Part>
  handles: Set<ModelHandle>
  capacity: number
  alpha: Float32Array
  effects: Float32Array
  hazards: Float32Array
  bounds: Float32Array
  used: number
}

/** One logical model. Its root owns transforms; shared GPU instances draw it. */
export class ModelHandle {
  readonly root = new THREE.Group()
  readonly tint = new THREE.Color(0xffffff)
  alpha = 1
  colors: ReadonlyMap<number, number> | null = null
  effects: SurfaceState = surfaceState()
  effectBounds = new THREE.Vector4()
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

/** Geometry, outlines and materials are built once per visual state. Repeated
 * homes, trees and walkers share instanced draw calls, with entity IDs retained
 * for picking. Unused construction/animation states have a bounded cache. */
export class ModelPool {
  readonly root = new THREE.Group()
  private templates = new Map<string, Template>()
  private stamp = 0
  private matrix = new THREE.Matrix4()
  private color = new THREE.Color()
  readonly viewDirection = new THREE.Vector3(1, 1, 1).normalize()
  readonly time = { value: 0 }
  acquire(key: string, create: () => InkAsset): Template {
    let entry = this.templates.get(key)
    if (!entry) {
      const model = buildAsset(create(), { batchFaces: true, meshInk: true, meshContours: true, surfaceEffects: false })
      const parts: Array<Part> = []
      model.group.updateMatrixWorld(true)
      for (const child of model.group.children) {
        if (!(child instanceof THREE.Mesh)) throw new Error("Live model ink must be portable mesh geometry")
        const source = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
          material = source.material.clone()
        const color = source.material.color.getHex(THREE.SRGBColorSpace)
        material.color.setHex(0xffffff)
        material.alphaToCoverage = !material.transparent
        material.onBeforeCompile = (shader) => {
          shader.vertexShader = "attribute float inkOpacity; varying float vInkOpacity;\n" + shader.vertexShader
          shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvInkOpacity=inkOpacity;")
          if (source.geometry.hasAttribute("inkNormalA")) {
            shader.uniforms.inkViewDirection = { value: this.viewDirection }
            shader.vertexShader = "attribute vec3 inkNormalA; attribute vec3 inkNormalB; uniform vec3 inkViewDirection;\n" + shader.vertexShader
            shader.vertexShader = shader.vertexShader.replace(
              "vInkOpacity=inkOpacity;",
              "vInkOpacity=inkOpacity * step(0.0, -dot(mat3(instanceMatrix)*inkNormalA,inkViewDirection)*dot(mat3(instanceMatrix)*inkNormalB,inkViewDirection));"
            )
          }
          shader.fragmentShader = "varying float vInkOpacity;\n" + shader.fragmentShader
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <alphatest_fragment>",
            "diffuseColor.a *= vInkOpacity;\n#include <alphatest_fragment>"
          )
        }
        material.customProgramCacheKey = () =>
          source.geometry.hasAttribute("inkNormalA") ? "ink-instance-silhouette-v1" : "ink-instance-opacity-v1"
        if (source.userData.structureSurface) installSurfaceShader(material,color,this.time,surfaceState(),new THREE.Vector4(),true)
        parts.push({ source, material, mesh: null, color })
      }
      entry = {
        key,
        model,
        parts,
        group: new THREE.Group(),
        handles: new Set(),
        capacity: 0,
        alpha: new Float32Array(),
        effects: new Float32Array(), hazards: new Float32Array(), bounds: new Float32Array(),
        used: ++this.stamp
      }
      this.templates.set(key, entry)
    }
    entry.used = ++this.stamp
    if (entry.group.parent !== this.root) this.root.add(entry.group)
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
      const handles = [...entry.handles].filter((h) => {
        if (h.alpha <= 0) return false
        for (let p: THREE.Object3D | null = h.root; p; p = p.parent) if (!p.visible) return false
        return true
      })
      if (!handles.length) {
        entry.group.removeFromParent()
        continue
      }
      if (entry.group.parent !== this.root) this.root.add(entry.group)
      if (entry.capacity < handles.length) {
        entry.capacity = 2 ** Math.ceil(Math.log2(Math.max(4, handles.length)))
        entry.alpha = new Float32Array(entry.capacity)
        entry.effects = new Float32Array(entry.capacity * 4)
        entry.hazards = new Float32Array(entry.capacity * 4)
        entry.bounds = new Float32Array(entry.capacity * 4)
        for (const part of entry.parts) {
          if (part.mesh) {
            part.mesh.removeFromParent()
            part.mesh.geometry.dispose()
            part.mesh.dispose()
          }
          const geometry = new THREE.BufferGeometry()
          geometry.setIndex(part.source.geometry.index)
          for (const [key, attribute] of Object.entries(part.source.geometry.attributes)) geometry.setAttribute(key, attribute)
          geometry.setAttribute("inkOpacity", new THREE.InstancedBufferAttribute(entry.alpha, 1))
          geometry.setAttribute("structureState",new THREE.InstancedBufferAttribute(entry.effects,4))
          geometry.setAttribute("structureHazards",new THREE.InstancedBufferAttribute(entry.hazards,4))
          geometry.setAttribute("structureBounds",new THREE.InstancedBufferAttribute(entry.bounds,4))
          geometry.boundingBox = part.source.geometry.boundingBox?.clone() ?? null
          geometry.boundingSphere = part.source.geometry.boundingSphere?.clone() ?? null
          part.mesh = new THREE.InstancedMesh(geometry, part.material, entry.capacity)
          part.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
          part.mesh.renderOrder = part.source.renderOrder
          part.mesh.userData.handles = handles
          entry.group.add(part.mesh)
        }
      }
      handles.forEach((handle, i) => {
        handle.root.updateWorldMatrix(true, false)
        entry.alpha[i] = Math.min(1, Math.max(0, handle.alpha))
        const e=handle.effects
        entry.effects.set([e.wear,e.care,e.snow,e.burning],i*4)
        entry.hazards.set([e.fireRisk,e.health,e.order,e.sick],i*4)
        handle.effectBounds.toArray(entry.bounds,i*4)
        for (const part of entry.parts) {
          this.matrix.multiplyMatrices(handle.root.matrixWorld, part.source.matrixWorld)
          part.mesh!.setMatrixAt(i, this.matrix)
          this.color.setHex(handle.colors?.get(part.color) ?? part.color).multiply(handle.tint)
          part.mesh!.setColorAt(i, this.color)
        }
      })
      for (const part of entry.parts) {
        const mesh = part.mesh!
        mesh.count = handles.length
        mesh.userData.handles = handles
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        mesh.geometry.getAttribute("inkOpacity").needsUpdate = true
        for(const key of ["structureState","structureHazards","structureBounds"])mesh.geometry.getAttribute(key).needsUpdate=true
        mesh.computeBoundingSphere()
      }
    }
    const idle = [...this.templates.values()].filter((e) => !e.handles.size).sort((a, b) => a.used - b.used)
    for (const entry of idle.slice(0, Math.max(0, idle.length - 64))) {
      this.disposeEntry(entry)
      this.templates.delete(entry.key)
    }
  }
  pickables(): Array<THREE.Object3D> {
    return [...this.templates.values()]
      .filter((e) => e.group.parent === this.root && [...e.handles].some((h) => h.entity !== null))
      .flatMap((e) => e.parts.map((p) => p.mesh!).filter(Boolean))
  }
  stats() {
    return {
      templates: this.templates.size,
      models: [...this.templates.values()].reduce((n, e) => n + e.handles.size, 0),
      batches: [...this.templates.values()].filter((e) => e.group.parent === this.root).reduce((n, e) => n + e.parts.length, 0)
    }
  }
  private disposeEntry(entry: Template) {
    entry.group.removeFromParent()
    for (const part of entry.parts) {
      part.mesh?.geometry.dispose()
      part.mesh?.dispose()
      part.material.dispose()
    }
    entry.model.dispose()
  }
  dispose() {
    for (const entry of this.templates.values()) this.disposeEntry(entry)
    this.templates.clear()
  }
}
