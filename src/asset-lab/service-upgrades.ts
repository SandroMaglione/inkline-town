import { U } from "../iso.ts"
import { kinds, type Tier } from "../content.ts"
import { makeBuilding } from "./buildings.ts"
import { Drawing, palette, pale, sides, type Side, type Vertex } from "./primitives.ts"

export type ServiceKind = "market" | "chapel"

/** Presentation assets only. Service costs, unlocks and upgrade rules belong to the simulation. */
export function serviceBuilding(kind: ServiceKind, tier: Tier) {
  if (tier === 1) return makeBuilding(kind)
  return kind === "market" ? marketHall() : church()
}

const blue = 0x3d6db5
const stone = { top: 0xf0f1eb, left: 0xe1e5dc, right: 0xd3d9cf }
const timber = { top: 0xeee2c8, left: 0xdcc9a8, right: 0xc6b18e }

function base(kind: ServiceKind, id: string, title: string, note: string) {
  const d = new Drawing(id, title, note)
  d.asset.category = "buildings"
  d.asset.reference = { type: "building", kind, tier: 2 }
  d.asset.footprint = kinds[kind].size
  d.plate(kinds[kind].size)
  return d
}

/** A closed rectangular pitched roof, including both end walls. Ridge follows v. */
function roof(d: Drawing, u: number, v: number, a: number, b: number, z: number, rise: number, color: number) {
  const p = (x: number, y: number, h: number): Vertex => [u + x, v + y, h]
  d.face([p(-a, -b, z), p(-a, b, z), p(0, b, z + rise), p(0, -b, z + rise)], pale(color, 0.7))
  d.face([p(a, -b, z), p(a, b, z), p(0, b, z + rise), p(0, -b, z + rise)], pale(color, 0.52))
  for (const sign of [-1, 1]) d.face([p(-a, sign * b, z), p(a, sign * b, z), p(0, sign * b, z + rise)], sign > 0 ? palette.left : palette.right)
  d.face([p(-a, -b, z), p(a, -b, z), p(a, b, z), p(-a, b, z)], palette.roof, 0)
}

type Wall = (along: number, z: number, out?: number) => Vertex
const wall = (side: Side, a: number, u = 0, v = 0): Wall => {
  const d = new Drawing("wall", "", "")
  return (s, z, out = 0.008) => {
    const [x, y, h] = d.wall(side, a, s, z, out)
    return [x + u, y + v, h]
  }
}

/** Convex opening and separate stone voussoirs keep the arch solid from every heading. */
function arch(d: Drawing, p: Wall, s: number, z: number, half: number, height: number, fill: number, frame = false, rise = 4) {
  const spring = z + height - rise
  const arc = Array.from({ length: 9 }, (_, i) => {
    const t = (i / 8) * Math.PI
    return p(s + Math.cos(t) * half, spring + Math.sin(t) * rise)
  })
  d.face([p(s - half, z), p(s + half, z), ...arc], fill, 0)
  // Long strokes are smoothed by the ink renderer. Only the arch is curved;
  // keep the jambs and threshold in a separate, straight four-point stroke.
  d.line([p(s - half, spring), p(s - half, z), p(s + half, z), p(s + half, spring)], 1)
  d.line(arc, 1)
  if (frame) {
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI, next = ((i + 1) / 8) * Math.PI
      const point = (angle: number, outer: boolean) => p(s + Math.cos(angle) * (half + (outer ? U : 0)), spring + Math.sin(angle) * (rise + (outer ? 1.5 : 0)), 0.014)
      d.face([point(t, false), point(next, false), point(next, true), point(t, true)], stone.top, 0.65)
    }
  }
}

function churchDoor(d: Drawing, p: Wall) {
  const half = 2.25 * U, bottom = 4, spring = 19
  arch(d, p, 0, bottom, half, 18, 0xc6b18e, true, 3)
  for (const sign of [-1, 1]) {
    const inner = sign * half, outer = sign * (half + U)
    d.face([p(inner, bottom, 0.014), p(outer, bottom, 0.014), p(outer, spring, 0.014), p(inner, spring, 0.014)], stone.top, 0.65)
    d.line([p(inner, 11.5, 0.02), p(outer, 11.5, 0.02)], 0.6, palette.ink, 0.6)
    // Small vertical handles make the two leaves readable without extra ornament.
    d.line([p(sign * 0.6 * U, 10.5, 0.03), p(sign * 0.6 * U, 12, 0.03)], 0.8, 0x7d6140)
  }
  d.line([p(0, bottom, 0.025), p(0, 22, 0.025)], 0.7, 0x7d6140)
}

