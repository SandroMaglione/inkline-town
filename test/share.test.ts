/**
 * Shared towns: the server's routes (`src/server/handler.ts`) over a bucket
 * in memory, and a town carried all the way through them, from one headless
 * town into another, as the page sends and loads it.
 */
import assert from "node:assert/strict"
import { test } from "node:test"
import { gunzipSync, gzipSync } from "node:zlib"

import { Effect } from "effect"

import { fileOf, loadText, memoryStorage, Storage, World } from "../src/save.ts"
import { DAILY_SHARES, handle, memoryBucket, type Env, type Limiter } from "../src/server/handler.ts"
import { checkMeta, ID_PATTERN, newId, pictureType, TOWN_LIMIT } from "../src/share/format.ts"
import { headless, type Headless } from "../src/sim/headless.ts"

const PAGE = `<!doctype html><html><head><title>Inkline Town</title></head><body><div id="app"></div></body></html>`
const ORIGIN = "https://inkline.test"

const setup = () => {
  const bucket = memoryBucket()
  const env: Env = { bucket, assets: { fetch: async () => new Response(PAGE, { headers: { "content-type": "text/html" } }) } }
  const call = async (path: string, init?: RequestInit) => {
    const response = await handle(new Request(`${ORIGIN}${path}`, init), env)
    assert.ok(response, `${path} is a share route`)
    return response
  }
  return { bucket, call }
}

/** A JPEG's first bytes, then anything. */
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3])
const meta = { title: "Inkline Town · The town is complete", description: "Large, fair land · 60-minute term · 581 residents" }

const form = (parts: { town?: Uint8Array; picture?: Uint8Array; meta?: unknown }) => {
  const body = new FormData()
  if (parts.town) body.append("town", new Blob([parts.town as BlobPart]), "town.json.gz")
  if (parts.picture) body.append("picture", new Blob([parts.picture as BlobPart]), "picture")
  if (parts.meta !== undefined) body.append("meta", JSON.stringify(parts.meta))
  return { method: "POST", body }
}

test("a town shared is given back as it was sent, with its picture", async () => {
  const { call } = setup()
  const town = gzipSync(JSON.stringify({ hello: "town" }))
  const made = await call("/api/towns", form({ town, picture: jpeg(), meta }))
  assert.equal(made.status, 201)
  const { id, url } = (await made.json()) as { id: string; url: string }
  assert.match(id, ID_PATTERN)
  assert.equal(url, `${ORIGIN}/t/${id}`)

  const back = await call(`/api/towns/${id}`)
  assert.equal(back.status, 200)
  assert.match(back.headers.get("cache-control")!, /immutable/)
  assert.deepEqual(JSON.parse(gunzipSync(new Uint8Array(await back.arrayBuffer())).toString()), { hello: "town" })

  const picture = await call(`/api/towns/${id}/picture`)
  assert.equal(picture.headers.get("content-type"), "image/jpeg")
  assert.deepEqual(new Uint8Array(await picture.arrayBuffer()), jpeg())
})

test("a shared town's page carries its preview, escaped", async () => {
  const { call } = setup()
  const lines = { title: `Inkline Town · "<b>bold</b>" & co`, description: "Small, rich land" }
  const made = await call("/api/towns", form({ town: gzipSync("{}"), picture: jpeg(), meta: lines }))
  const { id } = (await made.json()) as { id: string }
  const page = await call(`/t/${id}`)
  assert.equal(page.status, 200)
  const html = await page.text()
  assert.match(html, /<title>Inkline Town · &quot;&lt;b&gt;bold&lt;\/b&gt;&quot; &amp; co<\/title>/)
  assert.ok(html.includes(`<meta property="og:image" content="${ORIGIN}/api/towns/${id}/picture" />`))
  assert.ok(html.includes(`<meta name="twitter:card" content="summary_large_image" />`))
  assert.ok(!html.includes("<b>bold</b>"))
  assert.ok(html.includes(`<div id="app"></div>`), "the game's own page, which loads the town")
})

test("what the server will not keep", async () => {
  const { call, bucket } = setup()
  const refused = async (init: RequestInit, status: number) => assert.equal((await call("/api/towns", init)).status, status)
  await refused(form({ town: new TextEncoder().encode("{}"), picture: jpeg(), meta }), 400) // not gzipped
  await refused(form({ town: gzipSync("{}"), picture: new TextEncoder().encode("<svg onload=alert(1)>"), meta }), 400) // not a picture
  await refused(form({ town: gzipSync("{}"), picture: jpeg(), meta: { title: "a\nb", description: "c" } }), 400) // not a line
  await refused(form({ town: gzipSync("{}"), picture: jpeg(), meta: { title: "x".repeat(201), description: "c" } }), 400)
  await refused(form({ town: gzipSync("{}"), picture: jpeg() }), 400)
  const huge = new Uint8Array(TOWN_LIMIT + 1)
  huge.set([0x1f, 0x8b])
  await refused(form({ town: huge, picture: jpeg(), meta }), 413)
  await refused({ method: "GET" }, 405)
  assert.equal(bucket.files.size, 0)
})

