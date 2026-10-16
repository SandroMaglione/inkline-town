import * as THREE from "three"
import { floorScale, vertex3 } from "../asset-lab/renderer.ts"
import type { Point } from "../iso.ts"

const vertex = `
attribute float seed;
varying vec2 point;
varying float phase;
void main(){
  point=position.xz/${(floorScale * 0.5).toFixed(3)};
  phase=seed;
  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
}`
// Now and then (each cell in its own time), one thin ink ring spreads slowly from a point off the middle and
// fades; most of the time the water is still. Calm enough to sit beside the town, plain enough to read.
const fragment = `
uniform float time;
varying vec2 point;
varying float phase;
void main(){
  vec2 at=point-vec2(fract(phase*7.13)-0.5,fract(phase*3.71)-0.5)*0.5;
  float d=length(at);
  float age=fract(time*0.058+phase)/0.3;
  if(age>1.0)discard;
  float r=0.08+age*0.5;
  float ring=1.0-smoothstep(0.0,0.03,abs(d-r));
  float fade=smoothstep(0.0,0.15,age)*(1.0-age);
  float edge=1.0-smoothstep(0.85,1.0,max(abs(point.x),abs(point.y)));
  float alpha=ring*fade*edge*0.38;
  if(alpha<0.01)discard;
  gl_FragColor=vec4(pow(vec3(0.32,0.45,0.52),vec3(2.2)),alpha);
  #include <colorspace_fragment>
}`

/**
 * Fish in the water: a slow ripple now and then on every cell of water
 * that would give a catch, none on a cell resting after one. A fishery's
 * shore reads at a glance as stocked or fished out.
 */
export class FishWater {
  readonly group = new THREE.Group()
  private readonly time = { value: 0 }
  private mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  private key = ""
  set(cells: ReadonlyArray<Point>) {
    const key = cells.map((c) => `${c.x},${c.y}`).join(";")
    if (key === this.key) return
    this.key = key
    if (!this.mesh || this.mesh.instanceMatrix.count < cells.length) {
      this.dispose()
      const capacity = Math.max(64, cells.length)
      const geometry = new THREE.PlaneGeometry(floorScale * 0.96, floorScale * 0.96)
      geometry.rotateX(-Math.PI / 2)
      geometry.setAttribute("seed", new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1))
      const material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: { time: this.time }, transparent: true, depthWrite: false })
      this.mesh = new THREE.InstancedMesh(geometry, material, capacity)
      this.mesh.frustumCulled = false
      this.mesh.renderOrder = 2
      this.group.add(this.mesh)
    }
    const seeds = this.mesh.geometry.getAttribute("seed") as THREE.InstancedBufferAttribute
    const m = new THREE.Matrix4()
    cells.forEach((c, i) => {
      m.setPosition(vertex3([c.x + 0.5, c.y + 0.5, -0.1]))
      this.mesh!.setMatrixAt(i, m)
      seeds.setX(i, (Math.abs((c.x * 73856093) ^ (c.y * 19349663)) % 1000) / 1000)
    })
    this.mesh.count = cells.length
    this.mesh.instanceMatrix.needsUpdate = true
    seeds.needsUpdate = true
  }
  update(time: number) {
    this.time.value = time
  }
  dispose() {
    if (!this.mesh) return
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this.mesh.dispose()
    this.mesh = null
  }
}
