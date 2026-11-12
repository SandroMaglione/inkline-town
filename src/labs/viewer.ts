/**
 * The labs' shared viewer: a Pixi application with one orthographic 3D view,
 * drawn on demand, and offscreen snapshots for captures. The game's renderer
 * is `render/pixi3d/scene.ts`; the labs look at the same models without it.
 */
import { View3D, type Camera3D } from "@pixi/3d"
import { Application, RenderTexture } from "pixi.js"
import { cross, dot, normalize, scale, sub, add, type Vec3 } from "../render/pixi3d/mesh/vec3.ts"
import { channels } from "../render/pixi3d/gpu.ts"

export interface LabViewer {
  readonly app: Application
  readonly view: View3D
  readonly camera: Camera3D
  readonly canvas: HTMLCanvasElement
  /** The view's size in CSS pixels. */
  readonly width: number
  readonly height: number
  /** Sizes the canvas buffer (CSS pixels times the pixel ratio) and the view; the stylesheet sizes it on the page. */
  resize(width: number, height: number): void
  render(): void
  /**
   * The view drawn offscreen at `width` × `height`, `resolution` pixels a CSS
   * pixel, on `background` (or transparent for `null`), as a canvas of its own.
   */
  snapshot(width: number, height: number, resolution?: number, background?: number | null): HTMLCanvasElement
  dispose(): void
}

export async function labViewer(mount: HTMLElement, options: { width: number; height: number; background?: number | null; className?: string }): Promise<LabViewer> {
  const background = options.background === undefined ? null : options.background
  const app = new Application()
  await app.init({
    preference: "webgl",
    antialias: true,
    backgroundColor: background ?? 0xffffff,
    backgroundAlpha: background === null ? 0 : 1,
    // The page's stylesheet sizes the canvas (as it did for three.js); its buffer follows the pixel ratio.
    resolution: Math.min(devicePixelRatio || 1, 2),
    autoDensity: false,
    autoStart: false,
    preserveDrawingBuffer: true,
    width: Math.max(1, options.width),
    height: Math.max(1, options.height)
  })
  const view = new View3D({ width: Math.max(1, options.width), height: Math.max(1, options.height) })
  view.camera.useOrthographic(view.width / 2, 0.1, 14000)
  app.stage.addChild(view)
  const canvas = app.canvas
  if (options.className) canvas.className = options.className
  mount.append(canvas)
  const viewer: LabViewer = {
    app,
    view,
    camera: view.camera,
    canvas,
    get width() {
      return view.width
    },
    get height() {
      return view.height
    },
    resize(width, height) {
      width = Math.max(1, Math.round(width))
      height = Math.max(1, Math.round(height))
      if (width === view.width && height === view.height && app.renderer.width === width) return
      app.renderer.resize(width, height)
      view.setSize(width, height)
    },
    render() {
      app.render()
    },
    snapshot(width, height, resolution = 1, fill = background) {
      const before = [view.width, view.height] as const
      view.setSize(width, height)
      const target = RenderTexture.create({ width, height, resolution, antialias: true })
      const [r, g, b] = channels(fill ?? 0)
      app.renderer.render({ container: view, target, clearColor: [r, g, b, fill === null ? 0 : 1] })
      const out = document.createElement("canvas")
      out.width = Math.round(width * resolution)
      out.height = Math.round(height * resolution)
      out.getContext("2d")!.drawImage(app.renderer.extract.canvas(target) as HTMLCanvasElement, 0, 0, out.width, out.height)
      target.destroy(true)
      view.setSize(...before)
      return out
    },
    dispose() {
      app.destroy(true, { children: true })
    }
  }
  return viewer
}

/** A direction from a target towards the camera: `heading` round the vertical, `altitude` above the ground (radians). */
export const toward = (heading: number, altitude: number): Vec3 => [Math.sin(heading) * Math.cos(altitude), Math.sin(altitude), Math.cos(heading) * Math.cos(altitude)]

/** Places `camera` `distance` from `target` along `direction`, looking at it. */
export function aim(camera: Camera3D, target: Vec3, direction: Vec3, distance: number) {
  const eye = add(target, scale(normalize(direction), distance))
  camera.position.set(...eye)
  camera.lookAt({ x: target[0], y: target[1], z: target[2] })
  return eye
}

/** The box `[min, max]` as a camera at `eye` looking at `target` sees it: each corner's `[right, up]`, from the line of sight. */
export function seen(eye: Vec3, target: Vec3, box: readonly [Vec3, Vec3]): Array<[number, number]> {
  const forward = normalize(sub(target, eye)), right = normalize(cross(forward, [0, 1, 0])), up = cross(right, forward)
  const out: Array<[number, number]> = []
  for (const x of [box[0][0], box[1][0]]) for (const y of [box[0][1], box[1][1]]) for (const z of [box[0][2], box[1][2]]) {
    const p = sub([x, y, z], target)
    out.push([dot(p, right), dot(p, up)])
  }
  return out
}

/** Sets an orthographic camera to show `halfHeight` above and below its target, in a view of `width` × `height`. */
export function frame(camera: Camera3D, halfHeight: number, width: number, height: number) {
  camera.zoom = 1
  camera.orthographicSize = (halfHeight * width) / height
}
