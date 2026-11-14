/**
 * A model drawn as a still picture, for the page's panels: from the town's
 * own camera (its first heading and elevation, see `GameScene`), at the
 * town's scale (one unit a pixel at zoom 1), cropped to the model, so it
 * sits beside the 2D pictures the models were built from. It is drawn by the
 * town's own renderer, offscreen, into a transparent texture.
 */
import { View3D } from "@pixi/3d"
import { RenderTexture, type Renderer } from "pixi.js"
import { buildAsset } from "./assets/renderer.ts"
import { draw } from "./materials.ts"
import type { InkAsset } from "./assets/primitives.ts"
import { add, cross, dot, normalize, scale as times, sub, type Vec3 } from "./mesh/vec3.ts"

/** A PNG data URL of `asset`, `scale` pixels to a unit, with `margin` units around it. */
export function portrait(renderer: Renderer, asset: InkAsset, scale = 2, margin = 3): string {
  const model = buildAsset(asset, { batchFaces: true })
  const heading = Math.PI / 4, elevation = Math.PI / 6, distance = 6000
  const eye: Vec3 = [Math.sin(heading) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, Math.cos(heading) * Math.cos(elevation) * distance]
  // The model's extent as the camera sees it: its box's corners on the camera's right and up.
  const forward = normalize(times(eye, -1)), right = normalize(cross(forward, [0, 1, 0])), up = cross(right, forward)
  const [min, max] = model.bounds
  let left = Infinity, rightmost = -Infinity, bottom = Infinity, top = -Infinity
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    const p = sub([x, y, z], eye), u = dot(p, right), v = dot(p, up)
    left = Math.min(left, u - margin)
    rightmost = Math.max(rightmost, u + margin)
    bottom = Math.min(bottom, v - margin)
    top = Math.max(top, v + margin)
  }
  const width = Math.ceil(rightmost - left), height = Math.ceil(top - bottom)
  // The camera slides across to the box's middle, still looking the same way.
  const shift = add(times(right, (left + rightmost) / 2), times(up, (bottom + top) / 2))
  const view = new View3D({ width, height, background: null })
  view.camera.useOrthographic(width / 2, 0.1, 14000)
  view.camera.position.set(...add(eye, shift))
  view.camera.lookAt({ x: shift[0], y: shift[1], z: shift[2] })
  view.root.addChild(model.group)
  const target = RenderTexture.create({ width, height, resolution: scale, antialias: true })
  draw(renderer, view, { target, clearColor: [0, 0, 0, 0] })
  const url = (renderer.extract.canvas(target) as HTMLCanvasElement).toDataURL("image/png")
  target.destroy(true)
  model.dispose()
  view.destroy()
  return url
}
