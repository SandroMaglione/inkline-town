/**
 * Photo mode's street: the camera down at a walker's eye, walking the town.
 *
 * W A S D or the arrows walk (the arrows left and right, and Q and E, turn),
 * shift hurries, and a press held still on the map walks on while it is held.
 * Drags look round and the wheel or a pinch works the lens (`scene.ts`). The
 * walk keeps to open land: off the water and out of buildings and homes,
 * sliding along a wall it meets. It reads the drawing only, never the
 * simulation, so walking changes nothing in the town.
 */
import { kinds } from "../../game/content/index.ts"
import { key } from "../../game/world/grid.ts"
import { GRID, type Point } from "../../game/world/iso.ts"
import type { CameraView, EyeView, GameScene } from "./scene.ts"
import { BuildingView, HouseView } from "./views.ts"

/** World units up: a walker's eye, under their cap (walkers stand 17 authored units, about 19.6 world units). */
export const EYE = 16
/** The street's vertical field of view, in degrees. */
export const STREET_FOV = 55
/** Looking a little down the street, in radians. */
export const STREET_PITCH = 0.06
/** Cells a second, walking and hurrying; radians a second, turning. */
const WALK = 1.5, HURRY = 4, TURN = 1.7
/** How close the eye keeps to a wall, in cells. */
const REACH = 0.22
/** A press held this long without moving walks. */
const HOLD_MS = 320

/** Facing along a grid direction, as the map's heading has it. */
export const facing = (dx: number, dy: number) => Math.atan2(-dx, -dy)
/** The grid direction `heading` faces. */
export const ahead = (heading: number): Point => ({ x: -Math.sin(heading), y: -Math.cos(heading) })

