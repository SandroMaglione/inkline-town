/** A home's panel: its household, what it needs and why it lacks it, and its risks and wear. */
import { COMMUTE, condition as wear, CONDITION_MAX, crewOf, home, kinds, RISK_MAX, risk, type KindId, type Need, type Tier } from "../../game/content/index.ts"
import { blockers as blockersOf, causeOf, draggedDown, servicesCause, type InTown, type Served, type Street } from "../../game/rules/explain.ts"
import { shortOf, suppliedTaxOf } from "../../game/rules/households.ts"
import { capacity, met, taxOf } from "../../game/schedule.ts"
import { appealAt, appealParts } from "../../game/world/appeal.ts"
import { doors, key, nearest, reach, type TileLike } from "../../game/world/grid.ts"
import type { Group, Line, Panel } from "../contracts.ts"
import { riskText, salvageFor } from "../facts.ts"
import type { Frame, HouseRow } from "../frame.ts"
import { plain } from "../../i18n/index.ts"
import { percent } from "../text.ts"
import { told } from "./building.ts"

const needIcons = { food: "food", bread: "bread", cloth: "cloth", faith: "faith", furniture: "furniture" } as const

/** Where a home's residents work: the nearest workplace of their crew in reach that has them. */
const workOf = (frame: Frame, tile: TileLike, tier: Tier) => {
  const { grid, buildings } = frame
  const ds = doors(grid, tile)
  if (ds.length === 0) return null
  const roads = reach(grid, ds)
  let best: { kind: KindId; distance: number } | null = null
  for (const { data } of buildings) {
    const kind = kinds[data.building.kind]
    const staff = data.staff
    if (staff.needed === 0 || staff.assigned === 0 || (kind.crew !== crewOf(tier) && !(tier === 1 && staff.apprentices > 0))) continue
    for (const d of doors(grid, data.tile)) {
      const n = roads.distance[key(d.x, d.y)]!
      if (n >= 0 && n <= COMMUTE && (best === null || n < best.distance)) best = { kind: kind.id, distance: n }
    }
  }
  return best
}
/** What the town has of each provision, in storage and on market shelves. */
const inTown = (frame: Frame): InTown => {
  const stock = frame.world.stock
  const sum = { fish: stock.fish, smoked: stock.smoked, bread: stock.bread, cloth: stock.cloth, furniture: stock.furniture }
  for (const { data } of frame.buildings) {
    const inv = data.inventory
    if (!inv || data.service?.service !== "goods" || data.site !== undefined || data.rising !== undefined) continue
    sum.fish += inv.stock.fish
    sum.smoked += inv.stock.smoked
    sum.bread += inv.stock.bread
    sum.cloth += inv.stock.cloth
    sum.furniture += inv.stock.furniture
  }
  return sum
}
/** Which services have a walker that can reach a home: a standing market (or the town hall), and a chapel, within their walks of its door. */
const servedAt = (frame: Frame, tile: TileLike): Served => {
  const { grid, buildings } = frame
  const ds = doors(grid, tile)
  if (ds.length === 0) return { goods: false, faith: false }
  const way = reach(grid, ds)
  const served = { goods: false, faith: false }
  for (const { data } of buildings) {
    const service = data.service
    if (!service || data.site !== undefined || data.rising !== undefined || data.burning !== undefined) continue
    if (service.service !== "goods" && service.service !== "faith") continue
    if (served[service.service]) continue
    const found = nearest(way, doors(grid, data.tile))
    if (found && found.distance < service.range) served[service.service] = true
  }
  return served
}
/**
 * A home, for its panel: its household (who lives there, what it pays, where they work); what it needs, as one
 * checklist with what it lacks now in red and what it lacks to grow in amber, each with its cause; and its risks
 * and wear. Each row is a value; a note only when something wants doing.
 */
