/** Freeze the approved geometry once. The viewer reads this immutable baseline,
 * rather than importing a second, drifting copy of the old model generators. */
import { gzipSync } from "node:zlib"
import { mkdir, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { proportionModels } from "../src/model-review/proportion-models.ts"
import { assetById } from "../src/asset-lab/assets.ts"

const revision = execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim()
if (revision !== "a2845b4f537dcb2998a58b7fae26783d7de4a1ec") throw new Error("Baseline must be captured from the approved a2845b4 revision")
const data = { revision, models: proportionModels(), walker: assetById.get("settler-cap")! }
await mkdir("public/model-review", {recursive: true})
const compressed = gzipSync(JSON.stringify(data), {level: 9})
await writeFile("public/model-review/proportions-before.json.gz", compressed, {flag: "wx"})
console.log(`Frozen ${data.models.length} models and the unchanged walker: ${Math.round(compressed.length / 1024)} KB`)
