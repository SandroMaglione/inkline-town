/** The factory yard's world: what is placed, what it is doing, and what moves. */
import { Descriptor, Schema } from "@typeonce/bevy-ts"
import type { NodeRegistry } from "@typeonce/bevy-ts-render"

import type { Point } from "./iso.ts"
import type { KindId } from "./kinds.ts"
import type { BeltView, CrateView, FactoryView, Stage } from "./art.ts"

export type Status = "building" | "idle" | "working" | "starved" | "blocked"

/** A placed factory: its own id (belts refer to it), kind, and 2×2 footprint by its top cell. */
export interface FactoryValue {
  readonly id: number
  readonly kind: KindId
  readonly name: string
  readonly color: number
  readonly x: number
  readonly y: number
}

/** What a factory is doing, and the numbers its animation follows. */
export interface WorkValue {
  readonly status: Status
  /** 0 → 1 while it rises from its plate. */
  readonly built: number
  /** 0 → 1 through the current job (0: no job). */
  readonly progress: number
  readonly inputs: number
  readonly outputs: number
  /** Crates a depot has shipped out of the yard. */
  readonly shipped: number
  /** Jobs finished. */
  readonly made: number
  /** Next outgoing belt to try. */
  readonly turn: number
  /** 1 when a job finishes, fading to 0: the building's bounce. */
  readonly pulse: number
}

/** A conveyor between two factories. */
export interface BeltValue {
  readonly id: number
  readonly from: number
  readonly to: number
  readonly cells: ReadonlyArray<Point>
  readonly uses: ReadonlyArray<"h" | "v" | "turn">
  readonly points: ReadonlyArray<Point>
  readonly length: number
}

/** A crate riding a belt: how far along it, and where that is on the grid. */
export interface CrateValue {
  readonly belt: number
  readonly distance: number
  readonly color: number
  readonly x: number
  readonly y: number
}

export type Mode = "select" | "bulldoze"

/** What the player did since the last tick, in world pixels. */
export type Intent =
  | { readonly type: "press"; readonly at: Point }
  | { readonly type: "release"; readonly at: Point; readonly panned: boolean }
  | { readonly type: "place"; readonly kind: KindId; readonly cell: Point }
  /** Builds on the picked plot (see `UiValue.plot`), and opens the new factory. */
  | { readonly type: "build"; readonly kind: KindId }
  | { readonly type: "remove"; readonly factory: number }
  /** Connects the factories standing on two cells. */
  | { readonly type: "link"; readonly from: Point; readonly to: Point }
  | { readonly type: "clear" }

/** What the yard shows besides its entities: the ghost, the belt being dragged, and what is in focus. */
export interface Preview {
  ghost: { readonly kind: KindId; readonly cell: Point; readonly valid: boolean } | null
  /** Plots outlined on the floor: under the pointer, or picked. */
  plots: Array<{ readonly x: number; readonly y: number; readonly look: "hover" | "picked" | "blocked" }>
  path: { readonly points: ReadonlyArray<Point>; readonly valid: boolean } | null
  hoverFactory: number | null
  hoverBelt: number | null
  /** Factories and belts in focus (the rest fade), or `null` for all. */
  focus: { readonly factories: ReadonlySet<number>; readonly belts: ReadonlySet<number> } | null
  danger: boolean
  tooltip: string | null
}

/** A factory a panel lists, with where it stands (world pixels) to look at it. */
export interface PanelLink {
  readonly id: number
  readonly name: string
  readonly kind: KindId
  readonly crates: number
}

/** The side panel: a picked plot and what can be built on it, or a factory and its belts. */
export type Panel =
  | {
    readonly type: "plot"
    readonly x: number
    readonly y: number
    readonly free: boolean
    readonly reason: string
  }
  | {
    readonly type: "factory"
    readonly id: number
    readonly name: string
    readonly kind: KindId
    readonly status: Status
    readonly inputs: number
    readonly outputs: number
    readonly made: number
    readonly takes: ReadonlyArray<PanelLink>
    readonly feeds: ReadonlyArray<PanelLink>
    readonly linking: boolean
  }

/** A factory's hit area for the pointer, written by the yard each tick. */
export interface HitBox {
  readonly id: number
  readonly depth: number
  readonly contains: (at: Point) => boolean
}

/** The bridge between the page and the yard: the host writes input, the yard writes the preview. */
export interface UiValue {
  mode: Mode
  /** The plot picked for building (its top cell), and the kind the panel is pointing at. */
  plot: Point | null
  plotKind: KindId | null
  /** A factory whose next belt the player is placing by tapping its target. */
  linkFrom: number | null
  /** The pointer in world pixels, or `null` off the canvas. */
  pointer: Point | null
  dragFrom: number | null
  selected: number | null
  intents: Array<Intent>
  preview: Preview
  hits: ReadonlyArray<HitBox>
  panel: Panel | null
  /** Where each factory stands (world pixels), for the camera to look at. */
  centres: ReadonlyMap<number, Point>
  stats: { readonly factories: number; readonly belts: number; readonly crates: number; readonly shipped: number }
  toast: (message: string) => void
}

export const Factory = Descriptor.Component<FactoryValue>()("Factory/Factory")
export const Work = Descriptor.Component<WorkValue>()("Factory/Work")
export const Belt = Descriptor.Component<BeltValue>()("Factory/Belt")
export const Crate = Descriptor.Component<CrateValue>()("Factory/Crate")

export const DeltaTime = Descriptor.Resource<number>()("Factory/DeltaTime")
export const Elapsed = Descriptor.Resource<number>()("Factory/Elapsed")
/** Ids for factories and belts, and how many factories were ever placed (for names and colours). */
export const Counters = Descriptor.Resource<{ readonly nextId: number; readonly placed: number }>()("Factory/Counters")
export const Totals = Descriptor.Resource<{ readonly shipped: number }>()("Factory/Totals")
/** Crates each belt has delivered, by belt id. */
export const Flow = Descriptor.Resource<Readonly<Record<number, number>>>()("Factory/Flow")

export const Ui = Descriptor.Service<UiValue>()("Factory/Ui")
export const Clock = Descriptor.Service<{ deltaSeconds: number }>()("Factory/Clock")
export const StageService = Descriptor.Service<Stage>()("Factory/Stage")
export const FactoryNodes = Descriptor.Service<NodeRegistry.NodeRegistry<FactoryView>>()("Factory/FactoryNodes")
export const BeltNodes = Descriptor.Service<NodeRegistry.NodeRegistry<BeltView>>()("Factory/BeltNodes")
export const CrateNodes = Descriptor.Service<NodeRegistry.NodeRegistry<CrateView>>()("Factory/CrateNodes")

export const Game = Schema.bind(
  Schema.fragment({
    components: { Factory, Work, Belt, Crate },
    resources: { DeltaTime, Elapsed, Counters, Totals, Flow }
  })
)
