/**
 * Small line-drawn icons for the page, in the town's ink and colours: goods,
 * the town's numbers, the tools. Each is a 16 × 16 SVG drawn with the same
 * two line weights as the town, so they sit beside it as part of one drawing.
 */
import { goods, type GoodId } from "./content.ts"

const ink = "#3d4943"
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`

/** Shapes inside a 16 × 16 box: `s` strokes in ink, `f(color)` fills with an ink outline. */
const paths: Record<string, string> = {
  // ── Goods ──
  wood: `<path d="M3 6.5h8.5v5H3z" fill="#d9b98c"/><ellipse cx="11.5" cy="9" rx="2" ry="2.5" fill="#f1dcb4"/><circle cx="11.5" cy="9" r=".8" fill="none"/><path d="M3 6.5a2 2.5 0 0 0 0 5" fill="none"/>`,
  planks: `<path d="M2 10.5l7 3 5-2.5-7-3z" fill="#f0c59a"/><path d="M2 10.5v1.5l7 3v-1.5" fill="#e2a873"/><path d="M9 15v-1.5l5-2.5V12.5z" fill="#d2945c"/><path d="M2 6.5l7 3 5-2.5-7-3z" fill="#f0c59a"/><path d="M2 6.5V8l7 3V9.5" fill="#e2a873"/><path d="M9 11V9.5L14 7v1.5z" fill="#d2945c"/>`,
  stone: `<path d="M2.5 12.5l2-6 4-2.5 4.5 2 1 6.5-5.5 1.5z" fill="#dfe1da"/><path d="M4.5 6.5l4 1.5 4.5-2M8.5 8v6" fill="none"/><path d="M8.5 8l4.5-2 1 6.5-5.5 1.5z" fill="#cbcfc7"/>`,
  ore: `<path d="M2.5 12.5l2-6 4-2.5 4.5 2 1 6.5-5.5 1.5z" fill="#d5dae3"/><path d="M8.5 8l4.5-2 1 6.5-5.5 1.5z" fill="#bcc3d0"/><path d="M6 7.5l1-3 1 3z" fill="#5a6479"/><rect x="4.5" y="10" width="1.6" height="1.6" fill="#4a5368" stroke="none"/><rect x="10.5" y="10.5" width="1.6" height="1.6" fill="#4a5368" stroke="none"/>`,
  tools: `<path d="M3.5 13.5l6-6" fill="none" stroke-width="2.2" stroke="#8a6a45"/><path d="M7 3.5l5.5 5.5 1.5-1.5-2-2 .5-2-2-1.5z" fill="#8f9891"/>`,
  fish: `<path d="M2 8c2.5-3.5 7-3.5 9.5 0-2.5 3.5-7 3.5-9.5 0z" fill="#9fd0cb"/><path d="M11.5 8l3-2.5v5z" fill="#2f8c87"/><circle cx="5" cy="7.4" r=".7" fill="${ink}" stroke="none"/><path d="M7.5 6v4" fill="none" stroke-width="1"/>`,
  smoked: `<path d="M2 9c2.5-3.5 7-3.5 9.5 0-2.5 3.5-7 3.5-9.5 0z" fill="#d9a07c"/><path d="M11.5 9l3-2.5v5z" fill="#9a5b3a"/><path d="M5 2.5c-1 1 1 2 0 3M8 2c-1 1 1 2 0 3" fill="none" stroke-width="1" stroke="#77817a"/><path d="M5 8.5h4" fill="none" stroke-width="1"/>`,
  wheat: `<path d="M8 14.5V4" fill="none"/><path d="M8 5.5c-2 0-2.5-2-2.5-3 1.5 0 2.5 1 2.5 3zM8 5.5c2 0 2.5-2 2.5-3-1.5 0-2.5 1-2.5 3zM8 8.5c-2 0-3-1.5-3-3 1.5 0 3 1 3 3zM8 8.5c2 0 3-1.5 3-3-1.5 0-3 1-3 3zM8 11.5c-2 0-3-1.5-3-3 1.5 0 3 1 3 3zM8 11.5c2 0 3-1.5 3-3-1.5 0-3 1-3 3z" fill="#e9cf7c"/>`,
  flour: `<path d="M4.5 5.5h7l1 8c0 1-1.5 1.5-4.5 1.5s-4.5-.5-4.5-1.5z" fill="#f2ecdc"/><path d="M4.5 5.5c1-1 1.5-3 3.5-3s2.5 2 3.5 3" fill="#e6dcc2"/><path d="M5.5 9h5" fill="none" stroke="#c9b48a" stroke-width="2"/>`,
  bread: `<path d="M2 10.5c0-3.5 3-5.5 6-5.5s6 2 6 5.5c0 1.5-1 2.5-2.5 2.5h-7C3 13 2 12 2 10.5z" fill="#e89a7c"/><path d="M5.5 7.5l1 2M8 6.5l1 2M10.5 7l1 2" fill="none" stroke-width="1"/>`,
  wool: `<circle cx="8" cy="8.5" r="5.5" fill="#eceee8"/><path d="M3.5 6.5c3 1 6 1 9-1M3 9.5c3.5 1.5 7 1.5 10-1M5 13c2.5.5 5 0 7-2" fill="none" stroke-width="1"/><path d="M12 12.5l2.5 1.5" fill="none"/>`,
  cloth: `<path d="M2.5 5.5l6-2.5 5 2.5-6 2.5z" fill="#c7aed6"/><path d="M2.5 5.5v6l5 2.5V8z" fill="#a37cbe"/><path d="M7.5 8v6l6-2.5v-6z" fill="#8a58a8"/>`,
  // ── The town ──
  coins: `<ellipse cx="8" cy="11.5" rx="5" ry="2" fill="#e3c25a"/><path d="M3 11.5v-2c0 1.1 2.2 2 5 2s5-.9 5-2v2" fill="#d6ae2e"/><ellipse cx="8" cy="9.5" rx="5" ry="2" fill="#f0d98a"/><path d="M3 9.5v-2c0 1.1 2.2 2 5 2s5-.9 5-2v2" fill="#d6ae2e"/><ellipse cx="8" cy="7.5" rx="5" ry="2" fill="#f5e3a6"/><ellipse cx="8" cy="7.5" rx="2" ry=".7" fill="none" stroke-width="1"/>`,
  settlers: `<circle cx="8" cy="4.5" r="2.3" fill="#f5f6f2"/><path d="M3.5 14c0-3.5 2-5.5 4.5-5.5s4.5 2 4.5 5.5z" fill="#e6c3b2"/>`,
  citizens: `<circle cx="8" cy="5" r="2.3" fill="#f5f6f2"/><path d="M5 3h6l-.8-1.8H5.8z" fill="#8a58a8"/><path d="M3.5 14c0-3.5 2-5.5 4.5-5.5s4.5 2 4.5 5.5z" fill="#c9d2da"/>`,
  people: `<circle cx="5.5" cy="5" r="2" fill="#f5f6f2"/><circle cx="11" cy="5.5" r="2" fill="#f5f6f2"/><path d="M1.5 14c0-3 1.7-5 4-5s4 2 4 5z" fill="#e6c3b2"/><path d="M7.5 14c0-3 1.4-4.5 3.5-4.5s3.5 1.5 3.5 4.5z" fill="#c9d2da"/>`,
  jobs: `<path d="M2.5 6.5h11v7h-11z" fill="#e9c48a"/><path d="M6 6.5V4.5h4v2" fill="none"/><path d="M2.5 9.5h11" fill="none" stroke-width="1"/><path d="M7 9h2v1.5H7z" fill="#8a6a45"/>`,
  approval: `<path d="M8 14s-5.5-3.3-5.5-7.3C2.5 4.6 4 3 5.7 3 6.9 3 7.6 3.6 8 4.4 8.4 3.6 9.1 3 10.3 3 12 3 13.5 4.6 13.5 6.7 13.5 10.7 8 14 8 14z" fill="#e89a7c"/>`,
  clock: `<circle cx="8" cy="8.5" r="5.5" fill="#f7f8f4"/><path d="M8 5.5v3l2 1.5" fill="none"/>`,
  winter: `<path d="M8 2v13M2.5 5.2l11 6.6M2.5 11.8l11-6.6M6.5 2.8L8 4.2l1.5-1.4M6.5 14.2L8 12.8l1.5 1.4" fill="none" stroke="#3d6db5"/>`,
  summer: `<circle cx="8" cy="8.5" r="3" fill="#f0d98a"/><path d="M8 2.5v1.5M8 13v1.5M2 8.5h1.5M12.5 8.5H14M3.8 4.3l1 1M11.2 11.7l1 1M3.8 12.7l1-1M11.2 5.3l1-1" fill="none"/>`,
  crown: `<path d="M2.5 12.5l-.5-7 3.5 3L8 3.5l2.5 5 3.5-3-.5 7z" fill="#e3c25a"/><path d="M2.5 12.5h11v1.5h-11z" fill="#d6ae2e"/>`,
  hint: `<path d="M8 1.8c-2.6 0-4.3 1.9-4.3 4.2 0 1.7 1 2.6 1.7 3.5.4.5.6 1 .6 1.7h4c0-.7.2-1.2.6-1.7.7-.9 1.7-1.8 1.7-3.5 0-2.3-1.7-4.2-4.3-4.2z" fill="#dce6f5"/><path d="M6.2 13h3.6M6.8 14.8h2.4" fill="none"/><path d="M8 4.5v3" fill="none" stroke="#3d6db5" stroke-width="1.4"/>`,
  caution: `<path d="M8 2.5l6.5 11.5h-13z" fill="#f6e6c4"/><path d="M8 6.5v4" fill="none" stroke="#b8782e" stroke-width="1.6"/><circle cx="8" cy="12.2" r=".9" fill="#b8782e" stroke="none"/>`,
  locate: `<circle cx="8" cy="8" r="4.5" fill="none"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/><path d="M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5" fill="none"/>`,
  warning: `<path d="M8 2.5l6.5 11.5h-13z" fill="#f6e1dc"/><path d="M8 6.5v4" fill="none" stroke="#b04a39" stroke-width="1.6"/><circle cx="8" cy="12.2" r=".9" fill="#b04a39" stroke="none"/>`,
  goal: `<path d="M3.5 14.5V2" fill="none"/><path d="M3.5 2.5h9l-2 3 2 3h-9z" fill="#e89a7c"/>`,
  faith: `<path d="M8 2v4M6 3.8h4" fill="none"/><path d="M4 14.5V9.5l4-3.5 4 3.5v5z" fill="#c9d6ee"/><path d="M7 14.5v-3h2v3" fill="none" stroke-width="1"/>`,
  food: `<path d="M2 8c2.5-3.5 7-3.5 9.5 0-2.5 3.5-7 3.5-9.5 0z" fill="#9fd0cb"/><path d="M11.5 8l3-2.5v5z" fill="#2f8c87"/>`,
  trade: `<path d="M2.5 5.5h9.5M9.5 3l2.5 2.5L9.5 8M13.5 10.5H4M6.5 8L4 10.5 6.5 13" fill="none"/>`,
  treasury: `<path d="M2.5 6.5L8 3l5.5 3.5z" fill="#e3c25a"/><path d="M3.5 6.5v6M6.5 6.5v6M9.5 6.5v6M12.5 6.5v6" fill="none"/><path d="M2 13h12v1.5H2z" fill="#d6ae2e"/>`,
  taxes: `<path d="M3.5 2.5h9v11l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" fill="#f7f8f4"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" fill="none" stroke-width="1"/>`,
  chronicle: `<path d="M3 3.5h8.5c1 0 1.5.5 1.5 1.5v9H4.5c-1 0-1.5-.5-1.5-1.5z" fill="#f2ecdc"/><path d="M5.5 6.5h5M5.5 9h5M5.5 11.5h3" fill="none" stroke-width="1"/>`,
  // ── Tools ──
  select: `<path d="M4 2.5v10.5l3-2.8 2 4.3 2-.9-2-4.2h4z" fill="#f7f8f4"/>`,
  road: `<path d="M1.5 9l6.5-4.5 6.5 4.5-6.5 4.5z" fill="#e6e8e2"/><path d="M5 7.4l1.2.8M9.8 10.6l1.2.8" fill="none" stroke-width="1"/>`,
  homes: `<path d="M3 8.5v5.5h10V8.5" fill="#f5f6f2"/><path d="M1.5 9L8 3l6.5 6z" fill="#e6c3b2"/><path d="M7 14v-3.5h2V14" fill="#c4523f" stroke-width="1"/>`,
  build: `<path d="M3 14.5V5.5l5-3 5 3v9z" fill="#f5f6f2"/><path d="M3 5.5l5-3 5 3" fill="#c9d6ee"/><path d="M6 14.5v-4h4v4" fill="#3d6db5" stroke-width="1"/><path d="M5.5 7.5h1.5M9 7.5h1.5" fill="none" stroke-width="1"/>`,
  bulldoze: `<path d="M3 4.5l9.5 9.5M12.5 4.5L3 14" fill="none" stroke="#b04a39" stroke-width="2"/>`,
  // The settlers' cottage, as the town draws it: the town's mark (and the page's favicon).
  town: `<g stroke-width="1"><path d="M10.75 5.6L13.5 7.25 8 4.5 5.25 2.85z" fill="#e2e5de"/><path d="M2.5 11.25L8 14V10L2.5 7.25z" fill="#eef0ea"/><path d="M8 14l5.5-2.75v-4L8 10z" fill="#dfe2db"/><path d="M8 10l5.5-2.75L10.75 5.6z" fill="#dfe2db"/><path d="M8 10l2.75-4.4-5.5-2.75L2.5 7.25z" fill="#e6c3b2"/></g><path d="M10.1 12.95l1.3-.65v-2.3l-1.3.65z" fill="#8f9891" stroke-width=".6"/><path d="M4.6 10.6l1.3.65V9.75l-1.3-.65z" fill="#c9d6e6" stroke-width=".6"/>`,
  pause: `<path d="M5 3.5h2v9H5zM9 3.5h2v9H9z" fill="currentColor" stroke="none"/>`,
  play: `<path d="M5 3l8 5-8 5z" fill="currentColor" stroke="none"/>`,
  save: `<path d="M2.5 2.5h9l2 2v9h-11z" fill="#f7f8f4"/><path d="M5 2.5v3.5h5V2.5" fill="#c9d6ee"/><path d="M4.5 13.5V9.5h7v4" fill="#e9ebe5"/>`,
  load: `<path d="M2 4.5h4.5l1.5 1.5h6v7.5H2z" fill="#f3dca6"/><path d="M8 7v5M5.8 10L8 12.2 10.2 10" fill="none"/>`,
  newTown: `<path d="M4 14.5V2" fill="none"/><path d="M4 2.5h8.5l-2 3 2 3H4z" fill="#a6c48a"/><path d="M9.5 11.5h4M11.5 9.5v4" fill="none"/>`,
  close: `<path d="M4 4l8 8M12 4l-8 8" fill="none"/>`,
  more: `<circle cx="3.5" cy="8" r="1.1" fill="${ink}"/><circle cx="8" cy="8" r="1.1" fill="${ink}"/><circle cx="12.5" cy="8" r="1.1" fill="${ink}"/>`,
  layers: `<path d="M8 2.5l6 3.5-6 3.5-6-3.5z" fill="#c9d6ee"/><path d="M2 9l6 3.5L14 9" fill="none"/>`,
  share: `<path d="M3 8.5v5.5h10V8.5" fill="#f7f8f4"/><path d="M8 10.5V2.5M5.3 5.2L8 2.5l2.7 2.7" fill="none"/>`,
  picture: `<path d="M2 3.5h12v9H2z" fill="#f7f8f4"/><path d="M2.5 12l4-4.5 3 3 1.5-1.5 2.5 3" fill="#cfe5b8"/><circle cx="11" cy="6" r="1.2" fill="#f0d98a"/>`,
  link: `<path d="M7 9a2.5 2.5 0 0 0 3.5 0l2.5-2.5a2.5 2.5 0 0 0-3.5-3.5L8.5 4M9 7a2.5 2.5 0 0 0-3.5 0L3 9.5A2.5 2.5 0 0 0 6.5 13l1-1" fill="none"/>`,
  info: `<circle cx="8" cy="8" r="6" fill="#f7f8f4" stroke-width="1"/><path d="M8 7v4.5" fill="none" stroke-width="1.4"/><circle cx="8" cy="4.9" r=".9" fill="${ink}" stroke="none"/>`,
  upkeep: `<path d="M8 2.5v11M5 11l3 3 3-3" fill="none" stroke="#b04a39"/>`,
  burghers: `<circle cx="8" cy="5.5" r="2.3" fill="#f5f6f2"/><path d="M5.5 3.2h5V1.5h-5z" fill="${ink}"/><path d="M3.5 14c0-3.5 2-5.5 4.5-5.5s4.5 2 4.5 5.5z" fill="#8a58a8"/>`,
  decor: `<path d="M8 14.5v-5" fill="none" stroke="#6b5a45"/><circle cx="8" cy="6.5" r="4.5" fill="#a9c79a"/><circle cx="3.5" cy="13" r="1.4" fill="#e89a7c"/><circle cx="12.5" cy="13" r="1.4" fill="#e3c25a"/>`,
  pave: `<path d="M1.5 9l6.5-4.5 6.5 4.5-6.5 4.5z" fill="#d8dbd4"/><path d="M4.8 6.8l6.5 4.5M8 4.5L4.8 11.3M11.2 6.8L8 13.5" fill="none" stroke-width="1" stroke="#9aa29b"/>`,
  fire: `<path d="M8 14.5c-3 0-4.5-2-4.5-4.5 0-2.5 2-3.5 2.5-6 1.5 1 2 2.5 2 3.5.8-.8 1-2 1-3 2 1.5 3.5 3.5 3.5 5.5 0 2.5-1.5 4.5-4.5 4.5z" fill="#f0a868"/><path d="M8 14.5c-1.3 0-2-1-2-2.2 0-1.3 1-2 1.3-3 .9.7 2.7 1.8 2.7 3 0 1.2-.7 2.2-2 2.2z" fill="#f3c76b"/>`,
  health: `<path d="M6 2.5h4v3.5h3.5v4H10v3.5H6V10H2.5V6H6z" fill="#cfe5d6"/>`,
  order: `<path d="M8 1.5l5.5 2v4.5c0 3.5-2.5 5.5-5.5 6.5-3-1-5.5-3-5.5-6.5V3.5z" fill="#c9d2da"/><path d="M5.5 8l2 2 3-3.5" fill="none" stroke-width="1.4"/>`,
  repair: `<path d="M3 13l6-6" fill="none" stroke="#8a6a45" stroke-width="2"/><path d="M8 3.5l2.5-1.5 3 3-1.5 2.5-2-.5-1.5-1.5z" fill="#8f9891"/>`,
  appeal: `<path d="M8 1.8l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.2l-3.7 2.1.8-4.2L2 6.2l4.2-.5z" fill="#cfe5b8"/>`,
  condition: `<path d="M2.5 14.5v-8l5.5-4 5.5 4v8z" fill="#f5f6f2"/><path d="M6 6.5l2 2.5-1.5 2 2 3" fill="none" stroke="#b04a39" stroke-width="1.2"/>`,
  view: `<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" fill="#f7f8f4"/><circle cx="8" cy="8" r="2.3" fill="#c9d6ee"/>`,
  workers: `<circle cx="8" cy="5" r="2.3" fill="#f5f6f2"/><path d="M5.3 4.5c0-2 1.2-3 2.7-3s2.7 1 2.7 3z" fill="#e3c25a" stroke-width="1"/><path d="M3.5 14c0-3.5 2-5.5 4.5-5.5s4.5 2 4.5 5.5z" fill="#e9c48a"/>`
}

export type IconName = keyof typeof paths | GoodId
export const iconNames = Object.keys(paths) as ReadonlyArray<IconName>

/** An icon as an SVG string, `size` px a side. */
export const icon = (name: IconName, size = 16, extraClass = ""): string =>
  `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true" stroke="${ink}" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round">${paths[name] ?? ""}</svg>`

/** An icon as an element. */
export const iconEl = (name: IconName, size = 16, extraClass = ""): HTMLElement => {
  const span = document.createElement("span")
  span.className = "glyph"
  span.innerHTML = icon(name, size, extraClass)
  return span
}

/** A good's icon, with its colour as a fallback swatch. */
export const goodIcon = (good: GoodId, size = 16): string => (good in paths ? icon(good, size) : `<span class="swatch" style="background:${hex(goods[good].color)}"></span>`)
