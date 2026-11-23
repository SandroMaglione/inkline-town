/**
 * Saving and loading a town, as Effect programs. A save is a versioned file
 * (the world as the simulation snapshots it, with a title and when it was
 * saved) in one of two slots: the mayor's own, and the autosave the page
 * writes every few minutes of game time. Loading reads, checks, and
 * restores it, failing with what went wrong: nothing saved, a file that
 * cannot be read, a version this game does not know, or a world the
 * simulation refuses. Where the files live (the browser's storage, or a map
 * in a test) and the world they come from are services.
 */
import { Clock, Context, Effect, Schema } from "effect"

import { goodIds, landIds, sizeIds, TOWN_RANK, TRADE_LOAD } from "../game/content/index.ts"
import { reasons, type Reason } from "../game/said.ts"

export const SAVE_FORMAT = "inkline-town/save"
/**
 * 2: the charter's towns. 3: neighbourhoods and their dangers (desirability, crews, risks, wear, ruins,
 * winters). 4: parks and patrols. 5: the grudge over taxes, and where each piece of news happened.
 * 6: how much of each good may be traded at a collection. 7: the mayor's guide. 8: terms that follow one
 * another, the town's rank, and upgraded buildings.
 * 10: fixed-step Clock values and runtime snapshot format 2. 11: runtime snapshot format 3 (Ritmo 0.13).
 * 12: the chronicle and the term's end as data, not prose (see `game/said.ts`), so a town reads in any language.
 * Version 4 to 11 saves are carried forward (see `carry`); older ones cannot be loaded.
 */
export const SAVE_VERSION = 12

/**
 * Why a term ended, from how a save before 12 said it: each reason began with its own word ("Bankrupt: …",
 * "Term 2 is over; …"). A reason already told as data is left as it is.
 */
const reasonOf = (said: unknown): Reason => {
  if (typeof said !== "string" || said === "") return "none"
  const known = reasons.find((reason) => reason === said)
  if (known) return known
  for (const [word, reason] of [["Bankrupt", "bankrupt"], ["Revolt", "revolt"], ["Abandoned", "abandoned"], ["Dismissed", "dismissed"], ["Term", "over"]] as const)
    if (said.startsWith(word)) return reason
  return "over"
}

/**
 * From 11, what the town said in words becomes data: the term's end by its reason, and each line of the
 * chronicle a `legacy` event that keeps the words it was written in (they cannot be read back into what
 * happened, so they stay in the language they were written; news from here on is in the mayor's).
 */
const unword = (r: Record<string, unknown>) => {
  const fate = r["Town/Fate"]
  if (fate && typeof fate === "object" && "reason" in fate) r["Town/Fate"] = { ...fate, reason: reasonOf(fate.reason) }
  const chronicle = r["Town/Chronicle"] as { lines?: Array<Record<string, unknown>> } | undefined
  if (chronicle && Array.isArray(chronicle.lines))
    r["Town/Chronicle"] = {
      ...chronicle,
      lines: chronicle.lines.map(({ text, ...line }) => ("event" in line ? line : { ...line, event: { _tag: "legacy", text: typeof text === "string" ? text : "" } }))
    }
}

/**
 * Fills in what a save from an earlier version lacks, so a town in progress
 * survives an update: from 10, the runtime's snapshot format 3, which
 * changed only how state machines are saved, and the town has none; from 4, the mood's grudge (none yet) and the news's
 * places (unknown); from 5, trade at full loads, as it was; from 6, the
 * guide from its start (it puts away at once what the town has already
 * done); from 7, its first term, and its rank: a town that was complete
 * (or governed on after) is a town, any other a hamlet that rises as its
 * goals hold. A complete town waiting on its mayor carries on playing;
 * from 8, its water as never fished, its upgrades as the first, its finer
 * homes as rebuilt already, and no furniture anywhere yet, at its first price;
 * from 11, its chronicle and the term's end as data (see `unword`).
 * Anything else is left to the world's own validation.
 */
const carry = (version: number, world: unknown): unknown | null => {
  const carried = carryTo11(version, world)
  if (carried !== null) unword(carried.resources)
  return carried
}

