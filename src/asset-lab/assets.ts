/** Portable polygon-and-stroke assets. Floor coordinates remain in cells;
 * heights remain in the original drawing's pixels. No renderer types here. */
import { home, kinds } from "../content.ts"
import { homeVariant } from "../art.ts"
import { U } from "../iso.ts"

export type Vertex = readonly [u: number, v: number, height: number]
export interface Face {
  points: ReadonlyArray<Vertex>
  color: number
  contour?: number
}
export interface Stroke {
  points: ReadonlyArray<Vertex>
  width: number
  color: number
  opacity: number
}
export interface InkAsset {
  id: string
  title: string
  note: string
  faces: Array<Face>
  strokes: Array<Stroke>
}

export const palette = { ink: 0x3d4943, plate: 0xf5f6f2, roof: 0xf7f8f4, left: 0xe9ebe5, right: 0xdde0d9, glass: 0xdbe6ea }
const mix = (a: number, b: number, t: number) =>
  [16, 8, 0].reduce((out, s) => out | (Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s), 0)
const pale = (c: number, t = 0.7) => mix(c, 0xffffff, t)
const square = (u: number, v: number, a: number, z = 0): Array<Vertex> => [
  [u - a, v - a, z],
  [u + a, v - a, z],
  [u + a, v + a, z],
  [u - a, v + a, z]
]
const sides = ["right", "left", "backRight", "backLeft"] as const
type Side = (typeof sides)[number]

