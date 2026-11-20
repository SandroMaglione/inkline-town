/**
 * The town's panel: its rank and the goals that raise it, approval, the
 * treasury, the tax rates, the people, the homes supplied, the crown, goods
 * and trade, and the chronicle.
 */
import { goodIds, LEDGER_TICKS, mood as moodRules, RESERVE_MAX, step, TAX_STEPS, TRADE_LOAD, type GoodId } from "../../../game/content/index.ts"
import type { TradeMode } from "../../../game/edits.ts"
import { askOf, priceOf } from "../../../game/schedule.ts"
import type { Stats } from "../../../view/contracts.ts"
import type { IconName } from "../../../view/icons.ts"
import { el, escapeHtml } from "../kit/dom.ts"
import { goodIcon, icon, iconEl } from "../kit/icons.ts"
import { money, row } from "../kit/rows.ts"
import { section } from "../kit/section.ts"
import { slider } from "../kit/slider.ts"
import { sparkline } from "../kit/sparkline.ts"
import { clockText, compose, markup, signed } from "../kit/text.ts"
import type { PanelParts } from "./frame.ts"

/** The goods in store a minute ago, sampled by the page (see `townHistory`). */
export interface TownHistory {
  readonly minuteAgo: () => { readonly stock: Readonly<Record<GoodId, number>> } | undefined
  /** Starts over: a new town, or one loaded. */
  readonly clear: () => void
}

/** One sample every `SAMPLE_SECONDS`, the last ten minutes of them. */
export const townHistory = (stats: () => Stats | null): TownHistory => {
  interface Sample {
    readonly coins: number
    readonly residents: number
    readonly stock: Readonly<Record<GoodId, number>>
  }
  const samples: Array<Sample> = []
  const SAMPLE_SECONDS = 4
  const HISTORY = 150
  window.setInterval(() => {
    const s = stats()
    if (!s) return
    samples.push({ coins: s.coins, residents: s.settlers + s.citizens, stock: s.stock })
    if (samples.length > HISTORY) samples.shift()
  }, SAMPLE_SECONDS * 1000)
  return {
    minuteAgo: () => samples[Math.max(0, samples.length - 1 - Math.round(60 / SAMPLE_SECONDS))],
    clear: () => {
      samples.length = 0
    }
  }
}

