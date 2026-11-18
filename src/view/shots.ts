/**
 * Photo mode's camera moves, by name: what each is called and how long it
 * runs (`null`: until it is stopped). The renderer's director flies them
 * (`render/pixi3d/director.ts`); the page lists them in the photo bar.
 */
export const shotIds = ["orbit", "flyover", "reveal", "drift", "follow"] as const
export type ShotId = (typeof shotIds)[number]

export const shots: Record<ShotId, { readonly title: string; readonly note: string; readonly seconds: number | null }> = {
  orbit: { title: "orbit", note: "Turn slowly round where the camera looks", seconds: null },
  flyover: { title: "flyover", note: "The whole town, down to the town hall and its busiest streets, and back out (30 s)", seconds: 30 },
  reveal: { title: "reveal", note: "From the town hall's door up to the whole island (12 s)", seconds: 12 },
  drift: { title: "drift", note: "Glide low across the town (24 s)", seconds: 24 },
  follow: { title: "follow", note: "Ride along with a carrier and their cart; again for another", seconds: null }
}

/** The shapes a photo can be framed in, and the picture each makes. `null`: the whole window. */
export const frameIds = ["full", "16:9", "9:16", "1:1", "4:5"] as const
export type FrameId = (typeof frameIds)[number]

export const frames: Record<FrameId, { readonly title: string; readonly note: string; readonly size: { readonly width: number; readonly height: number } | null }> = {
  full: { title: "full", note: "The whole window", size: null },
  "16:9": { title: "16:9", note: "Landscape video: YouTube (1920 × 1080)", size: { width: 1920, height: 1080 } },
  "9:16": { title: "9:16", note: "Upright: Shorts, Reels, TikTok, stories (1080 × 1920)", size: { width: 1080, height: 1920 } },
  "1:1": { title: "1:1", note: "Square post (1080 × 1080)", size: { width: 1080, height: 1080 } },
  "4:5": { title: "4:5", note: "Portrait post: Instagram feed (1080 × 1350)", size: { width: 1080, height: 1350 } }
}
