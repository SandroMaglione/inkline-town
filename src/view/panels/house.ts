/** A home's panel: its household, what it needs and why it lacks it, and its risks and wear. */
import { COMMUTE, condition as wear, CONDITION_MAX, costText, crewOf, home, kinds, RISK_MAX, risk, type Need, type Tier } from "../../game/content/index.ts"
import { needTitle } from "../../game/content/index.ts"
import { blockers as blockersOf, causeOf, servicesCause, streetAdvice, streetShort, type InTown, type Served, type Street } from "../../game/rules/explain.ts"
import { shortOf, suppliedTaxOf } from "../../game/rules/households.ts"
import { capacity, met, taxOf } from "../../game/schedule.ts"
import { appealAt, appealParts } from "../../game/world/appeal.ts"
import { doors, key, nearest, reach, type TileLike } from "../../game/world/grid.ts"
import type { Group, Line, Panel } from "../contracts.ts"
import { riskText, salvageFor } from "../facts.ts"
import type { Frame, HouseRow } from "../frame.ts"
import { percent, signed } from "../text.ts"
import { told } from "./building.ts"

const needIcons = { food: "food", bread: "bread", cloth: "cloth", faith: "faith", furniture: "furniture" } as const

/** Where a home's residents work: the nearest workplace of their crew in reach that has them. */
const workOf = (frame: Frame, tile: TileLike, tier: Tier) => {
  const { grid, buildings } = frame
  const ds = doors(grid, tile)
  if (ds.length === 0) return null
  const roads = reach(grid, ds)
  let best: { title: string; distance: number } | null = null
  for (const { data } of buildings) {
    const kind = kinds[data.building.get().kind]
    const staff = data.staff.get()
    if (staff.needed === 0 || staff.assigned === 0 || (kind.crew !== crewOf(tier) && !(tier === 1 && staff.apprentices > 0))) continue
    for (const d of doors(grid, data.tile.get())) {
      const n = roads.distance[key(d.x, d.y)]!
      if (n >= 0 && n <= COMMUTE && (best === null || n < best.distance)) best = { title: kind.title.toLowerCase(), distance: n }
    }
  }
  return best
}
/** What the town has of each provision, in storage and on market shelves. */
const inTown = (frame: Frame): InTown => {
  const stock = frame.world.stock
  const sum = { fish: stock.fish, smoked: stock.smoked, bread: stock.bread, cloth: stock.cloth, furniture: stock.furniture }
  for (const { data } of frame.buildings) {
    const inv = data.inventory.value()
    if (!inv || data.service.value()?.service !== "goods" || data.site.present || data.rising.present) continue
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
    const service = data.service.value()
    if (!service || data.site.present || data.rising.present || data.burning.present) continue
    if (service.service !== "goods" && service.service !== "faith") continue
    if (served[service.service]) continue
    const found = nearest(way, doors(grid, data.tile.get()))
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
  const { cells, approval, rates } = frame
  const h = row.data.house.get()
  const site = row.data.site.value()
  const quiet = (summary: string, line: Line) => ({ h, summary, trouble: false, groups: [{ title: "household", icon: "homes", lines: [line] }] as Array<Group> })
  if (site) return quiet("being built", { icon: "planks", label: "builders", value: "waiting for its plank", tone: "warn" })
  if (row.data.closed.present)
    return quiet("closed", { icon: "settlers", label: "closed", value: "empty", tone: "warn", note: "it pays no taxes and costs the town hall nothing: reopen it and settlers move back in" })
  const tile = row.data.tile.get()
  const tier = home.tiers[h.tier]
  const nextTier = h.tier < 3 ? ((h.tier + 1) as Tier) : null
  const there = appealParts(frame.appealSources(), tile)
  const desirability = appealAt(cells, tile.x, tile.y)
  const street: Street = { desirability, parts: there.parts }
  const r = row.data.risk.value()
  const work = workOf(frame, tile, h.tier)
  const condition = row.data.condition.value()
  const town = inTown(frame)
  const served = servedAt(frame, tile)
  const rate = h.tier === 1 ? rates.settlers : rates.citizens
  const cap = capacity(h, approval, desirability, undefined, rate)
  const whyFewer =
    cap >= tier.residents
      ? undefined
      : row.data.sick.present
        ? "half as many while it is sick"
        : approval < 0
          ? "fewer while the town disapproves of its mayor"
          : desirability < 0
            ? `fewer on a poor street: ${streetAdvice(street)}`
            : rate > 100 && capacity(h, approval, desirability) > cap
              ? `fewer while taxed at ${rate}%: some move away`
              : "fewer until every need is met"
  const hungry = h.food <= 0
  const pays = Math.round(taxOf(h, rates, undefined, desirability))
  const could = Math.round(suppliedTaxOf(h, rates, undefined, desirability))
  const household: Array<Line> = [
    ...(row.data.burning.present ? [{ icon: "fire", label: "on fire", value: "everyone fled", tone: "bad" } as Line] : []),
    ...(row.data.sick.present ? [{ icon: "health", label: "sick", value: "half as many", tone: "bad", note: "it passes in a minute, or when a healer's physician calls" } as Line] : []),
    { icon: "people", label: "residents", value: `${h.residents} of ${cap}`, tone: whyFewer ? "warn" : "ok", note: whyFewer },
    {
      icon: "coins",
      label: "pays",
      value: `${pays} coins a minute`,
      tone: hungry ? "bad" : undefined,
      note: hungry ? "hungry: no food, no taxes" : could > pays ? `${could} coins a minute with every need met` : undefined
    },
    work ? { icon: "jobs", label: "works at", value: `${work.title.toLowerCase()}` } : { icon: "jobs", label: "works at", value: "nothing nearby", tone: "dim" }
  ]
  // What it needs: what it must have now, then what it must have to grow, in the order the town makes them.
  const needs: Array<Line> = []
  const nowNeeds = new Set<Need>(tier.needs)
  const growNeeds = new Set<Need>(nextTier ? home.tiers[nextTier].needs : [])
  for (const n of ["food", "bread", "cloth", "faith", "furniture"] as const) {
    if (!nowNeeds.has(n) && !growNeeds.has(n)) continue
    if (met(h, n)) {
      needs.push({ icon: needIcons[n], label: needTitle[n], value: "✓", tone: "ok" })
      continue
    }
    const now = nowNeeds.has(n)
    needs.push({
      icon: needIcons[n],
      label: needTitle[n],
      value: now ? "missing" : `for ${home.tiers[nextTier!].title}`,
      tone: now ? "bad" : "warn",
      ...told(frame, causeOf(n, h, street, town, served))
    })
  }
  const blocks = blockersOf(h, street, town, served, r)
  const streetBlock = blocks.find((b) => b.what === "street")
  if (nextTier)
    needs.push({
      icon: "appeal",
      label: "street",
      value: streetBlock ? `${signed(desirability)} of ${home.tiers[nextTier].appeal}` : "✓",
      tone: streetBlock ? "warn" : "ok",
      ...(streetBlock ? { note: streetShort(street, home.tiers[nextTier].appeal), fix: { text: streetAdvice(street) } } : {})
    })
  else needs.push({ icon: "appeal", label: "street", value: signed(desirability), tone: "ok" })
  if (blocks.some((b) => b.what === "services")) needs.push({ icon: "order", label: "services", value: `for ${home.tiers[3].title}`, tone: "warn", ...told(frame, servicesCause(r)) })
  // Rising is a rebuilding, paid at once from the treasury and the store, once.
  const rebuilt = nextTier !== null && (row.data.rebuilt.value()?.tier ?? 1) >= nextTier
  const short = nextTier && !rebuilt ? shortOf(home.tiers[nextTier].rise, frame.world.treasury.coins, frame.world.stock) : null
  if (nextTier)
    needs.push({
      icon: "upkeep", label: "rebuilding", value: rebuilt ? "done ✓" : costText(home.tiers[nextTier].rise), tone: short ? "warn" : "ok",
      ...(short
        ? { note: `the town is short of ${short}`, fix: { text: "it waits at its tier until the store holds it: make it, or buy it in the [town] panel" } }
        : rebuilt ? { note: "rebuilt already: it rises back for nothing" } : {})
    })
  if (nextTier && blocks.length === 0 && !short)
    needs.push({ icon: "citizens", label: `ready for ${home.tiers[nextTier].title}`, value: "✓", tone: "ok", note: "it grows as the next resident moves in, and pays for its rebuilding then" })
  const risky = r ? (["fire", "health", "order"] as const).filter((k) => r[k] >= RISK_MAX * 0.35) : []
  const cure = { fire: "a fire watch's watchman lowers it", health: "a healer's physician lowers it", order: "a watch house's constable lowers it" } as const
  const safety: Array<Line> = [
    ...(r && risky.length === 0 ? [{ icon: "fire", label: "risks", value: "all low", tone: "ok" } as Line] : []),
    ...risky.map(
      (k): Line => ({
        icon: k,
        label: `${k === "order" ? "theft" : k} risk`,
        value: riskText(r![k]),
        tone: r![k] >= risk.warn ? "bad" : "warn",
        note: cure[k]
      })
    ),
    ...(r && r.thefts > 0 ? [{ icon: "order", label: "robbed", value: `${r.thefts}×`, tone: "warn" } as Line] : []),
    ...(condition
      ? [{
          icon: "condition",
          label: "condition",
          value: percent(condition.value, CONDITION_MAX),
          tone: condition.value < wear.worn ? "bad" : condition.value < wear.mend ? "warn" : "ok",
          note: condition.value < wear.worn ? "it drags the street down and may fall: a builder's yard mends it" : condition.value < wear.mend ? "a builder's yard mends it as its builder passes" : undefined
        } as Line]
      : [])
  ]
  const needHelp =
    h.tier === 1
      ? `Red: it needs this now. Amber: it needs this to become a citizens' home, which holds and pays twice as much. Bread alone already makes a cottage pay half again. Walkers bring needs along the road; the street is how nice the place is (desirability ${home.tiers[2].appeal} for citizens).`
      : h.tier === 2
        ? `Red: it needs this now, or goes back to settlers. Amber: it needs this to become a townhouse of burghers, on a street of ${home.tiers[3].appeal} with a fire watch, a healer, and a watch house all calling.`
        : "Red: it needs this now, or goes back to citizens."
  const summary = row.data.burning.present ? "on fire" : row.data.sick.present ? "sick" : hungry ? "hungry" : `${h.residents} resident${h.residents === 1 ? "" : "s"}`
  return {
    h,
    summary,
    trouble: row.data.burning.present || row.data.sick.present || hungry,
    groups: [
      { title: "household", icon: "homes", lines: household },
      { title: "needs", icon: "citizens", help: needHelp, lines: needs },
      { title: "risks and wear", icon: "condition", help: "Every home's risk of fire, sickness, and theft rises slowly; a walker from the matching service lowers it as it passes.", lines: safety }
    ] as Array<Group>
  }
}

/** The panel of a home that is picked. */
export const housePanel = (frame: Frame, row: HouseRow): Panel => {
  const { h, summary, trouble, groups } = describeHouse(frame, row)
  return {
    type: "house", id: row.entity.id, cell: row.data.tile.get(), tier: h.tier, summary, trouble, groups,
    closable: !row.data.site.present && !row.data.rising.present && !row.data.burning.present,
    closed: row.data.closed.present,
    salvage: salvageFor(home.cost, row.data.site.value())
  }
}
