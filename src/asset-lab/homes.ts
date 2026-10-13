import { home } from "../content.ts"
import { homeVariant } from "../art.ts"
import { U } from "../iso.ts"
import { Drawing, palette, sides, type Side } from "./primitives.ts"

export function house(
  tier: 1 | 2 | 3,
  variantN = tier === 1 ? 0.03 : 0.28,
  id = tier === 1 ? "cottage" : tier === 2 ? "citizen" : "townhouse",
  options: { doors?: Partial<Record<Side, boolean>>; fit?: number; plate?: boolean } = {}
) {
  const fit = options.fit ?? 1
  const d = new Drawing(
    id,
    tier === 1 ? "Settler cottage" : tier === 2 ? "Citizen home" : "Townhouse",
    tier === 3
      ? "A burgher's townhouse with stone quoins, a cornice, iron balconies, a fanlight and a stepped entrance."
      : "Original roof palette, footprint, chimney, windows and awnings. Rear walls completed for rotation."
  )
  const variant = homeVariant(variantN)
  const a = (home.half + (tier >= 2 ? 1 : 0)) * U,
    H = home.tiers[tier].height
  d.asset.category = "homes"
  d.asset.reference = { type: "house", tier, variant: variantN }
  d.asset.footprint = 1
  if (options.plate !== false) d.plate(1)
  d.box(0, 0, a, a, 0, H)
  for (const side of sides) {
    const door = options.doors ? !!options.doors[side] : side === "right"
    for (const z of tier === 3 ? [13, 25] : tier === 2 ? [13] : []) d.line([d.wall(side, a, -a, z), d.wall(side, a, a, z)], 1, palette.ink, 0.7)
    if (door && fit > 0.15) d.door(side, a, Math.max(2, 9 * fit), 2 * U, 3 * U, 2 * U, variant.roof.shade)
    for (const floor of fit > 0.4 ? (tier === 3 ? [0, 12, 24] : tier === 2 ? [0, 12] : [0]) : []) {
      if (tier >= 2) {
        for (const along of [-3 * U, 3 * U]) if (!(door && floor === 0)) d.window(side, a, along, floor + 5)
      } else if (!door) d.window(side, a, 0, 5)
    }
  }
  if (fit > 0)
    d.gable(
      a,
      H,
      (tier >= 2 ? 10 : 8) * fit,
      variant.ridge,
      variant.roof.face,
      variant.roof.shade,
      fit > 0.8 && (variant.chimney || tier >= 2)
    )
  if (tier === 3 && fit > 0.75) {
    for (const side of sides) {
      const p = (s: number, z: number, out = 0.02) => d.wall(side, a, s, z, out)
      for (const x of [-a + U, a - U]) for (let z = 1; z < H; z += 4)
        d.face([p(x - 0.6 * U, z), p(x + 0.6 * U, z), p(x + 0.6 * U, z + 2), p(x - 0.6 * U, z + 2)], 0xe7e3d4, 0.75, 0xa7b1a1)
      d.line([p(-a - U, H - 1), p(a + U, H - 1)], 2, 0xb8c4af)
      for (const along of [-3 * U, 3 * U]) {
        d.line([p(along - 1.5 * U, 17, 0.055), p(along + 1.5 * U, 17, 0.055)], 1)
        for (const dx of [-1.5, 0, 1.5]) d.line([p(along + dx * U, 14, 0.055), p(along + dx * U, 17, 0.055)], 0.75)
      }
      if (options.doors ? options.doors[side] : side === "right") {
        d.face([p(-2 * U, 10), p(2 * U, 10), p(U, 13), p(-U, 13)], 0xe2ebde, 1)
        const [u, v] = p(0, 0, 0.035)
        for (let i = 0; i < 3; i++) {
          const h = 0.04 + i * 0.035
          d.box(u, v, side === "left" || side === "backLeft" ? 2.5 * U : h, side === "right" || side === "backRight" ? 2.5 * U : h, 0, 1.5 - i * 0.4, 0xe5e6dd, 0xd3d9cc, 0xc3ccbd, 0.75)
        }
      }
    }
  }
  return d.asset
}