class Drawing {
  readonly asset: InkAsset
  constructor(id: string, title: string, note: string) {
    this.asset = { id, title, note, faces: [], strokes: [] }
  }
  line(points: ReadonlyArray<Vertex>, width = 1, color = palette.ink, opacity = 1) {
    this.asset.strokes.push({ points, width, color, opacity })
  }
  face(points: ReadonlyArray<Vertex>, color: number, width = 1.5, edge = palette.ink) {
    this.asset.faces.push({ points, color })
    if (width) this.line([...points, points[0]!], width, edge)
  }
  plate(size: number) {
    this.face(square(0, 0, (size * 8 - 1) * U, -0.15), palette.plate)
  }
  box(
    u: number,
    v: number,
    a: number,
    b: number,
    z: number,
    h: number,
    top = palette.roof,
    left = palette.left,
    right = palette.right,
    width = 1.5,
    edge = palette.ink
  ) {
    this.face(
      [
        [u - a, v + b, z],
        [u + a, v + b, z],
        [u + a, v + b, z + h],
        [u - a, v + b, z + h]
      ],
      left,
      width,
      edge
    )
    this.face(
      [
        [u + a, v - b, z],
        [u + a, v + b, z],
        [u + a, v + b, z + h],
        [u + a, v - b, z + h]
      ],
      right,
      width,
      edge
    )
    this.face(
      [
        [u - a, v - b, z],
        [u + a, v - b, z],
        [u + a, v - b, z + h],
        [u - a, v - b, z + h]
      ],
      right,
      width,
      edge
    )
    this.face(
      [
        [u - a, v - b, z],
        [u - a, v + b, z],
        [u - a, v + b, z + h],
        [u - a, v - b, z + h]
      ],
      left,
      width,
      edge
    )
    this.face(
      square(u, v, a, z + h).map(([x, y, H]) => [x, v + ((y - v) * b) / a, H]),
      top,
      width,
      edge
    )
    this.face(
      square(u, v, a, z).map(([x, y, H]) => [x, v + ((y - v) * b) / a, H]),
      left,
      0
    )
  }
  wall(side: Side, a: number, along: number, z: number, out = 0.003): Vertex {
    switch (side) {
      case "right":
        return [a + out, along, z]
      case "left":
        return [along, a + out, z]
      case "backRight":
        return [-a - out, along, z]
      case "backLeft":
        return [along, -a - out, z]
    }
  }
  window(side: Side, a: number, along: number, z: number, height = 5, glass = palette.glass, sill = false) {
    const p = (s: number, h: number) => this.wall(side, a, s, h)
    this.face([p(along - U, z), p(along + U, z), p(along + U, z + height), p(along - U, z + height)], glass, 1)
    if (sill) this.line([p(along - 1.5 * U, z), p(along + 1.5 * U, z)])
  }
  door(side: Side, a: number, h: number, half: number, awning: number, depth: number, color: number, industrial = false) {
    const p = (s: number, z: number, out = 0.004) => this.wall(side, a, s, z, out)
    this.face([p(-half, 0), p(half, 0), p(half, h), p(-half, h)], industrial ? 0xeef0ea : 0x8f9891, 1.5)
    if (industrial) for (let z = h - 3; z > 0; z -= 3) this.line([p(-half, z, 0.008), p(half, z, 0.008)], 1, 0x9aa29b)
    this.face([p(-awning, h + 3), p(awning, h + 3), p(awning, h + 1, depth), p(-awning, h + 1, depth)], color)
  }
  gable(a: number, H: number, rise: number, ridge: "x" | "y", face: number, shade: number, chimney: boolean) {
    const t = ([u, v, z]: Vertex): Vertex => (ridge === "x" ? [u, v, z] : [v, u, z])
    const transform = (points: Array<Vertex>) => points.map(t)
    this.face(
      transform([
        [-a, -a, H],
        [a, -a, H],
        [a, 0, H + rise],
        [-a, 0, H + rise]
      ]),
      shade
    )
    this.face(
      transform([
        [-a, a, H],
        [a, a, H],
        [a, 0, H + rise],
        [-a, 0, H + rise]
      ]),
      face
    )
    for (const s of [-1, 1])
      this.face(
        transform([
          [s * a, -a, H],
          [s * a, a, H],
          [s * a, 0, H + rise]
        ]),
        ridge === "x" ? palette.right : palette.left
      )
    if (chimney) {
      const u = -a / 2,
        v = ridge === "x" ? -a / 2 : a / 2
      this.box(u, v, U, U, H + Math.round(rise / 2), rise - Math.round(rise / 2) + 4)
    }
  }
  pyramid(a: number, z: number, rise: number, face: number, shade: number) {
    const base = square(0, 0, a, z)
    for (let i = 0; i < 4; i++) this.face([base[i]!, base[(i + 1) % 4]!, [0, 0, z + rise]], i === 2 || i === 3 ? face : shade)
  }
  crate(u: number, v: number, z: number, label: number, s = 1.2 * U, h = 5) {
    this.box(u, v, s, s, z, h, 0xf4dcab, 0xe9c48a, 0xd5a86c, 1, 0x7d6140)
    this.face(
      [
        [u - s, v - 0.5 * U, z + h + 0.03],
        [u + s, v - 0.5 * U, z + h + 0.03],
        [u + s, v + 0.5 * U, z + h + 0.03],
        [u - s, v + 0.5 * U, z + h + 0.03]
      ],
      0xc79a5b,
      0
    )
    const lh = Math.max(2, Math.round(h * 0.4)),
      lz = z + Math.round((h - lh) / 2)
    for (const sign of [-1, 1])
      this.face(
        [
          [u - s + U, v + sign * (s + 0.003), lz],
          [u + s - U, v + sign * (s + 0.003), lz],
          [u + s - U, v + sign * (s + 0.003), lz + lh],
          [u - s + U, v + sign * (s + 0.003), lz + lh]
        ],
        label,
        0
      )
  }
  circle(side: Side, a: number, z: number, r: number) {
    const ps = Array.from({ length: 32 }, (_, i) =>
      this.wall(side, a, ((Math.cos((i * Math.PI) / 16) * r) / Math.sqrt(5)) * U, z + Math.sin((i * Math.PI) / 16) * r, 0.006)
    )
    this.face(ps, 0xfaf8ee, 1)
    this.line([this.wall(side, a, 0, z, 0.012), this.wall(side, a, 0, z + 3.5, 0.012)])
    this.line([this.wall(side, a, 0, z, 0.012), this.wall(side, a, -2.5 / 32, z - 1.75, 0.012)])
  }
}

