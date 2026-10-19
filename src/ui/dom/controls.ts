/**
 * What the page can do, as named actions: pick a tool, open a panel, place a
 * building, work the clock, show a map view, point the camera somewhere, open
 * a sheet. Each part of the page takes only the actions it uses (a `Pick` of
 * these); `index.ts` wires them to the parts that carry them out.
 */
import type { GroundId, KindId, PropId } from "../../game/content/index.ts"
import type { Tool, View } from "../../view/contracts.ts"

/** What a phone keeps folded away, one at a time: the goods, the guide, the map views, the system menu. */
export type Fold = "goods" | "guide" | "views" | "more"

export interface Controls {
  /** Says something to the player for a few seconds. */
  readonly toast: (message: string) => void
  readonly choose: (tool: Tool) => void
  readonly toggleMenu: (menu: "build" | "town") => void
  /** Picks the tool that places a building, lays park ground, or sets a furnishing. */
  readonly place: (kind: KindId) => void
  readonly layGround: (ground: GroundId) => void
  readonly furnish: (prop: PropId) => void
  readonly setSpeed: (speed: number) => void
  /** Runs a paused town at its last speed, or pauses a running one. */
  readonly togglePause: () => void
  /** Runs a paused town, else goes on to the next speed. */
  readonly cycleSpeed: () => void
  readonly setView: (view: View) => void
  readonly setFold: (fold: Fold | null) => void
  readonly toggleFold: (fold: Fold) => void
  /** Points the page at a place: the camera goes there, it is outlined for a moment, and (when it is a thing) it is selected. */
  readonly goTo: (at: { readonly x: number; readonly y: number }, size: number, id: number | null) => void
  /** What a "[homes]"-style chip does: picks the tool, opens the panel, works the clock, or shows the map view (see `view/tools.ts`). */
  readonly useRef: (name: string) => void
  /** Shows which tool and panel are picked. */
  readonly refreshTools: () => void
  readonly openCharter: (cancellable: boolean) => void
  readonly openShare: () => void
  readonly showReckoning: (open: boolean) => void
  /** Asks before something that replaces the town: save first, go ahead, or stay. */
  readonly confirmLeave: (title: string, text: string, go: string, run: () => void) => void
}
