/** Small ways the view puts numbers into words. */

export const percent = (n: number, of: number) => `${Math.round((n / of) * 100)}%`
export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`
export const counted = (n: number, what: string) => `${n} ${what}${n === 1 ? "" : "s"}`
