import { inkAssets, palette, type InkAsset, type Vertex } from "../asset-lab/assets.ts"

export interface MapBuilding {
  id: number
  asset: string
  title: string
  x: number
  y: number
  size: number
}
const town: InkAsset = { id: "map", title: "Inkline harbour", note: "", faces: [], strokes: [] }
const buildings: Array<MapBuilding> = []
const effects: Array<{ asset: string; x: number; y: number; height: number }> = []
let contour = 1
const edge = (points: ReadonlyArray<Vertex>, width = 1, color = palette.ink, opacity = 1) =>
  town.strokes.push({ points, width, color, opacity })
const face = (points: ReadonlyArray<Vertex>, color: number, outline = false) => {
  town.faces.push({ points, color })
  if (outline) edge([...points, points[0]!], 1.5)
}
const square = (x: number, y: number, half: number, z: number): Array<Vertex> => [
  [x - half, y - half, z],
  [x + half, y - half, z],
  [x + half, y + half, z],
  [x - half, y + half, z]
]

// A slightly irregular coast, with all coordinates in the game's cell units.
const coast: Array<Vertex> = [
  [-19, -10, -0.5],
  [-17, -14, -0.5],
  [-10, -16, -0.5],
  [-2, -16.5, -0.5],
  [8, -15, -0.5],
  [16, -12, -0.5],
  [19, -6, -0.5],
  [19.5, 2, -0.5],
  [17, 10, -0.5],
  [13, 14, -0.5],
  [5, 16, -0.5],
  [-5, 16, -0.5],
  [-14, 13, -0.5],
  [-18, 7, -0.5],
  [-20, 0, -0.5]
]
face(coast, 0xf0f2ec, true)
// Pale foreshore and a second restrained shoreline outside the land.
edge([...coast.map(([x, y, z]): Vertex => [x * 1.016, y * 1.016, z - 0.1]), [-19 * 1.016, -10 * 1.016, -0.6]], 1, 0x9fb3b0, 0.45)

const roads = new Set<string>()
for (let x = -15; x <= 15; x++) for (const y of [-8, -2, 4, 10]) roads.add(`${x},${y}`)
for (let y = -12; y <= 13; y++) for (const x of [-10, 0, 10]) roads.add(`${x},${y}`)
for (const cell of roads) {
  const [x, y] = cell.split(",").map(Number) as [number, number]
  const half = 0.375,
    z = -0.28
  const variant = ((x * 37 + y * 19 + 131) >>> 0) % 10
  const color = variant < 3 ? 0xe2e4dd : variant > 8 ? 0xe9eae4 : 0xe6e8e2
  face(square(x, y, half, z), color)
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ] as const) {
    const q = (along: number, across: number, height = z): Vertex => [x + dx * along - dy * across, y + dy * along + dx * across, height]
    if (roads.has(`${x + dx},${y + dy}`)) {
      face([q(half, -half), q(0.5, -half), q(0.5, half), q(half, half)], color)
      edge([q(half, -half, z + 0.02), q(0.5, -half, z + 0.02)], 1.5)
      edge([q(half, half, z + 0.02), q(0.5, half, z + 0.02)], 1.5)
      edge([q(1 / 16, 0, z + 0.03), q(3 / 16, 0, z + 0.03)], 1, 0xb4b9b1)
      edge([q(5 / 16, 0, z + 0.03), q(7 / 16, 0, z + 0.03)], 1, 0xb4b9b1)
    } else edge([q(half, -half, z + 0.02), q(half, half, z + 0.02)], 1.5)
  }
}

function place(id: string, x: number, y: number, scale = 1, record = true, height = 0) {
  const asset = inkAssets.find((asset) => asset.id === id)!
  const transform = ([u, v, z]: Vertex): Vertex => [x + u * scale, y + v * scale, z * scale + height]
  const groups = new Map<number, number>()
  for(const fountain of asset.fountains??[])(town.fountains??=[]).push({...fountain,origin:transform(fountain.origin),radius:fountain.radius*scale,level:fountain.level*scale,nozzle:fountain.nozzle*scale})
  const effect = id === "smoke" || id === "problem-marker"
  if (effect) effects.push({ asset: id, x, y, height })
  for (const polygon of asset.faces) {
    if (effect) continue
    const result = { ...polygon, points: polygon.points.map(transform) }
    if (polygon.contour) {
      if (!groups.has(polygon.contour)) groups.set(polygon.contour, contour++)
      result.contour = groups.get(polygon.contour)!
    }
    town.faces.push(result)
  }
  if (!effect) for (const stroke of asset.strokes) town.strokes.push({ ...stroke, points: stroke.points.map(transform) })
  if (record)
    buildings.push({
      id: buildings.length,
      asset: id,
      title: asset.title,
      x,
      y,
      size: asset.footprint ?? 1
    })
}

