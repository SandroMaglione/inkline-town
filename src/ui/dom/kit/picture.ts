/**
 * Pictures of buildings, homes, and park pieces for the build menu and the
 * panel. The page does not draw them: whatever renders the town provides
 * them (see `render/three/thumbnails.ts`), so a picture matches what stands
 * on the map.
 */
import type { GroundId, KindId, PropId, Tier } from "../../../game/content/index.ts"

/** What can be pictured: a building, a home of a tier, or a park piece. */
export type Pictured = KindId | Tier | `park:${GroundId | PropId}`
/** A picture's URL, at a building's level of upgrades. */
export type Pictures = (what: Pictured, level: number) => Promise<string>

/** A picture as an image, filled in when it is ready. */
export const thumb = (pictures: Pictures, what: Pictured, level: number | boolean = 0): HTMLImageElement => {
  const img = document.createElement("img")
  img.className = "thumb"
  img.alt = ""
  void pictures(what, Number(level)).then((src) => (img.src = src))
  return img
}
