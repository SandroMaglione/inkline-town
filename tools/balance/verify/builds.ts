import { project } from "../model/project.ts"
import { fromSnapshot } from "../scenario.ts"
import { fixture, pushBuild } from "./fixture.ts"
import type { BuildAction, Inputs } from "../types.ts"

/** All construction uses ordinary player edits and actual costs. No resource injections during the run. */
export const verifyBuilds = (inputs: Inputs, builds: ReadonlyArray<BuildAction>, seconds = 600) => {
  const started = performance.now(), prediction = project(inputs, { seconds, builds }), messages: string[] = []
  const town = fixture(inputs.scenario, inputs.rules)
  town.toast = (message) => messages.push(message)
  const actions = [...builds].sort((a, b) => a.at - b.at)
  const actual: Array<{ second: number; coins: number; residents: number; citizens: number; completed: number }> = []
  let firstCitizenSecond: number | null = null
  for (let second = 0; second <= seconds; second++) {
    while (actions.length > 0 && actions[0]!.at <= second) pushBuild(town, actions.shift()!)
    const snapshot = town.snapshot(), s = fromSnapshot(snapshot)
    const citizens = s.homes.filter((h) => h.tier >= 2).reduce((n, h) => n + h.residents, 0)
    if (citizens > 0 && firstCitizenSecond === null) firstCitizenSecond = second
    if (second % 60 === 0 || second === seconds) actual.push({ second, coins: s.coins, residents: s.homes.reduce((n, h) => n + h.residents, 0), citizens, completed: s.buildings.filter((b) => !b.site).length })
    if (second < seconds) town.run(1)
  }
  return { prediction, actual, firstCitizenSecond, messages, elapsedMs: performance.now() - started,
    errors: actual.map((a) => { const p = prediction.rows.find((p) => p.second === a.second)!; return { second: a.second, coins: p.coins - a.coins, residents: p.residents - a.residents, citizens: p.citizens - a.citizens } }),
    final: fromSnapshot(town.snapshot(), "bootstrap-final"),
    scope: "Authored starting district with paid roads/homes; real construction, production, staffing, prices, service walks and hazards. This is not a generated-map victory test." }
}
