/**
 * The panel of what is picked: a building, a home, a park, or a ruin. How it
 * is, its rows under headings (kept in step with what the view says each
 * frame), its upgrade, and what can be done to it.
 */
import { tierHome } from "../../../game/content/index.ts"
import type { Group, Panel } from "../../../view/contracts.ts"
import { el } from "../kit/dom.ts"
import { iconEl } from "../kit/icons.ts"
import { syncLines } from "../kit/lines.ts"
import { thumb } from "../kit/picture.ts"
import { section } from "../kit/section.ts"
import type { PanelParts } from "./frame.ts"
import { upgradeBox } from "./upgrade.ts"

export const selectionPanel = (parts: PanelParts, p: Exclude<Panel, { readonly type: "build" } | { readonly type: "town" }>) => {
  const panel = parts.element
  const title = p.type === "building" ? p.title.toLowerCase() : p.type === "house" ? tierHome[p.tier] : p.type === "park" ? "park" : "ruin"
  const status = el("span", "pill")
  const about = el(
    "p",
    "sub",
    p.type === "building"
      ? p.blurb
      : p.type === "ruin"
        ? "bulldoze it to clear the plot"
        : p.type === "park"
          ? "every cell of ground that touches this one: lay more, or set furnishings on it, to make the streets around it nicer"
        : p.tier === 1
          ? "settlers live here and do the rough work"
          : p.tier === 2
            ? "citizens live here, do the skilled work, and pay twice as much"
            : "burghers live here, and pay the best taxes"
  )
  const below = el("div", "")
  // A building says how it is in a box of its own, under the header; a home, a park, or a ruin in a word here.
  if (p.type === "building") below.append(about)
  else below.append(status, about)
  panel.append(parts.header(title, p.type === "ruin" ? iconEl("condition", 30) : p.type === "park" ? iconEl("decor", 30) : thumb(parts.pictures, p.type === "building" ? p.kind : p.tier, p.type === "building" ? p.level : 0), below))
  // A building: how it is first, and what to do about it; then its upgrade, when it has one to offer.
  if (p.type === "building") {
    const box = section("status", p.problem !== null ? "warning" : "jobs")
    box.classList.add("lines", "state")
    const rows: Array<HTMLElement> = []
    parts.live(() => {
      const now = parts.town.panel
      if (now?.type !== "building") return
      box.classList.toggle("trouble", now.problem !== null)
      syncLines(parts.pictures, box, rows, [now.state])
    })
    panel.append(box)
  }
  if (p.type === "building" && p.upgrade) panel.append(upgradeBox(parts, p.upgrade))
  // A building or a home: its rows in boxes under headings, kept in step with what the town says each frame.
  // A park or a ruin: one box.
  const holder = el("div", "")
  panel.append(holder)
  const slots: Array<{ box: HTMLElement; rows: Array<HTMLElement>; key: string }> = []
  const syncGroups = (groups: ReadonlyArray<Group>) => {
    groups.forEach((g, i) => {
      const key = `${g.title}|${g.icon}|${g.help ?? ""}`
      let slot = slots[i]
      if (!slot || slot.key !== key) {
        const box = section(g.title, g.icon, g.help)
        box.classList.add("lines")
        const fresh = { box, rows: [] as Array<HTMLElement>, key }
        if (slot) slot.box.replaceWith(box)
        else holder.append(box)
        slots[i] = fresh
        slot = fresh
      }
      slot.box.style.display = ""
      syncLines(parts.pictures, slot.box, slot.rows, g.lines)
    })
    for (const extra of slots.slice(groups.length)) extra.box.style.display = "none"
  }
  parts.live(() => {
    const now = parts.town.panel
    if (!now || now.type === "build" || now.type === "town" || now.type !== p.type) return
    if (now.type === "building") {
      status.textContent = now.problem ?? now.status
      status.className = `pill ${now.problem !== null ? "problem" : now.status === "working" ? "working" : ""}`
      syncGroups(now.groups)
    } else if (now.type === "house") {
      status.textContent = now.summary
      status.className = `pill ${now.trouble ? "problem" : "working"}`
      syncGroups(now.groups)
    } else if (now.type === "park") {
      status.textContent = `${now.value > 0 ? "+" : ""}${now.value} out to ${now.reach} cells`
      status.className = "pill working"
      syncGroups([{ title: "what makes it", icon: "appeal", lines: now.lines }])
    } else {
      status.textContent = now.cause
      status.className = "pill problem"
      syncGroups([{ title: "what is left", icon: "condition", lines: now.lines }])
    }
  })
  if (p.type === "building" && p.kind === "townhall") return
  {
    const actions = el("div", "actions")
    if (p.type === "building") {
      const pause = el("button", "frame", "Pause work")
      pause.title = "A paused building has no workers and pays a quarter of its upkeep"
      pause.onclick = () => {
        const now = parts.town.panel
        if (now?.type === "building") parts.send({ type: "pause", cell: now.cell, on: !now.paused })
      }
      parts.live(() => {
        const now = parts.town.panel
        if (now?.type !== "building") return
        pause.textContent = now.paused ? "Resume work" : "Pause work"
        pause.style.display = now.pausable ? "" : "none"
      })
      actions.append(pause)
    }
    if (p.type === "house") {
      const close = el("button", "frame", "Close home")
      close.title = "A closed home stands empty: no taxes, and no cost to the town hall's administration. Reopen it and settlers move back in."
      close.onclick = () => {
        const now = parts.town.panel
        if (now?.type === "house") parts.send({ type: "pause", cell: now.cell, on: !now.closed })
      }
      parts.live(() => {
        const now = parts.town.panel
        if (now?.type !== "house") return
        close.textContent = now.closed ? "Reopen home" : "Close home"
        close.style.display = now.closable ? "" : "none"
      })
      actions.append(close)
    }
    const remove = el("button", "frame danger", "Remove")
    remove.onclick = () => parts.send({ type: "remove", cell: p.cell })
    parts.live(() => {
      const now = parts.town.panel
      remove.title = now?.type === "building" || now?.type === "house" ? now.salvage : ""
    })
    actions.append(remove)
    panel.append(actions)
  }
}
