// Two casts that switch type checking off (reported) and two ordinary ones (allowed).
const anything: unknown = 1
export const silenced = anything as never
export const forced = anything as unknown as string
export const narrowed = [1, 2] as const
export const widened = 1 as number
