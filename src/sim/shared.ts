/** Queries and small helpers the simulation's systems share. */
import { ticks, winters, YEARS_PER_TERM, type WinterId } from "../content.ts"
import { doors, type TileLike, type Use } from "../grid.ts"
import { Field, Game, House, Road, Rock, Ruin, Tile, Tree, Water, type GridValue } from "../schema.ts"

/** Every tile, with enough to tell what it is. */
export const TileRead = Game.Query({
  selection: {
    tile: Game.Query.read(Tile),
    road: Game.Query.optional(Road),
    house: Game.Query.optional(House),
    tree: Game.Query.optional(Tree),
    rock: Game.Query.optional(Rock),
    water: Game.Query.optional(Water),
    field: Game.Query.optional(Field),
    ruin: Game.Query.optional(Ruin)
  }
})

export const useOf = (data: {
  readonly road: { readonly present: boolean }
  readonly house: { readonly present: boolean }
  readonly tree: { readonly present: boolean }
  readonly rock: { readonly present: boolean }
  readonly water: { readonly present: boolean }
  readonly field: { readonly present: boolean }
  readonly ruin: { readonly present: boolean }
}): Use =>
  data.road.present ? "road"
  : data.house.present ? "house"
  : data.tree.present ? "tree"
  : data.rock.present ? "rock"
  : data.water.present ? "water"
  : data.field.present ? "field"
  : data.ruin.present ? "ruin"
  : "building"

export const connected = (grid: GridValue, tile: TileLike): boolean => doors(grid, tile).length > 0

/** A walker's steps from one cell's centre to the next: three to a unit, so it moves on the lattice. */
export const CELL_STEPS = 48

// ── Time ──────────────────────────────────────────────────────────────────

/** Steps since the town was founded. */
export const elapsed = (time: { readonly tick: number }, charter: { readonly founded: number }) => time.tick - charter.founded
export const termTicks = (charter: { readonly term: number }) => ticks(charter.term * 60)
export const yearTicks = (charter: { readonly term: number }) => Math.round(termTicks(charter) / YEARS_PER_TERM)

/** A charter's winters: the first year has none. */
export type Almanac = ReadonlyArray<WinterId | "none">
interface Seasoned {
  readonly term: number
  readonly winters?: Almanac
}

/** The winter that ends year `year` (from 1), or `null` for none: the first year's, and any past the term. */
export const winterOf = (charter: Seasoned, year: number): WinterId | null => {
  if (year <= 1 || year > YEARS_PER_TERM) return null
  const w = charter.winters?.[year - 1]
  return w === undefined ? "normal" : w === "none" ? null : w
}

/** Rolls each year's winter from a random number in 0 → 1 a year (the first year's is spared). */
export const rollWinters = (next: () => number): Array<WinterId | "none"> =>
  Array.from({ length: YEARS_PER_TERM }, (_, i) => {
    if (i === 0) return "none"
    const r = next()
    return r < winters.mild.chance ? "mild" : r < winters.mild.chance + winters.normal.chance ? "normal" : "hard"
  })

/**
 * The season `t` steps into a term: which year, whether it is winter (and
 * which), how long until that changes, and the next winter the almanac
 * foresees. The first year is spared its winter: a new town has a year to
 * find its feet. A hard winter starts earlier in its year and lasts half
 * as long again.
 */
export const seasonAt = (t: number, charter: Seasoned) => {
  const year = yearTicks(charter)
  const into = t % year
  const number = Math.floor(t / year) + 1
  const thawOf = (n: number) => {
    const w = winterOf(charter, n)
    return w === null ? year : Math.round(year * (1 - winters[w].share))
  }
  const thaw = thawOf(number)
  const winter = into >= thaw
  // The next winter to come: this year's, if it is still ahead, or the next's.
  const ahead = !winter && winterOf(charter, number) !== null ? number : number + 1
  const left = winter ? year - into : ahead === number ? thaw - into : year - into + thawOf(number + 1)
  return {
    year: number,
    winter,
    /** This winter's severity, while it lasts. */
    severity: winter ? winterOf(charter, number) : null,
    /** The coming winter's severity, or `null` when the term ends first. */
    coming: winterOf(charter, ahead),
    left
  }
}

// ── The chronicle ─────────────────────────────────────────────────────────

type Lines = ReadonlyArray<{ readonly tick: number; readonly text: string; readonly alarm: boolean }>
/** A line in the chronicle; an `alarm` is also news the page announces. */
export const write = (
  chronicle: { update: (f: (c: { readonly lines: Lines }) => { lines: Lines }) => void },
  tick: number,
  text: string,
  alarm = false
) => chronicle.update((c) => ({ lines: [...c.lines, { tick, text, alarm }].slice(-200) }))
