/**
 * The sign-up's rules, with no page in them, so the tests can hold them to
 * their word (`test/signup.test.ts`):
 *
 * - when it may show: never again once the player has signed up on this
 *   device, and not for a day after they closed it;
 * - what this device remembers of it, under its own key, apart from the saves
 *   (`inkline-town/save/*`): that the player signed up, or when they last closed it;
 * - the moment the town's first winter ends (the spring that starts year 3);
 * - sending the address: only from a typeonce.games address, the one origin
 *   the studio's endpoint answers. Anywhere else (`pnpm dev`, a preview) the
 *   form answers itself and sends nothing.
 *
 * Nothing leaves the page until the player submits, and then only the address,
 * the game, and the page it was sent from.
 */

/** Where this device remembers the sign-up: never under `inkline-town/save/`. */
export const SIGNUP_KEY = "inkline-town/signup"
/** How long a closed sign-up stays away. */
export const SIGNUP_QUIET_MS = 24 * 60 * 60 * 1000

/** What this device remembers: signed up, closed at a time, or nothing. */
export type SignupMemory = { readonly signedUp: true } | { readonly closedAt: number } | null

/** Reads what was stored; anything unreadable counts as nothing. */
export const parseMemory = (text: string | null): SignupMemory => {
  if (text === null) return null
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value !== "object" || value === null) return null
    if ("signedUp" in value && value.signedUp === true) return { signedUp: true }
    if ("closedAt" in value && typeof value.closedAt === "number" && Number.isFinite(value.closedAt)) return { closedAt: value.closedAt }
    return null
  } catch {
    return null
  }
}

/**
 * Whether the sign-up may show at `now` (ms): not once signed up, and not
 * within a day of a close. A close stamped more than a day ahead of the
 * clock (the clock was wound back) does not keep it away for ever.
 */
export const signupAllowed = (memory: SignupMemory, now: number): boolean => {
  if (memory === null) return true
  if ("signedUp" in memory) return false
  const since = now - memory.closedAt
  return since >= SIGNUP_QUIET_MS || since < -SIGNUP_QUIET_MS
}

/** The storage the sign-up uses: `localStorage`, or nothing when the browser keeps none. */
export type SignupStorage = Pick<Storage, "getItem" | "setItem">

/** What `storage` remembers; nothing when it cannot be read. */
export const readMemory = (storage: () => SignupStorage): SignupMemory => {
  try {
    return parseMemory(storage().getItem(SIGNUP_KEY))
  } catch {
    return null
  }
}

/** Remembers `memory`; with no storage, the sign-up simply shows again next time. */
export const remember = (storage: () => SignupStorage, memory: NonNullable<SignupMemory>): void => {
  try {
    storage().setItem(SIGNUP_KEY, JSON.stringify(memory))
  } catch {
    // Private browsing, storage off, or full: nothing to keep it in.
  }
}

/** The town's season, as the page sees it. */
export interface Season {
  readonly year: number
  readonly winter: boolean
}

/**
 * The town's first winter has just ended: the season went from before the
 * spring of year 3 to it. The first year is spared its winter, so the first
 * one ends year 2, and year 3 starts at a third of the first term (minute 15
 * of 45, 20 of 60, 30 of 90). Years count on through later terms, so it
 * comes once a town. A town loaded already past it never sees it.
 */
export const firstSpring = (before: Season | null, now: Season): boolean =>
  before !== null && before.year < 3 && now.year === 3 && !now.winter

// ── Sending ───────────────────────────────────────────────────────────────

/** The studio's sign-up endpoint: it answers only typeonce.games and its subdomains. */
export const SUBSCRIBE_URL = "https://typeonce.games/api/subscribe"
/** The tag the address gets: which game it came from. */
export const SIGNUP_GAME = "inkline-town"

/** How a sign-up went. */
export type Outcome = "ok" | "invalid_email" | "rate_limited" | "unavailable"

/** What the player reads for each outcome, in the studio's words (as on typeonce.games). */
export const OUTCOME_TEXT: Readonly<Record<Outcome, string>> = {
  ok: "Check your inbox to confirm.",
  invalid_email: "That address does not look right.",
  rate_limited: "Too many tries. Wait a minute and try again.",
  unavailable: "That did not go through. Try again."
}

/** Whether `hostname` is typeonce.games or one of its subdomains: the only place a sign-up is really sent from. */
export const liveHost = (hostname: string): boolean => hostname === "typeonce.games" || hostname.endsWith(".typeonce.games")

/**
 * The answer the form gives itself away from typeonce.games, so every state
 * can be tried without sending anything: an address with no "@" is refused,
 * "limit@…" is told to wait, "down@…" finds the service down, and the rest succeed.
 */
export const fakeOutcome = (email: string): Outcome => {
  const address = email.trim()
  if (!address.includes("@")) return "invalid_email"
  if (address.startsWith("limit@")) return "rate_limited"
  if (address.startsWith("down@")) return "unavailable"
  return "ok"
}

/** The endpoint's error, read as an outcome; anything it did not name is "did not go through". */
export const outcomeOf = (error: unknown): Outcome =>
  error === "invalid_email" || error === "rate_limited" ? error : "unavailable"

/** Where the page is and how it reaches the network: `location` and `fetch`, or stand-ins. */
export interface SignupHost {
  readonly hostname: string
  readonly href: string
  readonly fetch: typeof fetch
  /** How long the made-up answer takes, so the sending state shows (ms). */
  readonly fakeDelay?: number
}

/** Signs `email` up for news of the next game, or (away from typeonce.games) pretends to. */
export const subscribe = async (email: string, host: SignupHost): Promise<Outcome> => {
  if (!liveHost(host.hostname)) {
    await new Promise((resolve) => setTimeout(resolve, host.fakeDelay ?? 600))
    return fakeOutcome(email)
  }
  try {
    const response = await host.fetch(SUBSCRIBE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `website` is the endpoint's trap for bots: a person never fills it.
      body: JSON.stringify({ email: email.trim(), game: SIGNUP_GAME, referrer: host.href, website: "" })
    })
    if (response.ok) return "ok"
    const body: unknown = await response.json().catch(() => null)
    return outcomeOf(typeof body === "object" && body !== null && "error" in body ? body.error : null)
  } catch {
    return "unavailable"
  }
}
