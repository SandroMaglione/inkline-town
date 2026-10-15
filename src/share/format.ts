/**
 * What a shared town is, as both the page and the server see it. A share is
 * three things kept under one id: the town (a save file, gzipped, with the
 * camera the mayor looked from), its picture (the card a link unfurls to),
 * and a few lines about it for the link's preview. The server keeps them as
 * they come and checks only what it must: sizes, kinds, and the lines it
 * writes into a page. The town itself is checked when it is loaded, by the
 * same code that loads a save.
 */

/** Ids are eight letters and digits: short enough to read out, too many to guess. */
export const ID_LENGTH = 8
const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"
export const ID_PATTERN = /^[a-z2-9]{8}$/

export const newId = (random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => crypto.getRandomValues(b)): string =>
  [...random(new Uint8Array(ID_LENGTH))].map((n) => ID_ALPHABET[n % ID_ALPHABET.length]).join("")

/** Where a shared town opens, and where its parts are fetched from. */
export const sharePath = (id: string) => `/t/${id}`
export const townPath = (id: string) => `/api/towns/${id}`
export const picturePath = (id: string) => `/api/towns/${id}/picture`

/**
 * The largest town and picture the server takes. A real town gzips to 4 KB
 * when founded and about 26 KB after 50 minutes on large land; its picture
 * is 100 to 200 KB. The limits leave room above that and no more, since
 * they bound what the bucket can be made to hold.
 */
export const TOWN_LIMIT = 100_000
export const PICTURE_LIMIT = 500_000
/** JPEG quality of the uploaded picture: a preview card shows no difference from higher, and it is about a fifth smaller. */
export const PICTURE_QUALITY = 0.78
/** The picture's size: what link previews expect. */
export const PICTURE_WIDTH = 1200
export const PICTURE_HEIGHT = 630

/** The lines about a share, shown in its link's preview. */
export interface ShareMeta {
  /** "Inkline Town · the town is complete" */
  readonly title: string
  /** "Large, fair land · year 5 · 581 residents · 352 citizens · 9000 coins" */
  readonly description: string
}

const LINE_LIMIT = 200
/** Plain lines only: no control characters, and not too long. */
const line = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 && value.length <= LINE_LIMIT && !/[\u0000-\u001f\u007f]/.test(value) ? value : null

/** A share's lines, or null when they are not lines this server writes into a page. */
export const checkMeta = (value: unknown): ShareMeta | null => {
  if (typeof value !== "object" || value === null) return null
  const v = value as Record<string, unknown>
  const title = line(v.title),
    description = line(v.description)
  return title && description ? { title, description } : null
}

/** gzip starts with 1f 8b. */
export const isGzip = (bytes: Uint8Array) => bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
/** The picture formats a share keeps: JPEG, PNG, or WebP. */
export const pictureType = (bytes: Uint8Array): string | null => {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp"
  return null
}
