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

import type { BuildingView, FieldView, HouseView, RockView, RuinView, TreeView, WalkerView } from "../render/pixi3d/views.ts"
import { step } from "../game/content/index.ts"
import { bookkeeping, editQueue } from "../game/edits.ts"
import { resolveRules } from "../game/rules/config.ts"
import { blankResources, settle, simulate } from "../game/schedule.ts"
import { Edits, Game, Rules } from "../game/schema.ts"
import { browserStorage, describe, fileOf, latest, loadLatest, loadText, save, Storage, World, type About } from "../platform/save.ts"
import { download, ShareError, sharedId } from "../platform/share/client.ts"
import { MapInput } from "../render/pixi3d/input.ts"
import { GameScene, type CameraView } from "../render/pixi3d/scene.ts"
import { draw } from "../render/pixi3d/schedule.ts"
import { BuildingNodes, FieldNodes, HouseNodes, RockNodes, RuinNodes, StageService, TreeNodes, WalkerNodes } from "../render/pixi3d/services.ts"
import { thumbnails } from "../render/pixi3d/thumbnails.ts"
import { createDomUi, type Persistence } from "../ui/dom/index.ts"
import { blankInteraction, blankShown } from "../view/contracts.ts"
import { project } from "../view/schedule.ts"
import { Clock, Interaction, Outbox, Shown, Words } from "../view/services.ts"
import { en, load as loadWords, localeOf, pick, say, type Locale, type Words as WordsValue } from "../i18n/index.ts"
import { carriedOver, carryOver, prefer, preferred } from "../platform/language.ts"

/** Minutes of game time between autosaves. */
const AUTOSAVE_MINUTES = 2

/** Fades the loading card out: once the town has drawn its first frame, or when it could not start. */
const loaded = () => {
  const card = document.getElementById("loading")
  if (!card || card.classList.contains("done")) return
  card.classList.add("done")
  setTimeout(() => card.remove(), 400)
}

/**
 * The language the page speaks: English until the chosen one is loaded (so
 * that even a page that cannot start says why in words), then that one.
 */
const words: WordsValue = { current: en }

