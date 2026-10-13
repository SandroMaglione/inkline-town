import { resolveRules } from "./rules/config.ts"
/**
 * A town simulation of line-drawn buildings, homes, roads, and land, on the
 * bevy-ts ECS with a 3D view. The simulation runs on a fixed step;
 * the views follow once a frame.
 */
import { Result } from "@typeonce/bevy-ts"
import { Effect } from "effect"
import { FixedLoop } from "@typeonce/bevy-ts-browser"

import type { BuildingView, FieldView, HouseView, RockView, RuinView, TreeView, WalkerView } from "./render3d/views.ts"
import { lands, sizes, STEP_SECONDS } from "./content.ts"
import { createHost, type Persistence } from "./host.ts"
import { present } from "./present.ts"
import { browserStorage, describe, fileOf, loadLatest, loadText, save, Storage, World } from "./save.ts"
import type { CameraView } from "./render3d/scene.ts"
import { download, sharedId } from "./share/client.ts"
import { BuildingNodes, Clock, FieldNodes, Game, Rules, HouseNodes, RockNodes, RuinNodes, StageService, TreeNodes, Ui, WalkerNodes } from "./schema.ts"
import { blankResources, simulate } from "./sim/index.ts"

/** Minutes of game time between autosaves. */
const AUTOSAVE_MINUTES = 2

const start = async () => {
  const mount = document.getElementById("app")!
  let persistence: Persistence = { save: () => "Not ready", load: () => "Not ready", shareFile: () => "" }
  // A shared town's link (`/t/<id>`): fetch it while the page starts, and load it once the town is up.
  const shared = sharedId(location.pathname)
  let arriving: string | null = null
  const { stage, ui, syncPage, resetPage, visit, visitFailed, visiting } = await createHost(mount, () => persistence, { shared: shared !== null })
  if (shared)
    download(shared).then(
      (text) => (arriving = text),
      (error: unknown) => visitFailed(error instanceof Error ? error.message : "Could not open that town")
    )
  const clock = { deltaSeconds: STEP_SECONDS, elapsed: 0 }

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
  const made = Game.Runtime.make({
    services: Game.Runtime.services(
      Game.Runtime.service(Ui, ui),
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
    resources: blankResources()
  })
  if (!made.ok) {
    mount.textContent = `The town could not start: ${JSON.stringify(made.error)}`
    return
  }
  const runtime = made.value
  // In development, the page's console can reach the town: `town.ui.edits.push(...)`,
  // `town.runtime.snapshot()`, and `town.advance(seconds)` to fast-forward the simulation.
  if (import.meta.env.DEV) {
    const advance = (seconds: number) => {
      for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) runtime.tick(simulate)
    }
    Object.assign(window, { town: { ui, runtime, advance, view: stage } })
  }

  // Saves are Effect programs over the browser's storage and this town (see `save.ts`);
  // loading validates every component before touching the world.
  const world: World["Service"] = {
    snapshot: () => runtime.snapshot(),
    restore: (data) => {
      const restored = runtime.restore(data as never)
      if (restored.ok) resetPresentation()
      return restored.ok ? null : restored.error._tag
    },
    title: () => {
      const s = ui.stats
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
    const s = ui.stats
    if (!s || s.fate.state !== "playing" || ui.founding || visiting()) return
    if (s.minute < autosaved) autosaved = 0
    if (s.minute < autosaved + AUTOSAVE_MINUTES) return
    autosaved = Math.floor(s.minute / AUTOSAVE_MINUTES) * AUTOSAVE_MINUTES
    const saved = run(save("auto"))
    if (saved._tag === "Failure") ui.toast(describe(saved.failure))
  }

  /** A shared town has just loaded and not yet been drawn. */
  let settling = false
  const loop = FixedLoop.start({
    source: FixedLoop.source((onTick) => stage.subscribe(onTick)),
    stepSeconds: STEP_SECONDS,
    maxFrameSeconds: 0.25,
    maxStepsPerFrame: 4,
    // The town runs at the chosen speed; it waits while paused, while the
    // new-town dialog is open, and once the term has ended (an edit, such as
    // founding a new town, still gets its step).
    update: () => {
      if (arriving !== null && ui.edits.length === 0) {
        const text = arriving
        arriving = null
        arrive(text)
        settling = true
      }
      // The town's numbers are still the old town's until the next frame draws the new one: wait for them.
      if (settling) return Result.success(undefined)
      if (ui.edits.some((edit) => edit.type === "newTown")) {
        resetPresentation()
        stage.resetCamera()
      }
      const waiting = ui.speed === 0 || ui.founding || (ui.stats !== null && ui.stats.fate.state !== "playing")
      const steps = waiting ? (ui.edits.length > 0 ? 1 : 0) : ui.speed
      for (let i = 0; i < steps; i++) {
        const stepped = runtime.tick(simulate)
        if (!stepped.ok) return stepped
      }
      return Result.success(undefined)
    },
    render: ({ elapsedSeconds }) => {
      clock.deltaSeconds = elapsedSeconds
      clock.elapsed += elapsedSeconds
      const shown = runtime.tick(present)
      if (!shown.ok) throw new Error(`The town view stopped: ${JSON.stringify(shown.error)}`)
      settling = false
      syncPage()
      autosave()
    },
    onFailure: (failure) => {
      mount.textContent =
        failure.kind === "InvalidTickDelta" ? `Invalid frame delta: ${failure.deltaMS}` : "The town stopped after a system failure."
    }
  })
  if (!loop.ok) mount.textContent = `Invalid fixed-loop option: ${loop.error.field}`
}

void start()

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
