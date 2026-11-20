/**
 * What upgrading a building would cost and give, said in full before the
 * mayor pays, with the button that begins it.
 */
import type { GoodId } from "../../../game/content/index.ts"
import type { Line, Panel } from "../../../view/contracts.ts"
import type { IconName } from "../../../view/icons.ts"
import { el } from "../kit/dom.ts"
import { syncLines } from "../kit/lines.ts"
import { section } from "../kit/section.ts"
import type { PanelParts } from "./frame.ts"

type Building = Extract<Panel, { readonly type: "building" }>
type Offer = NonNullable<Building["upgrade"]>
type Gain = Offer["gains"][number]

/** The icon of each thing an upgrade changes: the view says which it is, and the page draws it. */
const gainIcon: Readonly<Record<Gain["what"], IconName>> = {
  output: "jobs",
  workers: "workers",
  holds: "build",
  carriers: "trade",
  firefighters: "fire",
  reach: "people",
  calls: "people",
  deep: "stone",
  admin: "taxes",
  appeal: "appeal",
  upkeep: "upkeep"
}

/** An upgrade's gain as a row: what changes, on the left; from what to what, on the right; what qualifies it under it. */
const gainLine = (gain: Gain): Line => ({ icon: gainIcon[gain.what], label: gain.label, value: gain.value, note: gain.note, tone: "ok" })

/**
 * What upgrading a building would cost and give, said in full before the mayor pays: what is paid now, what
 * carriers bring later and the upkeep after; then what it gives. The button that begins it comes last, alone.
 */
export const upgradeBox = (parts: PanelParts, building: Building, offer: Offer) => {
  const { t } = parts
  const said = t.page.upgrade
  const to = building.level + 1
  const box = section(t, said.title(building.kind, to), "build", offer.blurb)
  box.classList.add("lines", "upgrade")
  // Why the town needs it now (the gold arrow over it), or that it can wait.
  const needed = el("p", "needed", "")
  const pays = el("div", "part"), gets = el("div", "part")
  const payRows: Array<HTMLElement> = [], getRows: Array<HTMLElement> = []
  // The upkeep after is a cost: it goes with what is paid, not with what is got.
  const upkeep = offer.gains.find((g) => g.what === "upkeep")
  syncLines(t, parts.pictures, gets, getRows, offer.gains.filter((g) => g !== upkeep).map(gainLine))
  const begin = el("button", "frame primary", said.begin(building.kind, to))
  begin.onclick = () => {
    const now = parts.town.panel
    if (now?.type === "building") parts.send({ type: "upgrade", cell: now.cell })
  }
  const why = el("p", "sub", "")
  parts.live(() => {
    const now = parts.town.panel
    if (now?.type !== "building" || !now.upgrade) return
    needed.textContent = now.upgrade.needed ? said.needed(now.upgrade.needed) : said.notNeeded
    needed.classList.toggle("now", now.upgrade.needed !== null)
    const coins = parts.town.stats?.coins ?? 0, stock = parts.town.stats?.stock
    const materials = (Object.entries(offer.cost.materials) as Array<[GoodId, number]>).filter(([, n]) => n > 0)
    const lacking = materials.filter(([g, n]) => (stock?.[g] ?? 0) < n).map(([good, n]) => ({ good, count: n - (stock?.[good] ?? 0) }))
    const lines: Array<Line> = [
      { icon: "coins", label: said.now, value: said.price(offer.cost.coins), tone: coins < offer.cost.coins ? "bad" : undefined,
        note: coins < offer.cost.coins ? said.short(offer.cost.coins - coins) : undefined }
    ]
    if (materials.length > 0)
      lines.push({ icon: "trade", label: said.later, goods: materials.map(([good, count]) => ({ good, count })), tone: lacking.length > 0 ? "warn" : undefined,
        note: lacking.length > 0 ? said.lacks(lacking) : said.fromStore })
    if (upkeep) lines.push({ icon: "upkeep", label: said.upkeepAfter, value: upkeep.value })
    syncLines(t, parts.pictures, pays, payRows, lines)
    begin.disabled = now.upgrade.blocked !== null || now.upgrade.short !== null
    why.textContent = now.upgrade.blocked ?? now.upgrade.short ?? said.goesOn
  })
  const footer = el("div", "begin")
  footer.append(begin, why)
  box.append(needed, el("p", "cap", said.pay), pays, el("p", "cap", said.get), gets, footer)
  return box
}
