/**
 * The heads-up display. Top left: the term's clock and the treasury, the
 * goods in stock below, then the crown's request and any alarm (the ticker
 * goes under them). Top right: the people and their mood, which opens the
 * town's panel. On a phone the people join the top line, and a chip of the
 * building goods stands in for the stock.
 */
import { goodIds, winters, type GoodId } from "../../game/content/index.ts"
import type { Edit } from "../../game/edits.ts"
import type { Catalog } from "../../i18n/index.ts"
import type { Stats } from "../../view/contracts.ts"
import type { Controls, Fold } from "./controls.ts"
import { phone } from "./folds.ts"
import { el, escapeHtml, setHtml } from "./kit/dom.ts"
import { goodIcon, icon } from "./kit/icons.ts"
import { clockText, compose, signed } from "./kit/text.ts"

const groups: ReadonlyArray<ReadonlyArray<GoodId>> = [
  ["wood", "planks", "stone", "ore", "tools"],
  ["fish", "smoked", "wheat", "flour", "bread"],
  ["wool", "cloth", "furniture"]
]

/** `ticker`: the ticker's card, which goes under the alarms. */
export const createHud = (
  t: Catalog,
  ticker: HTMLElement,
  send: (edit: Edit) => void,
  stats: () => Stats | null,
  controls: Pick<Controls, "toggleMenu" | "toggleFold" | "setFold" | "goTo">
) => {
  const said = t.page.hud
  /** A good and what it is for, for the stock bar's tooltips: who makes it, who takes it. */
  const goodHelp = (g: GoodId) => said.good(t.good.name(g), said.goods[g])
  const hud = el("div", "hud left")
  const bar = el("div", "card bar")
  const clock = el("div", "cell clock")
  const coins = el("div", "cell coins")
  bar.append(clock, coins)
  const stock = el("div", "card stock")
  stock.title = said.stock
  const goodCells = new Map<GoodId, HTMLElement>()
  const goodTrends = new Map<GoodId, HTMLElement>()
  for (const group of groups) {
    const cell = el("div", "group")
    for (const g of group) {
      const item = el("span", "good")
      item.title = goodHelp(g)
      item.setAttribute("aria-label", t.good.name(g))
      const glyph = el("span", "glyph")
      glyph.innerHTML = goodIcon(g, 18)
      const count = el("span", "count", "0")
      const trend = el("span", "trend")
      item.append(glyph, count, trend)
      cell.append(item)
      goodCells.set(g, count)
      goodTrends.set(g, trend)
    }
    stock.append(cell)
  }
  // The crown's request, when there is one, and what threatens the term (or is about to raise the town a rank).
  const request = el("div", "card request")
  const requestText = el("div", "cell")
  const deliver = el("button", "send", said.crown.send)
  deliver.onclick = (event) => {
    event.stopPropagation()
    send({ type: "deliver" })
  }
  request.append(requestText, deliver)
  const alarm = el("div", "card alarm")
  // The top line: the clock and treasury (on a phone, the people and a chip of the building goods beside them).
  const topline = el("div", "topline")
  const goodsChip = el("button", "card goods-chip")
  goodsChip.title = said.goodsChip
  topline.append(bar, goodsChip)
  // Under the goods, on a click: each good's last minute, made against used, and where it is held.
  const flowCard = el("div", "card flow")
  stock.onclick = (event) => {
    event.stopPropagation()
    flowCard.classList.toggle("open")
  }
  flowCard.onclick = () => flowCard.classList.remove("open")
  hud.append(topline, stock, flowCard, request, alarm, ticker)
  const people = el("div", "hud right")
  const folk = el("div", "card bar folk")
  const approval = el("div", "cell")
  const settlerCell = el("div", "cell")
  const citizenCell = el("div", "cell")
  const jobs = el("div", "cell jobs")
  folk.append(approval, settlerCell, citizenCell, jobs)
  people.append(folk)
  folk.title = said.folk
  folk.onclick = () => controls.toggleMenu("town")
  let shortCursor = 0
  jobs.onclick = (event) => {
    event.stopPropagation()
    const short = stats()?.shortStaffed ?? []
    if (short.length === 0) return controls.toggleMenu("town")
    const next = short[shortCursor % short.length]!
    shortCursor += 1
    controls.goTo(next.cell, next.size, next.id)
  }
  goodsChip.onclick = (event) => {
    event.stopPropagation()
    controls.toggleFold("goods")
  }
  // The treasury opens the same minute the goods do.
  coins.onclick = (event) => {
    event.stopPropagation()
    if (phone.matches) controls.toggleFold("goods")
    else flowCard.classList.toggle("open")
  }
  // The people's card joins the top line on a phone, and goes back to the top right on a wider screen.
  const placeFolk = () => {
    if (phone.matches) topline.insertBefore(folk, goodsChip)
    else people.append(folk)
    if (!phone.matches) controls.setFold(null)
  }

  /** `speed`: 0 shows the clock paused; `fold`: what a phone has open. */
  const update = (s: Stats, speed: number, fold: Fold | null) => {
    // The treasury as the goods are shown: which way it went over the last minute, and by how much; the steady rate until a minute is counted.
    const cf = s.flow?.coins ?? null
    const change = cf ? cf.made + cf.traded - cf.used : s.net
    const way = cf ? trendOf(cf.made, cf.used, cf.traded) : 0
    setHtml(
      coins,
      `${icon("coins", 20)}<span class="stack"><b>${s.coins}${cf ? `<span class="trend ${trendClass(way)}">${trendMark(way)}</span>` : ""}</b>` +
        `<small class="${change >= 0 ? "up" : "down"}">${change >= 0 ? "+" : ""}${change}${escapeHtml(t.amount.perMinute)}</small></span>`
    )
    coins.title = cf ? said.treasury.counted({ change, made: cf.made, used: cf.used, traded: cf.traded, net: s.net }) : said.treasury.plain
    coins.classList.toggle("debt", s.coins < 0)
    const left = Math.max(0, s.charter.term * 60 - Math.floor((s.minute - s.fate.began) * 60))
    const until = s.season.winter
      ? said.clock.winter(s.season.severity ?? "normal", clockText(s.season.left))
      : s.season.coming === null
        ? said.clock.noMoreWinters
        : said.clock.winterIn(clockText(s.season.left), s.season.coming)
    setHtml(clock, `${icon(s.season.winter ? "winter" : "clock", 20)}<span class="stack"><b>${clockText(left)}${speed === 0 ? `<span class="paused-tag">${escapeHtml(said.clock.paused)}</span>` : ""}</b><small class="${s.season.winter ? "winter" : s.season.coming === "hard" ? "down" : ""}">${escapeHtml(said.clock.year(s.season.year, until))}</small></span>`)
    clock.title = said.clock.title({
      winter: s.season.winter,
      coming: s.season.coming,
      after: s.season.after,
      fishing: { mild: Math.round(winters.mild.fishing * 100), normal: Math.round(winters.normal.fishing * 100), hard: Math.round(winters.hard.fishing * 100) }
    })
    const trend = s.mood.target > s.mood.approval ? "↑" : s.mood.target < s.mood.approval ? "↓" : ""
    setHtml(approval, `${icon("approval", 18)}<span class="stack"><b class="${s.mood.approval < 0 ? "down" : ""}">${signed(s.mood.approval)} <span class="${s.mood.target >= s.mood.approval ? "up" : "down"}">${trend}</span></b><small>${escapeHtml(said.approval)}</small></span>`)
    setHtml(settlerCell, `${icon("settlers", 18)}<span class="stack"><b>${s.settlers}</b><small>${escapeHtml(said.settlers)}</small></span>`)
    setHtml(citizenCell, `${icon("citizens", 18)}<span class="stack"><b>${s.citizens}</b><small>${escapeHtml(said.citizens)}${s.burghers > 0 ? ` · ${escapeHtml(said.burghers(s.burghers))}` : ""}</small></span>`)
    const short = s.shortStaffed.length
    setHtml(jobs, `${icon("jobs", 18)}<span class="stack"><b>${s.employed}<span class="of">/${s.jobs}</span></b><small class="${short > 0 ? "down" : ""}">${escapeHtml(short > 0 ? said.jobs.short(short) : said.jobs.filled)}</small></span>`)
    jobs.title = short > 0 ? said.jobs.shortTitle(short, s.shortStaffed.slice(0, 5)) : said.jobs.filledTitle
    const chipHtml = (["planks", "stone", "tools"] as const)
      .map((g) => `<span class="${s.stock[g] === 0 ? "short" : ""}">${goodIcon(g, 14)}${s.stock[g]}</span>`)
      .join("")
    if (goodsChip.dataset.html !== chipHtml) {
      goodsChip.dataset.html = chipHtml
      goodsChip.innerHTML = chipHtml
    }
    for (const [g, count] of goodCells) {
      count.textContent = String(s.stock[g])
      const way = s.flow ? flowTrend(s.flow, g) : 0
      const trend = goodTrends.get(g)!
      trend.textContent = s.flow ? trendMark(way) : ""
      trend.className = `trend ${trendClass(way)}`
      // Empty storage is only worth dimming when nothing is held anywhere else either.
      count.parentElement!.classList.toggle("empty", s.stock[g] === 0 && (s.flow?.elsewhere[g] ?? 0) === 0)
      count.parentElement!.title = goodHelp(g) + (s.flow
        ? `\n${said.goodFlow({ made: s.flow.made[g], used: s.flow.used[g], traded: s.flow.traded[g], stock: s.stock[g], elsewhere: s.flow.elsewhere[g] })}`
        : "")
    }
    // On a phone the goods chip opens the table itself, once there is a minute to show; the plain goods until then.
    document.body.classList.toggle("flow-ready", s.flow !== null)
    if (flowCard.classList.contains("open") || (phone.matches && fold === "goods")) setHtml(flowCard, flowHtml(t, s))
    // The crown's request.
    request.classList.toggle("show", s.crown.open && s.fate.state === "playing")
    if (s.crown.open) {
      const have = s.stock[s.crown.good]
      // What is asked on top, in one line; the terms under it.
      setHtml(
        requestText,
        `${icon("crown", 18)}<span class="lines"><span class="ask">${compose(said.crown.asks, `<b>${s.crown.amount}</b>`, `${goodIcon(s.crown.good, 14)} <b>${escapeHtml(t.good.name(s.crown.good))}</b>`)}</span>` +
          `<span class="terms">${compose(
            said.crown.terms,
            `<span class="${have < s.crown.amount ? "down" : "up"}">${escapeHtml(said.crown.inStore(have))}</span>`,
            `<b>${clockText(s.crown.left)}</b>`,
            escapeHtml(said.crown.reward(s.crown.reward))
          )}</span></span>`
      )
      deliver.title = have < s.crown.amount ? said.crown.notEnough(s.crown.good) : said.crown.sendTitle(s.crown.good, s.crown.amount, s.crown.reward)
      deliver.disabled = have < s.crown.amount
    }
    // What threatens the term, or is about to raise the town a rank.
    const warnings: Array<{ readonly lead: string; readonly text: string; readonly good?: boolean }> = []
    if (s.fate.state === "playing") {
      if (s.fate.bankrupt !== null) warnings.push(said.warnings.bankruptIn(clockText(s.fate.bankrupt)))
      else if (s.coins < 0) warnings.push(said.warnings.debt)
      if (s.fate.revolt !== null) warnings.push(said.warnings.revoltIn(clockText(s.fate.revolt)))
      else if (s.mood.approval < -30) warnings.push(said.warnings.restless)
      if (s.fate.peak >= 40 && s.settlers + s.citizens < s.fate.peak * 0.4) warnings.push(said.warnings.emptying)
      if (s.crown.streak > 0 && s.crown.streak >= s.crown.patience - 1) warnings.push(said.warnings.patience(s.crown.streak))
      if (s.fate.rises !== null && s.fate.nextTitle !== null) warnings.push({ ...said.warnings.rises(s.fate.rank + 1, clockText(s.fate.rises)), good: true })
    }
    const html = warnings
      .map((w) => `<div class="cell">${icon(w.good ? "goal" : "warning", 16)}<span><b>${escapeHtml(w.lead)}</b> ${escapeHtml(w.text)}</span></div>`)
      .join("")
    if (alarm.dataset.html !== html) {
      alarm.dataset.html = html
      alarm.innerHTML = html
    }
    alarm.classList.toggle("show", warnings.length > 0)
    alarm.classList.toggle("good", warnings.length === 1 && s.fate.rises !== null)
  }

  return { left: hud, right: people, goodsChip, placeFolk, update }
}

