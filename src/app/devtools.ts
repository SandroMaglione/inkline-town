/**
 * Dev builds only (`browser.ts` imports this behind `import.meta.env.DEV`): a
 * replay recorder that keeps the last minute of `simulate` and saves it to
 * `.replays/` (through the dev server, see `vite.config.ts`) when a step
 * fails, when an invariant breaks, or when `\` (backslash) is pressed. The
 * replay is debugged headless (`pnpm replay`). See PLAYTEST.md.
 */
import type { HostClock } from "@typeonce/ritmo"
import { Invariant, Replay } from "@typeonce/ritmo-devtools"
import * as ReplayViteSink from "@typeonce/ritmo-devtools/ReplayViteSink"

import { step } from "../game/content/index.ts"
import { Building, Game, Root, Treasury } from "../game/schema.ts"
import { simulate } from "../game/schedule.ts"

/** The treasury holds a whole number of coins: a NaN or a fraction means some sum went wrong. */
export const CoinsAreWhole = Invariant.fromInspector(Game.Inspector("coins are whole", {
  resources: { treasury: Game.System.readResource(Treasury) }
}, ({ resources }) => {
  const coins = resources.treasury.get().coins
  return Number.isInteger(coins) ? undefined : `the treasury holds ${coins} coins`
}))

/**
 * A rule made to be broken, for trying the replay loop out (`?replay-demo` in
 * the URL): it breaks as soon as the town has ten buildings.
 */
export const FewerThanTenBuildings = Invariant.fromInspector(Game.Inspector("fewer than ten buildings", {
  queries: { buildings: Game.Query({ selection: { building: Game.Query.read(Building) } }) }
}, ({ queries }) => {
  const count = queries.buildings.each().length
  return count < 10 ? undefined : `the town has ${count} buildings (a demo rule: ?replay-demo)`
}))

export interface DevtoolsHost {
  readonly runtime: Replay.Recordable<typeof Game.schema, typeof Root>
  readonly fetch: ReplayViteSink.Options["fetch"]
  /**
   * A wall clock for the recorder: a replay's `savedAt` names its file in
   * `.replays/` (`new Date(savedAt)`), so it must be real time, not the
   * page-relative `performance.now` the runtime's debug timings read.
   */
  readonly wallClock: HostClock.HostClock
  /** The page whose `\` key saves a replay. */
  readonly host: Window
  /** Breaks `FewerThanTenBuildings` on purpose, to try a replay out. */
  readonly demo: boolean
}

export const attachDevtools = (host: DevtoolsHost) => {
  const recorder = Replay.recorder(host.runtime, {
    schedule: simulate,
    name: "simulate",
    keep: 60,
    step,
    sink: ReplayViteSink.make({ fetch: host.fetch, onError: (error) => console.warn("The replay could not reach the dev server", error) }),
    hostClock: host.wallClock,
    saveOn: { failure: true, invariants: host.demo ? [CoinsAreWhole, FewerThanTenBuildings] : [CoinsAreWhole] }
  })
  // A key in place of the old monitor's "Save replay" button; never while typing in a field.
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "\\" || event.repeat) return
    const target = event.target
    if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return
    recorder.save("saved by the player")
  }
  host.host.addEventListener("keydown", onKey)
  return { recorder, dispose: () => host.host.removeEventListener("keydown", onKey) }
}
