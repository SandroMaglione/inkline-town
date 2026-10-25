/**
 * What `ritmo-devtools lint src/app/lint.ts` checks (`pnpm lint:game`, part
 * of `pnpm check`): the simulation on a debug runtime, and the view's
 * `project` and the renderer's `draw` schedules described without running
 * (they need a page). It lives with the app because it is the one place that
 * knows every layer; the simulation's headless entry stays free of the view
 * and the renderer. Those two load inside `lintTarget`, so the lint treats
 * them as host code and checks only what the simulation loads against the
 * simulation rules in `.oxlintrc.json`.
 */
import { HostClock } from "@typeonce/ritmo"

import type { CharterValue } from "../game/content/index.ts"
import { founding } from "../game/headless.ts"
import { resolveRules } from "../game/rules/config.ts"
import { blankResources, simulate } from "../game/schedule.ts"
import { Edits, Game, Rules } from "../game/schema.ts"

const lintCharter: CharterValue = { size: "small", term: 45, land: "fair", seed: 7 }

export const lintTarget = async () => {
  const [{ draw }, { project }] = await Promise.all([import("../render/three/schedule.ts"), import("../view/schedule.ts")])
  const made = Game.Runtime.make({
    services: Game.Runtime.services(Game.Runtime.service(Edits, founding(lintCharter)), Game.Runtime.service(Rules, resolveRules())),
    resources: blankResources(),
    debug: { hostClock: HostClock.test() }
  })
  if (!made.ok) throw new Error(`The town could not start: ${JSON.stringify(made.error)}`)
  return { runtime: made.value, schedules: { simulate }, describe: { project, draw } }
}
