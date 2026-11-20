/** A building's panel: what it is doing and what it costs, its upgrade, and what pulling it down gives back. */
import {
  amounts, builtCost, condition as wear, CONDITION_MAX, goodIds, kinds, nextUpgrade, provisions, risk, RISK_MAX, upgradeAt, upkeepOf, type GoodId
} from "../../game/content/index.ts"
import { buildFor, type Cause } from "../../game/rules/explain.ts"
import { upgradeChanges } from "../../game/rules/upgrades.ts"
import { upgradeBlock } from "../../game/schedule.ts"
import { plain, say } from "../../i18n/index.ts"
import type { Group, Line, Panel } from "../contracts.ts"
import { growingNear, problemBuild, problemOf, riskText, salvageFor, worksShare, type Problem } from "../facts.ts"
import type { BuildingRow, Frame } from "../frame.ts"
import { percent } from "../text.ts"
import type { WantedReason } from "../upgrades.ts"

/** A cause as a row's note and fix, in the frame's language. */
export const told = (frame: Frame, c: Cause | null) => {
  if (!c) return {}
  const said = say(frame.t.view.cause, c)
  return { note: said.why, fix: frame.fixOf(said.fix, buildFor(c)) }
}

/**
 * A building, for its panel: what it is doing (workers, what it makes, what it holds), then what it costs to run
 * (upkeep, wear, fire, its street). Each row is a value; a note only when something wants doing.
 */
export const describeBuilding = (frame: Frame, row: BuildingRow) => {
  const grid = frame.grid
  const t = frame.t, words = t.view.building
  const kind = kinds[row.data.building.kind]
  const status = row.data.status
  const site = row.data.site
  if (site) {
    const owed = (Object.entries(site.owed) as Array<[GoodId, number]>).filter(([, n]) => n > 0)
    const line: Line =
      owed.length > 0
        ? { icon: "build", label: words.waitingFor, goods: owed.map(([good, count]) => ({ good, count })), tone: "warn", note: words.carriersBring }
        : { icon: "build", label: words.builders, value: words.atWork, tone: "ok" }
    return { kind, status, problem: null, state: { icon: "build", label: words.beingBuilt, tone: "warn" } as Line, groups: [{ title: words.beingBuilt, icon: "build", lines: [line] }] as Array<Group> }
  }
  const staff = row.data.staff
  const work: Array<Line> = []
  if (staff.needed > 0) {
    const crew = kind.crew
    const short = staff.assigned < staff.needed
    work.push({
      icon: "workers",
      label: words.workers,
      value: words.staffed(staff.assigned, staff.needed),
      tone: !short ? "ok" : staff.assigned > 0 ? "warn" : "bad",
      note: short
        ? staff.nearby === 0
          ? words.nobodyNear(crew)
          : words.allTaken
        : staff.apprentices > 0
          ? words.apprentices
          : undefined
    })
  }
  const recipe = row.data.recipe
  if (recipe)
    work.push({ icon: recipe.output, label: words.makes, value: words.recipe(recipe.input, recipe.output) })
  const service = row.data.service
  if (service)
    work.push({
      icon: service.service === "goods" ? "trade" : service.service === "faith" ? "faith" : service.service === "repair" ? "repair" : service.service,
      label: words.walkersOut,
      value: `${row.data.walkers?.length ?? 0}`
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
        ? { icon: "people", label: words.handedOut, goods: provisions.filter((g) => given[g] > 0).map((g) => ({ good: g, count: given[g] })), note: words.handedTo(homesFed) }
        : { icon: "people", label: words.handedOut, value: words.nothing, tone: "dim", note: words.nobodyNeeded }
    )
  }
  const inventory = row.data.inventory
  if (inventory) {
    const held = inventory.accepts.filter((g) => inventory.stock[g] > 0).map((g) => ({ good: g, count: inventory.stock[g] }))
    // A market's shelf is only what waits for the next walker.
    const label = kind.id === "market" ? words.shelf : words.holds
    work.push(held.length > 0 ? { icon: "jobs", label, goods: held } : { icon: "jobs", label, value: words.nothing, tone: "dim" })
  }
  if (kind.wear && inventory)
    work.push(
      inventory.stock.tools > 0
        ? { icon: "tools", label: words.tools, value: `${inventory.stock.tools}`, tone: "ok" }
        : { icon: "tools", label: words.tools, value: words.none, tone: "bad", note: words.noTools }
    )
  const running: Array<Line> = []
  const level = row.data.upgraded?.level ?? 0
  const upkeep = upkeepOf(kind, level)
  if (upkeep > 0) running.push({ icon: "upkeep", label: words.upkeep, value: words.upkeepValue(upkeep) })
  const condition = row.data.condition
  if (condition)
    running.push({
      icon: "condition",
      label: words.condition,
      value: percent(condition.value, CONDITION_MAX),
      tone: condition.value < wear.worn ? "bad" : condition.value < wear.mend ? "warn" : "ok",
      note: condition.value < wear.worn ? words.runDown : condition.value < wear.mend ? words.wearing : undefined
    })
  const r = row.data.risk
  if (r)
    running.push({
      icon: "fire",
      label: words.fireRisk,
      value: riskText(t, r.fire),
      tone: r.fire >= risk.warn ? "bad" : r.fire >= RISK_MAX * 0.35 ? "warn" : "ok",
      note: r.fire >= RISK_MAX * 0.35 ? words.fireCure : undefined
    })
  const appealHere = upgradeAt(kind, level)?.appeal ?? kind.appeal
  if (appealHere) running.push({ icon: "appeal", label: words.appeal, value: t.format.signed(appealHere.value) })
  const help = [
    ...(upkeep > 0 ? [words.help.upkeep] : []),
    ...(condition ? [words.help.condition] : []),
    ...(kind.hot ? [words.help.hot] : []),
    ...(appealHere ? [words.help.appeal(appealHere.reach, appealHere.value < 0)] : [])
  ].join(" ")
  const groups: Array<Group> = [
    ...(work.length > 0 ? [{ title: words.work, icon: "jobs", lines: work } as Group] : []),
    ...(running.length > 0 ? [{ title: words.running, icon: "coins", help, lines: running } as Group] : [])
  ]
  const growing = status === "starved" && growingNear(grid, row.data.tile, kind, frame.rockAt)
  const trouble: Problem | null = row.data.burning !== undefined ? { _tag: "onFire" } : problemOf(kind, status, growing, { nearby: staff.nearby, crew: kind.crew })
  const said = trouble ? say(t.view.problem, trouble) : null
  const state: Line = trouble && said
    ? { icon: "warning", label: said.label, tone: "bad", note: said.why, fix: frame.fixOf(said.fix, problemBuild(trouble)) }
    : { icon: status === "working" ? "jobs" : "clock", label: t.view.status[status], tone: status === "working" ? "ok" : undefined }
  return { kind, status, problem: said ? t.view.problemLine(said) : null, state, groups }
}

