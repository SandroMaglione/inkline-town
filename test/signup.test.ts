/**
 * The sign-up for the next Typeonce game (`src/ui/dom/brand/signup-rules.ts`):
 * when it may show (never once signed up; not within a day of a close), what
 * this device keeps of it and that it never touches a save, the moment it
 * comes (the town's first spring), and that nothing is sent from anywhere
 * but typeonce.games, while the made-up answer there gives every state.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import {
  fakeOutcome,
  firstSpring,
  liveHost,
  outcomeOf,
  parseMemory,
  readMemory,
  remember,
  SIGNUP_KEY,
  SIGNUP_QUIET_MS,
  signupAllowed,
  subscribe,
  SUBSCRIBE_URL,
  type SignupStorage
} from "../src/ui/dom/brand/signup-rules.ts"

const now = Date.UTC(2026, 10, 19, 12)
const hour = 60 * 60 * 1000

test("the sign-up shows when nothing is remembered", () => {
  assert.equal(signupAllowed(null, now), true)
})

test("once signed up, it never shows again", () => {
  assert.equal(signupAllowed({ signedUp: true }, now), false)
  assert.equal(signupAllowed({ signedUp: true }, now + 365 * 24 * hour), false)
})

test("closed less than 24 hours ago, it stays away", () => {
  assert.equal(signupAllowed({ closedAt: now }, now), false)
  assert.equal(signupAllowed({ closedAt: now - hour }, now), false)
  assert.equal(signupAllowed({ closedAt: now - SIGNUP_QUIET_MS + 1 }, now), false)
})

test("closed more than 24 hours ago, it may show again", () => {
  assert.equal(signupAllowed({ closedAt: now - SIGNUP_QUIET_MS }, now), true)
  assert.equal(signupAllowed({ closedAt: now - 25 * hour }, now), true)
  assert.equal(signupAllowed({ closedAt: now - 30 * 24 * hour }, now), true)
})

test("a close stamped days ahead of the clock does not keep it away for ever", () => {
  assert.equal(signupAllowed({ closedAt: now + 2 * hour }, now), false)
  assert.equal(signupAllowed({ closedAt: now + 3 * SIGNUP_QUIET_MS }, now), true)
})

test("what is stored reads back, and anything else reads as nothing", () => {
  assert.deepEqual(parseMemory(JSON.stringify({ signedUp: true })), { signedUp: true })
  assert.deepEqual(parseMemory(JSON.stringify({ closedAt: now })), { closedAt: now })
  for (const junk of [null, "", "{", "null", "3", "[]", '{"signedUp":"yes"}', '{"closedAt":"today"}', "{}"]) assert.equal(parseMemory(junk), null, String(junk))
})

/** A storage in memory, as `localStorage` holds it. */
const memoryStorage = () => {
  const items = new Map<string, string>()
  const storage: SignupStorage = { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) }
  return { items, storage: () => storage }
}

test("the sign-up keeps to its own key, away from the saves", () => {
  const { items, storage } = memoryStorage()
  items.set("inkline-town/save/manual", "the town")
  remember(storage, { closedAt: now })
  assert.equal(SIGNUP_KEY, "inkline-town/signup")
  assert.ok(!SIGNUP_KEY.startsWith("inkline-town/save/"))
  assert.deepEqual([...items.keys()].sort(), ["inkline-town/save/manual", "inkline-town/signup"])
  assert.equal(items.get("inkline-town/save/manual"), "the town")
  assert.deepEqual(readMemory(storage), { closedAt: now })
  remember(storage, { signedUp: true })
  assert.deepEqual(readMemory(storage), { signedUp: true })
})

test("with no storage, nothing throws and the sign-up shows again", () => {
  const broken = (): SignupStorage => {
    throw new Error("SecurityError: storage is off")
  }
  const full: SignupStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError")
    }
  }
  assert.equal(readMemory(broken), null)
  assert.doesNotThrow(() => remember(broken, { signedUp: true }))
  assert.doesNotThrow(() => remember(() => full, { closedAt: now }))
  assert.equal(signupAllowed(readMemory(broken), now), true)
})

