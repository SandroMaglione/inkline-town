import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { build } from "vite"
import { inkAssets } from "../src/asset-lab/assets.ts"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
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
const manifest = []
const loader = new GLTFLoader()
for (const asset of inkAssets) {
  const glb = await exportAsset(asset)
  await writeFile(path.join(output, "models", `${asset.id}.glb`), new Uint8Array(glb))
  await writeFile(path.join(output, "models", `${asset.id}.json`), JSON.stringify(asset, null, 2))
  const imported = await loader.parseAsync(glb, "")
  if(asset.effects&&!imported.scene.getObjectByName(asset.id)?.userData.inklineSurfaceEffects)throw new Error(`${asset.id}: surface state metadata lost on export`)
  if(asset.smokeEffect&&!imported.scene.getObjectByName(asset.id)?.userData.inklineSmokeEffect)throw new Error(`${asset.id}: smoke emitter metadata lost on export`)
  if(asset.fountains?.length&&!imported.scene.getObjectByName(asset.id)?.userData.inklineFountains)throw new Error(`${asset.id}: fountain metadata lost on export`)
  let meshes = 0,
    vertices = 0
  imported.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    meshes++
    const position = object.geometry.getAttribute("position")
    if (!position?.count) throw new Error(`${asset.id}: empty imported mesh`)
    vertices += position.count
    for (const n of position.array) if (!Number.isFinite(n)) throw new Error(`${asset.id}: invalid imported coordinate`)
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshBasicMaterial)) throw new Error(`${asset.id}: ink material lost its unlit shading`)
      material.dispose()
    }
    object.geometry.dispose()
  })
  if (!meshes) throw new Error(`${asset.id}: no imported meshes`)
  manifest.push({
    id: asset.id,
    title: asset.title,
    category: asset.category,
    effects: asset.effects,
    smokeEffect: asset.smokeEffect,
    fountains: asset.fountains,
    glb: `models/${asset.id}.glb`,
    geometry: `models/${asset.id}.json`,
    bytes: glb.byteLength,
    meshes,
    vertices
  })
  console.log(`${asset.id}: ${(glb.byteLength / 1024).toFixed(1)} KB`)
}

await writeFile(path.join(output, "manifest.json"), JSON.stringify({ models: manifest.length, assets: manifest }, null, 2))
for (const [input, directory, filename] of [
  ["asset-lab.html", "viewer", "inkline-3d-study.html"],
  ["map-lab.html", "map-viewer", "inkline-3d-map.html"],
  ["model-review.html", "town-viewer", "inkline-town-model-review.html"],
  ["effects-lab.html", "effects-viewer", "inkline-house-effects.html"],
  ["park-lab.html", "park-viewer", "inkline-park.html"],
  ["service-upgrades.html", "service-viewer", "inkline-service-upgrades.html"]
]) {
  await build({
    configFile: false,
    base: "./",
    build: {
      outDir: path.join(output, directory!),
      cssCodeSplit: false,
      rolldownOptions: { input: input!, output: { codeSplitting: false } }
    }
  })
  let html = await readFile(path.join(output, directory!, input!), "utf8")
  const script = html.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/)
  const style = html.match(/<link[^>]*href="([^"]+\.css)"[^>]*>/)
  if (!script || !style) throw new Error("Could not locate viewer bundle")
  const javascript = await readFile(path.resolve(output, directory!, script[1]!), "utf8")
  const css = await readFile(path.resolve(output, directory!, style[1]!), "utf8")
  html = html.replace(script[0], () => `<script type="module">${javascript.replace(/<\/script/gi, "<\\/script")}</script>`)
  html = html.replace(style[0], () => `<style>${css}</style>`).replace(/<link[^>]*rel="modulepreload"[^>]*>/g, "")
  await writeFile(path.join(output, filename!), html)
  console.log(`Standalone viewer: ${path.join(output, filename!)}`)
}
console.log(`Verified ${manifest.length} GLB exports by reimporting their geometry and unlit materials.`)
