/** The build menu: every building by category, then the park pieces, each with its cost, what it does, and its picture. */
import {
  categoryColor, categoryOrder, groundIds, grounds, kindOrder, kinds, propIds, props, type Category, type GroundId, type Kind, type ParkPiece, type PropId
} from "../../../game/content/index.ts"
import type { IconName } from "../../../view/icons.ts"
import type { Controls } from "../controls.ts"
import { costChips } from "../kit/cost-chips.ts"
import { el, escapeHtml, hex } from "../kit/dom.ts"
import { goodIcon, icon, iconEl } from "../kit/icons.ts"
import { thumb } from "../kit/picture.ts"
import { section } from "../kit/section.ts"
import { words } from "../kit/text.ts"
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
  if (residents < kind.unlock.residents) return parts.t.page.build.needsResidents(kind.unlock.residents)
  if (s.citizens < kind.unlock.citizens) return parts.t.page.build.needsCitizens(kind.unlock.citizens)
  return null
}

export const buildMenu = (parts: PanelParts, controls: Pick<Controls, "place" | "layGround" | "furnish">) => {
  const { element: panel, ui, t } = parts
  const said = t.page.build
  const has = () => parts.town.stats
  /** A chip: its look, what it says on hover, and what it shows (markup). */
  const chip = (look: string, title: string, shown: string) => `<span class="${look}" title="${escapeHtml(title)}">${shown}</span>`
  const perMinute = escapeHtml(t.amount.perMinute)
  panel.append(parts.header(said.title, iconEl("build", 30), el("p", "sub", words(t, said.sub))))
  for (const category of categoryOrder) {
    const options = kindOrder.filter((id) => kinds[id].category === category && kinds[id].buildable)
    if (options.length === 0) continue
    const box = section(t, said.categories[category], categoryIcon[category])
    box.style.borderTop = `3px solid ${hex(categoryColor[category])}`
    for (const id of options) {
      const kind = kinds[id]
      const option = el("button", "option")
      const cost = costChips(t, kind.cost, has)
      cost.box.prepend(el("span", "cap", said.cost))
      const terms = el("span", "chips")
      const r = kind.recipe
      const citizens = kind.crew === "citizens"
      const does = [
        r ? chip("chip", said.recipe(r), `${r.input ? `${goodIcon(r.input, 14)}<i>→</i>` : ""}${goodIcon(r.output, 14)}${r.batch > 1 ? r.batch : ""}`) : "",
        kind.service
          ? chip("chip", said.serves(kind.service.range), `${icon(kind.service.service === "goods" ? "trade" : kind.service.service === "faith" ? "faith" : kind.service.service === "repair" ? "repair" : kind.service.service, 14)}${kind.service.range}`)
          : "",
        kind.holds && !kind.recipe && !kind.service ? chip("chip", said.holds(kind.holds.cap, kind.keeps ?? null), `${icon("jobs", 14)}${kind.holds.cap}`) : "",
        kind.workers > 0 ? chip("chip dim", said.crew(kind.workers, citizens ? 2 : 1), `${icon(citizens ? "citizens" : "settlers", 14)}${kind.workers}`) : "",
        kind.appeal
          ? chip(`chip ${kind.appeal.value < 0 ? "bad" : "good"}`, said.appeal(kind.appeal.value, kind.appeal.reach), `${icon("appeal", 14)}${kind.appeal.value > 0 ? "+" : ""}${kind.appeal.value}`)
          : "",
        chip("chip dim", said.upkeep, `${icon("upkeep", 14)}${kind.upkeep}${perMinute}`)
      ].join("")
      terms.innerHTML = `<span class="cap">${escapeHtml(said.does)}</span>${does}`
      const what = t.kind.blurb(id)
      const blurb = el("span", "blurb", what)
      option.append(thumb(parts.pictures, id), el("span", "name", t.kind.name(id)), cost.box, terms, blurb)
      option.title = said.option(id, {
        workers: kind.workers,
        citizens,
        range: kind.service?.range ?? null,
        appeal: kind.appeal ? { value: kind.appeal.value, reach: kind.appeal.reach } : null,
        upkeep: kind.upkeep
      })
      option.onclick = () => controls.place(id)
      parts.live(() => {
        const lock = lockText(parts, kind)
        const short = cost.refresh()
        option.disabled = lock !== null
        option.classList.toggle("short", lock === null && short)
        blurb.textContent = lock ?? what
      })
      box.append(option)
    }
    panel.append(box)
  }
  // Parks are laid out piece by piece: ground first, then what stands on it.
  const parks = section(t, said.parks.title, "decor", said.parks.help)
  parks.style.borderTop = "3px solid #4f9a6a"
  /** A park piece: what it is called (as a heading, and in the list) and is for, in the page's language. */
  interface Piece {
    readonly id: GroundId | PropId
    readonly piece: ParkPiece
    readonly said: { readonly title: string; readonly name: string; readonly blurb: string }
    readonly pick: () => void
    readonly ground: boolean
  }
  const pieces: ReadonlyArray<Piece> = [
    ...groundIds.map((id) => ({ id, piece: grounds[id], said: { title: t.ground.title(id), name: t.ground.name(id), blurb: t.ground.blurb(id) }, pick: () => controls.layGround(id), ground: true })),
    ...propIds.map((id) => ({ id, piece: props[id], said: { title: t.prop.title(id), name: t.prop.name(id), blurb: t.prop.blurb(id) }, pick: () => controls.furnish(id), ground: false }))
  ]
  for (const { id, piece, said: named, pick, ground } of pieces) {
    if (ground && id === "lawn") parks.append(el("p", "empty", said.parks.ground))
    if (!ground && id === "lamp") parks.append(el("p", "empty", said.parks.furnishings))
    const option = el("button", "option")
    const cost = costChips(t, piece.cost, has)
    cost.box.prepend(el("span", "cap", said.cost))
    const terms = el("span", "chips")
    terms.innerHTML = `<span class="cap">${escapeHtml(said.does)}</span>${chip("chip good", said.parks.beauty, `${icon("appeal", 14)}+${piece.beauty}`)}${chip("chip dim", said.parks.upkeep, `${icon("upkeep", 14)}${piece.upkeep}${perMinute}`)}`
    const blurb = el("span", "blurb", named.blurb)
    option.append(thumb(parts.pictures, `park:${id}`), el("span", "name", named.name), cost.box, terms, blurb)
    option.title = said.parks.piece(named.title, named.blurb, { beauty: piece.beauty, upkeep: piece.upkeep, ground })
    option.onclick = pick
    parts.live(() => {
      const lock = lockText(parts, piece)
      const short = cost.refresh()
      option.disabled = lock !== null
      option.classList.toggle("short", lock === null && short)
      option.classList.toggle("on", (ground ? ui.tool === "ground" && ui.ground === id : ui.tool === "prop" && ui.prop === id))
      blurb.textContent = lock ?? named.blurb
    })
    parks.append(option)
  }
  panel.append(parks)
}
