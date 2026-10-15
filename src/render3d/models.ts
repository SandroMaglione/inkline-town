import { buildStages, homeVariant } from "../art.ts"
import { makeBuilding, buildingDimensions, type BuildingOptions } from "../asset-lab/buildings.ts"
import { house } from "../asset-lab/homes.ts"
import { Drawing, palette, square, type InkAsset, type Vertex, type Side } from "../asset-lab/primitives.ts"
import { hash } from "../asset-lab/land.ts"
import { kinds, home, type KindId, type Tier } from "../content.ts"
import { GRID, U, type Point } from "../iso.ts"
import { key, cellOf, DIRS } from "../grid.ts"
import type { Preview } from "../ui.ts"
import { withAppearance, type Appearance } from "../asset-lab/appearance.ts"
import { setts } from "../asset-lab/town-props.ts"
import { isWorkshop, workshopConstruction } from "../asset-lab/workshops.ts"
import { isTradeYard, tradeConstruction } from "../asset-lab/trades.ts"
import { serviceBuilding, upgradeHeights, type ServiceKind } from "../asset-lab/service-upgrades.ts"

export type DoorSet = Record<Side, boolean>
export const noDoors: DoorSet = { right: false, left: false, backRight: false, backLeft: false }
export const doorKey = (doors: DoorSet) => Object.values(doors).map(Boolean).map(Number).join("")

export function plateAsset(size: number, build = 1) {
  const d = new Drawing("plate", "Plate", ""),
    stage = buildStages(build),
    a = (size * 8 - 1) * U
  if (stage.walls > 0) d.face(square(0, 0, a, -0.15), palette.plate, 0)
  d.line([...square(0, 0, a, -0.13), [-a, -a, -0.13]], 1.5, palette.ink, stage.plate)
  return d.asset
}
export function constructionAsset(size: number, half: number, height: number, build: number, share: number | null) {
  const d = new Drawing("construction", "Construction", ""),
    stage = buildStages(build),
    a = half * U
  if (share !== null) {
    const s = (size * 8 - 2) * U
    for (const [u, v] of square(0, 0, s))
      d.line(
        [
          [u, v, 0],
          [u, v, 7]
        ],
        1.5
      )
    d.line([...square(0, 0, s, 6), [-s, -s, 6]], 1, palette.ink, 0.45)
    const spots = [
      [s - 3 * U, s - 3 * U, 0],
      [s - 3 * U, s - 8 * U, 0],
      [s - 3 * U, s - 5.5 * U, 5]
    ]
    for (let i = 0; i < Math.ceil(share * 3); i++) {
      const [u, v, z] = spots[i]!
      d.crate(u!, v!, z!, 0x8f9891, 2 * U, 5)
    }
  }
  if (stage.frame > 0 && stage.walls < 1) {
    const top = Math.round(height * stage.frame)
    d.line([...square(0, 0, a, top), [-a, -a, top]], 1)
    for (const [u, v] of square(0, 0, a))
      d.line(
        [
          [u, v, 0],
          [u, v, top]
        ],
        1
      )
  }
  if (stage.walls > 0) d.box(0, 0, a, a, 0, Math.max(2, Math.round(height * stage.walls)))
  return d.asset
}
/** The height a building of a kind is drawn to its eaves, upgraded or not (see `upgradeHeights`). */
export const buildingHeight = (id: KindId, upgraded = false) =>
  upgraded && isUpgradable(id) ? upgradeHeights[id].eave : buildingDimensions(id).height
const isUpgradable = (id: KindId): id is ServiceKind => id === "market" || id === "chapel"

