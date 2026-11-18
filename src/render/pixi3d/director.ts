import { floorScale } from "./assets/space.ts"
import { backward, type CameraView, type EyeView, type GameScene } from "./scene.ts"
import { facing, Street } from "./street.ts"
import { BuildingView, HouseView, WalkerView } from "./views.ts"
import { shots, type ShotId } from "../../view/shots.ts"
import type { Point } from "../../game/world/iso.ts"

/** Seconds a shot takes to ease in from wherever the camera stood. */
const BLEND = 1.4
/** Seconds the camera takes down into the street, and back up out of it. */
const DOWN = 2.8, UP = 2.4
/** Degrees: a field of view narrow enough, from far enough off, to pass for the map's camera. */
const NARROW = 1.2
/** Cells ahead of the eye that the camera looks at as it comes down. */
const LOOK = 5
const QUARTER = Math.PI / 4
const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mixLog = (a: number, b: number, t: number) => Math.exp(mix(Math.log(a), Math.log(b), t))

/** Between two views; zoom in log space, so a dolly feels even. */
const blend = (a: CameraView, b: CameraView, t: number): CameraView => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
  heading: mix(a.heading, b.heading, t),
  elevation: mix(a.elevation, b.elevation, t),
  zoom: mixLog(a.zoom, b.zoom, t)
})

/**
 * Between the map's view (`u` 0) and an eye in the street (`u` 1), as one
 * perspective camera: a dolly zoom. At 0 it stands so far off with so narrow
 * a lens that it draws just what the map's camera does (`height` is the
 * view's in pixels, which with the zoom says how much of the town that is);
 * as `u` rises the lens widens while the camera comes in and down, so the
 * town opens out into depth and the street rises round the eye.
 */
const dolly = (map: CameraView, eye: EyeView, u: number, height: number): EyeView => {
  const near = LOOK * floorScale,
    far = height / map.zoom / (2 * Math.tan((NARROW * Math.PI) / 360)),
    toEye = nearest(eye.heading, map.heading),
    // Back from what the eye looks at to the eye: the eye looks at a point `near` ahead of it.
    fromLook = backward(toEye, eye.pitch)
  const heading = mix(map.heading, toEye, u),
    elevation = mix(map.elevation, eye.pitch, u),
    distance = mixLog(far, near, u),
    look = {
      x: mix(map.x * floorScale, eye.x * floorScale - fromLook.x * near, u),
      y: mix(0, eye.height - fromLook.y * near, u),
      z: mix(map.y * floorScale, eye.y * floorScale - fromLook.z * near, u)
    },
    back = backward(heading, elevation)
  return {
    x: (look.x + back.x * distance) / floorScale,
    y: (look.z + back.z * distance) / floorScale,
    height: look.y + back.y * distance,
    heading,
    pitch: elevation,
    fov: mixLog(NARROW, eye.fov, u),
    zoom: mix(1, eye.zoom, u)
  }
}

type Frame = CameraView | EyeView
const isEye = (frame: Frame): frame is EyeView => "pitch" in frame

/** A path through keyed views, eased between each pair. */
const keyed = (keys: ReadonlyArray<readonly [number, CameraView]>) => (s: number): CameraView => {
  const i = Math.max(0, keys.findIndex(([k], j) => s >= k && s <= (keys[j + 1]?.[0] ?? Infinity)))
  const [k0, a] = keys[i]!, [k1, b] = keys[Math.min(i + 1, keys.length - 1)]!
  return blend(a, b, k1 > k0 ? ease(clamp01((s - k0) / (k1 - k0))) : 0)
}

/** What the director knows of the town when a shot starts: where it is built, and how far it spreads. */
interface Landmarks {
  readonly middle: Point
  readonly hall: Point
  readonly busiest: Point
  /** The zoom that fits the whole town in the frame. */
  readonly wide: number
}