export class Street {
  private scene: GameScene
  private keys = new Set<string>()
  private hold: { id: number; x: number; y: number; timer: number; walking: boolean } | null = null
  /** The cells something stands on, and when they were last counted. */
  private blocked = new Set<number>()
  private counted = -Infinity
  private abort = new AbortController()
  /** Walking is on: the camera is down at an eye and no camera move flies it. */
  active = false
  constructor(scene: GameScene) {
    this.scene = scene
    const signal = this.abort.signal,
      walkKeys = new Set(["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"])
    window.addEventListener(
      "keydown",
      (e) => {
        if (!this.active || e.metaKey || e.ctrlKey || e.altKey) return
        if (e.target instanceof HTMLElement && e.target.closest("input,select,textarea,[contenteditable=true]")) return
        const k = e.key.toLowerCase()
        if (!walkKeys.has(k)) return
        this.keys.add(k)
        e.preventDefault()
      },
      { signal }
    )
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()), { signal })
    window.addEventListener("blur", () => this.keys.clear(), { signal })
    const canvas = scene.canvas
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.active || e.button !== 0) return
        this.release()
        const hold = { id: e.pointerId, x: e.clientX, y: e.clientY, walking: false, timer: 0 }
        hold.timer = window.setTimeout(() => (hold.walking = true), HOLD_MS)
        this.hold = hold
      },
      { signal }
    )
    canvas.addEventListener(
      "pointermove",
      (e) => {
        const hold = this.hold
        // A press that moves is a look round, and stops the walk.
        if (hold?.id === e.pointerId && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 8) this.release()
      },
      { signal }
    )
    for (const type of ["pointerup", "pointercancel"] as const) canvas.addEventListener(type, (e) => this.hold?.id === e.pointerId && this.release(), { signal })
    // A second finger is a pinch, not a walk.
    canvas.addEventListener("pointerdown", (e) => this.hold && this.hold.id !== e.pointerId && this.release(), { signal })
  }
  private release() {
    if (this.hold) clearTimeout(this.hold.timer)
    this.hold = null
  }
  /** Stops walking: keys let go, a held press dropped. */
  rest() {
    this.keys.clear()
    this.release()
  }
  /** Walks on by `dt` seconds from the keys held. */
  frame(dt: number) {
    const eye = this.scene.eye()
    if (!this.active || !eye) return
    const k = this.keys,
      held = (...names: Array<string>) => names.some((n) => k.has(n))
    const forward = (held("w", "arrowup") || this.hold?.walking ? 1 : 0) - (held("s", "arrowdown") ? 1 : 0),
      side = (held("d") ? 1 : 0) - (held("a") ? 1 : 0),
      turn = (held("arrowleft", "q") ? 1 : 0) - (held("arrowright", "e") ? 1 : 0)
    if (!forward && !side && !turn) return
    const heading = eye.heading + turn * TURN * dt,
      speed = (held("shift") ? HURRY : WALK) * dt,
      f = ahead(heading),
      // To the right of facing `f` on the grid (x east, y south, seen from above).
      r = { x: -f.y, y: f.x },
      length = Math.hypot(forward, side) || 1,
      step = { x: ((f.x * forward + r.x * side) / length) * speed, y: ((f.y * forward + r.y * side) / length) * speed },
      to = this.slide(eye, step)
    this.scene.setEye({ ...eye, ...to, heading })
  }
  /** `from` moved by `step`, or along whichever of its two ways is open when a wall is in the way. */
  private slide(from: Point, step: Point): Point {
    const tries = [step, { x: step.x, y: 0 }, { x: 0, y: step.y }]
    for (const s of tries) {
      if (s.x === 0 && s.y === 0) continue
      const to = { x: from.x + s.x, y: from.y + s.y },
        n = Math.hypot(s.x, s.y)
      // The eye and a little ahead of it are both on open ground.
      if (this.open(to.x, to.y) && this.open(to.x + (s.x / n) * REACH, to.y + (s.y / n) * REACH)) return to
    }
    return { x: from.x, y: from.y }
  }
  /** Whether grid point `x`, `y` is open land: on the island, off the water, and clear of every building and home. */
  open(x: number, y: number) {
    const cx = Math.floor(x),
      cy = Math.floor(y)
    if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return false
    const k = key(cx, cy),
      mask = this.scene.landMask
    if (mask && mask[k] !== "1") return false
    if (this.scene.water.has(k)) return false
    this.count()
    return !this.blocked.has(k)
  }
  /** Counts the cells under buildings and homes again, at most once a second: the town goes on building. */
  private count() {
    const now = performance.now()
    if (now - this.counted < 1000) return
    this.counted = now
    this.blocked.clear()
    for (const node of this.scene.nodes) {
      if (!(node instanceof BuildingView) && !(node instanceof HouseView)) continue
      const size = node instanceof BuildingView ? kinds[node.kind].size : 1
      const x0 = Math.round(node.anchor.x - size / 2),
        y0 = Math.round(node.anchor.y - size / 2)
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) this.blocked.add(key(x0 + dx, y0 + dy))
    }
  }
  /**
   * Where the camera comes down from `view`: the open road nearest where it
   * looks (or open ground, if no road is near), facing along the road the way
   * nearest the map's heading, so the street opens out ahead.
   */
  landing(view: CameraView): EyeView {
    this.counted = -Infinity
    const roads = this.scene.roads,
      around = { x: Math.floor(view.x), y: Math.floor(view.y) }
    let best: { x: number; y: number; d: number; road: boolean } | null = null
    for (let r = 0; r <= 14 && !(best?.road && r > best.d + 1); r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const x = around.x + dx,
            y = around.y + dy
          if (!this.open(x + 0.5, y + 0.5)) continue
          const road = roads.has(key(x, y)),
            d = Math.hypot(x + 0.5 - view.x, y + 0.5 - view.y)
          if (!best || (road && !best.road) || (road === best.road && d < best.d)) best = { x, y, d, road }
        }
    const at = best ?? around
    let heading = view.heading
    if (best?.road) {
      const along = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ].filter(([dx, dy]) => roads.has(key(at.x + dx!, at.y + dy!)))
      const turn = (h: number) => Math.abs(Math.atan2(Math.sin(h - view.heading), Math.cos(h - view.heading)))
      const ways = along.map(([dx, dy]) => facing(dx!, dy!)).sort((a, b) => turn(a) - turn(b))
      if (ways[0] !== undefined) heading = view.heading + Math.atan2(Math.sin(ways[0] - view.heading), Math.cos(ways[0] - view.heading))
    }
    return { x: at.x + 0.5, y: at.y + 0.5, height: EYE, heading, pitch: STREET_PITCH, fov: STREET_FOV, zoom: 1 }
  }
  dispose() {
    this.release()
    this.abort.abort()
  }
}
