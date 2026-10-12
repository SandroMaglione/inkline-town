import { Drawing, palette, square, type Vertex } from "./primitives.ts"
import { U } from "../iso.ts"

export const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const leaves = [
  { light: 0xe4ecd6, shade: 0xc6d4b2 },
  { light: 0xdde8cf, shade: 0xbccfa8 },
  { light: 0xe8ecd2, shade: 0xccd5ae },
  { light: 0xdbe6d4, shade: 0xb8cbb2 },
  { light: 0xefe7c9, shade: 0xd7c99c }
]
export function makeTree(type: "fir" | "broadleaf" | "poplar", grown: number, id: string) {
  let x = 0,
    y = 0
  for (let i = 0; i < 1000; i++) {
    const h = hash(i * 3, i * 7),
      found = h < 0.45 ? "fir" : h > 0.88 ? "poplar" : "broadleaf"
    if (found === type && (type !== "broadleaf" || h > 0.6)) {
      x = i * 3
      y = i * 7
      break
    }
  }
  const h = hash(x, y),
    h2 = hash(y * 3 + 17, x * 5 + 7),
    h3 = hash(x * 11 + 101, y * 13 + 3)
  const s = (grown >= 1 ? 1 : grown >= 0.5 ? 0.75 : 0.5) * (0.85 + h2 * 0.3),
    ox = Math.round((h3 - 0.5) * 12),
    oy = Math.round((h2 - 0.5) * 5)
  const u = ox / 64 + oy / 32,
    v = -ox / 64 + oy / 32,
    trunk = Math.round(6 * s)
  const d = new Drawing(
    id,
    `${type === "broadleaf" ? "Broadleaf" : type === "poplar" ? "Poplar" : "Fir"} · ${grown >= 1 ? "grown" : grown >= 0.5 ? "young" : "sapling"}`,
    "Seeded tree shape, original leaf colours and growth stages, built as a complete volume."
  )
  d.asset.category = "land"
  d.asset.reference = { type: "tree", x, y, grown }
  d.asset.footprint = 1
  d.face(
    Array.from({ length: 32 }, (_, i): Vertex => {
      const t = (i / 32) * Math.PI * 2,
        sx = ox + 3 * s + 9 * s * Math.cos(t),
        sy = oy + 3.5 * s * Math.sin(t)
      return [sx / 64 + sy / 32, -sx / 64 + sy / 32, -0.02]
    }),
    0xe3e6de,
    0
  )
  if (type === "fir") {
    d.fir(u, v, 0, s, h2 < 0.5 ? 2 : 3)
    return d.asset
  }
  d.line(
    [
      [u, v, 0],
      [u, v, trunk]
    ],
    1.5,
    0x6b5a45
  )
  const color = leaves[Math.floor(h2 * 97) % leaves.length]!
  const lobe = (sx: number, sy: number, rx: number, ry: number, forward = 0) => {
    const du = (sx - ox) / 64,
      dv = -(sx - ox) / 64,
      z = oy - sy
    d.ellipsoid(
      u + du + (forward * 0.6123724) / 45.2548,
      v + dv + (forward * 0.6123724) / 45.2548,
      z + forward * 0.5 * 0.8660254,
      rx / 45.2548,
      rx / 45.2548,
      Math.sqrt(Math.max(1, ry * ry - rx * rx * 0.25)),
      color.shade,
      1.5,
      color.light,
      48
    )
  }
  if (type === "poplar") lobe(ox, oy - trunk - 10 * s, 4.5 * s, 11 * s)
  else {
    const r = 7 * s,
      cy = oy - trunk - r
    if (s >= 0.75 && h > 0.6) {
      lobe(ox - r * 0.6, cy + r * 0.25, r * 0.7, r * 0.7)
      lobe(ox + r * 0.65, cy + r * 0.3, r * 0.65, r * 0.65)
    }
    const forward = s >= 0.75 && h > 0.6 ? r * 0.75 : 0
    lobe(ox, cy, r, r * 0.95, forward)
    // Lay the original twig stroke on the curved front surface, rather
    // than hiding it inside the canopy volume.
    const branch = Array.from({ length: 12 }, (_, i): Vertex => {
      const t = i / 11,
        sx = r * (-0.35 + 0.4 * t),
        sy = r * (0.15 - 0.45 * t),
        q = [sx / Math.SQRT2 + sy * 0.353553, -sy * 0.8660254, -sx / Math.SQRT2 + sy * 0.353553],
        direction = [0.6123724, 0.5, 0.6123724],
        radii = [r, r * 0.932738, r]
      let A = 0,
        B = 0,
        C = -1
      for (let j = 0; j < 3; j++) {
        A += (direction[j]! / radii[j]!) ** 2
        B += (2 * q[j]! * direction[j]!) / radii[j]! ** 2
        C += (q[j]! / radii[j]!) ** 2
      }
      const depth = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A) + 0.15 + forward
      return [
        u + (q[0]! + depth * direction[0]!) / 45.2548,
        v + (q[2]! + depth * direction[2]!) / 45.2548,
        trunk + r + (q[1]! + depth * direction[1]!) * 0.8660254
      ]
    })
    d.line(branch, 1, palette.ink, 0.35)
  }
  return d.asset
}

