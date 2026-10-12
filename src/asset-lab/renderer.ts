import * as THREE from "three"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js"
import { palette, type Face, type InkAsset, type Vertex } from "./assets.ts"

/** A 30° elevation and 45° heading reproduce the game's 64×32 projection.
 * The vertical conversion preserves pixel-authored building heights exactly. */
export const floorScale = 32 * Math.SQRT2
export const vertex3 = ([u, v, z]: Vertex) => new THREE.Vector3(u * floorScale, z / Math.cos(Math.PI / 6), v * floorScale)

function contourCenters(asset: InkAsset) {
  const sums = new Map<number, { point: THREE.Vector3; count: number }>()
  for (const face of asset.faces)
    if (face.contour) {
      const sum = sums.get(face.contour) ?? { point: new THREE.Vector3(), count: 0 }
      for (const p of face.points) {
        sum.point.add(vertex3(p))
        sum.count++
      }
      sums.set(face.contour, sum)
    }
  return new Map([...sums].map(([id, sum]) => [id, sum.point.divideScalar(sum.count)]))
}
function outwardPoints(face: Face, centers: Map<number, THREE.Vector3>) {
  const ps = face.points.map(vertex3)
  const normal = new THREE.Vector3().crossVectors(ps[1]!.clone().sub(ps[0]!), ps[2]!.clone().sub(ps[0]!))
  const center = ps.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(ps.length)
  if (normal.dot(center.sub(centers.get(face.contour!)!)) < 0) ps.reverse()
  return ps
}

const materialCache = new Map<number, THREE.MeshBasicMaterial>()
function fillMaterial(color: number) {
  let material = materialCache.get(color)
  if (!material) {
    material = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 6,
      polygonOffsetUnits: 2
    })
    materialCache.set(color, material)
  }
  return material
}
function faceMesh(points: ReadonlyArray<Vertex>, color: number) {
  const coordinates = points.map(vertex3)
  const positions: Array<number> = []
  for (let i = 1; i < coordinates.length - 1; i++)
    for (const p of [coordinates[0]!, coordinates[i]!, coordinates[i + 1]!]) positions.push(...p.toArray())
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, fillMaterial(color))
}

export interface BuiltAsset {
  group: THREE.Group
  lineMaterials: Array<{ material: LineMaterial; width: number }>
  updateContours: (camera: THREE.Camera) => void
}
export function buildAsset(asset: InkAsset, options: { batchFaces?: boolean } = {}): BuiltAsset {
  const group = new THREE.Group()
  group.name = asset.id
  if (options.batchFaces) {
    const batches = new Map<number, Array<THREE.BufferGeometry>>()
    for (const face of asset.faces) {
      const geometries = batches.get(face.color) ?? []
      geometries.push(faceMesh(face.points, face.color).geometry)
      batches.set(face.color, geometries)
    }
    for (const [color, geometries] of batches) {
      const geometry = mergeGeometries(geometries)
      if (!geometry) throw new Error("Could not batch map faces")
      geometries.forEach((g) => g.dispose())
      group.add(new THREE.Mesh(geometry, fillMaterial(color)))
    }
  } else {
    for (const face of asset.faces) group.add(faceMesh(face.points, face.color))
  }
  const lineMaterials: Array<{ material: LineMaterial; width: number }> = []
  const batches = new Map<string, { positions: Array<number>; width: number; color: number; opacity: number }>()
  for (const stroke of asset.strokes) {
    const key = `${stroke.width}/${stroke.color}/${stroke.opacity}`
    const batch = batches.get(key) ?? { positions: [], width: stroke.width, color: stroke.color, opacity: stroke.opacity }
    for (let i = 1; i < stroke.points.length; i++)
      batch.positions.push(...vertex3(stroke.points[i - 1]!).toArray(), ...vertex3(stroke.points[i]!).toArray())
    batches.set(key, batch)
  }
  const addLines = (positions: Array<number>, width: number, color: number, opacity: number) => {
    const geometry = new LineSegmentsGeometry().setPositions(positions)
    const material = new LineMaterial({
      color,
      opacity,
      transparent: opacity < 1,
      depthTest: true,
      depthWrite: false,
      alphaToCoverage: true,
      worldUnits: true
    })
    material.linewidth = width
    const lines = new LineSegments2(geometry, material)
    lines.renderOrder = 2
    group.add(lines)
    lineMaterials.push({ material, width })
    return lines
  }
  for (const b of batches.values()) addLines(b.positions, b.width, b.color, b.opacity)

  // Smooth props and foliage get view-dependent silhouette edges, without
  // drawing their hidden edges or the internal triangulation.
  const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; normals: Array<THREE.Vector3> }>()
  const centers = contourCenters(asset)
  for (const face of asset.faces.filter((f) => f.contour)) {
    const points = outwardPoints(face, centers)
    const normal = new THREE.Vector3().crossVectors(points[1]!.clone().sub(points[0]!), points[2]!.clone().sub(points[0]!)).normalize()
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!,
        b = points[(i + 1) % points.length]!
      const keys = [
        a
          .toArray()
          .map((n) => n.toFixed(4))
          .join(","),
        b
          .toArray()
          .map((n) => n.toFixed(4))
          .join(",")
      ].sort()
      const key = keys.join("|")
      const edge = edges.get(key) ?? { a, b, normals: [] }
      edge.normals.push(normal)
      edges.set(key, edge)
    }
  }
  const contours = edges.size ? addLines([0, 0, 0, 0, 0, 0], asset.id === "fir" ? 1.5 : 1, palette.ink, 1) : null
  const updateContours = (camera: THREE.Camera) => {
    if (!contours) return
    const direction = camera.getWorldDirection(new THREE.Vector3()).negate()
    const positions: Array<number> = []
    for (const { a, b, normals } of edges.values()) {
      const signs = normals.map((n) => n.dot(direction))
      if (normals.length === 1 || (Math.min(...signs) < 0 && Math.max(...signs) >= 0)) positions.push(...a.toArray(), ...b.toArray())
    }
    const previous = contours.geometry
    contours.geometry = new LineSegmentsGeometry().setPositions(positions.length ? positions : [0, 0, 0, 0, 0, 0])
    previous.dispose()
  }
  return { group, lineMaterials, updateContours }
}

