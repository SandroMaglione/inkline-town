/** The build menu: every building by category, then the park pieces, each with its cost, what it does, and its picture. */
import {
  categoryColor, categoryOrder, goods, groundIds, grounds, home, kindOrder, kinds, park as parkRules, propIds, props, type Category, type GroundId, type Kind, type ParkPiece, type PropId
} from "../../../game/content/index.ts"
import type { IconName } from "../../../view/icons.ts"
import type { Controls } from "../controls.ts"
import { costChips } from "../kit/cost-chips.ts"
import { el, hex } from "../kit/dom.ts"
import { goodIcon, icon, iconEl } from "../kit/icons.ts"
import { thumb } from "../kit/picture.ts"
import { section } from "../kit/section.ts"
import { touchScreen } from "../kit/text.ts"
import type { PanelParts } from "./frame.ts"

const categoryIcon: Readonly<Record<Category, IconName>> = {
  storage: "jobs",
  gathering: "wood",
  crafts: "tools",
  food: "bread",
  services: "faith"
}

/** What keeps the town from building it yet, if anything. */
const lockText = (parts: PanelParts, kind: Pick<Kind, "unlock"> | ParkPiece): string | null => {
  const s = parts.town.stats
  if (!s) return null
  const residents = s.settlers + s.citizens
  if (residents < kind.unlock.residents) return `needs ${kind.unlock.residents} residents`
  if (s.citizens < kind.unlock.citizens) return `needs ${kind.unlock.citizens} citizens`
  return null
}

