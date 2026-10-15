/** Portable geometry in grid cells and original pixel heights. */
import { U } from "../iso.ts"
import type { GoodId, KindId, Tier } from "../content.ts"
import type { CartLook, Load, PersonDress } from "../art.ts"
import type { SurfaceState } from "../render3d/surface-state.ts"

export type Vertex = readonly [u: number, v: number, height: number]
export interface Face {
  opacity?: number
  points: ReadonlyArray<Vertex>
  color: number
  contour?: number
  contourWidth?: number
}
export interface Stroke {
  points: ReadonlyArray<Vertex>
  width: number
  color: number
  opacity: number
}
export type AssetCategory = "buildings" | "homes" | "land" | "people" | "cargo" | "construction"
export type AssetReference =
  | { type: "building"; kind: KindId; tier?: 1 | 2; build?: number }
  | { type: "house"; tier: Tier; variant: number; build?: number }
  | { type: "tree"; x: number; y: number; grown: number }
  | { type: "rock"; x: number; y: number; ore: boolean; amount: number }
  | { type: "field"; grown: number }
  | { type: "walker"; dress: PersonDress; load: Load; cart: CartLook | null; phase: number }
  | { type: "crate"; good: GoodId }
  | { type: "cargo"; good: GoodId; count: number }
  | { type: "site"; share: number }
  | { type: "plot"; look: "hover" | "picked" | "blocked" | "reach" }
  | { type: "roads" | "water" }
  | { type: "none" }
export interface InkAsset {
  fountains?: Array<{ origin: Vertex; radius: number; level: number; nozzle: number }>
  smokeEffect?: { origin: Vertex }
  effects?: { half: number; height: number; state: SurfaceState }
  appearance?: "fine" | "poor" | "worn" | "winter"
  category?: AssetCategory
  reference?: AssetReference
  footprint?: number
  id: string
  title: string
  note: string
  faces: Array<Face>
  strokes: Array<Stroke>
}

export const palette = { ink: 0x3d4943, plate: 0xf5f6f2, roof: 0xf7f8f4, left: 0xe9ebe5, right: 0xdde0d9, glass: 0xdbe6ea }
export const mix = (a: number, b: number, t: number) =>
  [16, 8, 0].reduce((out, s) => out | (Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s), 0)
export const pale = (c: number, t = 0.7) => mix(c, 0xffffff, t)
export const square = (u: number, v: number, a: number, z = 0): Array<Vertex> => [
  [u - a, v - a, z],
  [u + a, v - a, z],
  [u + a, v + a, z],
  [u - a, v + a, z]
]
export const sides = ["right", "left", "backRight", "backLeft"] as const
export type Side = (typeof sides)[number]

