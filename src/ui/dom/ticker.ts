/**
 * The town ticker: the guide's step first (what to do next, and why), then
 * what needs looking at now, then the news of the last minute and a half.
 * A line goes where it is about on a click; the buildings and tools it names
 * are chips. On a phone the guide's step stays out above the tool bar until
 * tucked into the bulb, which pulses and shows how many things need looking
 * at. Each new alarm in the chronicle is also a toast.
 */
import { kinds, type KindId } from "../../game/content/index.ts"
import type { Interaction, Stats } from "../../view/contracts.ts"
import type { IconName } from "../../view/icons.ts"
import type { Controls, Fold } from "./controls.ts"
import { phone } from "./folds.ts"
import { el, escapeHtml } from "./kit/dom.ts"
import { icon, iconEl } from "./kit/icons.ts"
import { callouts } from "./kit/text.ts"

export const createTicker = (ui: Interaction, fold: () => Fold | null, controls: Pick<Controls, "useRef" | "toast" | "setFold" | "goTo" | "place">) => {
  const ticker = el("div", "card ticker")
  const bulb = el("button", "card")
  bulb.title = "The guide, and what needs looking at now"
  const badge = el("span", "badge")
  bulb.append(iconEl("hint", 16), badge)
  bulb.onclick = () => controls.setFold(fold() === "guide" ? null : "guide")

  /** Ticker lines the mayor has put away, by what they say (and, for news, when). */
  const dismissed = new Set<string>()
  let lines: { guide: Stats["guide"]["step"]; alerts: Stats["alerts"]; news: Stats["chronicle"] } = { guide: null, alerts: [], news: [] }
  /** The last chronicle line announced. */
  let lastNews = ""
  /**
   * A phone's guide: the step stays above the tool bar until the mayor tucks it away (`tucked`: the step and
   * state they tucked; a new step, or the same one under way, comes out again). Tucked away, the bulb pulses,
   * and the first time a toast says where the guide went.
   */
  let stepNow = ""
  let tucked = ""
  let toldWhere = false

  ticker.onclick = (event) => {
    event.stopPropagation()
    const target = event.target as HTMLElement
    // A tool, panel, or map view the line names: pick it, with the map in view.
    const tool = target.closest<HTMLElement>("[data-tool]")
    if (tool) return controls.useRef(tool.dataset.tool!)
    // On a phone: tuck the step away into the bulb, or open the guide in full.
    if (target.closest("[data-tuck]")) {
      tucked = stepNow
      if (!toldWhere) controls.toast("The guide is in the bulb at the top right")
      toldWhere = true
      return
    }
    if (ticker.classList.contains("peek") && !target.closest("[data-kind]")) return controls.setFold("guide")
    const off = target.closest<HTMLElement>("[data-dismiss]")
    if (off) {
      dismissed.add(off.dataset.dismiss!)
      return
    }
    // The guide: put this step away, or turn the guide off (the bottom-right button turns it back on).
    const skip = target.closest<HTMLElement>("[data-skip]")
    if (skip) {
      ui.guide.push({ type: "skip", id: skip.dataset.skip! })
      return
    }
    if (target.closest("[data-guide-off]")) {
      ui.guide.push({ type: "off" })
      controls.toast("Guide off · turn it back on from the bottom right")
      return
    }
    // A building the line is about: go to it.
    const go = target.closest<HTMLElement>("[data-go]")
    if (go) {
      const row = go.closest<HTMLElement>("[data-alert]")
      const there = row ? lines.alerts[Number(row.dataset.alert)]?.places?.[go.dataset.go as KindId] : undefined
      if (there) controls.goTo(there.at, there.size, there.id)
      // The guide's step names the building it points at.
      const guide = lines.guide
      if (!row && go.closest("[data-guide]") && guide?.at) controls.goTo(guide.at, guide.size, guide.id)
      return
    }
    const ref = target.closest<HTMLElement>("[data-kind]")
    if (ref) {
      const kind = ref.dataset.kind as KindId
      // Straight to placing it, with the map in view: the placement itself says if the town cannot build it yet.
      if (kinds[kind].buildable) {
        controls.setFold(null)
        controls.place(kind)
      }
      return
    }
    const line = target.closest<HTMLElement>(".cell.place")
    if (!line) return
    if (line.dataset.guide !== undefined && lines.guide?.at) return controls.goTo(lines.guide.at, lines.guide.size, lines.guide.id)
    const alert = line.dataset.alert !== undefined ? lines.alerts[Number(line.dataset.alert)] : undefined
    if (alert?.at) return controls.goTo(alert.at, alert.size, alert.id)
    const news = line.dataset.news !== undefined ? lines.news[Number(line.dataset.news)] : undefined
    if (news?.at) controls.goTo(news.at, 1, null)
  }

  const update = (s: Stats) => {
    const minute = Math.round(s.minute * 3600)
    const news = s.chronicle.filter((l) => l.alarm && minute - l.tick < 90 * 60).slice(-3).reverse()
    const ago = (tick: number) => {
      const sec = Math.max(0, Math.round((minute - tick) / 60))
      return sec < 5 ? "just now" : sec < 60 ? `${sec} s ago` : `${Math.round(sec / 60)} min ago`
    }
    const alerts = s.alerts.filter((a) => !dismissed.has(`a:${a.text}`))
    // The crown's request has its own card while it is open, and is settled after: its news line would only repeat it.
    const fresh = news.filter((l) => !dismissed.has(`n:${l.tick}:${l.text}`) && !l.text.startsWith("The crown asks"))
    const toneIcon = { hint: "hint", warn: "caution", bad: "warning" } as const
    const row = (kind: string, tone: string, glyph: IconName, text: string, place: boolean, key: string, data: string) =>
      `<div class="cell ${kind} ${tone}${place ? " place" : ""}" ${data}>${icon(glyph, 16, "mark")}<span class="text">${text}</span><span class="acts">${place ? `<button class="act locate" title="Show me where">${icon("locate", 14)}</button>` : ""}<button class="act dismiss" data-dismiss="${escapeHtml(key)}" title="Dismiss">${icon("close", 12)}</button></span></div>`
    // The guide's step first: what to do next, and why.
    const g = s.guide.step
    const guideHtml = g
      ? (() => {
          const asks = new Set(g.asks)
          const say = (text: string) => callouts(text, new Set(g.near ? [g.near] : []), asks)
          const count = g.count ? `step ${g.count.at} of ${g.count.of}` : ""
          return [
            `<div class="head guide"><span>guide · ${escapeHtml(g.chapter)}</span><span class="progress" title="${g.count ? "The first steps of a new town" : ""}">${count}</span><button class="quiet" data-guide-off title="Turn the guide off (the guide button in the bottom right turns it back on)">hide guide</button></div>`,
            `<div class="cell alert hint guide${g.waiting ? " waiting" : g.locked ? " locked" : ""}${g.at !== null ? " place" : ""}" data-guide>${icon(g.waiting ? "clock" : g.locked ? "caution" : "hint", 16, "mark")}<span class="text">` +
              `<span class="do">${say(g.text)}</span>` +
              (g.waiting ? `<span class="why now">${say(g.waiting)}</span>` : g.locked ? `<span class="why now">${say(g.locked)}</span>` : `<span class="why">${say(g.why)}</span>`) +
              `<span class="goal">${icon("goal", 12)}<span>done when ${say(g.goal)}</span></span>` +
              (g.next ? `<span class="goal next">${icon("clock", 12)}<span>${say(g.next)}</span></span>` : "") +
              `</span>` +
              `<span class="acts">${g.at !== null ? `<button class="act locate" title="Show me where">${icon("locate", 14)}</button>` : ""}<button class="act dismiss" data-skip="${escapeHtml(g.key)}" title="Skip this step">${icon("close", 12)}</button></span>` +
              `<button class="act tuck" data-tuck title="Hide: the guide stays in the bulb at the top right">${icon("close", 12)}</button></div>`
          ]
        })()
      : []
    const tickerHtml = [
      ...guideHtml,
      ...(alerts.length > 0 ? [`<div class="head">now</div>`] : []),
      ...alerts.map((a) => row("alert", a.tone, toneIcon[a.tone], callouts(a.text, new Set(Object.keys(a.places ?? {}) as Array<KindId>)), a.at !== null, `a:${a.text}`, `data-alert="${s.alerts.indexOf(a)}"`)),
      ...(fresh.length > 0 ? [`<div class="head">lately</div>`] : []),
      ...fresh.map((l) => row("news", "", "chronicle", `${callouts(l.text)} <em data-tick="${l.tick}"></em>`, l.at !== null, `n:${l.tick}:${l.text}`, `data-news="${news.indexOf(l)}"`))
    ].join("")
    if (ticker.dataset.html !== tickerHtml) {
      ticker.dataset.html = tickerHtml
      ticker.innerHTML = tickerHtml
    }
    for (const em of ticker.querySelectorAll<HTMLElement>("em[data-tick]")) {
      const text = ago(Number(em.dataset.tick))
      if (em.textContent !== text) em.textContent = text
    }
    lines = { guide: g, alerts: s.alerts, news }
    ticker.classList.toggle("show", tickerHtml !== "" && s.fate.state === "playing")
    // The phone's guide button: the step it is on, or how many things need looking at.
    const bad = alerts.some((a) => a.tone === "bad")
    const things = alerts.length + (g ? 1 : 0)
    const said = g?.count ? `${g.count.at}/${g.count.of}` : things > 0 ? String(things) : ""
    if (badge.textContent !== said) badge.textContent = said
    bulb.classList.toggle("alert", bad)
    // On a phone the step stays out above the tool bar, until tucked away; not behind the town picker or an open sheet.
    const stepKey = g ? `${g.key}${g.waiting ? ":under way" : g.locked ? ":locked" : ""}` : ""
    stepNow = stepKey
    const peeking = stepKey !== "" && phone.matches && fold() === null && tucked !== stepKey && !ui.founding && s.fate.state === "playing"
    if (ticker.classList.contains("peek") !== peeking) ticker.classList.toggle("peek", peeking)
    document.body.classList.toggle("peeking", peeking)
    const nudge = stepKey !== "" && phone.matches && tucked === stepKey && fold() !== "guide"
    if (bulb.classList.contains("nudge") !== nudge) bulb.classList.toggle("nudge", nudge)
    // News as it happens: a toast for each new alarm line.
    const latest = s.chronicle.at(-1)
    const seen = `${s.charter.seed}|${latest?.tick ?? -1}|${s.chronicle.length}`
    if (seen !== lastNews) {
      if (lastNews !== "" && latest?.alarm && minute - latest.tick < 120) controls.toast(latest.text)
      lastNews = seen
    }
  }

  return { element: ticker, bulb, update }
}
