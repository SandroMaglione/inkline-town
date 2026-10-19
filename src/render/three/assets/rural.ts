import { type KindId } from "../../../game/content/index.ts"
import { U } from "../../../game/world/iso.ts"
import { Drawing, palette, pale, type Side, type Vertex } from "./primitives.ts"
import { beam, block, iron, post, stone, wood } from "./workshops.ts"
import { human } from "./dimensions.ts"

export const ruralIds = ["firewatch", "lumberjack", "forester", "farm", "sheep", "smokehouse", "builder", "chapel", "granary"] as const
export const ruralDoorIds = ["lumberjack", "forester", "farm", "sheep", "smokehouse", "builder", "granary"] as const
type RuralDoorId = typeof ruralDoorIds[number]
export const isRuralDoor = (id: KindId): id is RuralDoorId => ruralDoorIds.some(kind => kind === id)
export const ruralNotes: Partial<Record<KindId, string>> = {
  firewatch: "A bell lookout with a supported landing and roof stair connecting its ground ladder to the deck; water buckets remain below.",
  lumberjack: "A timber hut with braced doors, a supported log rack and an axe on its chopping block.",
  forester: "A green-roofed nursery with a boarded timber door, framed seedling bed and one potted fir.",
  farm: "A red-roofed barn with braced timber doors, a silo and bound round hay bales.",
  sheep: "A barn beside a sheep pen, with a side gate and an open water trough.",
  smokehouse: "A timber curing-room door, soot-dark flue, hanging fish, split firewood and a curing barrel.",
  builder: "Braced workshop doors beside timber racks, a trestle bench, mallet, ladder and dressed stone.",
  chapel: "Pointed timber entrances beneath small stone porches, with blue lancet windows, a quiet pale roof and the original cupola.",
  granary: "A raised loading threshold, boarded grain doors, framed upper-store louvres, timber braces and the sack hoist."
}

function wallBlock(d: Drawing, side: Side, a: number, along: number, out: number, half: number, depth: number, z: number, h: number, colors: readonly [number, number, number] = stone) {
  const [u, v] = d.wall(side, a, along, 0, out)
  const turn = side === "right" || side === "backRight"
  block(d, u, v, turn ? depth : half, turn ? half : depth, z, h, colors)
}

/** Timber leaves open at their hinges; all planks and braces follow the leaf. */
export function ruralEntrance(d: Drawing, id: RuralDoorId, side: Side, a: number, fit: number, open: number) {
  const half = (id === "farm" || id === "sheep" ? 4.5 : id === "granary" ? 4 : id === "forester" ? 2.5 : 3.2) * U
  const bottom = id === "granary" ? 3 : 0.5, height = id === "granary" ? 22 : human.door
  const p = (s: number, z: number, out = 0.02) => d.wall(side, a, s, z * fit, out)
  d.face([p(-half, bottom), p(half, bottom), p(half, bottom + height), p(-half, bottom + height)], 0x68726c, 0.7)
  const single = id === "forester", angle = Math.max(0, Math.min(1, open)) * Math.PI / 9
  for (const sign of single ? [-1] : [-1, 1]) {
    const width = single ? half * 2 : half
    const leaf = (t: number, z: number, extra = 0): Vertex => p(sign * (half - t * width * Math.cos(angle)), z, 0.04 + t * width * Math.sin(angle) + extra)
    d.face([leaf(0, bottom), leaf(1, bottom), leaf(1, bottom + height), leaf(0, bottom + height)], wood[1], 0.8)
    for (let i = 1; i < 4; i++) d.line([leaf(i / 4, bottom, 0.005), leaf(i / 4, bottom + height, 0.005)], 0.45, 0x987a54)
    for (const z of [bottom + 2, bottom + height - 2]) beam(d, leaf(0, z, 0.01), leaf(1, z, 0.01), 0.8)
    if (id !== "forester") beam(d, leaf(0.06, bottom + 2, 0.015), leaf(0.94, bottom + height - 2, 0.015), 0.9)
    d.line([leaf(0.88, bottom + 7, 0.03), leaf(0.88, bottom + 10, 0.03)], 0.9, iron[2])
    for (const z of [bottom + 4, bottom + height - 4]) d.line([leaf(0, z, 0.025), leaf(0.22, z, 0.025)], 0.9, iron[1])
  }
  for (const sign of [-1, 1]) beam(d, p(sign * (half + 0.6 * U), bottom, 0.4 * U), p(sign * (half + 0.6 * U), bottom + height + 1, 0.4 * U), 1.25)
  beam(d, p(-half - 1.1 * U, bottom + height + 1, 0.4 * U), p(half + 1.1 * U, bottom + height + 1, 0.4 * U), 1.4)
  if (id === "granary") {
    wallBlock(d, side, a, 0, 2 * U, 5.4 * U, 2 * U, 0, fit)
    wallBlock(d, side, a, 0, 1.4 * U, 5 * U, 1.4 * U, fit, fit)
    wallBlock(d, side, a, 0, 0.8 * U, 4.6 * U, 0.8 * U, 2 * fit, fit)
  }
}

