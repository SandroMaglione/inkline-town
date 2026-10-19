/**
 * The town's panel: its rank and the goals that raise it, approval, the
 * treasury, the tax rates, the people, the homes supplied, the crown, goods
 * and trade, and the chronicle.
 */
import {
  goodIds, goods, LEDGER_TICKS, lands, mood as moodRules, needTitle, RESERVE_MAX, sizes, step, TAX_STEPS, TRADE_LOAD, type GoodId
} from "../../../game/content/index.ts"
import type { TradeMode } from "../../../game/edits.ts"
import { askOf, priceOf } from "../../../game/schedule.ts"
import type { Stats } from "../../../view/contracts.ts"
import type { IconName } from "../../../view/icons.ts"
import { el } from "../kit/dom.ts"
import { goodIcon, icon, iconEl } from "../kit/icons.ts"
import { money, row } from "../kit/rows.ts"
import { section } from "../kit/section.ts"
import { slider } from "../kit/slider.ts"
import { sparkline } from "../kit/sparkline.ts"
import { clockText, signed } from "../kit/text.ts"
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
  const sub = el("p", "sub")
  panel.append(parts.header("town", iconEl("town", 30), sub))

  // The town's rank, the goals that raise it to the next, and how near each one is.
  const goals = section(
    "goals",
    "goal",
    "The town rises from a hamlet to a village, a town, and a city. Meet every goal of the next rank at once and hold them for two minutes: the crown sends a reward, and the game goes on. A rank is never lost."
  )
  const goalRows: Array<{ line: HTMLElement; mark: HTMLElement; text: HTMLElement; value: HTMLElement }> = []
  const goalNote = el("p", "empty")
  panel.append(goals)

  const mood = section(
    "approval",
    "approval",
    `Homes hold more residents when approval is high and fewer when it is low. At −50 for two minutes, the town turns the mayor out.`
  )
  const moodLine = el("div", "row")
  const moodValue = el("span", "count total")
  moodLine.append(el("span", "label", "now → heading for"), moodValue)
  const moodTrack = el("div", "meter")
  const moodFill = el("span", "fill")
  moodTrack.append(moodFill)
  const moodParts = el("div", "")
  mood.append(moodLine, moodTrack, moodParts)
  panel.append(mood)

  const treasury = section(
    "treasury",
    "treasury",
    "Coins a minute. Taxes come only from homes that are fed, in proportion to the needs they have met. Administration is reckoned by the home and grows faster than the town: in a large town another cottage costs about what it pays, while a citizens' home or a townhouse holds two or three times the people for the same cost. Three minutes in debt and the town is bankrupt."
  )
  const taxes = row(treasury, "taxes", "taxes")
  const supplied = row(treasury, "if every home were supplied", "homes")
  supplied.classList.add("dim")
  const suppliedNote = el("p", "empty")
  treasury.append(suppliedNote)
  const traded = row(treasury, "trade", "trade")
  const upkeep = row(treasury, "upkeep", "upkeep")
  const admin = row(treasury, "administration", "town")
  const net = row(treasury, "a minute", "coins")
  net.classList.add("total")
  const coinLine = el("div", "spark")
  treasury.append(coinLine)
  panel.append(treasury)

  const levers = section(
    "tax rates",
    "taxes",
    `Lower taxes raise approval, higher ones lower it, weighed by how many of each tier there are. Above 100% some residents also move away, settlers sooner than citizens, so a higher rate does not always bring in more: under each rate is what the homes would pay at each step once they settle there. Above ${moodRules.grudge.above}% the town also keeps a grudge that outlasts the rate: cutting taxes at the end does not undo a term of squeezing.`
  )
  for (const tier of ["settlers", "citizens"] as const) {
    const line = el("div", "row lever")
    const value = el("span", "rate")
    const name = el("span", "label")
    name.innerHTML = icon(tier, 16)
    name.append(document.createTextNode(tier))
    line.append(name, value)
    const rate = slider(TAX_STEPS[0], TAX_STEPS.at(-1)!, 5, (to) => parts.send({ type: "tax", tier, rate: to }))
    rate.input.classList.add("tax")
    rate.input.title = "Drag to set the rate; double-click for the usual 100%"
    rate.input.ondblclick = () => parts.send({ type: "tax", tier, rate: 100 })
    const effect = el("p", "effect")
    const outlook = el("p", "effect outlook")
    outlook.title = "Taxes a minute from every home if this rate stayed there and the homes settled: residents move away above 100%, and approval follows the rate"
    levers.append(line, rate.input, effect, outlook)
    parts.live(() => {
      const now = parts.town.stats?.policy[tier] ?? 100
      rate.sync(now)
      value.textContent = `${now}%`
      const sway = Math.round((100 - now) * moodRules.perTaxPoint)
      const grudge = now > moodRules.grudge.above ? " · a grudge builds while it stays this high, and fades slowly" : ""
      effect.textContent = (sway === 0 ? "the usual rate" : `${signed(sway)} approval`) + grudge
      effect.className = `effect ${sway > 0 ? "up" : sway < 0 ? "down" : ""}`
      const steps = parts.town.stats?.taxOutlook[tier] ?? []
      const best = steps.reduce<{ rate: number; taxes: number } | null>((b, o) => (b === null || o.taxes > b.taxes ? o : b), null)
      const text = steps.length === 0 || best === null
        ? ""
        : `taxes a minute, once settled: ${steps.map((o) => `${o.rate}% ${o.taxes}`).join(" · ")} · most at ${best.rate}%`
      if (outlook.textContent !== text) outlook.textContent = text
      outlook.style.display = text ? "" : "none"
    })
  }
  panel.append(levers)

  const town = section("people", "people")
  const settlers = row(town, "settlers", "settlers")
  const citizens = row(town, "citizens", "citizens")
  const burghers = row(town, "of them, burghers", "burghers")
  const homes = row(town, "homes", "homes")
  const work = row(town, "jobs filled", "jobs")
  const workNote = el("p", "empty")
  town.append(workNote)
  const peopleLine = el("div", "spark")
  town.append(peopleLine)
  panel.append(town)

  const needs = section(
    "homes supplied",
    "homes",
    "A hungry home pays no taxes. Settlers need food (fish, smoked fish, or bread) from a market, and a cottage with bread besides pays half again; a visit feeds a home a fish or a loaf for every four residents, so a citizens' home eats twice what a cottage does and a townhouse three times; citizens and burghers need bread, cloth, and faith, and burghers furniture from a carpenter besides. Cloth is only brought to streets with desirability 5 or more, furniture to streets of 12 or more. Fish rots in about three minutes and bread in five; a granary keeps them five times as long."
  )
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
    label.title = needTitle[n]
    label.setAttribute("aria-label", needTitle[n])
    const track = el("span", "track")
    const fill = el("span", "fill")
    track.append(fill)
    const value = el("span", "count")
    line.append(label, track, value)
    needs.append(line)
    return { n, fill, value }
  })
  const larderLine = row(needs, "food in store", "flour")
  const eatenLine = row(needs, "eaten · rotted last minute", "fish")
  const troubleLine = row(needs, "sick homes · on fire", "health")
  panel.append(needs)

  const crown = section(
    "the crown",
    "crown",
    `Sending what the crown asks for earns coins. A missed request is a fine, and the town remembers the snub for a while; too many missed in a row and the crown dismisses the mayor.`
  )
  const crownLine = row(crown, "requests met · missed", "goal")
  const crownNext = el("p", "empty")
  crown.append(crownNext)
  panel.append(crown)

  const store = section(
    "goods and trade",
    "trade",
    "Traders call every few seconds. Drag a good's slider left to sell it beyond what the town keeps, right to buy it up to that (at half again the price), the further the more each call; the middle neither sells nor buys. Prices fall as the town sells and rise, three times as fast, as it buys; a dear price calms only slowly, so buying tops up a shortfall but a town fed on bought food pays more every minute."
  )
  const reserveLine = el("div", "row lever")
  const reserveValue = el("span", "rate")
  reserveLine.append(el("span", "label", "keep in store"), reserveValue)
  const reserve = slider(0, RESERVE_MAX, 5, (amount) => parts.send({ type: "reserve", amount }))
  reserve.input.title = "How much of each good the town keeps: it sells only beyond this, and buys only up to it"
  store.append(reserveLine, reserve.input, el("p", "effect", "of each good: sold only above this, bought only up to it"))
  /** Collections a minute: the traders come at every ledger. */
  const perMinute = 60 / (LEDGER_TICKS * step.dt)
  const goodRows = goodIds.map((g) => {
    const line = el("div", "trade-row")
    const name = el("span", "label")
    name.innerHTML = goodIcon(g, 16)
    name.append(document.createTextNode(goods[g].title))
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
    deal.input.title = `Drag left to sell ${goods[g].title}, right to buy it; the further, the more each time the traders call. Double-click to stop trading it.`
    deal.input.ondblclick = () => parts.send({ type: "trade", good: g, mode: "none" })
    const mode = el("span", "mode")
    const bottom = el("div", "deal-line")
    bottom.append(deal.input, mode)
    line.append(top, bottom)
    store.append(line)
    return { g, value, change, mode, price, deal, line }
  })
  panel.append(store)

  const chronicle = section("chronicle", "chronicle")
  const lines = el("div", "chronicle")
  chronicle.append(lines)
  panel.append(chronicle)

  parts.live(() => {
    const s = parts.town.stats
    if (!s) return
    sub.textContent = `${sizes[s.charter.size].title}, ${lands[s.charter.land].title} land · a ${s.fate.rankTitle} · term ${s.fate.term}, ${s.charter.term} minutes`
    sub.title = `seed ${s.charter.seed}`
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
      ? `A ${s.fate.rankTitle}, the highest rank: keep it standing, term after term.`
      : s.fate.rises !== null
        ? `All met: hold them ${clockText(s.fate.rises)} more and the ${s.fate.rankTitle} is a ${s.fate.nextTitle}.`
        : `A ${s.fate.rankTitle} now: these make it a ${s.fate.nextTitle}.`
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
          `<div class="row"><span class="label">${p.label}</span><span class="count ${p.value > 0 ? "up" : p.value < 0 ? "down" : ""}">${signed(p.value)}</span></div>`
      )
      .join("")
    if (moodParts.dataset.html !== moodHtml) {
      moodParts.dataset.html = moodHtml
      moodParts.innerHTML = moodHtml
    }
    money(taxes, s.taxes)
    supplied.textContent = `+${s.suppliedTaxes}`
    const gap = s.suppliedTaxes - s.taxes
    suppliedNote.textContent = gap > Math.max(10, s.taxes * 0.1) ? `${gap} coins a minute left on the table: a hungry home pays nothing, a cottage with bread pays half again, a fine street a quarter more` : ""
    suppliedNote.style.display = suppliedNote.textContent ? "" : "none"
    money(traded, s.trade)
    money(upkeep, -s.upkeep)
    money(admin, -s.admin)
    money(net, s.net, " coins")
    settlers.textContent = String(s.settlers)
    citizens.textContent = String(s.citizens)
    burghers.textContent = String(s.burghers)
    homes.textContent = String(s.homes)
    work.textContent = `${s.employed} of ${s.jobs}`
    workNote.textContent = s.shortStaffed.length === 0
      ? "every workplace has its crew"
      : `${s.shortStaffed.length} short of workers: ${s.shortStaffed.slice(0, 4).map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? " (nobody within reach)" : ""}`).join(", ")}${s.shortStaffed.length > 4 ? ", …" : ""} · click the jobs counter to visit them`
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
      ? `Wants <b>${s.crown.amount} ${goods[s.crown.good].title}</b> · ${clockText(s.crown.left)} left · +${s.crown.reward} coins`
      : `Next request in ${clockText(s.crown.next)} · ${s.crown.patience} missed in a row ends the term`
    // Goods' change over the last minute of samples.
    const ago = history.minuteAgo()
    reserveValue.textContent = String(s.policy.reserve)
    reserve.sync(s.policy.reserve)
    for (const r of goodRows) {
      const change = ago ? s.stock[r.g] - ago.stock[r.g] : 0
      r.change.textContent = change !== 0 ? `${change > 0 ? "+" : ""}${change}/min` : ""
      r.change.className = `change ${change > 0 ? "up" : "down"}`
      r.value.textContent = String(s.stock[r.g])
      const now: TradeMode = s.policy.sells.includes(r.g) ? "sell" : s.policy.buys.includes(r.g) ? "buy" : "none"
      const load = s.policy.loads[r.g]
      r.deal.sync(now === "sell" ? -load : now === "buy" ? load : 0)
      r.mode.textContent = now === "none" ? "no trade" : `${now} ≤${Math.round(load * perMinute)}/min`
      r.mode.className = `mode ${now}`
      r.line.className = `trade-row ${now}`
      const price = now === "buy" ? askOf(r.g, s.prices[r.g]) : Math.round(priceOf(r.g, s.prices[r.g]) * 10) / 10
      r.price.textContent = `${price}c${s.prices[r.g] !== 100 ? ` (${s.prices[r.g]}%)` : ""}`
      r.price.title = now === "buy" ? "what traders ask for one" : "what traders pay for one"
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
      .map((l) => `<p><b>${clockText(Math.round(l.tick / 60))}</b> ${l.text}</p>`)
      .join("")
    if (lines.dataset.html !== recent) {
      lines.dataset.html = recent
      lines.innerHTML = recent
    }
  })
}
