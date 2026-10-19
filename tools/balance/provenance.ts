import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { resolveRules, type Rules } from "../../src/game/rules/config.ts"
import type { Scenario } from "./types.ts"

const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value
export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex")
/** Every TypeScript file under `dir`, at any depth. */
const sources = (dir: string): Array<string> => readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".ts")).map((f) => join(dir, f))

export const provenance = (rules: Rules, scenarios: ReadonlyArray<Scenario>) => {
  const paths = ["src/game/content/index.ts", "src/game/world/grid.ts", "src/game/world/appeal.ts", "tools/balance/catalog.ts", "tools/balance/scenario.ts", "tools/balance/types.ts", ...sources("src/game/rules"), ...sources("src/game/systems"), "src/game/schedule.ts", "src/game/headless.ts", ...readdirSync("tools/balance/model").filter((f) => f.endsWith(".ts")).map((f) => `tools/balance/model/${f}`)].sort()
  return { modelVersion: 2, referencePr: "https://github.com/SandroMaglione/inkline-town/pull/3", referenceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), baselineReferenceSha: "9b7ce7336a18f917a10aa6e21ae32cb57af88643",
    uncommittedSource: execFileSync("git", ["status", "--porcelain", "--", "src", "scripts", "tools/balance"], { encoding: "utf8" }).trim().length > 0,
    rulesSha256: fingerprint(rules), contentSha256: createHash("sha256").update(readFileSync("src/game/content/index.ts")).digest("hex"),
    modelSourceSha256: fingerprint(paths.map((p) => [p, readFileSync(p, "utf8")])), scenarioSha256: scenarios.map((s) => ({ name: s.name, sha256: fingerprint(s) })),
    parametersChanged: fingerprint(rules) !== fingerprint(resolveRules()) }
}
