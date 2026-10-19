/**
 * What a building kind is: its ids, categories, and roles, the shape of its
 * upgrades, and how a building reads its kind once upgraded. The kinds
 * themselves live one file per category beside this one.
 */
import { Clock } from "@typeonce/ritmo"
import { step } from "../clock.ts"
import type { GoodId } from "../goods.ts"

export type Category = "storage" | "gathering" | "crafts" | "food" | "services"
export const categoryOrder: ReadonlyArray<Category> = ["storage", "gathering", "crafts", "food", "services"]

/** Awnings are coloured by what a building is for. */
export const categoryColor: Readonly<Record<Category, number>> = {
  storage: 0x8a58a8,
  gathering: 0x6e8f36,
  crafts: 0xd27a34,
  food: 0xd6ae2e,
  services: 0x3d6db5
}
export const homeColor = 0xc4523f

/** What a gatherer takes from the land around it. */
export type Source = "tree" | "stone" | "ore" | "field" | "water"
export const serviceIds = ["goods", "faith", "fire", "health", "order", "repair"] as const
export type ServiceId = (typeof serviceIds)[number]
/** Native crews: surplus citizens can also do rough work; settlers learn skilled jobs as apprentices. */
export type Crew = "settlers" | "citizens"

export type Topper = "none" | "chimney" | "flag" | "cupola" | "sails" | "crates"

export const kindIds = [
  "townhall", "warehouse", "lumberjack", "forester", "quarry", "mine", "fishery", "sawmill",
  "smithy", "farm", "mill", "bakery", "sheep", "weaver", "market", "chapel",
  "granary", "smokehouse", "firewatch", "healer", "hospital", "watchhouse", "builder", "carpenter"
] as const
export type KindId = (typeof kindIds)[number]

export interface Kind {
  readonly id: KindId
  readonly title: string
  readonly blurb: string
  readonly category: Category
  /** Cells a side. */
  readonly size: 1 | 2 | 3
  // ── Look (see `art.ts`) ──
  /** Half the building's width, in units: its walls stand this far from its centre. */
  readonly half: number
  readonly stories: 1 | 2
  readonly roof: "flat" | "gable"
  /** A flat roof is split into bays × bays squares, each `window` units across but the topper's. */
  readonly bays: 2 | 3
  readonly window: number
  readonly topper: Topper
  // ── Economy ──
  readonly cost: { readonly coins: number; readonly materials: Partial<Record<GoodId, number>> }
  /** Coins a minute while it stands. */
  readonly upkeep: number
  readonly workers: number
  /** Who works it: settlers, or citizens (settlers stand in as apprentices, at a slower pace). */
  readonly crew: Crew
  /** Residents (and of them citizens) the town needs before it can be built. */
  readonly unlock: { readonly residents: number; readonly citizens: number }
  /** In the build menu (the town hall is not). */
  readonly buildable: boolean
  // ── Roles: each one present becomes a component ──
  /** Turns `inputs` of `input` (or nothing, or the land) into `batch` of `output` per job. */
  readonly recipe?: { readonly input: GoodId | null; readonly inputs: number; readonly output: GoodId; readonly batch: number; readonly seconds: number }
  /** A gatherer's job needs this within `radius` cells of its footprint. */
  readonly gathers?: { readonly source: Source; readonly radius: number }
  /** Plants trees or fields within `radius`, one every `seconds`, up to `max` at once. */
  readonly plants?: { readonly what: "tree" | "field"; readonly radius: number; readonly seconds: number; readonly max: number }
  /** Holds goods: every good (storage), or just some (a market). */
  readonly holds?: { readonly accepts: ReadonlyArray<GoodId> | "all"; readonly cap: number }
  /** Carriers it sends out at once. */
  readonly carriers?: number
  /** Sends a walker down the roads every `seconds`, `range` cells out. */
  readonly service?: { readonly service: ServiceId; readonly seconds: number; readonly range: number }
  // ── Its neighbourhood ──
  /** What it does to the desirability of the cells around it, fading out to `reach` cells (see `appeal.ts`). */
  readonly appeal?: { readonly value: number; readonly reach: number; readonly full?: number }
  /** Uses up a tool every `wear` jobs, and works at half pace without one. */
  readonly wear?: number
  /** Ovens and forges: a fire risk to itself and to homes beside it. */
  readonly hot?: boolean
  /** Dust: a health risk to homes nearby. */
  readonly dusty?: boolean
  /** A storage that keeps food this many times longer. */
  readonly keeps?: number
  /**
   * What it becomes when upgraded where it stands, once the town has reached
   * `rank` (see `ranks`), and (`next`) what that becomes in turn: its coins
   * paid when the works begin, its materials carried to it while it goes on
   * working (see `Works`). Whatever an upgrade gives replaces the kind's own.
   */
  readonly upgrade?: Upgrade
}