export function chapelPorch(d: Drawing, side: Side, a: number, fit: number) {
  const p = (s: number, z: number, out: number) => d.wall(side, a, s, z * fit, out)
  wallBlock(d, side, a, 0, 1.3 * U, 5.4 * U, 1.3 * U, 0, 1.1 * fit)
  wallBlock(d, side, a, 0, 0.8 * U, 4.8 * U, 0.8 * U, 1.1 * fit, 1.1 * fit)
  for (const sign of [-1, 1]) beam(d, p(sign * 4.7 * U, 1.1, 2 * U), p(sign * 4.7 * U, 24.5, 2 * U), 1.1, stone)
  for (const sign of [-1, 1]) {
    d.face([p(sign * 5.4 * U, 24, 0.02), p(sign * 5.4 * U, 24, 2.8 * U), p(0, 29, 2.8 * U), p(0, 29, 0.02)], sign < 0 ? palette.roof : palette.left, 0.8)
    beam(d, p(sign * 5.4 * U, 24, 2.8 * U), p(0, 29, 2.8 * U), 0.8, stone)
  }
  d.face([p(-5.4 * U, 24, 2.8 * U), p(5.4 * U, 24, 2.8 * U), p(0, 29, 2.8 * U)], pale(0x3d6db5, 0.88), 0.8)
  d.face([p(-5.4 * U, 24, 0.02), p(5.4 * U, 24, 0.02), p(5.4 * U, 24, 2.8 * U), p(-5.4 * U, 24, 2.8 * U)], palette.right, 0)
}

export function granaryVents(d: Drawing, side: Side, a: number) {
  const p = (s: number, z: number, out = 0.025) => d.wall(side, a, s, z, out)
  for (const center of [-5 * U, 5 * U]) {
    d.face([p(center - 2.2 * U, 33), p(center + 2.2 * U, 33), p(center + 2.2 * U, 43), p(center - 2.2 * U, 43)], 0x6f796d, 0.7)
    for (const x of [-2.4 * U, 2.4 * U]) beam(d, p(center + x, 32.5, 0.04), p(center + x, 43.5, 0.04), 0.75)
    for (const z of [33, 43]) beam(d, p(center - 2.4 * U, z, 0.04), p(center + 2.4 * U, z, 0.04), 0.75)
    for (const z of [35, 37.5, 40]) beam(d, p(center - 2.1 * U, z, 0.055), p(center + 2.1 * U, z, 0.055), 1.1)
  }
}

export function lumberRack(d: Drawing, a: number, p: number) {
  const c = (a + p) / 2
  for (const v of [a + 0.8 * U, p - 0.8 * U]) block(d, c, v, 2.3 * U, 0.35 * U, 0, 1.5)
  for (const u of [c - 2.3 * U, c + 2.1 * U]) {
    for (const v of [a + 0.6 * U, p - 0.6 * U]) block(d, u, v, 0.3 * U, 0.3 * U, 0, 8.5)
    beam(d, [u, a + 0.6 * U, 7], [u, p - 0.6 * U, 7], 0.8)
  }
}

