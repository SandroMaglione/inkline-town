import { Drawing, palette, square, type Vertex } from "./primitives.ts"
import { buildStages } from "../art.ts"
import { kinds, type KindId } from "../content.ts"
import { U } from "../iso.ts"

export function makeSite(share: number) {
  const d = new Drawing(
    `site-${share === 0 ? "empty" : "supplied"}`,
    share === 0 ? "Marked construction site" : "Supplied construction site",
    "Stakes, ropes and incoming materials, using the original site proportions."
  )
  d.asset.category = "construction"
  d.asset.reference = { type: "site", share }
  d.asset.footprint = 2
  const p = 15 * U,
    s = p - U
  d.plate(2)
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
    a = kind.half * U,
    H = kind.roof === "gable" ? 20 : kind.stories * 32,
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
  if (stage.frame > 0) {
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
  const p = (x: number, z: number): Vertex => [x / 64, -x / 64, z]
  d.face([p(-7.5, 0), p(7.5, 0), p(7.5, 15), p(-7.5, 15)], 0xf6f7f3, 1, 0xc4523f)
  d.face([p(-1, 6), p(1, 6), p(1, 12), p(-1, 12)], 0xc4523f, 0)
  d.face([p(-1, 3), p(1, 3), p(1, 5), p(-1, 5)], 0xc4523f, 0)
  return d.asset
}
export function makeSmoke() {
  const d = new Drawing("smoke", "Chimney smoke", "The original fine smoke rings, on upright planes above the chimney.")
  d.asset.category = "construction"
  d.asset.reference = { type: "none" }
  d.asset.footprint = 1
  for (const t of [0.1, 0.4, 0.7]) {
    const r = 4 + t * 7,
      dx = Math.sin(t * 5) * 1.5,
      h = t * 34
    const ring = Array.from({ length: 25 }, (_, i): Vertex => [
      (dx + Math.cos((i / 24) * Math.PI * 2) * r) / 64,
      -(dx + Math.cos((i / 24) * Math.PI * 2) * r) / 64,
      h + Math.sin((i / 24) * Math.PI * 2) * r
    ])
    d.line(ring, 1, palette.ink, (1 - t) * 0.55)
  }
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
