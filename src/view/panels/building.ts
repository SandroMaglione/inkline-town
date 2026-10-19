/** A building's panel: what it is doing and what it costs, its upgrade, and what pulling it down gives back. */
import {
  amounts, builtCost, COMMUTE, condition as wear, CONDITION_MAX, goodIds, goods, kinds, nextUpgrade, provisions, ranks, risk, RISK_MAX, upgradeAt, upkeepOf, anA, costText, type GoodId
} from "../../game/content/index.ts"
import type { Cause } from "../../game/rules/explain.ts"
import { upgradeChanges, upgradePrice } from "../../game/rules/upgrades.ts"
import { upgradeBlock } from "../../game/schedule.ts"
import type { Group, Line, Panel } from "../contracts.ts"
import { growingNear, problemOf, riskText, salvageFor, worksShare, type Problem } from "../facts.ts"
import type { BuildingRow, Frame } from "../frame.ts"
import { percent, signed } from "../text.ts"

/** A cause as a row's note and fix. */
export const told = (frame: Frame, c: Cause | null) => (c ? { note: c.why, fix: frame.fixOf(c.fix) } : {})

/**
 * A building, for its panel: what it is doing (workers, what it makes, what it holds), then what it costs to run
 * (upkeep, wear, fire, its street). Each row is a value; a note only when something wants doing.
 */
export const describeBuilding = (frame: Frame, row: BuildingRow) => {
  const grid = frame.grid
  const kind = kinds[row.data.building.get().kind]
  const status = row.data.status.get()
  const site = row.data.site.value()
  if (site) {
    const owed = (Object.entries(site.owed) as Array<[GoodId, number]>).filter(([, n]) => n > 0)
    const line: Line =
      owed.length > 0
        ? { icon: "build", label: "waiting for", goods: owed.map(([good, count]) => ({ good, count })), tone: "warn", note: "carriers bring them from storage: buy what the town lacks in the town panel" }
        : { icon: "build", label: "builders", value: "at work", tone: "ok" }
    return { kind, status, problem: null, state: { icon: "build", label: "being built", tone: "warn" } as Line, groups: [{ title: "being built", icon: "build", lines: [line] }] as Array<Group> }
  }
  const staff = row.data.staff.get()
  const work: Array<Line> = []
  if (staff.needed > 0) {
    const crew = kind.crew
    const short = staff.assigned < staff.needed
    work.push({
      icon: "workers",
      label: "workers",
      value: `${staff.assigned} of ${staff.needed}`,
      tone: !short ? "ok" : staff.assigned > 0 ? "warn" : "bad",
      note: short
        ? staff.nearby === 0
          ? `no ${crew} live within ${COMMUTE} road cells: lay homes nearer`
          : `everyone nearby has a job: lay more homes within ${COMMUTE} road cells`
        : staff.apprentices > 0
          ? `settlers stand in for citizens, at three-quarters pace`
          : undefined
    })
  }
  const recipe = row.data.recipe.value()
  if (recipe)
    work.push({ icon: recipe.output, label: "makes", value: recipe.input ? `${goods[recipe.input].title} → ${goods[recipe.output].title}` : goods[recipe.output].title })
  const service = row.data.service.value()
  if (service)
    work.push({
      icon: service.service === "goods" ? "trade" : service.service === "faith" ? "faith" : service.service === "repair" ? "repair" : service.service,
      label: "walkers out",
      value: `${row.data.walkers.value()?.length ?? 0}`
    })
  // A provisions walker's building: what its walkers handed to homes over the last minute, which its shelf
  // alone cannot say (food leaves in the basket as soon as it comes; furniture mostly comes back).
  if (service?.service === "goods") {
    const log = frame.world.handed.log.filter((l) => l.from === row.entity.id)
    const given: Record<GoodId, number> = { ...amounts({}) }
    for (const l of log) for (const [g, n] of Object.entries(l.goods) as Array<[GoodId, number]>) given[g] += n
    const homesFed = new Set(log.map((l) => l.to)).size
    work.push(
      homesFed > 0
        ? { icon: "people", label: "handed out, last minute", goods: provisions.filter((g) => given[g] > 0).map((g) => ({ good: g, count: given[g] })),
            note: `to ${homesFed} home${homesFed === 1 ? "" : "s"} on its walks` }
        : { icon: "people", label: "handed out, last minute", value: "nothing", tone: "dim", note: "no home on its walks needed what it had" }
    )
  }
  const inventory = row.data.inventory.value()
  if (inventory) {
    const held = inventory.accepts.filter((g) => inventory.stock[g] > 0).map((g) => ({ good: g, count: inventory.stock[g] }))
    // A market's shelf is only what waits for the next walker.
    const label = kind.id === "market" ? "on the shelf now" : "holds"
    work.push(held.length > 0 ? { icon: "jobs", label, goods: held } : { icon: "jobs", label, value: "nothing", tone: "dim" })
  }
  if (kind.wear && inventory)
    work.push(
      inventory.stock.tools > 0
        ? { icon: "tools", label: "tools", value: `${inventory.stock.tools}`, tone: "ok" }
        : { icon: "tools", label: "tools", value: "none", tone: "bad", note: "half pace until one comes: a smithy makes them, or buy them in the town panel" }
    )
  const running: Array<Line> = []
  const level = row.data.upgraded.value()?.level ?? 0
  const upkeep = upkeepOf(kind, level)
  if (upkeep > 0) running.push({ icon: "upkeep", label: "upkeep", value: `${upkeep} coins a minute` })
  const condition = row.data.condition.value()
  if (condition)
    running.push({
      icon: "condition",
      label: "condition",
      value: percent(condition.value, CONDITION_MAX),
      tone: condition.value < wear.worn ? "bad" : condition.value < wear.mend ? "warn" : "ok",
      note: condition.value < wear.worn ? "half pace, and it may fall: a builder's yard mends it" : condition.value < wear.mend ? "a builder's yard mends it as its builder passes" : undefined
    })
  const r = row.data.risk.value()
  if (r)
    running.push({
      icon: "fire",
      label: "fire risk",
      value: riskText(r.fire),
      tone: r.fire >= risk.warn ? "bad" : r.fire >= RISK_MAX * 0.35 ? "warn" : "ok",
      note: r.fire >= RISK_MAX * 0.35 ? "a fire watch's watchman lowers it as he passes" : undefined
    })
  const appealHere = upgradeAt(kind, level)?.appeal ?? kind.appeal
  if (appealHere) running.push({ icon: "appeal", label: "desirability nearby", value: signed(appealHere.value) })
  const help = [
    upkeep > 0 ? "Upkeep is paid every minute it stands, a quarter of it while paused." : "",
    condition ? "Everything wears down; a builder's yard mends it." : "",
    kind.hot ? "An oven or a forge: a fire risk to itself and to homes within 2 cells." : "",
    appealHere ? `It changes how nice the streets are out to ${appealHere.reach} cells${appealHere.value < 0 ? ": homes close by hold fewer people and pay less" : ""}.` : ""
  ]
    .filter((t) => t !== "")
    .join(" ")
  const groups: Array<Group> = [
    ...(work.length > 0 ? [{ title: "at work", icon: "jobs", lines: work } as Group] : []),
    ...(running.length > 0 ? [{ title: "running it", icon: "coins", help, lines: running } as Group] : [])
  ]
  const growing = status === "starved" && growingNear(grid, row.data.tile.get(), kind, frame.rockAt)
  const trouble: Problem | null = row.data.burning.present
    ? { label: "on fire!", why: "its crew has fled", fix: { text: "a fire watch's watchmen put fires out", build: ["firewatch"] } }
    : problemOf(kind, status, growing, { nearby: staff.nearby, crew: kind.crew })
  const state: Line = trouble
    ? { icon: "warning", label: trouble.label, tone: "bad", note: trouble.why, fix: frame.fixOf(trouble.fix) }
    : { icon: status === "working" ? "jobs" : "clock", label: status === "working" ? "working" : status, tone: status === "working" ? "ok" : undefined }
  return { kind, status, problem: trouble ? `${trouble.label}: ${trouble.why}` : null, state, groups }
}

