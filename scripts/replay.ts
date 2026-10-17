/**
 * Opens a replay saved in dev play (`.replays/<time>.json`, see PLAYTEST.md)
 * headless, for an agent:
 *
 *   pnpm replay <file>                          replays it, checks the checkpoints, replays twice for determinism, prints the report
 *   pnpm replay <file> --journal <from>-<to>    what happened in those ticks (recorder tick numbers)
 *   pnpm replay <file> --extract <from>-<to> <out.json>
 *                                               cuts those ticks into a small replay with its own start, for a test
 *
 * A replay is a debug artifact: once the bug is in a test, delete the file.
 */
import { readFileSync, writeFileSync } from "node:fs"

import { Replay } from "@typeonce/ritmo-devtools"

import { replayTarget } from "../src/sim/headless.ts"

const [path, flag, range, out] = process.argv.slice(2)
if (path === undefined) {
  console.error("usage: pnpm replay <file> [--journal <from>-<to> | --extract <from>-<to> <out.json>]")
  process.exit(2)
}
const parsed = Replay.parse(JSON.parse(readFileSync(path, "utf8")))
if (!parsed.ok) {
  console.error(`${path}: ${parsed.error._tag === "InvalidReplay" ? parsed.error.message : parsed.error._tag}`)
  process.exit(1)
}
const file = parsed.value
const bounds = (text: string | undefined): { readonly from: number; readonly to: number } => {
  const [from, to] = (text ?? "").split("-").map(Number)
  if (from === undefined || to === undefined || !Number.isInteger(from) || !Number.isInteger(to)) throw new Error(`expected <from>-<to>, got ${text}`)
  return { from, to }
}

console.log(`${path}: ${file.reason}`)
console.log(`ticks ${file.start.tick + 1}-${file.ticks.at(-1)?.tick ?? file.start.tick} of ${file.schedule}, recorded with devtools ${file.library}${file.start.pendingCommands > 0 ? `, ${file.start.pendingCommands} commands pending at the start (may diverge)` : ""}`)

if (flag === "--extract") {
  const extracted = Replay.extract(replayTarget, file, bounds(range))
  if (!extracted.ok) throw new Error(JSON.stringify(extracted.error))
  if (out === undefined) throw new Error("--extract needs an output file")
  writeFileSync(out, `${JSON.stringify(extracted.value)}\n`)
  console.log(`wrote ${out}: ticks ${extracted.value.ticks[0]?.tick}-${extracted.value.ticks.at(-1)?.tick}, starting from the end of tick ${extracted.value.start.tick}`)
} else {
  const opened = Replay.session(replayTarget, file)
  if (!opened.ok) {
    console.error(opened.error._tag === "SchemaMismatch" ? opened.error.message : JSON.stringify(opened.error))
    process.exit(1)
  }
  if (flag === "--journal") {
    const { from, to } = bounds(range)
    opened.value.play({ to })
    const first = opened.value.session.frame() - (to - file.start.tick) + (from - file.start.tick)
    console.log(opened.value.session.journal({ frames: [first, opened.value.session.frame()] }).text)
  } else {
    console.log(opened.value.play().text)
    const verified = Replay.verify(replayTarget, file)
    console.log(verified.ok ? verified.value.text : JSON.stringify(verified.error))
    console.log(opened.value.session.report().text)
  }
}
