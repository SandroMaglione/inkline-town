/**
 * Photo mode: the town alone on the screen, for pictures and films to post.
 * The panels, the toolbar, and the news go; the map only looks (drags turn
 * and move the camera, nothing is built or picked). A bar of its own frames
 * the picture (the whole window, or 16:9, 9:16, 1:1, 4:5), flies the camera
 * (`view/shots.ts`), takes it down into the street to walk the town at a
 * walker's eye and back up, works the clock, takes a picture, and films the canvas.
 * The bar fades while a shot flies or a film runs, and comes back with the
 * pointer. V or Esc leaves.
 */
import { offerPicture } from "../../../platform/share/client.ts"
import type { Interaction, Stats } from "../../../view/contracts.ts"
import { frameIds, frames, shotIds, shots, type FrameId, type ShotId } from "../../../view/shots.ts"
import type { Controls } from "../controls.ts"
import { el } from "../kit/dom.ts"
import { iconEl } from "../kit/icons.ts"

/** What photo mode needs of the map's camera, whatever draws it. */
export interface PhotoCamera {
  /** On: the map only looks. */
  readonly look: (on: boolean) => void
  /** Flies a shot from where the camera is; `done` says whether it ran to its end. */
  readonly play: (shot: ShotId, done: (ended: boolean) => void) => void
  readonly stop: () => void
  readonly playing: () => ShotId | null
  /** Down into the street to walk it (`on`), or back up over the map; `done` once it is there; `instant`: at once. */
  readonly street: (on: boolean, done: () => void, instant?: boolean) => void
  /** Down in the street, or on the way there. */
  readonly onStreet: () => boolean
  /** On the way down to the street or up from it: nothing else flies till it is there. */
  readonly travelling: () => boolean
  /** The canvas the town is drawn on, to film. */
  readonly canvas: () => HTMLCanvasElement
  /** Draws the canvas this many pixels across while filming; `null`: the screen's own. */
  readonly filmAt: (width: number | null) => void
}

export interface PhotoMap {
  /** The element the map is drawn in: photo mode frames it. */
  readonly surface: HTMLElement
  readonly picture: (width: number, height: number, scale: number) => HTMLCanvasElement
  readonly photo: PhotoCamera
}

/** The longest side of a picture of the whole window. */
const FULL_MAX = 3840
/** The bar fades after this long without the pointer, while a shot flies or a film runs. */
const IDLE_MS = 2500
const ink = "#3d4943"