/**
 * Some of the kinds, as one category's file lists them: each under its own
 * id (`kinds/index.ts` demands every id be listed once, across the files).
 */
export type Kinds = { readonly [Id in KindId]?: Kind & { readonly id: Id } }

/** A building upgraded where it stands (see `Kind.upgrade`): every field but the first five is what changes. */
export interface Upgrade {
  readonly title: string
  readonly blurb: string
  readonly rank: number
  readonly cost: { readonly coins: number; readonly materials: Partial<Record<GoodId, number>> }
  readonly upkeep: number
  readonly service?: { readonly seconds: number; readonly range: number }
  readonly appeal?: { readonly value: number; readonly reach: number; readonly full?: number }
  /** Workers it takes, and seconds a job (a recipe's). */
  readonly workers?: number
  readonly seconds?: number
  /** What its shelves hold of each good, and the carriers it sends at once. */
  readonly cap?: number
  readonly carriers?: number
  /** Firefighters it sends out at once (a fire watch's). */
  readonly crews?: number
  /** It cuts worked faces at full pace, not a third of it (a quarry's). */
  readonly deep?: boolean
  /** The share of the town hall's administration it saves (the town hall's). */
  readonly admin?: number
  /** The upgrade after this one. */
  readonly next?: Upgrade
}

/** Upgrades a building has had: none, one, or (a town hall) two. */
export type Level = 0 | 1 | 2

/** The upgrade a building at `level` stands as (`undefined`: none), and the one it could have next. */
export const upgradeAt = (kind: Pick<Kind, "upgrade">, level: number): Upgrade | undefined =>
  level <= 0 ? undefined : level === 1 ? kind.upgrade : kind.upgrade?.next
export const nextUpgrade = (kind: Pick<Kind, "upgrade">, level: number): Upgrade | undefined => upgradeAt(kind, level + 1)

/**
 * A kind as a building of it stands once upgraded to `level`: its upkeep,
 * crew, pace, shelves, carriers, walker, and desirability those of its
 * upgrades. Everything that works a building reads it from here.
 */
export const asUpgraded = <K extends Kind>(kind: K, level: number): K => {
  let k: Kind = kind
  for (let l = 1; l <= level; l++) {
    const up = upgradeAt(kind, l)
    if (!up) break
    k = {
      ...k,
      upkeep: up.upkeep,
      workers: up.workers ?? k.workers,
      ...(k.recipe && up.seconds ? { recipe: { ...k.recipe, seconds: up.seconds } } : {}),
      ...(k.holds && up.cap ? { holds: { ...k.holds, cap: up.cap } } : {}),
      ...(up.carriers ? { carriers: up.carriers } : {}),
      ...(k.service && up.service ? { service: { ...k.service, ...up.service } } : {}),
      ...(up.appeal ? { appeal: up.appeal } : {})
    }
  }
  return k as K
}

/** Steps of building work an upgrade takes for each good it is made of: a market hall half a minute, a city hall four. */
export const WORKS_TICKS = Clock.steps(Clock.duration(step, 1.5))
/** The steps of work an upgrade of `total` goods takes. */
export const worksNeeded = (total: number, rules: { readonly worksTicks: number } = { worksTicks: WORKS_TICKS }) => Math.max(1, total) * rules.worksTicks

/** Coins a minute a building of a kind costs at its level of upgrades. */
export const upkeepOf = (kind: Pick<Kind, "upkeep" | "upgrade">, level: number): number => upgradeAt(kind, level)?.upkeep ?? kind.upkeep

/** What a building of a kind cost all told, its upgrades included: what pulling it down gives part of back. */
export const builtCost = (kind: Pick<Kind, "cost" | "upgrade">, level: number): Kind["cost"] => {
  let coins = kind.cost.coins
  const materials: Partial<Record<GoodId, number>> = { ...kind.cost.materials }
  for (let l = 1; l <= level; l++) {
    const up = upgradeAt(kind, l)
    if (!up) break
    coins += up.cost.coins
    for (const [g, n] of Object.entries(up.cost.materials) as Array<[GoodId, number]>) materials[g] = (materials[g] ?? 0) + n
  }
  return { coins, materials }
}

/** No residents needed: what most kinds and park pieces unlock at. */
export const free = { residents: 0, citizens: 0 }
