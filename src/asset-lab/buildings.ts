import { kinds, type KindId } from "../content.ts"
import { U } from "../iso.ts"
import { Drawing, palette, pale, square, sides, type Vertex } from "./primitives.ts"

const dresses: Record<KindId, { accent: number; roof?: number; glass?: number }> = {
  townhall: { accent: 0x8a58a8, glass: 0xf3dca6 },
  warehouse: { accent: 0x8a58a8 },
  lumberjack: { accent: 0x8a6a45, roof: 0x8a6a45 },
  forester: { accent: 0x6e8f36, roof: 0x6e8f36 },
  quarry: { accent: 0x8f9891 },
  mine: { accent: 0x5a6479, glass: 0xd5dae4 },
  fishery: { accent: 0x2f8c87, roof: 0x2f8c87 },
  sawmill: { accent: 0xd27a34 },
  smithy: { accent: 0xb04a39, glass: 0xf3dca6 },
  farm: { accent: 0xd6ae2e, roof: 0xc4523f },
  mill: { accent: 0xc9b48a, roof: 0x8a6a45 },
  bakery: { accent: 0xc4523f, glass: 0xf3dca6 },
  sheep: { accent: 0xb5654a, roof: 0xb5654a },
  weaver: { accent: 0x8a58a8 },
  market: { accent: 0x3d6db5 },
  chapel: { accent: 0x3d6db5, glass: 0xc9d6ee }
}

