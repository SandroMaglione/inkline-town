import { U } from "../iso.ts"
import { Drawing, palette, type Vertex } from "./primitives.ts"
import type { BuildingOptions } from "./buildings.ts"
import { beam, block, iron, orient, post, roof, stone, wood } from "./workshops.ts"
import { chair, chest } from "./furniture.ts"
import { buildStages } from "../art.ts"

/** A roofed bench bay at the back leaves the forecourt open to work. */
export function makeCarpenter(options: BuildingOptions = {}) {
  const d = new Drawing("carpenter", "Carpenter", "A timber workshop with an open bench bay, braced sawhorse, plank rack, hand tools and finished chairs and chest by the entrance.")
  const fit = Math.max(0, Math.min(1, options.fit ?? 1))
  d.asset.category = "buildings"; d.asset.reference = { type: "building", kind: "carpenter" }; d.asset.footprint = 2
  if (options.plate !== false) d.plate(2)
  block(d, 0, 0, 13.5 * U, 13.5 * U, 0, 0.5, stone, 0)
  block(d, 0, -11 * U, 12 * U, 0.5 * U, 0.5, 27.5, stone)
  block(d, -11.5 * U, -6 * U, 0.5 * U, 5 * U, 0.5, 27.5, stone)
  for (const u of [-11 * U, 3 * U, 11 * U]) post(d, u, U, 28, 0.5)
  beam(d, [-11 * U, U, 27.5], [11 * U, U, 27.5], 1.5)
  for (const [u, sign] of [[-11, 1], [3, -1], [11, -1]]) beam(d, [u! * U, U, 21], [(u! + sign! * 2) * U, U, 27.5], 1.1)
  if (fit > 0.4) {
    block(d, 7 * U, -0.1 * U, 3.2 * U, 0.35 * U, 0.5, 26.5, stone)
    const p = (s: number, z: number): Vertex => [(7 + s) * U, 0.3 * U, z]
    d.face([p(-2.5, 0.5), p(2.5, 0.5), p(2.5, 20.5), p(-2.5, 20.5)], wood[1], 0.8)
    for (const x of [-1.25, 0, 1.25]) d.line([p(x, 0.5), p(x, 20.5)], 0.45, wood[2])
    for (const z of [3, 17]) beam(d, p(-2.5, z), p(2.5, z), 0.7)
    d.line([p(1.5, 9), p(1.5, 11)], 0.8, iron[2])
    d.face([[-8 * U, -10.45 * U, 13], [-3 * U, -10.45 * U, 13], [-3 * U, -10.45 * U, 21], [-8 * U, -10.45 * U, 21]], palette.glass, 0.7)
  }
  if (fit > 0) roof(d, 12.8 * U, 6.8 * U, -5.5 * U, 28, 10 * fit, 0x9a6b3f)
  if (fit > 0.75) {
    // Bench, vice and plane under the open bay.
    for (const u of [-8, -2]) for (const v of [-5, -2]) block(d, u * U, v * U, 0.3 * U, 0.3 * U, 0.5, 7.5, wood, 0.5)
    block(d, -5 * U, -3.5 * U, 4 * U, 2 * U, 8, 0.8)
    block(d, -6 * U, -3 * U, 1.2 * U, 0.4 * U, 8.8, 0.7, iron, 0.5)
    block(d, -2 * U, -1.2 * U, 0.7 * U, 0.4 * U, 7, 2.3, iron, 0.5)
    beam(d, [-2 * U, -0.7 * U, 8], [-2 * U, 0.5 * U, 8], 0.6, iron)
    beam(d, [-U, -10.3 * U, 14], [7 * U, -10.3 * U, 14], 0.7)
    for (const u of [1, 4, 6]) {
      beam(d, [u * U, -10 * U, 10], [u * U, -10 * U, 16], 0.5)
      block(d, u * U, -10 * U, 0.7 * U, 0.15 * U, 15.5, 0.7, iron, 0.4)
    }
    for (const v of [6, 10]) {
      beam(d, [-7 * U, v * U, 0.5], [-5 * U, v * U, 7.5], 0.85)
      beam(d, [-3 * U, v * U, 0.5], [-5 * U, v * U, 7.5], 0.85)
      beam(d, [-6 * U, v * U, 4], [-4 * U, v * U, 4], 0.6)
    }
    block(d, -5 * U, 8 * U, 0.6 * U, 4 * U, 7.5, 0.7)
    block(d, -5 * U, 8 * U, 1.6 * U, 5 * U, 8.2, 0.55)
    for (const v of [-9, -3]) block(d, 11.5 * U, v * U, 1.5 * U, 0.5 * U, 0.5, 1)
    for (let i = 0; i < 4; i++) block(d, 11.5 * U, -5.5 * U, 1.2 * U, 4.5 * U, 1.5 + i * 0.7, 0.5, wood, 0.45)
    chest(d, U, 9 * U, 0.5)
    chair(d, 7 * U, 8 * U, 0.5)
    chair(d, 11 * U, 9 * U, 0.5)
  }
  return orient(d.asset, options.doors)
}

/** Posts and rear walls assemble before the roof and workshop fittings. */
export function carpenterConstruction(build: number, share: number | null, doors: BuildingOptions["doors"]) {
  const d = new Drawing("carpenter", "Carpenter · construction", "Open timber frame and supplied planks.")
  const stage = buildStages(build)
  d.asset.footprint = 2
  if (share !== null) for (let i = 0; i < Math.ceil(share * 3); i++) d.crate((9 - i * 3) * U, 10 * U, 0, 0x8f9891)
  if (stage.frame > 0) {
    const top = 28 * stage.frame
    for (const u of [-11 * U, 11 * U]) for (const v of [-11 * U, U]) post(d, u, v, top, Math.min(0.5, top))
    post(d, 3 * U, U, top, Math.min(0.5, top))
    beam(d, [-11 * U, U, top], [11 * U, U, top], 1.5)
    beam(d, [-11 * U, -11 * U, top], [11 * U, -11 * U, top], 1.5)
  }
  if (stage.walls > 0) {
    block(d, 0, 0, 13.5 * U, 13.5 * U, 0, 0.5 * stage.walls, stone, 0)
    block(d, 0, -11 * U, 12 * U, 0.5 * U, 0.5, 27.5 * stage.walls, stone)
    block(d, -11.5 * U, -6 * U, 0.5 * U, 5 * U, 0.5, 27.5 * stage.walls, stone)
  }
  return orient(d.asset, doors)
}