/** A save from 4 to 11 as an 11 save (see `carry`), or `null` when it cannot be carried. */
const carryTo11 = (version: number, world: unknown): { resources: Record<string, unknown> } | null => {
  if (version < 4 || version > 11 || typeof world !== "object" || world === null) return null
  const w = world as { version?: number; scopes?: Record<string, unknown>; resources?: Record<string, unknown>; entities?: Array<{ components?: Record<string, unknown> }> }
  const r = w.resources
  if (!r || typeof r !== "object") return null
  const carried = Object.assign(w, { resources: r })
  if (version === 11) return carried
  // Town never used entity scopes before this format. Its old clock counted
  // the same 60 Hz steps under `tick`; preserve that count exactly.
  if (w.version === 1) { w.version = 2; w.scopes = {} }
  // Format 3 saves a state machine with its fields; the town has no machines, so a format 2 world is the same.
  if (w.version === 2) w.version = 3
  const time = r["Town/Time"]
  if (typeof time === "object" && time !== null && "tick" in time && typeof time.tick === "number") {
    r["Town/Time"] = { step: time.tick, hz: 60, dt: time.tick > 0 ? 1 / 60 : 0 }
  }
  if (version === 9 || version === 10) return carried
  // From 8, water that was never fished, and an upgraded building upgraded once.
  for (const e of Array.isArray(w.entities) ? w.entities : []) {
    const water = e.components?.["Town/Water"]
    if (water && typeof water === "object" && !("fished" in water)) e.components!["Town/Water"] = { fished: -1_000_000 }
    const upgraded = e.components?.["Town/Upgraded"]
    if (upgraded && typeof upgraded === "object" && !("level" in upgraded)) e.components!["Town/Upgraded"] = { level: 1 }
  }
  // From 8 too, furniture: none of it anywhere, at its first price, stores and markets that take it, homes and the census without it.
  const furnish = (o: unknown, furniture = 0) => (o && typeof o === "object" && !("furniture" in o) ? { ...o, furniture } : o)
  for (const e of Array.isArray(w.entities) ? w.entities : []) {
    const c = e.components
    if (!c) continue
    for (const [name, field] of [["Town/Site", "owed"], ["Town/Works", "owed"], ["Town/Inventory", "stock"], ["Town/Roam", "basket"]] as const) {
      const v = c[name] as Record<string, unknown> | undefined
      if (v && typeof v === "object") c[name] = { ...v, [field]: furnish(v[field]) }
    }
    if (c["Town/House"]) c["Town/House"] = furnish(c["Town/House"])
    // Homes rose for nothing before 9: a finer home has had its rebuilding, and rises back into it for nothing if it steps down.
    const tier = (c["Town/House"] as { tier?: unknown } | undefined)?.tier
    if ((tier === 2 || tier === 3) && !("Town/Rebuilt" in c)) c["Town/Rebuilt"] = { tier }
    const inventory = c["Town/Inventory"] as { accepts?: Array<string> } | undefined, kind = (c["Town/Building"] as { kind?: string } | undefined)?.kind
    if (inventory && Array.isArray(inventory.accepts) && !inventory.accepts.includes("furniture")
      && (kind === "market" || goodIds.every((g) => g === "furniture" || inventory.accepts!.includes(g))))
      inventory.accepts = [...inventory.accepts, "furniture"]
  }
  if (r["Town/Census"]) r["Town/Census"] = furnish(r["Town/Census"])
  const market = r["Town/Market"] as { prices?: unknown } | undefined
  if (market && typeof market === "object") r["Town/Market"] = { ...market, prices: furnish(market.prices, 100) }
  const loads = (r["Town/Policy"] as { loads?: Record<string, unknown> } | undefined)?.loads
  if (loads && typeof loads === "object" && !("furniture" in loads)) loads.furniture = TRADE_LOAD
  if (version === 8) return carried
  const fate = r["Town/Fate"] as Record<string, unknown> | undefined
  if (fate && typeof fate === "object" && !("rank" in fate)) {
    const { governing, won, ...rest } = fate
    const complete = rest.state === "won" || governing === true || (typeof won === "number" && won >= 0)
    r["Town/Fate"] = {
      ...rest,
      state: rest.state === "won" ? "playing" : rest.state,
      reason: rest.state === "won" ? "" : rest.reason,
      term: 1,
      began: 0,
      rank: complete ? TOWN_RANK : 0,
      goalSince: -1
    }
  }
  if (version === 7) return carried
  if (!("Town/Guide" in r)) r["Town/Guide"] = { done: [], off: false }
  if (version === 6) return carried
  const policy = r["Town/Policy"]
  if (policy && typeof policy === "object" && !("loads" in policy)) r["Town/Policy"] = { ...policy, loads: Object.fromEntries(goodIds.map((g) => [g, TRADE_LOAD])) }
  if (version === 5) return carried
  const mood = r["Town/Mood"]
  if (mood && typeof mood === "object" && !("grudge" in mood)) r["Town/Mood"] = { ...mood, grudge: 0, memory: 0 }
  const chronicle = r["Town/Chronicle"] as { lines?: Array<Record<string, unknown>> } | undefined
  if (chronicle && Array.isArray(chronicle.lines)) r["Town/Chronicle"] = { ...chronicle, lines: chronicle.lines.map((l) => ({ at: null, ...l })) }
  return carried
}

