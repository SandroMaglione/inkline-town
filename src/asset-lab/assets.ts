/** Portable polygon-and-stroke assets. Floor coordinates remain in cells;
 * heights remain in the original drawing's pixels. No renderer types here. */
import { kindIds, goodIds, kinds, home, propIds } from "../content.ts"
import { withAppearance } from "./appearance.ts"
import { groundAsset } from "../render3d/models.ts"
import { key } from "../grid.ts"
import { makeBuilding } from "./buildings.ts"
import { house } from "./homes.ts"
import { marketHall, church } from "./service-upgrades.ts"
import { U } from "../iso.ts"
import { makeTree, makeRock, makeField, makeRoadPatch, makeWater } from "./land.ts"
import { personCatalogue, makeCarrier, makeGoods, makeCrate } from "./people.ts"
import { makeSite, makeConstruction, makeMarker, makeSmoke, makePlot } from "./construction.ts"
import { makeParkProp, makeRuin, makeSamplePark } from "./town-props.ts"

import { Drawing, mix, pale, square, sides, palette, type InkAsset, type Vertex } from "./primitives.ts"
export * from "./primitives.ts"

export { house } from "./homes.ts"

function firTree() {
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263) >>> 0
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  const h2 = hash(17, 7),
    h3 = hash(101, 3),
    size = 0.85 + h2 * 0.3,
    ox = Math.round((h3 - 0.5) * 12),
    oy = Math.round((h2 - 0.5) * 5)
  const u = ox / 64 + oy / 32,
    v = -ox / 64 + oy / 32,
    trunk = Math.round(6 * size),
    tiers = h2 < 0.5 ? 2 : 3,
    step = (24 * size) / (tiers + 1)
  const d = new Drawing(
    "fir",
    "Fir tree",
    "A sculpted volume with the original stepped silhouette and two leaf colours. The canopy has real depth."
  )
  d.face(
    Array.from({ length: 40 }, (_, i): Vertex => {
      const t = (i * Math.PI) / 20,
        x = ox + 3 * size + 9 * size * Math.cos(t),
        y = oy + 3.5 * size * Math.sin(t)
      return [x / 64 + y / 32, -x / 64 + y / 32, -0.02]
    }),
    0xe3e6de,
    0
  )
  d.line(
    [
      [u, v, 0],
      [u, v, trunk]
    ],
    1.5,
    0x6b5a45
  )
  for (let i = 0; i < tiers; i++) {
    const w = (8 * size * (1 - i * 0.22)) / 64,
      depth = w,
      z = trunk - 2 + i * step
    // A sloped lower rim gives the canopy full depth while preserving its
    // shallow drawn notch at the original camera angle.
    const lift = depth * 32 - 1.5 * size
    const ring: Array<Vertex> = [
      [u - depth, v - depth, z - lift],
      [u + w, v - w, z],
      [u + depth, v + depth, z + lift],
      [u - w, v + w, z]
    ]
    const light = h3 < 0.5 ? 0xd9e5d7 : 0xd3e0d3,
      shade = h3 < 0.5 ? 0xb3c7b4 : 0xa9bfab
    for (let j = 0; j < 4; j++) d.face([ring[j]!, ring[(j + 1) % 4]!, [u, v, z + 2 * step]], j >= 2 ? light : shade, 0)
    d.face(ring, shade, 0)
    d.line([...ring, ring[0]!], 1.5)
    // Outer contours only; a wireframe would add an unwanted central seam.
    for (const f of d.asset.faces.slice(-5)) f.contour = i + 1
  }
  return d.asset
}

function props() {
  const d = new Drawing("goods", "Goods & crates", "The same labelled wood crates, plank stacks and stone blocks, completed on all sides.")
  d.plate(2)
  d.crate(0.35, 0.3, 0, 0x2f8c87, 3 * U, 12)
  d.crate(-0.15, 0.3, 0, 0x8a58a8, 3 * U, 12)
  d.crate(0.1, 0.3, 12, 0xd27a34, 3 * U, 12)
  for (let i = 0; i < 3; i++) d.box(0.3, -0.4, 1.1 * U, 3 * U, i * 2.5, 2.5, 0xf0c59a, 0xe2a873, 0xd2945c, 1)
  d.box(-0.4, -0.35, 1.2 * U, 1.2 * U, 0, 5, 0xeeefea, 0xdcded7, 0xc9ccc4)
  return d.asset
}

const approvedAssets: Array<InkAsset> = [
  house(1),
  house(2),
  makeBuilding("townhall"),
  makeBuilding("mill"),
  makeBuilding("market"),
  props(),
  firTree()
]

