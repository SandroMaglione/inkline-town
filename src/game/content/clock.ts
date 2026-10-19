/**
 * The simulation's clock: its fixed step, and seconds or steps read from
 * data turned into whole steps and cadences.
 */
import { Clock } from "@typeonce/ritmo"

/** The simulation's fixed step: 60 a second, shared by the page's loop, the replay recorder, and the `Time` clock. */
export const step = Clock.hz(60)

/**
 * Seconds read from data (a kind's, a rule's) as whole steps. A span
 * shorter than one step, which `Clock.durationRaw` refuses, is no wait at
 * all: 0 steps (`resolveRules` refuses a kind's `seconds` that short, so a
 * period is always at least one step).
 */
export const stepsOf = (seconds: number): number => {
  const span = Clock.durationRaw(step, seconds)
  return span.ok ? Clock.steps(span.value) : 0
}

/**
 * A period the rules give in whole steps (patchable, so data) as a clock
 * duration for `Clock.every`; refused when under one step (a period of 0
 * never comes round, as `tick % 0` never did).
 */
export const periodOf = (steps: number) => Clock.durationRaw(step, steps / step.hz)

/** A cadence supplied as whole steps by the game's rules; invalid periods never fire. */
export const every = (time: Clock.Time<60>, steps: number): boolean => {
  const period = periodOf(steps)
  return period.ok && Clock.every(time, period.value)
}
