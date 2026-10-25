/**
 * A town with no page: the simulation's runtime, stepped from code. The
 * balance bot, `pnpm check`, and the tests all play the real game through
 * this, pushing the same edits the page does and reading the world through
 * the same snapshots it saves.
 */
import { HostClock } from "@typeonce/ritmo"
import type * as Replay from "@typeonce/ritmo-devtools/Replay"

import { step as simulationStep, type CharterValue } from "./content/index.ts"
import { resolveRules, type Rules as RuleInputs } from "./rules/config.ts"
import { Edits, Game, Rules, Toast } from "./schema.ts"
import { editQueue, type Edit } from "./edits.ts"
import { blankResources, simulate } from "./schedule.ts"

/** A saved world, as plain data. */
export interface Snapshot {
  version: number
  gameVersion: number
  nextEntity: number
  entities: Array<{ id: number; components: Record<string, any> }>
  relations: Record<string, Array<[number, Array<number>]>>
  resources: Record<string, any>
  machines: Record<string, unknown>
}

/** The edit queue of a town about to be founded: one edit founds it on the first step. */
export const founding = (charter: CharterValue) => {
  const edits = editQueue()
  edits.push({ type: "newTown", charter })
  return edits
}

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

export const headless = (charter: CharterValue, options: { readonly toast?: (message: string) => void; readonly rules?: RuleInputs; readonly hostClock?: HostClock.HostClock } = {}) => {
  const edits = founding(charter)
  const made = Game.Runtime.make({ services: Game.Runtime.services(Game.Runtime.service(Edits, edits), Game.Runtime.service(Rules, options.rules ?? resolveRules())), resources: blankResources(), debug: { hostClock: options.hostClock ?? HostClock.test() } })
  if (!made.ok) throw new Error(`The town could not start: ${JSON.stringify(made.error)}`)
  const runtime = made.value
  const step = () => {
    const stepped = runtime.tick(simulate)
    if (!stepped.ok) throw new Error(`A step failed: ${JSON.stringify(stepped.error)}`)
    for (const message of runtime.inspect(Toasts)) town.toast(message)
  }
  const town = {
    /** The edits waiting for the next step: what `edit` pushes to. */
    edits,
    /** Where the town's messages go ("No room there"): `options.toast`, or set it. */
    toast: options.toast ?? ((_message: string) => {}),
    /** The runtime itself, for tools (devtools sessions, lints, replays) and type-level checks. */
    runtime,
    /** Runs the town on for `seconds` of game time. */
    run: (seconds: number) => {
      for (let i = 0; i < Math.round(seconds / simulationStep.dt); i++) step()
    },
    /** Pushes edits, applied on the next step. */
    edit: (...queued: ReadonlyArray<Edit>) => {
      edits.push(...queued)
    },
    /** The world as plain data (a copy: changing it changes nothing until it is restored). */
    snapshot: (): Snapshot => {
      const saved = runtime.snapshot()
      if (!saved.ok) throw new Error(`The town could not be saved: ${JSON.stringify(saved.error)}`)
      return JSON.parse(JSON.stringify(saved.value))
    },
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