export function buildingAsset(id: KindId, build: number, share: number | null, doors: DoorSet, open: number, appearance: Appearance = {}, upgraded = false) {
  const kind = kinds[id],
    stage = buildStages(build)
  if (build < 0.78) return isWorkshop(id)
    ? workshopConstruction(id, build, share, doors)
    : isTradeYard(id) ? tradeConstruction(id, build, share, doors)
    : constructionAsset(kind.size, kind.half, kind.roof === "gable" ? 20 : kind.stories * 32, build, share)
  // An upgraded building is only ever a standing one: the upgrade is paid and done at once.
  if (upgraded && isUpgradable(id)) return withAppearance(serviceBuilding(id, 2, { plate: false, doors }), kind.half * U, buildingHeight(id, true), appearance)
  const asset = makeBuilding(id, { doors, open, fit: stage.fit, plate: false, motion: false } satisfies BuildingOptions)
  const dimensions = buildingDimensions(id)
  return build >= 1 ? withAppearance(asset, dimensions.half, dimensions.height, appearance) : asset
}
export function homeAsset(tier: Tier, n: number, build: number, share: number | null, doors: DoorSet, appearance: Appearance = {}) {
  if (build < 0.78) return constructionAsset(1, home.half + (tier >= 2 ? 1 : 0), home.tiers[tier].height, build, share)
  const asset = house(tier, n, "home", { doors, fit: buildStages(build).fit, plate: false })
  return build >= 1 ? withAppearance(asset, (home.half + (tier >= 2 ? 1 : 0)) * U, home.tiers[tier].height, appearance, true) : asset
}
export function homeKey(n: number) {
  return JSON.stringify(homeVariant(n))
}

/** A finite set of seeded tree variants retains palette, shape and size
 * variation while letting a forest share geometry and GPU instances. */
const treeSeeds = new Map<string, Point>()
export function treeVariant(x: number, y: number) {
  const h = hash(x, y),
    h2 = hash(y * 3 + 17, x * 5 + 7),
    type: "fir" | "poplar" | "broadleaf" = h < 0.45 ? "fir" : h > 0.88 ? "poplar" : "broadleaf",
    lobes = h > 0.6,
    paletteIndex = type === "fir" ? Number(hash(x * 11 + 101, y * 13 + 3) >= 0.5) : Math.floor(h2 * 97) % 5,
    size = Math.floor(h2 * 2)
  const id = `${type}/${type === "broadleaf" ? Number(lobes) : 0}/${paletteIndex}/${size}`
  let seed = treeSeeds.get(id)
  if (!seed) {
    for (let i = 0; i < 20000; i++) {
      const sx = i * 3,
        sy = i * 7,
        sh = hash(sx, sy),
        sh2 = hash(sy * 3 + 17, sx * 5 + 7),
        st = sh < 0.45 ? "fir" : sh > 0.88 ? "poplar" : "broadleaf"
      if (
        st === type &&
        (type !== "broadleaf" || sh > 0.6 === lobes) &&
        (type === "fir" ? Number(hash(sx * 11 + 101, sy * 13 + 3) >= 0.5) : Math.floor(sh2 * 97) % 5) === paletteIndex &&
        Math.floor(sh2 * 2) === size
      ) {
        seed = { x: sx, y: sy }
        break
      }
    }
    seed ??= { x, y }
    treeSeeds.set(id, seed)
  }
  const sh2 = hash(seed.y * 3 + 17, seed.x * 5 + 7),
    sh3 = hash(seed.x * 11 + 101, seed.y * 13 + 3),
    scale = (0.85 + h2 * 0.3) / (0.85 + sh2 * 0.3),
    dx = Math.round((hash(x * 11 + 101, y * 13 + 3) - 0.5) * 12) - Math.round((sh3 - 0.5) * 12) * scale,
    dy = Math.round((h2 - 0.5) * 5) - Math.round((sh2 - 0.5) * 5) * scale
  return { id, type, seed, scale, offset: [dx / 64 + dy / 32, -dx / 64 + dy / 32, 0] as Vertex }
}

