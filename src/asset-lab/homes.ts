import { home } from "../content.ts"
import { homeVariant } from "../art.ts"
import { U } from "../iso.ts"
import { Drawing, palette, sides, type Side } from "./primitives.ts"
import { human, residentialHeight } from "./dimensions.ts"

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
      ? "A modest three-storey townhouse with regular windows, a simple timber door and the town's familiar gabled roof."
      : "Original roof palette, footprint, chimney, windows and awnings. Rear walls completed for rotation."
  )
  const variant = homeVariant(variantN)
  const a = (home.half + (tier >= 2 ? 1 : 0)) * U,
    H = residentialHeight(tier)
  d.asset.category = "homes"
  d.asset.reference = { type: "house", tier, variant: variantN }
  d.asset.footprint = 1
  if (options.plate !== false) d.plate(1)
  d.box(0, 0, a, a, 0, H)
  for (const side of sides) {
    const door = options.doors ? !!options.doors[side] : side === "right"
    for (let floor = 1; floor < tier; floor++) d.line([d.wall(side, a, -a, floor * human.floor + 1), d.wall(side, a, a, floor * human.floor + 1)], 1, palette.ink, 0.7)
    if (door && fit > 0.15) {
      const p = (s: number, z: number, out = .015) => d.wall(side, a, s, z, out)
      d.face([p(-1.45*U,0),p(1.45*U,0),p(1.45*U,human.door*fit),p(-1.45*U,human.door*fit)],0xb59b77,.8)
      for (const x of [-.5,.5]) d.line([p(x*U,0,.02),p(x*U,human.door*fit,.02)],.4,0x8a6a45)
      d.line([p(.9*U,8*fit,.025),p(.9*U,10*fit,.025)],.7)
      d.face([p(-2*U,21*fit),p(2*U,21*fit),p(2*U,20.5*fit,.8*U),p(-2*U,20.5*fit,.8*U)],variant.roof.shade,.7)
    }
    for (const floor of fit > 0.4 ? Array.from({length:tier},(_,i)=>i*human.floor) : []) {
      if (tier >= 2) {
        for (const along of [-3 * U, 3 * U]) if (!(door && floor === 0)) d.window(side, a, along, floor + 9, 7)
      } else if (!door) d.window(side, a, 0, 9, 7)
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
  return d.asset
}
