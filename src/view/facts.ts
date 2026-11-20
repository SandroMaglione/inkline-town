/**
 * What the view reads off a building or a home, for its panel, its tooltip,
 * and its model alike: why it is not working, how far up it is, and how its
 * risks read. Why a building is not working is data (`Problem`): the model
 * only asks whether there is one, and the panel and the tooltip put it into
 * the words of the language in use (`view.problem` in `i18n`).
 */
import { BUILD_TICKS, kindOrder, kinds, RESTOCK_TICKS, risk, RISK_MAX, step, total, worksNeeded, type Amounts, type Crew, type GoodId, type Kind, type KindId } from "../game/content/index.ts"
import { salvageOf, withWorks } from "../game/rules/salvage.ts"
import type { Status as StatusValue, GridValue } from "../game/schema.ts"
import { SITE_SHARE } from "../game/schedule.ts"
import { around, key, useAt, type TileLike } from "../game/world/grid.ts"
import type { Catalog } from "../i18n/index.ts"

/** How far a kind's work reaches, if it works the land around it. */
export const reachOf = (kind: Kind): number | null => kind.gathers?.radius ?? kind.plants?.radius ?? null

/** What a building's crew is short of, for its problem line. */
interface Crewing {
  readonly nearby: number
  readonly crew: Crew
}

/**
 * Why a building is not working, with the numbers its line is told with:
 * - `unconnected`: no road at the middle of a side;
 * - `noWorkersNear`: no homes of its crew in reach; `workersTaken`: every one nearby has a job;
 * - `full`: nowhere to take what it makes; `paused`;
 * - `fishedOut`: its water rests `seconds` after a catch; `noWater`, `noTrees`, `noSource`: nothing to gather within `radius`;
 * - `workedOut`: only worked faces of rock in reach; `growing`: its trees or fields are young yet;
 * - `noInput`: it waits for a good (`maker`: the kind that makes it, if any);
 * - `nothingToHandOut` (a market), `noPlanks` (a builder's yard), `waiting`; and `onFire`.
 */
export type Problem =
  | { readonly _tag: "unconnected" }
  | { readonly _tag: "workersTaken" }
  | { readonly _tag: "full" }
  | { readonly _tag: "paused" }
  | { readonly _tag: "nothingToHandOut" }
  | { readonly _tag: "noPlanks" }
  | { readonly _tag: "waiting" }
  | { readonly _tag: "onFire" }
  | { readonly _tag: "noWorkersNear"; readonly crew: Crew }
  | { readonly _tag: "fishedOut"; readonly seconds: number }
  | { readonly _tag: "noWater"; readonly radius: number }
  | { readonly _tag: "noTrees"; readonly radius: number }
  | { readonly _tag: "noSource"; readonly source: "stone" | "ore" | "field"; readonly radius: number }
  | { readonly _tag: "workedOut"; readonly source: "stone" | "ore" }
  | { readonly _tag: "growing"; readonly source: "tree" | "field" }
  | { readonly _tag: "noInput"; readonly good: GoodId; readonly maker: KindId | null }

/** The kind that makes a good, for a fix that builds it. */
const makerOf = (good: GoodId): KindId | undefined => kindOrder.find((id) => kinds[id].recipe?.output === good)

/** What a problem would have the town build, first link first (the panel offers the first one the town lacks); none: nothing to build. */
export const problemBuild = (p: Problem): ReadonlyArray<KindId> | undefined => {
  switch (p._tag) {
    case "full":
      return ["warehouse"]
    case "noTrees":
      return ["forester"]
    case "noInput":
      return p.maker ? [p.maker] : undefined
    case "noPlanks":
      return ["lumberjack", "sawmill"]
    case "onFire":
      return ["firewatch"]
    default:
      return undefined
  }
}

