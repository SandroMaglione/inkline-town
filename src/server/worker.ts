/**
 * The Cloudflare Worker in front of the game. Only shared towns reach it
 * (`/t/*` and `/api/*`, see `deploy/alchemy.run.ts`); every other request is
 * a static file Cloudflare serves without running it.
 */
import { handle, type Bucket, type Limiter } from "./handler.ts"

interface WorkerEnv {
  readonly SHARES: Bucket
  readonly SHARE_BURST: Limiter
  readonly ASSETS: { fetch(request: Request): Promise<Response> }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const response = await handle(request, { bucket: env.SHARES, burst: env.SHARE_BURST, assets: env.ASSETS })
    return response ?? env.ASSETS.fetch(request)
  }
}