export function makeRock(ore: boolean, full: boolean) {
  const x = ore ? 5 : 0,
    y = ore ? 3 : 0,
    h = hash(x, y),
    h2 = hash(x * 7 + 3, y * 5 + 11),
    h3 = hash(y * 17 + 5, x * 3 + 29)
  const colors = ore ? { top: 0xe8ebf0, left: 0xd5dae3, right: 0xbcc3d0 } : { top: 0xeeefe9, left: 0xdfe1da, right: 0xcbcfc7 }
  const d = new Drawing(
    `${ore ? "ore" : "stone"}-${full ? "full" : "quarried"}`,
    `${ore ? "Ore" : "Stone"} · ${full ? "full" : "quarried"}`,
    "Faceted boulders, pebbles and mineral flecks, in both resource states."
  )
  d.asset.category = "land"
  d.asset.reference = { type: "rock", x, y, ore, amount: full ? 40 : 10 }
  d.asset.footprint = 1
  const s = (full ? 5 : 4) * U * (0.85 + h2 * 0.3),
    tall = Math.round((full ? 10 : 7) * (0.8 + h3 * 0.4)),
    u = (h - 0.5) * 4 * U,
    v = (h3 - 0.5) * 3 * U
  const boulder = (u: number, v: number, s: number, H: number, k: number, j: number) => {
    const base = square(u, v, s),
      top: Array<Vertex> = [
        [u - s * j, v - s * j, H],
        [u + s * k, v - s * j, H],
        [u + s, v + s * k, H],
        [u - s * j, v + s * k, H]
      ]
    for (let i = 0; i < 4; i++) d.face([base[i]!, base[(i + 1) % 4]!, top[(i + 1) % 4]!, top[i]!], i === 1 ? colors.right : colors.left)
    d.face(top, colors.top)
    d.face([...base].reverse(), colors.left, 0)
  }
  if (h2 > 0.35) boulder(u - s * 0.9, v - s * 1.1, s * 0.55, Math.round(tall * 0.6), 0.3 + h * 0.3, 0.5)
  boulder(u, v, s, tall, 0.3 + h2 * 0.3, 0.5 + h3 * 0.2)
  if (full && h3 > 0.5) boulder(u + s * 0.9, v + s * 1.2, s * 0.4, Math.round(tall * 0.45), 0.4, 0.6)
  for (let i = 0; i < 3; i++)
    d.ellipsoid(u + (hash(x + i, y * 3) - 0.5) * 14 * U, v + s + (hash(y + i, x * 5) * 3 + 1) * U, 0.4, 0.02, 0.02, 0.4, 0xaab1a6, 0)
  if (ore) {
    for (const [du, dv, z] of [
      [-0.3, 1, 3],
      [0.2, 1, 6],
      [1, 0.1, 4],
      [1, -0.5, 7]
    ]) {
      const U0 = u + du! * s,
        V0 = v + dv! * s,
        H = z! * (tall / 10),
        w = 1 / 64
      d.face(
        [
          [U0 - w, V0 + 0.003, H - 1],
          [U0 + w, V0 + 0.003, H - 1],
          [U0 + w, V0 + 0.003, H + 1],
          [U0 - w, V0 + 0.003, H + 1]
        ],
        0x4a5368,
        0
      )
    }
    const base = square(u - s * 0.2, v + s * 0.1, 0.035, tall)
    for (let i = 0; i < 4; i++) d.face([base[i]!, base[(i + 1) % 4]!, [u - s * 0.2, v + s * 0.1, tall + 4]], 0x8fa3c8, 1)
  }
  return d.asset
}