const start = async () => {
  const mount = document.getElementById("app")!
  // The language: the one chosen before, else the browser's own if the game speaks it, else English. Its catalog is
  // loaded before anything is drawn, so the page never shows one language and then another.
  words.current = await loadWords(pick(preferred(localStorage), navigator.languages))
  document.documentElement.lang = words.current.locale
  const t = words.current
  // The loading card is in the page's own HTML, in English: from here on it is in the language chosen.
  document.querySelector("#loading span")?.replaceChildren(t.page.loading)
  let persistence: Persistence<CameraView> = { save: () => t.page.save.notReady, load: () => ({ loaded: false, said: t.page.save.notReady }), shareFile: () => "" }
  // A shared town's link (`/t/<id>`): fetch it while the page starts, and load it once the town is up.
  const shared = sharedId(location.pathname)
  let arriving: string | null = null
  // A town saved in this browser before: the founding screen offers to carry on with it.
  const last = Effect.runSync(Effect.result(latest.pipe(Effect.provideService(Storage, browserStorage(localStorage)))))
  /** A save in a line, in the page's language: by what it is of, or (a save from before it said) by its own title. */
  const titleOf = (file: { readonly title: string; readonly about?: About }) => (file.about ? t.page.save.title(file.about) : file.title || t.page.save.earlier)
  const saved = last._tag === "Success" && last.success !== null ? { title: titleOf(last.success), savedAt: last.success.savedAt } : null
  // Back from a change of language: the town in play was saved before the page reloaded, and is carried on with.
  let carried = shared === null ? carriedOver(sessionStorage) : null
  // What the player is doing, what the view shows, and the edits waiting for the next step: shared by the UI, the view, and the simulation.
  const interaction = blankInteraction()
  const shown = blankShown()
  const edits = editQueue()
  // The renderer draws into `mount`; the page's UI goes around it, and reaches the map only through `MapPort`.
  const stage = await GameScene.create(mount)
  let input: MapInput | null = null
  const page = createDomUi<CameraView>(
    { interaction, shown, send: edits.push, words },
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
    thumbnails(stage.app.renderer),
    () => persistence,
    { shared: shared !== null, saved, carried: carried !== null, chooseLanguage: (locale) => chooseLanguage(locale) }
  )
  input = new MapInput(stage, interaction, shown, { tapAgain: (to) => page.toast(words.current.page.map.tapAgain[to]), blocked: page.blocked })
  const { syncPage, resetPage, toast, visit, visitFailed, visiting } = page
  if (shared)
    download(shared).then(
      (text) => (arriving = text),
      (error: unknown) => visitFailed(error instanceof ShareError ? say(t.page.share.failed, error.failure) : t.page.share.notOpened)
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
      Game.Runtime.service(Words, words),
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
    mount.textContent = t.page.fatal.start(JSON.stringify(made.error))
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
    Object.assign(window, { town: { interaction, shown, edits, runtime, snapshot, advance, view: stage, words } })
    if (runtime.debug !== undefined) {
      // Loaded in dev only: the production bundle never includes devtools.
      const { attachDevtools } = await import("./devtools.ts")
      attachDevtools({ runtime: { ...runtime, debug: runtime.debug }, fetch: (url, init) => fetch(url, init), wallClock: HostClock.standard, host: window, demo: new URLSearchParams(location.search).has("replay-demo") })
    }
  }

  /** What the town in play is, for a save's title: the land it stands on, and how far in it is. */
  const aboutTown = (): About | null => {
    const s = shown.town.stats
    return s ? { size: s.charter.size, land: s.charter.land, year: s.season.year, minutes: Math.floor(s.minute) } : null
  }
  /** Looks from where a change of language left the camera (as `chooseLanguage` wrote it down); from where a town starts, if that cannot be read. */
  const lookFrom = (camera: string) => {
    try {
      const view: unknown = JSON.parse(camera)
      if (typeof view === "object" && view !== null) return stage.setView({ x: NaN, y: NaN, zoom: NaN, heading: NaN, elevation: NaN, ...view })
    } catch {
      // Not a view: the camera stays where the town put it.
    }
    stage.resetCamera()
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
      const about = aboutTown()
      return about ? t.page.save.title(about) : t.page.save.untitled
    },
    about: () => aboutTown()
  }
  const run = <A, E>(program: Effect.Effect<A, E, Storage | World>) =>
    Effect.runSync(
      Effect.result(program.pipe(Effect.provideService(Storage, browserStorage(localStorage)), Effect.provideService(World, world)))
    )
  persistence = {
    save: () => {
      const saved = run(save("manual"))
      return saved._tag === "Success" ? null : say(t.page.save.trouble, describe(saved.failure))
    },
    load: () => {
      const loaded = run(loadLatest)
      if (loaded._tag === "Failure") return { loaded: false, said: say(t.page.save.trouble, describe(loaded.failure)) }
      return { loaded: true, said: loaded.success.slot === "auto" ? t.page.save.loadedAuto(titleOf(loaded.success)) : t.page.save.loaded(titleOf(loaded.success)) }
    },
    shareFile: (camera) => {
      const file = run(fileOf("manual"))
      if (file._tag === "Failure") throw new ShareError({ _tag: "unpacked" })
      return JSON.stringify({ ...file.success, camera })
    }
  }
  /** Loads the shared town that arrived, once the town the page started with has been founded. */
  const arrive = (text: string) => {
    const loaded = run(loadText(text))
    if (loaded._tag === "Failure") return visitFailed(say(t.page.save.trouble, describe(loaded.failure)))
    const camera = (JSON.parse(text) as { camera?: CameraView }).camera
    if (camera) stage.setView(camera)
    else stage.resetCamera()
    visit(titleOf(loaded.success))
  }
  /**
   * Changes the language. Every label on the page is made in the language it started in, so the page comes back
   * anew in the one chosen: the choice is kept first, then the town in play is saved (the autosave) and marked to
   * be carried on with, looking where the mayor is looking. If the browser will not keep the choice, or the town
   * cannot be saved, nothing changes, and the reason is said. A town being visited comes back from its link.
   */
  const chooseLanguage = (locale: Locale): string | null => {
    const was = localeOf(words.current)
    if (!prefer(localStorage, locale)) return t.page.language.notKept
    if (shown.town.stats !== null && !interaction.founding && !visiting()) {
      const kept = run(save("auto"))
      const carrying = kept._tag === "Success" && carryOver(sessionStorage, JSON.stringify(stage.view()))
      if (!carrying) {
        // The town would be lost: the language stays as it was.
        prefer(localStorage, was)
        return kept._tag === "Failure" ? say(t.page.save.trouble, describe(kept.failure)) : t.page.language.notKept
      }
    }
    location.reload()
    return null
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
    if (saved._tag === "Failure") toast(say(t.page.save.trouble, describe(saved.failure)))
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
      // Back from a change of language, once the town the page started with has been founded: on with the one saved.
      if (carried !== null && edits.queued.length === 0) {
        const camera = carried
        carried = null
        page.carryOn()
        lookFrom(camera)
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
      mount.textContent = failure.kind === "InvalidTickDelta" ? t.page.fatal.frame(failure.deltaMS) : t.page.fatal.stopped
      loaded()
    }
  })
  if (!loop.ok) {
    mount.textContent = t.page.fatal.loop(loop.error.field)
    loaded()
  }
}

start().catch((error: unknown) => {
  document.getElementById("app")!.textContent = words.current.page.fatal.start(error instanceof Error ? error.message : String(error))
  loaded()
})

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