/** GLB uses ordinary meshes for ink strokes so the outlines survive import.
 * Rounded props use an inverted hull for their view-dependent silhouette. */
export async function exportAsset(asset: InkAsset) {
  const group = new THREE.Group()
  group.name = asset.id
  for (const face of asset.faces) group.add(faceMesh(face.points, face.color))
  const contourFaces = asset.faces.filter((face) => face.contour)
  if (contourFaces.length) {
    const centers = contourCenters(asset)
    const normals = new Map<string, THREE.Vector3>()
    const key = (p: THREE.Vector3) =>
      p
        .toArray()
        .map((n) => n.toFixed(4))
        .join(",")
    for (const face of contourFaces) {
      const ps = outwardPoints(face, centers)
      const normal = new THREE.Vector3().crossVectors(ps[1]!.clone().sub(ps[0]!), ps[2]!.clone().sub(ps[0]!)).normalize()
      for (const p of ps) {
        const n = normals.get(key(p)) ?? new THREE.Vector3()
        n.add(normal)
        normals.set(key(p), n)
      }
    }
    const positions: Array<number> = []
    for (const face of contourFaces) {
      const ps = outwardPoints(face, centers).map((p) =>
        p.clone().add(
          normals
            .get(key(p))!
            .clone()
            .normalize()
            .multiplyScalar(asset.id === "fir" ? 1.5 : 1)
        )
      )
      for (let i = 1; i < ps.length - 1; i++) for (const p of [ps[0]!, ps[i + 1]!, ps[i]!]) positions.push(...p.toArray())
    }
    const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    geometry.computeVertexNormals()
    // glTF has no BackSide flag. Inward winding plus FrontSide preserves it.
    const hull = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: palette.ink, side: THREE.FrontSide }))
    hull.name = "ink-silhouette"
    group.add(hull)
  }
  const inkMaterials = new Map<string, THREE.MeshBasicMaterial>()
  for (const stroke of asset.strokes) {
    const key = `${stroke.color}/${stroke.opacity}`
    let material = inkMaterials.get(key)
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: stroke.color, opacity: stroke.opacity, transparent: stroke.opacity < 1 })
      inkMaterials.set(key, material)
    }
    for (let i = 1; i < stroke.points.length; i++) {
      const a = vertex3(stroke.points[i - 1]!),
        b = vertex3(stroke.points[i]!),
        delta = b.clone().sub(a),
        length = delta.length()
      if (length < 0.0001) continue
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(stroke.width / 2, stroke.width / 2, length, 6), material)
      mesh.position.copy(a.clone().add(b).multiplyScalar(0.5))
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
      group.add(mesh)
    }
  }
  // Batch like materials before export rather than shipping hundreds of nodes.
  const merged = new THREE.Group()
  merged.name = group.name
  group.updateMatrixWorld(true)
  const batches = new Map<THREE.MeshBasicMaterial, Array<THREE.BufferGeometry>>()
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
    geometry.applyMatrix4(object.matrixWorld)
    for (const attribute of Object.keys(geometry.attributes))
      if (attribute !== "position" && attribute !== "normal") geometry.deleteAttribute(attribute)
    const material = object.material as THREE.MeshBasicMaterial
    const geometries = batches.get(material) ?? []
    geometries.push(geometry)
    batches.set(material, geometries)
  })
  for (const [material, geometries] of batches) {
    const combined = mergeGeometries(geometries)
    if (!combined) throw new Error("Could not batch exported geometry")
    const geometry = mergeVertices(combined)
    combined.dispose()
    geometries.forEach((g) => g.dispose())
    merged.add(new THREE.Mesh(geometry, material))
  }
  const result = await new GLTFExporter().parseAsync(merged, { binary: true })
  merged.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose()
  })
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose()
  })
  for (const material of inkMaterials.values()) material.dispose()
  if (!(result instanceof ArrayBuffer)) throw new Error("Expected binary glTF")
  return result
}

export async function reloadExportedAsset(asset: InkAsset) {
  return (await new GLTFLoader().parseAsync(await exportAsset(asset), "")).scene
}