function house(tier: 1 | 2) {
  const d = new Drawing(
    tier === 1 ? "cottage" : "citizen",
    tier === 1 ? "Settler cottage" : "Citizen home",
    "Original roof palette, footprint, chimney, windows and awnings. Rear walls completed for rotation."
  )
  const variant = homeVariant(tier === 1 ? 0.03 : 0.28)
  const a = (home.half + (tier === 2 ? 1 : 0)) * U,
    H = home.tiers[tier].height
  d.plate(1)
  d.box(0, 0, a, a, 0, H)
  for (const side of sides) {
    const door = side === "right"
    if (tier === 2) d.line([d.wall(side, a, -a, 13), d.wall(side, a, a, 13)], 1, palette.ink, 0.7)
    if (door) d.door(side, a, 9, 2 * U, 3 * U, 2 * U, variant.roof.shade)
    for (const floor of tier === 2 ? [0, 12] : [0]) {
      if (tier === 2) {
        for (const along of [-3 * U, 3 * U]) if (!(door && floor === 0)) d.window(side, a, along, floor + 5)
      } else if (!door) d.window(side, a, 0, 5)
    }
  }
  d.gable(a, H, tier === 2 ? 10 : 8, variant.ridge, variant.roof.face, variant.roof.shade, variant.chimney || tier === 2)
  return d.asset
}

function building(id: "townhall" | "mill" | "market") {
  const kind = kinds[id],
    a = kind.half * U,
    H = kind.stories * 32,
    p = (kind.size * 8 - 1) * U
  const accent = id === "townhall" ? 0x8a58a8 : id === "mill" ? 0xc9b48a : 0x3d6db5
  const glass = id === "townhall" ? 0xf3dca6 : palette.glass
  const d = new Drawing(
    id,
    kind.title,
    id === "mill"
      ? "The lattice sails sit on a real upright plane. Flour sacks remain softly rounded."
      : id === "market"
        ? "Striped canopy, coloured goods crates and roof flag, all built as geometry."
        : "Two storeys, clock faces, violet trim, three skylights and a red flag. Original dimensions throughout."
  )
  d.plate(kind.size)
  d.box(0, 0, a, a, 0, H)
  for (const side of sides) {
    const door = side === "right" || side === "left"
    const pt = (s: number, z: number) => d.wall(side, a, s, z, 0.007)
    if (kind.stories === 2) d.line([pt(-a, 32), pt(a, 32)], 1, palette.ink, 0.7)
    d.face([pt(-a, H - 3), pt(a, H - 3), pt(a, H), pt(-a, H)], pale(accent, 0.35), 0)
    d.line([pt(-a, H - 3), pt(a, H - 3)], 1, palette.ink, 0.6)
    const positions = door ? (a >= 12 * U ? [-(a - 3 * U), a - 3 * U] : []) : [-Math.round(a / U / 2) * U, Math.round(a / U / 2) * U]
    for (let floor = 0; floor < kind.stories; floor++) for (const s of positions) d.window(side, a, s, floor * 32 + 12, 8, glass, true)
    if (door) d.door(side, a, 16, 5 * U, 6 * U, 3 * U, accent, true)
    if (id === "townhall") d.circle(side, a, 50, 5)
  }
  if (id === "mill") {
    d.pyramid(a, H, 16, pale(0x8a6a45, 0.7), pale(0x8a6a45, 0.52))
    const out = a + 3 * U,
      hubZ = H - 6
    d.line(
      [
        [a, 0, hubZ],
        [out, 0, hubZ]
      ],
      1.5
    )
    const upright = (s: number, t: number): Vertex => [out, (s / Math.sqrt(5)) * U, hubZ + t]
    for (let i = 0; i < 4; i++) {
      const turn = 1.2 * 0.6 + (i * Math.PI) / 2,
        c = Math.cos(turn),
        s = Math.sin(turn)
      const along = (r: number, w: number) => upright(c * r - s * w, s * r + c * w)
      d.line([along(0, 0), along(26, 0)], 1.5)
      d.face([along(8, 0.5), along(26, 0.5), along(26, 6), along(8, 6)], 0xf6f1e4, 1)
      for (const r of [14, 20]) d.line([along(r, 0.5), along(r, 6)], 1, palette.ink, 0.6)
      d.line([along(8, 3.2), along(26, 3.2)], 1, palette.ink, 0.4)
    }
    d.face(
      Array.from({ length: 24 }, (_, i): Vertex => {
        const [u, v, z] = upright(Math.cos((i * Math.PI) / 12) * 2.2, Math.sin((i * Math.PI) / 12) * 2.2)
        return [u + 0.006, v, z]
      }),
      palette.roof,
      1
    )
    // Sacks are complete faceted solids, rather than a fixed screen drawing.
    const c = (a + p) / 2
    for (const [u, v] of [
      [c - U, c + U],
      [c + 1.5 * U, c - U],
      [c + 0.5 * U, c + 2.5 * U]
    ])
      roundedSack(d, u!, v!)
  } else {
    const pitch = (2 * a) / kind.bays
    for (let row = 0; row < kind.bays; row++)
      for (let col = 0; col < kind.bays; col++) {
        if (row === 0 && col === kind.bays - 1) continue
        const u = -a + pitch * (col + 0.5),
          v = -a + pitch * (row + 0.5),
          pane = square(u, v, (kind.window / 2) * U, H + 0.035)
        d.face(pane, glass)
        d.line([pane[0]!, pane[2]!], 1, palette.ink, 0.25)
      }
    const u = -a + pitch * (kind.bays - 0.5),
      v = -a + pitch * 0.5
    d.line(
      [
        [u, v, H],
        [u, v, H + 24]
      ],
      1.5
    )
    // A flag hanging in a vertical world plane, matching the original at 45°.
    const delta = 11 / 64
    d.face(
      [
        [u, v, H + 24],
        [u - delta, v + delta, H + 24 - 6],
        [u, v, H + 16]
      ],
      id === "townhall" ? 0xc4523f : 0x3d6db5,
      1
    )
  }
  if (id === "market") {
    const c = (a + p) / 2,
      u0 = c - 1.2 * U,
      u1 = c + 1.2 * U,
      v0 = -a - 2.5 * U,
      v1 = -a + 4.5 * U
    for (const [u, v] of [
      [u0, v0],
      [u1, v0],
      [u0, v1],
      [u1, v1]
    ])
      d.line(
        [
          [u!, v!, 0],
          [u!, v!, 11]
        ],
        1.5
      )
    d.box(c, (v0 + v1) / 2, 1.2 * U, (v1 - v0) / 2, 0, 4, 0xe9c48a, 0xd5a86c, 0xc79a5b)
    for (let i = 0; i < 5; i++) {
      const s = v0 + ((v1 - v0) * i) / 5,
        e = v0 + ((v1 - v0) * (i + 1)) / 5
      d.face(
        [
          [u0, s, 12],
          [u0, e, 12],
          [u1 + U, e, 9],
          [u1 + U, s, 9]
        ],
        i % 2 === 0 ? 0xc4523f : 0xf7f3ea
      )
    }
    d.crate(-a - 2 * U, c, 0, 0x2f8c87)
    d.crate(-a + 1.5 * U, c, 0, 0xc4523f)
    d.crate(-a - 0.2 * U, c, 5, 0x8a58a8)
  }
  return d.asset
}