export function makeField(stage: 0 | 1 | 2 | 3) {
  const d = new Drawing(
    `field-${stage}`,
    `Field · ${["sown", "sprouting", "growing", "ripe"][stage]}`,
    "The original soil, three furrows and four crop stages."
  )
  d.asset.category = "land"
  d.asset.reference = { type: "field", grown: stage / 3 }
  d.asset.footprint = 1
  const s = 7 * U
  d.face(square(0, 0, s, -0.1), 0xece8dc, 1)
  for (const v of [-4 * U, 0, 4 * U]) {
    d.line(
      [
        [-s + U, v, 0],
        [s - U, v, 0]
      ],
      1,
      palette.ink,
      0.35
    )
    if (stage)
      for (let u = -s + 2 * U; u <= s - 2 * U; u += 2 * U)
        d.line(
          [
            [u, v, 0],
            [u, v, stage + 1]
          ],
          1,
          stage === 3 ? 0xcdb46a : palette.ink,
          stage === 3 ? 1 : 0.6
        )
  }
  return d.asset
}

export function makeRoadPatch() {
  const d = new Drawing("roads", "Road junction", "Twelve-unit paving, kerbs, worn stones and dashed markings, with clean junctions.")
  d.asset.category = "land"
  d.asset.reference = { type: "roads" }
  d.asset.footprint = 3
  for (const [x, y] of [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ]) {
    d.face(square(x!, y!, 0.375, -0.1), 0xe6e8e2, 0)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const q = (a: number, c: number): Vertex => [x! + dx! * a - dy! * c, y! + dy! * a + dx! * c, 0]
      if (x! + dx! === 0 || y! + dy! === 0) {
        if (Math.abs(x! + dx!) + Math.abs(y! + dy!) <= 1) {
          d.face([q(0.375, -0.375), q(0.5, -0.375), q(0.5, 0.375), q(0.375, 0.375)], 0xe6e8e2, 0)
          d.line([q(0.375, -0.375), q(0.5, -0.375)], 1.5)
          d.line([q(0.375, 0.375), q(0.5, 0.375)], 1.5)
          d.line([q(0.0625, 0), q(0.1875, 0)], 1, 0xb4b9b1)
          continue
        }
      }
      d.line([q(0.375, -0.375), q(0.375, 0.375)], 1.5)
    }
  }
  return d.asset
}
export function makeWater() {
  const d = new Drawing("water", "Water & shore", "Flat pale water, ink waves, shore edges and white glints.")
  d.asset.category = "land"
  d.asset.reference = { type: "water" }
  d.asset.footprint = 3
  d.face(square(0, 0, 1.5, -0.2), 0xdfe8e6, 1)
  for (const [u, v] of [
    [-0.8, -0.7],
    [0.6, -0.2],
    [-0.4, 0.9]
  ])
    d.line(
      [
        [u! - 0.15, v!, 0],
        [u! - 0.05, v! - 0.04, 0],
        [u! + 0.05, v!, 0],
        [u! + 0.15, v! - 0.04, 0]
      ],
      1,
      0x9fb3b0
    )
  d.line(
    [
      [0.72, 0.9, 0],
      [0.88, 0.9, 0]
    ],
    1,
    0xffffff
  )
  d.line(
    [
      [0.8, 0.82, 0],
      [0.8, 0.98, 0]
    ],
    1,
    0xffffff
  )
  return d.asset
}
