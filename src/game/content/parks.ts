import { free, type Kind } from "./kinds/index.ts"

/**
 * A park is laid out cell by cell: ground painted on empty land (lawn,
 * flower beds, gravel paths, a paved square), and on any of its cells one
 * furnishing (a lamp, a fountain, a statue). Cells of ground that touch
 * make one park, and the whole park is what the street around it feels
 * (see `parkSources` in `appeal.ts`): its `beauty` adds up from its
 * ground, its furnishings, and its entrances (a walk or a square beside a
 * road), and that is the desirability it gives the cells around it, out to
 * a reach that grows with its size. Nobody walks through it: it is not a
 * road.
 */
export const groundIds = ["lawn", "flowers", "path", "square"] as const
export type GroundId = (typeof groundIds)[number]
export const propIds = ["lamp", "fountain", "statue"] as const
export type PropId = (typeof propIds)[number]

export interface ParkPiece {
  readonly title: string
  readonly blurb: string
  readonly cost: Kind["cost"]
  /** Coins a minute. */
  readonly upkeep: number
  /** What it adds to its park's beauty. */
  readonly beauty: number
  readonly unlock: { readonly residents: number; readonly citizens: number }
}

export const grounds: Readonly<Record<GroundId, ParkPiece>> = {
  lawn: { title: "Lawn", blurb: "grass to lay a park out on", cost: { coins: 2, materials: {} }, upkeep: 0.05, beauty: 0.25, unlock: free },
  flowers: { title: "Flower bed", blurb: "planted borders: prettier than lawn", cost: { coins: 5, materials: {} }, upkeep: 0.15, beauty: 0.75, unlock: free },
  path: { title: "Gravel path", blurb: "a walk through the park", cost: { coins: 3, materials: {} }, upkeep: 0.05, beauty: 0.25, unlock: free },
  square: { title: "Paved square", blurb: "stone setts, for a statue or a fountain to stand on", cost: { coins: 3, materials: { stone: 1 } }, upkeep: 0.05, beauty: 0.25, unlock: free }
}

export const props: Readonly<Record<PropId, ParkPiece>> = {
  lamp: { title: "Lamp", blurb: "an iron lamp post along the walk", cost: { coins: 12, materials: { tools: 1 } }, upkeep: 0.2, beauty: 1.5, unlock: free },
  fountain: { title: "Fountain", blurb: "a stone basin of fresh water", cost: { coins: 70, materials: { stone: 3 } }, upkeep: 2, beauty: 4, unlock: { residents: 30, citizens: 0 } },
  statue: { title: "Statue", blurb: "a founder in stone, the pride of the park", cost: { coins: 160, materials: { stone: 6 } }, upkeep: 3, beauty: 5, unlock: { residents: 0, citizens: 20 } }
}

/** How a park's beauty adds up (see `parkSources`). */
export const park = {
  /** Ground counts for this much beauty at most, however big the park. */
  groundMost: 4,
  /** One furnishing counts for every this many whole cells (none on a park of one): a park crowded with benches is no nicer. */
  cellsPerProp: 2,
  /** Each furnishing of a kind after the first counts this share of the one before. */
  repeat: 0.5,
  /** A walk or a square beside a road is a way in from the street: each adds this, up to `entrances` of them. */
  entrance: 1.5,
  entrances: 2,
  /** The most a park gives the streets around it. */
  most: 15,
  /**
   * Where several parks reach a cell, the finest counts in full and the
   * others this share of theirs: a street lined with scraps of park is
   * not a park.
   */
  others: 0.5,
  /** How far it reaches: `reach[0]` cells, and one more for every `reach[1]` cells of park, up to `reach[2]`. */
  reach: [2, 6, 5] as const
}