export function nursery(d: Drawing, a: number, p: number) {
  const c = (a + p) / 2, u = -5 * U, v = c, width = 3.6 * U, depth = 1.8 * U
  block(d, u, v, width, depth, 0, 1.5, [0x9d977e, 0x9d977e, 0x9d977e], 0)
  for (const x of [-width, width]) block(d, u + x, v, 0.3 * U, depth, 0, 2.4)
  for (const y of [-depth, depth]) block(d, u, v + y, width, 0.3 * U, 0, 2.4)
  for (const x of [-2, 0, 2]) for (const y of [-0.8, 0.8]) d.fir(u + x * U, v + y * U, 1.5, 0.25, 1)
  d.cylinder(c, c, 1.4 * U, 0, 3, 0xd5a86c, 0x7d6140, 0.8)
  d.fir(c, c, 3, 0.7, 2)
}

export function hayBands(d: Drawing, across: number, from: number, to: number, z: number, radius: number) {
  for (const u of [from + (to - from) * 0.27, from + (to - from) * 0.73]) {
    const ring = Array.from({ length: 25 }, (_, i): Vertex => {
      const t = i * Math.PI * 2 / 24
      return [u, across + Math.cos(t) * (radius + 0.04) / Math.sqrt(5) * U, z + radius + Math.sin(t) * (radius + 0.04)]
    })
    d.line(ring, 1.1, 0xa6925d)
  }
}

export function sheepTrough(d: Drawing, a: number) {
  const u = a - U, v = 19 * U
  block(d, u, v, 1.2 * U, 2.5 * U, 0, 0.8)
  for (const x of [-1.2 * U, 1.2 * U]) block(d, u + x, v, 0.25 * U, 2.5 * U, 0.8, 2.8)
  for (const y of [-2.5 * U, 2.5 * U]) block(d, u, v + y, 1.2 * U, 0.25 * U, 0.8, 2.8)
  d.face([[u - U, v - 2.2 * U, 2.5], [u + U, v - 2.2 * U, 2.5], [u + U, v + 2.2 * U, 2.5], [u - U, v + 2.2 * U, 2.5]], 0xc3d6cf, 0)
}

/** The outside ladder reaches a landing; seven supported treads clear the roof and meet the deck. */
export function firewatchAccess(d: Drawing, a: number, p: number, H: number) {
  const base = H + 7, top = base + 1.5, v = -4.5 * U
  block(d, 11.25 * U, v, 1.25 * U, 1.6 * U, base, 1.5)
  for (const y of [-6 * U, -3 * U]) {
    post(d, 12 * U, y, base)
    beam(d, [a, y, 17], [12 * U, y, base], 1.2)
  }
  const foot = p - U, head = 12.5 * U
  for (const y of [-1.1, 1.1]) beam(d, [foot, v + y * U, 0], [head, v + y * U, top], 1.1)
  for (let z = 2.5; z < top; z += 2.5) {
    const u = foot + (head - foot) * z / top
    beam(d, [u, v - 1.1 * U, z], [u, v + 1.1 * U, z], 0.7)
  }
  const point = (t: number, side: number, height: number): Vertex => [(11 - 7 * t) * U, (-4.5 + 2.7 * t + side * 1.2) * U, top + 6 * t + height]
  for (const side of [-1, 1]) {
    beam(d, point(0, side, -0.5), point(1, side, -0.5), 1.2)
    beam(d, point(0, side, 8), point(1, side, 8), 0.8)
    for (const t of [0, 0.5, 1]) beam(d, point(t, side, 0), point(t, side, 8), 0.8)
    beam(d, [10 * U, v + side * 1.6 * U, top + 8], [12.5 * U, v + side * 1.6 * U, top + 8], 0.8)
    for (const u of [10 * U, 12.5 * U]) beam(d, [u, v + side * 1.6 * U, top], [u, v + side * 1.6 * U, top + 8], 0.8)
  }
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7
    block(d, (11 - 7 * t) * U, (-4.5 + 2.7 * t) * U, 0.55 * U, 1.2 * U, top + 6 * (i + 1) / 7 - 0.55, 0.55)
  }
  for (const u of [-3 * U, 3 * U]) for (const y of [-3 * U, 3 * U]) beam(d, [u, y, H], [u, y, H + 13], 1.4)
}
