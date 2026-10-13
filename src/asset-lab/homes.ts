import { home } from "../content.ts"
import { homeVariant } from "../art.ts"
import { U } from "../iso.ts"
import { Drawing, palette, sides, type Side } from "./primitives.ts"

export function house(
  tier: 1 | 2,
  variantN = tier === 1 ? 0.03 : 0.28,
  id = tier === 1 ? "cottage" : "citizen",
  options: { doors?: Partial<Record<Side, boolean>>; fit?: number; plate?: boolean } = {}
) {
  const fit = options.fit ?? 1
  const d = new Drawing(
    id,
    tier === 1 ? "Settler cottage" : "Citizen home",
    "Original roof palette, footprint, chimney, windows and awnings. Rear walls completed for rotation."
  )
  const variant = homeVariant(variantN)
  const a = (home.half + (tier === 2 ? 1 : 0)) * U,
    H = home.tiers[tier].height
  d.asset.category = "homes"
  d.asset.reference = { type: "house", tier, variant: variantN }
  d.asset.footprint = 1
  if (options.plate !== false) d.plate(1)
  d.box(0, 0, a, a, 0, H)
  for (const side of sides) {
    const door = options.doors ? !!options.doors[side] : side === "right"
    if (tier === 2) d.line([d.wall(side, a, -a, 13), d.wall(side, a, a, 13)], 1, palette.ink, 0.7)
    if (door && fit > 0.15) d.door(side, a, Math.max(2, 9 * fit), 2 * U, 3 * U, 2 * U, variant.roof.shade)
    for (const floor of fit > 0.4 ? (tier === 2 ? [0, 12] : [0]) : []) {
      if (tier === 2) {
        for (const along of [-3 * U, 3 * U]) if (!(door && floor === 0)) d.window(side, a, along, floor + 5)
      } else if (!door) d.window(side, a, 0, 5)
    }
  }
  if (fit > 0)
    d.gable(
      a,
      H,
      (tier === 2 ? 10 : 8) * fit,
      variant.ridge,
      variant.roof.face,
      variant.roof.shade,
      fit > 0.8 && (variant.chimney || tier === 2)
    )
  return d.asset
}
