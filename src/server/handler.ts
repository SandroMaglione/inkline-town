/**
 * The server behind shared towns: three routes over a bucket of files.
 *
 * - `POST /api/towns` takes a town (gzipped), its picture, and its lines,
 *   keeps them under a new id, and answers with the link.
 * - `GET /api/towns/:id` and `/api/towns/:id/picture` give them back.
 * - `GET /t/:id` is the game's own page, with the town's picture and lines
 *   written into it for link previews; the page loads the town itself.
 *
 * It is written against the few bucket and asset calls it uses, so the same
 * code runs on Cloudflare (an R2 bucket and the site's assets), under the
 * dev server, and in tests (both in memory).
 */
import { checkMeta, isGzip, newId, ID_PATTERN, PICTURE_LIMIT, pictureType, picturePath, sharePath, TOWN_LIMIT, type ShareMeta } from "../share/format.ts"

/** What the handler needs of an R2 bucket. */
export interface Bucket {
  head(key: string): Promise<{ readonly customMetadata?: Record<string, string> } | null>
  get(key: string): Promise<{ readonly body: ReadableStream; readonly httpMetadata?: { readonly contentType?: string } } | null>
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options: { readonly httpMetadata: { readonly contentType: string }; readonly customMetadata?: Record<string, string> }
  ): Promise<unknown>
}

export interface Env {
  readonly bucket: Bucket
  /** The site's static files: here, its `index.html`. */
  readonly assets: { fetch(request: Request): Promise<Response> }
}

const townKey = (id: string) => `towns/${id}.json.gz`
const pictureKey = (id: string) => `towns/${id}.picture`

/** Shares never change once made, so anything may keep them. */
const FOREVER = "public, max-age=31536000, immutable"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } })
const fail = (status: number, error: string) => json({ error }, status)

const escapeAttr = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** The tags a link preview reads, for a share. */
export const previewTags = (origin: string, id: string, meta: ShareMeta) => {
  const picture = `${origin}${picturePath(id)}`,
    url = `${origin}${sharePath(id)}`
  return [
    ["og:type", "website"],
    ["og:site_name", "Inkline Town"],
    ["og:url", url],
    ["og:title", meta.title],
    ["og:description", meta.description],
    ["og:image", picture],
    ["og:image:width", "1200"],
    ["og:image:height", "630"],
    ["og:image:alt", `${meta.title}: ${meta.description}`],
    ["twitter:card", "summary_large_image"],
    ["twitter:title", meta.title],
    ["twitter:description", meta.description],
    ["twitter:image", picture]
  ]
    .map(([key, value]) => `<meta ${key!.startsWith("og:") ? "property" : "name"}="${key}" content="${escapeAttr(value!)}" />`)
    .concat(`<meta name="description" content="${escapeAttr(meta.description)}" />`)
    .join("\n    ")
}

