/**
 * What upgrading a building would cost and give, said in full before the
 * mayor pays, with the button that begins it.
 */
import { goods, type GoodId } from "../../../game/content/index.ts"
import type { Line, Panel } from "../../../view/contracts.ts"
import type { IconName } from "../../../view/icons.ts"
import { el } from "../kit/dom.ts"
import { syncLines } from "../kit/lines.ts"
import { section } from "../kit/section.ts"
import type { PanelParts } from "./frame.ts"

/** An upgrade's gain as a row: what changes, on the left; from what to what, on the right. */
const gainLine = (change: string): Line => {
  const at = change.search(/[+−-]?\d/)
  const label = at > 0 ? change.slice(0, at).trim() : change, rest = at > 0 ? change.slice(at) : undefined
  // "+6 → +8, out to 6 cells": the change on the right, what qualifies it under it.
  const [value, note] = rest?.includes(", ") ? [rest.slice(0, rest.indexOf(", ")), rest.slice(rest.indexOf(", ") + 2)] : [rest, undefined]
  const glyph: IconName =
    /^holds/.test(change) ? "build" : /^carriers/.test(change) ? "trade" : /^walker|^a walker/.test(change) ? "people"
    : /^administration/.test(change) ? "taxes" : /^desirability/.test(change) ? "appeal" : /^workers/.test(change) ? "workers"
    : /^firefighters/.test(change) ? "fire" : /rock/.test(change) ? "stone" : /a minute/.test(change) ? "jobs" : "goal"
  return { icon: glyph, label, value, note, tone: "ok" }
}
/**
 * What upgrading a building would cost and give, said in full before the mayor pays: what is paid now, what
 * carriers bring later and the upkeep after; then what it gives. The button that begins it comes last, alone.
 */
export const upgradeBox = (parts: PanelParts, offer: NonNullable<Extract<Panel, { type: "building" }>["upgrade"]>) => {
  const box = section(`upgrade to ${offer.title.toLowerCase()}`, "build", offer.blurb)
  box.classList.add("lines", "upgrade")
  // Why the town needs it now (the gold arrow over it), or that it can wait.
  const needed = el("p", "needed", "")
  const pays = el("div", "part"), gets = el("div", "part")
  const payRows: Array<HTMLElement> = [], getRows: Array<HTMLElement> = []
  const upkeep = offer.changes.find((c) => c.startsWith("upkeep"))
  syncLines(parts.pictures, gets, getRows, offer.changes.filter((c) => c !== upkeep).map(gainLine))
  const begin = el("button", "frame primary", `Begin the ${offer.title.toLowerCase()}`)
  begin.onclick = () => {
    const now = parts.town.panel
    if (now?.type === "building") parts.send({ type: "upgrade", cell: now.cell })
  }
  const why = el("p", "sub", "")
  parts.live(() => {
    const now = parts.town.panel
    if (now?.type !== "building" || !now.upgrade) return
    needed.textContent = now.upgrade.needed ? `needed now: ${now.upgrade.needed}` : "not needed yet: the gold arrow shows when it is"
    needed.classList.toggle("now", now.upgrade.needed !== null)
    const coins = parts.town.stats?.coins ?? 0, stock = parts.town.stats?.stock
    const materials = (Object.entries(offer.cost.materials) as Array<[GoodId, number]>).filter(([, n]) => n > 0)
    const lacking = materials.filter(([g, n]) => (stock?.[g] ?? 0) < n).map(([g, n]) => `${n - (stock?.[g] ?? 0)} ${goods[g].title}`)
    syncLines(parts.pictures, pays, payRows, [
      { icon: "coins", label: "now, to begin", value: `${offer.cost.coins} coins`, tone: coins < offer.cost.coins ? "bad" : undefined,
        note: coins < offer.cost.coins ? `${offer.cost.coins - coins} coins short` : undefined },
      ...(materials.length > 0
        ? [{ icon: "trade", label: "later, carried in", goods: materials.map(([good, count]) => ({ good, count })), tone: lacking.length > 0 ? "warn" : undefined,
            note: lacking.length > 0 ? `the store lacks ${lacking.join(", ")}: the works wait for them` : "from the store: the works go on as they come" } as Line]
        : []),
      ...(upkeep ? [{ icon: "upkeep", label: "upkeep after", value: upkeep.replace(/^upkeep /, "") } as Line] : [])
    ])
    begin.disabled = now.upgrade.blocked !== null || now.upgrade.short !== null
    why.textContent = now.upgrade.blocked ?? now.upgrade.short ?? "it goes on working while the works go on, and scaffolding rises inside its plot"
  })
  const footer = el("div", "begin")
  footer.append(begin, why)
  box.append(needed, el("p", "cap", "you pay"), pays, el("p", "cap", "you get"), gets, footer)
  return box
}
