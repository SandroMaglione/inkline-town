import { inkAssets, palette, type InkAsset, type Vertex } from "../asset-lab/assets.ts"

export interface MapBuilding {
  id: number
  asset: string
  title: string
  x: number
  y: number
  size: number
}
const town: InkAsset = { id: "map", title: "Little harbour", note: "", faces: [], strokes: [] }
const buildings: Array<MapBuilding> = []
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
  [-10, -6, -0.5],
  [-8, -9, -0.5],
  [-3, -10, -0.5],
  [1, -9.8, -0.5],
  [6, -8.5, -0.5],
  [9, -5, -0.5],
  [10.4, -1, -0.5],
  [9.6, 4, -0.5],
  [7, 7.5, -0.5],
  [2, 9, -0.5],
  [-3, 9.2, -0.5],
  [-7, 7.5, -0.5],
  [-10, 3, -0.5],
  [-10.8, -1, -0.5]
]
face(coast, 0xf0f2ec, true)
// Pale foreshore and a second restrained shoreline outside the land.
edge([...coast.map(([x, y, z]): Vertex => [x * 1.016, y * 1.016, z - 0.1]), [-10 * 1.016, -6 * 1.016, -0.6]], 1, 0x9fb3b0, 0.45)

const roads = new Set<string>()
for (let x = -7; x <= 7; x++) {
  roads.add(`${x},-1`)
  roads.add(`${x},5`)
}
for (let y = -7; y <= 7; y++) roads.add(`1,${y}`)
for (let y = -6; y <= 5; y++) roads.add(`-6,${y}`)
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

function place(id: string, x: number, y: number, scale = 1, record = true) {
  const asset = inkAssets.find((asset) => asset.id === id)!
  const transform = ([u, v, z]: Vertex): Vertex => [x + u * scale, y + v * scale, z * scale]
  const groups = new Map<number, number>()
  for (const polygon of asset.faces) {
    const result = { ...polygon, points: polygon.points.map(transform) }
    if (polygon.contour) {
      if (!groups.has(polygon.contour)) groups.set(polygon.contour, contour++)
      result.contour = groups.get(polygon.contour)!
    }
    town.faces.push(result)
  }
  for (const stroke of asset.strokes) town.strokes.push({ ...stroke, points: stroke.points.map(transform) })
  if (record)
    buildings.push({
      id: buildings.length,
      asset: id,
      title: asset.title,
      x,
      y,
      size: id === "townhall" ? 3 : id === "cottage" || id === "citizen" ? 1 : 2
    })
}

place("townhall", -1, -3)
place("market", 3, -2.5)
place("mill", 4.5, 2)
place("mill", -8, 1)
place("market", -3.5, 3.5)
for (const x of [-4.5, -3.5, -2.5, -1.5, -0.5]) place(x === -2.5 ? "citizen" : "cottage", x, 0)
for (const x of [-4.5, -3.5, -2.5, -1.5, -0.5]) place(x === -1.5 ? "citizen" : "cottage", x, 6)
for (const x of [2, 3, 4, 5, 6]) place(x === 4 ? "citizen" : "cottage", x, 6)
for (const y of [-5, -4, -3, -2]) place(y === -4 ? "citizen" : "cottage", -7, y)
for (const y of [-6, -5, -4]) place("cottage", 2, y)

// Cultivated strips beside the mill, with individual ink-drawn stalks.
for (const x of [6, 7])
  for (const y of [1, 2, 3]) {
    face(square(x, y, 0.44, -0.18), 0xece8dc)
    for (let row = -3; row <= 3; row++)
      for (let col = -3; col <= 3; col++) {
        const u = x + row * 0.1,
          v = y + col * 0.1,
          h = 3 + ((row + col + 6) % 3)
        edge(
          [
            [u, v, 0],
            [u, v, h]
          ],
          0.65,
          0xcdb46a
        )
      }
  }

// A timber jetty at the southern coast, with goods waiting on the quay.
for (let i = 0; i < 16; i++) {
  const y = 8.2 + i * 0.2
  face(
    [
      [-0.45, y, 0],
      [1.45, y, 0],
      [1.45, y + 0.2, 0],
      [-0.45, y + 0.2, 0]
    ],
    0xe9d2a8
  )
  edge(
    [
      [-0.45, y, 0.04],
      [1.45, y, 0.04]
    ],
    0.8,
    0x8a6a45
  )
}
edge(
  [
    [-0.45, 8.2, 0],
    [-0.45, 11.4, 0],
    [1.45, 11.4, 0],
    [1.45, 8.2, 0]
  ],
  1.5
)
place("goods", 0.5, 8.5)

let trees = 0
for (let x = -9; x <= 8; x++)
  for (let y = -8; y <= 7; y++) {
    const n = ((x * 31 + y * 17 + 211) * 7919) % 97
    if ((x < -7 || y < -6 || (x > 6 && y > 4) || (x < -4 && y > 6)) && (x * x) / 100 + (y * y) / 81 < 0.83 && n % 3 === 0) {
      place("fir", x + (n % 5) * 0.06, y + (n % 7) * 0.05, 0.85 + (n % 4) * 0.1, false)
      trees++
    }
  }
// Sparse drawn waves and glints, rather than reflective water.
for (let i = 0; i < 56; i++) {
  const x = ((i * 17) % 31) - 15,
    y = ((i * 11) % 29) - 14
  if ((x * x) / 130 + (y * y) / 115 < 1.12) continue
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

export const testMap = { asset: town, buildings, trees, roads: roads.size }
