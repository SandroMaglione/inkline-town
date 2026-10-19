import * as THREE from "three"
import { type InkAsset } from "./assets/primitives.ts"
import { surfaceState, type SurfaceState } from "./surface-state.ts"

const vertex = `
attribute float particleSeed;
uniform float time;
uniform float power;
uniform float mode;
varying vec2 tex;
varying float age;
varying float seed;
void main(){
 tex=uv; seed=particleSeed;
 float life=mode<0.5?1.8:mode<1.5?4.2:2.8;
 age=fract(time/life+seed);
 vec4 center=modelViewMatrix*instanceMatrix*vec4(0,0,0,1);
 float rise=mode<0.5?0.0:mode<1.5?age*32.0:age*35.0;
 center.y+=rise;
 center.x+=sin(seed*43.0+age*4.0)*(mode<0.5?0.7:3.0)*age;
 float size=mode<0.5?(0.8+0.2*sin(time*8.0+seed*31.0))*power:mode<1.5?(0.55+age*1.15):1.0;
 vec2 scale=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
 if(mode<0.5)center.y+=scale.y*size*0.5;
 center.xy+=(position.xy*scale)*size;
 gl_Position=projectionMatrix*center;
}
`
const fragment = `
uniform float time; uniform float power; uniform float mode;
varying vec2 tex; varying float age; varying float seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec2 p=tex; float alpha; vec3 color;
 if(mode<0.5){
   float y=p.y; float curl=sin(y*8.0-time*4.5+seed*39.0)*0.11*y;
   float body=abs(p.x-0.5-curl)/(0.46*(1.0-y*0.86));
   float edge=1.0-smoothstep(0.45,1.0,body+noise(vec2(p.x*6.0,y*5.0-time*3.5)+seed*10.0)*0.27);
   alpha=edge*smoothstep(0.0,0.10,y)*(1.0-smoothstep(0.82,1.0,y))*0.82;
   float core=(1.0-body)*pow(1.0-y,0.7);
   color=mix(vec3(0.87,0.33,0.12),vec3(1.0,0.83,0.38),smoothstep(0.0,0.8,core));
 }else if(mode<1.5){
   float d=length((p-0.5)*vec2(2.0,1.8));
   float cloud=noise(p*3.0+vec2(seed*9.0,time*0.12))*0.65+noise(p*7.0+seed*11.0)*0.35;
   alpha=(1.0-smoothstep(0.3,1.0,d+cloud*0.24))*sin(age*3.14159)*0.24*power;
   color=mix(vec3(0.35,0.39,0.33),vec3(0.64,0.66,0.58),age);
 }else{
   alpha=(1.0-smoothstep(0.05,0.5,length(p-0.5)))*sin(age*3.14159)*power;
   color=vec3(1.0,0.67,0.24);
 }
 if(alpha<0.015)discard;
 gl_FragColor=vec4(pow(color,vec3(2.2)),alpha);
 #include <colorspace_fragment>
}
`

/** Particle emitters sampled from the actual roof triangles, never a hovering
 * sign or replacement mesh. Billboards face the camera inside the shader. */
export class StructureEffects {
  readonly group = new THREE.Group()
  private state = surfaceState()
  private layers: Array<THREE.InstancedMesh<THREE.PlaneGeometry,THREE.ShaderMaterial>> = []
  private asset: InkAsset
  private H: number
  constructor(asset: InkAsset, height: number) { this.asset=asset; this.H=height; this.group.visible=false }
  set(next: SurfaceState) { this.state=next; this.group.visible=next.burning>0||next.fireRisk>0 }
  private build() {
    const scale=32*Math.SQRT2, convert=(p: readonly number[])=>new THREE.Vector3(p[0]!*scale,p[2]!/Math.cos(Math.PI/6),p[1]!*scale)
    const roofs=this.asset.faces.filter(f=>f.points.every(p=>p[2]>=this.H-0.01)&&f.points.length>=3).flatMap(f=> {
      const a=convert(f.points[0]!), triangles: Array<THREE.Triangle>=[]
      for(let i=1;i<f.points.length-1;i++){
        const t=new THREE.Triangle(a,convert(f.points[i]!),convert(f.points[i+1]!)), n=t.getNormal(new THREE.Vector3())
        if(Math.abs(n.y)>0.15&&t.getArea()>2)triangles.push(t)
      }
      return triangles
    })
    for(const [mode,count] of [[0,16],[1,18],[2,14]] as const){
      const geometry=new THREE.PlaneGeometry(1,1), seeds=Float32Array.from({length:count},(_,i)=>(i*0.6180339)%1)
      geometry.setAttribute("particleSeed",new THREE.InstancedBufferAttribute(seeds,1))
      const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{time:{value:0},power:{value:0},mode:{value:mode}},transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide})
      const mesh=new THREE.InstancedMesh(geometry,material,count)
      const dummy=new THREE.Object3D()
      for(let i=0;i<count;i++){
        const t=roofs[i%roofs.length], u=0.15+((i*0.37)%0.65),v=0.12+((i*0.23)%0.6), sum=u+v,
          a=u/Math.max(1,sum),b=v/Math.max(1,sum)
        const at=t?t.a.clone().multiplyScalar(1-a-b).addScaledVector(t.b,a).addScaledVector(t.c,b):new THREE.Vector3(0,this.H/Math.cos(Math.PI/6),0)
        dummy.position.copy(at).add(new THREE.Vector3(0,mode===0?0:mode===1?3:0.5,0))
        const size=mode===0?[5+i%3,13+i%4*2.5]:mode===1?[8+i%4,8+i%4]:[0.7,0.9]
        dummy.scale.set(size[0]!,size[1]!,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)
      }
      mesh.frustumCulled=false;mesh.renderOrder=3+mode;this.layers.push(mesh);this.group.add(mesh)
    }
  }
  update(time: number) {
    if(!this.group.visible)return
    if(!this.layers.length)this.build()
    for(const [i,mesh]of this.layers.entries()){
      mesh.visible=i===1?true:this.state.burning>0
      mesh.material.uniforms.time!.value=time
      mesh.material.uniforms.power!.value=i===1?Math.max(this.state.burning,this.state.fireRisk*0.42):this.state.burning
    }
  }
  dispose(){this.layers.forEach(m=>{m.geometry.dispose();m.material.dispose();m.dispose()});this.layers=[];this.group.removeFromParent()}
}
