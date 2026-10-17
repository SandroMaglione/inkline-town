/**
 * A town with no page: the simulation's runtime, stepped from code. The
 * balance bot, `pnpm check`, and the tests all play the real game through
 * this, pushing the same edits the page does and reading the world through
 * the same snapshots it saves.
 */
import { STEP_SECONDS, type CharterValue } from "../content.ts"
import { resolveRules, type Rules as RuleInputs } from "../rules/config.ts"
import { Game, Rules, Ui } from "../schema.ts"
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

/**
 * What `bevy-ts-devtools lint src/sim/headless.ts` checks (`pnpm lint:game`,
 * part of `pnpm check`): the simulation on a debug runtime, and the page's
 * `present` schedule described without running (it needs the renderer).
 */
export const lintTarget = async () => {
  // Loaded here only: tests and bots that use `headless` never load the renderer.
  const { present } = await import("../present.ts")
  const made = Game.Runtime.make({
    services: Game.Runtime.services(Game.Runtime.service(Ui, blankUi(lintCharter, () => {})), Game.Runtime.service(Rules, resolveRules())),
    resources: blankResources(),
    debug: true
  })
  if (!made.ok) throw new Error(`The town could not start: ${JSON.stringify(made.error)}`)
  return { runtime: made.value, schedules: { simulate }, describe: { present } }
}

export const headless = (charter: CharterValue, options: { readonly toast?: (message: string) => void; readonly rules?: RuleInputs } = {}) => {
  const ui = blankUi(charter, options.toast ?? (() => {}))
  const made = Game.Runtime.make({ services: Game.Runtime.services(Game.Runtime.service(Ui, ui), Game.Runtime.service(Rules, options.rules ?? resolveRules())), resources: blankResources() })
  if (!made.ok) throw new Error(`The town could not start: ${JSON.stringify(made.error)}`)
  const runtime = made.value
  const step = () => {
    const stepped = runtime.tick(simulate)
    if (!stepped.ok) throw new Error(`A step failed: ${JSON.stringify(stepped.error)}`)
  }
  const town = {
    ui,
    /** The runtime itself, for tools (devtools sessions, lints, replays) and type-level checks. */
    runtime,
    /** Runs the town on for `seconds` of game time. */
    run: (seconds: number) => {
      for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) step()
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
