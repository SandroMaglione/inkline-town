/**
 * A model drawn as a still picture, for the page's panels: from the town's
 * own camera (its first heading and elevation, see `GameScene`), at the
 * town's scale (one unit a pixel at zoom 1), cropped to the model, so it
 * sits beside the 2D pictures the models were built from.
 */
import * as THREE from "three"
import { buildAsset } from "../asset-lab/renderer.ts"
import type { InkAsset } from "../asset-lab/primitives.ts"

let renderer: THREE.WebGLRenderer | null = null

/** A PNG data URL of `asset`, `scale` pixels to a unit, with `margin` units around it. */
export function portrait(asset: InkAsset, scale = 2, margin = 3): string {
  renderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  const model = buildAsset(asset, { batchFaces: true })
  const scene = new THREE.Scene()
  scene.add(model.group)
  const heading = Math.PI / 4, elevation = Math.PI / 6, distance = 6000
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 14000)
  camera.position.set(Math.sin(heading) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, Math.cos(heading) * Math.cos(elevation) * distance)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  // The model's extent as the camera sees it: its bounding box's corners in view space.
  const box = new THREE.Box3().setFromObject(model.group)
  const view = new THREE.Box3()
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z])
    view.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse))
  camera.left = view.min.x - margin
  camera.right = view.max.x + margin
  camera.bottom = view.min.y - margin
  camera.top = view.max.y + margin
  camera.updateProjectionMatrix()
  const width = Math.ceil(camera.right - camera.left), height = Math.ceil(camera.top - camera.bottom)
  renderer.setPixelRatio(scale)
  renderer.setSize(width, height, false)
  for (const { material, width: line } of model.lineMaterials) material.linewidth = line
  model.updateContours(camera)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL("image/png")
  model.dispose()
  return url
}
