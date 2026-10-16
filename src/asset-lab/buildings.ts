import { kinds, type KindId } from "../content.ts"
import { U } from "../iso.ts"
import { Drawing, palette, pale, square, sides, type Vertex, type Side } from "./primitives.ts"
import { finishTownBuilding, townBuildingNotes, institutionDoor, makeQuarry } from "./services.ts"
import { isWorkshop, makeWorkshop, workshopSmokeOrigin, townHallEntrance } from "./workshops.ts"
import { isTradeYard, makeTradeYard, tradeSmokeOrigin, tradeEntrance, millHoist } from "./trades.ts"
import { chapelPorch, hayBands, isRuralDoor, lumberRack, nursery, ruralEntrance, ruralNotes, sheepTrough } from "./rural.ts"
import { makeCarpenter } from "./carpenter.ts"

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
  chapel: { accent: 0x3d6db5, glass: 0xc9d6ee },
  // Town services and stores share the palette; services.ts adds their fittings.
  granary: { accent: 0xd6ae2e },
  smokehouse: { accent: 0x9a5b3a, roof: 0x9a5b3a },
  firewatch: { accent: 0xc4523f, roof: 0xc4523f },
  healer: { accent: 0x4f9a8a },
  hospital: { accent: 0x4f9a8a, glass: 0xc9d6ee },
  watchhouse: { accent: 0x3d4f6e },
  builder: { accent: 0x8a6a45, roof: 0xb08a5a },
  carpenter: { accent: 0x9a6b3f, roof: 0x9a6b3f }
}

