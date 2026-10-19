/** A cost as icon chips, each marked when the town is short of it. */
import { goods, type GoodId, type Kind } from "../../../game/content/index.ts"
import { el } from "./dom.ts"
import { goodIcon, icon } from "./icons.ts"

/** What the town has, for the chips to compare against; `null` before the first frame. */
export type Holdings = () => { readonly coins: number; readonly stock: Readonly<Record<GoodId, number>> } | null

export const costChips = (cost: Kind["cost"], has: Holdings) => {
  const box = el("span", "chips")
  const chips: Array<{ chip: HTMLElement; short: () => boolean }> = []
  if (cost.coins > 0) {
    const chip = el("span", "chip")
    chip.innerHTML = `${icon("coins", 14)}${cost.coins}`
    chips.push({ chip, short: () => (has()?.coins ?? 0) < cost.coins })
  }
  for (const [g, n] of Object.entries(cost.materials) as Array<[GoodId, number]>) {
    const chip = el("span", "chip")
    chip.title = goods[g].title
    chip.innerHTML = `${goodIcon(g, 14)}${n}`
    chips.push({ chip, short: () => (has()?.stock[g] ?? 0) < n })
  }
  box.append(...chips.map((c) => c.chip))
  const refresh = () => {
    let short = false
    for (const c of chips) {
      const now = c.short()
      c.chip.classList.toggle("short", now)
      short ||= now
    }
    return short
  }
  return { box, refresh }
}
