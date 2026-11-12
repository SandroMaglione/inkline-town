/**
 * An `InkAsset` as mesh data, with no renderer in it: the parts the Pixi 3D
 * adapter draws (`renderer.ts`) and the GLB writer exports (`glb.ts`).
 *
 * - fills: the faces, batched by colour, drawn double-sided and pushed back in
 *   depth so ink on their edges always wins;
 * - hulls: smooth props' and foliage's inward hulls, which give curved
 *   contours a continuous ink silhouette at every zoom;
 * - ink: strokes as six-sided rods, and long curved strokes as tubes;
 * - contours: sharp contours' edges as rods carrying both faces' normals
 *   (`aInkNormalA`, `aInkNormalB`), shown only where one face turns towards
 *   the camera and the other away (see `inkSilhouetteBit`);
 * - lines: strokes drawn as camera-facing ribbons a world width across
 *   (see `inkLineBit`), for the town's ground layers.
 */
import { palette, type Face, type InkAsset } from "./primitives.ts"
import { vertex3 } from "./space.ts"
import { merge, mergeVertices, polygon, rod, triangles, tube, unindexed, withConstant, type MeshData } from "../mesh/geometry.ts"
import { add, cross, dot, mean, normalize, scale, sub, type Vec3 } from "../mesh/vec3.ts"

export type PartRole = "fill" | "hull" | "ink" | "contour" | "line"
export interface InkPart {
  readonly role: PartRole
  readonly color: number
  readonly opacity: number
  /** For `line`: two vertices per segment. */
  readonly mesh: MeshData
  /** For `line`: the ribbon's width in world units. */
  readonly width: number
}
export interface InkMeshOptions {
  /** Faces merged by colour (the live town), or one part a face. */
  readonly batchFaces?: boolean
  /** Short strokes as rods (the live town's shared models), or as ribbons. */
  readonly meshInk?: boolean
  /** Every contour drawn as a hull, not only the curved ones. */
  readonly hullContours?: boolean
  /** Sharp contours drawn as silhouette edges (default), or left to the faces. */
  readonly contours?: boolean
}

const fixed = (p: Vec3) => p.map((n) => n.toFixed(4)).join(",")

function contourCenters(asset: InkAsset) {
  const sums = new Map<number, Array<Vec3>>()
  for (const face of asset.faces)
    if (face.contour) {
      const points = sums.get(face.contour) ?? []
      points.push(...face.points.map(vertex3))
      sums.set(face.contour, points)
    }
  return new Map([...sums].map(([id, points]) => [id, mean(points)]))
}
function outwardPoints(face: Face, centers: Map<number, Vec3>): Array<Vec3> {
  const ps = face.points.map(vertex3)
  const normal = cross(sub(ps[1]!, ps[0]!), sub(ps[2]!, ps[0]!))
  if (dot(normal, sub(mean(ps), centers.get(face.contour!)!)) < 0) ps.reverse()
  return ps
}

/** Inward hulls give short curved contours a continuous ink silhouette, including at high zoom. */
function silhouette(asset: InkAsset, faces: ReadonlyArray<Face>): MeshData {
  const centers = contourCenters(asset), normals = new Map<string, Vec3>()
  const key = (p: Vec3, contour: number) => `${contour}|${fixed(p)}`
  for (const face of faces) {
    const ps = outwardPoints(face, centers), n = normalize(cross(sub(ps[1]!, ps[0]!), sub(ps[2]!, ps[0]!)))
    for (const p of ps) normals.set(key(p, face.contour!), add(normals.get(key(p, face.contour!)) ?? [0, 0, 0], n))
  }
  const positions: Array<number> = []
  for (const face of faces) {
    const ps = outwardPoints(face, centers).map((p) => add(p, scale(normalize(normals.get(key(p, face.contour!))!), (face.contourWidth ?? 1) * 0.5)))
    for (let i = 1; i < ps.length - 1; i++) for (const p of [ps[0]!, ps[i + 1]!, ps[i]!]) positions.push(...p)
  }
  return triangles(positions)
}

const strokeKey = (s: { width: number; color: number; opacity: number }) => `${s.width}/${s.color}/${s.opacity}`

