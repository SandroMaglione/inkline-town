import { defineConfig } from "vite"

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        game: "index.html",
        gallery: "gallery.html",
        assets: "asset-lab.html",
        map: "map-lab.html",
        models: "model-review.html",
        effects: "effects-lab.html"
      }
    }
  }
})
