import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { resolveRules } from "../src/rules/config.ts"
import { TOWN_RANK } from "../src/content.ts"
import { fingerprint } from "../tools/balance/provenance.ts"

for (const from of [1, 2]) test(`generated charter ${1000 + from * 7919} reaches the town rank through ordinary edits`, { timeout: 180000 }, () => {
  const directory = mkdtempSync(join(tmpdir(), "inkline-victory-")), file = join(directory, "result.json")
  try {
    const run = spawnSync(process.execPath, ["scripts/balance.ts", "--seeds", "1", "--from", String(from), "--term", "60", "--json", file],
      { encoding: "utf8", timeout: 150000 })
    assert.equal(run.status, 0, run.stderr)
    const report = JSON.parse(readFileSync(file, "utf8")), result = report.results[0], final = result.final, rules = resolveRules()
    assert.equal(report.rulesSha256, fingerprint(rules))
    // The old "complete" town is the town rank: reached (its goals held for `fate.hold`), the term plays on to its end.
    assert(final.fate.rank >= TOWN_RANK, run.stdout)
    assert.notEqual(final.fate.state, "lost", run.stdout)
    console.log(JSON.stringify({ seed: result.seed, state: final.fate.state, rank: final.fate.rank, minute: result.end.minute,
      holdSeconds: result.longestGoalHoldSeconds, residents: final.census.settlers + final.census.citizens,
      citizens: final.census.citizens, coins: final.treasury.coins, approval: final.mood.approval }))
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