export interface BuildingOptions {
  doors?: Partial<Record<Side, boolean>>
  fit?: number
  open?: number
  plate?: boolean
  motion?: boolean
}
export function makeBuilding(id: KindId, options: BuildingOptions = {}) {
  if (id === "carpenter") return makeCarpenter(options)
  if (isWorkshop(id)) return makeWorkshop(id, options)
  if (isTradeYard(id)) return makeTradeYard(id, options)
  if (id === "quarry") return makeQuarry(options)
  const fit = options.fit ?? 1
  const kind = kinds[id],
    a = kind.half * U,
    H = kind.roof === "gable" ? 20 : kind.stories * 32,
    p = (kind.size * 8 - 1) * U
  const accent = dresses[id].accent
  const glass = dresses[id].glass ?? palette.glass
  const d = new Drawing(
    id,
    kind.title,
    ruralNotes[id] ?? townBuildingNotes[id] ?? (id === "mill"
      ? "Upright lattice sails and a tapered roof, with braced grain-loading doors, a sack hoist and coopered flour barrels."
      : id === "market"
        ? "Striped canopy, coloured goods crates and roof flag, all built as geometry."
        : id === "townhall"
          ? "Civic timber double doors beneath stone porches, with broad steps, clocks, violet trim, three skylights and a red flag."
          : "Original footprint, palette and yard details, with complete walls and roof geometry.")
  )
  d.asset.category = "buildings"
  d.asset.reference = { type: "building", kind: id }
  d.asset.footprint = kind.size
  if (options.plate !== false) d.plate(kind.size)
  d.box(0, 0, a, a, 0, H)
  for (const side of sides) {
    const door = options.doors ? !!options.doors[side] : side === "right" || side === "left"
    const pt = (s: number, z: number) => d.wall(side, a, s, z, 0.007)
    if (kind.stories === 2) d.line([pt(-a, 32), pt(a, 32)], 1, palette.ink, 0.7)
    if (kind.roof === "flat" && fit > 0.3) {
      d.face([pt(-a, H - 3), pt(a, H - 3), pt(a, H), pt(-a, H)], pale(accent, 0.35), 0)
      d.line([pt(-a, H - 3), pt(a, H - 3)], 1, palette.ink, 0.6)
    }
    const positions = door ? (a >= 12 * U ? [-(a - 3 * U), a - 3 * U] : []) : [-Math.round(a / U / 2) * U, Math.round(a / U / 2) * U]
    if (kind.roof === "flat" && fit > 0.4)
      for (let floor = 0; floor < kind.stories; floor++)
        for (const s of positions) {
          if (id === "granary" && floor === 1) continue
          if (id === "chapel") {
            const z = floor * 32 + 9,
              w = 1 / 16,
              p = (along: number, height: number) => d.wall(side, a, along, height)
            d.face([p(s - w, z), p(s + w, z), p(s + w, z + 11), p(s, z + 14), p(s - w, z + 11)], glass, 1)
            d.line([p(s - w - 0.5 / 16, z), p(s + w + 0.5 / 16, z)])
          } else d.window(side, a, s, floor * 32 + 12, 8, glass, true)
        }
    if (door && fit > 0.15) {
      if (id === "townhall") townHallEntrance(d, side, a, fit, options.open ?? 0)
      else if (id === "mill" || id === "watchhouse") tradeEntrance(d, id, side, a, fit, options.open ?? 0)
      else if (isRuralDoor(id)) ruralEntrance(d, id, side, a, fit, options.open ?? 0)
      else if (id === "chapel" || id === "hospital") {
        institutionDoor(d,side,a,id,fit)
        if (id === "chapel") chapelPorch(d, side, a, fit)
      }
      else d.door(side, a, Math.max(2, Math.round(Math.min(16, H - 8) * fit)), 5 * U, 6 * U, 2.5 * U, accent, true, options.open ?? 0)
    }
    if (kind.roof === "gable" && !door && fit > 0.4) d.window(side, a, 0, 6)
    if (id === "townhall" && fit > 0.8) d.circle(side, a, 50, 5)
  }
  if (id === "mill") {
    if (fit > 0) d.pyramid(a, H, 16 * fit, pale(0x8a6a45, 0.7), pale(0x8a6a45, 0.52))
    if (options.motion !== false && fit > 0.6) drawSails(d, a, H, 1.2)
    const c = (a + p) / 2
    for (const [u, v] of [
      [c - 1.5 * U, c - 1.5 * U],
      [c + 1.2 * U, c - 1.5 * U],
      [c, c + 1.5 * U]
    ])
      d.barrel(u!, v!, 1.1 * U, 0, 8, 0xf1e9d5)
  } else if (kind.roof === "gable") {
    const roof = dresses[id].roof ?? 0x8a6a45
    if(fit>0)d.gable(a, H, 14 * fit, "x", pale(roof, 0.7), pale(roof, 0.52), false)
    for (const side of ["right", "left"] as const) {
      for (const seam of (options.doors?.[side] ?? true) ? [-(a - 4 * U), a - 4 * U] : [0])
        d.line([d.wall(side, a, seam, 0), d.wall(side, a, seam, H)], 1, palette.ink, 0.5)
    }
    for (const side of ["backRight", "backLeft"] as const) {
      d.line([d.wall(side, a, 0, 0), d.wall(side, a, 0, H)], 1, palette.ink, 0.5)
    }
  } else if (fit > 0.4) {
    const pitch = (2 * a) / kind.bays
    for (let row = 0; row < kind.bays; row++)
      for (let col = 0; col < kind.bays; col++) {
        if (
          id === "chapel" ||
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
      if (options.motion !== false)
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
  if (id === "market" && fit > 0.75) {
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
            [u1, e, 9],
            [u1, s, 9]
        ],
        i % 2 === 0 ? 0xc4523f : 0xf7f3ea
      )
    }
    d.crate(-a - 1.7 * U, c, 0, 0x2f8c87)
    d.crate(-a + 1.5 * U, c, 0, 0xc4523f)
    d.crate(-a - 0.2 * U, c, 5, 0x8a58a8)
  }
  finishBuilding(d, id, a, p, H, fit)
  return d.asset
}

/** Shared by catalogue geometry and working-building emitters. Open yards have no flue. */
export function buildingSmokeOrigin(id: KindId, doors?: BuildingOptions["doors"]): Vertex | null {
  if (id === "carpenter") return null
  if (isWorkshop(id)) return workshopSmokeOrigin(id, doors)
  if (isTradeYard(id)) return tradeSmokeOrigin(id, doors)
  const kind = kinds[id]
  if (kind.topper !== "chimney") return null
  const a = kind.half * U, pitch = 2 * a / kind.bays
  return [-a + pitch * 0.5, -a + pitch * 0.5, (kind.roof === "gable" ? 20 : kind.stories * 32) + 24.3]
}

