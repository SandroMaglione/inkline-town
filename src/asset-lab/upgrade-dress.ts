/** Supported additions to the existing buildings, inside their plots. */
import { U } from "../iso.ts"
import type { KindId } from "../content.ts"
import { Drawing, square, type InkAsset } from "./primitives.ts"
import { beam, block, iron, orient, post, roof, stone, wheel, wood } from "./workshops.ts"
import type { BuildingOptions } from "./buildings.ts"
import { civicBuilding } from "./civic.ts"
export { scaffoldAsset } from "./scaffolding.ts"

const brick = [0xd99a7e, 0xc77d63, 0xb5654a] as const
const spire = (d: Drawing, u: number, v: number, a: number, z: number, rise: number) => {
  const base = square(u, v, a, z)
  for (let i = 0; i < 4; i++) d.face([base[i]!, base[(i + 1) % 4]!, [u, v, z + rise]], i >= 2 ? 0xb0b9b0 : 0x8f9990, 0.8)
}

export const dressed = ["townhall", "warehouse", "bakery", "quarry", "farm", "firewatch"] as const satisfies ReadonlyArray<KindId>
export type DressedKind = (typeof dressed)[number]
export const isDressed = (id: KindId): id is DressedKind => (dressed as ReadonlyArray<KindId>).includes(id)

