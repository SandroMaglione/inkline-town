import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { resolveRules, type Rules } from "../../src/rules/config.ts"
import type { Scenario } from "./types.ts"

const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value
export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex")
export const provenance = (rules: Rules, scenarios: ReadonlyArray<Scenario>) => {
  const paths = ["src/content.ts", "src/grid.ts", "src/appeal.ts", "tools/balance/catalog.ts", "tools/balance/scenario.ts", "tools/balance/types.ts", ...readdirSync("src/rules").filter((f) => f.endsWith(".ts")).map((f) => `src/rules/${f}`), ...readdirSync("src/sim").filter((f) => f.endsWith(".ts")).map((f) => `src/sim/${f}`), ...readdirSync("tools/balance/model").filter((f) => f.endsWith(".ts")).map((f) => `tools/balance/model/${f}`)].sort()
  return { modelVersion: 2, referencePr: "https://github.com/SandroMaglione/inkline-town/pull/3", referenceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), baselineReferenceSha: "9b7ce7336a18f917a10aa6e21ae32cb57af88643",
    uncommittedSource: execFileSync("git", ["status", "--porcelain", "--", "src", "scripts", "tools/balance"], { encoding: "utf8" }).trim().length > 0,
    rulesSha256: fingerprint(rules), contentSha256: createHash("sha256").update(readFileSync("src/content.ts")).digest("hex"),
    modelSourceSha256: fingerprint(paths.map((p) => [p, readFileSync(p, "utf8")])), scenarioSha256: scenarios.map((s) => ({ name: s.name, sha256: fingerprint(s) })),
    parametersChanged: fingerprint(rules) !== fingerprint(resolveRules()) }
}
