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

export const SAVE_FORMAT = "inkline-town/save"
/**
 * 2: the charter's towns. 3: neighbourhoods and their dangers (desirability, crews, risks, wear, ruins,
 * winters). Older saves cannot be loaded.
 */
export const SAVE_VERSION = 3

export type Slot = "manual" | "auto"
export const slots: ReadonlyArray<Slot> = ["manual", "auto"]
const keyOf = (slot: Slot) => `inkline-town/save/${slot}`
/** Where the first charter version kept its one save: the world alone, no envelope. */
const LEGACY_KEY = "town/save/charter"

/** A save file. */
export const SaveFile = Schema.Struct({
  format: Schema.Literal(SAVE_FORMAT),
  version: Schema.Int,
  slot: Schema.Literals(["manual", "auto"]),
  /** When it was saved, in milliseconds since the epoch. */
  savedAt: Schema.Int,
  /** What it is, in a line: "medium, fair land · year 2 · 23 min in". */
  title: Schema.String,
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

export type LoadError = NothingSaved | Unreadable | WrongVersion | Rejected | StorageFailed

/** What to tell the mayor. */
export const describe = (error: LoadError | StorageFailed): string => {
  switch (error._tag) {
    case "NothingSaved":
      return error.slot === "auto" ? "No autosave yet" : "Nothing saved yet"
    case "Unreadable":
      return "The save could not be read"
    case "WrongVersion":
      return error.version < SAVE_VERSION ? "That save is from an older version of the game" : "That save is from a newer version of the game"
    case "Rejected":
      return `The save does not fit this game: ${error.reason}`
    case "StorageFailed":
      return `Could not save: ${error.reason}`
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
  readonly snapshot: () => unknown
  /** Restores a world, or says why it will not. */
  readonly restore: (world: unknown) => string | null
  /** The town in a line, for a save's title. */
  readonly title: () => string
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

/** Writes the town to a slot. */
export const save = (slot: Slot) =>
  Effect.gen(function* () {
    const storage = yield* Storage
    const world = yield* World
    const file: SaveFile = {
      format: SAVE_FORMAT,
      version: SAVE_VERSION,
      slot,
      savedAt: yield* Clock.currentTimeMillis,
      title: world.title(),
      world: world.snapshot()
    }
    yield* Effect.try({
      try: () => storage.set(keyOf(slot), JSON.stringify(file)),
      catch: (cause) => new StorageFailed({ slot, reason: cause instanceof Error ? cause.message : String(cause) })
    })
    return file
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
      return { format: SAVE_FORMAT, version: SAVE_VERSION, slot, savedAt: 0, title: "an earlier save", world: parsed } satisfies SaveFile
    }
    const version = (parsed as { version?: unknown } | null)?.version
    if (typeof version === "number" && version !== SAVE_VERSION) return yield* new WrongVersion({ slot, version })
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

/** Loads whichever slot was saved last: the mayor's own save, or the autosave. */
export const loadLatest = Effect.gen(function* () {
  const files = yield* Effect.forEach(slots, (slot) => read(slot).pipe(Effect.option))
  const newest = files
    .flatMap((f) => (f._tag === "Some" ? [f.value] : []))
    .sort((a, b) => b.savedAt - a.savedAt)[0]
  return yield* load(newest?.slot ?? "manual")
})