export function landAsset(mask: string, frost = false) {
  const d = new Drawing("land", "Land", ""),
    land = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID && mask[key(x, y)] === "1"
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (!land(x, y)) continue
      d.face(
        [
          [x, y, -0.3],
          [x + 1, y, -0.3],
          [x + 1, y + 1, -0.3],
          [x, y + 1, -0.3]
        ],
        frost ? 0xf7f9fb : 0xf0f2ec,
        0
      )
      // Windblown flecks complement the material snow on roofs.
      if (frost && hash(x * 7 + 3, y * 5 + 1) < 0.18) {
        const u = x + 0.2 + hash(x, y * 3) * 0.6,
          v = y + 0.2 + hash(y, x * 3) * 0.6
        d.line([[u - 0.05, v, -0.26], [u + 0.05, v, -0.26]], 1, 0xc9d6e4)
      }
      if (land(x + 1, y))
        d.line(
          [
            [x + 1, y, -0.27],
            [x + 1, y + 1, -0.27]
          ],
          1,
          0xe0e3db
        )
      if (land(x, y + 1))
        d.line(
          [
            [x, y + 1, -0.27],
            [x + 1, y + 1, -0.27]
          ],
          1,
          0xe0e3db
        )
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1]
      ]) {
        if (land(x + dx!, y + dy!)) continue
        const edge: Vertex[] =
          dx === 1
            ? [
                [x + 1, y, -0.25],
                [x + 1, y + 1, -0.25]
              ]
            : dx === -1
              ? [
                  [x, y, -0.25],
                  [x, y + 1, -0.25]
                ]
              : dy === 1
                ? [
                    [x, y + 1, -0.25],
                    [x + 1, y + 1, -0.25]
                  ]
                : [
                    [x, y, -0.25],
                    [x + 1, y, -0.25]
                  ]
        d.line(edge, 1.5, palette.ink, 0.75)
      }
    }
  return d.asset
}
export function groundAsset(roads: ReadonlySet<number>, water: ReadonlySet<number>, preview = false, paved: ReadonlySet<number> = new Set()) {
  const d = new Drawing("ground", "Ground", ""),
    z = preview ? 0.16 : -0.14
  for (const k of roads) {
    const cell = cellOf(k),
      x = cell.x + 0.5,
      y = cell.y + 0.5,
      half = 0.375,
      stone = paved.has(k),
      color = stone ? (hash(cell.x, cell.y) < 0.25 ? 0xd3d6cf : 0xd8dbd4) : hash(cell.x, cell.y) < 0.25 ? 0xe2e4dd : 0xe6e8e2
    if (stone) setts(d, x, y, half, z + 0.015)
    d.face(square(x, y, half, z), color, 0)
    for (const { x: dx, y: dy } of DIRS) {
      const q = (along: number, across: number, height = z + 0.02): Vertex => [
        x + dx * along - dy * across,
        y + dy * along + dx * across,
        height
      ]
      if (roads.has(key(cell.x + dx, cell.y + dy))) {
        d.face([q(half, -half, z), q(0.5, -half, z), q(0.5, half, z), q(half, half, z)], color, 0)
        if (stone) {
          // Complete the short joining strip as a pair of stone kerbs.
          const center = q((half + 0.5) / 2, 0, z + 0.015)
          d.box(center[0], center[1], dx ? 0.0575 : half - 0.005, dy ? 0.0575 : half - 0.005, center[2], 0.22, 0xe0e4dc, 0xc6ccc3, 0xbfc6bc, 0.5, 0xa0aaa0)
        }
        d.line([q(half, -half), q(0.5, -half)], 1.5)
        d.line([q(half, half), q(0.5, half)], 1.5)
        d.line([q(0.0625, 0), q(0.1875, 0)], 1, 0xb4b9b1)
        d.line([q(0.3125, 0), q(0.4375, 0)], 1, 0xb4b9b1)
      } else d.line([q(half, -half), q(half, half)], 1.5)
    }
  }
  for (const k of water) {
    const { x, y } = cellOf(k),
      near = DIRS.every((v) => water.has(key(x + v.x, y + v.y)))
    d.face(
      [
        [x, y, -0.22],
        [x + 1, y, -0.22],
        [x + 1, y + 1, -0.22],
        [x, y + 1, -0.22]
      ],
      near ? 0xdee8e5 : 0xe2ebe8,
      0
    )
    for (const { x: dx, y: dy } of DIRS) {
      if (water.has(key(x + dx, y + dy))) continue
      const edge: Vertex[] =
        dx === 1
          ? [
              [x + 1, y, -0.18],
              [x + 1, y + 1, -0.18]
            ]
          : dx === -1
            ? [
                [x, y, -0.18],
                [x, y + 1, -0.18]
              ]
            : dy === 1
              ? [
                  [x, y + 1, -0.18],
                  [x + 1, y + 1, -0.18]
                ]
              : [
                  [x, y, -0.18],
                  [x + 1, y, -0.18]
                ]
      d.line(edge, 1.5, 0x9fb3b0, 0.7)
    }
    if (hash(x, y) < 0.34) {
      const u = x + 0.3 + hash(x + 7, y * 3) * 0.4,
        v = y + 0.3 + hash(y + 5, x * 7) * 0.4
      d.line(
        [
          [-6, 0],
          [-3, -2],
          [0, 0],
          [3, -2],
          [6, 0]
        ].map(([sx, sy]): Vertex => [u + sx! / 64 + sy! / 32, v - sx! / 64 + sy! / 32, -0.16]),
        1,
        0x9fb3b0
      )
    }
    if (hash(y * 13 + 1, x * 31 + 7) < 0.08) {
      const u = x + 0.5,
        v = y + 0.5
      d.line(
        [
          [u - 0.04, v + 0.04, -0.16],
          [u + 0.04, v - 0.04, -0.16]
        ],
        1,
        0xffffff,
        0.9
      )
    }
  }
  return d.asset
}
export function previewAsset(preview: Preview, time: number) {
  const d = new Drawing("preview", "Preview", "")
  // The roads a thing being placed would reach: a faint wash along them.
  for (const c of preview.range) d.face(square(c.x + 0.5, c.y + 0.5, 0.5, 0.11), 0x3d6db5, 0, palette.ink, 0.24)
  for (const { x, y, size, look } of preview.plots) {
    const color = look === "blocked" ? 0xc4523f : look === "picked" ? 0x3d6db5 : palette.ink,
      half = size / 2,
      u = x + half,
      v = y + half,
      ring = square(u, v, half, 0.13)
    const bold = look === "picked" || look === "blocked"
    d.face(ring, color, 0, palette.ink, bold ? 0.07 : look === "hover" ? 0.04 : 0.03)
    d.line([...ring, ring[0]!], bold ? 1.5 : 1, color, bold ? 0.85 : look === "hover" ? 0.35 : 0.45)
    if (bold) {
      const reach = (4 + Math.sin(time * 4)) * U
      for (const [a, b] of ring) {
        const dx = Math.sign(a - u),
          dy = Math.sign(b - v)
        d.line(
          [
            [a - dx * reach, b, 0.15],
            [a + dx * U, b, 0.15],
            [a, b + dy * U, 0.15],
            [a, b - dy * reach, 0.15]
          ],
          1.5,
          color,
          0.9
        )
      }
    }
  }
  return d.asset
}
export const quantizeBuild = (build: number) => Math.min(1, Math.round(build * 32) / 32)

/** A footprint washed in a colour, for a map view. */
export interface OverlayCell {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly color: number
  readonly alpha: number
  /** Outlined, for what the view is about (a workplace and its homes). */
  readonly ring?: boolean
}
export function overlayAsset(cells: ReadonlyArray<OverlayCell>) {
  const d = new Drawing("overlay", "Map view", "")
  for (const c of cells) {
    const half = c.size / 2,
      ring = square(c.x + half, c.y + half, half - 0.03, 0.12)
    d.face(ring, c.color, 0, palette.ink, c.alpha)
    if (c.ring) d.line([...ring, ring[0]!], 1.5, c.color, 0.95)
  }
  return d.asset
}