function dress(id: DressedKind, level: number, eave: number): InkAsset {
  const d = new Drawing(`${id}-upgrade-${level}`, "Upgrade", "")
  switch (id) {
    case "townhall": {
      return civicBuilding(level, { plate: false })
    }
    case "warehouse": {
      // A gantry spans the loading apron. Cargo stays in the yard.
      for (const u of [-16 * U, 16 * U]) {
        post(d, u, 18 * U, 46)
        beam(d, [u, 18 * U, 35], [u * 0.72, 18 * U, 45], 1.2)
      }
      beam(d, [-16 * U, 18 * U, 46], [16 * U, 18 * U, 46], 1.5)
      block(d, 8 * U, 18 * U, 1.3 * U, 0.8 * U, 44.5, 1.5, iron)
      wheel(d, 8 * U, 18 * U, 44, 1.5)
      d.line([[8 * U, 18 * U, 43], [8 * U, 18 * U, 16]], 0.75, wood[2])
      d.crate(8 * U, 18 * U, 8, 0x8a58a8, 1.8 * U, 6)
      d.line([[6.2 * U, 18 * U, 14], [8 * U, 18 * U, 16], [9.8 * U, 18 * U, 14]], 0.75)
      break
    }
    case "bakery": {
      block(d, -3 * U, -3 * U, 1.6 * U, 1.6 * U, 1, 49, brick)
      block(d, -3 * U, -3 * U, 2 * U, 2 * U, 50, 2, brick)
      d.face(square(-3 * U, -3 * U, 1.2 * U, 52.02), 0x68726c, 0)
      for (const z of [37, 43, 48]) d.line([[-4.6 * U, -1.38 * U, z], [-1.4 * U, -1.38 * U, z]], 0.45, 0x9a654f)
      break
    }
    case "quarry": {
      post(d, 12 * U, 9 * U, 46)
      beam(d, [12 * U, 9 * U, 40], [U, 3 * U, 37], 1.5)
      beam(d, [12 * U, 9 * U, 21], [3 * U, 4 * U, 37], 1.2)
      beam(d, [8 * U, 12 * U, 0], [12 * U, 9 * U, 25], 1)
      d.line([[U, 3 * U, 37], [U, 3 * U, 27]], 0.75, wood[2])
      block(d, U, 3 * U, 1.4 * U, 1.2 * U, 20, 6, stone)
      d.line([[-0.4 * U, 3 * U, 26], [U, 3 * U, 27], [2.4 * U, 3 * U, 26]], 0.75)
      for (const z of [0, 5]) block(d, 12 * U, -5 * U, 1.2 * U, 1.3 * U, z, 5, stone)
      break
    }
    case "farm": {
      // The dovecote is clear of the silo and the hay shelter stays open.
      const u = -18 * U, v = -16 * U
      for (const du of [-1.5 * U, 1.5 * U]) for (const dv of [-1.5 * U, 1.5 * U]) post(d, u + du, v + dv, 15)
      block(d, u, v, 2.2 * U, 2.2 * U, 15, 11, wood)
      spire(d, u, v, 2.8 * U, 26, 7)
      for (const dx of [-U, U]) d.face([[u + dx - 0.4 * U, v + 2.21 * U, 18], [u + dx + 0.4 * U, v + 2.21 * U, 18], [u + dx + 0.4 * U, v + 2.21 * U, 21], [u + dx - 0.4 * U, v + 2.21 * U, 21]], 0x68726c, 0.4)
      beam(d, [u - 2 * U, v + 3 * U, 17.5], [u + 2 * U, v + 3 * U, 17.5], 0.6)
      for (const dx of [-1.5 * U, 1.5 * U]) beam(d, [u + dx, v + 2.2 * U, 20], [u + dx, v + 3 * U, 17.5], 0.45)
      for (const x of [-20, -14]) for (const y of [10, 19]) post(d, x * U, y * U, 21)
      roof(d, 3.8 * U, 5.3 * U, 14.5 * U, 21, 5, 0x8a6a45, -17 * U)
      for (const y of [12, 17]) d.log("u", y * U, -19 * U, -15 * U, 1, 2, 0xe9cf7c, 0xf3e3a8)
      break
    }
    case "firewatch": {
      // Equip the yard rather than floating a second bell above the lookout.
      const u = -11 * U, v = 10 * U
      block(d, u, v, 1.1 * U, 1.1 * U, 0, 1, stone)
      d.cylinder(u, v, 0.5 * U, 1, 8, iron[1], iron[0], 0.6, 12)
      beam(d, [u, v, 8], [u + 2 * U, v, 10], 0.8, iron)
      beam(d, [u, v, 6], [u, v + 1.8 * U, 6], 0.8, iron)
      d.barrel(u, v + 2 * U, U, 0, 3.5, 0xa8c7c1)
      const x = 11 * U, y = 9 * U
      block(d, x, y, 1.5 * U, 3 * U, 2.5, 1.2, wood)
      for (const dx of [-1.8 * U, 1.8 * U]) wheel(d, x + dx, y, 2.5, 2.3)
      beam(d, [x - 1.8 * U, y, 2.5], [x + 1.8 * U, y, 2.5], 0.7, iron)
      for (const dx of [-U, U]) beam(d, [x + dx, y, 3.5], [x + dx, y + 5 * U, 8.5], 0.8)
      for (let i = 0; i < 3; i++) d.cylinder(x, y, 1.25 * U, 3.7 + i * 0.7, 0.55, 0xb6a37a, 0xd4c8a7, 0.45, 16)
      break
    }
  }
  return d.asset
}

export function dressedBuilding(id: DressedKind, level: number, base: InkAsset, eave: number, doors?: BuildingOptions["doors"]): InkAsset {
  if (id === "townhall") return {
    ...civicBuilding(level, { doors: doors ?? {}, plate: base.faces.some(f => f.points.every(p => p[2] < 0)) }), id: `${base.id}-${level}`
  }
  const raw = dress(id, level, eave)
  const extra = id === "warehouse" || id === "bakery" ? orient(raw, doors) : raw
  return { ...base, id: `${base.id}-${level}`, faces: [...base.faces, ...extra.faces], strokes: [...base.strokes, ...extra.strokes] }
}
const tops = new Map<string, number>()
export const dressedTop = (id: DressedKind, level: number, eave: number): number => {
  const key=`${id}/${level}/${eave}`,cached=tops.get(key)
  if(cached!==undefined)return cached
  const a = dress(id, level, eave)
  const top=Math.max(0, ...a.faces.flatMap(f => f.points.map(p => p[2])), ...a.strokes.flatMap(s => s.points.map(p => p[2])))
  tops.set(key,top)
  return top
}