/** The game's page with a share's preview written into its head (and its title). */
const sharePage = async (request: Request, env: Env, id: string) => {
  const origin = new URL(request.url).origin
  const page = await env.assets.fetch(new Request(`${origin}/`, { headers: { accept: "text/html" } }))
  if (!page.ok) return page
  const html = await page.text()
  const head = await env.bucket.head(townKey(id))
  const meta = head ? checkMeta(head.customMetadata ?? {}) : null
  const written = meta
    ? html
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(meta.title)}</title>`)
        .replace("</head>", `  ${previewTags(origin, id, meta)}\n  </head>`)
    : html
  return new Response(written, {
    status: head ? 200 : 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" }
  })
}

const bytesOf = async (value: FormDataEntryValue | null): Promise<Uint8Array | null> =>
  value !== null && typeof value !== "string" ? new Uint8Array(await value.arrayBuffer()) : null

/** Keeps a new share and answers with its id and link. */
const create = async (request: Request, env: Env) => {
  const length = Number(request.headers.get("content-length") ?? "0")
  if (length > TOWN_LIMIT + PICTURE_LIMIT + 10_000) return fail(413, "That town is too large to share")
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail(400, "Expected a town, a picture, and its lines")
  }
  const town = await bytesOf(form.get("town")),
    picture = await bytesOf(form.get("picture"))
  let meta: ShareMeta | null = null
  try {
    meta = checkMeta(JSON.parse(String(form.get("meta") ?? "")))
  } catch {}
  if (!town || !isGzip(town)) return fail(400, "The town must be gzipped")
  if (town.byteLength > TOWN_LIMIT) return fail(413, "That town is too large to share")
  const type = picture ? pictureType(picture) : null
  if (!picture || !type) return fail(400, "The picture must be a JPEG, PNG, or WebP")
  if (picture.byteLength > PICTURE_LIMIT) return fail(413, "That picture is too large to share")
  if (!meta) return fail(400, "The share's lines are missing or too long")
  // Eight characters from thirty-two: a clash is rare, but look before writing over one.
  let id = newId()
  for (let tries = 0; (await env.bucket.head(townKey(id))) !== null; tries++) {
    if (tries > 4) return fail(500, "Could not find a free id")
    id = newId()
  }
  await env.bucket.put(pictureKey(id), picture, { httpMetadata: { contentType: type } })
  await env.bucket.put(townKey(id), town, {
    httpMetadata: { contentType: "application/gzip" },
    customMetadata: { title: meta.title, description: meta.description }
  })
  const origin = new URL(request.url).origin
  return json({ id, url: `${origin}${sharePath(id)}` }, 201)
}

/** A share's file from the bucket, as it was kept. */
const serve = async (env: Env, key: string, fallbackType: string) => {
  const object = await env.bucket.get(key)
  if (!object) return fail(404, "No town is shared under that link")
  return new Response(object.body, {
    headers: { "content-type": object.httpMetadata?.contentType ?? fallbackType, "cache-control": FOREVER }
  })
}

/** Answers a request for a share, or null when it is not one (the site's files answer those). */
export const handle = async (request: Request, env: Env): Promise<Response | null> => {
  const { pathname } = new URL(request.url)
  if (pathname === "/api/towns" || pathname === "/api/towns/") {
    return request.method === "POST" ? create(request, env) : fail(405, "Share a town with POST")
  }
  const parts = pathname.split("/").filter(Boolean)
  if (parts[0] === "t" && parts.length === 2) {
    if (!ID_PATTERN.test(parts[1]!)) return null
    return request.method === "GET" || request.method === "HEAD" ? sharePage(request, env, parts[1]!) : fail(405, "Read only")
  }
  if (parts[0] === "api" && parts[1] === "towns" && parts.length >= 3) {
    const id = parts[2]!
    if (!ID_PATTERN.test(id)) return fail(404, "No town is shared under that link")
    if (request.method !== "GET" && request.method !== "HEAD") return fail(405, "Read only")
    if (parts.length === 3) return serve(env, townKey(id), "application/gzip")
    if (parts.length === 4 && parts[3] === "picture") return serve(env, pictureKey(id), "image/jpeg")
    return fail(404, "Not found")
  }
  return null
}

/** A bucket in memory, for the dev server and tests. */
export const memoryBucket = (): Bucket & { readonly files: Map<string, { bytes: Uint8Array; type: string; meta: Record<string, string> }> } => {
  const files = new Map<string, { bytes: Uint8Array; type: string; meta: Record<string, string> }>()
  return {
    files,
    head: async (key) => {
      const file = files.get(key)
      return file ? { customMetadata: file.meta } : null
    },
    get: async (key) => {
      const file = files.get(key)
      return file ? { body: new Response(file.bytes.slice()).body!, httpMetadata: { contentType: file.type } } : null
    },
    put: async (key, value, options) => {
      files.set(key, { bytes: new Uint8Array(value).slice(), type: options.httpMetadata.contentType, meta: { ...options.customMetadata } })
    }
  }
}