function roundedSack(d: Drawing, u: number, v: number) {
  const start = d.asset.faces.length
  const rings = [
    { z: 0, r: 0.055 },
    { z: 1.5, r: 0.084 },
    { z: 5, r: 0.08 },
    { z: 7, r: 0.04 }
  ]
  const n = 12
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const p = (ring: number, step: number): Vertex => {
        const { z, r } = rings[ring]!
        const t = (step / n) * Math.PI * 2
        return [u + Math.cos(t) * r, v + Math.sin(t) * r, z]
      }
      d.face([p(j, i), p(j, i + 1), p(j + 1, i + 1), p(j + 1, i)], i < 6 ? 0xf2ecdc : 0xe7dfcc, 0)
    }
  d.face(
    Array.from({ length: n }, (_, i): Vertex => [
      u + Math.cos((i / n) * Math.PI * 2) * 0.04,
      v + Math.sin((i / n) * Math.PI * 2) * 0.04,
      7
    ]),
    0xf2ecdc,
    0
  )
  for (const face of d.asset.faces.slice(start)) face.contour = start + 1
  // The silhouette adapter supplies contours for these smooth volumes.
  d.line(
    [
      [u - 0.03, v + 0.075, 5.5],
      [u + 0.03, v + 0.075, 5.5]
    ],
    1,
    palette.ink,
    0.6
  )
}

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

export const inkAssets: ReadonlyArray<InkAsset> = [
  house(1),
  house(2),
  building("townhall"),
  building("mill"),
  building("market"),
  props(),
  firTree()
]