export function marketHall() {
  const d = base("market", "market-hall", "Market hall", "Tier 2 market. A pitched hall above a covered arcade, with the market's striped awnings, blue trim and goods crates. Same 2×2 plot.")
  const a = 9 * U
  d.box(0, 0, 10 * U, 10 * U, 0, 3, stone.top, stone.left, stone.right)
  d.box(0, 0, a, a, 3, 40)
  d.box(0, 0, 9.4 * U, 9.4 * U, 28, 2, stone.top, stone.left, stone.right, 1)
  for (const side of sides) {
    const p = wall(side, a)
    arch(d, p, 0, 3, 2.5 * U, 19, 0xc6b18e, true)
    d.line([p(0, 3, 0.02), p(0, 18, 0.02)], 0.8, 0x7d6140)
    for (const s of [-5.5 * U, 0, 5.5 * U]) {
      arch(d, p, s, 33, 1.15 * U, 7, palette.glass)
      d.line([p(s, 33, 0.02), p(s, 38, 0.02)], 0.65)
      d.line([p(s - 1.5 * U, 32), p(s + 1.5 * U, 32)], 1)
    }
    d.line([p(-a, 30), p(a, 30)], 1, pale(blue, 0.3))
  }
  roof(d, 0, 0, 11 * U, 11 * U, 44, 18, 0x8a6a45)
  // A complete arcade on the two street faces. Narrow posts retain open space below the canopy.
  for (const side of ["right", "left"] as const) {
    const p = wall(side, 13 * U)
    for (const s of [-12 * U, -4 * U, 4 * U, 12 * U]) {
      const [u, v] = p(s, 0, 0)
      d.box(u, v, 0.7 * U, 0.7 * U, 0, 2, stone.top, stone.left, stone.right, 1)
      d.box(u, v, 0.45 * U, 0.45 * U, 2, 20, timber.top, timber.left, timber.right, 1)
      d.box(u, v, 0.75 * U, 0.75 * U, 22, 2, timber.top, timber.left, timber.right, 1)
    }
    const transform = (s: number, depth: number, z: number) => wall(side, depth)(s, z, 0)
    // A solid lintel joins the posts below the canopy.
    const [u, v] = p(0, 0, 0)
    d.box(u, v, (side === "left" ? 13 : 0.65) * U, (side === "right" ? 13 : 0.65) * U, 24, 2, timber.top, timber.left, timber.right, 1)
    for (let i = 0; i < 13; i++) {
      const from = (-12 + i * 2) * U, to = from + 2 * U
      // Mitre the two canopy faces along the corner diagonal. No intersecting striped sheets.
      const panel: Array<[number, number]> = [[from, 9 * U], [to, 9 * U], [to, 14 * U], [from, 14 * U]]
      const clipped: Array<[number, number]> = []
      for (let j = 0; j < panel.length; j++) {
        const a = panel[j]!, b = panel[(j + 1) % panel.length]!
        const da = a[0] - a[1], db = b[0] - b[1]
        if (da <= 0) clipped.push(a)
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
          const t = da / (da - db)
          clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        }
      }
      d.face(clipped.map(([s, depth]) => transform(s, depth, 30 - ((depth / U - 9) / 5) * 4)), i % 2 ? 0xf7f3ea : 0xc4523f, 0.65)
      d.face([transform(from, 14 * U, 26), transform(to, 14 * U, 26), transform(to, 14 * U, 23.5), transform(from, 14 * U, 23.5)], i % 2 ? 0xf7f3ea : 0xc4523f, 0.65)
    }
    for (const s of [-8 * U, 8 * U]) {
      const [x, y] = p(s, 0, -U)
      d.box(x, y, 1.3 * U, 1.3 * U, 0, 7, timber.top, timber.left, timber.right, 1)
      d.crate(x, y, 7, s < 0 ? 0x2f8c87 : 0xd6ae2e, 1.1 * U, 4)
    }
  }
  d.crate(-12 * U, 5 * U, 0, 0x8a58a8)
  d.sack(-12 * U, 0)
  // Blue gable plaques carry the service colour above the striped street fronts.
  for (const side of ["left", "backLeft"] as const) {
    const p = wall(side, 11 * U)
    d.face([p(-2 * U, 47), p(2 * U, 47), p(2 * U, 51), p(-2 * U, 51)], pale(blue, 0.28), 1)
    for (const s of [-U, 0, U]) d.line([p(s, 48, 0.02), p(s, 50, 0.02)], 0.7, 0xf7f3ea)
  }
  return d.asset
}