export const describeHouse = (frame: Frame, row: HouseRow) => {
  const { cells, approval, rates, t } = frame
  const words = t.view.house
  const h = row.data.house
  const site = row.data.site
  const quiet = (summary: string, line: Line) => ({ h, summary, trouble: false, groups: [{ title: words.household, icon: "homes", lines: [line] }] as Array<Group> })
  if (site) return quiet(words.beingBuilt, { icon: "planks", label: words.builders, value: words.waitingPlank, tone: "warn" })
  if (row.data.closed !== undefined)
    return quiet(words.closed, { icon: "settlers", label: words.closed, value: words.empty, tone: "warn", note: words.closedNote })
  const tile = row.data.tile
  const tier = home.tiers[h.tier]
  const nextTier = h.tier < 3 ? ((h.tier + 1) as Tier) : null
  const there = appealParts(frame.appealSources(), tile)
  const desirability = appealAt(cells, tile.x, tile.y)
  const street: Street = { desirability, parts: there.parts }
  // What would lift the street: as chips where it is the thing to do, in words where it is only the reason.
  const advice = t.view.street.advice(draggedDown(street))
  const r = row.data.risk
  const work = workOf(frame, tile, h.tier)
  const condition = row.data.condition
  const town = inTown(frame)
  const served = servedAt(frame, tile)
  const rate = h.tier === 1 ? rates.settlers : rates.citizens
  const cap = capacity(h, approval, desirability, undefined, rate)
  const whyFewer =
    cap >= tier.residents
      ? undefined
      : row.data.sick !== undefined
        ? words.fewer.sick
        : approval < 0
          ? words.fewer.disapproval
          : desirability < 0
            ? words.fewer.street(plain(t, advice))
            : rate > 100 && capacity(h, approval, desirability) > cap
              ? words.fewer.taxed(rate)
              : words.fewer.needs
  const hungry = h.food <= 0
  const pays = Math.round(taxOf(h, rates, undefined, desirability))
  const could = Math.round(suppliedTaxOf(h, rates, undefined, desirability))
  const household: Array<Line> = [
    ...(row.data.burning !== undefined ? [{ icon: "fire", label: words.onFire, value: words.fled, tone: "bad" } as Line] : []),
    ...(row.data.sick !== undefined ? [{ icon: "health", label: words.sick, value: words.halved, tone: "bad", note: words.sickNote } as Line] : []),
    { icon: "people", label: words.residents, value: words.living(h.residents, cap), tone: whyFewer ? "warn" : "ok", note: whyFewer },
    {
      icon: "coins",
      label: words.pays,
      value: words.paying(pays),
      tone: hungry ? "bad" : undefined,
      note: hungry ? words.hungryNote : could > pays ? words.could(could) : undefined
    },
    work ? { icon: "jobs", label: words.worksAt, value: words.workplace(work.kind) } : { icon: "jobs", label: words.worksAt, value: words.nothingNearby, tone: "dim" }
  ]
  // What it needs: what it must have now, then what it must have to grow, in the order the town makes them.
  const needs: Array<Line> = []
  const nowNeeds = new Set<Need>(tier.needs)
  const growNeeds = new Set<Need>(nextTier ? home.tiers[nextTier].needs : [])
  for (const n of ["food", "bread", "cloth", "faith", "furniture"] as const) {
    if (!nowNeeds.has(n) && !growNeeds.has(n)) continue
    if (met(h, n)) {
      needs.push({ icon: needIcons[n], label: t.need(n), value: words.met, tone: "ok" })
      continue
    }
    const now = nowNeeds.has(n)
    needs.push({
      icon: needIcons[n],
      label: t.need(n),
      value: now || nextTier === null ? words.missing : words.forTier(nextTier),
      tone: now ? "bad" : "warn",
      ...told(frame, causeOf(n, h, street, town, served))
    })
  }
  const blocks = blockersOf(h, street, town, served, r)
  const streetBlock = blocks.find((b) => b.what === "street")
  if (nextTier)
    needs.push({
      icon: "appeal",
      label: words.street,
      value: streetBlock ? words.streetOf(desirability, home.tiers[nextTier].appeal) : words.met,
      tone: streetBlock ? "warn" : "ok",
      ...(streetBlock ? { note: t.view.street.short(street, home.tiers[nextTier].appeal), fix: frame.fixOf(advice) } : {})
    })
  else needs.push({ icon: "appeal", label: words.street, value: words.desirability(desirability), tone: "ok" })
  if (blocks.some((b) => b.what === "services")) needs.push({ icon: "order", label: words.services, value: words.forTier(3), tone: "warn", ...told(frame, servicesCause(r)) })
  // Rising is a rebuilding, paid at once from the treasury and the store, once.
  const rebuilt = nextTier !== null && (row.data.rebuilt?.tier ?? 1) >= nextTier
  const short = nextTier && !rebuilt ? shortOf(home.tiers[nextTier].rise, frame.world.treasury.coins, frame.world.stock) : null
  if (nextTier)
    needs.push({
      icon: "upkeep", label: words.rebuilding, value: rebuilt ? words.rebuilt : t.cost(home.tiers[nextTier].rise), tone: short ? "warn" : "ok",
      ...(short
        ? { note: words.shortOf(short), fix: frame.fixOf(words.waitsForStore) }
        : rebuilt ? { note: words.rebuiltAlready } : {})
    })
  if (nextTier && blocks.length === 0 && !short)
    needs.push({ icon: "citizens", label: words.readyFor(nextTier), value: words.met, tone: "ok", note: words.readyNote })
  const risky = r ? (["fire", "health", "order"] as const).filter((k) => r[k] >= RISK_MAX * 0.35) : []
  const safety: Array<Line> = [
    ...(r && risky.length === 0 ? [{ icon: "fire", label: words.risks, value: words.allLow, tone: "ok" } as Line] : []),
    ...risky.map(
      (k): Line => ({
        icon: k,
        label: words.riskOf[k],
        value: riskText(t, r![k]),
        tone: r![k] >= risk.warn ? "bad" : "warn",
        note: words.cure[k]
      })
    ),
    ...(r && r.thefts > 0 ? [{ icon: "order", label: words.robbed, value: words.times(r.thefts), tone: "warn" } as Line] : []),
    ...(condition
      ? [{
          icon: "condition",
          label: words.condition,
          value: percent(condition.value, CONDITION_MAX),
          tone: condition.value < wear.worn ? "bad" : condition.value < wear.mend ? "warn" : "ok",
          note: condition.value < wear.worn ? words.runDown : condition.value < wear.mend ? words.wearing : undefined
        } as Line]
      : [])
  ]
  const summary = row.data.burning !== undefined ? words.onFire : row.data.sick !== undefined ? words.sick : hungry ? words.hungry : words.summary(h.residents)
  return {
    h,
    summary,
    trouble: row.data.burning !== undefined || row.data.sick !== undefined || hungry,
    groups: [
      { title: words.household, icon: "homes", lines: household },
      { title: words.needs, icon: "citizens", help: words.needsHelp[h.tier], lines: needs },
      { title: words.safety, icon: "condition", help: words.safetyHelp, lines: safety }
    ] as Array<Group>
  }
}

/** The panel of a home that is picked. */
export const housePanel = (frame: Frame, row: HouseRow): Panel => {
  const { h, summary, trouble, groups } = describeHouse(frame, row)
  return {
    type: "house", id: row.entity.id, cell: row.data.tile, tier: h.tier, summary, trouble, groups,
    closable: row.data.site === undefined && row.data.rising === undefined && row.data.burning === undefined,
    closed: row.data.closed !== undefined,
    salvage: plain(frame.t, salvageFor(frame.t, home.cost, row.data.site))
  }
}
