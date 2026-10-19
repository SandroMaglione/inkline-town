/**
 * The heads-up display. Top left: the term's clock and the treasury, the
 * goods in stock below, then the crown's request and any alarm (the ticker
 * goes under them). Top right: the people and their mood, which opens the
 * town's panel. On a phone the people join the top line, and a chip of the
 * building goods stands in for the stock.
 */
import { goodIds, goods, winters, type GoodId } from "../../game/content/index.ts"
import type { Edit } from "../../game/edits.ts"
import type { Stats } from "../../view/contracts.ts"
import type { Controls, Fold } from "./controls.ts"
import { phone } from "./folds.ts"
import { el, setHtml } from "./kit/dom.ts"
import { goodIcon, icon } from "./kit/icons.ts"
import { clockText, signed } from "./kit/text.ts"

/** What each good is for, for the stock bar's tooltips: who makes it, who takes it. */
const goodHelp: Readonly<Record<GoodId, string>> = {
  wood: "lumberjacks fell it; a sawmill saws it into planks",
  planks: "what homes and buildings are built from: a sawmill makes them from wood",
  stone: "for building and paving: quarries cut it from rocks, which run out",
  ore: "only for tools: once the town has 10 citizens, a mine digs it from the rust-red deposits, and a smithy forges it into tools",
  tools: "for building, and workshops wear one out every 50 or 60 jobs: a smithy forges them, or buy them",
  fish: "food for settlers: fisheries catch it by the water; it rots in about three minutes",
  smoked: "fish that keeps all winter: a smokehouse smokes it",
  wheat: "farms grow it; a mill grinds it into flour (not in winter)",
  flour: "a mill's; a bakery bakes it into bread",
  bread: "food that citizens need, and a cottage with bread pays half again: it rots in about five minutes",
  wool: "sheep farms shear it; a weaver weaves it into cloth",
  cloth: "citizens need it: only brought to streets with desirability 5 or more",
  furniture: "burghers need it in their townhouses: a carpenter makes it from planks; only brought to streets fine enough for townhouses"
}
const groups: ReadonlyArray<ReadonlyArray<GoodId>> = [
  ["wood", "planks", "stone", "ore", "tools"],
  ["fish", "smoked", "wheat", "flour", "bread"],
  ["wool", "cloth", "furniture"]
]