// The main streets contain every building type; each workshop keeps its yard.
const layout: Array<[string, number, number]> = [
  ["townhall", -3, -5],
  ["market", 2.5, -5],
  ["chapel", 6.5, -5],
  ["warehouse", 13, -5],
  ["lumberjack", -13, -5],
  ["forester", -13, -11],
  ["farm", -6, -11],
  ["mill", -2, -11],
  ["sheep", 4, -11],
  ["quarry", -13, 1],
  ["mine", -13, 7],
  ["sawmill", -6, 1],
  ["smithy", -2, 1],
  ["bakery", 3, 1],
  ["weaver", 7, 1],
  ["fishery", 13, 1]
]
for (const [id, x, y] of layout) place(id, x, y)
// Services, food stores and a park along the south-west street.
const quarter: Array<[string, number, number]> = [
  ["firewatch", -17, -2],
  ["healer", -17, 1],
  ["watchhouse", -10.5, -8],
  ["builder", -17, -5],
  ["granary", -9.5, 1],
  ["smokehouse", 10, 1],
  ["hospital", 9.5, -11],
  ["park-sample", 2.5, -8],
  ["park-lamp", -13.5, -8],
  ["park-statue", 9.5, -8],
  ["park-fountain", 11, -8]
]
for (const [id, x, y] of quarter) place(id, x, y)
// The review annex gives seasonal/condition variants their own ground,
// keeping them apart from the functioning town streets.
face([[-20, 17, -0.5], [18, 17, -0.5], [18, 29, -0.5], [-20, 29, -0.5]], 0xf0f2ec, true)
inkAssets.filter(a => a.category === "buildings" && a.appearance).forEach((a, i) => place(a.id, -17 + (i % 7) * 5, 18 + Math.floor(i / 7) * 5))
const homes = inkAssets.filter((a) => a.category === "homes")
homes.forEach((a, i) => place(a.id, -7 + (i % 4) * 1.8, 6 + Math.floor(i / 4) * 2))
const trees = inkAssets.filter((a) => a.reference?.type === "tree")
trees.forEach((a, i) => place(a.id, -17 + (i % 3) * 1.3, -11 + Math.floor(i / 3) * 1.4))
for (let i = 0; i < 18; i++) place(trees[i % trees.length]!.id, -8 + (i % 9) * 2.4, -14 + Math.floor(i / 9) * 1.2, 1, false)
inkAssets.filter((a) => a.reference?.type === "rock").forEach((a, i) => place(a.id, -16 + (i % 2) * 1.5, 4 + Math.floor(i / 2) * 1.5))
inkAssets.filter((a) => a.reference?.type === "field").forEach((a, i) => place(a.id, -8 + (i % 2) * 1.2, -10 + Math.floor(i / 2) * 1.2))
place("roads", 15, 8)
place("paved-street", 15, 12)
place("water", 7, 14)

// A cargo yard at the quay. Every product has a handcart and a barrow,
// with both one-item and full loads. People stay at their original scale.
const carts = inkAssets.filter((a) => a.reference?.type === "walker" && a.reference.cart)
carts.forEach((a, i) => place(a.id, 2 + (i % 8) * 1.5, 5 + Math.floor(i / 8) * 1.05))
const cargo = inkAssets.filter((a) => a.reference?.type === "cargo" || a.reference?.type === "crate")
cargo.forEach((a, i) => place(a.id, -8 + (i % 11) * 0.8, 12 + Math.floor(i / 11) * 1.1))
place("goods", -5, 14)
const people = inkAssets.filter((a) => a.category === "people")
people.forEach((a, i) => place(a.id, i < 11 ? -8 + i * 1.4 : -8 + (i - 11), i < 11 ? -2 : 4))
inkAssets
  .filter((a) => a.category === "construction" && a.reference?.type !== "plot" && a.id !== "smoke" && a.id !== "problem-marker")
  .forEach((a, i) => place(a.id, 12 + (i % 2) * 3, -11 + Math.floor(i / 2) * 2.1))
place("smoke", -2.5, 0.5, 1, true, 56)
place("problem-marker", 12, -8.9, 1, true, 35)
inkAssets.filter((a) => a.reference?.type === "plot").forEach((a, i) => place(a.id, -12 + (i % 2) * 3, 9.5 + Math.floor(i / 2) * 2.6))

// A timber jetty and drawn sea ripples use the same restrained palette.
for (let i = 0; i < 16; i++) {
  const y = 15 + i * 0.2
  face(
    [
      [-1, y, 0],
      [1, y, 0],
      [1, y + 0.2, 0],
      [-1, y + 0.2, 0]
    ],
    0xe9d2a8
  )
  edge(
    [
      [-1, y, 0.04],
      [1, y, 0.04]
    ],
    0.8,
    0x8a6a45
  )
}
edge(
  [
    [-1, 15, 0],
    [-1, 18.2, 0],
    [1, 18.2, 0],
    [1, 15, 0]
  ],
  1.5
)
for (let i = 0; i < 120; i++) {
  const x = ((i * 17) % 51) - 25,
    y = ((i * 11) % 45) - 22
  if ((x * x) / 420 + (y * y) / 300 < 1.14) continue
  edge(
    [
      [x - 0.14, y, -0.8],
      [x, y - 0.08, -0.8],
      [x + 0.14, y, -0.8],
      [x + 0.28, y - 0.08, -0.8]
    ],
    0.8,
    0x9fb3b0,
    0.7
  )
}
const represented = new Set(buildings.map((p) => p.asset))
const missing = inkAssets.filter((a) => !represented.has(a.id)).map((a) => a.id)
if (missing.length) throw new Error(`Review map is missing: ${missing.join(", ")}`)
export const districts = {
  all: { title: "Whole island", x: 0, y: 0, zoom: 1 },
  town: { title: "Town centre", x: 2, y: -5, zoom: 2.8 },
  industry: { title: "Workshops", x: -7, y: 1, zoom: 3.2 },
  homes: { title: "Homes", x: -4, y: 7, zoom: 5 },
  people: { title: "People", x: 0, y: -2, zoom: 7 },
  cargo: { title: "Cargo yard", x: 7, y: 7, zoom: 4 },
  forest: { title: "Forest & farms", x: -10, y: -11, zoom: 3.2 },
  variants: { title: "Winter & wear", x: -2, y: 21, zoom: 2.3 }
} as const
export const testMap = { asset: town, buildings, effects, trees: trees.length + 18, roads: roads.size, coverage: represented.size }