export class Drawing {
  readonly asset: InkAsset
  constructor(id: string, title: string, note: string) {
    this.asset = { id, title, note, faces: [], strokes: [] }
  }
  line(points: ReadonlyArray<Vertex>, width = 1, color = palette.ink, opacity = 1) {
    this.asset.strokes.push({ points, width, color, opacity })
  }
  face(points: ReadonlyArray<Vertex>, color: number, width = 1.5, edge = palette.ink, opacity = 1) {
    this.asset.faces.push({ points, color, opacity })
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
  door(side: Side, a: number, h: number, half: number, awning: number, depth: number, color: number, industrial = false, open = 0) {
    const p = (s: number, z: number, out = 0.004) => this.wall(side, a, s, z, out)
    this.face([p(-half, 0), p(half, 0), p(half, h), p(-half, h)], industrial ? 0xeef0ea : 0x8f9891, 1.5)
    const opening = Math.round(h * open * 0.75)
    if (industrial && opening > 0)
      this.face([p(-half, 0, 0.01), p(half, 0, 0.01), p(half, opening, 0.01), p(-half, opening, 0.01)], 0x68726c, 0)
    if (industrial) for (let z = h - 3; z > opening; z -= 3) this.line([p(-half, z, 0.008), p(half, z, 0.008)], 1, 0x9aa29b)
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
  volume(start: number, width = 1) {
    const id = Math.max(0, ...this.asset.faces.map((face) => face.contour ?? 0)) + 1
    for (const face of this.asset.faces.slice(start)) {
      face.contour = id
      face.contourWidth = width
    }
  }
  cylinder(u: number, v: number, r: number, z: number, h: number, side: number, top: number, width = 1, n = 20) {
    const start = this.asset.faces.length
    const ring = (height: number) =>
      Array.from({ length: n }, (_, i): Vertex => [
        u + Math.cos((i / n) * Math.PI * 2) * r,
        v + Math.sin((i / n) * Math.PI * 2) * r,
        height
      ])
    const bottom = ring(z),
      upper = ring(z + h)
    for (let i = 0; i < n; i++) this.face([bottom[i]!, bottom[(i + 1) % n]!, upper[(i + 1) % n]!, upper[i]!], side, 0)
    this.face(upper, top, 0)
    this.face([...bottom].reverse(), side, 0)
    this.volume(start, width)
    this.line([...upper, upper[0]!], width)
    if (h > 1) this.line([...bottom, bottom[0]!], width)
  }
  barrel(u: number, v: number, r = 1.2 * U, z = 0, height = 8, contents?: number) {
    const start = this.asset.faces.length, n = 12
    const ring = (h: number, radius: number) => Array.from({ length: n }, (_, i): Vertex => [u + Math.cos(i * Math.PI * 2 / n) * radius, v + Math.sin(i * Math.PI * 2 / n) * radius, z + h])
    const rings = [ring(0, r * 0.85), ring(height * 0.25, r), ring(height * 0.75, r), ring(height, r * 0.85)]
    for (let j = 0; j < 3; j++) for (let i = 0; i < n; i++) this.face([rings[j]![i]!, rings[j]![(i + 1) % n]!, rings[j + 1]![(i + 1) % n]!, rings[j + 1]![i]!], i % 3 === 0 ? 0xcbb18a : 0xd9bd95, 0)
    this.face([...rings[0]!].reverse(), 0xb59b75, 0)
    this.face(rings[3]!, contents ?? 0xe9d2a8, 0)
    this.volume(start, 1)
    for (const points of [rings[1]!, rings[2]!]) this.line([...points, points[0]!], 1.2, 0x7d877d)
    this.line([...rings[3]!, rings[3]![0]!], 1)
    if (contents === undefined) for (const x of [-0.35, 0.35]) this.line([[u + x * r, v - r * 0.75, z + height + 0.04], [u + x * r, v + r * 0.75, z + height + 0.04]], 0.5, 0xa98c66)
  }
  ellipsoid(u: number, v: number, z: number, ru: number, rv: number, rz: number, color: number, width = 1, light?: number, segments = 16) {
    const start = this.asset.faces.length,
      n = segments,
      lat = segments / 2
    const point = (j: number, i: number): Vertex => {
      const phi = -Math.PI / 2 + (j / lat) * Math.PI,
        theta = (i / n) * Math.PI * 2
      return [u + Math.cos(phi) * Math.cos(theta) * ru, v + Math.cos(phi) * Math.sin(theta) * rv, z + Math.sin(phi) * rz]
    }
    for (let j = 0; j < lat; j++)
      for (let i = 0; i < n; i++) {
        const points =
          j === 0
            ? [point(j, i), point(j + 1, i + 1), point(j + 1, i)]
            : j === lat - 1
              ? [point(j, i), point(j, i + 1), point(j + 1, i)]
              : [point(j, i), point(j, i + 1), point(j + 1, i + 1), point(j + 1, i)]
        let fill = color
        if (light !== undefined) {
          const center = points
            .reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]] as Vertex, [0, 0, 0] as Vertex)
            .map((n) => n / points.length) as unknown as Vertex
          const sx = (center[0] - u - center[1] + v) * 32,
            sy = (center[0] - u + center[1] - v) * 16 - (center[2] - z),
            rx = Math.hypot(ru, rv) * 32,
            ry = Math.hypot((ru + rv) * 8, rz)
          if (((sx + rx * 0.22) / (rx * 0.7)) ** 2 + ((sy + ry * 0.24) / (ry * 0.68)) ** 2 < 1) fill = light
        }
        this.face(points, fill, 0)
      }
    if (width) this.volume(start, width)
  }
  log(axis: "u" | "v", across: number, from: number, to: number, z: number, r: number, side: number, end: number) {
    const start = this.asset.faces.length,
      n = 16
    const ring = (along: number) =>
      Array.from({ length: n }, (_, i): Vertex => {
        const t = (i / n) * Math.PI * 2,
          s = ((Math.cos(t) * r) / Math.sqrt(5)) * U,
          h = z + r + Math.sin(t) * r
        return axis === "u" ? [along, across + s, h] : [across + s, along, h]
      })
    const a = ring(from),
      b = ring(to)
    for (let i = 0; i < n; i++) this.face([a[i]!, a[(i + 1) % n]!, b[(i + 1) % n]!, b[i]!], side, 0)
    this.face([...a].reverse(), end, 0)
    this.face(b, end, 0)
    this.volume(start, 1)
    this.line([...a, a[0]!])
    this.line([...b, b[0]!])
    const small = ring(to + 0.002).map(([u, v, h]): Vertex =>
      axis === "u"
        ? [u, across + (v - across) * 0.35, z + r + (h - z - r) * 0.35]
        : [across + (u - across) * 0.35, v, z + r + (h - z - r) * 0.35]
    )
    this.line([...small, small[0]!], 1, palette.ink, 0.45)
  }
  sack(u: number, v: number, z = 0, color = 0xf2ecdc) {
    const start = this.asset.faces.length, n = 8
    const ring = (radius: number, h: number) => Array.from({length:n},(_,i):Vertex=>[u+Math.cos(i*Math.PI*2/n)*radius,v+Math.sin(i*Math.PI*2/n)*radius*0.8,z+h])
    const rings = [ring(0.045,0),ring(0.064,2),ring(0.05,6),ring(0.016,7),ring(0.028,8)]
    for(let j=0;j<4;j++)for(let i=0;i<n;i++)this.face([rings[j]![i]!,rings[j]![(i+1)%n]!,rings[j+1]![(i+1)%n]!,rings[j+1]![i]!],i%3===0?mix(color,0xb8aa8c,0.16):color,0)
    this.face([...rings[0]!].reverse(),color,0);this.face(rings[4]!,color,0);this.volume(start,1)
    this.line([...rings[3]!,rings[3]![0]!],1,0x9f8b69)
    this.line([[u-0.025,v+0.053,z+1],[u-0.015,v+0.04,z+5.5]],0.6,0xb7ab95)
  }
  fir(u: number, v: number, z = 0, size = 1, tiers = 2) {
    const step = (24 * size) / (tiers + 1)
    this.line(
      [
        [u, v, z],
        [u, v, z + 6 * size]
      ],
      1.5,
      0x6b5a45
    )
    for (let i = 0; i < tiers; i++) {
      const start = this.asset.faces.length,
        w = (8 * size * (1 - i * 0.22)) / 64,
        base = z + 4 * size + i * step,
        lift = w * 32 - 1.5 * size
      const ring: Array<Vertex> = [
        [u - w, v - w, base - lift],
        [u + w, v - w, base],
        [u + w, v + w, base + lift],
        [u - w, v + w, base]
      ]
      for (let j = 0; j < 4; j++) this.face([ring[j]!, ring[(j + 1) % 4]!, [u, v, base + step * 2]], j >= 2 ? 0xd9e5d7 : 0xb3c7b4, 0)
      this.face(ring, 0xb3c7b4, 0)
      this.volume(start, 1.5)
      this.line([...ring, ring[0]!], 1.5)
    }
  }
}
