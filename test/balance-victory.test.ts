import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { resolveRules } from "../src/rules/config.ts"
import { goalsOf } from "../src/rules/goals.ts"
import { fingerprint } from "../tools/balance/provenance.ts"

for (const from of [1, 2]) test(`generated charter ${1000 + from * 7919} reaches and holds a full win through ordinary edits`, { timeout: 180000 }, () => {
  const directory = mkdtempSync(join(tmpdir(), "inkline-victory-")), file = join(directory, "result.json")
  try {
    const run = spawnSync(process.execPath, ["scripts/balance.ts", "--seeds", "1", "--from", String(from), "--term", "60", "--json", file],
      { encoding: "utf8", timeout: 150000 })
    assert.equal(run.status, 0, run.stderr)
    const report = JSON.parse(readFileSync(file, "utf8")), result = report.results[0], final = result.final, rules = resolveRules()
    assert.equal(report.rulesSha256, fingerprint(rules))
    assert.equal(final.fate.state, "won", run.stdout)
    assert(result.longestGoalHoldSeconds >= rules.fate.hold * 60)
    assert(final.fate.at - final.fate.goalSince >= rules.fate.hold * 60 / rules.stepSeconds)
    assert(goalsOf(final.charter, { settlers: final.census.settlers, citizens: final.census.citizens,
      coins: final.treasury.coins, net: final.ledger.taxes + final.ledger.trade - final.ledger.upkeep - final.ledger.admin,
      approval: final.mood.approval }, rules).every(goal => goal.met))
    console.log(JSON.stringify({ seed: result.seed, state: final.fate.state, minute: result.end.minute,
      holdSeconds: result.longestGoalHoldSeconds, residents: final.census.settlers + final.census.citizens,
      citizens: final.census.citizens, coins: final.treasury.coins, approval: final.mood.approval }))
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
