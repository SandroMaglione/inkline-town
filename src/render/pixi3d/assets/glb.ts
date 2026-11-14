/**
 * Binary glTF 2.0 for the catalogue, with no renderer in it: `exportAsset`
 * writes a model's meshes (see `exportMeshes`) with unlit materials
 * (`KHR_materials_unlit`) and its effect parameters as extras on the root
 * node; `readGlb` reads one back, for the export checks in Node.
 *
 * Colours are written as glTF asks: linear, from sRGB by the piecewise curve.
 */
import type { InkAsset } from "./primitives.ts"
import { exportMeshes } from "./ink-mesh.ts"
import { bounds } from "../mesh/geometry.ts"

const GLB = 0x46546c67, JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942
const FLOAT = 5126, UNSIGNED_SHORT = 5123, UNSIGNED_INT = 5125
const ARRAY_BUFFER = 34962, ELEMENT_ARRAY_BUFFER = 34963

const linear = (channel: number) => {
  const c = channel / 255
  return c < 0.04045 ? c * 0.0773993808 : (c * 0.9478672986 + 0.0521327014) ** 2.4
}

interface Accessor { bufferView: number; componentType: number; count: number; type: "SCALAR" | "VEC3"; min?: Array<number>; max?: Array<number> }

/** The model as a GLB: one node a material under a root named for the asset, its effects in the root's extras. */
export function writeGlb(asset: InkAsset): ArrayBuffer {
  const chunks: Array<Uint8Array> = [], bufferViews: Array<{ buffer: 0; byteOffset: number; byteLength: number; target: number }> = []
  const accessors: Array<Accessor> = [], materials: Array<unknown> = [], meshes: Array<unknown> = [], nodes: Array<{ name?: string; mesh?: number; children?: Array<number>; extras?: Record<string, unknown> }> = []
  let byteLength = 0
  const view = (bytes: Uint8Array, target: number) => {
    const padding = (4 - (byteLength % 4)) % 4
    if (padding) {
      chunks.push(new Uint8Array(padding))
      byteLength += padding
    }
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength, target })
    chunks.push(bytes)
    byteLength += bytes.byteLength
    return bufferViews.length - 1
  }
  for (const { material, mesh } of exportMeshes(asset)) {
    const [min, max] = bounds(mesh)
    const position = accessors.push({ bufferView: view(new Uint8Array(mesh.positions.buffer.slice(0)), ARRAY_BUFFER), componentType: FLOAT, count: mesh.positions.length / 3, type: "VEC3", min: [...min], max: [...max] }) - 1
    const normal = accessors.push({ bufferView: view(new Uint8Array(mesh.normals.buffer.slice(0)), ARRAY_BUFFER), componentType: FLOAT, count: mesh.normals.length / 3, type: "VEC3" }) - 1
    const index = mesh.index!
    const wide = mesh.positions.length / 3 > 65535
    const indices = accessors.push({ bufferView: view(new Uint8Array((wide ? Uint32Array.from(index) : Uint16Array.from(index)).buffer), ELEMENT_ARRAY_BUFFER), componentType: wide ? UNSIGNED_INT : UNSIGNED_SHORT, count: index.length, type: "SCALAR" }) - 1
    materials.push({
      pbrMetallicRoughness: { baseColorFactor: [linear((material.color >> 16) & 255), linear((material.color >> 8) & 255), linear(material.color & 255), material.opacity], metallicFactor: 0, roughnessFactor: 1 },
      ...(material.opacity < 1 ? { alphaMode: "BLEND" } : {}),
      ...(material.doubleSided ? { doubleSided: true } : {}),
      extensions: { KHR_materials_unlit: {} }
    })
    meshes.push({ primitives: [{ attributes: { POSITION: position, NORMAL: normal }, indices, mode: 4, material: materials.length - 1 }] })
    nodes.push({ mesh: meshes.length - 1 })
  }
  const extras: Record<string, unknown> = {}
  if (asset.effects) extras.inklineSurfaceEffects = asset.effects
  if (asset.smokeEffect) extras.inklineSmokeEffect = asset.smokeEffect
  if (asset.fountains?.length) extras.inklineFountains = asset.fountains
  nodes.push({ name: asset.id, children: nodes.map((_, i) => i), ...(Object.keys(extras).length ? { extras } : {}) })
  const json = {
    asset: { version: "2.0", generator: "Inkline Town" },
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0,
    scenes: [{ nodes: [nodes.length - 1] }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength }]
  }
  const pad = (n: number) => (4 - (n % 4)) % 4
  const text = new TextEncoder().encode(JSON.stringify(json)), jsonLength = text.length + pad(text.length), binLength = byteLength + pad(byteLength)
  const out = new Uint8Array(12 + 8 + jsonLength + 8 + binLength), data = new DataView(out.buffer)
  data.setUint32(0, GLB, true)
  data.setUint32(4, 2, true)
  data.setUint32(8, out.length, true)
  data.setUint32(12, jsonLength, true)
  data.setUint32(16, JSON_CHUNK, true)
  out.set(text, 20)
  out.fill(0x20, 20 + text.length, 20 + jsonLength)
  let o = 20 + jsonLength
  data.setUint32(o, binLength, true)
  data.setUint32(o + 4, BIN_CHUNK, true)
  o += 8
  for (const chunk of chunks) {
    out.set(chunk, o)
    o += chunk.byteLength
  }
  return out.buffer
}

/** The GLB of a catalogue model (asynchronous, as the three.js exporter was). */
export async function exportAsset(asset: InkAsset): Promise<ArrayBuffer> {
  return writeGlb(asset)
}

export interface GlbNode { readonly name?: string; readonly mesh?: number; readonly children?: ReadonlyArray<number>; readonly extras?: Record<string, unknown> }
export interface GlbContents {
  readonly nodes: ReadonlyArray<GlbNode>
  readonly materials: ReadonlyArray<{ readonly extensions?: Record<string, unknown>; readonly pbrMetallicRoughness?: { readonly baseColorFactor?: ReadonlyArray<number> } }>
  readonly meshes: ReadonlyArray<{ readonly primitives: ReadonlyArray<{ readonly attributes: Record<string, number>; readonly indices?: number; readonly material?: number }> }>
  /** An accessor's values, as floats. */
  accessor(index: number): Float32Array
}
/** A GLB's JSON, and its accessors read from its binary chunk. */
export function readGlb(buffer: ArrayBuffer): GlbContents {
  const data = new DataView(buffer)
  if (data.getUint32(0, true) !== GLB || data.getUint32(4, true) !== 2) throw new Error("Not a glTF 2.0 binary")
  const jsonLength = data.getUint32(12, true)
  if (data.getUint32(16, true) !== JSON_CHUNK) throw new Error("GLB without a JSON chunk")
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)))
  const binAt = 20 + jsonLength
  if (data.getUint32(binAt + 4, true) !== BIN_CHUNK) throw new Error("GLB without a binary chunk")
  const bin = binAt + 8
  const sizes: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
  return {
    nodes: json.nodes ?? [],
    materials: json.materials ?? [],
    meshes: json.meshes ?? [],
    accessor(index) {
      const a = json.accessors[index], v = json.bufferViews[a.bufferView], at = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), n = a.count * sizes[a.type]!
      const values = a.componentType === FLOAT ? new Float32Array(buffer.slice(at, at + n * 4)) : a.componentType === UNSIGNED_INT ? new Uint32Array(buffer.slice(at, at + n * 4)) : new Uint16Array(buffer.slice(at, at + n * 2))
      return Float32Array.from(values)
    }
  }
}
