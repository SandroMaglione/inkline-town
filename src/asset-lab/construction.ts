import { Drawing, palette, square, type Vertex } from "./primitives.ts"
import { buildStages } from "../art.ts"
import { kinds, type KindId } from "../content.ts"
import { U } from "../iso.ts"
import { buildingDimensions } from "./buildings.ts"

export function makeSite(share: number, size = 2) {
  const d = new Drawing(
    `site-${share === 0 ? "empty" : "supplied"}`,
    share === 0 ? "Marked construction site" : "Supplied construction site",
    "Stakes, ropes and incoming materials, using the original site proportions."
  )
  d.asset.category = "construction"
  d.asset.reference = { type: "site", share }
  d.asset.footprint = size
  const p = (size * 8 - 1) * U,
    s = p - U
  d.plate(size)
  d.line([...square(0, 0, s, 6), [-s, -s, 6]], 1, palette.ink, 0.45)
  for (const [u, v] of [
    [-s, -s],
    [s, -s],
    [s, s],
    [-s, s]
  ])
    d.line(
      [
        [u!, v!, 0],
        [u!, v!, 7]
      ],
      1.5
    )
  const spots = [
    [s - 3 * U, s - 3 * U, 0],
    [s - 3 * U, s - 8 * U, 0],
    [s - 3 * U, s - 5.5 * U, 5]
  ]
  for (let i = 0; i < Math.min(3, Math.ceil(share * 3)); i++) {
    const [u, v, z] = spots[i]!
    d.crate(u!, v!, z!, 0x8f9891, 2 * U, 5)
  }
  return d.asset
}
export function makeConstruction(kindId: KindId, progress: number) {
  const kind = kinds[kindId],
    a = buildingDimensions(kindId).half,
    H = buildingDimensions(kindId).height,
    stage = buildStages(progress)
  const d = new Drawing(
    `build-${kindId}-${progress}`,
    `${kind.title} · ${progress < 0.5 ? "frame" : "walls"}`,
    "The same construction timing and frame/wall dimensions as the 2D drawing."
  )
  d.asset.category = "construction"
  d.asset.reference = { type: "building", kind: kindId, build: progress }
  d.asset.footprint = kind.size
  d.plate(kind.size)
  if (stage.frame > 0 && stage.walls < 1) {
    const top = Math.round(H * stage.frame)
    d.line([...square(0, 0, a, top), [-a, -a, top]], 1)
    for (const [u, v] of [
      [-a, -a],
      [a, -a],
      [a, a],
      [-a, a]
    ])
      d.line(
        [
          [u!, v!, 0],
          [u!, v!, top]
        ],
        1
      )
  }
  if (stage.walls > 0) d.box(0, 0, a, a, 0, Math.round(H * stage.walls))
  return d.asset
}
export function makeMarker() {
  const d = new Drawing("problem-marker", "Problem marker", "The original red exclamation mark, as a thin world-space sign.")
  d.asset.category = "construction"
  d.asset.reference = { type: "none" }
  d.asset.footprint = 1
  const p = (x: number, z: number, out = 0): Vertex => [x / 64+out, -x / 64+out, z]
  d.face([p(-7.5, 0), p(7.5, 0), p(7.5, 15), p(-7.5, 15)], 0xf6f7f3, 1, 0xc4523f)
  for(const out of [-0.008,0.008]){
    d.face([p(-1.2, 6,out), p(1.2, 6,out), p(1.2, 12,out), p(-1.2, 12,out)], 0xc4523f, 0)
    d.face([p(-1.2, 3,out), p(1.2, 3,out), p(1.2, 5,out), p(-1.2, 5,out)], 0xc4523f, 0)
  }
  return d.asset
}
/** Over a building the town can upgrade now: a gold arrow up, on the same thin sign as the problem marker. */
export function makeUpgradeMarker() {
  const d = new Drawing("upgrade-marker", "Upgrade marker", "A gold arrow on a thin world-space sign: this building can be upgraded now.")
  d.asset.category = "construction"
  d.asset.reference = { type: "none" }
  d.asset.footprint = 1
  const gold = 0xb8862f
  const p = (x: number, z: number, out = 0): Vertex => [x / 64 + out, -x / 64 + out, z]
  d.face([p(-7.5, 0), p(7.5, 0), p(7.5, 15), p(-7.5, 15)], 0xfbf6e8, 1, gold)
  for (const out of [-0.008, 0.008]) {
    d.face([p(0, 12.6, out), p(4.6, 7.6, out), p(-4.6, 7.6, out)], gold, 0)
    d.face([p(-1.6, 2.6, out), p(1.6, 2.6, out), p(1.6, 7.8, out), p(-1.6, 7.8, out)], gold, 0)
  }
  return d.asset
}
export function makeSmoke() {
  const d = new Drawing("smoke", "Chimney smoke", "Animated soft smoke rises and disperses from a flue. The plume uses the same particle shader as the live game.")
  d.asset.category = "construction"
  d.asset.reference = { type: "none" }
  d.asset.footprint = 1
  d.box(0,0,2*U,2*U,0,12)
  d.box(0,0,2.4*U,2.4*U,10,2,0xb7c0af,0xa2ad99,0x8f9d85,1)
  d.face(square(0,0,1.5*U,12.03),0x687363,0)
  d.asset.smokeEffect={origin:[0,0,12.2]}
  return d.asset
}
export function makePlot(look: "hover" | "picked" | "blocked" | "reach") {
  const d = new Drawing(`plot-${look}`, `Plot · ${look}`, "Ground-space placement and reach outlines, preserving the original ink colours.")
  d.asset.category = "construction"
  d.asset.reference = { type: "plot", look }
  d.asset.footprint = 2
  const color = look === "blocked" ? 0xc4523f : look === "picked" ? 0x3d6db5 : palette.ink
  d.line(
    [...square(0, 0, 1, 0.05), [-1, -1, 0.05]],
    look === "picked" || look === "blocked" ? 1.5 : 1,
    color,
    look === "hover" ? 0.35 : look === "reach" ? 0.45 : 0.85
  )
  if (look === "picked" || look === "blocked")
    for (const [u, v] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ]) {
      d.line(
        [
          [u! * 0.75, v!, 0.06],
          [u! + Math.sign(u!) * U, v!, 0.06],
          [u!, v! + Math.sign(v!) * U, 0.06],
          [u!, v! * 0.75, 0.06]
        ],
        1.5,
        color,
        0.9
      )
    }
  return d.asset
}
