/**
 * The host state the view's systems are handed. None of it is saved, and the
 * simulation never reads it: the view talks to the simulation through edits
 * (`Outbox`, applied at the next step) and hears back through `Toast` and
 * `Selection` events.
 */
import { Descriptor } from "@typeonce/ritmo"

import type { Edit } from "../game/edits.ts"
import type { Interaction as InteractionValue, Shown as ShownValue } from "./contracts.ts"

/** What the player is doing with the map (see `Interaction`). */
export const Interaction = Descriptor.Service<InteractionValue>()("Town/Interaction")
/** What the view shows the UI and the renderer, filled in once a frame. */
export const Shown = Descriptor.Service<ShownValue>()("Town/Shown")
/** Edits for the simulation's next step: the same queue the UI pushes to. */
export const Outbox = Descriptor.Service<{ readonly push: (...edits: ReadonlyArray<Edit>) => void }>()("Town/Outbox")
/** The frame's length, for animation only: the simulation runs on `Time`. */
export const Clock = Descriptor.Service<{ deltaSeconds: number; elapsed: number }>()("Town/Clock")