/** Which way a good (or the treasury) went over the last minute: made and bought against used and sold, past a tenth of the traffic either way. */
const trendOf = (made: number, used: number, traded: number): number => {
  const net = made + traded - used
  const room = Math.max(1, Math.round((made + used + Math.abs(traded)) / 10))
  return net > room ? 1 : net < -room ? -1 : 0
}
const flowTrend = (flow: NonNullable<Stats["flow"]>, g: GoodId): number => trendOf(flow.made[g], flow.used[g], flow.traded[g])

/** A good's way over the last minute: up, down, or holding steady. */
const trendMark = (way: number) => (way > 0 ? "↑" : way < 0 ? "↓" : "→")
const trendClass = (way: number) => (way > 0 ? "up" : way < 0 ? "down" : "steady")

/** The goods' last minute, side by side: only the goods the town has touched. */
const flowHtml = (t: Catalog, s: Stats): string => {
  const f = s.flow, said = t.page.hud.flow
  if (f === null) return `<p class="sub">${escapeHtml(said.counting)}</p>`
  const rows = goodIds.filter((g) => f.made[g] + f.used[g] + Math.abs(f.traded[g]) + s.stock[g] + f.elsewhere[g] > 0)
  const column = (c: { readonly label: string; readonly title: string }) => `<b title="${escapeHtml(c.title)}">${escapeHtml(c.label)}</b>`
  const head = `<span></span>${column(said.made)}${column(said.used)}${column(said.traded)}${column(said.storage)}${column(said.about)}`
  const cell = (n: number) => `<span>${n === 0 ? `<i>–</i>` : n}</span>`
  const signedCell = (n: number) => `<span>${n === 0 ? `<i>–</i>` : n > 0 ? `+${n}` : `−${-n}`}</span>`
  const name = (label: string, glyph: string, way: number) =>
    `<span class="name" title="${escapeHtml(label)}">${glyph}<span class="label">${escapeHtml(label)}</span><span class="trend ${trendClass(way)}">${trendMark(way)}</span></span>`
  // The treasury first: taxes and rewards made, upkeep and building used, trade's coins; it is all in storage.
  const c = f.coins
  const treasury = `${name(t.page.common.coins, icon("coins", 14), trendOf(c.made, c.used, c.traded))}${cell(c.made)}${cell(c.used)}${signedCell(c.traded)}${cell(s.coins)}<span><i>–</i></span>`
  const body = treasury + rows.map((g) =>
    `${name(t.good.name(g), goodIcon(g, 14), flowTrend(f, g))}${cell(f.made[g])}${cell(f.used[g])}${signedCell(f.traded[g])}${cell(s.stock[g])}${cell(f.elsewhere[g])}`
  ).join("")
  return `<div class="flow-grid">${head}${body}</div>`
}