/** Presentation dimensions stay separate from simulation footprints and content costs. */
export function buildingDimensions(id: KindId) {
  if (id === "carpenter") return { half: 13.5 * U, height: 28, top: 38 }
  if (isTradeYard(id)) return {
    half: (id === "warehouse" ? 21 : 13.5) * U,
    height: id === "fishery" ? 20 : id === "bakery" ? 28 : id === "weaver" ? 30 : 32,
    top: id === "warehouse" ? 45 : id === "fishery" ? 30 : id === "bakery" ? 48.3 : 38
  }
  const kind = kinds[id], height = kind.roof === "gable" ? 20 : kind.stories * 32
  const topper = kind.topper === "chimney" || kind.topper === "flag" ? 24 : kind.topper === "cupola" ? 25 : kind.topper === "sails" ? 16 : 0
  return {
    half: isWorkshop(id) ? 13.5 * U : kind.half * U,
    height,
    top: id === "quarry" ? 43 : id === "farm" ? 37 : id === "firewatch" ? 55 : id === "sawmill" ? 36.7 : id === "mine" || id === "smithy" ? 56 : height + topper
  }
}

function finishBuilding(d: Drawing, id: KindId, a: number, p: number, H: number, fit = 1) {
  const kind = kinds[id],
    c = (a + p) / 2,
    pitch = (2 * a) / kind.bays,
    u = -a + pitch * 0.5,
    v = -a + pitch * 0.5
  if (kind.topper === "chimney" && fit > 0) {
    d.box(u, v, 2 * U, 2 * U, H, 24 * fit)
    d.face(square(u, v, 1.5 * U, H + 24 * fit + 0.035), 0x8b938c, 0)
  } else if (kind.topper === "cupola" && id !== "hospital" && fit > 0) {
    const half = 3 * U,
      top = H + 10 * fit,
      base = square(u, v, half, top)
    d.box(u, v, half, half, H, 10 * fit)
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
  if (fit <= 0.75) return
  finishTownBuilding(d, id, a, p, H)
  if (id === "mill") millHoist(d, a)
  switch (id) {
    case "lumberjack": {
      lumberRack(d, a, p)
      for (const [du, z] of [
        [-1.6, 0],
        [0, 0],
        [1.6, 0],
        [-0.8, 2.6],
        [0.8, 2.6]
      ])
        d.log("v", c + du! * U, a + 0.5 * U, p - 0.5 * U, z! + 1.5, 1.6, 0xb08a5e, 0xe9d2a8)
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
      nursery(d, a, p)
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
        [c - 1.2 * U, 0],
        [c + 1.2 * U, 0],
        [c, 5.3]
      ]) {
        d.log("u", y!, a + 2 * U, a + 7 * U, z!, 3, 0xe9cf7c, 0xf3e3a8)
        hayBands(d, y!, a + 2 * U, a + 7 * U, z!, 3)
      }
      break
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
      for (const z of [2.5, 5.5]) {
        d.line([
          [s, s, z],
          [e, s, z],
          [e, e, z],
          [s, e, z],
          [s, 21 * U, z]
        ])
        d.line([
          [s, 17 * U, z],
          [s, s, z]
        ])
      }
      for (const y of [17 * U, 21 * U]) post(s, y, 6)
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
      sheepTrough(d, a)
      break
    }
    case "chapel":
      bush(c, c, 3.5)
      bush(c, -a - U, 4, 0xbccfa8, 0xdde8cf)
      bush(-a - U, c, 4, 0xccd5ae, 0xe8ecd2)
      break
  }
}

function drawSails(d: Drawing, a: number, H: number, wave: number) {
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
    const turn = wave * 0.6 + (i * Math.PI) / 2,
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
}
export function makeSails() {
  const d = new Drawing("mill-sails", "Mill sails", "")
  const a = kinds.mill.half * U,
    H = kinds.mill.stories * 32
  drawSails(d, a, H, 1.2)
  const shift = ([u, v, z]: Vertex): Vertex => [u - a - 3 * U, v, z - H + 6]
  d.asset.faces.forEach((f) => {
    f.points = f.points.map(shift)
  })
  d.asset.strokes.forEach((s) => {
    s.points = s.points.map(shift)
  })
  return d.asset
}
export function makeFlag(id: KindId) {
  const d = new Drawing("flag-" + id, "Flag", ""),
    delta = 11 / 64
  d.face(
    [
      [0, 0, 0],
      [-delta, delta, -6],
      [0, 0, -8]
    ],
    id === "townhall" ? 0xc4523f : 0x3d6db5,
    1
  )
  return d.asset
}
