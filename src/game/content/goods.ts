/** Goods: what they are, what they fetch, how they are counted, and how food spoils. */
import { Clock } from "@typeonce/ritmo"
import { step } from "./clock.ts"

export const goodIds = ["wood", "planks", "stone", "ore", "tools", "fish", "smoked", "wheat", "flour", "bread", "wool", "cloth", "furniture"] as const
export type GoodId = (typeof goodIds)[number]

/** Each good's crate label colour (the only colour a good has), and what traders pay for one. */
export const goods: Readonly<Record<GoodId, { readonly title: string; readonly color: number; readonly price: number }>> = {
  wood: { title: "wood", color: 0x8a6a45, price: 1 },
  planks: { title: "planks", color: 0xd27a34, price: 3 },
  stone: { title: "stone", color: 0x8f9891, price: 2 },
  ore: { title: "ore", color: 0x5a6479, price: 3 },
  tools: { title: "tools", color: 0x3d4943, price: 10 },
  fish: { title: "fish", color: 0x2f8c87, price: 2 },
  smoked: { title: "smoked fish", color: 0x9a5b3a, price: 4 },
  wheat: { title: "wheat", color: 0xd6ae2e, price: 1 },
  flour: { title: "flour", color: 0xc9b48a, price: 3 },
  bread: { title: "bread", color: 0xc4523f, price: 4 },
  wool: { title: "wool", color: 0xa7ada4, price: 2 },
  cloth: { title: "cloth", color: 0x8a58a8, price: 6 },
  furniture: { title: "furniture", color: 0x9a6b3f, price: 9 }
}

/**
 * Trade: at every collection, traders buy what the town sells beyond the
 * reserve it keeps, up to `TRADE_LOAD` of each good.
 */
export const TRADE_LOAD = 12
/** The most the town can choose to keep of each good before selling it. */
export const RESERVE_MAX = 200
/** A new town neither sells nor buys: what leaves the town, and what it pays for, is the mayor's to decide. */
export const trade = { sells: [] as ReadonlyArray<GoodId>, reserve: 25 }

export type Amounts = Readonly<Record<GoodId, number>>
export const none: Amounts = { wood: 0, planks: 0, stone: 0, ore: 0, tools: 0, fish: 0, smoked: 0, wheat: 0, flour: 0, bread: 0, wool: 0, cloth: 0, furniture: 0 }
export const amounts = (some: Partial<Record<GoodId, number>>): Amounts => ({ ...none, ...some })
export const total = (a: Amounts): number => goodIds.reduce((sum, g) => sum + a[g], 0)
/** Amounts made good by good. */
export const each = (f: (good: GoodId) => number): Amounts => {
  const out: Record<GoodId, number> = { ...none }
  for (const g of goodIds) out[g] = f(g)
  return out
}

/** Goods a market walker hands out to homes. */
export const provisions: ReadonlyArray<GoodId> = ["fish", "smoked", "bread", "cloth", "furniture"]
/** Goods the top bar shows, in order. */
export const shownGoods: ReadonlyArray<GoodId> = ["wood", "planks", "stone", "tools", "fish", "smoked", "bread", "cloth", "furniture"]
/** Goods that are food in store (see `larder`). */
export const foods: ReadonlyArray<GoodId> = ["fish", "smoked", "bread"]

/**
 * Food spoils in store: about how many seconds a fish or a loaf keeps. A
 * granary keeps it `KEEPS` times as long; smoked fish, wheat, and flour keep.
 * Every `SPOIL_TICKS`, each shelf loses its share of what it holds.
 */
export const spoils: Partial<Record<GoodId, number>> = { fish: 180, bread: 300 }
export const SPOIL_TICKS = Clock.steps(Clock.duration(step, 10))