export const buildMenu = (parts: PanelParts, controls: Pick<Controls, "place" | "layGround" | "furnish">) => {
  const { element: panel, ui } = parts
  const has = () => parts.town.stats
  panel.append(parts.header("build", iconEl("build", 30), el("p", "sub", touchScreen() ? "Pick one, then tap the map where it goes" : "Pick one, then click the map · Esc to stop")))
  for (const category of categoryOrder) {
    const options = kindOrder.filter((id) => kinds[id].category === category && kinds[id].buildable)
    if (options.length === 0) continue
    const box = section(category, categoryIcon[category])
    box.style.borderTop = `3px solid ${hex(categoryColor[category])}`
    for (const id of options) {
      const kind = kinds[id]
      const option = el("button", "option")
      const cost = costChips(kind.cost, has)
      cost.box.prepend(el("span", "cap", "cost"))
      const terms = el("span", "chips")
      const r = kind.recipe
      const does = [
        r ? `<span class="chip" title="${r.input ? `turns ${r.inputs} ${goods[r.input].title} into ${r.batch} ${goods[r.output].title}` : `makes ${r.batch} ${goods[r.output].title}`} every ${r.seconds} s">${r.input ? `${goodIcon(r.input, 14)}<i>→</i>` : ""}${goodIcon(r.output, 14)}${r.batch > 1 ? r.batch : ""}</span>` : "",
        kind.service ? `<span class="chip" title="its walkers serve the homes within ${kind.service.range} road cells of its door">${icon(kind.service.service === "goods" ? "trade" : kind.service.service === "faith" ? "faith" : kind.service.service === "repair" ? "repair" : kind.service.service, 14)}${kind.service.range}</span>` : "",
        kind.holds && !kind.recipe && !kind.service ? `<span class="chip" title="holds up to ${kind.holds.cap} of each good${kind.keeps ? `, and keeps food ${kind.keeps} times as long` : ""}">${icon("jobs", 14)}${kind.holds.cap}</span>` : "",
        kind.workers > 0 ? `<span class="chip dim" title="${kind.workers} ${kind.crew} to work it, from homes within 15 road cells">${icon(kind.crew === "citizens" ? "citizens" : "settlers", 14)}${kind.workers}</span>` : "",
        kind.appeal ? `<span class="chip ${kind.appeal.value < 0 ? "bad" : "good"}" title="desirability ${kind.appeal.value > 0 ? "+" : ""}${kind.appeal.value} beside it, out to ${kind.appeal.reach} cells${kind.appeal.value < 0 ? ": keep homes away" : ": homes like it"}">${icon("appeal", 14)}${kind.appeal.value > 0 ? "+" : ""}${kind.appeal.value}</span>` : "",
        `<span class="chip dim" title="upkeep: coins a minute while it stands (a quarter when paused)">${icon("upkeep", 14)}${kind.upkeep}/min</span>`
      ].join("")
      terms.innerHTML = `<span class="cap">does</span>${does}`
      const blurb = el("span", "blurb", kind.blurb)
      option.append(thumb(parts.pictures, id), el("span", "name", kind.title.toLowerCase()), cost.box, terms, blurb)
      option.title = `${kind.title}: ${kind.blurb}${kind.workers > 0 ? ` · ${kind.workers} ${kind.crew === "citizens" ? "citizen" : "settler"} workers from within 15 road cells` : ""}${kind.service ? ` · walkers reach ${kind.service.range} road cells` : ""}${kind.appeal ? ` · desirability ${kind.appeal.value > 0 ? "+" : ""}${kind.appeal.value} out to ${kind.appeal.reach} cells` : ""} · ${kind.upkeep} coins a minute`
      option.onclick = () => controls.place(id)
      parts.live(() => {
        const lock = lockText(parts, kind)
        const short = cost.refresh()
        option.disabled = lock !== null
        option.classList.toggle("short", lock === null && short)
        blurb.textContent = lock ?? kind.blurb
      })
      box.append(option)
    }
    panel.append(box)
  }
  // Parks are laid out piece by piece: ground first, then what stands on it.
  const parks = section(
    "parks",
    "decor",
    `Lay ground, then set furnishings on it. Ground that touches is one park: the more it holds the nicer the streets around it (citizens need ${home.tiers[2].appeal}, townhouses ${home.tiers[3].appeal}). One furnishing counts for every ${parkRules.cellsPerProp} cells; where parks meet, the finest counts in full.`
  )
  parks.style.borderTop = "3px solid #4f9a6a"
  const pieces: ReadonlyArray<{ readonly id: GroundId | PropId; readonly piece: ParkPiece; readonly pick: () => void; readonly ground: boolean }> = [
    ...groundIds.map((id) => ({ id, piece: grounds[id], pick: () => controls.layGround(id), ground: true })),
    ...propIds.map((id) => ({ id, piece: props[id], pick: () => controls.furnish(id), ground: false }))
  ]
  for (const { id, piece, pick, ground } of pieces) {
    if (ground && id === "lawn") parks.append(el("p", "empty", "ground · drag a rectangle"))
    if (!ground && id === "lamp") parks.append(el("p", "empty", "furnishings · click a cell of park"))
    const option = el("button", "option")
    const cost = costChips(piece.cost, has)
    cost.box.prepend(el("span", "cap", "cost"))
    const terms = el("span", "chips")
    terms.innerHTML = `<span class="cap">does</span><span class="chip good" title="beauty it adds to its park">${icon("appeal", 14)}+${piece.beauty}</span><span class="chip dim" title="upkeep, coins a minute">${icon("upkeep", 14)}${piece.upkeep}/min</span>`
    const blurb = el("span", "blurb", piece.blurb)
    option.append(thumb(parts.pictures, `park:${id}`), el("span", "name", piece.title.toLowerCase()), cost.box, terms, blurb)
    option.title = `${piece.title}: ${piece.blurb} · beauty +${piece.beauty}${ground ? " a cell" : ""} · ${piece.upkeep} coins a minute`
    option.onclick = pick
    parts.live(() => {
      const lock = lockText(parts, piece)
      const short = cost.refresh()
      option.disabled = lock !== null
      option.classList.toggle("short", lock === null && short)
      option.classList.toggle("on", (ground ? ui.tool === "ground" && ui.ground === id : ui.tool === "prop" && ui.prop === id))
      blurb.textContent = lock ?? piece.blurb
    })
    parks.append(option)
  }
  panel.append(parks)
}
