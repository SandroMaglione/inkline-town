/**
 * The map views (`view/tools.ts`), and the legend of the one shown. On a
 * phone the list folds away once one is chosen, so the map shows.
 */
import type { Interaction, Legend, View } from "../../view/contracts.ts"
import { mapViews, type MapViewId } from "../../view/tools.ts"
import type { Controls } from "./controls.ts"
import { el, hex } from "./kit/dom.ts"
import { iconEl } from "./kit/icons.ts"

export const createMapViews = (ui: Interaction, controls: Pick<Controls, "setView">) => {
  const views = el("div", "views")
  const legend = el("div", "card legend")
  const viewsTitle = el("div", "views-title", "map overlays")
  viewsTitle.title = "Colour the map by one of these, to see where the town is doing well or badly. Press the key again (or click) to hide it."
  views.append(viewsTitle)
  const buttons = (Object.keys(mapViews) as Array<MapViewId>).map((view) => {
    const v = mapViews[view]
    const button = el("button", "")
    button.title = `Show ${v.label} over the map (${v.key}); again to hide it`
    button.append(iconEl(v.icon, 15), document.createTextNode(v.label), el("kbd", "", v.key))
    button.onclick = () => controls.setView(ui.view === view ? "none" : view)
    views.append(button)
    return { view, button }
  })
  return {
    list: views,
    legend,
    /** Shows which view is on. */
    show: (view: View) => {
      for (const v of buttons) v.button.classList.toggle("on", v.view === view)
    },
    /** The legend of the view shown, if any. */
    showLegend: (l: Legend | null) => {
      const html = l
        ? `<b>${l.title}</b>${l.keys.map((k) => `<span class="key"><i style="background:${hex(k.color)}"></i>${k.label}</span>`).join("")}<small>${l.note}</small>`
        : ""
      if (legend.dataset.html !== html) {
        legend.dataset.html = html
        legend.innerHTML = html
      }
      legend.classList.toggle("show", l !== null)
    }
  }
}
