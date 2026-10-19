/**
 * What the view reads off a building or a home, for its panel, its tooltip,
 * and its model alike: why it is not working, how far up it is, and how its
 * risks read.
 */
import { BUILD_TICKS, COMMUTE, kindOrder, kinds, RESTOCK_TICKS, risk, RISK_MAX, step, total, worksNeeded, type Amounts, type GoodId, type Kind, type KindId } from "../game/content/index.ts"
import type { Cause } from "../game/rules/explain.ts"
import { salvageOf, salvageText, withWorks } from "../game/rules/salvage.ts"
import type { Status as StatusValue, GridValue } from "../game/schema.ts"
import { SITE_SHARE } from "../game/schedule.ts"
import { around, key, useAt, type TileLike } from "../game/world/grid.ts"
import { percent } from "./text.ts"

/** How far a kind's work reaches, if it works the land around it. */
export const reachOf = (kind: Kind): number | null => kind.gathers?.radius ?? kind.plants?.radius ?? null

const sourceTitle = { tree: "grown trees", stone: "stone", ore: "ore", field: "ripe fields", water: "water" } as const

/** What a building's crew is short of, for its problem line. */
interface Crewing {
  readonly nearby: number
  readonly crew: "settlers" | "citizens"
}

/** Why a building is not working: in a word or two, why in a line, and what to do; `null` when it is fine. */
export interface Problem extends Cause {
  readonly label: string
}

/** The kind that makes a good, for a fix that builds it. */
const makerOf = (good: GoodId): KindId | undefined => kindOrder.find((id) => kinds[id].recipe?.output === good)

export const problemOf = (kind: Kind, status: StatusValue, growing = false, crewing?: Crewing): Problem | null => {
  switch (status) {
    case "unconnected":
      return { label: "no road", why: "it needs a road at the middle of one of its sides", fix: { text: "lay a road along one of its sides" } }
    case "unstaffed":
      if (crewing && crewing.nearby === 0)
        return { label: "no workers", why: `no ${crewing.crew === "citizens" ? "citizens' (or settlers') homes" : "settlers' cottages"} within ${COMMUTE} road cells`, fix: { text: "lay homes nearer, or a road to homes nearby" } }
      return { label: "no workers", why: "every one nearby already has a job", fix: { text: `lay more homes within ${COMMUTE} road cells` } }
    case "blocked":
      return { label: "full", why: "nowhere to take what it makes", fix: { text: "build a warehouse nearby, or sell the surplus in the [town] panel", build: ["warehouse"] } }
    case "paused":
      return { label: "paused", why: "no workers, a quarter of its upkeep", fix: { text: "resume work below" } }
    case "starved":
      if (kind.gathers?.source === "water")
        return growing
          ? { label: "no fish", why: `the water in reach is fished out: each stretch rests ${Math.round(RESTOCK_TICKS * step.dt)} s after a catch`, fix: { text: "give it a longer shore of its own, or fewer fisheries on this water" } }
          : { label: "no water", why: `no water within ${kind.gathers.radius} cells`, fix: { text: "rebuild it by the shore" } }
      if (kind.gathers && growing && (kind.gathers.source === "stone" || kind.gathers.source === "ore"))
        return { label: "worked out", why: `the worked faces in reach give a little ${kind.gathers.source} now and then`, fix: { text: `build it by fresh rock, or buy ${kind.gathers.source} in the [town] panel` } }
      if (kind.gathers && growing) return { label: "waiting", why: `the ${kind.gathers.source === "tree" ? "trees" : "fields"} in reach are still growing` }
      if (kind.gathers)
        return kind.gathers.source === "tree"
          ? { label: "no trees", why: `no grown trees within ${kind.gathers.radius} cells`, fix: { text: "build a forester nearby: it replants", build: ["forester"] } }
          : { label: `no ${sourceTitle[kind.gathers.source]}`, why: `no ${sourceTitle[kind.gathers.source]} within ${kind.gathers.radius} cells`, fix: { text: "rebuild it nearer" } }
      if (kind.recipe?.input) {
        const maker = makerOf(kind.recipe.input)
        return { label: `no ${kind.recipe.input}`, why: `waiting for ${kind.recipe.input}`, fix: maker ? { text: `build a ${kinds[maker].title.toLowerCase()}, or buy ${kind.recipe.input} in the [town] panel`, build: [maker] } : { text: `buy ${kind.recipe.input} in the [town] panel` } }
      }
      if (kind.service?.service === "goods") return { label: "nothing to hand out", why: "no fish, bread, or cloth here", fix: { text: "fill the store: it takes from storage" } }
      if (kind.service?.service === "repair") return { label: "no planks", why: "nothing to mend with", fix: { text: "build a sawmill", build: ["lumberjack", "sawmill"] } }
      return { label: "waiting", why: "waiting" }
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

/** How a risk reads: "low", "40%", or "high: 85%". */
export const riskText = (value: number) => (value < RISK_MAX * 0.35 ? "ok" : value >= risk.warn ? `high, ${percent(value, RISK_MAX)}` : percent(value, RISK_MAX))

/** What pulling a building or home down would cost and give back, for the bulldozer and the panel. */
export const salvageFor = (cost: Kind["cost"], site: { readonly owed: Amounts } | undefined, works?: { readonly kind: Kind; readonly owed: Amounts; readonly level: number }) => {
  const s = withWorks(salvageOf(cost, site?.owed ?? null), works?.kind ?? {}, works)
  const said = salvageText(s)
  return `${site ? "cancel" : "pull down"}${said ? `: ${said}` : ""}`
}
