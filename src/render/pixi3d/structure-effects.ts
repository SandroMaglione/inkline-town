import { Container3D, FlatMaterial, Mesh3D, type ShaderBit } from "@pixi/3d"
import { type InkAsset } from "./assets/primitives.ts"
import { surfaceState, type SurfaceState } from "./surface-state.ts"
import { inkCommonBit } from "./bits.ts"
import { toGeometry } from "./gpu.ts"
import { copies, plane } from "./mesh/shapes.ts"
import { add, cross, length, normalize, scale, sub, type Vec3 } from "./mesh/vec3.ts"

/** Flames (mode 0), smoke (1) and sparks (2), each a copy turned to the camera, from a point on the roof. */
const fireBit: ShaderBit = {
  name: "inkline-structure-fire",
  requires: [inkCommonBit],
  attributes: { aEffectAt: "float32x3", aEffectScale: "float32x2", aEffectSeed: "float32" },
  interStage: { vFireAge: "f32", vFireSeed: "f32" },
  bindings: { material: { time: "f32", power: "f32", mode: "f32" } },
  gpu: {
    vertex: {
      afterTransform: `{
        let mode = material.mode; let seed = input.aEffectSeed;
        let life = select(select(2.8, 4.2, mode < 1.5), 1.8, mode < 0.5);
        let age = fract(material.time / life + seed);
        var c = camera.uViewMatrix * modelMatrix * vec4<f32>(input.aEffectAt, 1.0);
        c.y += select(select(age * 35.0, age * 32.0, mode < 1.5), 0.0, mode < 0.5);
        c.x += sin(seed * 43.0 + age * 4.0) * select(3.0, 0.7, mode < 0.5) * age;
        let size = select(select(1.0, 0.55 + age * 1.15, mode < 1.5), (0.8 + 0.2 * sin(material.time * 8.0 + seed * 31.0)) * material.power, mode < 0.5);
        if (mode < 0.5) { c.y += input.aEffectScale.y * size * 0.5; }
        c = vec4<f32>(c.xy + (position.xy * input.aEffectScale) * size, c.zw);
        clipPosition = camera.uProjectionMatrix * c;
        output.vFireAge = age; output.vFireSeed = seed;
      }`
    },
    fragment: {
      material: `{
        let p = input.vUV; var a = 0.0; var color = vec3<f32>(0.0); let mode = material.mode; let t = material.time;
        if (mode < 0.5) {
          let y = p.y; let curl = sin(y * 8.0 - t * 4.5 + input.vFireSeed * 39.0) * 0.11 * y;
          let body = abs(p.x - 0.5 - curl) / (0.46 * (1.0 - y * 0.86));
          let edge = 1.0 - smoothstep(0.45, 1.0, body + inkNoise(vec2<f32>(p.x * 6.0, y * 5.0 - t * 3.5) + input.vFireSeed * 10.0) * 0.27);
          a = edge * smoothstep(0.0, 0.10, y) * (1.0 - smoothstep(0.82, 1.0, y)) * 0.82;
          let core = (1.0 - body) * pow(1.0 - y, 0.7);
          color = mix(vec3<f32>(0.87, 0.33, 0.12), vec3<f32>(1.0, 0.83, 0.38), smoothstep(0.0, 0.8, core));
        } else if (mode < 1.5) {
          let d = length((p - 0.5) * vec2<f32>(2.0, 1.8));
          let cloud = inkNoise(p * 3.0 + vec2<f32>(input.vFireSeed * 9.0, t * 0.12)) * 0.65 + inkNoise(p * 7.0 + input.vFireSeed * 11.0) * 0.35;
          a = (1.0 - smoothstep(0.3, 1.0, d + cloud * 0.24)) * sin(input.vFireAge * 3.14159) * 0.24 * material.power;
          color = mix(vec3<f32>(0.35, 0.39, 0.33), vec3<f32>(0.64, 0.66, 0.58), input.vFireAge);
        } else {
          a = (1.0 - smoothstep(0.05, 0.5, length(p - 0.5))) * sin(input.vFireAge * 3.14159) * material.power;
          color = vec3<f32>(1.0, 0.67, 0.24);
        }
        if (a < 0.015) { discard; }
        alpha = a;
        albedo = inkToDisplay(inkRGB(color));
      }`
    }
  },
  gl: {
    vertex: {
      afterTransform: `{
        float mode = material.mode, seed = aEffectSeed;
        float life = mode < 0.5 ? 1.8 : mode < 1.5 ? 4.2 : 2.8;
        float age = fract(material.time / life + seed);
        vec4 c = uViewMatrix * modelMatrix * vec4(aEffectAt, 1.0);
        c.y += mode < 0.5 ? 0.0 : mode < 1.5 ? age * 32.0 : age * 35.0;
        c.x += sin(seed * 43.0 + age * 4.0) * (mode < 0.5 ? 0.7 : 3.0) * age;
        float size = mode < 0.5 ? (0.8 + 0.2 * sin(material.time * 8.0 + seed * 31.0)) * material.power : mode < 1.5 ? (0.55 + age * 1.15) : 1.0;
        if (mode < 0.5) c.y += aEffectScale.y * size * 0.5;
        c.xy += (position.xy * aEffectScale) * size;
        gl_Position = uProjectionMatrix * c;
        vFireAge = age; vFireSeed = seed;
      }`
    },
    fragment: {
      material: `{
        vec2 p = vUV; float a; vec3 color; float mode = material.mode, t = material.time;
        if (mode < 0.5) {
          float y = p.y; float curl = sin(y * 8.0 - t * 4.5 + vFireSeed * 39.0) * 0.11 * y;
          float body = abs(p.x - 0.5 - curl) / (0.46 * (1.0 - y * 0.86));
          float edge = 1.0 - smoothstep(0.45, 1.0, body + inkNoise(vec2(p.x * 6.0, y * 5.0 - t * 3.5) + vFireSeed * 10.0) * 0.27);
          a = edge * smoothstep(0.0, 0.10, y) * (1.0 - smoothstep(0.82, 1.0, y)) * 0.82;
          float core = (1.0 - body) * pow(1.0 - y, 0.7);
          color = mix(vec3(0.87, 0.33, 0.12), vec3(1.0, 0.83, 0.38), smoothstep(0.0, 0.8, core));
        } else if (mode < 1.5) {
          float d = length((p - 0.5) * vec2(2.0, 1.8));
          float cloud = inkNoise(p * 3.0 + vec2(vFireSeed * 9.0, t * 0.12)) * 0.65 + inkNoise(p * 7.0 + vFireSeed * 11.0) * 0.35;
          a = (1.0 - smoothstep(0.3, 1.0, d + cloud * 0.24)) * sin(vFireAge * 3.14159) * 0.24 * material.power;
          color = mix(vec3(0.35, 0.39, 0.33), vec3(0.64, 0.66, 0.58), vFireAge);
        } else {
          a = (1.0 - smoothstep(0.05, 0.5, length(p - 0.5))) * sin(vFireAge * 3.14159) * material.power;
          color = vec3(1.0, 0.67, 0.24);
        }
        if (a < 0.015) discard;
        alpha = a;
        albedo = inkToDisplay(inkRGB(color));
      }`
    }
  }
}