export type Slot = "manual" | "auto"
export const slots: ReadonlyArray<Slot> = ["manual", "auto"]
const keyOf = (slot: Slot) => `inkline-town/save/${slot}`
/** Where the first charter version kept its one save: the world alone, no envelope. */
const LEGACY_KEY = "town/save/charter"

/**
 * What a save is of, as data: the land it was founded on and how far in it is. The page says it in its own
 * language ("medium, fair land · year 2 · 23 min in"), whichever the town was saved in.
 */
export const About = Schema.Struct({ size: Schema.Literals(sizeIds), land: Schema.Literals(landIds), year: Schema.Int, minutes: Schema.Int })
export type About = typeof About.Type

/** A save file. */
export const SaveFile = Schema.Struct({
  format: Schema.Literal(SAVE_FORMAT),
  version: Schema.Int,
  slot: Schema.Literals(["manual", "auto"]),
  /** When it was saved, in milliseconds since the epoch. */
  savedAt: Schema.Int,
  /**
   * What it is, in a line: "medium, fair land · year 2 · 23 min in", in the language it was saved in; empty for a
   * save from before files had titles. `about` is the same as data, which the page words in the language it is
   * read in; a save from before it had one is listed by its `title`.
   */
  title: Schema.String,
  about: Schema.optionalKey(About),
  world: Schema.Unknown
})
export type SaveFile = typeof SaveFile.Type

const decodeFile = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))
const decodeEnvelope = Schema.decodeUnknownEffect(SaveFile)

// ── What can go wrong ─────────────────────────────────────────────────────

export class NothingSaved extends Schema.TaggedError<NothingSaved>()("NothingSaved", { slot: Schema.String }) {}
export class Unreadable extends Schema.TaggedError<Unreadable>()("Unreadable", { slot: Schema.String, reason: Schema.String }) {}
export class WrongVersion extends Schema.TaggedError<WrongVersion>()("WrongVersion", { slot: Schema.String, version: Schema.Number }) {}
export class Rejected extends Schema.TaggedError<Rejected>()("Rejected", { slot: Schema.String, reason: Schema.String }) {}
export class StorageFailed extends Schema.TaggedError<StorageFailed>()("StorageFailed", { slot: Schema.String, reason: Schema.String }) {}
/** The world refused to be saved: a value its schema could not encode. */
export class Unsaveable extends Schema.TaggedError<Unsaveable>()("Unsaveable", { slot: Schema.String, reason: Schema.String }) {}

export type LoadError = NothingSaved | Unreadable | WrongVersion | Rejected | StorageFailed

/**
 * What went wrong, as the mayor is told it: data, which the page's language
 * puts into words (`page.save.trouble` in `i18n`). A `reason` is the
 * browser's or the simulation's own, as it gave it.
 */
export type Trouble =
  | { readonly _tag: "nothingSaved"; readonly auto: boolean }
  | { readonly _tag: "unreadable" }
  /** A save from another version of the game: an `older` one, or a newer. */
  | { readonly _tag: "wrongVersion"; readonly older: boolean }
  | { readonly _tag: "rejected"; readonly reason: string }
  | { readonly _tag: "storageFailed"; readonly reason: string }
  | { readonly _tag: "unsaveable"; readonly reason: string }

/** What to tell the mayor. */
export const describe = (error: LoadError | StorageFailed | Unsaveable): Trouble => {
  switch (error._tag) {
    case "NothingSaved":
      return { _tag: "nothingSaved", auto: error.slot === "auto" }
    case "Unreadable":
      return { _tag: "unreadable" }
    case "WrongVersion":
      return { _tag: "wrongVersion", older: error.version < SAVE_VERSION }
    case "Rejected":
      return { _tag: "rejected", reason: error.reason }
    case "StorageFailed":
      return { _tag: "storageFailed", reason: error.reason }
    case "Unsaveable":
      return { _tag: "unsaveable", reason: error.reason }
  }
}

// ── Services ──────────────────────────────────────────────────────────────

/** Where save files are kept, by key. */
export class Storage extends Context.Service<Storage, {
  readonly get: (key: string) => string | null
  readonly set: (key: string, value: string) => void
}>()("inkline-town/Storage") {}

/** The town being saved and loaded. */
export class World extends Context.Service<World, {
  /** The world as plain data, or why it could not be saved (Ritmo's `runtime.snapshot()` result). */
  readonly snapshot: () => { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown }
  /** Restores a world, or says why it will not. */
  readonly restore: (world: unknown) => string | null
  /** The town in a line, for a save's title. */
  readonly title: () => string
  /** The same as data (see `About`), when the town has numbers to tell it by. */
  readonly about?: () => About | null
}>()("inkline-town/World") {}

