import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { resolveRules, type RulePatch } from "../../src/rules/config.ts"
import { analyze } from "./model/analyze.ts"
import { project } from "./model/project.ts"
import { searchDistricts, searchParameters } from "./model/search.ts"
import { buildScenario, citizensDistrict } from "./catalog.ts"
import { fromSnapshot } from "./scenario.ts"
import { makeReport, markdownReport, htmlReport } from "./report.ts"
import type { Scenario } from "./types.ts"

const args = process.argv.slice(2), command = args[0] ?? "report"
const option = (name: string, fallback?: string) => { const at = args.indexOf(`--${name}`); if (at < 0) return fallback; if (args[at + 1] === undefined || args[at + 1]!.startsWith("--")) throw new Error(`Missing --${name} value`); return args[at + 1]! }
const number = (name: string, fallback: number) => { const n = Number(option(name, String(fallback))); if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --${name}`); return n }
const rules = resolveRules()
const snapshot = option("snapshot")
const load = (): Scenario => {
  if (snapshot) { const save = JSON.parse(readFileSync(snapshot, "utf8")); return fromSnapshot(save.world ?? save, "pr3-bot-minute-30") }
  const name = option("scenario", "zoned")
  if (name === "bootstrap") return buildScenario(rules).scenario
  if (name === "industrial" || name === "zoned") return citizensDistrict(rules, name === "zoned")
  throw new Error(`Unknown scenario: ${name}`)
}
try {
  if (command === "help" || args.includes("--help")) {
    console.log(`Offline balance model\n\n  pnpm balance:model analyze [--scenario zoned|industrial|bootstrap] [--snapshot save.json] [--minutes 10]\n  pnpm balance:model project --scenario bootstrap [--seconds 600]\n  pnpm balance:model search [--homes 8]\n  pnpm balance:model sweep --path kinds.weaver.recipe.seconds --values 4,8,12\n  pnpm balance:model verify [--seeds 16]\n  pnpm balance:model report [--snapshot save.json] [--seeds 32] [--out output/balance-model]\n\nAll commands read shared game rules. Search varies district configurations. Sweep creates immutable hypothetical rules and never writes them to content. Report always uses unchanged shipped parameters.`)
  } else if (command === "analyze") {
    const winter = option("winter")
    if (winter && !["mild", "normal", "hard", "summer"].includes(winter)) throw new Error("Unknown winter")
    console.log(JSON.stringify(analyze({ rules, scenario: load() }, { minutes: number("minutes", 10), ...(winter ? { severity: winter === "summer" ? null : winter as "mild" | "normal" | "hard" } : {}) }), null, 2))
  } else if (command === "project") {
    const s = load(), build = buildScenario(rules)
    console.log(JSON.stringify(project({ rules, scenario: s }, { seconds: number("seconds", 600), ...(s.name === "authored-bootstrap" ? { builds: build.builds } : {}) }), null, 2))
  } else if (command === "search") {
    console.log(JSON.stringify(searchDistricts(rules, number("homes", 8)), null, 2))
  } else if (command === "sweep") {
    const path = option("path"), values = option("values")
    if (!path || !values) throw new Error("Sweep requires --path and --values")
    const candidates: RulePatch[][] = values.split(",").map((value) => [{ path, value: Number(value) }])
    const result = searchParameters({ rules, scenario: load() }, candidates, (a) => a.availableAfterWorkshops.cloth).map(({ patches, analysis, score }) => ({ patches, score, findings: analysis.findings }))
    console.log(JSON.stringify({ hypothetical: true, gameParametersWritten: false, result }, null, 2))
  } else if (command === "verify" || command === "report") {
    const seeds = number("seeds", command === "report" ? 32 : 16)
    if (!Number.isInteger(seeds)) throw new Error("Seeds must be an integer")
    const { verify } = await import("./verify/checks.ts"), { verifyBuilds } = await import("./verify/builds.ts")
    const checks = verify(rules, seeds), { scenario, builds } = buildScenario(rules), construction = verifyBuilds({ rules, scenario }, builds)
    const report = makeReport(rules, checks, construction, snapshot ? load() : undefined)
    const passed = checks.every((c) => c.pass) && construction.firstCitizenSecond !== null && construction.messages.length === 0
    if (command === "verify") console.log(JSON.stringify({ passed, checks, construction: { firstCitizenSecond: construction.firstCitizenSecond, final: construction.actual.at(-1), forecastFirstCitizenSecond: construction.prediction.firstCitizenSecond, errors: construction.errors } }, null, 2))
    else {
      const out = resolve(option("out", "output/balance-model")!)
      mkdirSync(out, { recursive: true })
      writeFileSync(resolve(out, "results.json"), JSON.stringify(report, null, 2) + "\n")
      writeFileSync(resolve(out, "results.md"), markdownReport(report))
      writeFileSync(resolve(out, "results.html"), htmlReport(report))
      console.log(JSON.stringify({ passed, out, rulesSha256: report.provenance.rulesSha256, parametersChanged: report.provenance.parametersChanged,
        analysisElapsedMs: report.analysisElapsedMs, checks: checks.length, firstCitizenSecond: construction.firstCitizenSecond, real: construction.actual.at(-1), predicted: construction.prediction.rows.at(-1) }, null, 2))
    }
    if (!passed) process.exitCode = 1
  } else throw new Error(`Unknown command: ${command}`)
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
