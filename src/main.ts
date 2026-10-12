/**
 * A town simulation of line-drawn buildings, homes, roads, and land, on the
 * bevy-ts ECS with Pixi drawing it. The simulation runs on a fixed step;
 * the views follow once a frame.
 */
import { Result } from "@typeonce/bevy-ts"
import { Effect } from "effect"
import { FixedLoop } from "@typeonce/bevy-ts-browser"
import { PixiNodeRegistry } from "@typeonce/bevy-ts-pixi"

import type { BuildingView, FieldView, HouseView, RockView, TreeView, WalkerView } from "./art.ts"
import { lands, sizes, STEP_SECONDS } from "./content.ts"
import { createHost, type Persistence } from "./host.ts"
import { present } from "./present.ts"
import { browserStorage, describe, loadLatest, save, Storage, World } from "./save.ts"
import { BuildingNodes, Clock, FieldNodes, Game, HouseNodes, RockNodes, StageService, TreeNodes, Ui, WalkerNodes } from "./schema.ts"
import { blankResources, simulate } from "./sim/index.ts"

/** Minutes of game time between autosaves. */
const AUTOSAVE_MINUTES = 2

const start = async () => {
  const mount = document.getElementById("app")!
  let persistence: Persistence = { save: () => "Not ready", load: () => "Not ready" }
  const { app, stage, ui, syncPage } = await createHost(mount, () => persistence)
  const clock = { deltaSeconds: STEP_SECONDS, elapsed: 0 }

  const made = Game.Runtime.make({
    services: Game.Runtime.services(
      Game.Runtime.service(Ui, ui),
      Game.Runtime.service(Clock, clock),
      Game.Runtime.service(StageService, stage),
      Game.Runtime.service(BuildingNodes, PixiNodeRegistry.make<BuildingView>(stage.objects)),
      Game.Runtime.service(HouseNodes, PixiNodeRegistry.make<HouseView>(stage.objects)),
      Game.Runtime.service(WalkerNodes, PixiNodeRegistry.make<WalkerView>(stage.objects)),
      Game.Runtime.service(TreeNodes, PixiNodeRegistry.make<TreeView>(stage.objects)),
      Game.Runtime.service(RockNodes, PixiNodeRegistry.make<RockView>(stage.objects)),
      Game.Runtime.service(FieldNodes, PixiNodeRegistry.make<FieldView>(stage.plates))
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
    Object.assign(window, { town: { ui, runtime, advance } })
  }

  // Saves are Effect programs over the browser's storage and this town (see `save.ts`);
  // loading validates every component before touching the world.
  const world: World["Service"] = {
    snapshot: () => runtime.snapshot(),
    restore: (data) => {
      const restored = runtime.restore(data as never)
      return restored.ok ? null : restored.error._tag
    },
    title: () => {
      const s = ui.stats
      return s ? `${sizes[s.charter.size].title}, ${lands[s.charter.land].title} land · year ${s.season.year} · ${Math.floor(s.minute)} min in` : "a town"
    }
  }
  const run = <A, E>(program: Effect.Effect<A, E, Storage | World>) =>
    Effect.runSync(Effect.result(program.pipe(Effect.provideService(Storage, browserStorage(localStorage)), Effect.provideService(World, world))))
  persistence = {
    save: () => {
      const saved = run(save("manual"))
      return saved._tag === "Success" ? null : describe(saved.failure)
    },
    load: () => {
      const loaded = run(loadLatest)
      if (loaded._tag === "Failure") return describe(loaded.failure)
      return loaded.success.slot === "auto" ? `Loaded the autosave: ${loaded.success.title}` : `Loaded ${loaded.success.title}`
    }
  }
  /** The page autosaves every `AUTOSAVE_MINUTES` of game time while a term runs. */
  let autosaved = 0
  const autosave = () => {
    const s = ui.stats
    if (!s || s.fate.state !== "playing" || ui.founding) return
    if (s.minute < autosaved) autosaved = 0
    if (s.minute < autosaved + AUTOSAVE_MINUTES) return
    autosaved = Math.floor(s.minute / AUTOSAVE_MINUTES) * AUTOSAVE_MINUTES
    const saved = run(save("auto"))
    if (saved._tag === "Failure") ui.toast(describe(saved.failure))
  }

  const loop = FixedLoop.start({
    source: FixedLoop.source((onTick) => {
      const tick = (ticker: { readonly deltaMS: number }) => onTick(ticker)
      app.ticker.add(tick)
      return { stop: () => app.ticker.remove(tick) }
    }),
    stepSeconds: STEP_SECONDS,
    maxFrameSeconds: 0.25,
    maxStepsPerFrame: 4,
    // The town runs at the chosen speed; it waits while paused, while the
    // new-town dialog is open, and once the term has ended (an edit, such as
    // founding a new town, still gets its step).
    update: () => {
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
      runtime.tick(present)
      syncPage()
      autosave()
    },
    onFailure: (failure) => {
      mount.textContent = failure.kind === "InvalidTickDelta" ? `Invalid frame delta: ${failure.deltaMS}` : "The town stopped after a system failure."
    }
  })
  if (!loop.ok) mount.textContent = `Invalid fixed-loop option: ${loop.error.field}`
}

void start()
