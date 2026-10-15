import { kinds, type KindId } from "../content.ts"
import { U } from "../iso.ts"
import { Drawing, palette, pale, sides, square, type Vertex, type Side } from "./primitives.ts"
import { bench, flowerBed } from "./town-props.ts"
import type { BuildingOptions } from "./buildings.ts"
import { rockOutcrop } from "./land.ts"

export function institutionDoor(d: Drawing, side: Side, a: number, kind: "chapel" | "hospital", fit: number) {
  const p = (s: number, z: number, out = 0.015) => d.wall(side,a,s,z*fit,out)
  if (kind === "chapel") {
    d.face([p(-4*U,0),p(4*U,0),p(4*U,17),p(0,24),p(-4*U,17)],0xd8d8cc,1)
    d.face([p(-3*U,0,0.025),p(3*U,0,0.025),p(3*U,16,0.025),p(0,21,0.025),p(-3*U,16,0.025)],0x9c8060,1)
    for(const x of [-2,-1,0,1,2])d.line([p(x*U,1,0.03),p(x*U,16-Math.abs(x),0.03)],0.6,0x765f46)
    for(const sign of [-1,1])for(const z of [4,9,14])d.line([p(sign*3*U,z,0.03),p(sign*4*U,z,0.03)],0.6,0xa4ad9d)
    d.line([p(-3*U,7,0.032),p(3*U,7,0.032)],1,0x6d7469)
    d.line([p(-3*U,12,0.032),p(3*U,12,0.032)],1,0x6d7469)
  } else {
    d.face([p(-4*U,0),p(4*U,0),p(4*U,23),p(-4*U,23)],0xe3e6dd,1)
    d.face([p(-3*U,0,0.025),p(3*U,0,0.025),p(3*U,18,0.025),p(-3*U,18,0.025)],0x839a89,1)
    for(const x of [-1.6,1.6])d.face([p((x-0.8)*U,10,0.03),p((x+0.8)*U,10,0.03),p((x+0.8)*U,16,0.03),p((x-0.8)*U,16,0.03)],0xdbe9e7,0.75)
    d.face([p(-3*U,19,0.025),p(3*U,19,0.025),p(3*U,21.5,0.025),p(-3*U,21.5,0.025)],0xdbe9e7,0.75)
    d.line([p(0,0,0.03),p(0,18,0.03)],1,0x596c60)
  }
  for(const x of [-0.6,0.6])d.line([p(x*U,8,0.04),p(x*U,10,0.04)],1.2,0xceb887)
  d.line([p(-4*U,0.3,0.04),p(4*U,0.3,0.04)],1.5,0xb6bead)
}

export function makeQuarry(options: BuildingOptions = {}) {
  const fit = options.fit ?? 1, p = 15*U, H = 32
  const d = new Drawing("quarry", "Quarry", "A two-cell stonecutting yard with a stepped rock face, timber derrick, dressed blocks and a small workshop.")
  d.asset.category="buildings";d.asset.reference={type:"building",kind:"quarry"};d.asset.footprint=kinds.quarry.size
  if(options.plate!==false)d.plate(2)
  d.box(-9*U,-6*U,4*U,7*U,0,H)
  if(fit>0)d.box(-9*U,-6*U,4.3*U,7.3*U,H,1.5*fit,0xd1d7ca,0xb8c2b1,0xa6b49f,1)
  if(fit>0.4){
    d.face([[-11*U,1*U+0.005,0],[-7*U,1*U+0.005,0],[-7*U,1*U+0.005,17],[-11*U,1*U+0.005,17]],0x8f9891,1)
    d.line([[-9*U,1*U+0.01,1],[-9*U,1*U+0.01,16]],1)
    d.face([[-4.9*U,-8*U,12],[-4.9*U,-4*U,12],[-4.9*U,-4*U,20],[-4.9*U,-8*U,20]],0xdbe6ea,1)
  }
  if(fit>0.75){
    rockOutcrop(d,4*U,5*U,7.5*U,25,false,2)
    for(const [x,y,z]of [[-9,8,0],[-5,8,0],[-9,12,0],[-7,10,5]] as const)d.box(x*U,y*U,1.6*U,1.5*U,z,5,0xe9ebe2,0xd4d9ce,0xbec7b9,1)
    for(const x of [4,10])d.box(x*U,-10*U,0.45*U,0.5*U,0,43,0xd8bb91,0xc3a177,0xaa8b65,1)
    d.box(7*U,-10*U,4*U,0.5*U,41,2,0xd8bb91,0xc3a177,0xaa8b65,1)
    d.line([[4*U,-10*U,22],[10*U,-10*U,40]],1,0x8a6a45)
    d.line([[8*U,-10*U,42],[8*U,-10*U,25]],0.75)
    d.box(8*U,-10*U,1.4*U,1.2*U,20,5,0xe9ebe2,0xd4d9ce,0xbec7b9,1)
    d.line([[6.5*U,-10*U,25],[8*U,-10*U,28],[9.5*U,-10*U,25]],0.75)
    d.box(-2*U,12*U,3*U,U,0,3,0xe9d2a8,0xd0b58c,0xb08a5e,1)
    d.line([[-3*U,12*U,3],[-1*U,12*U,7]],1.5,0x8a6a45)
  }
  return d.asset
}