/** Why a building is not working, or `null` when it is fine. */
export const problemOf = (kind: Kind, status: StatusValue, growing = false, crewing?: Crewing): Problem | null => {
  switch (status) {
    case "unconnected":
      return { _tag: "unconnected" }
    case "unstaffed":
      return crewing && crewing.nearby === 0 ? { _tag: "noWorkersNear", crew: crewing.crew } : { _tag: "workersTaken" }
    case "blocked":
      return { _tag: "full" }
    case "paused":
      return { _tag: "paused" }
    case "starved": {
      const g = kind.gathers
      if (g?.source === "water") return growing ? { _tag: "fishedOut", seconds: Math.round(RESTOCK_TICKS * step.dt) } : { _tag: "noWater", radius: g.radius }
      if (g && growing) return g.source === "stone" || g.source === "ore" ? { _tag: "workedOut", source: g.source } : { _tag: "growing", source: g.source }
      if (g) return g.source === "tree" ? { _tag: "noTrees", radius: g.radius } : { _tag: "noSource", source: g.source, radius: g.radius }
      if (kind.recipe?.input) return { _tag: "noInput", good: kind.recipe.input, maker: makerOf(kind.recipe.input) ?? null }
      if (kind.service?.service === "goods") return { _tag: "nothingToHandOut" }
      if (kind.service?.service === "repair") return { _tag: "noPlanks" }
      return { _tag: "waiting" }
    }
    default:
      return null
  }
}

/**
 * A tree or field gatherer has young ones within reach: it is waiting on
 * them to grow, not on a forester. A quarry or mine has rocks in reach,
 * worked down to their faces: it is waiting on the next one.
 */
export const growingNear = (grid: GridValue, tile: TileLike, kind: Kind, rocks: ReadonlyMap<number, { readonly ore: boolean }>): boolean => {
  const g = kind.gathers
  if (!g) return false
  // Water in reach, fished out: it rests, and gives again.
  if (g.source === "water") return around(tile, g.radius).some((c) => useAt(grid, c.x, c.y) === "water")
  if (g.source === "stone" || g.source === "ore") return around(tile, g.radius).some((c) => rocks.get(key(c.x, c.y))?.ore === (g.source === "ore"))
  return around(tile, g.radius).some((c) => useAt(grid, c.x, c.y) === g.source)
}

/** How far up a building or home is: a site rises to its frame as materials come in, then the rest of the way. */
export const buildOf = (
  site: { readonly owed: Parameters<typeof total>[0]; readonly total: number } | undefined,
  rising: { readonly ticks: number } | undefined
) => (site ? PLATE_SHARE + (SITE_SHARE - PLATE_SHARE) * delivered(site) : rising ? rising.ticks / BUILD_TICKS : 1)

/** An upgrade under way: the share of its work done (see `Works`), else `null`. */
export const worksShare = (works: { readonly total: number; readonly done: number } | undefined) =>
  works ? Math.min(1, works.done / worksNeeded(works.total)) : null
export const siteShare = (site: { readonly owed: Parameters<typeof total>[0]; readonly total: number } | undefined) =>
  site ? delivered(site) : null

/** A site's plate is marked out the moment it is placed. */
const PLATE_SHARE = 0.12
/** The share of a site's materials that has arrived. */
const delivered = (site: { readonly owed: Parameters<typeof total>[0]; readonly total: number }) =>
  1 - total(site.owed) / Math.max(1, site.total)

/** How a risk reads: "ok", "40%", or "high, 85%". */
export const riskText = (t: Catalog, value: number) => (value < RISK_MAX * 0.35 ? t.view.risk.ok : value >= risk.warn ? t.view.risk.high(share(value, RISK_MAX)) : t.view.risk.some(share(value, RISK_MAX)))
/** A value as a whole share of its most, in percent. */
export const share = (n: number, of: number) => Math.round((n / of) * 100)

/** What pulling a building or home down would cost and give back, for the bulldozer and the panel: amounts as tokens (see `i18n/token.ts`). */
export const salvageFor = (t: Catalog, cost: Kind["cost"], site: { readonly owed: Amounts } | undefined, works?: { readonly kind: Kind; readonly owed: Amounts; readonly level: number }) =>
  t.view.salvage({ cancelled: site !== undefined, salvage: withWorks(salvageOf(cost, site?.owed ?? null), works?.kind ?? {}, works) })
