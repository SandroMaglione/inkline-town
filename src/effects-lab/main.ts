import * as THREE from "three"
import { house } from "../asset-lab/homes.ts"
import { home, type Tier } from "../content.ts"
import { U } from "../iso.ts"
import { ModelHandle,ModelPool } from "../render3d/pool.ts"
import { surfaceState,type SurfaceState } from "../render3d/surface-state.ts"
import { StructureEffects } from "../render3d/structure-effects.ts"
import "./style.css"

const cases: Array<{title:string;note:string;state:Partial<SurfaceState>}>=[
  {title:"Sound house",note:"The original house, without an effect.",state:{}},
  {title:"Cared for",note:"Fresh plaster and warm window light.",state:{care:1}},
  {title:"Neglected",note:"Stained plaster, exposed brick, cracks and roof moss.",state:{wear:0.95}},
  {title:"Fire warning",note:"Smoke escapes from the roof; heat colours the eaves.",state:{fireRisk:1,wear:0.2}},
  {title:"Sickness",note:"Damp green stains and unhealthy window light.",state:{health:1,sick:1,wear:0.3}},
  {title:"Unrest",note:"Fractures in the actual glazing; darkened windows.",state:{order:1,wear:0.3}},
  {title:"Winter",note:"Snow covers the existing roof surfaces.",state:{snow:1}},
  {title:"Burning",note:"Roof fire, rising smoke, embers, soot and flickering windows.",state:{burning:1,wear:0.4}}
]
const root=document.querySelector<HTMLElement>("#effects-lab")!
root.innerHTML=`<header><a href="/model-review.html">Inkline Town</a><span>LIVE MATERIAL & PARTICLE STUDY</span><a href="/">Play the town ↗</a></header><section class="intro"><h1>One house.<br>Eight conditions.</h1><p>These are actual renders of the shared game mesh. Surface shaders change its condition; particles emit from its roof. Drag to turn the view.</p></section><section class="controls"><label>House <select aria-label="House tier"><option value="1">Settler cottage</option><option value="2" selected>Citizen home</option><option value="3">Townhouse</option></select></label><label>Rotation <input aria-label="Rotation" id="rotation" type="range" min="-180" max="180" value="0"><output id="angle">0°</output></label><label>Effect strength <input aria-label="Effect strength" id="strength" type="range" min="0" max="100" value="100"><output id="amount">100%</output></label><button id="pause">Pause animation</button><button id="rear">See the back</button></section><section class="grid" aria-label="House effects"></section><footer><span id="stats"></span><span>Same mesh · Surface shaders · Roof particles · Drag to rotate</span></footer>`
const grid=root.querySelector<HTMLElement>(".grid")!, renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true}),scene=new THREE.Scene(),pool=new ModelPool(),camera=new THREE.OrthographicCamera(-100,100,100,-100,0.1,4000)
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xf0f2ec,0)
renderer.domElement.className="rendering";document.body.append(renderer.domElement);scene.add(pool.root)
const views=cases.map((c,i)=>{
  const card=document.createElement("article")
  card.innerHTML=`<div class="render-view" role="img" aria-label="${c.title}"></div><div class="caption"><h2>${c.title}</h2><p>${c.note}</p></div>`;grid.append(card)
  if(i===7){const b=document.createElement("button");b.textContent="Fire close-up";card.querySelector(".caption")!.append(b);b.onclick=()=>{card.classList.toggle("close-up");b.textContent=card.classList.contains("close-up")?"Back to overview":"Fire close-up";card.scrollIntoView({block:"start"})}}
  const handle=new ModelHandle(pool),anchor=new THREE.Group();anchor.position.x=i*200;anchor.add(handle.root);scene.add(anchor)
  return{card,handle,anchor,effects:null as StructureEffects|null,view:card.querySelector<HTMLElement>(".render-view")!}
})
let tier:Tier=2,yaw=0,strength=1,time=0,paused=false,last=0,frame=0
function build(){
  const asset=house(tier,0.28,"preview",{doors:{right:true,left:false}}),H=home.tiers[tier].height,half=(home.half+(tier>=2?1:0))*U*32*Math.SQRT2
  views.forEach(v=>{
    v.handle.use(`house/${tier}`,()=>asset);v.handle.effectBounds.set(half,H/Math.cos(Math.PI/6),0.31,1)
    v.effects?.dispose();v.effects=new StructureEffects(asset,H);v.anchor.add(v.effects.group)
  })
}
function stateAt(i:number){return surfaceState(Object.fromEntries(Object.entries(cases[i]!.state).map(([k,v])=>[k,v*strength])))}
function update(t:number){
  time=t;pool.time.value=t
  views.forEach((v,i)=>{const s=stateAt(i);v.handle.effects=s;v.effects!.set(s);v.effects!.update(t)})
  scene.updateMatrixWorld(true);pool.flush()
}
function aim(i:number,width:number,height:number){
  const H=home.tiers[tier].height,vertical=(H+28)/Math.cos(Math.PI/6)*1.35,heading=(45+yaw)*Math.PI/180,
    target=new THREE.Vector3(i*200,(H+8)/Math.cos(Math.PI/6)/2,0)
  camera.top=vertical/2;camera.bottom=-camera.top;camera.left=-vertical*width/height/2;camera.right=-camera.left
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(heading)*866,500,Math.cos(heading)*866));camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld()
  camera.getWorldDirection(pool.viewDirection).negate()
}
function render(){
  renderer.setSize(innerWidth,innerHeight,false);renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true)
  views.forEach((v,i)=>{
    const r=v.view.getBoundingClientRect();if(r.bottom<=0||r.top>=innerHeight)return
    aim(i,r.width,r.height)
    renderer.setViewport(r.left,innerHeight-r.bottom,r.width,r.height)
    renderer.setScissor(Math.max(0,r.left),Math.max(0,innerHeight-r.bottom),Math.min(innerWidth,r.right)-Math.max(0,r.left),Math.min(innerHeight,r.bottom)-Math.max(0,r.top))
    renderer.render(scene,camera)
  })
  root.querySelector("#stats")!.textContent=`1 active house mesh · ${views.length} instances · ${time.toFixed(1)} s`
  frame++
}
/** Captures the same GPU scene at a reproducible animation time. */
function capture(t=time,focus=false){
  update(t)
  const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d")!,width=focus?960:320,height=focus?600:300,viewHeight=focus?520:230
  canvas.width=960;canvas.height=focus?680:1000;ctx.fillStyle="#f0f2ec";ctx.fillRect(0,0,canvas.width,canvas.height)
  ctx.fillStyle="#3d4943";ctx.font="30px Georgia";ctx.fillText("Inkline Town / effects on one house",24,40)
  ctx.font="12px monospace";ctx.fillText(`${home.tiers[tier].title} · shared mesh · ${t.toFixed(2)} s`,24,65)
  renderer.setPixelRatio(1);renderer.setSize(width,viewHeight,false);renderer.setScissorTest(false)
  const indices=focus?[7]:views.map((_,i)=>i)
  indices.forEach((i,index)=>{
    aim(i,width,viewHeight);renderer.setViewport(0,0,width,viewHeight);renderer.render(scene,camera)
    const x=index%3*width,y=85+Math.floor(index/3)*height
    ctx.drawImage(renderer.domElement,x,y,width,viewHeight);ctx.fillStyle="#3d4943";ctx.font="19px Georgia";ctx.fillText(cases[i]!.title,x+20,y+viewHeight+30)
  })
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));render();return canvas.toDataURL()
}
root.querySelector<HTMLSelectElement>("select")!.onchange=e=>{tier=Number((e.target as HTMLSelectElement).value) as Tier;build();update(time);render()}
root.querySelector<HTMLInputElement>("#rotation")!.oninput=e=>{yaw=Number((e.target as HTMLInputElement).value);root.querySelector("#angle")!.textContent=`${yaw}°`;render()}
root.querySelector<HTMLInputElement>("#strength")!.oninput=e=>{strength=Number((e.target as HTMLInputElement).value)/100;root.querySelector("#amount")!.textContent=`${Math.round(strength*100)}%`;update(time);render()}
root.querySelector<HTMLButtonElement>("#pause")!.onclick=e=>{paused=!paused;(e.target as HTMLButtonElement).textContent=paused?"Resume animation":"Pause animation"}
root.querySelector<HTMLButtonElement>("#rear")!.onclick=()=>{yaw=yaw===180?0:180;root.querySelector<HTMLInputElement>("#rotation")!.value=String(yaw);root.querySelector("#angle")!.textContent=`${yaw}°`;render()}
let drag:{x:number;yaw:number}|null=null
grid.onpointerdown=e=>{if(!(e.target as HTMLElement).classList.contains("render-view"))return;drag={x:e.clientX,yaw};grid.setPointerCapture(e.pointerId)}
grid.onpointermove=e=>{if(drag){yaw=((drag.yaw+(e.clientX-drag.x)*0.5+540)%360)-180;render()}}
grid.onpointerup=grid.onpointercancel=()=>{drag=null}
build();update(0)
renderer.setAnimationLoop(now=>{const dt=last?Math.min((now-last)/1000,0.1):0;last=now;if(!paused)update(time+dt);render()})
Object.assign(window,{effectsLab:{capture,pause:()=>{paused=true},stats:()=>({tier,yaw,time,frame,templates:pool.stats().templates,activeTemplates:new Set(views.map(v=>v.handle.template)).size,models:pool.stats().models})}})
if(import.meta.hot)import.meta.hot.dispose(()=>{renderer.setAnimationLoop(null);views.forEach(v=>v.effects?.dispose());pool.dispose();renderer.dispose();renderer.domElement.remove()})
