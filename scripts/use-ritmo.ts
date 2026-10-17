/**
 * Points Ritmo packages at an exact source commit or their published npm
 * release, for builds without the sibling repository (CI and previews):
 *
 *   node scripts/use-ritmo.ts && pnpm install --no-frozen-lockfile
 *
 * `ritmoSource` pins the exact commit used by CI and acceptance builds.
 * The helper fetches and builds it under `.repos/ritmo-preview/`, without
 * needing a sibling checkout. Once `ritmoRelease` is published on npm,
 * remove the source pin and run this helper plus install to switch to it.
 * It rewrites package.json; installation updates the lockfile.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const file = new URL("../package.json", import.meta.url)
const pkg = JSON.parse(readFileSync(file, "utf8")) as {
  ritmoRelease?: string
  /** Unpublished engine changes, pinned for CI and preview acceptance builds. */
  ritmoSource?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const version = pkg.ritmoRelease
if (version === undefined) throw new Error("package.json has no ritmoRelease")

// A companion PR can test an unpublished engine commit without changing the
// sibling checkout. Remove this pin once that commit's release is published.
const source = pkg.ritmoSource
let sourcePath: string | undefined
if (source !== undefined) {
  if (!/^[a-f0-9]{40}$/.test(source)) throw new Error("ritmoSource must be a full commit SHA")
  sourcePath = `.repos/ritmo-preview/${source}`
  const checkout = fileURLToPath(new URL(`../${sourcePath}/`, import.meta.url))
  const run = (command: string, args: Array<string>) => execFileSync(command, args, { cwd: checkout, stdio: "inherit" })
  if (!existsSync(`${checkout}.git`)) {
    mkdirSync(checkout, { recursive: true })
    run("git", ["init"])
    run("git", ["remote", "add", "origin", "https://github.com/typeonce-dev/ritmo.git"])
  }
  run("git", ["fetch", "--depth=1", "origin", source])
  run("git", ["checkout", "--detach", source])
  const actual = execFileSync("git", ["rev-parse", "HEAD"], { cwd: checkout, encoding: "utf8" }).trim()
  if (actual !== source) throw new Error(`Ritmo checkout mismatch: ${actual}`)
  run("pnpm", ["install", "--frozen-lockfile"])
  run("pnpm", ["build"])
}

const linked: Array<string> = []
for (const deps of [pkg.dependencies, pkg.devDependencies]) {
  if (deps === undefined) continue
  for (const [name, spec] of Object.entries(deps)) {
    if (name.startsWith("@typeonce/ritmo") && spec.startsWith("link:")) {
      if (sourcePath === undefined) deps[name] = version
      else {
        const packageDir = /\/packages\/([^/]+)$/.exec(spec)?.[1]
        if (packageDir === undefined) throw new Error(`Unrecognized Ritmo link: ${spec}`)
        deps[name] = `link:${sourcePath}/packages/${packageDir}`
      }
      linked.push(name)
    }
  }
}

writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(linked.length === 0 ? "No linked Ritmo packages" : `Ritmo ${source ?? version} from ${source === undefined ? "npm" : "pinned source"}: ${linked.join(", ")}`)