export const townBuildingNotes: Partial<Record<KindId, string>> = {
  granary: "Raised grain store with timber braces, a sack hoist, ventilation shutters and grain bins.",
  smokehouse: "Soot-stained flue, drying fish rack, split firewood and a curing barrel.",
  firewatch: "A timber lookout and alarm bell above the red roof; ladder, buckets and a water butt below.",
  healer: "An apothecary with a mortar sign, herb beds, medicine jars and a waiting bench.",
  hospital: "Pale green ward windows, a roof lantern, medical emblems and a waiting bench.",
  watchhouse: "A guarded timber entrance with bracing and viewing grilles, beneath a blue shield; barred windows, a lantern and a street noticeboard remain.",
  builder: "Open timber racks, trestle workbench, mallet, ladder and dressed stone."
}

export function finishTownBuilding(d: Drawing, id: KindId, a: number, p: number, H: number) {
  const c = (a + p) / 2
  const post = (u: number, v: number, height: number, z = 0) => d.box(u, v, 0.35 * U, 0.35 * U, z, height, 0xe9d2a8, 0xd0b58c, 0xb08a5e, 0.75)
  const ladder = (foot: number, wall: number, v: number, height: number) => {
    for (const y of [-1.1, 1.1]) d.line([[foot,v+y*U,0],[wall,v+y*U,height]],1.2,0x8a6a45)
    for (let z = 3; z < height; z += 3) {
      const u=foot+(wall-foot)*z/height
      d.line([[u,v-1.1*U,z],[u,v+1.1*U,z]],1,0x8a6a45)
    }
  }
  if (id === "granary") {
    for (const side of sides) {
      const at = (s: number, z: number) => d.wall(side, a, s, z, 0.015)
      for (const x of [-a + U, a - U]) d.line([at(x, 0), at(x, H)], 1.5, 0x9f8b69)
      d.line([at(-a + U, 28), at(0, 40), at(a - U, 28)], 1, 0x9f8b69)
      for (const z of [47, 50, 53]) d.line([at(-2 * U, z), at(2 * U, z)], 1, 0xa99575)
    }
    post(c, -a * 0.4, 43)
    d.line([[c, -a * 0.4, 43], [c, a * 0.5, 43], [c, a * 0.5, 33]], 1.5, 0x8a6a45)
    d.sack(c, a * 0.5, 27)
    for (const y of [-a + U, -a + 4 * U, a - U]) d.sack(c, y)
    d.cylinder(-a - 2 * U, c, 1.5 * U, 0, 7, 0xc4b08b, 0xe9cf7c, 1, 12)
  } else if (id === "smokehouse") {
    d.box(-a / 2, -a / 2, 2.1 * U, 2.1 * U, H + 20, 4, 0x8f988b, 0xb2b9a9, 0x9ea792, 1)
    const y0 = -a - 2.5 * U, y1 = -a + 5 * U
    post(c, y0, 14); post(c, y1, 14)
    d.line([[c, y0, 14], [c, y1, 14]], 1.5, 0x8a6a45)
    for (let i = 1; i <= 3; i++) {
      const y = y0 + (y1 - y0) * i / 4
      d.line([[c, y, 14], [c, y, 11]], 0.75)
      d.ellipsoid(c, y, 8, 0.027, 0.04, 3, 0xb58b64, 1, 0xd5b48c, 12)
      d.face([[c, y - U, 5], [c, y + U, 5], [c, y, 3]], 0xb58b64, 0.75)
      for (const z of [7, 9]) d.line([[c + 0.03, y - 0.02, z], [c + 0.03, y + 0.02, z - 0.5]], 0.5, 0x8a6a45)
    }
    d.barrel(-a - 2 * U, c, 1.5 * U,0,7)
    for (const [y,z] of [[-0.55,0],[0.55,0],[0,2.2]]) d.log("u", c + y!*U, -a + U, -a + 5 * U, z!, 1.3, 0xb08a5e, 0xe9d2a8)
  } else if (id === "firewatch") {
    const half = 3 * U, z = H + 13
    for (const [u, v] of square(0, 0, half)) post(u, v, 15, z)
    d.box(0, 0, half + U, half + U, z, 1.5, 0xe9d2a8, 0xd0b58c, 0xb08a5e, 1)
    d.pyramid(half + U, z + 15, 7, pale(0xc4523f, 0.7), pale(0xc4523f, 0.52))
    d.cylinder(0, 0, 1.5 * U, z + 5, 1, 0xc2ac70, 0xe4d29a, 1, 12)
    d.ellipsoid(0, 0, z + 7, U, U, 2, 0xd3bd84, 1, undefined, 12)
    d.line([[0, 0, z + 9], [0, 0, z + 14]], 1)
    ladder(p-U,a+0.003,-a/2,H+7)
    d.barrel(c, c, 2 * U, 0, 9, 0xc9dde6)
    for (const y of [-2, 1]) d.cylinder(-a - 2 * U, c + y * U, U, 0, 4, 0xbda07a, 0xa9c5d0, 1, 12)
  } else if (id === "healer" || id === "hospital") {
    for (const side of sides) {
      const at = (s: number, z: number): Vertex => d.wall(side, a, s, z, 0.02), z = id === "hospital" ? 49 : 22
      d.face([at(-2 * U, z), at(2 * U, z), at(2 * U, z + 7), at(-2 * U, z + 7)], 0xeef3e6, 1, 0x809b87)
      d.line([at(0, z + 1.5), at(0, z + 5.5)], 2, 0x719383)
      d.line([at(-U, z + 3.5), at(U, z + 3.5)], 2, 0x719383)
    }
    flowerBed(d, c, -a / 2, 2, 0xb29ac2)
    flowerBed(d, -a / 2, c, 2.5, 0xe1cb85)
    const startFace=d.asset.faces.length,startStroke=d.asset.strokes.length
    bench(d, 0, 0)
    const place=([u,v,z]:Vertex):Vertex=>[c+v,a/2+u,z]
    for(const f of d.asset.faces.slice(startFace))f.points=f.points.map(place)
    for(const s of d.asset.strokes.slice(startStroke))s.points=s.points.map(place)
    if (id === "healer") {
      d.box(-a - 2 * U, c, 1.5 * U, 2.5 * U, 0, 6, 0xe9d2a8, 0xd0b58c, 0xb08a5e, 1)
      for (const y of [-1, 1]) {
        d.cylinder(-a - 2 * U, c + y * U, 0.6 * U, 6, 2.5, 0xa8c4b8, 0xd8e8d9, 0.75, 10)
        d.cylinder(-a - 2 * U, c + y * U, 0.3 * U, 8.5, 1, 0xbda07a, 0xbda07a, 0.5, 10)
      }
      d.cylinder(0, 0, 3 * U, H, 4, 0xc1cabb, 0xe9eee3, 1, 16)
      d.line([[0, 0, H + 3], [2 * U, 0, H + 9]], 2, 0x8a6a45)
    } else {
      d.box(0, 0, 4 * U, 4 * U, H, 8, 0xe9eee3, 0xdbe6d8, 0xc9d8cd, 1)
      d.pyramid(4.5 * U, H + 8, 5, 0xe9eee3, 0xc9d8cd)
      for (const side of sides) d.window(side, 4 * U, 0, H + 2, 4, 0xdbe9e7)
    }
  } else if (id === "watchhouse") {
    for (const side of sides) {
      const at = (s: number, z: number) => d.wall(side, a, s, z, 0.02)
      d.face([at(-2 * U, 28), at(2 * U, 28), at(2 * U, 23), at(0, 20), at(-2 * U, 23)], 0xa8bdd1, 1)
      d.line([at(0, 22), at(0, 27)], 1, 0x3d6db5)
      for (const x of [-a / 2, a / 2]) for (const dx of [-0.5, 0.5]) d.line([at(x + dx * U, 12), at(x + dx * U, 20)], 0.75)
    }
    post(c, -a / 2, 20)
    d.box(c, -a / 2, U, U, 15, 4, 0xe5d6a5, 0xf3e6bd, 0xd6c48d, 1)
    for (const x of [-1.5, 1.5]) post(-a / 2 + x * U, c, 15)
    d.box(-a / 2, c, 2 * U, 0.4 * U, 6, 8, 0xd5b994, 0xe9d2a8, 0xbda07a, 1)
    for (const x of [-1, 1]) d.box(-a / 2 + x * U, c + 0.5 * U, 0.6 * U, 0.05 * U, 8, 4, 0xf5f2e6, 0xf5f2e6, 0xe8e4d5, 0.5)
  } else if (id === "builder") {
    for (const y of [-a + U, -a + 5 * U]) post(c, y, 14)
    for (const z of [3, 8, 13]) {
      d.line([[c - U, -a + U, z], [c + U, -a + U, z]], 1, 0x8a6a45)
      d.box(c, -a + 3 * U, U, 3 * U, z, 1, 0xe9c6a0, 0xd8af80, 0xc69867, 0.75)
    }
    for (const y of [-1.5, 1.5]) post(-a / 2, c + y * U, 6)
    d.box(-a / 2, c, 3 * U, 2 * U, 6, 1, 0xe9d2a8, 0xd0b58c, 0xb08a5e, 1)
    d.line([[-a / 2, c, 7], [-a / 2 + U, c, 11]], 1.5, 0x8a6a45)
    d.box(-a / 2 + U, c, U, 0.7 * U, 10, 2, 0x9ca79a, 0xbfc8ba, 0x8f9a8c, 0.75)
    // Both rails clear the six-unit awning; the rear rack and ground blocks
    // leave this stretch of wall and the ladder's feet unobstructed.
    ladder(p-U,a+0.003,a-2*U,18)
    for (const x of [-1, 1]) d.box(c + x * U, c - U, U, U, 0, 3, 0xe4e6df, 0xd6d9cf, 0xc2c9bd, 1)
  }
}
