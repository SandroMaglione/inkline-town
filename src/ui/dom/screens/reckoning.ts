/**
 * The end of the term: the reckoning. Its verdict, the term in numbers, a
 * chart of residents, coins, and approval over it, and its chronicle; then
 * another term, a new town, or a last look.
 */
import { sizes } from "../../../game/content/index.ts"
import type { Edit } from "../../../game/edits.ts"
import type { Interaction, Stats } from "../../../view/contracts.ts"
import type { Controls } from "../controls.ts"
import { el } from "../kit/dom.ts"
import { clockText, signed } from "../kit/text.ts"
import { verdictOf } from "./share-card.ts"

export const createReckoning = (ui: Interaction, stats: () => Stats | null, send: (edit: Edit) => void, controls: Pick<Controls, "openCharter" | "openShare">) => {
  const reckoning = el("div", "dialog")
  const result = el("button", "result", "")
  result.onclick = () => showReckoning(true)
  /** Lines of residents, coins, and approval over the term, on the term's own time axis. */
  const chart = (s: Stats): string => {
    const w = 520
    const h = 150
    const from = s.fate.began * 3600
    const span = s.charter.term * 3600
    const history = s.history.filter((p) => p.tick >= from)
    const line = (values: ReadonlyArray<number>, lo: number, hi: number, color: string, dash = "") => {
      if (values.length < 2) return ""
      const range = hi - lo || 1
      const points = history
        .map((p, i) => `${(((p.tick - from) / span) * w).toFixed(1)},${(h - 4 - ((values[i]! - lo) / range) * (h - 8)).toFixed(1)}`)
        .join(" ")
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="${dash}" vector-effect="non-scaling-stroke"/>`
    }
    const residents = history.map((p) => p.residents)
    const coinsLine = history.map((p) => p.coins)
    const approvalLine = history.map((p) => p.approval)
    const target = s.goals.find((g) => g.id === "residents")?.target ?? sizes[s.charter.size].goal.residents
    const top = Math.max(1, ...residents, target)
    const goal = h - 4 - (target / top) * (h - 8)
    // The first term spares its first year a winter; later terms do not.
    const winters = Array.from({ length: 6 }, (_, y) => {
      if (y === 0 && s.fate.term === 1) return ""
      const at = ((y + 0.7) / 6) * w
      return `<rect x="${at.toFixed(1)}" y="0" width="${((w * 0.3) / 6).toFixed(1)}" height="${h}" fill="#3d6db5" opacity="0.06"/>`
    }).join("")
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${winters}<line x1="0" x2="${w}" y1="${goal}" y2="${goal}" stroke="#77817a" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>${line(coinsLine, Math.min(0, ...coinsLine), Math.max(1, ...coinsLine), "#d6ae2e")}${line(approvalLine, -100, 100, "#3d6db5", "4 3")}${line(residents, 0, top, "#3d4943")}</svg>`
  }
  let reckoned = ""
  let reckoningOpen = false
  const showReckoning = (open: boolean) => {
    reckoningOpen = open
    const s = stats()
    reckoning.classList.toggle("open", open && s !== null && s.fate.state !== "playing")
  }
  const syncReckoning = (s: Stats) => {
    const over = s.fate.state !== "playing"
    result.classList.toggle("show", over && !reckoningOpen && !ui.founding)
    if (!over) {
      reckoned = ""
      reckoning.classList.remove("open")
      return
    }
    const id = `${s.charter.seed}|${s.fate.state}|${s.fate.at}`
    result.textContent = s.fate.state === "lost" ? "the term is lost · see how" : `term ${s.fate.term} is over · see how`
    if (id === reckoned) return
    reckoned = id
    const title = s.fate.state === "lost" ? s.fate.reason.split(":")[0]!.toLowerCase() : `term ${s.fate.term} is over: ${verdictOf(s)}`
    reckoning.replaceChildren()
    const card = el("div", "sheet wide")
    card.append(el("h2", "", title), el("p", "sub", s.fate.reason))
    const facts = el("div", "facts")
    const fact = (label: string, value: string) => {
      const f = el("div", "fact")
      f.append(el("b", "", value), el("span", "", label))
      facts.append(f)
    }
    fact("rank", s.fate.rankTitle)
    fact("minutes in office", `${Math.round(s.fate.at)}`)
    fact("residents", `${s.settlers + s.citizens}`)
    fact("citizens · burghers", `${s.citizens} · ${s.burghers}`)
    fact("coins", `${s.coins}`)
    fact("approval", signed(s.mood.approval))
    fact("crown met · missed", `${s.crown.met} · ${s.crown.missed}`)
    fact("score", `${s.fate.score}`)
    card.append(facts)
    const graph = el("div", "chart")
    graph.innerHTML = chart(s)
    card.append(graph, el("p", "legend", "— residents (dashed: the next rank) · coins · - - approval · shaded: winters"))
    const story = el("div", "chronicle")
    story.innerHTML = s.chronicle
      .filter((l) => l.tick >= s.fate.began * 3600)
      // Timed from the start of this term, as its chart is.
      .map((l) => `<p><b>${clockText(Math.round((l.tick - s.fate.began * 3600) / 60))}</b> ${l.text}</p>`)
      .join("")
    card.append(story)
    const actions = el("div", "actions")
    if (s.fate.state === "over") {
      const stand = el("button", "frame primary", "Next term")
      stand.title = `Stand for another ${s.charter.term} minutes: the same town, new winters, and the crown's requests start small again`
      stand.onclick = () => {
        send({ type: "nextTerm" })
        showReckoning(false)
      }
      actions.append(stand)
    }
    const again = el("button", "frame" + (s.fate.state === "over" ? "" : " primary"), s.fate.state === "over" ? "Retire: found a new town" : "Found a new town")
    again.onclick = () => {
      showReckoning(false)
      controls.openCharter(true)
    }
    const look = el("button", "frame", "Look at the town")
    look.onclick = () => showReckoning(false)
    const share = el("button", "frame", "Share the town")
    share.title = "A picture of the town and its verdict, or a link anyone can open"
    share.onclick = () => controls.openShare()
    actions.append(again, look, share)
    card.append(actions)
    reckoning.append(card)
    showReckoning(true)
  }
  return { element: reckoning, result, show: showReckoning, sync: syncReckoning, isOpen: () => reckoning.classList.contains("open") }
}
