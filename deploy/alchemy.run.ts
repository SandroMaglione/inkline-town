import { fileURLToPath } from "node:url"

import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

// Keep deployment dependencies separate from the browser game.
const rootDir = fileURLToPath(new URL("..", import.meta.url))

// Only production claims the custom domain; previews stay on workers.dev.
const productionDomain = "inkline.typeonce.dev"

/** Shared towns are kept this long, so the bucket stays within the free 10 GB. */
const SHARE_DAYS = 180

export default Alchemy.Stack(
  "inkline-town",
  {
    providers: Cloudflare.providers(),
    // Share deployment state across checkouts through the Cloudflare account.
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage
    // Shared towns: each a gzipped save and its picture (see src/server/handler.ts).
    const shares = yield* Cloudflare.R2.Bucket("Shares", {
      lifecycleRules: [
        {
          id: "forget-old-shares",
          prefix: "towns/",
          deleteObjectsTransition: { condition: { type: "Age", maxAge: 60 * 60 * 24 * SHARE_DAYS } }
        }
      ]
    })
    const game = yield* Cloudflare.Website.Vite("Game", {
      rootDir,
      // The Worker answers only shared towns; every other path is a static file, served without it.
      main: "src/server/worker.ts",
      env: { SHARES: shares },
      assets: { runWorkerFirst: ["/t/*", "/api/*"] },
      ...(stage === "prod" ? { domain: productionDomain } : {})
    })
    return { url: game.url }
  })
)
