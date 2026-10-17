import { defineConfig } from "vite"

import * as ReplayVitePlugin from "@typeonce/bevy-ts-devtools/ReplayVitePlugin"

import { sharesInDev } from "./src/server/dev.ts"

export default defineConfig({
  // In `pnpm dev`, replays saved in the page land in .replays/ (see PLAYTEST.md).
  plugins: [sharesInDev(), ReplayVitePlugin.plugin()],
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
            proportions: "proportion-review.html",
            effects: "effects-lab.html",
            parks: "park-lab.html",
            services: "service-upgrades.html"
          }
        }
      }
    }
  }
})
