import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

// The bevy-ts packages are linked from the sibling repository and consumed as
// TypeScript source, so Vite must be allowed to serve files from there.
const bevyTs = fileURLToPath(new URL("../../bevy-ts", import.meta.url))

export default defineConfig({
  server: { fs: { allow: [".", bevyTs] } }
})
