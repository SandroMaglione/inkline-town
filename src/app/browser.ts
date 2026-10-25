/**
 * The page: a town simulation of line-drawn buildings, homes, roads, and
 * land, on the Ritmo ECS with a 3D view. This is the one module that knows
 * every layer: it makes the world's runtime (`game`), hands it the view's
 * and the renderer's services, mounts the page's UI (`ui/dom`), and runs the
 * loop: the simulation on a fixed step, then the view and the renderer once
 * a frame.
 */
import { FixedLoop, HostClock, Result } from "@typeonce/ritmo"
import { Effect } from "effect"
import { BrowserHostClock } from "@typeonce/ritmo-browser"

import type { BuildingView, FieldView, HouseView, RockView, RuinView, TreeView, WalkerView } from "../render/three/views.ts"
import { lands, sizes, step } from "../game/content/index.ts"
import { bookkeeping, editQueue } from "../game/edits.ts"
import { resolveRules } from "../game/rules/config.ts"
import { blankResources, settle, simulate } from "../game/schedule.ts"
import { Edits, Game, Rules } from "../game/schema.ts"
import { browserStorage, describe, fileOf, latest, loadLatest, loadText, save, Storage, World } from "../platform/save.ts"
import { download, sharedId } from "../platform/share/client.ts"
import { MapInput } from "../render/three/input.ts"
import { GameScene, type CameraView } from "../render/three/scene.ts"
import { draw } from "../render/three/schedule.ts"
import { BuildingNodes, FieldNodes, HouseNodes, RockNodes, RuinNodes, StageService, TreeNodes, WalkerNodes } from "../render/three/services.ts"
import { thumbnails } from "../render/three/thumbnails.ts"
import { createDomUi, type Persistence } from "../ui/dom/index.ts"
import { blankInteraction, blankShown } from "../view/contracts.ts"
import { project } from "../view/schedule.ts"
import { Clock, Interaction, Outbox, Shown } from "../view/services.ts"

/** Minutes of game time between autosaves. */
const AUTOSAVE_MINUTES = 2

/** Fades the loading card out: once the town has drawn its first frame, or when it could not start. */
const loaded = () => {
  const card = document.getElementById("loading")
  if (!card || card.classList.contains("done")) return
  card.classList.add("done")
  setTimeout(() => card.remove(), 400)
}