/** `ticker`: the ticker's card, which goes under the alarms. */
export const createHud = (
  ticker: HTMLElement,
  send: (edit: Edit) => void,
  stats: () => Stats | null,
  controls: Pick<Controls, "toggleMenu" | "toggleFold" | "setFold" | "goTo">
) => {
  const hud = el("div", "hud left")
  const bar = el("div", "card bar")
  const clock = el("div", "cell clock")
  const coins = el("div", "cell coins")
  bar.append(clock, coins)
  const stock = el("div", "card stock")
  stock.title = "Goods in the town's storage, and which way each is going · click for what the town makes and uses"
  const goodCells = new Map<GoodId, HTMLElement>()
  const goodTrends = new Map<GoodId, HTMLElement>()
  for (const group of groups) {
    const cell = el("div", "group")
    for (const g of group) {
      const item = el("span", "good")
      item.title = `${goods[g].title}: ${goodHelp[g]}`
      item.setAttribute("aria-label", goods[g].title)
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
  const deliver = el("button", "send", "send")
  deliver.onclick = (event) => {
    event.stopPropagation()
    send({ type: "deliver" })
  }
  request.append(requestText, deliver)
  const alarm = el("div", "card alarm")
  // The top line: the clock and treasury (on a phone, the people and a chip of the building goods beside them).
  const topline = el("div", "topline")
  const goodsChip = el("button", "card goods-chip")
  goodsChip.title = "The goods in storage"
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
  folk.title = "Open the town's numbers, goals, and levers (T)"
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
        `<small class="${change >= 0 ? "up" : "down"}">${change >= 0 ? "+" : ""}${change}/min</small></span>`
    )
    coins.title = cf
      ? `Coins in the treasury · click for the town's last minute\nLast minute: ${signed(change)} (made ${cf.made}, used ${cf.used}${cf.traded !== 0 ? `, traded ${signed(cf.traded)}` : ""})\nAt the current rates: ${signed(s.net)}/min (taxes, trade, upkeep, administration)`
      : `Coins in the treasury, and what it gains (or loses) a minute at the current rates · click for the town's last minute`
    coins.classList.toggle("debt", s.coins < 0)
    const left = Math.max(0, s.charter.term * 60 - Math.floor((s.minute - s.fate.began) * 60))
    const severity = (w: typeof s.season.coming) => (w === null ? "" : ` (${winters[w].title})`)
    const until = s.season.winter
      ? `${winters[s.season.severity ?? "normal"].title} winter · spring in ${clockText(s.season.left)}`
      : s.season.coming === null
        ? "no more winters this term"
        : `winter in ${clockText(s.season.left)}${severity(s.season.coming)}`
    setHtml(clock, `${icon(s.season.winter ? "winter" : "clock", 20)}<span class="stack"><b>${clockText(left)}${speed === 0 ? `<span class="paused-tag">paused</span>` : ""}</b><small class="${s.season.winter ? "winter" : s.season.coming === "hard" ? "down" : ""}">year ${s.season.year} · ${until}</small></span>`)
    clock.title = `${s.season.winter ? "Winter: fields lie still, fishing is slow, and homes eat faster" : "Time left in the term"}\nThe almanac: the coming winter is ${s.season.coming === null ? "beyond the term" : winters[s.season.coming].title}, the one after ${s.season.after === null ? "beyond the term" : winters[s.season.after].title}.\nMild: fishing at ${Math.round(winters.mild.fishing * 100)}%. Normal: ${Math.round(winters.normal.fishing * 100)}%. Hard: half as long again, fishing at ${Math.round(winters.hard.fishing * 100)}%, and homes heating are a fire risk.`
    const trend = s.mood.target > s.mood.approval ? "↑" : s.mood.target < s.mood.approval ? "↓" : ""
    setHtml(approval, `${icon("approval", 18)}<span class="stack"><b class="${s.mood.approval < 0 ? "down" : ""}">${signed(s.mood.approval)} <span class="${s.mood.target >= s.mood.approval ? "up" : "down"}">${trend}</span></b><small>approval</small></span>`)
    setHtml(settlerCell, `${icon("settlers", 18)}<span class="stack"><b>${s.settlers}</b><small>settlers</small></span>`)
    setHtml(citizenCell, `${icon("citizens", 18)}<span class="stack"><b>${s.citizens}</b><small>citizens${s.burghers > 0 ? ` · ${s.burghers} burghers` : ""}</small></span>`)
    const short = s.shortStaffed.length
    setHtml(jobs, `${icon("jobs", 18)}<span class="stack"><b>${s.employed}<span class="of">/${s.jobs}</span></b><small class="${short > 0 ? "down" : ""}">${short > 0 ? `${short} short · click` : "jobs filled"}</small></span>`)
    jobs.title = short > 0
      ? `Workers at work over workers needed. ${short} workplace${short > 1 ? "s are" : " is"} short: ${s.shortStaffed.slice(0, 5).map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? " (no homes within 15 road cells)" : ""}`).join(", ")}. Click to visit them in turn.`
      : "Workers at work over workers needed: every workplace has its crew. Residents walk at most 15 road cells to work."
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
      count.parentElement!.title = `${goods[g].title}: ${goodHelp[g]}` + (s.flow
        ? `\nLast minute: made ${s.flow.made[g]}, used ${s.flow.used[g]}${s.flow.traded[g] !== 0 ? `, ${s.flow.traded[g] > 0 ? "bought" : "sold"} ${Math.abs(s.flow.traded[g])}` : ""}. ${s.stock[g]} in storage, ${s.flow.elsewhere[g]} about town (in workshops and markets, and on the way).`
        : "")
    }
    // On a phone the goods chip opens the table itself, once there is a minute to show; the plain goods until then.
    document.body.classList.toggle("flow-ready", s.flow !== null)
    if (flowCard.classList.contains("open") || (phone.matches && fold === "goods")) setHtml(flowCard, flowHtml(s))
    // The crown's request.
    request.classList.toggle("show", s.crown.open && s.fate.state === "playing")
    if (s.crown.open) {
      const have = s.stock[s.crown.good]
      // What is asked on top, in one line; the terms under it.
      setHtml(
        requestText,
        `${icon("crown", 18)}<span class="lines"><span class="ask">the crown asks for <b>${s.crown.amount}</b> ${goodIcon(s.crown.good, 14)} <b>${goods[s.crown.good].title}</b></span>` +
          `<span class="terms"><span class="${have < s.crown.amount ? "down" : "up"}">${have} in store</span> · due in <b>${clockText(s.crown.left)}</b> · +${s.crown.reward} coins</span></span>`
      )
      deliver.title = have < s.crown.amount ? `Not enough ${goods[s.crown.good].title} in store yet` : `Send ${s.crown.amount} ${goods[s.crown.good].title} to the crown for ${s.crown.reward} coins`
      deliver.disabled = have < s.crown.amount
    }
    // What threatens the term, or is about to raise the town a rank.
    const warnings: Array<string> = []
    if (s.fate.state === "playing") {
      if (s.fate.bankrupt !== null)
        warnings.push(`<b>In debt:</b> bankrupt in ${clockText(s.fate.bankrupt)} unless the treasury recovers`)
      else if (s.coins < 0) warnings.push("<b>In debt:</b> wages are going unpaid")
      if (s.fate.revolt !== null) warnings.push(`<b>Uproar:</b> the town turns the mayor out in ${clockText(s.fate.revolt)}`)
      else if (s.mood.approval < -30) warnings.push("<b>Restless:</b> approval is falling towards revolt")
      if (s.fate.peak >= 40 && s.settlers + s.citizens < s.fate.peak * 0.4) warnings.push("<b>Emptying:</b> people are leaving the town")
      if (s.crown.streak > 0 && s.crown.streak >= s.crown.patience - 1) {
        warnings.push(`<b>The crown's patience:</b> ${s.crown.streak} requests missed in a row; one more and the mayor is dismissed`)
      }
      if (s.fate.rises !== null && s.fate.nextTitle !== null) warnings.push(`<b>Every goal met:</b> the town is a ${s.fate.nextTitle} in ${clockText(s.fate.rises)}`)
    }
    const html = warnings
      .map((w) => `<div class="cell">${icon(w.startsWith("<b>Every goal") ? "goal" : "warning", 16)}<span>${w}</span></div>`)
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
const flowHtml = (s: Stats): string => {
  const f = s.flow
  if (f === null) return `<p class="sub">Counting the town's goods: the first numbers come in half a minute…</p>`
  const rows = goodIds.filter((g) => f.made[g] + f.used[g] + Math.abs(f.traded[g]) + s.stock[g] + f.elsewhere[g] > 0)
  const head = `<span></span><b title="Made by workshops and gatherers over the last minute">made</b><b title="Eaten, worked up, built with, rotted, or sent away over the last minute">used</b><b title="Bought (+) or sold (−) over the last minute">traded</b><b title="In the town hall, warehouses, and granaries">storage</b><b title="In workshops and markets, walkers' baskets, and carriers' crates">about town</b>`
  const cell = (n: number) => `<span>${n === 0 ? `<i>–</i>` : n}</span>`
  const signedCell = (n: number) => `<span>${n === 0 ? `<i>–</i>` : n > 0 ? `+${n}` : `−${-n}`}</span>`
  // The treasury first: taxes and rewards made, upkeep and building used, trade's coins; it is all in storage.
  const c = f.coins
  const way = trendOf(c.made, c.used, c.traded)
  const treasury = `<span class="name" title="coins">${icon("coins", 14)}<span class="label">coins</span><span class="trend ${trendClass(way)}">${trendMark(way)}</span></span>` +
    `${cell(c.made)}${cell(c.used)}${signedCell(c.traded)}${cell(s.coins)}<span><i>–</i></span>`
  const body = treasury + rows.map((g) => {
    const way = flowTrend(f, g)
    const traded = f.traded[g] === 0 ? `<i>–</i>` : f.traded[g] > 0 ? `+${f.traded[g]}` : `−${-f.traded[g]}`
    return `<span class="name" title="${goods[g].title}">${goodIcon(g, 14)}<span class="label">${goods[g].title}</span><span class="trend ${trendClass(way)}">${trendMark(way)}</span></span>` +
      `${cell(f.made[g])}${cell(f.used[g])}<span>${traded}</span>${cell(s.stock[g])}${cell(f.elsewhere[g])}`
  }).join("")
  return `<div class="flow-grid">${head}${body}</div>`
}
