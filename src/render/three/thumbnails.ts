/**
 * Pictures of buildings, homes, and park pieces for the page's menus and
 * panel: each is its 3D model, as the town draws it, turned to the town's
 * camera (see `portrait`), so the picture matches what stands on the map.
 * One model a frame, so a menu of them does not stall the page; each picture
 * is made once and kept. Make one of these for the page, and share it.
 */
import type { GroundId, KindId, PropId, Tier } from "../../game/content/index.ts"
import { pictureAsset } from "./models.ts"
import { portrait } from "./portrait.ts"

export const thumbnails = () => {
  const pictures = new Map<string, Promise<string>>()
  let portraits: Promise<unknown> = Promise.resolve()
  const modelPicture = (make: () => Parameters<typeof portrait>[0]): Promise<string> => {
    const url = portraits.then(() => new Promise<string>((done) => requestAnimationFrame(() => done(portrait(make())))))
    portraits = url.catch(() => undefined)
    return url
  }
  return (what: KindId | Tier | `park:${GroundId | PropId}`, level: number): Promise<string> => {
    const id = `${String(what)}${level > 0 ? `/upgraded${level}` : ""}`
    let url = pictures.get(id)
    if (!url) {
      // The model the map draws, as it stands: one source for the map and every picture of it.
      url = modelPicture(() => pictureAsset(what, level))
      pictures.set(id, url)
    }
    return url
  }
}
