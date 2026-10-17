/**
 * A town with no page: the simulation's runtime, stepped from code. The
 * balance bot, `pnpm check`, and the tests all play the real game through
 * this, pushing the same edits the page does and reading the world through
 * the same snapshots it saves.
 */
import { HostClock } from "@typeonce/ritmo"
import type * as Replay from "@typeonce/ritmo-devtools/Replay"

import { step as simulationStep, type CharterValue } from "../content.ts"
import { resolveRules, type Rules as RuleInputs } from "../rules/config.ts"
import { Edits, Game, Rules, Toast } from "../schema.ts"
import { emptyPreview, type Edit, type UiValue } from "../ui.ts"
import { blankResources, simulate } from "./index.ts"

/** A saved world, as plain data. */
export interface Snapshot {
  version: number
  nextEntity: number
  entities: Array<{ id: number; components: Record<string, any> }>
  relations: Record<string, Array<[number, Array<number>]>>
  resources: Record<string, any>
  machines: Record<string, string>
}

/** The page's UI state before anything is clicked, with one edit founding the town. */
const blankUi = (charter: CharterValue, toast: (message: string) => void): UiValue => ({
  tool: "select", placing: null, upgrading: null, ground: "lawn", prop: "lamp", menu: null, pointer: null, dragFrom: null, selected: null, gestures: [], guide: [],
  edits: [{ type: "newTown", charter }],
  preview: emptyPreview(), hits: [], panel: null, centres: new Map(), stats: null, speed: 1, founding: false,
  view: "none", overlay: { key: "", cells: [] }, tints: new Map(), wanted: new Map(), legend: null, flash: null,
  toast
})

const lintCharter: CharterValue = { size: "small", term: 45, land: "fair", seed: 7 }

/** The simulation's input from a page: each step takes the edits queued since the last. */
export const editsOf = (ui: Pick<UiValue, "edits">) => ({ snapshot: (): ReadonlyArray<Edit> => ui.edits.splice(0) })

/** The toasts the last step emitted (an inspector: it reads, and does not hold, the stream). */
const Toasts = Game.Inspector("Town/Toasts", { events: { toast: Game.System.readEvent(Toast) } }, ({ events }) => events.toast.all())

/**
 * The simulation on a debug runtime fed by a replay (see `Replay.session` and
 * `pnpm replay`): the recorded edits instead of a page's.
 */
export const replayTarget = (playback: Replay.Playback) => {
  // A test clock: every timing reads 0, so a replay's text output is the same on every run.
  const hostClock = HostClock.test()
  const made = Game.Runtime.make({
    services: Game.Runtime.services(Game.Runtime.service(Edits, playback.source(Edits)), Game.Runtime.service(Rules, resolveRules())),
    resources: blankResources(),
    debug: { hostClock }
  })
  if (!made.ok) throw new Error(`The town could not start: ${JSON.stringify(made.error)}`)
  return { runtime: made.value, schedules: { simulate }, hostClock }
}

/**
 * What `ritmo-devtools lint src/sim/headless.ts` checks (`pnpm lint:game`,
 * part of `pnpm check`): the simulation on a debug runtime, and the page's
 * `present` schedule described without running (it needs the renderer).
 */
export const lintTarget = async () => {
  // Loaded here only: tests and bots that use `headless` never load the renderer.
  const { present } = await import("../present.ts")
  const made = Game.Runtime.make({
    services: Game.Runtime.services(Game.Runtime.service(Edits, editsOf(blankUi(lintCharter, () => {}))), Game.Runtime.service(Rules, resolveRules())),
    resources: blankResources(),
    debug: { hostClock: HostClock.test() }
  })
  if (!made.ok) throw new Error(`The town could not start: ${JSON.stringify(made.error)}`)
  return { runtime: made.value, schedules: { simulate }, describe: { present } }
}

export const headless = (charter: CharterValue, options: { readonly toast?: (message: string) => void; readonly rules?: RuleInputs; readonly hostClock?: HostClock.HostClock } = {}) => {
  const toast = options.toast ?? (() => {})
  const ui = blankUi(charter, toast)
  const made = Game.Runtime.make({ services: Game.Runtime.services(Game.Runtime.service(Edits, editsOf(ui)), Game.Runtime.service(Rules, options.rules ?? resolveRules())), resources: blankResources(), debug: { hostClock: options.hostClock ?? HostClock.test() } })
  if (!made.ok) throw new Error(`The town could not start: ${JSON.stringify(made.error)}`)
  const runtime = made.value
  const step = () => {
    const stepped = runtime.tick(simulate)
    if (!stepped.ok) throw new Error(`A step failed: ${JSON.stringify(stepped.error)}`)
    for (const message of runtime.inspect(Toasts)) toast(message)
  }
  const town = {
    ui,
    /** The runtime itself, for tools (devtools sessions, lints, replays) and type-level checks. */
    runtime,
    /** Runs the town on for `seconds` of game time. */
    run: (seconds: number) => {
      for (let i = 0; i < Math.round(seconds / simulationStep.dt); i++) step()
    },
    /** Pushes edits, applied on the next step. */
    edit: (...edits: ReadonlyArray<Edit>) => {
      ui.edits.push(...edits)
    },
    /** The world as plain data (a copy: changing it changes nothing until it is restored). */
    snapshot: (): Snapshot => JSON.parse(JSON.stringify(runtime.snapshot())),
    /** Loads a world, validating everything in it. */
    restore: (snapshot: unknown) => {
      const restored = runtime.restore(snapshot)
      if (!restored.ok) throw new Error(`The town could not be loaded: ${JSON.stringify(restored.error)}`)
    },
    /** Changes the world through a snapshot, as a load would. */
    change: (f: (snapshot: Snapshot) => void) => {
      const snapshot = town.snapshot()
      f(snapshot)
      town.restore(snapshot)
    }
  }
  step()
  return town
}
export type Headless = ReturnType<typeof headless>
