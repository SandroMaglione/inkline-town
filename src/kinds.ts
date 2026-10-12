/** The factories the player can place, and how each one works. */
export type KindId = "source" | "workshop" | "plant" | "depot"

export interface Kind {
  readonly id: KindId
  readonly title: string
  readonly blurb: string
  /** Half the building's width, in units (see `iso.ts`): its walls stand this far from its centre. */
  readonly half: number
  readonly stories: 1 | 2
  /**
   * The roof is split into bays × bays squares: the back one holds the
   * chimney, a depot's flag stands in the right-hand one, and every other
   * one has a window `window` units across.
   */
  readonly bays: 2 | 3
  readonly window: number
  /** Crates taken per job (0: makes them from nothing). */
  readonly needs: number
  /** Crates made per job (0: ships them out of the yard). */
  readonly makes: number
  /** Seconds per job. */
  readonly period: number
  readonly inputCap: number
  readonly outputCap: number
  readonly flag: boolean
}

// Each kind's `half` splits evenly into its bays (2 × half / bays is whole),
// so every window and the chimney sit on whole units.
export const kinds: Readonly<Record<KindId, Kind>> = {
  source: {
    id: "source", title: "Source", blurb: "makes crates from nothing",
    half: 14, stories: 1, bays: 2, window: 6,
    needs: 0, makes: 1, period: 1.4, inputCap: 0, outputCap: 3, flag: false
  },
  workshop: {
    id: "workshop", title: "Workshop", blurb: "relabels one crate at a time",
    half: 16, stories: 1, bays: 2, window: 8,
    needs: 1, makes: 1, period: 1.2, inputCap: 4, outputCap: 3, flag: false
  },
  plant: {
    id: "plant", title: "Plant", blurb: "two crates in, two out, slowly",
    half: 18, stories: 2, bays: 3, window: 6,
    needs: 2, makes: 2, period: 2.6, inputCap: 6, outputCap: 4, flag: false
  },
  depot: {
    id: "depot", title: "Depot", blurb: "ships crates out of the yard",
    half: 14, stories: 1, bays: 2, window: 6,
    needs: 1, makes: 0, period: 0.45, inputCap: 4, outputCap: 0, flag: true
  }
}

/** How far a kind's walls stand in from the edge of its footprint, in cells. */
export const insetOf = (kind: Kind): number => 1.5 - kind.half / 16

export const kindOrder: ReadonlyArray<KindId> = ["source", "workshop", "plant", "depot"]

/** Names handed out in placing order, like packages in a repository. */
export const names = [
  "tokens", "shared", "ui", "db", "lib", "email", "auth", "payments", "components",
  "routes", "pages", "src", "api", "hooks", "store", "config", "core", "assets", "i18n", "utils"
] as const

/** Awning (and crate label) colours, handed out in placing order. */
export const awnings = [0x8a58a8, 0x3d6db5, 0x6e8f36, 0xc4523f, 0x2f8c87, 0xd6ae2e, 0x5a6479, 0xd27a34] as const

export const nameFor = (index: number): string => {
  const base = names[index % names.length] ?? "pkg"
  const round = Math.floor(index / names.length)
  return round === 0 ? base : `${base}-${round + 1}`
}

export const awningFor = (index: number): number => awnings[index % awnings.length] ?? 0x5a6479
