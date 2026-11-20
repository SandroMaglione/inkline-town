/**
 * The page's side of sharing: packing a town up and sending it, fetching a
 * shared one back, and handing a picture or a link to the device (its share
 * sheet on a phone; a download or the clipboard on a computer). What went
 * wrong, and what handing something over came to, are told as data: the
 * page's language says them (`page.share` in `i18n`).
 */
import { ID_PATTERN, townPath, type ShareMeta } from "./format.ts"

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer())

export const gzipText = (text: string) => pipe(new TextEncoder().encode(text), new CompressionStream("gzip"))
export const gunzipText = async (bytes: Uint8Array) => new TextDecoder().decode(await pipe(bytes, new DecompressionStream("gzip")))

/** The shared town a page's address names, if it names one. */
export const sharedId = (pathname: string): string | null => {
  const match = /^\/t\/([^/]+)\/?$/.exec(pathname)
  return match && ID_PATTERN.test(match[1]!) ? match[1]! : null
}

/**
 * Why a town could not be shared (`sending`) or a shared one opened: the
 * server could not be reached; it has no such town; it refused, saying why
 * in its own words (`error`) or only with a status; or the town could not be
 * packed up to send.
 */
export type ShareFailure =
  | { readonly _tag: "unreachable"; readonly sending: boolean }
  | { readonly _tag: "notFound" }
  | { readonly _tag: "refused"; readonly sending: boolean; readonly error: string | null; readonly status: number }
  | { readonly _tag: "unpacked" }

/** Sharing failed: `failure` says how, for the page to put into words. */
export class ShareError extends Error {
  readonly failure: ShareFailure
  constructor(failure: ShareFailure) {
    super(failure._tag)
    this.failure = failure
  }
}

/** What the server said went wrong, when it said. */
const reason = async (response: Response): Promise<string | null> => {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === "string") return body.error
  } catch {}
  return null
}

/** Sends a town (its save file, as text) with its picture and lines; answers with its link. */
export const upload = async (file: string, picture: Blob, meta: ShareMeta): Promise<{ readonly id: string; readonly url: string }> => {
  const form = new FormData()
  form.append("town", new Blob([(await gzipText(file)) as BlobPart], { type: "application/gzip" }), "town.json.gz")
  form.append("picture", picture, "picture")
  form.append("meta", JSON.stringify(meta))
  let response: Response
  try {
    response = await fetch("/api/towns", { method: "POST", body: form })
  } catch {
    throw new ShareError({ _tag: "unreachable", sending: true })
  }
  if (!response.ok) throw new ShareError({ _tag: "refused", sending: true, error: await reason(response), status: response.status })
  return (await response.json()) as { id: string; url: string }
}

/** A shared town's save file, as text. */
export const download = async (id: string): Promise<string> => {
  let response: Response
  try {
    response = await fetch(townPath(id))
  } catch {
    throw new ShareError({ _tag: "unreachable", sending: false })
  }
  if (response.status === 404) throw new ShareError({ _tag: "notFound" })
  if (!response.ok) throw new ShareError({ _tag: "refused", sending: false, error: await reason(response), status: response.status })
  return gunzipText(new Uint8Array(await response.arrayBuffer()))
}

/** A phone or a tablet: where the system's share sheet is the way to share. */
export const handheld = () => typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches

/** What handing a picture or a link to the device came to: shared, put away, saved under a name, copied, or (nothing else worked) the link itself to copy by hand. */
export type Offered =
  | { readonly _tag: "shared" }
  | { readonly _tag: "notShared" }
  | { readonly _tag: "saved"; readonly name: string }
  | { readonly _tag: "copied" }
  | { readonly _tag: "link"; readonly url: string }

/** Hands a picture to the share sheet, or saves it. Answers what happened, for a toast. */
export const offerPicture = async (picture: Blob, name: string, text: string): Promise<Offered> => {
  const file = new File([picture], name, { type: picture.type })
  if (handheld() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return { _tag: "shared" }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return { _tag: "notShared" }
    }
  }
  const link = document.createElement("a")
  link.href = URL.createObjectURL(picture)
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
  return { _tag: "saved", name }
}

/** Hands a link to the share sheet, or copies it. */
export const offerLink = async (url: string, title: string): Promise<Offered> => {
  if (handheld()) {
    try {
      await navigator.share({ url, title })
      return { _tag: "shared" }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return { _tag: "notShared" }
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return { _tag: "copied" }
  } catch {
    return { _tag: "link", url }
  }
}