export function church() {
  const d = base("chapel", "church", "Church", "Tier 2 chapel. A slate-blue nave, stone buttresses, arched glass and an open belfry with a bronze bell. Same 2×2 plot.")
  const a = 7 * U, b = 11 * U
  d.box(0, 0, 8 * U, 12 * U, 0, 3, stone.top, stone.left, stone.right)
  d.box(0, 0, a, b, 3, 48)
  roof(d, 0, 0, 8.5 * U, 12 * U, 52, 24, blue)
  for (const side of ["right", "backRight"] as const) {
    const p = wall(side, a)
    for (const s of [-7 * U, 0, 7 * U]) {
      arch(d, p, s, 20, 1.4 * U, 21, 0xc9d6ee, true)
      d.line([p(s, 20, 0.025), p(s, 38, 0.025)], 0.75)
      d.line([p(s - 1.4 * U, 29, 0.025), p(s + 1.4 * U, 29, 0.025)], 0.75)
      d.line([p(s - 2 * U, 19), p(s + 2 * U, 19)], 1)
    }
    for (const s of [-10 * U, -3.5 * U, 3.5 * U, 10 * U]) {
      const [x, y] = p(s, 0, 1.2 * U)
      d.box(x, y, 1.2 * U, 0.65 * U, 3, 28, stone.top, stone.left, stone.right, 1)
      d.box(x, y, 0.65 * U, 0.65 * U, 31, 14, stone.top, stone.left, stone.right, 1)
    }
  }
  const rear = wall("backLeft", b)
  arch(d, rear, 0, 24, 2.4 * U, 23, 0xc9d6ee, true)
  d.line([rear(0, 24, 0.025), rear(0, 44, 0.025)], 0.8)
  // Front tower grows from the nave's entrance, with a genuinely open four-sided bell chamber.
  const tv = 9 * U, ta = 3.4 * U
  d.box(0, tv, ta + 0.8 * U, ta + 0.8 * U, 0, 4, stone.top, stone.left, stone.right)
  d.box(0, tv, ta, ta, 4, 76)
  for (const z of [28, 56, 79]) d.box(0, tv, ta + 0.4 * U, ta + 0.4 * U, z, 2, stone.top, stone.left, stone.right, 1)
  for (const side of sides) {
    const p = wall(side, ta, 0, tv)
    if (side !== "backLeft") {
      if (side === "left") churchDoor(d, p)
      else arch(d, p, 0, 34, U, 15, 0xc9d6ee, true)
    }
  }
  for (const u of [-ta + 0.5 * U, ta - 0.5 * U]) for (const v of [tv - ta + 0.5 * U, tv + ta - 0.5 * U])
    d.box(u, v, 0.5 * U, 0.5 * U, 81, 16)
  // The bell has depth and a dark mouth. It remains visible through the open chamber on rotation.
  d.box(0, tv, 2.5 * U, 0.4 * U, 94, 2, timber.top, timber.left, timber.right, 1)
  d.cylinder(0, tv, 1.1 * U, 87, 6, 0xb39a61, 0xd5c18b, 0.7, 12)
  d.cylinder(0, tv, 1.9 * U, 85, 2, 0xb39a61, 0xd5c18b, 0.7, 16)
  d.cylinder(0, tv, 0.6 * U, 83, 2, 0x68726c, 0xb39a61, 0.6, 12)
  d.box(0, tv, ta + 0.6 * U, ta + 0.6 * U, 97, 3, stone.top, stone.left, stone.right, 1)
  const cap = new Drawing("spire", "", "")
  cap.pyramid(ta + 0.9 * U, 100, 17, pale(blue, 0.7), pale(blue, 0.52))
  d.asset.faces.push(...cap.asset.faces.map(f => ({ ...f, points: f.points.map(([u, v, z]): Vertex => [u, v + tv, z]) })))
  d.asset.strokes.push(...cap.asset.strokes.map(s => ({ ...s, points: s.points.map(([u, v, z]): Vertex => [u, v + tv, z]) })))
  d.box(0, tv, 0.22 * U, 0.22 * U, 117, 8, stone.top, stone.left, stone.right, 0.8)
  d.box(0, tv, 1.25 * U, 0.22 * U, 121, 1, stone.top, stone.left, stone.right, 0.8)
  // Broad steps, low planting and an entrance path stay inside the original plot.
  for (let i = 0; i < 2; i++) d.box(0, (12.5 - i) * U, (3 + i * 0.3) * U, 0.7 * U, 0, 1 + i, stone.top, stone.left, stone.right, 0.8)
  for (const sign of [-1, 1]) {
    d.box(sign * 11 * U, 9 * U, 1.5 * U, 3 * U, 0, 2, stone.top, stone.left, stone.right, 0.8)
    for (const v of [7.5, 10.5]) d.ellipsoid(sign * 11 * U, v * U, 4, 1.5 * U, 1.5 * U, 2.5, 0xccd5ae, 0.7, 0xe8ecd2, 12)
  }
  return d.asset
}