const baseFir = approvedAssets.find((asset) => asset.id === "fir")!
baseFir.category = "land"
baseFir.reference = { type: "tree", x: 0, y: 0, grown: 1 }
baseFir.footprint = 1
for (const face of baseFir.faces) if (face.contour) face.contourWidth = 1.5
approvedAssets.find((asset) => asset.id === "goods")!.category = "cargo"
approvedAssets.find((asset) => asset.id === "goods")!.footprint = 2
const additional: Array<InkAsset> = [marketHall(), church()]
for (const kind of kindIds) if (!approvedAssets.some((asset) => asset.id === kind)) additional.push(makeBuilding(kind))
const names = ["terracotta", "slate", "thatch", "moss"]
for (const tier of [1, 2] as const)
  for (let i = 0; i < 4; i++) {
    if ((tier === 1 && i === 0) || (tier === 2 && i === 1)) continue
    const asset = house(tier, i / 4 + 0.03, `${tier === 1 ? "cottage" : "citizen"}-${names[i]}`)
    asset.title = `${tier === 1 ? "Cottage" : "Citizen home"} · ${names[i]}`
    additional.push(asset)
  }
additional.push(house(3))
for (const tier of [1, 2, 3] as const) for (const appearance of ["fine", "poor", "worn", "winter"] as const) {
  const base = house(tier), a = (home.half + (tier >= 2 ? 1 : 0)) * U
  const model = withAppearance(base, a, home.tiers[tier].height, { band: appearance === "fine" || appearance === "poor" ? appearance : "plain", worn: appearance === "worn", winter: appearance === "winter" }, true)
  model.id = `${base.id}-${appearance}`; model.title = `${base.title} · ${appearance}`; model.appearance = appearance
  model.note = appearance === "winter" ? "Snow settles on roof surfaces through the material shader." : appearance === "fine" ? "Fresh plaster and warm windows on the same house mesh." : "Dirt, exposed brick, cracks and roof moss through the material shader."
  additional.push(model)
}
for (const id of ["granary", "smokehouse", "firewatch", "healer", "hospital", "watchhouse", "builder"] as const) for (const appearance of ["winter", "worn"] as const) {
  const kind = kinds[id], base = makeBuilding(id)
  const model = withAppearance(base, kind.half * U, kind.roof === "gable" ? 20 : kind.stories * 32, { winter: appearance === "winter", worn: appearance === "worn" })
  model.id = `${id}-${appearance}`; model.title = `${kind.title} · ${appearance}`; model.appearance = appearance
  additional.push(model)
}
for (const type of ["fir", "broadleaf", "poplar"] as const)
  for (const grown of [0.3, 0.6, 1]) {
    if (type === "fir" && grown === 1) continue
    additional.push(makeTree(type, grown, `${type}-${grown === 1 ? "grown" : grown >= 0.5 ? "young" : "sapling"}`))
  }
for (const ore of [false, true]) for (const full of [false, true]) additional.push(makeRock(ore, full))
for (const ore of [false, true]) for (const [w, h] of [[2, 1], [2, 2], [3, 3]] as const) additional.push(makeRock(ore, true, 0, w, h))
for (const stage of [0, 1, 2, 3] as const) additional.push(makeField(stage))
additional.push(makeRoadPatch(), makeWater(), ...personCatalogue())
{
  const cells = new Set([key(8, 8), key(7, 8), key(9, 8), key(8, 7), key(8, 9)])
  const asset = groundAsset(cells, new Set(), false, cells)
  const shift = ([u, v, z]: Vertex): Vertex => [u - 8.5, v - 8.5, z]
  asset.faces.forEach(f => { f.points = f.points.map(shift) }); asset.strokes.forEach(s => { s.points = s.points.map(shift) })
  asset.id = "paved-street"; asset.title = "Paved street"; asset.note = "Raised stone setts with staggered joints and joined edges."; asset.category = "land"; asset.reference = { type: "roads" }; asset.footprint = 3
  additional.push(asset)
}
additional.push(makeSamplePark(), ...propIds.map(makeParkProp))
for (const barrow of [false, true]) {
  additional.push(makeCarrier(null, barrow))
  for (const good of goodIds) for (const count of [1, 4]) additional.push(makeCarrier(good, barrow, count))
}
for (const good of goodIds) additional.push(makeGoods(good), makeCrate(good))
additional.push(
  makeSite(0),
  makeSite(1),
  makeConstruction("warehouse", 0.3),
  makeConstruction("warehouse", 0.65),
  makeMarker(),
  makeSmoke(),
  ...(["burnt", "collapsed", "derelict"] as const).map((cause) => makeRuin(1, cause)),
  makeRuin(2, "burnt"),
  ...["hover", "picked", "blocked", "reach"].map((look) => makePlot(look as "hover" | "picked" | "blocked" | "reach"))
)
export const inkAssets: ReadonlyArray<InkAsset> = [...approvedAssets, ...additional]
export const assetById = new Map(inkAssets.map((asset) => [asset.id, asset]))
export const assetCategoryTitles = {
  buildings: "Buildings",
  homes: "Homes",
  land: "Land",
  people: "People",
  cargo: "Cargo & vehicles",
  construction: "Construction & effects"
} as const
