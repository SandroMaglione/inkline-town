import { fileURLToPath } from "node:url"

import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

// Keep deployment dependencies separate from the browser game.
const rootDir = fileURLToPath(new URL("..", import.meta.url))

// Only production claims the custom domain; previews stay on workers.dev.
const productionDomain = "inkline.typeonce.dev"

export default Alchemy.Stack(
  "inkline-town",
  {
    providers: Cloudflare.providers(),
    // Share deployment state across checkouts through the Cloudflare account.
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage
    const game = yield* Cloudflare.Website.Vite("Game", {
      rootDir,
      ...(stage === "prod" ? { domain: productionDomain } : {})
    })
    return { url: game.url }
  })
)
