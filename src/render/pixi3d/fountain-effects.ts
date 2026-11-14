import { Container3D, FlatMaterial, Mesh3D, type ShaderBit } from "@pixi/3d"
import type { InkAsset } from "./assets/primitives.ts"
import { inkCommonBit } from "./bits.ts"
import { toGeometry } from "./gpu.ts"
import { copies, disc, sphere } from "./mesh/shapes.ts"

type Fountain = NonNullable<InkAsset["fountains"]>[number]
const floorScale = 32 * Math.SQRT2, heightScale = 1 / Math.cos(Math.PI / 6)

/** Droplets thrown from four jets, arcing into the basin. */
const dropsBit: ShaderBit = {
  name: "inkline-fountain-drops",
  requires: [inkCommonBit],
  attributes: { aWaterPhase: "float32", aJetAngle: "float32" },
  interStage: { vDropAge: "f32", vDropPhase: "f32" },
  bindings: { material: { time: "f32", radius: "f32", level: "f32", nozzle: "f32" } },
  gpu: {
    vertex: {
      beforeTransform: `{
        let age = fract(material.time * 0.85 + input.aWaterPhase);
        let reach = material.radius * 0.84 * age;
        let h = mix(material.nozzle, material.level, age) + 4.0 * age * (1.0 - age) * 6.9282;
        let centre = vec3<f32>(cos(input.aJetAngle) * reach, h, sin(input.aJetAngle) * reach);
        position = vec4<f32>(position.xyz * vec3<f32>(0.8, 1.7, 0.8) + centre, 1.0);
        output.vDropAge = age; output.vDropPhase = input.aWaterPhase;
      }`
    },
    fragment: {
      material: `{
        alpha = smoothstep(0.0, 0.07, input.vDropAge) * (1.0 - smoothstep(0.94, 1.0, input.vDropAge)) * 0.68;
        albedo = inkToDisplay(inkRGB(mix(vec3<f32>(0.65, 0.78, 0.82), vec3<f32>(0.96, 0.99, 0.96), fract(input.vDropPhase * 13.0))));
      }`
    }
  },
  gl: {
    vertex: {
      beforeTransform: `{
        float age = fract(material.time * 0.85 + aWaterPhase);
        float reach = material.radius * 0.84 * age;
        float h = mix(material.nozzle, material.level, age) + 4.0 * age * (1.0 - age) * 6.9282;
        vec3 centre = vec3(cos(aJetAngle) * reach, h, sin(aJetAngle) * reach);
        position = vec4(position.xyz * vec3(0.8, 1.7, 0.8) + centre, 1.0);
        vDropAge = age; vDropPhase = aWaterPhase;
      }`
    },
    fragment: {
      material: `{
        alpha = smoothstep(0.0, 0.07, vDropAge) * (1.0 - smoothstep(0.94, 1.0, vDropAge)) * 0.68;
        albedo = inkToDisplay(inkRGB(mix(vec3(0.65, 0.78, 0.82), vec3(0.96, 0.99, 0.96), fract(vDropPhase * 13.0))));
      }`
    }
  }
}
/** Ripples spreading where the jets land, and a faint shimmer, inside the basin's rim. */
const poolBit: ShaderBit = {
  name: "inkline-fountain-pool",
  requires: [inkCommonBit],
  interStage: { vPoolPoint: "vec2<f32>" },
  bindings: { material: { time: "f32", radius: "f32" } },
  gpu: {
    vertex: { beforeTransform: `{ output.vPoolPoint = position.xz / material.radius; }` },
    fragment: {
      material: `{
        var waves = 0.0;
        for (var i = 0; i < 4; i++) {
          let a = f32(i) * 1.5707963 + 0.7853982;
          let d = length(input.vPoolPoint - vec2<f32>(cos(a), sin(a)) * 0.84);
          waves += pow(max(0.0, sin(d * 28.0 - material.time * 6.0)), 14.0) * exp(-d * 7.0);
        }
        let edge = 1.0 - smoothstep(0.96, 1.0, length(input.vPoolPoint));
        let shimmer = sin(input.vPoolPoint.x * 17.0 + material.time) * sin(input.vPoolPoint.y * 13.0 - material.time * 0.7) * 0.015;
        albedo = inkToDisplay(inkRGB(vec3<f32>(0.94, 0.98, 0.97)));
        alpha = edge * (0.025 + waves * 0.28 + shimmer);
      }`
    }
  },
  gl: {
    vertex: { beforeTransform: `{ vPoolPoint = position.xz / material.radius; }` },
    fragment: {
      material: `{
        float waves = 0.0;
        for (int i = 0; i < 4; i++) {
          float a = float(i) * 1.5707963 + 0.7853982;
          float d = length(vPoolPoint - vec2(cos(a), sin(a)) * 0.84);
          waves += pow(max(0.0, sin(d * 28.0 - material.time * 6.0)), 14.0) * exp(-d * 7.0);
        }
        float edge = 1.0 - smoothstep(0.96, 1.0, length(vPoolPoint));
        float shimmer = sin(vPoolPoint.x * 17.0 + material.time) * sin(vPoolPoint.y * 13.0 - material.time * 0.7) * 0.015;
        albedo = inkToDisplay(inkRGB(vec3(0.94, 0.98, 0.97)));
        alpha = edge * (0.025 + waves * 0.28 + shimmer);
      }`
    }
  }
}

const COUNT = 64

/** Flowing droplets and impact ripples, constrained to the actual stone basin. */
export class FountainWater {
  readonly group = new Container3D()
  private materials: Array<FlatMaterial>
  private pool: Mesh3D
  private drops: Mesh3D
  constructor(fountain: Fountain) {
    const r = fountain.radius * floorScale, level = fountain.level * heightScale, nozzle = fountain.nozzle * heightScale
    this.group.position.set(fountain.origin[0] * floorScale, fountain.origin[2] * heightScale, fountain.origin[1] * floorScale)
    const drops = toGeometry(copies(sphere(0.34, 6, 4), COUNT, { aWaterPhase: (i) => [Math.floor(i / 4) / 16], aJetAngle: (i) => [((i % 4) * Math.PI) / 2 + Math.PI / 4] }), [[-r, level - 1, -r], [r, nozzle + 7, r]])
    const dropMaterial = new FlatMaterial({ alphaMode: "blend", extraBits: [dropsBit] })
    Object.assign(dropMaterial.data, { time: 0, radius: r, level, nozzle })
    const poolMaterial = new FlatMaterial({ alphaMode: "blend", doubleSided: true, extraBits: [poolBit] })
    Object.assign(poolMaterial.data, { time: 0, radius: r })
    this.pool = new Mesh3D({ geometry: toGeometry(disc(r, 32)), material: poolMaterial, castShadow: false })
    this.pool.position.y = level + 0.07
    this.materials = [dropMaterial, poolMaterial]
    this.drops = new Mesh3D({ geometry: drops, material: dropMaterial, castShadow: false })
    this.group.addChild(this.drops, this.pool)
  }
  update(time: number) {
    for (const material of this.materials) material.data.time = time
  }
  dispose() {
    this.group.removeFromParent()
    this.pool.destroy({ geometry: true })
    this.drops.destroy({ geometry: true })
    for (const material of this.materials) material.destroy()
  }
}
