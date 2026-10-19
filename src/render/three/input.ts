import type { Point } from "../../game/world/iso.ts"
import type { UiValue } from "../../view/contracts.ts"
import type { GameScene } from "./scene.ts"

/** Camera gestures and game gestures share the canvas, but a pan, orbit or
 * pinch never commits a build stroke or a selection. Game coordinates come
 * from the ground ray; object IDs come from the rendered instances.
 *
 * A finger has no hover, so on touch the tap tools (place, prop, bulldoze)
 * take two taps: the first shows the ghost or outline where it lands and
 * holds it there, a second tap on the same spot commits it. The game only
 * ever sees the ordinary press and release of the confirming tap.
 *
 * The drag tools (road, pave, homes, park ground) work the same way on touch:
 * letting go holds the stroke, and a tap on its end (or the page's build
 * button) lays it; a tap anywhere else drops it, and dragging again starts a
 * new one. With any pointer, letting go off the map (over the tool bar, say)
 * drops the stroke, as a button drops a click released outside it. */
export class MapInput {
  private scene: GameScene
  private ui: UiValue
  private pointers = new Map<number, Point>()
  /** `deferred`: a press while a stroke is held, which is a tap on it until it moves. */
  private press: { id: number; start: Point; last: Point; mode: "edit" | "pan" | "rotate"; moved: boolean; deferred: boolean } | null = null
  private pinch: { distance: number; angle: number; mid: Point } | null = null
  private screen: Point | null = null
  private mode: "pan" | "rotate" = "pan"
  private armed: { tool: string; at: Point; hit: number | null } | null = null
  /** A touch stroke let go of and waiting for a tap: from `ui.dragFrom` to `at`. */
  private held: { tool: string; at: Point } | null = null
  /** The stroke being dragged is over something other than the map: let go, it is dropped. */
  private offMap = false
  private touch = false
  readonly controls: HTMLElement
  private abort = new AbortController()
  constructor(scene: GameScene, ui: UiValue) {
    this.scene = scene
    this.ui = ui
    const canvas = scene.canvas,
      signal = this.abort.signal
    canvas.style.touchAction = "none"
    const at = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY })
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        canvas.focus({ preventScroll: true })
        canvas.setPointerCapture(e.pointerId)
        const p = at(e)
        this.touch = e.pointerType === "touch"
        this.pointers.set(e.pointerId, p)
        this.screen = p
        this.updatePointer()
        if (this.pointers.size === 2) {
          this.pinch = this.spread()
          this.press = null
          // Two fingers move the camera under a held stroke; they drop one being drawn.
          if (!this.held) ui.dragFrom = null
          ui.gestures.length = 0
          return
        }
        if (this.pointers.size > 2) return
        const mode =
          e.button === 2 || e.altKey
            ? "rotate"
            : e.button === 1
              ? "pan"
              : this.mode === "rotate"
                ? "rotate"
                : ui.tool === "road" || ui.tool === "home" || ui.tool === "pave" || ui.tool === "ground"
                  ? "edit"
                  : "pan"
        const deferred = mode === "edit" && this.held !== null
        this.press = { id: e.pointerId, start: p, last: p, mode, moved: false, deferred }
        if (e.button === 0 && this.mode !== "rotate" && !deferred) ui.gestures.push({ type: "press", at: scene.groundAt(p.x, p.y) })
      },
      { signal }
    )
    canvas.addEventListener(
      "pointermove",
      (e) => {
        const p = at(e)
        if (e.pointerType === "mouse") this.armed = null
        if (this.pointers.has(e.pointerId) || e.pointerType === "mouse") this.touch = e.pointerType === "touch"
        if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p)
        if (this.pinch && this.pointers.size === 2) {
          const next = this.spread()
          if (next) {
            scene.zoomAt(next.mid.x, next.mid.y, next.distance / Math.max(1, this.pinch.distance))
            scene.rotate(next.angle - this.pinch.angle)
            scene.pan(next.mid.x - this.pinch.mid.x, next.mid.y - this.pinch.mid.y)
            this.pinch = next
          }
          this.screen = p
          this.updatePointer()
          return
        }
        const press = this.press
        if (press?.id === e.pointerId) {
          if (Math.hypot(p.x - press.start.x, p.y - press.start.y) > 6) press.moved = true
          if (press.mode === "rotate" && press.moved) scene.rotate((p.x - press.last.x) * 0.006, (p.y - press.last.y) * 0.004)
          if (press.mode === "pan" && press.moved) scene.pan(p.x - press.last.x, p.y - press.last.y)
          // Dragging from a held stroke draws a new one: the held one is dropped.
          if (press.deferred && press.moved) {
            this.cancelStroke()
            press.deferred = false
            ui.gestures.push({ type: "press", at: scene.groundAt(press.start.x, press.start.y) })
          }
          if (press.mode === "edit") this.offMap = this.overPage(p)
          press.last = p
        }
        this.screen = p
        this.updatePointer()
      },
      { signal }
    )
    const release = (e: PointerEvent, cancelled: boolean) => {
      const p = at(e)
      this.pointers.delete(e.pointerId)
      if (this.pinch) {
        if (this.pointers.size < 2) this.pinch = null
        this.press = null
        if (!this.held) ui.dragFrom = null
      }
      const press = this.press
      if (press?.id === e.pointerId) {
        const input = scene.inputAt(p.x, p.y, ui.tool)
        const panned = cancelled || press.mode === "rotate" || e.button !== 0 || (press.mode === "pan" && press.moved)
        const ground = scene.groundAt(p.x, p.y)
        if (press.deferred) {
          // A tap while a stroke is held: on the stroke's end it lays it, anywhere else it drops it.
          if (!panned && this.held) {
            if (Math.floor(ground.x) === Math.floor(this.held.at.x) && Math.floor(ground.y) === Math.floor(this.held.at.y)) this.confirmStroke()
            else this.cancelStroke()
          }
        } else if (press.mode === "edit" && !panned && this.offMap) {
          ui.dragFrom = null
        } else if (press.mode === "edit" && !panned && e.pointerType === "touch") {
          this.held = { tool: ui.tool, at: ground }
        } else {
          const held = e.pointerType === "touch" && !panned && this.arm(input.at, input.hit)
          if (!held) ui.gestures.push({ type: "release", at: press.mode === "edit" ? ground : input.at, hit: input.hit, panned })
          if (panned) ui.dragFrom = null
        }
        this.offMap = false
        this.press = null
      }
      if (e.pointerType !== "mouse") {
        this.screen = null
        this.updatePointer()
      }
    }
    canvas.addEventListener("pointerup", (e) => release(e, false), { signal })
    canvas.addEventListener("pointercancel", (e) => release(e, true), { signal })
    canvas.addEventListener(
      "pointerleave",
      (e) => {
        if (!this.press && e.pointerType === "mouse") {
          this.screen = null
          ui.pointer = null
          ui.pointerHit = null
        }
      },
      { signal }
    )
    canvas.addEventListener(
      "contextmenu",
      (e) => {
        e.preventDefault()
        // A right click during a drag drops the stroke.
        if (this.press?.mode === "edit") {
          this.press = null
          this.offMap = false
          ui.dragFrom = null
          this.updatePointer()
        }
      },
      { signal }
    )
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault()
        scene.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015))
        this.updatePointer()
      },
      { signal, passive: false }
    )
    this.controls = document.createElement("nav")
    this.controls.className = "camera-controls"
    this.controls.setAttribute("aria-label", "Map camera")
    this.controls.innerHTML = `<button data-mode="pan" aria-pressed="true" title="Drag to pan; the road, pave, home, and park ground tools drag to build">Pan</button><button data-mode="rotate" aria-pressed="false" title="Drag to rotate instead of placing. Right-drag also rotates, and Q and E turn it an eighth.">Rotate</button><button data-action="out" aria-label="Zoom out">−</button><output aria-label="Camera zoom"></output><button data-action="in" aria-label="Zoom in">+</button><button data-action="reset" aria-label="Reset camera" title="Original angle and centre (Home)">⌂</button>`
    this.controls.querySelectorAll<HTMLButtonElement>("button").forEach(
      (button) =>
        (button.onclick = () => {
          if (button.dataset.mode) {
            // Rotate toggles, so a phone can do without the Pan button.
            this.mode = button.dataset.mode === "rotate" && this.mode === "rotate" ? "pan" : (button.dataset.mode as "pan" | "rotate")
            ui.dragFrom = null
            this.press = null
          }
          if (button.dataset.action === "out") scene.zoomBy(0.8)
          if (button.dataset.action === "in") scene.zoomBy(1.25)
          if (button.dataset.action === "reset") scene.resetCamera()
          this.updatePointer()
          this.sync()
        })
    )
    document.body.append(this.controls)
    window.addEventListener(
      "keydown",
      (e) => {
        if (ui.founding || document.querySelector(".dialog.open")) return
        if (e.target instanceof HTMLElement && e.target.closest("input,select,textarea,button,a,[contenteditable=true]")) return
        const moves: Record<string, [number, number]> = { arrowleft: [40, 0], arrowright: [-40, 0], arrowup: [0, 40], arrowdown: [0, -40] }
        const key = e.key.toLowerCase()
        if (moves[key]) scene.pan(...moves[key]!)
        else if (key === "q") scene.rotate(-Math.PI / 4)
        else if (key === "e") scene.rotate(Math.PI / 4)
        else if (key === "home") scene.resetCamera()
        else if (key === "+" || key === "=") scene.zoomBy(1.25)
        else if (key === "-") scene.zoomBy(0.8)
        else return
        e.preventDefault()
        this.updatePointer()
        this.sync()
      },
      { signal }
    )
    this.sync()
  }
  private spread() {
    const [a, b] = [...this.pointers.values()]
    return a && b
      ? {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          angle: Math.atan2(b.y - a.y, b.x - a.x),
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        }
      : null
  }
  /** A touch tap with a tap tool: the first tap arms (and returns true, so the
   * release is held back); a second on the same spot lets the release through. */
  private arm(at: Point, hit: number | null) {
    const tool = this.ui.tool
    if (tool !== "place" && tool !== "prop" && tool !== "bulldoze") return false
    const armed = this.armed
    this.armed = null
    const same = armed && armed.tool === tool && (tool === "bulldoze" && hit !== null ? armed.hit === hit : Math.hypot(armed.at.x - at.x, armed.at.y - at.y) < 1.5)
    if (same) return false
    this.armed = { tool, at, hit }
    this.ui.toast(tool === "bulldoze" ? "tap it again to remove it" : "tap it again to build it here")
    this.updatePointer()
    return true
  }
  /** Whether a point on the screen is over the page rather than the map. */
  private overPage(p: Point) {
    const canvas = this.scene.canvas
    const box = canvas.getBoundingClientRect()
    if (p.x < box.left || p.y < box.top || p.x > box.right || p.y > box.bottom) return true
    return document.elementFromPoint(p.x, p.y) !== canvas
  }
  /** Lays the held stroke. */
  confirmStroke() {
    const held = this.held
    if (!held) return
    this.held = null
    this.ui.gestures.push({ type: "release", at: held.at, panned: false })
    this.updatePointer()
  }
  /** Drops the stroke being drawn or held. */
  cancelStroke() {
    this.held = null
    this.offMap = false
    if (this.press?.mode === "edit") this.press = null
    this.ui.dragFrom = null
    this.updatePointer()
  }
  private updatePointer() {
    if (this.armed && this.armed.tool !== this.ui.tool) this.armed = null
    // A held stroke goes with its tool, or once the page has dropped it (another tool chosen).
    if (this.held && (this.held.tool !== this.ui.tool || (this.ui.dragFrom === null && !this.ui.gestures.some((g) => g.type === "press")))) this.held = null
    this.ui.stroke = this.held ? "held" : this.offMap && this.press ? "cancel" : null
    // An armed tap holds the ghost where it landed, even while the map pans under it.
    if (this.held) {
      this.ui.pointer = this.held.at
      this.ui.pointerHit = null
    } else if (this.armed) {
      this.ui.pointer = this.armed.at
      this.ui.pointerHit = this.armed.hit
    } else if (this.screen) {
      const input = this.scene.inputAt(this.screen.x, this.screen.y, this.ui.tool)
      this.ui.pointer = input.at
      this.ui.pointerHit = input.hit
    } else {
      this.ui.pointer = null
      this.ui.pointerHit = null
    }
  }
  get pointer() {
    return this.screen
  }
  /** Where the tooltip goes, or `null` for none. A finger shows it only for what it is about to
   * build (a stroke being drawn or held, an armed tap), never while it moves the camera or
   * picks a building, whose panel says the same; the stylesheet pins it to the top on touch. */
  get tip(): Point | null {
    if (!this.touch) return this.screen
    if (this.pinch) return null
    if (this.held || this.armed) return this.screen ?? { x: 0, y: 0 }
    return this.press?.mode === "edit" ? this.screen : null
  }
  sync() {
    this.updatePointer()
    this.controls.querySelector("output")!.textContent = this.scene.camera.zoom.toFixed(1) + "×"
    this.controls
      .querySelectorAll("[data-mode]")
      .forEach((b) => b.setAttribute("aria-pressed", String((b as HTMLElement).dataset.mode === this.mode)))
    this.scene.canvas.style.cursor = this.press?.moved
      ? this.press.mode === "rotate"
        ? "ew-resize"
        : "grabbing"
      : this.mode === "rotate"
        ? "ew-resize"
        : this.ui.preview.hover !== null || this.ui.tool !== "select"
          ? "pointer"
          : "grab"
  }
  reset() {
    this.mode = "pan"
    this.armed = null
    this.held = null
    this.offMap = false
    this.press = null
    this.pinch = null
    this.pointers.clear()
    this.ui.dragFrom = null
    this.ui.gestures.length = 0
    this.ui.pointerHit = null
    this.sync()
  }
  dispose() {
    this.abort.abort()
    this.controls.remove()
  }
}
