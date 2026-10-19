/**
 * Phones: the HUD folds away. On a small screen only the top line and the
 * tool bar stay out; the goods, the guide, the map views, and the system
 * buttons each open on a tap, one at a time, and a tap on the map folds them
 * again.
 */
import type { Interaction } from "../../view/contracts.ts"
import type { Fold } from "./controls.ts"

export const phone = window.matchMedia("(max-width: 760px), (max-height: 500px)")

/** `buttons`: what opens each fold; `covered`: a fold opened over the panel, which closes it. */
export const createFolds = (ui: Interaction, buttons: Readonly<Record<Fold, HTMLElement>>, ticker: HTMLElement, covered: () => void) => {
  let fold: Fold | null = null
  const setFold = (next: Fold | null) => {
    fold = next
    for (const f of ["goods", "guide", "views", "more"] as const) document.body.classList.toggle(`fold-${f}`, f === next)
    buttons.goods.classList.toggle("on", next === "goods")
    buttons.guide.classList.toggle("on", next === "guide")
    buttons.views.classList.toggle("on", next === "views" || ui.view !== "none")
    buttons.more.classList.toggle("on", next === "more")
    if (next !== null) {
      ticker.classList.remove("peek")
      // The panel and a fold would cover each other: the fold wins.
      if (ui.menu !== null || ui.selected !== null) covered()
    }
  }
  return {
    fold: () => fold,
    setFold,
    toggleFold: (f: Fold) => setFold(fold === f ? null : f)
  }
}