/** The first kind of film this browser can record: MP4 where it can (it posts anywhere), else WebM. */
const filmType = () =>
  typeof MediaRecorder === "undefined"
    ? null
    : (["video/mp4;codecs=avc1.640028", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? null)

export const createPhoto = (
  ui: Interaction,
  stats: () => Stats | null,
  map: PhotoMap,
  blocked: () => boolean,
  controls: Pick<Controls, "toast" | "setSpeed" | "togglePause" | "choose" | "setView" | "setFold" | "refreshTools">
) => {
  let open = false
  let frame: FrameId = "full"
  let credit = true
  let film: { recorder: MediaRecorder; chunks: Array<Blob>; started: number; type: string } | null = null
  let idleTimer = 0

  const bar = el("div", "photo-bar photo-ui")
  bar.setAttribute("role", "toolbar")
  bar.setAttribute("aria-label", "Photo mode")
  const hint = el("div", "photo-hint photo-ui")
  hint.setAttribute("role", "status")
  const flash = el("div", "photo-flash photo-ui")

  const group = (label: string) => {
    const g = el("div", "group")
    g.append(el("b", "", label))
    bar.append(g)
    return g
  }
  const button = (into: HTMLElement, text: string, title: string, run: () => void, className = "") => {
    const b = el("button", className, text)
    b.type = "button"
    b.title = title
    b.onclick = run
    into.append(b)
    return b
  }

  const frameGroup = group("frame")
  const frameButtons = new Map<FrameId, HTMLButtonElement>()
  for (const id of frameIds) frameButtons.set(id, button(frameGroup, frames[id].title, frames[id].note, () => setFrame(id)))

  const shotGroup = group("camera")
  const streetButton = button(shotGroup, "street", "Step down into the street and walk the town at a walker's eye; again to rise back up", () => toggleStreet(), "street")
  const shotButtons = new Map<ShotId, HTMLButtonElement>()
  for (const id of shotIds) shotButtons.set(id, button(shotGroup, shots[id].title, shots[id].note, () => play(id)))
  const stopButton = button(shotGroup, "■", "Stop the camera where it is", () => map.photo.stop(), "stop")
  stopButton.setAttribute("aria-label", "Stop the camera")

  const timeGroup = group("time")
  const speedButtons = new Map<number, HTMLButtonElement>()
  const pauseButton = button(timeGroup, "", "Pause the town, or run it again (space)", () => controls.togglePause(), "pause")
  pauseButton.append(iconEl("pause"))
  pauseButton.setAttribute("aria-label", "Pause")
  speedButtons.set(0, pauseButton)
  for (const [speed, key] of [[1, "1"], [2, "2"], [4, "3"]] as const)
    speedButtons.set(speed, button(timeGroup, `${speed}×`, `Run the town at ${speed}× (${key})`, () => controls.setSpeed(speed)))

  const takeGroup = group("take")
  const snapButton = button(takeGroup, "picture", "Take a picture of the town as it is framed", () => void snap(), "snap")
  snapButton.prepend(iconEl("picture"))
  const recButton = button(takeGroup, "film", "Film the town as it is framed; start a camera move to film it, and the film stops when the move ends", () => toggleFilm(), "rec")
  recButton.prepend(el("span", "dot"))
  const creditButton = button(takeGroup, "credit", "Write the game's name in the corner of the picture", () => {
    credit = !credit
    sync()
  })
  if (filmType() === null) {
    recButton.disabled = true
    recButton.title = "This browser cannot film the canvas"
  }

  const doneButton = button(bar, "done", "Leave photo mode (V or Esc)", () => close(), "done")
  doneButton.prepend(iconEl("close"))

  // ── Saying things: photo mode hides the toast, so it has a line of its own ──
  let hintTimer = 0
  const say = (message: string, ms = 3200) => {
    // A film saved as photo mode closes has its say on the page's toast.
    if (!open) return controls.toast(message)
    hint.textContent = message
    hint.classList.add("show")
    clearTimeout(hintTimer)
    hintTimer = window.setTimeout(() => hint.classList.remove("show"), ms)
  }

  // ── The frame: the map's element is sized to the frame's shape, in the space above the bar ──
  const layout = () => {
    const surface = map.surface,
      size = open ? frames[frame].size : null
    document.body.classList.toggle("framed", size !== null)
    if (!size) {
      for (const p of ["left", "top", "width", "height", "right", "bottom"] as const) surface.style[p] = ""
      return
    }
    const pad = 16,
      below = bar.offsetHeight + 28,
      room = { width: innerWidth - pad * 2, height: innerHeight - pad - below },
      ratio = size.width / size.height
    let width = room.width,
      height = width / ratio
    if (height > room.height) {
      height = room.height
      width = height * ratio
    }
    // Whole pixels, the height from the width, so a picture or film scaled up from it keeps the frame's exact shape.
    width = Math.round(width)
    height = Math.round(width / ratio)
    surface.style.left = `${Math.round((innerWidth - width) / 2)}px`
    surface.style.top = `${Math.round(pad + (room.height - height) / 2)}px`
    surface.style.width = `${Math.round(width)}px`
    surface.style.height = `${Math.round(height)}px`
    surface.style.right = surface.style.bottom = "auto"
  }
  const setFrame = (id: FrameId) => {
    if (film) return
    frame = id
    layout()
    sync()
  }

  // ── The camera ──
  const play = (id: ShotId) => {
    map.photo.play(id, (ended) => {
      // A film started for a move ends with it.
      if (ended && film) stopFilm()
      sync()
      // The bar comes back once the camera is the player's again.
      wake()
    })
    sync()
    wake()
  }
  const toggleStreet = () => {
    if (!open) return
    const down = !map.photo.onStreet()
    map.photo.street(down, () => {
      sync()
      wake()
      if (!open) return
      if (!down) return say("Over the town again", 2000)
      say(
        matchMedia("(pointer: coarse)").matches
          ? "In the street · drag to look, hold to walk, pinch for a long lens · street again to rise"
          : "In the street · W A S D or the arrows to walk, shift to hurry, drag to look · street again to rise",
        5200
      )
    })
    sync()
    wake()
  }

  // ── A picture: the frame drawn afresh at the frame's own size (or twice the window's) ──
  const snap = async () => {
    const box = map.surface.getBoundingClientRect(),
      width = Math.max(1, Math.round(box.width)),
      height = Math.max(1, Math.round(box.height)),
      full = Math.min(2, FULL_MAX / Math.max(width, height)),
      size = frames[frame].size ?? { width: Math.round(width * full), height: Math.round(height * full) }
    let blob: Blob
    try {
      const drawn = map.picture(width, height, size.width / width)
      const out = document.createElement("canvas")
      out.width = size.width
      out.height = size.height
      const g = out.getContext("2d")!
      g.drawImage(drawn, 0, 0, size.width, size.height)
      if (credit) writeCredit(g, size.width, size.height)
      blob = await new Promise<Blob>((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error("The picture could not be made"))), "image/png"))
    } catch (error) {
      return say(error instanceof Error ? error.message : "The picture could not be made")
    }
    flash.classList.remove("go")
    void flash.offsetWidth
    flash.classList.add("go")
    say(await offerPicture(blob, `${baseName()}-${frame === "full" ? "photo" : frame.replace(":", "x")}.png`, "Inkline Town"))
  }
  const writeCredit = (g: CanvasRenderingContext2D, width: number, height: number) => {
    const size = Math.round(Math.max(14, Math.min(width, height) * 0.022)),
      margin = Math.round(size * 1.3)
    g.font = `600 ${size}px ui-monospace, "SF Mono", Menlo, monospace`
    g.textAlign = "right"
    g.textBaseline = "bottom"
    g.fillStyle = ink
    g.globalAlpha = 0.72
    g.fillText(`Inkline Town · ${location.host}`, width - margin, height - margin)
    g.globalAlpha = 1
  }
  const baseName = () => {
    const s = stats()
    return s ? `inkline-town-year-${s.season.year}` : "inkline-town"
  }

  // ── A film: the canvas as it is drawn, frame by frame ──
  const toggleFilm = () => (film ? stopFilm() : startFilm())
  const startFilm = () => {
    const type = filmType()
    if (!type) return say("This browser cannot film the canvas")
    let recorder: MediaRecorder
    // A framed film is drawn at its post's size (1080 across for 9:16), whatever the window.
    const size = frames[frame].size
    if (size) map.photo.filmAt(size.width)
    try {
      recorder = new MediaRecorder(map.photo.canvas().captureStream(30), { mimeType: type, videoBitsPerSecond: 16_000_000 })
    } catch (error) {
      map.photo.filmAt(null)
      return say(error instanceof Error ? error.message : "The film could not start")
    }
    const take = { recorder, chunks: [] as Array<Blob>, started: performance.now(), type }
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) take.chunks.push(e.data)
    }
    recorder.onstop = () => {
      for (const track of recorder.stream.getTracks()) track.stop()
      const blob = new Blob(take.chunks, { type: type.split(";")[0] ?? type })
      const name = `${baseName()}-${frame === "full" ? "film" : frame.replace(":", "x")}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`
      void offerPicture(blob, name, "Inkline Town", "film").then((message) => say(message))
    }
    recorder.start(250)
    film = take
    say(map.photo.playing() ? "Filming" : "Filming: pick a camera move, or move it yourself")
    sync()
    wake()
  }
  const stopFilm = () => {
    if (!film) return
    const { recorder } = film
    film = null
    if (recorder.state !== "inactive") recorder.stop()
    map.photo.filmAt(null)
    sync()
  }

  // ── The bar fades while the camera flies or a film runs, and wakes with the pointer ──
  const wake = () => {
    bar.classList.remove("idle")
    clearTimeout(idleTimer)
    idleTimer = window.setTimeout(() => {
      if (open && (map.photo.playing() !== null || film)) bar.classList.add("idle")
    }, IDLE_MS)
  }
  for (const type of ["pointermove", "pointerdown"] as const) window.addEventListener(type, () => open && wake(), { passive: true })
  window.addEventListener("resize", () => open && layout())

  // ── Coming and going ──
  const openPhoto = () => {
    if (open || blocked()) return
    open = true
    controls.setFold(null)
    ui.menu = null
    ui.selected = null
    ui.flash = null
    controls.choose("select")
    controls.setView("none")
    controls.refreshTools()
    map.photo.look(true)
    document.body.classList.add("photo-mode")
    layout()
    sync()
    wake()
    say(matchMedia("(pointer: coarse)").matches ? "Photo mode · drag to look, pinch to zoom and turn" : "Photo mode · drag to look, right-drag to turn, wheel to zoom · V or Esc to leave", 4200)
  }
  const close = () => {
    if (!open) return
    stopFilm()
    map.photo.stop()
    // Building needs the map's camera: up out of the street at once.
    map.photo.street(false, () => {}, true)
    map.photo.look(false)
    open = false
    document.body.classList.remove("photo-mode")
    bar.classList.remove("idle")
    hint.classList.remove("show")
    layout()
  }

  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLElement && e.target.closest("input,select,textarea,[contenteditable=true]")) return
    const key = e.key.toLowerCase()
    if (!open) {
      if (key === "v" && !e.metaKey && !e.ctrlKey && !e.altKey && !blocked()) {
        e.preventDefault()
        openPhoto()
      }
      return
    }
    // The page's own keys stand down while photo mode is open (see `bindKeys`): these are photo mode's.
    if (key === "escape" || key === "v") close()
    else if (key === " " && !(e.target instanceof HTMLButtonElement)) controls.togglePause()
    else if (key === "1") controls.setSpeed(1)
    else if (key === "2") controls.setSpeed(2)
    else if (key === "3") controls.setSpeed(4)
    else return
    e.preventDefault()
    wake()
  })

  /** Shows what is picked: the frame, the move, the speed, a film's running time. */
  const sync = () => {
    if (!open) return
    const playing = map.photo.playing()
    for (const [id, b] of frameButtons) {
      b.setAttribute("aria-pressed", String(id === frame))
      b.disabled = film !== null && id !== frame
    }
    const travelling = map.photo.travelling(),
      street = map.photo.onStreet()
    for (const [id, b] of shotButtons) {
      b.setAttribute("aria-pressed", String(id === playing))
      b.disabled = travelling
    }
    streetButton.setAttribute("aria-pressed", String(street))
    streetButton.disabled = travelling
    if (streetButton.textContent !== (street ? "rise" : "street")) {
      streetButton.textContent = street ? "rise" : "street"
      streetButton.title = street ? "Rise out of the street, back over the town" : "Step down into the street and walk the town at a walker's eye; again to rise back up"
    }
    stopButton.disabled = playing === null
    for (const [speed, b] of speedButtons) b.setAttribute("aria-pressed", String(ui.speed === speed))
    creditButton.setAttribute("aria-pressed", String(credit))
    recButton.setAttribute("aria-pressed", String(film !== null))
    const label = film ? `${Math.floor((performance.now() - film.started) / 60000)}:${String(Math.floor(((performance.now() - film.started) / 1000) % 60)).padStart(2, "0")}` : "film"
    if (recButton.lastChild?.textContent !== label) recButton.lastChild!.textContent = label
  }

  return {
    elements: [bar, hint, flash],
    open: openPhoto,
    close,
    isOpen: () => open,
    sync
  }
}
