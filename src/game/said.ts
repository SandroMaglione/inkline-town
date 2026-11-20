/**
 * What the simulation says, as data: the news in the chronicle, the
 * messages an edit answers with, why a term ended, and where something
 * happened. The simulation knows no language: it names what happened and
 * with which numbers, and a locale (`src/i18n`) puts each into words when
 * the page shows it. So a town reads in whatever language the mayor picks,
 * a save or a shared town carries no prose, and the headless runs (tests,
 * the balance bot, replays) never load a word.
 *
 * Every union here is tagged, and each locale must word every tag: a new
 * thing to say does not compile until every language says it.
 */
import { Schema as S } from "effect"

import { goodIds, kindIds, landIds, sizeIds, winterIds, type GoodId, type KindId, type PropId } from "./content/index.ts"
import type { Salvage } from "./rules/salvage.ts"

const integer = S.Int
const kind = S.Literals(kindIds)
const good = S.Literals(goodIds)
/** An upgrade a building stands at: its first, or (a town hall's) its second. */
const level = S.Literals([1, 2])

// ── Where ─────────────────────────────────────────────────────────────────

/** How many ways a street is named after its landmark ("Lane", "Street", "Row", …): each locale has this many. */
export const STREET_WAYS = 6

/**
 * Where something happened: the street named after the nearest landmark
 * (`kind`, and which of the `STREET_WAYS` it is called), or `null` for the
 * edge of town. A locale turns it into "Mill Lane" (see `world/places.ts`).
 */
export const Place = S.NullOr(S.Struct({ kind, way: integer }))
export type Place = typeof Place.Type

// ── The chronicle ─────────────────────────────────────────────────────────

/**
 * A line of the chronicle: what happened, with its numbers. `legacy` is a
 * line from a save made before the chronicle was data: its words as they
 * were written, in the language they were written in.
 */
export const Event = S.Union([
  S.TaggedStruct("founded", { size: S.Literals(sizeIds), land: S.Literals(landIds), term: integer }),
  S.TaggedStruct("nextTerm", { term: integer, minutes: integer }),
  // The term: its marks, its dangers, and how it ended.
  S.TaggedStruct("residents", { mark: integer }),
  S.TaggedStruct("treasuryEmpty", {}),
  S.TaggedStruct("uproar", {}),
  S.TaggedStruct("bankrupt", {}),
  S.TaggedStruct("revolt", {}),
  S.TaggedStruct("abandoned", {}),
  S.TaggedStruct("dismissed", { patience: integer }),
  S.TaggedStruct("termOver", { term: integer, rank: integer }),
  S.TaggedStruct("goalsMet", { rank: integer }),
  S.TaggedStruct("rankReached", { rank: integer, reward: integer }),
  // The crown.
  S.TaggedStruct("crownAsks", { amount: integer, good, minutes: S.Number, reward: integer }),
  S.TaggedStruct("crownUnanswered", { amount: integer, good, fine: integer }),
  S.TaggedStruct("crownSent", { amount: integer, good, reward: integer }),
  // The seasons: how much of a catch a winter leaves (percent), and whether homes burn fires through it.
  S.TaggedStruct("winter", { severity: S.Literals(winterIds), year: integer, fishing: integer, heating: S.Boolean }),
  S.TaggedStruct("spring", { year: integer }),
  S.TaggedStruct("winterComing", { severity: S.Literals(winterIds), larder: integer, eats: integer }),
  // Dangers, each somewhere. A fire that is over took `homes` and `buildings` (neither: it was put out).
  S.TaggedStruct("fire", { place: Place }),
  S.TaggedStruct("fireOver", { place: Place, homes: integer, buildings: integer }),
  S.TaggedStruct("sickness", { place: Place }),
  S.TaggedStruct("theftCoins", { place: Place, coins: integer }),
  S.TaggedStruct("theftGoods", { place: Place, good }),
  S.TaggedStruct("derelict", { place: Place }),
  /** A building (`kind`) or a home (`null`) nobody mended. */
  S.TaggedStruct("collapsed", { kind: S.NullOr(kind), place: Place }),
  // The store: food rotted because the town makes more than it eats (`made`), or (`null`) for want of keeping.
  S.TaggedStruct("rotted", { rotted: integer, made: S.NullOr(integer), eaten: integer }),
  S.TaggedStruct("lastRock", { ore: S.Boolean }),
  // Upgrades: works begun on a building to raise it to `level`, and done.
  S.TaggedStruct("worksBegin", { kind, level }),
  S.TaggedStruct("upgraded", { kind, level }),
  S.TaggedStruct("legacy", { text: S.String })
])
export type Event = typeof Event.Type

// ── Why a term ended ──────────────────────────────────────────────────────

/** Why a term ended (see `Fate`): `none` while it is being played. */
export const reasons = ["none", "bankrupt", "revolt", "abandoned", "dismissed", "over"] as const
export type Reason = (typeof reasons)[number]

// ── What an edit answers with ─────────────────────────────────────────────

/** What a town still lacks before it can build something: residents, or citizens among them. */
export type Lock =
  | { readonly _tag: "residents"; readonly needs: number; readonly has: number }
  | { readonly _tag: "citizens"; readonly needs: number; readonly has: number }

/**
 * A message for the player, answering an edit: it was refused (no room, not
 * enough of something), or what it cost and gave back. Never saved: a toast
 * lasts a few seconds.
 */
export type Notice =
  | { readonly _tag: "locked"; readonly kind: KindId; readonly lock: Lock }
  | { readonly _tag: "pieceLocked"; readonly prop: PropId }
  | { readonly _tag: "noRoom" }
  /** Not enough coins, or not enough of a good. */
  | { readonly _tag: "short"; readonly of: GoodId | "coins" }
  | { readonly _tag: "parkFirst" }
  | { readonly _tag: "rockUnworked" }
  | { readonly _tag: "hallStays" }
  | { readonly _tag: "salvageFee"; readonly fee: number }
  /** Pulled down (or, a site, cancelled): what it cost and gave back, and how much of that found no room in storage. */
  | { readonly _tag: "pulledDown"; readonly cancelled: boolean; readonly salvage: Salvage; readonly lost: number }
  | { readonly _tag: "crownSent"; readonly reward: number }
  /** An upgrade the town's rank does not allow yet: the rank it needs. */
  | { readonly _tag: "upgradeBlocked"; readonly kind: KindId; readonly level: 1 | 2; readonly rank: number }
  | { readonly _tag: "worksBegun"; readonly kind: KindId; readonly level: 1 | 2; readonly coins: number; readonly materials: Partial<Record<GoodId, number>> }