export const townPanel = (parts: PanelParts, history: TownHistory) => {
  const panel = parts.element
  const { t } = parts
  const said = t.page.town
  const sub = el("p", "sub")
  panel.append(parts.header(said.title, iconEl("town", 30), sub))

  // The town's rank, the goals that raise it to the next, and how near each one is.
  const goals = section(t, said.goals.title, "goal", said.goals.help)
  const goalRows: Array<{ line: HTMLElement; mark: HTMLElement; text: HTMLElement; value: HTMLElement }> = []
  const goalNote = el("p", "empty")
  panel.append(goals)

  const mood = section(t, said.approval.title, "approval", said.approval.help)
  const moodLine = el("div", "row")
  const moodValue = el("span", "count total")
  moodLine.append(el("span", "label", said.approval.heading), moodValue)
  const moodTrack = el("div", "meter")
  const moodFill = el("span", "fill")
  moodTrack.append(moodFill)
  const moodParts = el("div", "")
  mood.append(moodLine, moodTrack, moodParts)
  panel.append(mood)

  const treasury = section(t, said.treasury.title, "treasury", said.treasury.help)
  const taxes = row(treasury, said.treasury.taxes, "taxes")
  const supplied = row(treasury, said.treasury.supplied, "homes")
  supplied.classList.add("dim")
  const suppliedNote = el("p", "empty")
  treasury.append(suppliedNote)
  const traded = row(treasury, said.treasury.trade, "trade")
  const upkeep = row(treasury, said.treasury.upkeep, "upkeep")
  const admin = row(treasury, said.treasury.admin, "town")
  const net = row(treasury, said.treasury.net, "coins")
  net.classList.add("total")
  const coinLine = el("div", "spark")
  treasury.append(coinLine)
  panel.append(treasury)

  const levers = section(t, said.taxes.title, "taxes", said.taxes.help)
  for (const [tier, homes] of [["settlers", 1], ["citizens", 2]] as const) {
    const line = el("div", "row lever")
    const value = el("span", "rate")
    const name = el("span", "label")
    name.innerHTML = icon(tier, 16)
    name.append(document.createTextNode(t.tier.people(homes)))
    line.append(name, value)
    const rate = slider(TAX_STEPS[0], TAX_STEPS.at(-1)!, 5, (to) => parts.send({ type: "tax", tier, rate: to }))
    rate.input.classList.add("tax")
    rate.input.title = said.taxes.slider
    rate.input.ondblclick = () => parts.send({ type: "tax", tier, rate: 100 })
    const effect = el("p", "effect")
    const outlook = el("p", "effect outlook")
    outlook.title = said.taxes.outlookTitle
    levers.append(line, rate.input, effect, outlook)
    parts.live(() => {
      const now = parts.town.stats?.policy[tier] ?? 100
      rate.sync(now)
      value.textContent = `${now}%`
      const sway = Math.round((100 - now) * moodRules.perTaxPoint)
      effect.textContent = said.taxes.effect(sway, now > moodRules.grudge.above)
      effect.className = `effect ${sway > 0 ? "up" : sway < 0 ? "down" : ""}`
      const steps = parts.town.stats?.taxOutlook[tier] ?? []
      const best = steps.reduce<{ rate: number; taxes: number } | null>((b, o) => (b === null || o.taxes > b.taxes ? o : b), null)
      const text = steps.length === 0 || best === null ? "" : said.taxes.outlook(steps, best.rate)
      if (outlook.textContent !== text) outlook.textContent = text
      outlook.style.display = text ? "" : "none"
    })
  }
  panel.append(levers)

  const town = section(t, said.people.title, "people")
  const settlers = row(town, said.people.settlers, "settlers")
  const citizens = row(town, said.people.citizens, "citizens")
  const burghers = row(town, said.people.burghers, "burghers")
  const homes = row(town, said.people.homes, "homes")
  const work = row(town, said.people.jobs, "jobs")
  const workNote = el("p", "empty")
  town.append(workNote)
  const peopleLine = el("div", "spark")
  town.append(peopleLine)
  panel.append(town)

  const needs = section(t, said.needs.title, "homes", said.needs.help)
  const needIcons: Readonly<Record<"food" | "bread" | "cloth" | "faith" | "furniture", IconName>> = {
    food: "fish",
    bread: "bread",
    cloth: "cloth",
    faith: "faith",
    furniture: "furniture"
  }
  const bars = (["food", "bread", "cloth", "faith", "furniture"] as const).map((n) => {
    const line = el("div", "need")
    // The icon alone says which need: the name is its tooltip, so no word runs under the bar.
    const label = el("span", "label")
    label.innerHTML = icon(needIcons[n], 16)
    label.title = t.need(n)
    label.setAttribute("aria-label", t.need(n))
    const track = el("span", "track")
    const fill = el("span", "fill")
    track.append(fill)
    const value = el("span", "count")
    line.append(label, track, value)
    needs.append(line)
    return { n, fill, value }
  })
  const larderLine = row(needs, said.needs.larder, "flour")
  const eatenLine = row(needs, said.needs.eaten, "fish")
  const troubleLine = row(needs, said.needs.trouble, "health")
  panel.append(needs)

  const crown = section(t, said.crown.title, "crown", said.crown.help)
  const crownLine = row(crown, said.crown.tally, "goal")
  const crownNext = el("p", "empty")
  crown.append(crownNext)
  panel.append(crown)

  const store = section(t, said.trade.title, "trade", said.trade.help)
  const reserveLine = el("div", "row lever")
  const reserveValue = el("span", "rate")
  reserveLine.append(el("span", "label", said.trade.keep), reserveValue)
  const reserve = slider(0, RESERVE_MAX, 5, (amount) => parts.send({ type: "reserve", amount }))
  reserve.input.title = said.trade.keepTitle
  store.append(reserveLine, reserve.input, el("p", "effect", said.trade.keepNote))
  /** Collections a minute: the traders come at every ledger. */
  const perMinute = 60 / (LEDGER_TICKS * step.dt)
  const goodRows = goodIds.map((g) => {
    const line = el("div", "trade-row")
    const name = el("span", "label")
    name.innerHTML = goodIcon(g, 16)
    name.append(document.createTextNode(t.good.name(g)))
    const value = el("span", "count")
    const price = el("span", "price")
    const top = el("div", "row")
    const change = el("small", "change")
    const right = el("span", "label")
    right.append(change, value, price)
    top.append(name, right)
    // Left of the middle sells, right of it buys, the middle neither; how far out is how much a collection.
    const deal = slider(-TRADE_LOAD, TRADE_LOAD, 1, (v) =>
      parts.send(v === 0 ? { type: "trade", good: g, mode: "none" } : { type: "trade", good: g, mode: v < 0 ? "sell" : "buy", amount: Math.abs(v) })
    )
    deal.input.classList.add("deal")
    deal.input.title = said.trade.deal(g)
    deal.input.ondblclick = () => parts.send({ type: "trade", good: g, mode: "none" })
    const mode = el("span", "mode")
    const bottom = el("div", "deal-line")
    bottom.append(deal.input, mode)
    line.append(top, bottom)
    store.append(line)
    return { g, value, change, mode, price, deal, line }
  })
  panel.append(store)

  const chronicle = section(t, said.chronicle, "chronicle")
  const lines = el("div", "chronicle")
  chronicle.append(lines)
  panel.append(chronicle)

  parts.live(() => {
    const s = parts.town.stats
    if (!s) return
    sub.textContent = said.sub({ size: s.charter.size, land: s.charter.land, rank: s.fate.rank, term: s.fate.term, minutes: s.charter.term })
    sub.title = said.seed(s.charter.seed)
    // Goals.
    while (goalRows.length < s.goals.length) {
      const line = el("div", "row goal")
      const mark = el("span", "mark", "✓")
      const text = el("span", "")
      const value = el("span", "count")
      const left = el("span", "label")
      left.append(mark, text)
      line.append(left, value)
      goals.append(line)
      goalRows.push({ line, mark, text, value })
    }
    goals.append(goalNote)
    goalRows.forEach((r, i) => (r.line.style.display = i < s.goals.length ? "" : "none"))
    s.goals.forEach((g, i) => {
      const r = goalRows[i]!
      r.line.classList.toggle("met", g.met)
      r.text.textContent = g.text
      r.value.textContent = g.value
    })
    goalNote.textContent = s.fate.nextTitle === null
      ? said.goals.top(s.fate.rank)
      : s.fate.rises !== null
        ? said.goals.holding(s.fate.rank, clockText(s.fate.rises))
        : said.goals.toward(s.fate.rank)
    goalNote.style.display = goalNote.textContent ? "" : "none"
    // Approval.
    moodValue.textContent = `${signed(s.mood.approval)} → ${signed(s.mood.target)}`
    moodValue.classList.toggle("down", s.mood.approval < 0)
    moodFill.style.left = `${Math.min(50, 50 + s.mood.approval / 2)}%`
    moodFill.style.width = `${Math.abs(s.mood.approval) / 2}%`
    moodFill.classList.toggle("low", s.mood.approval < 0)
    const moodHtml = s.mood.parts
      .map(
        (p) =>
          `<div class="row"><span class="label">${escapeHtml(p.label)}</span><span class="count ${p.value > 0 ? "up" : p.value < 0 ? "down" : ""}">${signed(p.value)}</span></div>`
      )
      .join("")
    if (moodParts.dataset.html !== moodHtml) {
      moodParts.dataset.html = moodHtml
      moodParts.innerHTML = moodHtml
    }
    money(taxes, s.taxes)
    supplied.textContent = `+${s.suppliedTaxes}`
    const gap = s.suppliedTaxes - s.taxes
    suppliedNote.textContent = gap > Math.max(10, s.taxes * 0.1) ? said.treasury.leftOnTable(gap) : ""
    suppliedNote.style.display = suppliedNote.textContent ? "" : "none"
    money(traded, s.trade)
    money(upkeep, -s.upkeep)
    money(admin, -s.admin)
    money(net, s.net, said.treasury.netCoins(s.net))
    settlers.textContent = String(s.settlers)
    citizens.textContent = String(s.citizens)
    burghers.textContent = String(s.burghers)
    homes.textContent = String(s.homes)
    work.textContent = said.people.jobsOf(s.employed, s.jobs)
    workNote.textContent = s.shortStaffed.length === 0
      ? said.people.staffed
      : said.people.short(s.shortStaffed.length, s.shortStaffed.slice(0, 4), s.shortStaffed.length > 4)
    for (const b of bars) {
      // Furniture is counted against the townhouses: no other home keeps it.
      const of = b.n === "furniture" ? Math.max(s.townhouses, s.needs.furniture) : s.homes
      const share = of > 0 ? s.needs[b.n] / of : 0
      b.fill.style.width = `${Math.round(share * 100)}%`
      b.fill.className = `fill ${of === 0 ? "" : share < 0.34 ? "none" : share < 0.67 ? "low" : ""}`
      b.value.textContent = `${s.needs[b.n]}/${of}`
    }
    larderLine.textContent = `${s.larder}`
    eatenLine.textContent = `${s.eaten} · ${s.rotted}`
    troubleLine.textContent = `${s.sick} · ${s.burning}`
    crownLine.textContent = `${s.crown.met} · ${s.crown.missed}`
    crownNext.innerHTML = s.crown.open
      ? compose(said.crown.wants, `<b>${escapeHtml(said.crown.what(s.crown.good, s.crown.amount))}</b>`, clockText(s.crown.left), escapeHtml(said.crown.reward(s.crown.reward)))
      : escapeHtml(said.crown.next(clockText(s.crown.next), s.crown.patience))
    // Goods' change over the last minute of samples.
    const ago = history.minuteAgo()
    reserveValue.textContent = String(s.policy.reserve)
    reserve.sync(s.policy.reserve)
    for (const r of goodRows) {
      const change = ago ? s.stock[r.g] - ago.stock[r.g] : 0
      r.change.textContent = change !== 0 ? `${change > 0 ? "+" : ""}${change}${t.amount.perMinute}` : ""
      r.change.className = `change ${change > 0 ? "up" : "down"}`
      r.value.textContent = String(s.stock[r.g])
      const now: TradeMode = s.policy.sells.includes(r.g) ? "sell" : s.policy.buys.includes(r.g) ? "buy" : "none"
      const load = s.policy.loads[r.g]
      r.deal.sync(now === "sell" ? -load : now === "buy" ? load : 0)
      r.mode.textContent = now === "none" ? said.trade.none : said.trade[now](Math.round(load * perMinute))
      r.mode.className = `mode ${now}`
      r.line.className = `trade-row ${now}`
      const price = now === "buy" ? askOf(r.g, s.prices[r.g]) : Math.round(priceOf(r.g, s.prices[r.g]) * 10) / 10
      r.price.textContent = said.trade.price(price, s.prices[r.g] !== 100 ? s.prices[r.g] : null)
      r.price.title = now === "buy" ? said.trade.asks : said.trade.pays
    }
    const samples = s.history
    const coinsSvg = sparkline(samples.map((h) => h.coins))
    if (coinLine.dataset.svg !== coinsSvg) {
      coinLine.dataset.svg = coinsSvg
      coinLine.innerHTML = coinsSvg
    }
    const peopleSvg = sparkline(samples.map((h) => h.residents))
    if (peopleLine.dataset.svg !== peopleSvg) {
      peopleLine.dataset.svg = peopleSvg
      peopleLine.innerHTML = peopleSvg
    }
    const recent = s.chronicle
      .slice(-10)
      .reverse()
      .map((l) => `<p><b>${clockText(Math.round(l.tick / 60))}</b> ${markup(t, l.text)}</p>`)
      .join("")
    if (lines.dataset.html !== recent) {
      lines.dataset.html = recent
      lines.innerHTML = recent
    }
  })
}
