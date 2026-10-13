/**
 * The picture a town is shared as: the town as the camera sees it, with a
 * strip of paper along the bottom saying what it is and how it stands (its
 * verdict once the term is over), drawn in the page's ink and type.
 */
import { lands, sizes } from "../content.ts"
import { icon, type IconName } from "../icons.ts"
import type { Stats } from "../ui.ts"
import { PICTURE_HEIGHT, PICTURE_WIDTH, type ShareMeta } from "./format.ts"

const INK = "#3d4943",
  MUTED = "#77817a",
  PAPER = "#f7f8f4",
  RULE = "#c9cec4",
  FONT = `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace`

/** What became of a town whose term ran out. */
export const verdictOf = (s: Stats): string => {
  if (s.fate.governing) return "complete"
  const residents = s.settlers + s.citizens
  if (s.fate.peak < 40) return "the town never took root"
  if (residents >= sizes[s.charter.size].goal.residents * 0.75) return "flourishing"
  if (residents >= s.fate.peak * 0.7) return "holding on"
  return "declining"
}

/** What a card says. */
export interface CardFacts {
  readonly headline: string
  readonly land: string
  readonly numbers: ReadonlyArray<{ readonly icon: IconName; readonly value: string; readonly label: string }>
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

export const cardFacts = (s: Stats): CardFacts => {
  const headline =
    s.fate.state === "won"
      ? "The town is complete"
      : s.fate.state === "lost"
        ? capital(s.fate.reason.split(":")[0]!.toLowerCase())
        : s.fate.state === "over"
          ? `The term is over: ${verdictOf(s)}`
          : `Year ${s.season.year} · ${Math.floor(s.minute)} min in`
  return {
    headline,
    land: `${capital(sizes[s.charter.size].title)}, ${lands[s.charter.land].title} land · ${s.charter.term}-minute term`,
    numbers: [
      { icon: "people", value: `${s.settlers + s.citizens}`, label: "residents" },
      { icon: "citizens", value: `${s.citizens}`, label: "citizens" },
      { icon: "coins", value: `${s.coins}`, label: "coins" },
      { icon: "approval", value: signed(s.mood.approval), label: "approval" }
    ]
  }
}

/** A card's lines for a link preview. */
export const metaOf = (facts: CardFacts): ShareMeta => ({
  title: `Inkline Town · ${facts.headline}`,
  description: `${facts.land} · ${facts.numbers.map((n) => `${n.value} ${n.label}`).join(" · ")}`
})

const iconImage = (name: IconName, size: number) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(size, size)
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`icon ${name} did not load`))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon(name, size).replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" `))}`
  })

/** Shrinks a line's type until it fits `width`. */
const fit = (g: CanvasRenderingContext2D, text: string, weight: string, size: number, width: number) => {
  let s = size
  for (; s > 12; s--) {
    g.font = `${weight} ${s}px ${FONT}`
    if (g.measureText(text).width <= width) break
  }
  return s
}

/**
 * The card: `picture` (the town drawn at the card's size, at any scale)
 * under the strip of paper. `site` is the address printed in the corner.
 */
export const drawCard = async (picture: HTMLCanvasElement, facts: CardFacts, site: string): Promise<HTMLCanvasElement> => {
  const W = PICTURE_WIDTH,
    H = PICTURE_HEIGHT,
    scale = picture.width / W
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const g = canvas.getContext("2d")!
  g.scale(scale, scale)
  g.drawImage(picture, 0, 0, W, H)
  g.textBaseline = "alphabetic"

  // The address, in a tab at the top right.
  g.font = `600 15px ${FONT}`
  const tab = g.measureText(site).width + 28
  g.fillStyle = PAPER
  g.strokeStyle = RULE
  g.lineWidth = 1
  g.beginPath()
  g.roundRect(W - tab - 20, 20, tab, 34, 8)
  g.fill()
  g.stroke()
  g.fillStyle = INK
  g.fillText(site, W - tab - 6, 42)

  // The strip.
  const strip = 128,
    top = H - strip
  g.fillStyle = PAPER
  g.fillRect(0, top, W, strip)
  g.fillStyle = INK
  g.fillRect(0, top, W, 1.5)
  g.fillStyle = "#dfe2db"
  g.fillRect(0, top + 1.5, W, 3)

  // The name and the headline, on the left.
  const mark = await iconImage("town", 40)
  g.drawImage(mark, 32, top + 26, 40, 40)
  g.fillStyle = MUTED
  g.font = `700 13px ${FONT}`
  g.letterSpacing = "3px"
  g.fillText("INKLINE TOWN", 86, top + 40)
  g.letterSpacing = "0px"
  const numbersWidth = 4 * 128
  const textWidth = W - numbersWidth - 86 - 56
  g.fillStyle = INK
  fit(g, facts.headline, "700", 28, textWidth)
  g.fillText(facts.headline, 86, top + 72)
  g.fillStyle = MUTED
  fit(g, facts.land, "400", 15, textWidth)
  g.fillText(facts.land, 86, top + 100)

  // The numbers, on the right, each in a column of its own.
  const left = W - numbersWidth - 24
  for (const [i, n] of facts.numbers.entries()) {
    const x = left + i * 128
    if (i > 0) {
      g.fillStyle = "#e0e3db"
      g.fillRect(x, top + 28, 1, strip - 52)
    }
    const glyph = await iconImage(n.icon, 22)
    g.drawImage(glyph, x + 18, top + 34, 22, 22)
    g.fillStyle = INK
    fit(g, n.value, "700", 26, 128 - 54)
    g.fillText(n.value, x + 46, top + 56)
    g.fillStyle = MUTED
    g.font = `400 13px ${FONT}`
    g.fillText(n.label, x + 18, top + 88)
  }
  // A thin frame of ink around it all, as the page's cards have.
  g.strokeStyle = INK
  g.lineWidth = 2
  g.strokeRect(1, 1, W - 2, H - 2)
  return canvas
}

export const blobOf = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The picture could not be made"))), type, quality))

/** A smaller copy of a canvas, for the picture a link previews. */
export const scaled = (canvas: HTMLCanvasElement, width: number, height: number) => {
  const out = document.createElement("canvas")
  out.width = width
  out.height = height
  const g = out.getContext("2d")!
  g.imageSmoothingQuality = "high"
  g.drawImage(canvas, 0, 0, width, height)
  return out
}
