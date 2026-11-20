/** A share as the view shows it: a whole number of percent. */
export const percent = (n: number, of: number) => `${Math.round((n / of) * 100)}%`
