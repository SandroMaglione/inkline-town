/**
 * How a building upgraded where it stands is told apart from the one it
 * was (the market hall and the church have models of their own, see
 * `service-upgrades.ts`): what the upgrade adds to it, drawn over the
 * building's own model and never past its plot. A guildhall's clock tower,
 * a city hall's dome, a depot's hoist, an ovenworks' second chimney, a
 * masonry's derrick, an estate's dovecote, a fire brigade's bell. And the
 * scaffolding that stands inside a building's plot while an upgrade is under
 * way, rising with the share of its materials in.
 */
import { U } from "../iso.ts"
import { kinds, type KindId } from "../content.ts"
import { Drawing, palette, square, type InkAsset, type Vertex } from "./primitives.ts"

const brick = { top: 0xd99a7e, left: 0xc77d63, right: 0xb5654a }
const stone = { top: 0xf0f1eb, left: 0xe1e5dc, right: 0xd3d9cf }
const slate = { face: 0x8f9891, shade: 0x6f7872 }
const timber = { top: 0xeee2c8, left: 0xdcc9a8, right: 0xc6b18e }

/** A four-sided roof to a point over (u, v). */
const spire = (d: Drawing, u: number, v: number, a: number, z: number, rise: number, face: number, shade: number) => {
  const base: Array<Vertex> = square(u, v, a, z)
  for (let i = 0; i < 4; i++) d.face([base[i]!, base[(i + 1) % 4]!, [u, v, z + rise]], i === 2 || i === 3 ? face : shade)
}

/** The kinds that can be upgraded and are drawn by dressing their own model (not the market and chapel). */
export const dressed = ["townhall", "warehouse", "bakery", "quarry", "farm", "firewatch"] as const satisfies ReadonlyArray<KindId>
export type DressedKind = (typeof dressed)[number]
export const isDressed = (id: KindId): id is DressedKind => (dressed as ReadonlyArray<KindId>).includes(id)

/** What an upgrade adds, and the height of its highest point (for the marker over it). */
const dress = (id: DressedKind, level: number, eave: number): { readonly asset: InkAsset; readonly top: number } => {
  const d = new Drawing(`${id}-upgrade-${level}`, "Upgrade", "")
  const plot = kinds[id].size * 8 * U
  switch (id) {
    case "townhall": {
      if (level >= 2) {
        // A city hall: a broad drum and a dome over the old roof.
        d.box(0, 0, 7 * U, 7 * U, eave, 18, stone.top, stone.left, stone.right)
        d.cylinder(0, 0, 6 * U, eave + 18, 10, 0xd3d9cf, 0xf0f1eb, 1, 24)
        d.ellipsoid(0, 0, eave + 28, 6 * U, 6 * U, 14, 0xb8c9d6, 1, 0xdfe8ee, 20)
        d.cylinder(0, 0, 0.8 * U, eave + 41, 8, 0xb39a61, 0xd5c18b, 0.7, 10)
        return { asset: d.asset, top: eave + 50 }
      }
      // A guildhall: a clock tower on the roof.
      d.box(0, 0, 5 * U, 5 * U, eave, 26, stone.top, stone.left, stone.right)
      // A clock face on each side the camera sees.
      const w = 5.01 * U, c = 2.2 * U, z = eave + 15
      d.face([[w, -c, z], [w, c, z], [w, c, z + 8], [w, -c, z + 8]], 0xf7f8f4, 1)
      d.face([[-c, w, z], [c, w, z], [c, w, z + 8], [-c, w, z + 8]], 0xf7f8f4, 1)
      d.line([[w, 0, z + 4], [w, 0, z + 7]], 1)
      d.line([[0, w, z + 4], [1.6 * U, w, z + 4]], 1)
      spire(d, 0, 0, 6 * U, eave + 26, 16, slate.face, slate.shade)
      return { asset: d.asset, top: eave + 42 }
    }
    case "warehouse": {
      // A depot: a hoist over the yard, and crates stacked on the roof.
      const c = plot - 2 * U
      d.line([[c, c, 0], [c, c, eave + 22]], 1.5)
      d.line([[c, -c, 0], [c, -c, eave + 22]], 1.5)
      d.line([[c, c, eave + 22], [c, -c, eave + 22]], 1.5)
      d.line([[c, 0, eave + 22], [c, 0, eave + 8]], 0.8, palette.ink, 0.7)
      d.crate(c - 0.5 * U, 0, eave + 2, 0x6e8f36, 1.2 * U, 5)
      for (const [u, v, z] of [[-8 * U, -8 * U, eave], [-5 * U, -8 * U, eave], [-8 * U, -5 * U, eave], [-6.5 * U, -6.5 * U, eave + 5]] as const)
        d.crate(u, v, z, 0x8a58a8, 1.2 * U, 5)
      return { asset: d.asset, top: eave + 26 }
    }
    case "bakery": {
      // An ovenworks: a second, taller brick chimney.
      d.box(-6 * U, 5 * U, 1.8 * U, 1.8 * U, 0, eave + 30, brick.top, brick.left, brick.right)
      d.box(-6 * U, 5 * U, 2.2 * U, 2.2 * U, eave + 30, 2, brick.top, brick.left, brick.right)
      return { asset: d.asset, top: eave + 34 }
    }
    case "quarry": {
      // A masonry: a derrick over the pit, and dressed blocks waiting by it.
      const c = plot - 2.5 * U
      d.line([[c, c, 0], [c, c, 52]], 2)
      d.line([[c, c, 50], [-c * 0.4, -c * 0.4, 30]], 1.5)
      d.line([[c, c, 0], [c - 4 * U, c, 0], [c, c, 30]], 1, palette.ink, 0.8)
      d.line([[-c * 0.4, -c * 0.4, 30], [-c * 0.4, -c * 0.4, 14]], 0.8, palette.ink, 0.7)
      for (const [u, v, z] of [[-c, c, 0], [-c + 2.6 * U, c, 0], [-c + 1.3 * U, c, 4]] as const) d.box(u, v, 1.2 * U, 1.2 * U, z, 4, stone.top, stone.left, stone.right, 1)
      return { asset: d.asset, top: 56 }
    }
    case "farm": {
      // An estate: a dovecote in a corner of the yard, and a hayrick.
      const c = plot - 3 * U
      d.box(c, -c, 2.2 * U, 2.2 * U, 0, 22, timber.top, timber.left, timber.right)
      spire(d, c, -c, 2.8 * U, 22, 10, slate.face, slate.shade)
      d.ellipsoid(-c, c, 0, 3 * U, 3 * U, 10, 0xe6c85a, 1, 0xf1dc8a, 16)
      return { asset: d.asset, top: Math.max(eave + 12, 34) }
    }
    case "firewatch": {
      // A fire brigade: a bell frame with its bell over the roof.
      const z = eave + 26
      for (const [u, v] of square(0, 0, 2 * U)) d.line([[u, v, z], [u, v, z + 12]], 1.2)
      spire(d, 0, 0, 2.6 * U, z + 12, 6, 0xc4523f, 0xa8432f)
      d.ellipsoid(0, 0, z + 4, 1.2 * U, 1.2 * U, 4, 0xb39a61, 1, 0xd5c18b, 12)
      return { asset: d.asset, top: z + 20 }
    }
  }
}

