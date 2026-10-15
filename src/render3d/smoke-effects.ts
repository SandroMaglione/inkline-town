import * as THREE from "three"

const vertex = `
attribute float puffSeed;
uniform float time;
varying vec2 tex;
varying float age;
varying float seed;
void main(){
  tex=uv;seed=puffSeed;age=fract(time/3.8+seed);
  vec4 center=modelViewMatrix*vec4(0,0,0,1);
  center.y+=age*29.0;
  center.x+=age*age*6.0+sin(age*5.0+seed*29.0)*age*2.0;
  float size=4.0+age*11.0;
  center.xy+=position.xy*vec2(size,size*1.18);
  gl_Position=projectionMatrix*center;
}`
const fragment = `
uniform float time;
uniform float power;
varying vec2 tex;
varying float age;
varying float seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
  vec2 p=(tex-0.5)*2.0;
  float cloud=noise(tex*3.0+seed*13.0+vec2(0,time*0.13))*0.65+noise(tex*7.0+seed*9.0)*0.35;
  float edge=1.0-smoothstep(0.35,1.0,length(p)+cloud*0.24);
  float alpha=edge*sin(age*3.14159)*0.19*power;
  if(alpha<0.008)discard;
  vec3 color=mix(vec3(0.40,0.45,0.39),vec3(0.68,0.70,0.63),age);
  gl_FragColor=vec4(pow(color,vec3(2.2)),alpha);
  #include <colorspace_fragment>
}`

/** A bounded cloud emitter, anchored at the actual flue opening. */
export class SmokePlume {
  readonly group = new THREE.Group()
  private mesh: THREE.InstancedMesh<THREE.PlaneGeometry,THREE.ShaderMaterial>
  constructor() {
    const count=10,geometry=new THREE.PlaneGeometry(1,1)
    geometry.setAttribute("puffSeed",new THREE.InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>i/count),1))
    geometry.boundingBox=new THREE.Box3(new THREE.Vector3(-14,0,-14),new THREE.Vector3(14,42,14))
    geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,21,0),30)
    const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{time:{value:0},power:{value:1}},transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide})
    this.mesh=new THREE.InstancedMesh(geometry,material,count)
    for(let i=0;i<count;i++)this.mesh.setMatrixAt(i,new THREE.Matrix4())
    this.mesh.frustumCulled=false;this.mesh.renderOrder=4;this.group.add(this.mesh)
  }
  update(time: number, strength = 1) {
    this.group.visible=strength>0
    this.mesh.material.uniforms.time!.value=time
    this.mesh.material.uniforms.power!.value=strength
  }
  dispose(){this.group.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.dispose()}
}
