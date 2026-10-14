/**
 * Shared towns under `pnpm dev`: the same handler the Worker runs, over a
 * bucket in memory, so sharing works (and is checked) without Cloudflare.
 * Shares last until the dev server stops.
 */
import { readFile } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin, ViteDevServer } from "vite"

import { handle, memoryBucket } from "./handler.ts"

const bodyOf = async (req: IncomingMessage): Promise<Uint8Array<ArrayBuffer> | undefined> => {
  if (req.method === "GET" || req.method === "HEAD") return undefined
  const chunks: Array<Uint8Array> = []
  for await (const chunk of req) chunks.push(chunk as Uint8Array)
  return new Uint8Array(Buffer.concat(chunks))
}

const requestOf = async (req: IncomingMessage): Promise<Request> => {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value)
    else if (Array.isArray(value)) for (const v of value) headers.append(name, v)
  }
  const body = await bodyOf(req)
  return new Request(`http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`, { method: req.method ?? "GET", headers, ...(body ? { body } : {}) })
}

const send = async (res: ServerResponse, response: Response) => {
  res.statusCode = response.status
  response.headers.forEach((value, name) => res.setHeader(name, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}

export const sharesInDev = (): Plugin => ({
  name: "inkline-town:shares",
  apply: "serve",
  configureServer(server: ViteDevServer) {
    const bucket = memoryBucket()
    const assets = {
      fetch: async (request: Request) => {
        const html = await server.transformIndexHtml(new URL(request.url).pathname, await readFile("index.html", "utf8"))
        return new Response(html, { headers: { "content-type": "text/html" } })
      }
    }
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith("/api/") && !req.url?.startsWith("/t/")) return next()
      requestOf(req)
        .then((request) => handle(request, { bucket, assets }))
        .then((response) => (response ? send(res, response) : next()))
        .catch(next)
    })
  }
})