test("one visitor may share a few towns a minute, and so many a day", async () => {
  // A stand-in for Cloudflare's binding: two a "minute", counted per key.
  const counts = new Map<string, number>()
  const burst: Limiter = { limit: async ({ key }) => ({ success: (counts.set(key, (counts.get(key) ?? 0) + 1).get(key) ?? 0) <= 2 }) }
  const bucket = memoryBucket()
  const env: Env = { bucket, burst, assets: { fetch: async () => new Response(PAGE) } }
  const share = async (ip: string) => (await handle(new Request(`${ORIGIN}/api/towns`, { ...form({ town: gzipSync("{}"), picture: jpeg(), meta }), headers: { "cf-connecting-ip": ip } }), env))!
  assert.equal((await share("1.1.1.1")).status, 201)
  assert.equal((await share("1.1.1.1")).status, 201)
  const third = await share("1.1.1.1")
  assert.equal(third.status, 429)
  assert.match(((await third.json()) as { error: string }).error, /wait a minute/)
  assert.equal((await share("2.2.2.2")).status, 201, "another visitor is not held up")
  assert.ok(![...bucket.files.keys()].some((key) => key.includes("1.1.1.1")), "no address is kept")

  // The day's count, without the minute's limit.
  const dayBucket = memoryBucket()
  const daily: Env = { bucket: dayBucket, assets: env.assets }
  const again = async () => (await handle(new Request(`${ORIGIN}/api/towns`, { ...form({ town: gzipSync("{}"), picture: jpeg(), meta }), headers: { "cf-connecting-ip": "3.3.3.3" } }), daily))!
  for (let i = 0; i < DAILY_SHARES; i++) assert.equal((await again()).status, 201)
  assert.equal((await again()).status, 429)
  assert.equal([...dayBucket.files.keys()].filter((key) => key.endsWith(".picture")).length, DAILY_SHARES)
})

test("unknown and malformed links", async () => {
  const { call } = setup()
  assert.equal((await call("/api/towns/abcdefgh")).status, 404)
  assert.equal((await call("/api/towns/..%2F..%2Fetc")).status, 404)
  assert.equal((await call("/api/towns/abcdefgh/picture")).status, 404)
  assert.equal((await call("/t/abcdefgh")).status, 404)
  assert.equal((await call("/api/towns/abcdefgh", { method: "DELETE" })).status, 405)
  const env: Env = { bucket: memoryBucket(), assets: { fetch: async () => new Response("") } }
  assert.equal(await handle(new Request(`${ORIGIN}/`), env), null, "the site's own files are not the server's")
  assert.equal(await handle(new Request(`${ORIGIN}/t/NOT-AN-ID`), env), null)
})

test("ids, lines, and picture kinds", () => {
  for (let i = 0; i < 200; i++) assert.match(newId(), ID_PATTERN)
  assert.equal(new Set(Array.from({ length: 1000 }, () => newId())).size, 1000)
  assert.deepEqual(checkMeta(meta), meta)
  assert.equal(checkMeta({ title: "", description: "x" }), null)
  assert.equal(checkMeta("nope"), null)
  assert.equal(pictureType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), "image/png")
  assert.equal(pictureType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp")
  assert.equal(pictureType(new TextEncoder().encode("GIF89a........")), null)
})

const worldOf = (town: Headless): World["Service"] => ({
  snapshot: () => town.snapshot(),
  restore: (data) => {
    try {
      town.restore(data)
      return null
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause)
    }
  },
  title: () => "medium, fair land · year 1 · 3 min in"
})
const runOn = <A, E>(town: Headless, program: Effect.Effect<A, E, Storage | World>) =>
  Effect.runSync(Effect.result(program.pipe(Effect.provideService(Storage, memoryStorage()), Effect.provideService(World, worldOf(town)))))
/** The world as it plays (see save.test.ts on `nextEntity`). */
const playing = (town: Headless) => {
  const { nextEntity: _, ...world } = town.snapshot()
  return JSON.stringify(world)
}

test("a town shared from one page plays on, the same, in another", async () => {
  const { call } = setup()
  const mine = headless({ size: "medium", term: 60, land: "fair", seed: 77 })
  mine.run(180)
  const file = runOn(mine, fileOf("manual"))
  assert.equal(file._tag, "Success")
  const camera = { x: 30, y: 31, zoom: 1.4, heading: 1, elevation: 0.6 }
  const text = JSON.stringify({ ...(file as { success: object }).success, camera })
  const made = await call("/api/towns", form({ town: gzipSync(text), picture: jpeg(), meta }))
  const { id } = (await made.json()) as { id: string }

  const back = gunzipSync(new Uint8Array(await (await call(`/api/towns/${id}`)).arrayBuffer())).toString()
  const theirs = headless({ size: "small", term: 45, land: "rich", seed: 1 })
  const loaded = runOn(theirs, loadText(back))
  assert.equal(loaded._tag, "Success")
  assert.deepEqual(JSON.parse(back).camera, camera)
  assert.equal(playing(theirs), playing(mine))
  mine.run(60)
  theirs.run(60)
  assert.equal(playing(theirs), playing(mine), "the shared town runs on exactly as the original")
})

test("a shared file that is not a town is refused, and the town is left alone", () => {
  const town = headless({ size: "small", term: 45, land: "fair", seed: 3 })
  const before = playing(town)
  const refused = runOn(town, loadText(JSON.stringify({ format: "inkline-town/save", version: 6, slot: "manual", savedAt: 0, title: "x", world: { entities: "no" } })))
  assert.equal(refused._tag, "Failure")
  assert.equal(runOn(town, loadText("not json"))._tag, "Failure")
  assert.equal(playing(town), before)
})