const start = async () => {
  const mount = document.getElementById("app")!
  let persistence: Persistence<CameraView> = { save: () => "Not ready", load: () => "Not ready", shareFile: () => "" }
  // A shared town's link (`/t/<id>`): fetch it while the page starts, and load it once the town is up.
  const shared = sharedId(location.pathname)
  let arriving: string | null = null
  // A town saved in this browser before: the founding screen offers to carry on with it.
  const last = Effect.runSync(Effect.result(latest.pipe(Effect.provideService(Storage, browserStorage(localStorage)))))
  const saved = last._tag === "Success" && last.success !== null ? { title: last.success.title, savedAt: last.success.savedAt } : null
  // What the player is doing, what the view shows, and the edits waiting for the next step: shared by the UI, the view, and the simulation.
  const interaction = blankInteraction()
  const shown = blankShown()
  const edits = editQueue()
  // The renderer draws into `mount`; the page's UI goes around it, and reaches the map only through `MapPort`.
  const stage = new GameScene(mount)
  let input: MapInput | null = null
  const page = createDomUi<CameraView>(
    { interaction, shown, send: edits.push },
    {
      surface: mount,
      focus: (x, y) => stage.focus(x, y),
      resetCamera: () => stage.resetCamera(),
      camera: () => stage.view(),
      picture: (width, height, scale) => stage.picture(width, height, scale),
      pointer: () => input?.tip ?? null,
      confirmStroke: () => input?.confirmStroke(),
      cancelStroke: () => input?.cancelStroke(),
      reset: () => input?.reset(),
      sync: () => input?.sync()
    },
    thumbnails(),
    () => persistence,
    { shared: shared !== null, saved }
  )
  input = new MapInput(stage, interaction, shown, { toast: page.toast, blocked: page.blocked })
  const { syncPage, resetPage, toast, visit, visitFailed, visiting } = page
  if (shared)
    download(shared).then(
      (text) => (arriving = text),
      (error: unknown) => visitFailed(error instanceof Error ? error.message : "Could not open that town")
    )
  const clock = { deltaSeconds: step.dt, elapsed: 0 }

  const buildingNodes = stage.registry<BuildingView>(),
    houseNodes = stage.registry<HouseView>(),
    walkerNodes = stage.registry<WalkerView>(),
    treeNodes = stage.registry<TreeView>(),
    rockNodes = stage.registry<RockView>(),
    fieldNodes = stage.registry<FieldView>(),
    ruinNodes = stage.registry<RuinView>()
  const resetPresentation = () => {
    for (const registry of [buildingNodes, houseNodes, walkerNodes, treeNodes, rockNodes, fieldNodes, ruinNodes]) registry.clear()
    stage.resetPresentation()
    resetPage()
  }
  // The page's clock: the debug handle times systems with it.
  const hostClock = BrowserHostClock.make(window)
  const made = Game.Runtime.make({
    services: Game.Runtime.services(
      Game.Runtime.service(Interaction, interaction),
      Game.Runtime.service(Shown, shown),
      Game.Runtime.service(Outbox, edits),
      Game.Runtime.service(Edits, edits),
      Game.Runtime.service(Rules, resolveRules()),
      Game.Runtime.service(Clock, clock),
      Game.Runtime.service(StageService, stage),
      Game.Runtime.service(BuildingNodes, buildingNodes),
      Game.Runtime.service(HouseNodes, houseNodes),
      Game.Runtime.service(WalkerNodes, walkerNodes),
      Game.Runtime.service(TreeNodes, treeNodes),
      Game.Runtime.service(RockNodes, rockNodes),
      Game.Runtime.service(FieldNodes, fieldNodes),
      Game.Runtime.service(RuinNodes, ruinNodes)
    ),
    resources: blankResources(),
    // Dev builds carry the debug handle, for the replay recorder.
    debug: import.meta.env.DEV ? { hostClock } : undefined
  })
  if (!made.ok) {
    mount.textContent = `The town could not start: ${JSON.stringify(made.error)}`
    loaded()
    return
  }
  const runtime = made.value
  // In development, the page's console can reach the town: `town.edits.push(...)`, `town.interaction`, `town.shown`,
  // `town.snapshot()` (the world as plain data), and `town.advance(seconds)` to fast-forward the simulation.
  if (import.meta.env.DEV) {
    const advance = (seconds: number) => {
      for (let i = 0; i < Math.round(seconds / step.dt); i++) {
        const stepped = runtime.tick(simulate)
        if (!stepped.ok) throw new Error(`A step failed: ${JSON.stringify(stepped.error)}`)
      }
    }
    const snapshot = () => {
      const saved = runtime.snapshot()
      if (!saved.ok) throw new Error(`The town could not be saved: ${JSON.stringify(saved.error)}`)
      return saved.value
    }
    Object.assign(window, { town: { interaction, shown, edits, runtime, snapshot, advance, view: stage } })
    if (runtime.debug !== undefined) {
      // Loaded in dev only: the production bundle never includes devtools.
      const { attachDevtools } = await import("./devtools.ts")
      attachDevtools({ runtime: { ...runtime, debug: runtime.debug }, fetch: (url, init) => fetch(url, init), wallClock: HostClock.standard, host: window, demo: new URLSearchParams(location.search).has("replay-demo") })
    }
  }

  // Saves are Effect programs over the browser's storage and this town (see `save.ts`);
  // loading validates every component before touching the world.
  const world: World["Service"] = {
    snapshot: () => runtime.snapshot(),
    restore: (data) => {
      const restored = runtime.restore(data)
      if (restored.ok) resetPresentation()
      return restored.ok ? null : restored.error._tag
    },
    title: () => {
      const s = shown.town.stats
      return s
        ? `${sizes[s.charter.size].title}, ${lands[s.charter.land].title} land · year ${s.season.year} · ${Math.floor(s.minute)} min in`
        : "a town"
    }
  }
  const run = <A, E>(program: Effect.Effect<A, E, Storage | World>) =>
    Effect.runSync(
      Effect.result(program.pipe(Effect.provideService(Storage, browserStorage(localStorage)), Effect.provideService(World, world)))
    )
  persistence = {
    save: () => {
      const saved = run(save("manual"))
      return saved._tag === "Success" ? null : describe(saved.failure)
    },
    load: () => {
      const loaded = run(loadLatest)
      if (loaded._tag === "Failure") return describe(loaded.failure)
      return loaded.success.slot === "auto" ? `Loaded the autosave: ${loaded.success.title}` : `Loaded ${loaded.success.title}`
    },
    shareFile: (camera) => {
      const file = run(fileOf("manual"))
      if (file._tag === "Failure") throw new Error("The town could not be packed up")
      return JSON.stringify({ ...file.success, camera })
    }
  }
  /** Loads the shared town that arrived, once the town the page started with has been founded. */
  const arrive = (text: string) => {
    const loaded = run(loadText(text))
    if (loaded._tag === "Failure") return visitFailed(describe(loaded.failure))
    const camera = (JSON.parse(text) as { camera?: CameraView }).camera
    if (camera) stage.setView(camera)
    else stage.resetCamera()
    visit(loaded.success.title)
  }
  /** The page autosaves every `AUTOSAVE_MINUTES` of game time while a term runs. */
  let autosaved = 0
  const autosave = () => {
    const s = shown.town.stats
    if (!s || s.fate.state !== "playing" || interaction.founding || visiting()) return
    if (s.minute < autosaved) autosaved = 0
    if (s.minute < autosaved + AUTOSAVE_MINUTES) return
    autosaved = Math.floor(s.minute / AUTOSAVE_MINUTES) * AUTOSAVE_MINUTES
    const saved = run(save("auto"))
    if (saved._tag === "Failure") toast(describe(saved.failure))
  }

  /** A shared town has just loaded and not yet been drawn. */
  let settling = false
  const loop = FixedLoop.start({
    source: FixedLoop.source((onTick) => stage.subscribe(onTick)),
    step,
    maxFrameSeconds: 0.25,
    maxStepsPerFrame: 4,
    // The town runs at the chosen speed; it waits while paused, while the
    // new-town dialog is open, and once the term has ended (an edit, such as
    // founding a new town, still gets its step).
    update: () => {
      if (arriving !== null && edits.queued.length === 0) {
        const text = arriving
        arriving = null
        arrive(text)
        settling = true
      }
      // The town's numbers are still the old town's until the next frame draws the new one: wait for them.
      if (settling) return Result.success(undefined)
      if (edits.queued.some((edit) => edit.type === "newTown")) {
        resetPresentation()
        stage.resetCamera()
      }
      const waiting = interaction.speed === 0 || interaction.founding || (shown.town.stats !== null && shown.town.stats.fate.state !== "playing")
      // An edit still gets its step while the town waits; the guide's books are kept without one.
      const pending = edits.queued.length > 0
      const books = pending && edits.queued.every(bookkeeping)
      if (waiting && books) return runtime.tick(settle)
      const steps = waiting ? (pending ? 1 : 0) : interaction.speed
      for (let i = 0; i < steps; i++) {
        const stepped = runtime.tick(simulate)
        if (!stepped.ok) return stepped
      }
      return Result.success(undefined)
    },
    render: ({ elapsedSeconds }) => {
      clock.deltaSeconds = elapsedSeconds
      clock.elapsed += elapsedSeconds
      const viewed = runtime.tick(project)
      if (!viewed.ok) throw new Error(`The town view stopped: ${JSON.stringify(viewed.error)}`)
      const drawn = runtime.tick(draw)
      if (!drawn.ok) throw new Error(`The town view stopped: ${JSON.stringify(drawn.error)}`)
      settling = false
      syncPage()
      autosave()
      // The first frame builds the town's meshes and shaders; the card lifts on the frame after it.
      requestAnimationFrame(loaded)
    },
    onFailure: (failure) => {
      mount.textContent =
        failure.kind === "InvalidTickDelta" ? `Invalid frame delta: ${failure.deltaMS}` : "The town stopped after a system failure."
      loaded()
    }
  })
  if (!loop.ok) {
    mount.textContent = `Invalid fixed-loop option: ${loop.error.field}`
    loaded()
  }
}

start().catch((error: unknown) => {
  document.getElementById("app")!.textContent = `The town could not start: ${error instanceof Error ? error.message : String(error)}`
  loaded()
})

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
