import { Container3D, FlatMaterial, Mesh3D, type ShaderBit } from "@pixi/3d"
import { floorScale, vertex3 } from "./assets/space.ts"
import type { Point } from "../../game/world/iso.ts"
import { inkCommonBit } from "./bits.ts"
import { toGeometry } from "./gpu.ts"
import { copies, flat, plane } from "./mesh/shapes.ts"

// Now and then (each cell in its own time), one thin ink ring spreads slowly from a point off the middle and
// fades; most of the time the water is still. Calm enough to sit beside the town, plain enough to read.
const fishBit: ShaderBit = {
  name: "inkline-fish",
  requires: [inkCommonBit],
  attributes: { aFishPoint: "float32x2", aFishSeed: "float32" },
  interStage: { vFishPoint: "vec2<f32>", vFishPhase: "f32" },
  bindings: { material: { time: "f32" } },
  gpu: {
    vertex: {
      beforeTransform: `{ output.vFishPoint = input.aFishPoint; output.vFishPhase = input.aFishSeed; }`
    },
    fragment: {
      material: `{
        let at = input.vFishPoint - vec2<f32>(fract(input.vFishPhase * 7.13) - 0.5, fract(input.vFishPhase * 3.71) - 0.5) * 0.5;
        let d = length(at);
        let age = fract(material.time * 0.058 + input.vFishPhase) / 0.3;
        if (age > 1.0) { discard; }
        let r = 0.08 + age * 0.5;
        let ring = 1.0 - smoothstep(0.0, 0.03, abs(d - r));
        let fade = smoothstep(0.0, 0.15, age) * (1.0 - age);
        let edge = 1.0 - smoothstep(0.85, 1.0, max(abs(input.vFishPoint.x), abs(input.vFishPoint.y)));
        alpha = ring * fade * edge * 0.38;
        if (alpha < 0.01) { discard; }
        albedo = inkToDisplay(inkRGB(vec3<f32>(0.32, 0.45, 0.52)));
      }`
    }
  },
  gl: {
    vertex: {
      beforeTransform: `{ vFishPoint = aFishPoint; vFishPhase = aFishSeed; }`
    },
    fragment: {
      material: `{
        vec2 at = vFishPoint - vec2(fract(vFishPhase * 7.13) - 0.5, fract(vFishPhase * 3.71) - 0.5) * 0.5;
        float d = length(at);
        float age = fract(material.time * 0.058 + vFishPhase) / 0.3;
        if (age > 1.0) discard;
        float r = 0.08 + age * 0.5;
        float ring = 1.0 - smoothstep(0.0, 0.03, abs(d - r));
        float fade = smoothstep(0.0, 0.15, age) * (1.0 - age);
        float edge = 1.0 - smoothstep(0.85, 1.0, max(abs(vFishPoint.x), abs(vFishPoint.y)));
        alpha = ring * fade * edge * 0.38;
        if (alpha < 0.01) discard;
        albedo = inkToDisplay(inkRGB(vec3(0.32, 0.45, 0.52)));
      }`
    }
  }
}

/**
 * Fish in the water: a slow ripple now and then on every cell of water
 * that would give a catch, none on a cell resting after one. A fishery's
 * shore reads at a glance as stocked or fished out.
 */
export class FishWater {
  readonly group = new Container3D()
  private readonly material = new FlatMaterial({ alphaMode: "blend", extraBits: [fishBit] })
  private mesh: Mesh3D | null = null
  private key = ""
  constructor() {
    this.material.data.time = 0
  }
  set(cells: ReadonlyArray<Point>) {
    const key = cells.map((c) => `${c.x},${c.y}`).join(";")
    if (key === this.key) return
    this.key = key
    this.clear()
    if (!cells.length) return
    // Each cell's square of water, placed on the cell, with its own corners (in half cells) for the ring.
    const tile = flat(plane(floorScale * 0.96, floorScale * 0.96)), n = tile.positions.length / 3
    const water = copies(tile, cells.length, { aFishSeed: (i) => [(Math.abs((cells[i]!.x * 73856093) ^ (cells[i]!.y * 19349663)) % 1000) / 1000] })
    const point = new Float32Array(n * cells.length * 2)
    cells.forEach((c, i) => {
      const at = vertex3([c.x + 0.5, c.y + 0.5, -0.1])
      for (let v = 0; v < n; v++) {
        const o = (i * n + v) * 3
        point.set([tile.positions[v * 3]! / (floorScale * 0.5), tile.positions[v * 3 + 2]! / (floorScale * 0.5)], (i * n + v) * 2)
        for (let k = 0; k < 3; k++) water.positions[o + k]! += at[k]!
      }
    })
    const geometry = toGeometry({ ...water, attributes: { ...water.attributes, aFishPoint: { data: point, size: 2 } } })
    this.mesh = new Mesh3D({ geometry, material: this.material, castShadow: false })
    this.group.addChild(this.mesh)
  }
  update(time: number) {
    this.material.data.time = time
  }
  private clear() {
    this.mesh?.destroy({ geometry: true })
    this.mesh = null
  }
  dispose() {
    this.clear()
    this.key = ""
  }
}