/** What is flying: a shot, or the camera going down to the street or up from it. */
interface Flight {
  readonly id: ShotId | "down" | "up"
  t: number
  /** How long it runs; `null`: until it is stopped. */
  readonly seconds: number | null
  /** Where the camera stood, for a map shot to ease in from; `null`: it starts where its path does. */
  readonly from: CameraView | null
  readonly path: (s: number, dt: number) => Frame
  readonly done: (ended: boolean) => void
  /** Puts the camera somewhere sound if the flight is stopped part way. */
  readonly settle?: () => void
}

/**
 * Photo mode's camera operator. It flies a named shot (`view/shots.ts`) by
 * setting the scene's view once a frame, before the frame is drawn, from what
 * the scene shows: where the buildings and homes stand, where the town hall
 * is, where the carts go. It reads the drawing only, never the simulation, so
 * a shot changes nothing in the town. Any camera gesture of the player's
 * stops it.
 *
 * It also takes the camera down into the street (`street.ts`) and back up:
 * there the player walks, *follow* walks along behind a carrier, *orbit*
 * turns on the spot, and any other shot rises out of the street into itself.
 */
export class CameraDirector {
  private scene: GameScene
  private current: Flight | null = null
  /** Where the camera is, or is on its way to: over the map, or down in the street. */
  private where: "map" | "street" = "map"
  /** Who `follow` rides with, and where the camera has got to behind them. */
  private rider: WalkerView | null = null
  private abort = new AbortController()
  readonly street: Street
  constructor(scene: GameScene) {
    this.scene = scene
    this.street = new Street(scene)
    const signal = this.abort.signal,
      stop = () => this.stop(false)
    // The player takes the camera back with any gesture of their own.
    scene.canvas.addEventListener("pointerdown", stop, { signal })
    scene.canvas.addEventListener("wheel", stop, { signal, passive: true })
    window.addEventListener(
      "keydown",
      (e) => {
        if (["arrowleft", "arrowright", "arrowup", "arrowdown", "q", "e", "w", "a", "s", "d", "home", "+", "=", "-"].includes(e.key.toLowerCase())) stop()
      },
      { signal }
    )
  }
  /** The shot being flown, if any. */
  get playing(): ShotId | null {
    const id = this.current?.id
    return id === undefined || id === "down" || id === "up" ? null : id
  }
  /** Down in the street, or on the way there. */
  get onStreet(): boolean {
    return this.where === "street"
  }
  /** The camera is on its way down to the street or up from it, and nothing else can fly till it is there. */
  get travelling(): boolean {
    return this.current?.id === "down" || this.current?.id === "up"
  }
  /** Flies `id` from where the camera is now; `done` runs when it ends (`true`) or is stopped or replaced (`false`). */
  play(id: ShotId, done: (ended: boolean) => void = () => {}) {
    if (this.travelling) return done(false)
    // *follow* again rides with someone else: keep who it rode with to pass them over.
    const rider = this.rider
    this.end(false)
    this.rider = rider
    const eye = this.where === "street" ? this.scene.eye() : null
    if (eye) return this.playStreet(id, eye, done)
    const from = this.scene.view()
    const path = this.path(id, from)
    if (!path) return done(false)
    this.current = { id, t: 0, seconds: shots[id].seconds, from, path, done }
  }
  /** A shot from the street: *follow* and *orbit* stay at the eye; the rest rise out of the street into themselves. */
  private playStreet(id: ShotId, eye: EyeView, done: (ended: boolean) => void) {
    if (id === "orbit") {
      // Turning on the spot once every 40 seconds, the head lifting and dipping a little.
      const path = (s: number): EyeView => ({ ...eye, heading: eye.heading + (s / 40) * Math.PI * 2, pitch: eye.pitch + Math.sin(s / 5) * 0.04 })
      this.current = { id, t: 0, seconds: null, from: null, path, done }
      return
    }
    if (id === "follow") {
      const path = this.stroll(eye)
      if (!path) return done(false)
      this.current = { id, t: 0, seconds: null, from: null, path, done }
      return
    }
    const over = this.scene.view(),
      shot = this.path(id, over)
    if (!shot) return done(false)
    const begin = shot(0, 0),
      height = this.scene.canvas.clientHeight,
      seconds = shots[id].seconds
    this.where = "map"
    this.street.rest()
    this.current = {
      id,
      t: 0,
      seconds: seconds === null ? null : seconds + UP,
      from: null,
      path: (s, dt) => (s < UP ? dolly(begin, eye, 1 - ease(s / UP), height) : shot(s - UP, dt)),
      done,
      settle: () => this.scene.eye() && this.scene.setView(begin)
    }
  }
  /**
   * Down into the street (`on`) from where the map's camera looks, or back up
   * over where the eye stands; `done` once it is there. `instant` puts it
   * there at once, as photo mode closes.
   */
  toStreet(on: boolean, done: () => void = () => {}, instant = false) {
    if (this.travelling && !instant) return done()
    this.end(false)
    // Already there (a rise into a shot stopped part way has settled over the map).
    if (on === this.onStreet && on === (this.scene.eye() !== null)) return done()
    const height = this.scene.canvas.clientHeight
    if (on) {
      const map = this.scene.view(),
        eye = this.street.landing(map)
      this.where = "street"
      if (instant) return this.arrive(eye, done)
      this.current = { id: "down", t: 0, seconds: DOWN, from: null, path: (s) => dolly(map, eye, ease(clamp01(s / DOWN)), height), done: () => done() }
      return
    }
    this.where = "map"
    this.street.rest()
    const eye = this.scene.eye()
    if (!eye) return done()
    const map = this.scene.view()
    if (instant) return this.arrive(map, done)
    this.current = { id: "up", t: 0, seconds: UP, from: null, path: (s) => (s >= UP ? map : dolly(map, eye, 1 - ease(clamp01(s / UP)), height)), done: () => done() }
  }
  private arrive(frame: Frame, done: () => void) {
    this.show(frame)
    done()
  }
  /** Stops the shot where the camera is. The way down to the street or up from it always runs to its end. */
  stop(ended = false) {
    if (this.travelling) return
    this.end(ended)
  }
  private end(ended: boolean) {
    const previous = this.current
    this.current = null
    this.rider = null
    if (!ended) previous?.settle?.()
    previous?.done(ended)
  }
  private show(frame: Frame) {
    if (isEye(frame)) this.scene.setEye(frame)
    else this.scene.setView(frame)
  }
  /** Moves the camera on by `dt` seconds of the page's time (not the town's: a paused town still films). */
  frame(dt: number) {
    const shot = this.current
    this.street.active = shot === null && this.where === "street"
    if (!shot) return this.street.frame(Math.min(dt, 0.1))
    shot.t += Math.min(dt, 0.1)
    if (shot.seconds !== null && shot.t >= shot.seconds) {
      this.show(shot.path(shot.seconds, 0))
      return this.end(true)
    }
    const view = shot.path(shot.t, Math.min(dt, 0.1))
    if (!shot.from || isEye(view)) return this.show(view)
    // A map shot eases in from where the camera stood, its heading turned the short way round.
    const into = ease(clamp01(shot.t / BLEND))
    const from = { ...shot.from, heading: nearest(shot.from.heading, view.heading) }
    this.scene.setView(into < 1 ? blend(from, view, into) : view)
  }
  private landmarks(): Landmarks | null {
    const built: Array<Point> = []
    let hall: Point | null = null
    for (const node of this.scene.nodes) {
      if (!(node instanceof BuildingView) && !(node instanceof HouseView)) continue
      built.push({ x: node.anchor.x, y: node.anchor.y })
      if (node instanceof BuildingView && node.kind === "townhall") hall = { x: node.anchor.x, y: node.anchor.y }
    }
    if (built.length === 0) return null
    const middle = { x: built.reduce((a, p) => a + p.x, 0) / built.length, y: built.reduce((a, p) => a + p.y, 0) / built.length }
    hall ??= middle
    // The busiest corner: the most buildings and homes within four cells, away from the town hall.
    const busiest =
      built
        .filter((p) => Math.hypot(p.x - hall.x, p.y - hall.y) > 6)
        .map((p) => ({ ...p, n: built.filter((q) => Math.abs(q.x - p.x) <= 4 && Math.abs(q.y - p.y) <= 4).length }))
        .sort((a, b) => b.n - a.n)[0] ?? middle
    // Most of the town (all but its farthest tenth), so one far-off quarry does not shrink the picture.
    const reach = built.map((p) => Math.hypot(p.x - middle.x, p.y - middle.y)).sort((a, b) => a - b)
    const radius = Math.max(6, reach[Math.floor(reach.length * 0.9)] ?? 6) + 3
    const canvas = this.scene.canvas,
      across = Math.min(canvas.clientWidth, canvas.clientHeight * 1.6)
    // At zoom 1 the view is as many world units across as the canvas is pixels wide.
    const wide = Math.min(1.4, Math.max(0.35, across / (2 * radius * floorScale)))
    return { middle, hall, busiest: { x: busiest.x, y: busiest.y }, wide }
  }
  private path(id: ShotId, from: CameraView): ((s: number, dt: number) => CameraView) | null {
    const town = this.landmarks()
    if (id === "orbit") {
      // Round where the camera looks, once every 48 seconds, the angle breathing a little.
      return (s) => ({ ...from, heading: from.heading + (s / 48) * Math.PI * 2, elevation: Math.max(0.3, Math.min(1.05, from.elevation + Math.sin(s / 6) * 0.05)) })
    }
    if (id === "follow") return this.follow(from, town)
    if (!town) return null
    const { middle, hall, busiest, wide } = town
    if (id === "flyover") {
      // As the README's film: the whole town turning, down to the town hall and along its streets, then back out.
      return keyed([
        [0, { ...middle, zoom: wide, heading: QUARTER - 0.4, elevation: 0.64 }],
        [7, { ...middle, zoom: wide * 1.25, heading: QUARTER - 0.1, elevation: 0.58 }],
        [13, { ...hall, zoom: 2.3, heading: QUARTER + 0.2, elevation: 0.52 }],
        [20, { ...busiest, zoom: 2.5, heading: QUARTER + 0.4, elevation: 0.5 }],
        [24, { x: (busiest.x + middle.x) / 2, y: (busiest.y + middle.y) / 2, zoom: 1.5, heading: QUARTER + 0.2, elevation: 0.56 }],
        [30, { ...middle, zoom: wide * 1.05, heading: QUARTER - 0.25, elevation: 0.64 }]
      ])
    }
    if (id === "reveal") {
      // Low at the town hall's door, then up and out to the whole island, turning as it climbs.
      return keyed([
        [0, { ...hall, zoom: 3.4, heading: QUARTER + 0.7, elevation: 0.3 }],
        [2.5, { ...hall, zoom: 3, heading: QUARTER + 0.6, elevation: 0.34 }],
        [12, { ...middle, zoom: wide, heading: QUARTER - 0.15, elevation: 0.95 }]
      ])
    }
    // Drift: low and close, gliding across the town past its middle, square to the way the camera faces.
    const heading = QUARTER + 0.25,
      across = { x: Math.cos(heading), y: -Math.sin(heading) },
      span = Math.max(8, Math.min(20, 0.5 * Math.hypot(busiest.x - middle.x, busiest.y - middle.y) + 8))
    return keyed([
      [0, { x: middle.x - across.x * span, y: middle.y - across.y * span, zoom: 1.9, heading: heading - 0.15, elevation: 0.36 }],
      [24, { x: middle.x + across.x * span, y: middle.y + across.y * span, zoom: 2.2, heading: heading + 0.15, elevation: 0.42 }]
    ])
  }
  /** One of the six carriers with a cart (or, if none has one, walkers) nearest `around`, at random; never `not`. */
  private pick(around: Point, not: WalkerView | null) {
    const walkers = [...this.scene.nodes].filter((n): n is WalkerView => n instanceof WalkerView && n !== not)
    const carts = walkers.filter((w) => w.carting)
    const pool = (carts.length ? carts : walkers)
      .map((w) => ({ w, d: Math.hypot(at(w).x - around.x, at(w).y - around.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6)
    return pool[Math.floor(Math.random() * pool.length)]?.w ?? null
  }
  /** Rides along with a carrier: one with a cart near the camera, another each time it is asked again. */
  private follow(from: CameraView, town: Landmarks | null) {
    const near = town?.middle ?? from
    this.rider = this.pick(from, this.rider) ?? this.pick(near, null)
    if (!this.rider) return null
    let camera = at(this.rider)
    return (s: number, dt: number): CameraView => {
      // Someone who gets where they were going leaves the scene: ride on with whoever is nearest.
      if (!this.rider || !this.scene.nodes.has(this.rider)) this.rider = this.pick(camera, null)
      if (this.rider) {
        const p = at(this.rider),
          k = 1 - Math.exp(-dt * 2.5)
        camera = { x: mix(camera.x, p.x, k), y: mix(camera.y, p.y, k) }
      }
      return { ...camera, zoom: 3, heading: from.heading + s * 0.04, elevation: 0.5 }
    }
  }
  /**
   * *follow* in the street: walks along at a shoulder of a carrier, a cell
   * behind them, looking down the road ahead of them. Someone new, or
   * someone far off, is a cut, never a glide through the houses between.
   */
  private stroll(eye: EyeView) {
    this.rider = this.pick(eye, this.rider) ?? this.pick(eye, null)
    if (!this.rider) return null
    let way = going(this.rider),
      camera: Point | null = null,
      heading = eye.heading
    const behind = (p: Point) => ({ x: p.x - way.x * BEHIND - way.y * 0.35, y: p.y - way.y * BEHIND + way.x * 0.35 })
    return (_s: number, dt: number): EyeView => {
      if (!this.rider || !this.scene.nodes.has(this.rider)) {
        this.rider = this.pick(camera ?? eye, null)
        camera = null
        if (this.rider) way = going(this.rider)
      }
      if (this.rider) {
        const p = at(this.rider)
        // The way they face, smoothed so the camera does not jolt at each corner.
        const k = 1 - Math.exp(-dt * 2.2),
          to = going(this.rider),
          x = mix(way.x, to.x, k),
          y = mix(way.y, to.y, k),
          n = Math.hypot(x, y) || 1
        way = { x: x / n, y: y / n }
        const want = behind(p)
        if (!camera || Math.hypot(want.x - camera.x, want.y - camera.y) > 3) {
          camera = want
          heading = nearest(facing(way.x, way.y), heading)
        } else {
          const k = 1 - Math.exp(-dt * 3)
          camera = { x: mix(camera.x, want.x, k), y: mix(camera.y, want.y, k) }
        }
        const look = { x: p.x + way.x * 1.5 - camera.x, y: p.y + way.y * 1.5 - camera.y }
        heading = mix(heading, nearest(facing(look.x, look.y), heading), 1 - Math.exp(-dt * 3))
      }
      const stand = camera ?? eye
      return { ...eye, x: stand.x, y: stand.y, heading, pitch: 0.1 }
    }
  }
  dispose() {
    this.abort.abort()
    this.street.dispose()
    this.current = null
    this.rider = null
  }
}

/** Where a walker is on the grid now. */
const at = (walker: WalkerView): Point => ({ x: walker.group.position.x / floorScale, y: walker.group.position.z / floorScale })
/** The grid direction a walker faces (`views.ts` turns them by `atan2(-dir.y, dir.x)`). */
const going = (walker: WalkerView): Point => ({ x: Math.cos(walker.group.rotation.y), y: -Math.sin(walker.group.rotation.y) })
/** Cells behind a carrier that *follow* walks in the street: clear of their cart and its load. */
const BEHIND = 1.8

/** `heading` turned by whole circles to lie within half a turn of `toward`. */
const nearest = (heading: number, toward: number) => heading + Math.round((toward - heading) / (Math.PI * 2)) * Math.PI * 2
