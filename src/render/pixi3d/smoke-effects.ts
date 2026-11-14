import { Container3D, FlatMaterial, Mesh3D, type ShaderBit } from "@pixi/3d"
import { inkCommonBit } from "./bits.ts"
import { toGeometry } from "./gpu.ts"
import { copies, plane } from "./mesh/shapes.ts"

/** A chimney's plume: puffs that rise, drift and fade, each turned to the camera in the shader. */
const smokeBit: ShaderBit = {
  name: "inkline-smoke",
  requires: [inkCommonBit],
  attributes: { aPuffSeed: "float32" },
  interStage: { vSmokeAge: "f32", vSmokeSeed: "f32" },
  bindings: { material: { time: "f32", power: "f32" } },
  gpu: {
    vertex: {
      afterTransform: `{
        let age = fract(material.time / 3.8 + input.aPuffSeed);
        var c = camera.uViewMatrix * modelMatrix * vec4<f32>(0.0, 0.0, 0.0, 1.0);
        c.y += age * 29.0;
        c.x += age * age * 6.0 + sin(age * 5.0 + input.aPuffSeed * 29.0) * age * 2.0;
        let size = 4.0 + age * 11.0;
        c = vec4<f32>(c.xy + position.xy * vec2<f32>(size, size * 1.18), c.zw);
        clipPosition = camera.uProjectionMatrix * c;
        output.vSmokeAge = age; output.vSmokeSeed = input.aPuffSeed;
      }`
    },
    fragment: {
      material: `{
        let p = (input.vUV - 0.5) * 2.0;
        let cloud = inkNoise(input.vUV * 3.0 + input.vSmokeSeed * 13.0 + vec2<f32>(0.0, material.time * 0.13)) * 0.65 + inkNoise(input.vUV * 7.0 + input.vSmokeSeed * 9.0) * 0.35;
        let edge = 1.0 - smoothstep(0.35, 1.0, length(p) + cloud * 0.24);
        alpha = edge * sin(input.vSmokeAge * 3.14159) * 0.19 * material.power;
        if (alpha < 0.008) { discard; }
        albedo = inkToDisplay(inkRGB(mix(vec3<f32>(0.40, 0.45, 0.39), vec3<f32>(0.68, 0.70, 0.63), input.vSmokeAge)));
      }`
    }
  },
  gl: {
    vertex: {
      afterTransform: `{
        float age = fract(material.time / 3.8 + aPuffSeed);
        vec4 c = uViewMatrix * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        c.y += age * 29.0;
        c.x += age * age * 6.0 + sin(age * 5.0 + aPuffSeed * 29.0) * age * 2.0;
        float size = 4.0 + age * 11.0;
        c.xy += position.xy * vec2(size, size * 1.18);
        gl_Position = uProjectionMatrix * c;
        vSmokeAge = age; vSmokeSeed = aPuffSeed;
      }`
    },
    fragment: {
      material: `{
        vec2 p = (vUV - 0.5) * 2.0;
        float cloud = inkNoise(vUV * 3.0 + vSmokeSeed * 13.0 + vec2(0.0, material.time * 0.13)) * 0.65 + inkNoise(vUV * 7.0 + vSmokeSeed * 9.0) * 0.35;
        float edge = 1.0 - smoothstep(0.35, 1.0, length(p) + cloud * 0.24);
        alpha = edge * sin(vSmokeAge * 3.14159) * 0.19 * material.power;
        if (alpha < 0.008) discard;
        albedo = inkToDisplay(inkRGB(mix(vec3(0.40, 0.45, 0.39), vec3(0.68, 0.70, 0.63), vSmokeAge)));
      }`
    }
  }
}

const COUNT = 10
let shape: ReturnType<typeof toGeometry> | null = null

/** A bounded cloud emitter, anchored at the actual flue opening. */
export class SmokePlume {
  readonly group = new Container3D()
  private material: FlatMaterial
  constructor() {
    shape ??= toGeometry(copies(plane(1, 1), COUNT, { aPuffSeed: (i) => [i / COUNT] }), [[-14, 0, -14], [14, 42, 14]])
    this.material = new FlatMaterial({ alphaMode: "blend", doubleSided: true, extraBits: [smokeBit] })
    this.material.data.time = 0
    this.material.data.power = 1
    this.group.addChild(new Mesh3D({ geometry: shape, material: this.material, castShadow: false }))
  }
  update(time: number, strength = 1) {
    this.group.visible = strength > 0
    this.material.data.time = time
    this.material.data.power = strength
  }
  dispose() {
    this.group.removeFromParent()
    this.group.destroy({ children: true })
    this.material.destroy()
  }
}
