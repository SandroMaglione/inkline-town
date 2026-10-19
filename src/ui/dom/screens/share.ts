/**
 * Sharing: a picture of the town (the card), to post anywhere; and, on
 * asking, a link that opens the town itself, running, for anyone to watch and
 * play on. The town waits while the sheet is open.
 */
import { handheld, offerLink, offerPicture, upload } from "../../../platform/share/client.ts"
import { PICTURE_HEIGHT, PICTURE_QUALITY, PICTURE_WIDTH } from "../../../platform/share/format.ts"
import type { Stats } from "../../../view/contracts.ts"
import type { Controls } from "../controls.ts"
import { el } from "../kit/dom.ts"
import { iconEl } from "../kit/icons.ts"
import { blobOf, cardFacts, drawCard, metaOf, scaled } from "./share-card.ts"

/** What sharing needs of the map: a picture of it as the camera sees it, and where the camera stands. */
export interface ShareMap<Camera> {
  readonly picture: (width: number, height: number, scale: number) => HTMLCanvasElement
  readonly camera: () => Camera
}

export const createShare = <Camera>(
  stats: () => Stats | null,
  speed: () => number,
  visiting: () => boolean,
  map: ShareMap<Camera>,
  shareFile: (camera: Camera) => string,
  controls: Pick<Controls, "setSpeed" | "toast">
) => {
  const shareBox = el("div", "dialog share")
  let shareSpeed = 1
  const closeShare = () => {
    if (!shareBox.classList.contains("open")) return
    shareBox.classList.remove("open")
    for (const img of shareBox.querySelectorAll("img")) URL.revokeObjectURL(img.src)
    if (!visiting()) controls.setSpeed(shareSpeed)
  }
  shareBox.onclick = (event) => {
    if (event.target === shareBox) closeShare()
  }
  const openShare = async () => {
    const s = stats()
    if (!s || shareBox.classList.contains("open")) return
    shareSpeed = speed()
    controls.setSpeed(0)
    const facts = cardFacts(s)
    let card: HTMLCanvasElement, png: Blob
    try {
      card = await drawCard(map.picture(PICTURE_WIDTH, PICTURE_HEIGHT, 2), facts, location.host)
      png = await blobOf(card, "image/png")
    } catch (error) {
      controls.setSpeed(shareSpeed)
      return controls.toast(error instanceof Error ? error.message : "The picture could not be made")
    }
    const name = `inkline-town-${s.fate.state === "playing" ? `year-${s.season.year}` : `term-${s.fate.term}`}.png`
    const caption = `${metaOf(facts).title} · ${metaOf(facts).description}`
    shareBox.replaceChildren()
    const sheet = el("div", "sheet")
    sheet.append(el("h2", "", "share the town"))
    const preview = document.createElement("img")
    preview.className = "card-preview"
    preview.alt = caption
    preview.src = URL.createObjectURL(png)
    sheet.append(preview)
    sheet.append(el("p", "sub", "Post the picture anywhere, or make a link: whoever opens it sees this town running, from where you look at it now, and can play on from here."))
    const actions = el("div", "actions")
    const picture = el("button", "frame primary", "")
    picture.append(iconEl("picture", 15), document.createTextNode(handheld() ? "Share the picture" : "Save the picture"))
    picture.onclick = async () => controls.toast(await offerPicture(png, name, caption))
    const link = el("button", "frame", "")
    link.append(iconEl("link", 15), document.createTextNode("Make a link"))
    const linkRow = el("div", "link-row")
    link.onclick = async () => {
      link.disabled = true
      link.lastChild!.textContent = "Making a link…"
      try {
        const small = await blobOf(scaled(card, PICTURE_WIDTH, PICTURE_HEIGHT), "image/jpeg", PICTURE_QUALITY)
        const made = await upload(shareFile(map.camera()), small, metaOf(facts))
        link.remove()
        const field = document.createElement("input")
        field.readOnly = true
        field.value = made.url
        field.onfocus = () => field.select()
        const copy = el("button", "frame primary", handheld() ? "Share the link" : "Copy the link")
        copy.onclick = async () => controls.toast(await offerLink(made.url, metaOf(facts).title))
        const open = el("a", "frame", "Open")
        open.setAttribute("href", made.url)
        open.setAttribute("target", "_blank")
        open.setAttribute("rel", "noopener")
        linkRow.replaceChildren(field, copy, open)
        linkRow.classList.add("show")
        copy.focus()
      } catch (error) {
        link.disabled = false
        link.lastChild!.textContent = "Try the link again"
        controls.toast(error instanceof Error ? error.message : "Could not share the town")
      }
    }
    const close = el("button", "frame", "Close")
    close.onclick = () => closeShare()
    actions.append(picture, link, close)
    sheet.append(actions, linkRow)
    shareBox.append(sheet)
    shareBox.classList.add("open")
    picture.focus()
  }
  return { element: shareBox, open: openShare, close: closeShare, isOpen: () => shareBox.classList.contains("open") }
}
