import type { KindId } from "../../game/content/index.ts"
import { assetById } from "../../render/three/assets/assets.ts"
import { Drawing, type InkAsset } from "../../render/three/assets/primitives.ts"
import { chair, chest } from "../../render/three/assets/furniture.ts"
import { bench } from "../../render/three/assets/town-props.ts"
import { scaffoldAsset } from "../../render/three/assets/scaffolding.ts"

// This review belongs to one approved revision. Future building kinds should
// not silently join a comparison whose frozen originals cannot contain them.
const reviewedKinds = ["townhall", "warehouse", "lumberjack", "forester", "quarry", "mine", "fishery", "sawmill", "smithy", "farm", "mill", "bakery", "sheep", "weaver", "market", "chapel", "granary", "smokehouse", "firewatch", "healer", "hospital", "watchhouse", "builder", "carpenter"] as const satisfies ReadonlyArray<KindId>
export const architectureIds = ["cottage", "citizen", "townhouse", ...reviewedKinds,
  "guildhall", "cityhall", "depot", "masonry", "estate", "ovenworks", "fire-brigade", "market-hall", "church"]

export function proportionModels(): InkAsset[] {
  const models = architectureIds.map(id => assetById.get(id)!)
  for (const [id, title, draw] of [["chair", "Chair", chair], ["chest", "Chest", chest], ["bench", "Bench", bench]] as const) {
    const d = new Drawing(id, title, "Shared furnishing, shown beside an unchanged walker.")
    draw(d, 0, 0); d.asset.footprint = 1; d.asset.category = "cargo"; models.push(d.asset)
  }
  for (const id of ["cart-furniture-4", "barrow-furniture-4", "crate-wood"]) models.push(assetById.get(id)!)
  for (const share of [.15, .5, .9]) {
    const a = scaffoldAsset(2, 28, share)
    models.push({...a, id: `scaffold-${share * 100}`, title: `Scaffold · ${share * 100}% delivered`})
  }
  return models
}
