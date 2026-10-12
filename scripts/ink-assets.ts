import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { build } from "vite"
import { inkAssets } from "../src/asset-lab/assets.ts"
import { exportAsset } from "../src/asset-lab/renderer.ts"

// GLTFExporter uses the browser's FileReader to assemble binary buffers.
// There are no textures here; only readAsArrayBuffer is needed in Node.
class BinaryReader {
  result: ArrayBuffer | null = null
  onloadend: (() => void) | null = null
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    })
  }
}
if (typeof globalThis.FileReader === "undefined") Object.assign(globalThis, { FileReader: BinaryReader })

const output = path.resolve("output/inkline-3d")
await mkdir(path.join(output, "models"), { recursive: true })
for (const asset of inkAssets) {
  const glb = await exportAsset(asset)
  await writeFile(path.join(output, "models", `${asset.id}.glb`), new Uint8Array(glb))
  await writeFile(path.join(output, "models", `${asset.id}.json`), JSON.stringify(asset, null, 2))
  console.log(`${asset.id}: ${(glb.byteLength / 1024).toFixed(1)} KB`)
}

await build({
  configFile: false,
  base: "./",
  build: {
    outDir: path.join(output, "viewer"),
    cssCodeSplit: false,
    rolldownOptions: { input: "asset-lab.html", output: { codeSplitting: false } }
  }
})
let html = await readFile(path.join(output, "viewer", "asset-lab.html"), "utf8")
const script = html.match(/<script[^>]*src="([^\"]+)"[^>]*><\/script>/)
const style = html.match(/<link[^>]*href="([^\"]+\.css)"[^>]*>/)
if (!script || !style) throw new Error("Could not locate the viewer bundle")
const javascript = await readFile(path.resolve(output, "viewer", script[1]!), "utf8")
const css = await readFile(path.resolve(output, "viewer", style[1]!), "utf8")
html = html.replace(script[0], () => `<script type="module">${javascript.replace(/<\/script/gi, "<\\/script")}</script>`)
html = html.replace(style[0], () => `<style>${css}</style>`)
html = html.replace(/<link[^>]*rel="modulepreload"[^>]*>/g, "")
await writeFile(path.join(output, "inkline-3d-study.html"), html)
console.log(`Standalone viewer: ${path.join(output, "inkline-3d-study.html")}`)