export function inkMesh(asset: InkAsset, options: InkMeshOptions = {}): Array<InkPart> {
  const parts: Array<InkPart> = []
  if (options.batchFaces) {
    const batches = new Map<string, { color: number; opacity: number; meshes: Array<MeshData> }>()
    for (const face of asset.faces) {
      const key = `${face.color}/${face.opacity ?? 1}`, batch = batches.get(key) ?? { color: face.color, opacity: face.opacity ?? 1, meshes: [] }
      batch.meshes.push(polygon(face.points.map(vertex3)))
      batches.set(key, batch)
    }
    for (const { color, opacity, meshes } of batches.values()) parts.push({ role: "fill", color, opacity, mesh: merge(meshes), width: 0 })
  } else for (const face of asset.faces) parts.push({ role: "fill", color: face.color, opacity: face.opacity ?? 1, mesh: polygon(face.points.map(vertex3)), width: 0 })

  const curves = new Map<string, { meshes: Array<MeshData>; color: number; opacity: number }>()
  const lines = new Map<string, { positions: Array<number>; width: number; color: number; opacity: number }>()
  for (const stroke of asset.strokes) {
    const key = strokeKey(stroke)
    const curve = () => curves.get(key) ?? { meshes: [], color: stroke.color, opacity: stroke.opacity }
    if (options.meshInk && stroke.width > 0 && stroke.points.length <= 8) {
      const batch = curve()
      for (let i = 1; i < stroke.points.length; i++) {
        const segment = rod(vertex3(stroke.points[i - 1]!), vertex3(stroke.points[i]!), stroke.width)
        if (segment) batch.meshes.push(segment)
      }
      if (batch.meshes.length) curves.set(key, batch)
      continue
    }
    // Continuous tubes keep small circle joins clean at high magnification.
    const first = stroke.points[0]!, last = stroke.points.at(-1)!
    if (stroke.width > 0 && stroke.points.length > 8) {
      const closed = first.every((n, i) => Math.abs(n - last[i]!) < 1e-6)
      const batch = curve()
      batch.meshes.push(tube((closed ? stroke.points.slice(0, -1) : stroke.points).map(vertex3), closed, (stroke.points.length - 1) * 2, stroke.width / 2, 6))
      curves.set(key, batch)
      continue
    }
    const batch = lines.get(key) ?? { positions: [], width: stroke.width, color: stroke.color, opacity: stroke.opacity }
    for (let i = 1; i < stroke.points.length; i++) batch.positions.push(...vertex3(stroke.points[i - 1]!), ...vertex3(stroke.points[i]!))
    lines.set(key, batch)
  }
  for (const b of lines.values()) parts.push({ role: "line", color: b.color, opacity: b.opacity, width: b.width, mesh: { positions: Float32Array.from(b.positions), normals: new Float32Array(b.positions.length), index: null, attributes: {} } })
  for (const { meshes, color, opacity } of curves.values()) parts.push({ role: "ink", color, opacity, mesh: merge(meshes), width: 0 })

  // Smooth props and foliage get view-dependent silhouette edges, without drawing their hidden edges or the
  // internal triangulation.
  const counts = new Map<number, number>()
  for (const face of asset.faces) if (face.contour) counts.set(face.contour, (counts.get(face.contour) ?? 0) + 1)
  const smooth = new Set([...counts].filter(([, count]) => options.hullContours || count > 6).map(([id]) => id))
  const smoothFaces = asset.faces.filter((f) => f.contour && smooth.has(f.contour) && (f.contourWidth ?? 1) > 0)
  if (smoothFaces.length) parts.push({ role: "hull", color: palette.ink, opacity: 1, mesh: silhouette(asset, smoothFaces), width: 0 })
  if (options.contours === false) return parts

  const edges = new Map<string, { a: Vec3; b: Vec3; normals: Array<Vec3>; width: number }>()
  const centers = contourCenters(asset)
  for (const face of asset.faces.filter((f) => f.contour && !smooth.has(f.contour))) {
    const points = outwardPoints(face, centers)
    const normal = normalize(cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!)))
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!
      const key = `${face.contour}|${[fixed(a), fixed(b)].sort().join("|")}`
      const edge = edges.get(key) ?? { a, b, normals: [], width: face.contourWidth ?? 1 }
      edge.normals.push(normal)
      edges.set(key, edge)
    }
  }
  // GPU silhouette masks let sharp foliage share instances at every camera angle, without a wireframe or an
  // expanded hull crossing the canopy.
  const contourBatches = new Map<number, Array<MeshData>>()
  for (const { a, b, normals, width } of edges.values()) {
    if (width <= 0) continue
    const segment = rod(a, b, width)
    if (!segment) continue
    const n1 = normals[0]!, n2 = normals[1] ?? scale(n1, -1)
    const batch = contourBatches.get(width) ?? []
    batch.push(withConstant(withConstant(segment, "aInkNormalA", n1), "aInkNormalB", n2))
    contourBatches.set(width, batch)
  }
  for (const meshes of contourBatches.values()) parts.push({ role: "contour", color: palette.ink, opacity: 1, mesh: merge(meshes), width: 0 })
  return parts
}

/** A material as the GLB records it: unlit, its colour and opacity, one side or both. */
export interface ExportMaterial {
  readonly color: number
  readonly opacity: number
  readonly doubleSided: boolean
}
/**
 * The meshes a GLB carries, one per material: the faces, an inward hull for
 * every contour, and every stroke as rods, so the outlines survive import
 * into any renderer. Vertices are welded, and only positions and normals kept.
 */
export function exportMeshes(asset: InkAsset): Array<{ material: ExportMaterial; mesh: MeshData }> {
  const batches = new Map<string, { material: ExportMaterial; meshes: Array<MeshData> }>()
  const add = (key: string, material: ExportMaterial, mesh: MeshData) => {
    const batch = batches.get(key) ?? { material, meshes: [] }
    batch.meshes.push(unindexed(mesh))
    batches.set(key, batch)
  }
  for (const face of asset.faces) add(`fill/${face.color}/${face.opacity ?? 1}`, { color: face.color, opacity: face.opacity ?? 1, doubleSided: true }, polygon(face.points.map(vertex3)))
  const contourFaces = asset.faces.filter((face) => face.contour)
  if (contourFaces.length) add("hull", { color: palette.ink, opacity: 1, doubleSided: false }, silhouette(asset, contourFaces))
  for (const stroke of asset.strokes)
    for (let i = 1; i < stroke.points.length; i++) {
      const segment = rod(vertex3(stroke.points[i - 1]!), vertex3(stroke.points[i]!), stroke.width)
      if (segment) add(`ink/${stroke.color}/${stroke.opacity}`, { color: stroke.color, opacity: stroke.opacity, doubleSided: false }, segment)
    }
  return [...batches.values()].map(({ material, meshes }) => ({ material, mesh: mergeVertices(merge(meshes)) }))
}