test("the card comes when the first winter ends: the spring of year 3", () => {
  assert.equal(firstSpring({ year: 2, winter: true }, { year: 3, winter: false }), true)
  // A frame that steps over the change (a fast town) still sees it.
  assert.equal(firstSpring({ year: 2, winter: false }, { year: 3, winter: false }), true)
  // Not before, not after, not on a town loaded past it, not in a later spring.
  assert.equal(firstSpring({ year: 2, winter: false }, { year: 2, winter: true }), false)
  assert.equal(firstSpring({ year: 3, winter: false }, { year: 3, winter: false }), false)
  assert.equal(firstSpring(null, { year: 3, winter: false }), false)
  assert.equal(firstSpring({ year: 4, winter: true }, { year: 5, winter: false }), false)
})

test("only typeonce.games and its subdomains send for real", () => {
  for (const host of ["typeonce.games", "inkline.typeonce.games", "www.typeonce.games"]) assert.equal(liveHost(host), true, host)
  for (const host of ["localhost", "127.0.0.1", "inkline-town-preview.workers.dev", "typeonce.games.evil.dev", "nottypeonce.games", "inkline.typeonce.dev"])
    assert.equal(liveHost(host), false, host)
})

test("the made-up answer gives every state", () => {
  assert.equal(fakeOutcome("mayor@inkline.town"), "ok")
  assert.equal(fakeOutcome("mayor.inkline.town"), "invalid_email")
  assert.equal(fakeOutcome(""), "invalid_email")
  assert.equal(fakeOutcome("limit@inkline.town"), "rate_limited")
  assert.equal(fakeOutcome("down@inkline.town"), "unavailable")
})

test("away from typeonce.games nothing is sent", async () => {
  const sent: Array<unknown> = []
  const host = {
    hostname: "localhost",
    href: "http://localhost:5232/",
    fakeDelay: 0,
    fetch: async (...args: Parameters<typeof fetch>) => {
      sent.push(args)
      return new Response("{}")
    }
  }
  assert.equal(await subscribe("mayor@inkline.town", host), "ok")
  assert.equal(await subscribe("limit@inkline.town", host), "rate_limited")
  assert.equal(sent.length, 0)
})

test("on typeonce.games the address goes to the endpoint, with the empty trap, and each answer reads right", async () => {
  const sent: Array<{ url: string; init: RequestInit | undefined }> = []
  const answering = (status: number, body: unknown) => ({
    hostname: "inkline.typeonce.games",
    href: "https://inkline.typeonce.games/",
    fetch: async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      sent.push({ url: String(url), init })
      return new Response(JSON.stringify(body), { status })
    }
  })
  assert.equal(await subscribe(" mayor@inkline.town ", answering(200, { ok: true })), "ok")
  assert.equal(sent[0]!.url, SUBSCRIBE_URL)
  assert.equal(sent[0]!.init?.method, "POST")
  assert.deepEqual(JSON.parse(String(sent[0]!.init?.body)), { email: "mayor@inkline.town", game: "inkline-town", referrer: "https://inkline.typeonce.games/", website: "" })
  assert.equal(await subscribe("x", answering(400, { ok: false, error: "invalid_email" })), "invalid_email")
  assert.equal(await subscribe("x@y", answering(400, { ok: false, error: "invalid_request" })), "unavailable")
  assert.equal(await subscribe("x@y", answering(429, { ok: false, error: "rate_limited" })), "rate_limited")
  assert.equal(await subscribe("x@y", answering(502, { ok: false, error: "unavailable" })), "unavailable")
  const offline = { hostname: "inkline.typeonce.games", href: "https://inkline.typeonce.games/", fetch: async () => Promise.reject(new TypeError("Failed to fetch")) }
  assert.equal(await subscribe("x@y", offline), "unavailable")
  assert.equal(outcomeOf("something new"), "unavailable")
})
