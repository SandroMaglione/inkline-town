import { defineConfig } from "vite"

import { sharesInDev } from "./src/server/dev.ts"

export default defineConfig({
  plugins: [sharesInDev()],
  environments: {
    // The pages are the client's alone: on deploy, the Worker (src/server/worker.ts) builds as an environment of its own.
    client: {
      build: {
        rolldownOptions: {
          input: {
            game: "index.html",
            gallery: "gallery.html",
            assets: "asset-lab.html",
            map: "map-lab.html",
            models: "model-review.html",
            effects: "effects-lab.html",
            parks: "park-lab.html"
          }
        }
      }
    }
  }
})