/** The panel of a building that is picked; `needed`: why the town needs its upgrade now, if it does. */
export const buildingPanel = (frame: Frame, row: BuildingRow, needed: string | null): Panel => {
  const { kind, status, problem, state, groups } = describeBuilding(frame, row)
  const standing = !row.data.site.present && !row.data.rising.present
  const pausable = kind.id !== "townhall" && standing
  const level = row.data.upgraded.value()?.level ?? 0
  const now = upgradeAt(kind, level)
  const works = row.data.works.value()
  const up = works ? undefined : nextUpgrade(kind, level)
  const coins = frame.world.treasury.coins
  const upgradeOffer = up && standing
    ? { title: up.title, blurb: up.blurb, price: upgradePrice(up), cost: up.cost, changes: upgradeChanges(kind, level), needed,
        blocked: upgradeBlock(up, frame.world.fate.rank, { ranks }),
        short: coins < up.cost.coins ? `${up.cost.coins - coins} coins short` : null }
    : null
  // An upgrade under way: what it is to become, and what carriers still have to bring.
  const worksOf = works
    ? { title: upgradeAt(kind, works.level)!.title, share: worksShare(works)!,
        left: costText({ coins: 0, materials: Object.fromEntries(goodIds.filter((g) => works.owed[g] > 0).map((g) => [g, works.owed[g]])) }) }
    : null
  if (worksOf)
    groups.unshift({
      title: `becoming ${anA(worksOf.title.toLowerCase())}`,
      icon: "build",
      lines: [{ icon: "build", label: "built", value: `${Math.round(worksOf.share * 100)}%`, tone: "warn", note: worksOf.left ? `carriers still bring ${worksOf.left}; it works on meanwhile` : "every material is in; the builders are working it in, and it works on meanwhile" }]
    })
  return {
    type: "building",
    id: row.entity.id,
    cell: row.data.tile.get(),
    kind: kind.id,
    title: now?.title ?? kind.title,
    blurb: now?.blurb ?? kind.blurb,
    status,
    problem,
    state,
    groups,
    pausable,
    paused: row.data.paused.present,
    salvage: salvageFor(builtCost(kind, level), row.data.site.value(), works && { kind, ...works }),
    level,
    upgraded: level > 0,
    upgrade: upgradeOffer,
    works: worksOf
  }
}
