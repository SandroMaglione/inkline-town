/** Record the approved park geometry before rebuilding the furnishings. */
import { gzipSync } from "node:zlib"
import { mkdir, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { parkReviewModels } from "../src/model-review/park-models.ts"
import { assetById } from "../src/asset-lab/assets.ts"

const revision=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
if(revision!=="f4df9d5f9e1ff74552e5a29a3366ec9f541bb3bd")throw new Error("Capture parks from the approved proportion revision")
const data={revision,models:parkReviewModels(),walker:assetById.get("settler-cap")!}
await mkdir("public/model-review",{recursive:true})
const bytes=gzipSync(JSON.stringify(data),{level:9})
await writeFile("public/model-review/parks-before.json.gz",bytes,{flag:"wx"})
console.log(`Frozen ${data.models.length} park examples: ${Math.round(bytes.length/1024)} KB`)