export function makeBuilding(id: KindId) {
  const kind = kinds[id],
    a = kind.half * U,
    H = kind.roof === "gable" ? 20 : kind.stories * 32,
    p = (kind.size * 8 - 1) * U
  const accent = dresses[id].accent
  const glass = dresses[id].glass ?? palette.glass
  const d = new Drawing(
    id,
    kind.title,
    id === "mill"
      ? "The lattice sails sit on a real upright plane. Flour sacks remain softly rounded."
      : id === "market"
        ? "Striped canopy, coloured goods crates and roof flag, all built as geometry."
        : id === "townhall"
          ? "Two storeys, clock faces, violet trim, three skylights and a red flag. Original dimensions throughout."
          : "Original footprint, palette and yard details, with complete walls and roof geometry."
  )
  d.asset.category = "buildings"
  d.asset.reference = { type: "building", kind: id }
  d.asset.footprint = kind.size
  d.plate(kind.size)
  d.box(0, 0, a, a, 0, H)
  for (const side of sides) {
    const door = side === "right" || side === "left"
    const pt = (s: number, z: number) => d.wall(side, a, s, z, 0.007)
    if (kind.stories === 2) d.line([pt(-a, 32), pt(a, 32)], 1, palette.ink, 0.7)
    if (kind.roof === "flat") {
      d.face([pt(-a, H - 3), pt(a, H - 3), pt(a, H), pt(-a, H)], pale(accent, 0.35), 0)
      d.line([pt(-a, H - 3), pt(a, H - 3)], 1, palette.ink, 0.6)
    }
    const positions = door ? (a >= 12 * U ? [-(a - 3 * U), a - 3 * U] : []) : [-Math.round(a / U / 2) * U, Math.round(a / U / 2) * U]
    if (kind.roof === "flat")
      for (let floor = 0; floor < kind.stories; floor++)
        for (const s of positions) {
          if (id === "chapel") {
            const z = floor * 32 + 9,
              w = 1 / 16,
              p = (along: number, height: number) => d.wall(side, a, along, height)
            d.face([p(s - w, z), p(s + w, z), p(s + w, z + 11), p(s, z + 14), p(s - w, z + 11)], glass, 1)
            d.line([p(s - w - 0.5 / 16, z), p(s + w + 0.5 / 16, z)])
          } else d.window(side, a, s, floor * 32 + 12, 8, glass, true)
        }
    if (door) d.door(side, a, Math.min(16, H - 8), 5 * U, 6 * U, 3 * U, accent, true)
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
      d.sack(u!, v!)
  } else if (kind.roof === "gable") {
    const roof = dresses[id].roof ?? 0x8a6a45
    d.gable(a, H, 14, "x", pale(roof, 0.7), pale(roof, 0.52), false)
    for (const side of ["right", "left"] as const) {
      for (const seam of [-(a - 4 * U), a - 4 * U]) d.line([d.wall(side, a, seam, 0), d.wall(side, a, seam, H)], 1, palette.ink, 0.5)
    }
    for (const side of ["backRight", "backLeft"] as const) {
      d.window(side, a, 0, 6)
      d.line([d.wall(side, a, 0, 0), d.wall(side, a, 0, H)], 1, palette.ink, 0.5)
    }
  } else {
    const pitch = (2 * a) / kind.bays
    for (let row = 0; row < kind.bays; row++)
      for (let col = 0; col < kind.bays; col++) {
        if (
          (kind.topper === "flag" && row === 0 && col === kind.bays - 1) ||
          (["chimney", "cupola", "crates"].includes(kind.topper) && row === 0 && col === 0)
        )
          continue
        const u = -a + pitch * (col + 0.5),
          v = -a + pitch * (row + 0.5),
          pane = square(u, v, (kind.window / 2) * U, H + 0.035)
        d.face(pane, glass)
        d.line([pane[0]!, pane[2]!], 1, palette.ink, 0.25)
      }
    if (kind.topper === "flag") {
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
  finishBuilding(d, id, a, p, H)
  return d.asset
}

function finishBuilding(d: Drawing, id: KindId, a: number, p: number, H: number) {
  const kind = kinds[id],
    c = (a + p) / 2,
    pitch = (2 * a) / kind.bays,
    u = -a + pitch * 0.5,
    v = -a + pitch * 0.5
  if (kind.topper === "chimney") {
    d.box(u, v, 2 * U, 2 * U, H, 24)
    d.face(square(u, v, 1.5 * U, H + 24.035), 0x8b938c, 0)
  } else if (kind.topper === "cupola") {
    const half = 3 * U,
      top = H + 10,
      base = square(u, v, half, top)
    d.box(u, v, half, half, H, 10)
    for (const side of ["right", "left"] as const) {
      const pts = (along: number, z: number): Vertex =>
        side === "right" ? [u + half + 0.003, v + along, z] : [u + along, v + half + 0.003, z]
      d.line([pts(-U, top - 7), pts(U, top - 7), pts(U, top - 2), pts(-U, top - 2), pts(-U, top - 7)])
    }
    for (let i = 0; i < 4; i++) d.face([base[i]!, base[(i + 1) % 4]!, [u, v, top + 8]], pale(0x3d6db5, i >= 2 ? 0.7 : 0.52))
    d.line(
      [
        [u, v, top + 8],
        [u, v, top + 15]
      ],
      1.5
    )
    d.line(
      [
        [u - 2.5 / 64, v + 2.5 / 64, top + 13],
        [u + 2.5 / 64, v - 2.5 / 64, top + 13]
      ],
      1.5
    )
  } else if (kind.topper === "crates") {
    d.crate(u, v, H, 0xd27a34, 3 * U, 12)
    d.crate(u + 7 * U, v, H, 0x2f8c87, 3 * U, 12)
    d.crate(u + 3 * U, v, H + 12, 0x8a58a8, 3 * U, 12)
  }
  const post = (x: number, y: number, h: number) =>
    d.line(
      [
        [x, y, 0],
        [x, y, h]
      ],
      1.5
    )
  const bush = (x: number, y: number, r: number, shade = 0xc6d4b2, light = 0xe4ecd6) =>
    d.ellipsoid(x, y, r, r / 45.2548, r / 45.2548, r * 0.866, shade, 1, light)
  const pyramid = (x: number, y: number, half: number, z: number, rise: number, color: number) => {
    const base = square(x, y, half, z)
    for (let i = 0; i < 4; i++) d.face([base[i]!, base[(i + 1) % 4]!, [x, y, z + rise]], pale(color, i >= 2 ? 0.7 : 0.52))
  }
  switch (id) {
    case "warehouse":
      d.crate(c, c - 1.5 * U, 0, 0x2f8c87, 1.6 * U, 6)
      d.crate(c, c + 1.5 * U, 0, 0xd27a34, 1.6 * U, 6)
      d.cylinder(c, -a - 2 * U, 1.5 * U, 0, 8, 0xc79a5b, 0xe9c48a, 1.5)
      break
    case "lumberjack": {
      for (const [du, z] of [
        [-1.6, 0],
        [0, 0],
        [1.6, 0],
        [-0.8, 2.6],
        [0.8, 2.6]
      ])
        d.log("v", c + du! * U, a + 0.5 * U, p - 0.5 * U, z!, 1.6, 0xb08a5e, 0xe9d2a8)
      const y = -a - 1.5 * U
      d.cylinder(c, y, 1.3 * U, 0, 3, 0xb08a5e, 0xe9d2a8, 1.5)
      d.line(
        [
          [c, y, 3],
          [c + 0.05, y, 10]
        ],
        1.5,
        0x7d6140
      )
      d.box(c + 0.075, y, U, U, 8, 3, 0xb3b9b0, 0x8f9891, 0x7b847d, 1)
      break
    }
    case "forester":
      for (const [x, y, s] of [
        [c, c, 0.8],
        [c, -a - 2 * U, 0.6],
        [-a - 2 * U, c, 0.55]
      ]) {
        d.cylinder(x!, y!, 1.2 * U, 0, 3, 0xd5a86c, 0x7d6140, 1.5)
        d.fir(x!, y!, 3, s!, 2)
      }
      break
    case "quarry": {
      for (const [x, y, z] of [
        [c - U, c - U, 0],
        [c + 1.2 * U, c - 0.8 * U, 0],
        [c - 0.5 * U, c + 1.4 * U, 0],
        [c, c, 5]
      ])
        d.box(x!, y!, 1.2 * U, 1.2 * U, z!, 5, 0xeeefea, 0xdcded7, 0xc9ccc4)
      const y = -a - 2.5 * U
      d.line(
        [
          [c - 1.5 * U, y, 0],
          [c, y, 16],
          [c + 1.5 * U, y, 0]
        ],
        1.5
      )
      d.line([
        [c, y, 16],
        [c, y, 8]
      ])
      d.box(c, y, U, U, 4, 4, 0xeeefea, 0xdcded7, 0xc9ccc4)
      break
    }
    case "mine": {
      for (const du of [-1, 1])
        d.line(
          [
            [c + du * U, a + 0.5 * U, 0],
            [c + du * U, p - 0.2 * U, 0]
          ],
          1,
          palette.ink,
          0.6
        )
      d.box(c, c, 1.6 * U, 2 * U, 2, 5, 0x6c7488, 0xd5dae4, 0xbcc3d1)
      for (const [du, dv] of [
        [-0.8, -0.5],
        [0.7, 0.5],
        [0, 0]
      ])
        d.ellipsoid(c + du! * U, c + dv! * U, 7.5, 0.035, 0.035, 1.5, 0x5a6479, 0.75)
      for (const dv of [-1.2, 1.2]) d.cylinder(c + 1.6 * U, c + dv * U, 0.026, 0, 3, palette.ink, palette.ink, 0.75)
      pyramid(c, -a - 2 * U, 3 * U, 0, 6, 0x5a6479)
      break
    }
    case "fishery": {
      d.cylinder(c, c, 1.5 * U, 0, 7, 0xc79a5b, 0x9fc9c4, 1.5)
      const y0 = -a - 4 * U,
        y1 = -a + 3 * U
      post(c, y0, 11)
      post(c, y1, 11)
      d.line([
        [c, y0, 11],
        [c, y1, 11]
      ])
      for (let i = 1; i <= 3; i++) {
        const y = y0 + ((y1 - y0) * i) / 4
        d.line([
          [c, y, 11],
          [c, y, 9]
        ])
        d.ellipsoid(c, y, 6, 0.028, 0.045, 3, 0x2f8c87, 1)
        d.face(
          [
            [c, y - 0.04, 4],
            [c, y + 0.04, 4],
            [c, y, 3]
          ],
          0x2f8c87,
          1
        )
      }
      break
    }
    case "sawmill":
      for (let i = 0; i < 3; i++) d.box(c, -a + 1.5 * U, 1.1 * U, 3 * U, i * 2.5, 2.5, 0xf0c59a, 0xe2a873, 0xd2945c, 1)
      d.log("u", c, -a - 3 * U, -a + 4 * U, 0, 2, 0xb08a5e, 0xe9d2a8)
      break
    case "smithy":
      d.cylinder(c, c, U, 0, 3, 0xb08a5e, 0xe9d2a8, 1.5)
      d.box(c, c, 0.6 * U, 1.4 * U, 3, 3, 0x6d7671, 0x5a625e, 0x4b524e)
      pyramid(c, -a - 2 * U, 2.5 * U, 0, 5, 0x3d4943)
      break
    case "farm":
      d.cylinder(c + U, -a - 3 * U, 3.5 * U, 0, 28, 0xeeeae0, pale(0xc4523f, 0.6), 1.5)
      {
        const start = d.asset.faces.length,
          x = c + U,
          y = -a - 3 * U,
          ring = Array.from({ length: 24 }, (_, i): Vertex => [
            x + Math.cos((i / 24) * Math.PI * 2) * 3.5 * U,
            y + Math.sin((i / 24) * Math.PI * 2) * 3.5 * U,
            28
          ])
        for (let i = 0; i < 24; i++) d.face([ring[i]!, ring[(i + 1) % 24]!, [x, y, 37]], pale(0xc4523f, 0.6), 0)
        d.face([...ring].reverse(), pale(0xc4523f, 0.6), 0)
        d.volume(start, 1.5)
        d.line([...ring, ring[0]!], 1.5)
      }
      for (const [y, z] of [
        [c - 2.5 * U, 0],
        [c + 2.5 * U, 0],
        [c, 5]
      ])
        d.log("u", y!, a + 2 * U, a + 7 * U, z!, 3, 0xe9cf7c, 0xf3e3a8)
      break
    case "bakery": {
      d.sack(c, -a - U)
      d.sack(c, -a + 2 * U)
      post(c, c, 12)
      const p = (x: number, z: number): Vertex => [c + x / 64, c - x / 64, z]
      d.face([p(-4, 11), p(4, 11), p(4, 17), p(-4, 17)], 0xfaf3e3, 1)
      d.ellipsoid(c + 0.015, c + 0.015, 14, 0.05, 0.05, 1.3, 0xc4523f, 0.75)
      break
    }
    case "sheep": {
      const s = a + U,
        e = p - U
      for (const [x, y] of [
        [s, s],
        [s, e],
        [e, s],
        [e, e]
      ])
        post(x!, y!, 6)
      for (const z of [2.5, 5.5])
        d.line([
          [s, s, z],
          [s, e, z],
          [e, e, z],
          [e, s, z],
          [s, s, z]
        ])
      for (const [x, y, facing] of [
        [s + 3 * U, s + 4 * U, 1],
        [s + 6 * U, s + 2.5 * U, -1],
        [s + 5.5 * U, s + 6.5 * U, 1]
      ]) {
        for (const du of [-0.04, 0.04])
          for (const dv of [-0.025, 0.025])
            d.line(
              [
                [x! + du, y! + dv, 0],
                [x! + du, y! + dv, 3]
              ],
              1
            )
        d.ellipsoid(x!, y!, 4.5, 0.085, 0.06, 2.2, 0xf8f8f4, 1)
        d.ellipsoid(x! + facing! * 0.1, y!, 5.5, 0.032, 0.032, 1.4, palette.ink, 0)
      }
      d.cylinder(c, -a - 3 * U, 2 * U, 0, 5, 0xe9cf7c, 0xf3e3a8, 1.5)
      break
    }
    case "weaver": {
      const y0 = -a - 2.5 * U,
        y1 = -a + 5 * U
      post(c, y0, 11)
      post(c, y1, 11)
      d.line([
        [c, y0, 11],
        [c, y1, 11]
      ])
      for (const [i, color] of [0x8a58a8, 0xd6ae2e, 0x3d6db5].entries()) {
        const s = y0 + ((y1 - y0) / 3) * i + 0.4 * U,
          e = y0 + ((y1 - y0) / 3) * (i + 1) - 0.4 * U
        d.face(
          [
            [c, s, 10.5],
            [c, e, 10.5],
            [c, e, 4 + (i % 2)],
            [c, s, 4 + (i % 2)]
          ],
          color
        )
      }
      d.sack(c, c, 0, 0xeceee8)
      break
    }
    case "chapel":
      bush(c, c, 4.5)
      bush(c, -a - U, 4, 0xbccfa8, 0xdde8cf)
      bush(-a - U, c, 4, 0xccd5ae, 0xe8ecd2)
      break
  }
}