/** Particle emitters sampled from the actual roof triangles, never a hovering sign or replacement mesh. */
export class StructureEffects {
  readonly group = new Container3D()
  /** What the effects were made for (a home's tier, an upgrade), to tell when they must be made again. */
  readonly made: { tier?: number; upgraded?: boolean } = {}
  private state = surfaceState()
  private layers: Array<{ mesh: Mesh3D; material: FlatMaterial }> = []
  private asset: InkAsset
  private H: number
  constructor(asset: InkAsset, height: number) {
    this.asset = asset
    this.H = height
    this.group.visible = false
  }
  set(next: SurfaceState) {
    this.state = next
    this.group.visible = next.burning > 0 || next.fireRisk > 0
  }
  private build() {
    const s = 32 * Math.SQRT2, convert = (p: readonly number[]): Vec3 => [p[0]! * s, p[2]! / Math.cos(Math.PI / 6), p[1]! * s]
    const roofs = this.asset.faces.filter((f) => f.points.every((p) => p[2] >= this.H - 0.01) && f.points.length >= 3).flatMap((f) => {
      const a = convert(f.points[0]!), triangles: Array<[Vec3, Vec3, Vec3]> = []
      for (let i = 1; i < f.points.length - 1; i++) {
        const b = convert(f.points[i]!), c = convert(f.points[i + 1]!), n = cross(sub(c, b), sub(a, b))
        if (Math.abs(normalize(n)[1]) > 0.15 && length(n) / 2 > 2) triangles.push([a, b, c])
      }
      return triangles
    })
    for (const [mode, count] of [[0, 16], [1, 18], [2, 14]] as const) {
      const at = (i: number): Vec3 => {
        const t = roofs[i % roofs.length], u = 0.15 + ((i * 0.37) % 0.65), v = 0.12 + ((i * 0.23) % 0.6), sum = u + v, a = u / Math.max(1, sum), b = v / Math.max(1, sum)
        const p: Vec3 = t ? add(add(scale(t[0], 1 - a - b), scale(t[1], a)), scale(t[2], b)) : [0, this.H / Math.cos(Math.PI / 6), 0]
        return add(p, [0, mode === 0 ? 0 : mode === 1 ? 3 : 0.5, 0])
      }
      const size = (i: number) => (mode === 0 ? [5 + (i % 3), 13 + (i % 4) * 2.5] : mode === 1 ? [8 + (i % 4), 8 + (i % 4)] : [0.7, 0.9])
      const points = Array.from({ length: count }, (_, i) => at(i)), low = (k: number) => Math.min(...points.map((p) => p[k]!)) - 20, high = (k: number) => Math.max(...points.map((p) => p[k]!)) + 20
      const extent: [Vec3, Vec3] = [[low(0), low(1), low(2)], [high(0), high(1) + 45, high(2)]]
      const geometry = toGeometry(copies(plane(1, 1), count, { aEffectAt: at, aEffectScale: size, aEffectSeed: (i) => [(i * 0.6180339) % 1] }), extent)
      const material = new FlatMaterial({ alphaMode: "blend", doubleSided: true, extraBits: [fireBit] })
      material.data.mode = mode
      material.data.time = 0
      material.data.power = 0
      const mesh = new Mesh3D({ geometry, material, castShadow: false })
      this.layers.push({ mesh, material })
      this.group.addChild(mesh)
    }
  }
  update(time: number) {
    if (!this.group.visible) return
    if (!this.layers.length) this.build()
    for (const [i, { mesh, material }] of this.layers.entries()) {
      mesh.visible = i === 1 ? true : this.state.burning > 0
      material.data.time = time
      material.data.power = i === 1 ? Math.max(this.state.burning, this.state.fireRisk * 0.42) : this.state.burning
    }
  }
  dispose() {
    for (const { mesh, material } of this.layers) {
      mesh.destroy({ geometry: true })
      material.destroy()
    }
    this.layers = []
    this.group.removeFromParent()
  }
}
