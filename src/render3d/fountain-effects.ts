import * as THREE from "three"
import type { InkAsset } from "../asset-lab/primitives.ts"

type Fountain = NonNullable<InkAsset["fountains"]>[number]
const floorScale=32*Math.SQRT2, heightScale=1/Math.cos(Math.PI/6)

const dropsVertex=`
attribute float waterPhase;
attribute float jetAngle;
uniform float time;
uniform float radius;
uniform float level;
uniform float nozzle;
varying float age;
varying float phase;
void main(){
  age=fract(time*0.85+waterPhase);phase=waterPhase;
  float distance=radius*0.84*age;
  float h=mix(nozzle,level,age)+4.0*age*(1.0-age)*6.9282;
  vec3 center=vec3(cos(jetAngle)*distance,h,sin(jetAngle)*distance);
  vec3 drop=position*vec3(0.8,1.7,0.8)+center;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(drop,1.0);
}`
const dropsFragment=`
varying float age;
varying float phase;
void main(){
  float alpha=smoothstep(0.0,0.07,age)*(1.0-smoothstep(0.94,1.0,age))*0.68;
  vec3 color=mix(vec3(0.65,0.78,0.82),vec3(0.96,0.99,0.96),fract(phase*13.0));
  gl_FragColor=vec4(pow(color,vec3(2.2)),alpha);
  #include <colorspace_fragment>
}`
const poolVertex=`
uniform float radius;
varying vec2 poolPoint;
void main(){poolPoint=position.xz/radius;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`
const poolFragment=`
uniform float time;
varying vec2 poolPoint;
void main(){
  float waves=0.0;
  for(int i=0;i<4;i++){
    float a=float(i)*1.5707963+0.7853982;
    float d=length(poolPoint-vec2(cos(a),sin(a))*0.84);
    waves+=pow(max(0.0,sin(d*28.0-time*6.0)),14.0)*exp(-d*7.0);
  }
  float edge=1.0-smoothstep(0.96,1.0,length(poolPoint));
  float shimmer=sin(poolPoint.x*17.0+time)*sin(poolPoint.y*13.0-time*0.7)*0.015;
  gl_FragColor=vec4(pow(vec3(0.94,0.98,0.97),vec3(2.2)),edge*(0.025+waves*0.28+shimmer));
  #include <colorspace_fragment>
}`

/** Flowing droplets and impact ripples, constrained to the actual stone basin. */
export class FountainWater {
  readonly group=new THREE.Group()
  private time={value:0}
  private drops: THREE.InstancedMesh<THREE.SphereGeometry,THREE.ShaderMaterial>
  private pool: THREE.Mesh<THREE.CircleGeometry,THREE.ShaderMaterial>
  constructor(fountain: Fountain) {
    const r=fountain.radius*floorScale, level=fountain.level*heightScale, nozzle=fountain.nozzle*heightScale
    this.group.position.set(fountain.origin[0]*floorScale,fountain.origin[2]*heightScale,fountain.origin[1]*floorScale)
    const count=64,geometry=new THREE.SphereGeometry(0.34,6,4)
    geometry.setAttribute("waterPhase",new THREE.InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>Math.floor(i/4)/16),1))
    geometry.setAttribute("jetAngle",new THREE.InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>i%4*Math.PI/2+Math.PI/4),1))
    geometry.boundingBox=new THREE.Box3(new THREE.Vector3(-r,level-1,-r),new THREE.Vector3(r,nozzle+7,r))
    geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,(level+nozzle)/2,0),r+nozzle+7)
    const material=new THREE.ShaderMaterial({vertexShader:dropsVertex,fragmentShader:dropsFragment,uniforms:{time:this.time,radius:{value:r},level:{value:level},nozzle:{value:nozzle}},transparent:true,depthWrite:false,depthTest:true})
    this.drops=new THREE.InstancedMesh(geometry,material,count)
    for(let i=0;i<count;i++)this.drops.setMatrixAt(i,new THREE.Matrix4())
    this.drops.frustumCulled=false;this.drops.renderOrder=3;this.group.add(this.drops)
    const poolGeometry=new THREE.CircleGeometry(r,32);poolGeometry.rotateX(-Math.PI/2)
    const poolMaterial=new THREE.ShaderMaterial({vertexShader:poolVertex,fragmentShader:poolFragment,uniforms:{time:this.time,radius:{value:r}},transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide})
    this.pool=new THREE.Mesh(poolGeometry,poolMaterial);this.pool.position.y=level+0.07;this.pool.renderOrder=2;this.group.add(this.pool)
  }
  update(time: number){this.time.value=time}
  dispose(){this.group.removeFromParent();this.drops.geometry.dispose();this.drops.material.dispose();this.drops.dispose();this.pool.geometry.dispose();this.pool.material.dispose()}
}
