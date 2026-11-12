import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { build } from "vite"
import { inkAssets } from "../src/render/pixi3d/assets/assets.ts"
import { exportAsset, readGlb } from "../src/render/pixi3d/assets/glb.ts"

const output = path.resolve("output/inkline-3d")
await mkdir(path.join(output, "models"), { recursive: true })
const manifest = []
for (const asset of inkAssets) {
  const glb = await exportAsset(asset)
  await writeFile(path.join(output, "models", `${asset.id}.glb`), new Uint8Array(glb))
  await writeFile(path.join(output, "models", `${asset.id}.json`), JSON.stringify(asset, null, 2))
  // Read back the way any importer would: the root's effect metadata, finite geometry, unlit materials.
  const imported = readGlb(glb), root = imported.nodes.find((node) => node.name === asset.id)
  if(asset.effects&&!root?.extras?.inklineSurfaceEffects)throw new Error(`${asset.id}: surface state metadata lost on export`)
  if(asset.smokeEffect&&!root?.extras?.inklineSmokeEffect)throw new Error(`${asset.id}: smoke emitter metadata lost on export`)
  if(asset.fountains?.length&&!root?.extras?.inklineFountains)throw new Error(`${asset.id}: fountain metadata lost on export`)
  let meshes = 0,
    vertices = 0
  for (const mesh of imported.meshes)
    for (const primitive of mesh.primitives) {
      meshes++
      const position = imported.accessor(primitive.attributes.POSITION!)
      if (!position.length) throw new Error(`${asset.id}: empty imported mesh`)
      vertices += position.length / 3
      for (const n of position) if (!Number.isFinite(n)) throw new Error(`${asset.id}: invalid imported coordinate`)
      if (!imported.materials[primitive.material!]?.extensions?.KHR_materials_unlit) throw new Error(`${asset.id}: ink material lost its unlit shading`)
    }
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