/** The panel of a building that is picked; `needed`: why the town needs its upgrade now, if it does. */
export const buildingPanel = (frame: Frame, row: BuildingRow, needed: WantedReason | null): Panel => {
  const { kind, status, problem, state, groups } = describeBuilding(frame, row)
  const t = frame.t, words = t.view.upgrade
  const standing = row.data.site === undefined && row.data.rising === undefined
  const pausable = kind.id !== "townhall" && standing
  const level = row.data.upgraded?.level ?? 0
  const works = row.data.works
  const up = works ? undefined : nextUpgrade(kind, level)
  const coins = frame.world.treasury.coins
  const blocked = up ? upgradeBlock(up, frame.world.fate.rank) : null
  const gains = up ? upgradeChanges(kind, level).map((c) => ({ what: c._tag, ...say(words.change, c) })) : []
  // What it says in the panel's own words is plain; the same lines in the tooltip show their amounts as icons.
  const upgradeOffer = up && standing
    ? { title: t.kind.title(kind.id, level + 1), blurb: t.kind.blurb(kind.id, level + 1), price: words.price(up.cost), cost: up.cost,
        changes: gains.map((g) => words.line(g)), gains, needed: needed === null ? null : plain(t, words.wanted[needed]),
        blocked: blocked === null ? null : t.needsRank(blocked),
        short: coins < up.cost.coins ? plain(t, words.short(up.cost.coins - coins)) : null }
    : null
  // An upgrade under way: what it is to become, and what carriers still have to bring.
  const worksOf = works && upgradeAt(kind, works.level)
    ? { title: t.kind.title(kind.id, works.level), share: worksShare(works)!,
        left: t.cost({ coins: 0, materials: Object.fromEntries(goodIds.filter((g) => works.owed[g] > 0).map((g) => [g, works.owed[g]])) }) }
    : null
  if (works && worksOf)
    groups.unshift({
      title: words.becoming(kind.id, works.level),
      icon: "build",
      lines: [{ icon: "build", label: words.built, value: `${Math.round(worksOf.share * 100)}%`, tone: "warn", note: worksOf.left ? words.stillBring(worksOf.left) : words.allIn }]
    })
  return {
    type: "building",
    id: row.entity.id,
    cell: row.data.tile,
    kind: kind.id,
    title: t.kind.title(kind.id, level),
    blurb: t.kind.blurb(kind.id, level),
    status,
    problem,
    state,
    groups,
    pausable,
    paused: row.data.paused !== undefined,
    salvage: plain(t, salvageFor(t, builtCost(kind, level), row.data.site, works && { kind, ...works })),
    level,
    upgraded: level > 0,
    upgrade: upgradeOffer,
    works: worksOf
  }
}
