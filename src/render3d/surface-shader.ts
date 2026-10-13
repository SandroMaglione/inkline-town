import * as THREE from "three"
import { type SurfaceState } from "./surface-state.ts"

/** One shader for catalogue meshes and GPU instances in the live town. */
const declarations = `
varying vec3 vStructurePosition;
varying vec3 vStructureNormal;
varying vec4 vStructureState;
varying vec4 vStructureHazards;
varying vec4 vStructureBounds;
uniform float structureTime;
uniform float structureGlass;
float grainHash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float grain(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(grainHash(i),grainHash(i+vec2(1,0)),f.x),mix(grainHash(i+vec2(0,1)),grainHash(i+vec2(1,1)),f.x),f.y); }
vec3 inkRGB(vec3 c){ return pow(c,vec3(2.2)); }
`
const shade = `
if(vStructureBounds.w>0.5){
  vec3 p=vStructurePosition; vec3 n=normalize(vStructureNormal);
  float H=vStructureBounds.y, halfWidth=vStructureBounds.x;
  float wear=vStructureState.x,care=vStructureState.y,snow=vStructureState.z,burn=vStructureState.w;
  float fireRisk=vStructureHazards.x,health=vStructureHazards.y,order=vStructureHazards.z,sick=vStructureHazards.w;
  float roof=step(H-0.15,p.y)*smoothstep(0.12,0.45,abs(n.y));
  float wall=(1.0-roof)*step(0.1,p.y)*step(p.y,H+0.1)*(1.0-structureGlass);
  vec2 uv=abs(n.x)>abs(n.z)?p.zy:p.xy;
  float g=grain(uv*0.32+vStructureBounds.z);
  float lower=1.0-smoothstep(0.0,H*0.7,p.y);
  float dirt=wear*wall*(0.16+0.45*lower+0.20*g);
  diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.60,0.62,0.52)),dirt);
  float plaster=wear*wall*smoothstep(0.58,0.76,g)*(0.4+0.6*lower);
  vec2 brick=vec2((uv.x+mod(floor(uv.y/1.8),2.0)*1.8)/3.6,uv.y/1.8);
  float mortar=max(1.0-smoothstep(0.025,0.08,fract(brick.y)),1.0-smoothstep(0.025,0.06,fract(brick.x)));
  diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(mix(vec3(0.68,0.53,0.40),vec3(0.84,0.79,0.68),mortar)),plaster*0.9);
  float crack=abs(uv.x-halfWidth*0.36-sin(uv.y*0.64)*0.48-sin(uv.y*1.5)*0.16);
  float crackMask=(1.0-smoothstep(0.045,0.10,crack))*smoothstep(H*0.25,H*0.4,p.y)*step(p.y,H*0.92);
  diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.39,0.43,0.36)),crackMask*wear*wall*0.85);
  float moss=roof*wear*smoothstep(0.3,0.8,grain(p.xz*0.30))*0.45;
  diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.47,0.54,0.37)),moss);
  diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.97,0.96,0.90)),care*wall*0.12);
  float damp=(health*0.45+sick*0.65)*wall*lower*smoothstep(0.35,0.75,g);
  diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.48,0.59,0.43)),damp);
  if(structureGlass>0.5){
    float fissure=abs(fract((uv.x+uv.y*0.38+sin(uv.y*2.0)*0.18)/3.2)-0.5);
    float broken=(1.0-smoothstep(0.025,0.065,fissure))*order;
    diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.25,0.31,0.29)),broken*0.95);
    diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.58,0.69,0.45)),sick*0.35);
    float warm=care*0.6+burn*(0.75+0.15*sin(structureTime*9.0+p.x*2.0));
    diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(1.0,0.76,0.36)),warm);
  }
  float soot=(roof+wall*0.5)*burn*(0.35+grain(p.xz*0.27)*0.50);
  diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.28,0.31,0.27)),soot);
  float heat=roof*burn*pow(grain(p.xz*0.45+vec2(0.0,-structureTime*1.3)),5.0);
  diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.99,0.49,0.19)),heat*0.75);
  diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.80,0.63,0.43)),roof*fireRisk*0.15*(0.7+0.3*sin(structureTime*3.0)));
  float frost=roof*snow*smoothstep(-0.05,0.22,grain(p.xz*0.65)+smoothstep(H,H+2.0,p.y)*0.15);
  diffuseColor.rgb=mix(diffuseColor.rgb,inkRGB(vec3(0.97,0.98,0.96)),frost);
}
`
export function installSurfaceShader(material: THREE.MeshBasicMaterial, color: number, time: {value: number}, state: SurfaceState, bounds: THREE.Vector4, instanced = false) {
  const previous = material.onBeforeCompile.bind(material)
  const previousKey = material.customProgramCacheKey.bind(material)
  const s = new THREE.Vector4(state.wear,state.care,state.snow,state.burning), h = new THREE.Vector4(state.fireRisk,state.health,state.order,state.sick)
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader,renderer)
    shader.uniforms.structureTime = time
    shader.uniforms.structureGlass = {value: [0xdbe6ea,0xf3dca6,0xc9d6ee,0xd5dae4,0xdbe9e7].includes(color)?1:0}
    shader.uniforms.structureState = {value:s}; shader.uniforms.structureHazards = {value:h}; shader.uniforms.structureBounds={value:bounds}
    const inputs = instanced ? "attribute vec4 structureState; attribute vec4 structureHazards; attribute vec4 structureBounds;" : "uniform vec4 structureState; uniform vec4 structureHazards; uniform vec4 structureBounds;"
    shader.vertexShader = `varying vec3 vStructurePosition; varying vec3 vStructureNormal; varying vec4 vStructureState; varying vec4 vStructureHazards; varying vec4 vStructureBounds; ${inputs}\n` + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvStructurePosition=position; vStructureNormal=normal; vStructureState=structureState; vStructureHazards=structureHazards; vStructureBounds=structureBounds;")
    shader.fragmentShader=declarations+shader.fragmentShader
    shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\n"+shade)
  }
  material.customProgramCacheKey=()=>`${previousKey()}/structure-surface-v1/${Number(instanced)}`
  return { set(next: SurfaceState) { s.set(next.wear,next.care,next.snow,next.burning); h.set(next.fireRisk,next.health,next.order,next.sick) } }
}
