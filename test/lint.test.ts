/**
 * The project lint rules (`tools/lint/plugin.mjs`) on a fixture of known
 * violations: each is reported, and ordinary casts are let through.
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const lintFixtures = (): Array<string> => {
  let output = ""
  try {
    output = execFileSync("npx", ["oxlint", "--format", "unix", "tools/lint/fixtures"], { encoding: "utf8" })
  } catch (error) {
    output = error instanceof Error && "stdout" in error && typeof error.stdout === "string" ? error.stdout : ""
  }
  return output.split("\n").flatMap((line) => {
    const match = /fixtures\/([^:]+):(\d+):\d+: .*town\(([a-z-]+)\)/.exec(line)
    return match === null ? [] : [`${match[1]}:${match[2]} ${match[3]}`]
  })
}

test("no-cast-escape reports as never and as unknown as, and nothing else", () => {
  assert.deepEqual(lintFixtures(), ["casts.ts:3 no-cast-escape", "casts.ts:4 no-cast-escape"])
})