/** The browser's storage (which can throw: full, or blocked). */
export const browserStorage = (store: globalThis.Storage): Storage["Service"] => ({
  get: (key) => store.getItem(key),
  set: (key, value) => store.setItem(key, value)
})

/** Storage in a map, for tests and for running headless. */
export const memoryStorage = (files = new Map<string, string>()): Storage["Service"] & { readonly files: Map<string, string> } => ({
  files,
  get: (key) => files.get(key) ?? null,
  set: (key, value) => {
    files.set(key, value)
  }
})

// ── Saving and loading ────────────────────────────────────────────────────

/** The town as a save file, written nowhere: what a slot keeps, and what a shared town carries. */
export const fileOf = (slot: Slot) =>
  Effect.gen(function* () {
    const world = yield* World
    const snapshot = world.snapshot()
    if (!snapshot.ok) return yield* new Unsaveable({ slot, reason: JSON.stringify(snapshot.error) })
    const about = world.about?.() ?? null
    const file: SaveFile = {
      format: SAVE_FORMAT,
      version: SAVE_VERSION,
      slot,
      savedAt: yield* Clock.currentTimeMillis,
      title: world.title(),
      ...(about ? { about } : {}),
      world: snapshot.value
    }
    return file
  })

/** Writes the town to a slot. */
export const save = (slot: Slot) =>
  Effect.gen(function* () {
    const storage = yield* Storage
    const file = yield* fileOf(slot)
    yield* Effect.try({
      try: () => storage.set(keyOf(slot), JSON.stringify(file)),
      catch: (cause) => new StorageFailed({ slot, reason: cause instanceof Error ? cause.message : String(cause) })
    })
    return file
  })

const carrySave = (slot: Slot, version: number, snapshot: unknown) =>
  Effect.try({
    try: () => carry(version, snapshot),
    catch: (cause) => new Unreadable({ slot, reason: cause instanceof Error ? cause.message : String(cause) })
  })

/** Reads a slot's file, checked, without loading it. A save from before files had envelopes reads as the manual slot. */
export const read = (slot: Slot) =>
  Effect.gen(function* () {
    const storage = yield* Storage
    const raw = yield* Effect.try({
      try: () => storage.get(keyOf(slot)) ?? (slot === "manual" ? storage.get(LEGACY_KEY) : null),
      catch: (cause) => new StorageFailed({ slot, reason: cause instanceof Error ? cause.message : String(cause) })
    })
    if (raw === null) return yield* new NothingSaved({ slot })
    const parsed = yield* decodeFile(raw).pipe(Effect.mapError((e) => new Unreadable({ slot, reason: e.message })))
    // The first charter saves were the world alone.
    if (typeof parsed === "object" && parsed !== null && "entities" in parsed && !("format" in parsed)) {
      const carried = yield* carrySave(slot, 9, parsed)
      return { format: SAVE_FORMAT, version: SAVE_VERSION, slot, savedAt: 0, title: "", world: carried ?? parsed } satisfies SaveFile
    }
    const version = (parsed as { version?: unknown } | null)?.version
    if (typeof version === "number" && version !== SAVE_VERSION) {
      const carried = yield* carrySave(slot, version, (parsed as { world?: unknown }).world)
      if (carried === null) return yield* new WrongVersion({ slot, version })
      const file = yield* decodeEnvelope({ ...(parsed as object), version: SAVE_VERSION, world: carried }).pipe(Effect.mapError((e) => new Unreadable({ slot, reason: e.message })))
      return file
    }
    return yield* decodeEnvelope(parsed).pipe(Effect.mapError((e) => new Unreadable({ slot, reason: e.message })))
  })

/** Loads a slot into the world. */
export const load = (slot: Slot) =>
  Effect.gen(function* () {
    const file = yield* read(slot)
    const world = yield* World
    const refused = world.restore(file.world)
    if (refused !== null) return yield* new Rejected({ slot, reason: refused })
    return file
  })

/** The slot saved last that can still be read (the mayor's own save, or the autosave), without loading it; `null` when there is none. */
export const latest = Effect.gen(function* () {
  const files = yield* Effect.forEach(slots, (slot) => read(slot).pipe(Effect.option))
  return files.flatMap((f) => (f._tag === "Some" ? [f.value] : [])).sort((a, b) => b.savedAt - a.savedAt)[0] ?? null
})

/** Loads whichever slot was saved last: the mayor's own save, or the autosave. */
export const loadLatest = Effect.gen(function* () {
  const newest = yield* latest
  return yield* load(newest?.slot ?? "manual")
})

/**
 * Loads a save file handed over as text (a shared town), checked and
 * carried forward as a load from a slot is, without touching the slots.
 */
export const loadText = (text: string) =>
  load("manual").pipe(Effect.provideService(Storage, memoryStorage(new Map([[keyOf("manual"), text]]))))