/** A building's own model with its upgrades drawn on: what it looks like at `level`. */
export function dressedBuilding(id: DressedKind, level: number, base: InkAsset, eave: number): InkAsset {
  const extra = dress(id, level, eave).asset
  return { ...base, id: `${base.id}-${level}`, faces: [...base.faces, ...extra.faces], strokes: [...base.strokes, ...extra.strokes] }
}

/** The highest point of an upgraded building, for the marker drawn over it. */
export const dressedTop = (id: DressedKind, level: number, eave: number): number => dress(id, level, eave).top

/**
 * Scaffolding inside a building's plot while it is upgraded: poles at its
 * corners, ledgers and boards rising with the `share` of its materials in,
 * and the crates the carriers have brought stacked by them.
 */
export function scaffoldAsset(size: number, height: number, share: number): InkAsset {
  const d = new Drawing("scaffold", "Scaffolding", ""),
    s = (size * 8 - 1.2) * U,
    top = height + 8,
    rise = Math.max(4, Math.round(top * Math.min(1, share)))
  for (const [u, v] of square(0, 0, s)) d.line([[u, v, 0], [u, v, top]], 1.2, 0x8a6a45)
  // A ledger every few feet of what is in, and the boards they carry.
  for (let z = 6; z <= rise; z += 8) {
    d.line([...square(0, 0, s, z), [s, s, z]], 1, 0x8a6a45, 0.9)
    d.line([[s, s, z + 0.2], [s, -s, z + 0.2]], 2.2, 0xd5a86c, 0.85)
  }
  // Diagonal braces on the two faces the camera sees most.
  d.line([[s, s, 0], [s, -s, rise]], 0.8, 0x8a6a45, 0.7)
  d.line([[s, s, 0], [-s, s, rise]], 0.8, 0x8a6a45, 0.7)
  const crates = Math.ceil(Math.min(1, share) * 3)
  for (let i = 0; i < crates; i++) d.crate(s - 1.4 * U, s - (1.4 + i * 2.6) * U, 0, 0x8f9891, 1.1 * U, 4)
  return d.asset
}
