/**
 * The page's side of sharing: packing a town up and sending it, fetching a
 * shared one back, and handing a picture or a link to the device (its share
 * sheet on a phone; a download or the clipboard on a computer).
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

/** What the server said went wrong, or what did. */
const reason = async (response: Response) => {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === "string") return body.error
  } catch {}
  return `the server answered ${response.status}`
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
    throw new Error("Could not reach the server to share the town")
  }
  if (!response.ok) throw new Error(`Could not share the town: ${await reason(response)}`)
  return (await response.json()) as { id: string; url: string }
}

/** A shared town's save file, as text. */
export const download = async (id: string): Promise<string> => {
  let response: Response
  try {
    response = await fetch(townPath(id))
  } catch {
    throw new Error("Could not reach the server for that town")
  }
  if (response.status === 404) throw new Error("No town is shared under that link (shares are kept for six months)")
  if (!response.ok) throw new Error(`Could not open that town: ${await reason(response)}`)
  return gunzipText(new Uint8Array(await response.arrayBuffer()))
}

/** A phone or a tablet: where the system's share sheet is the way to share. */
export const handheld = () => typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches

/** Hands a picture to the share sheet, or saves it. Answers what happened, for a toast. */
export const offerPicture = async (picture: Blob, name: string, text: string): Promise<string> => {
  const file = new File([picture], name, { type: picture.type })
  if (handheld() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return "Shared"
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "Not shared"
    }
  }
  const link = document.createElement("a")
  link.href = URL.createObjectURL(picture)
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
  return `Saved the picture as ${name}`
}

/** Hands a link to the share sheet, or copies it. */
export const offerLink = async (url: string, title: string): Promise<string> => {
  if (handheld()) {
    try {
      await navigator.share({ url, title })
      return "Shared"
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "Not shared"
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return "Link copied"
  } catch {
    return url
  }
}
