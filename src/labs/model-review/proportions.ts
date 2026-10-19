import * as THREE from "three"
import { buildAsset, vertex3 } from "../../render/three/assets/renderer.ts"
import type { InkAsset } from "../../render/three/assets/primitives.ts"
import { proportionModels, architectureIds } from "./proportion-models.ts"
import { parkReviewModels } from "./park-models.ts"
import "./proportions.css"

type Baseline = { revision: string; models: InkAsset[]; walker: InkAsset }
const parksMode=new URLSearchParams(location.search).get("collection")==="parks"
const notes: Record<string,string> = {
  cottage:"A person-sized timber door and taller walls; the one-cell footprint stays the same.",
  citizen:"Two floors share the same human clearance as the cottage, with windows above the new floor lines.",
  townhouse:"Three consistent residential floors and a proper entrance, within the original narrow plot.",
  townhall:"Closer floor spacing, smaller enclosed mass and a civic entrance with usable clearance.",
  guildhall:"Human-scaled windows and balcony details; the clock tower and steep roof remain landmarks.",
  cityhall:"More consistent wing windows and floor lines, finer steps and railings; the dome remains prominent.",
  warehouse:"Lower shed walls and loading equipment; the large cargo opening and yard remain.",
  depot:"The warehouse changes carry through; the gantry has clearance for the actual cargo.",
  granary:"Closer storey spacing, relocated ventilation and a hoist aligned with the upper loading level.",
  hospital:"Two public floors with consistent windows and entrances, retaining the ward footprint and lantern.",
  chapel:"A lower worship hall with tall lancet windows; the cupola retains its height above the roof.",
  healer:"A smaller surgery shell with its sign, jars and waiting bench placed at useful heights.",
  watchhouse:"A lower shell with viewing grilles and noticeboard aligned to the walker.",
  market:"A smaller shop shell, higher walk-under canopy and counter at working height.",
  "market-hall":"A usable upper floor above the arcade, with larger upper windows and consistent counter heights.",
  church:"Lower nave and lower-set lancet windows, with a taller entrance; the bell tower remains a landmark.",
  carpenter:"The 20-unit door stays; chairs now share the bench's seat height and tools remain within reach.",
  fishery:"A taller hut entrance and more clearance below its roof; the preparation bench stays at waist height.",
  bakery:"A lower bakehouse and shorter flue, a taller door and canopy, and a sign mounted clear of the canopy.",
  weaver:"A lower open shelter and a taller store door; the loom retains its working dimensions.",
  lumberjack:"More hut clearance above the timber door; smaller, reachable chopping tools.",
  forester:"More hut clearance above the door; the nursery bed and saplings keep their sizes.",
  farm:"A taller barn opening under a shallower roof; the silo and agricultural yard remain.",
  sheep:"A usable barn door, consistent fence and gate, and trough scaled to the sheep.",
  smokehouse:"Usable door clearance and a shorter flue; hanging fish and curing equipment remain accessible.",
  builder:"A usable shed entrance and adjusted workbench; the timber racks and open yard remain.",
  mill:"Closer floor spacing with a cargo entrance; the sails retain their own working clearance.",
  sawmill:"A lower shelter and reachable cutting mechanism, with clear space above the logs.",
  smithy:"A lower shelter, smaller forge opening and consistent workbench; the flue remains tall.",
  mine:"Headframe height retained; the tunnel, tools and cart are checked against the walker.",
  quarry:"A lower stonecutters' hut with a usable door; the rock face and lifting gear keep their height.",
  masonry:"The revised hut carries through, with finer crane members and consistent dressed blocks.",
  estate:"The revised barn carries through; a higher hay-shelter opening fits the same human reference.",
  ovenworks:"The revised bakehouse carries through; a shorter second flue preserves the upgrade's identity.",
  firewatch:"The lookout chamber is taller for standing headroom, with higher rails along the existing access route.",
  "fire-brigade":"The lookout gains standing headroom and higher rails; hose-cart handles rise to the firefighters' hands.",
  chair:"Seat height matches the shared bench, while the chair stays compact enough for furniture delivery.",
  chest:"Chest dimensions reviewed against the walker; compact storage and cargo remain appropriate.",
  bench:"Seat and back heights match the chair; the same generator supplies parks and waiting areas.",
  "cart-furniture-4":"The delivery cart keeps its walker-compatible handles; the load uses the revised shared furniture.",
  "barrow-furniture-4":"The barrow retains its own chassis; the load uses the revised shared furniture.",
  "crate-wood":"A smaller generic goods crate; the same change applies to every goods label. Large warehouse loads remain separate.",
  "park-lamp":"A taller cast-iron standard, stepped base and framed glass lantern, with a weather cap and small finial.",
  "park-statue":"A simple stone bust with broad carved shoulders, a plain head and a restrained stepped pedestal.",
  "park-fountain":"A larger moulded stone basin, individual coping stones and a raised bowl around the working nozzle.",
  "park-bench":"Four seat slats, a sloping three-slat back, iron frames and armrests. Seat height remains 4.5 units.",
  "park-border":"Stone edging, inset soil, stems, leaves and individual blossoms, shared with the town's planted borders.",
  "park-lawn":"Short turf and quieter grass tufts; suitable lawn cells beside walks gain occasional benches.",
  "park-flowers":"Raised planting edges and irregular groups of leafy flowers replace the flat square and regular dots.",
  "park-path":"A bordered gravel walk with small stones and clear connections to neighbouring walks and roads.",
  "park-square":"Larger staggered flagstones with thin mortar joints and a low, carefully finished edge.",
  "park-junction":"The gravel and edging join four street approaches without fencing off the entrances.",
  "park-sample":"The same 25-cell layout, with revised furnishings, planting, paving and seating. Park rules and costs are unchanged.",
  "park-built":"The same connected park between two streets, with running water and the revised furnishings at the walker scale.",
}

const root=document.querySelector<HTMLElement>("#proportions")!
root.innerHTML=`<header><div><div class="eyebrow">INKLINE TOWN / PROPORTION STUDY</div><h1>One town. One human scale.</h1><p>Every building and upgrade, plus shared furnishings and construction. The walker is unchanged. Both sides always use the same camera, ground position and zoom.</p></div><div><a href="/model-review.html?collection=handoff">Model catalogue ↗</a><p class="status" id="status">Loading the approved originals…</p></div></header><div class="layout"><aside><input aria-label="Find a model" type="search" placeholder="Find a model…"><select aria-label="Model group"><option value="all">All models</option><option value="architecture">Buildings & homes</option><option value="props">Props & construction</option></select><select aria-label="Choose model"></select><nav aria-label="All comparison models"></nav></aside><section><div class="row"><button id="previous" aria-label="Previous model">←</button><h2></h2><button id="next" aria-label="Next model">→</button></div><p class="meta" id="note"></p><div class="controls"><label>Turn <input aria-label="Model rotation" type="range" min="-180" max="180" value="0"><output>0°</output></label><label>Elevation <select aria-label="View elevation"><option value="30">Game angle</option><option value="0">Eye level</option><option value="50">From above</option></select></label><label>Zoom <input aria-label="Zoom" type="range" min=".7" max="2" step=".1" value="1"></label><label><input type="checkbox" id="town-scale"> One scale across all models</label><button id="reset">Reset view</button><button id="save">Save comparison</button></div><div class="view"><div class="captions"><span>Before · approved</span><span>After · revised</span></div><div class="divider"></div></div><div class="footer"><span id="dimensions"></span><br>Drag to turn both views together. Arrow buttons move through every model. Switch on one town scale to compare building sizes across the catalogue.<br>Before geometry is frozen at <code>a2845b4</code>. Changes are model geometry, not camera scaling.</div></section></div>`
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true})
if(parksMode){
  document.title="Inkline Town · Park before / after"
  root.querySelector(".eyebrow")!.textContent="INKLINE TOWN / PARK STUDY"
  root.querySelector("h1")!.textContent="A park worth visiting."
  root.querySelector("header p")!.textContent="Every park furnishing, planting and ground treatment, beside the approved originals. The walker and camera are unchanged."
  const groups=root.querySelectorAll("select[aria-label='Model group'] option")
  groups[1]!.textContent="Furnishings & planting";groups[2]!.textContent="Ground & assembled parks"
  root.querySelector(".footer code")!.textContent="f4df9d5"
  root.querySelector(".footer")!.lastChild!.textContent=". Changes are native model geometry."
}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xf0f2ec);renderer.setScissorTest(true)
const view=root.querySelector<HTMLElement>(".view")!;view.append(renderer.domElement)
const camera=new THREE.OrthographicCamera(-100,100,100,-100,.1,4000)
const search=root.querySelector<HTMLInputElement>("input[type=search]")!,group=root.querySelector<HTMLSelectElement>("select[aria-label='Model group']")!,picker=root.querySelector<HTMLSelectElement>("select[aria-label='Choose model']")!,nav=root.querySelector<HTMLElement>("nav")!
const rotation=root.querySelector<HTMLInputElement>("input[aria-label='Model rotation']")!,elevation=root.querySelector<HTMLSelectElement>("select[aria-label='View elevation']")!,zoom=root.querySelector<HTMLInputElement>("input[aria-label='Zoom']")!,townScale=root.querySelector<HTMLInputElement>("#town-scale")!
const geometryBounds=(a:InkAsset)=>new THREE.Box3().setFromPoints([...a.faces,...a.strokes].flatMap(f=>f.points.map(vertex3)))
let before:Baseline,after=parksMode?parkReviewModels():proportionModels(),filtered=after,selected=0,yaw=0,pitch=30,drag:number|null=null
let pair:Array<{scene:THREE.Scene;built:ReturnType<typeof buildAsset>;person:ReturnType<typeof buildAsset>}>=[],bounds=new THREE.Box3()
const clean=(a:InkAsset):InkAsset=>{const {smokeEffect,effects,...geometry}=a;if(!parksMode)delete geometry.fountains;return geometry}

function render(){
  if(!pair.length)return
  const {width,height}=view.getBoundingClientRect(),w=width/2
  renderer.setSize(width,height,false)
  const heading=(45+yaw)*Math.PI/180,angle=pitch*Math.PI/180
  const box=townScale.checked?(parksMode?new THREE.Box3(new THREE.Vector3(-180,-1,-180),new THREE.Vector3(180,70,180)):new THREE.Box3(new THREE.Vector3(-85,-1,-75),new THREE.Vector3(85,170,85))):bounds
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3())
  const horizontal=Math.abs(Math.cos(heading))*size.x+Math.abs(Math.sin(heading))*size.z
  const vertical=Math.cos(angle)*size.y+Math.abs(Math.sin(angle))*(Math.abs(Math.sin(heading))*size.x+Math.abs(Math.cos(heading))*size.z)
  const extent=Math.max(vertical,horizontal/(w/height))*1.18/Number(zoom.value)
  camera.top=extent/2;camera.bottom=-extent/2;camera.left=-extent*w/height/2;camera.right=-camera.left
  camera.position.copy(center).add(new THREE.Vector3(Math.sin(heading)*Math.cos(angle),Math.sin(angle),Math.cos(heading)*Math.cos(angle)).multiplyScalar(1000))
  camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld()
  pair.forEach(({scene,built,person},i)=>{
    renderer.setViewport(i*w,0,w,height);renderer.setScissor(i*w,0,w,height)
    for(const b of [built,person]){b.updateContours(camera);b.updateEffects(1.2)}
    renderer.render(scene,camera)
  })
  root.querySelector("output")!.textContent=`${yaw}°`
}
function select(id:string){
  const a=after.find(m=>m.id===id)!,b=before.models.find(m=>m.id===id)!
  if(!a||!b)return
  selected=filtered.findIndex(m=>m.id===id)
  pair.forEach(p=>{p.built.dispose();p.person.dispose()});pair=[];bounds=new THREE.Box3()
  const half=Math.max(a.footprint??1,b.footprint??1)/2*32*Math.SQRT2
  const personPosition=new THREE.Vector3(-half-6,0,half+3)
  for(const asset of [b,a]){
    const built=buildAsset(clean(asset),{batchFaces:true}),person=buildAsset(before.walker,{batchFaces:true}),scene=new THREE.Scene()
    person.group.position.copy(personPosition);scene.add(built.group,person.group)
    bounds.union(geometryBounds(asset));bounds.union(geometryBounds(before.walker).translate(personPosition))
    for(const f of parksMode?asset.fountains??[]:[])bounds.expandByPoint(vertex3([f.origin[0],f.origin[1],f.origin[2]+f.nozzle+7]))
    pair.push({scene,built,person})
  }
  root.querySelector("h2")!.textContent=a.title
  root.querySelector("#note")!.textContent=notes[id]??"Platform spacing, guard rails and ladder dimensions follow the same walker reference at every delivery stage."
  const top=(asset:InkAsset)=>Math.max(...[...asset.faces,...asset.strokes].flatMap(f=>f.points.map(p=>p[2])))
  const changed=JSON.stringify([a.faces,a.strokes])!==JSON.stringify([b.faces,b.strokes])
  root.querySelector("#dimensions")!.textContent=`${changed?"Updated":"Reviewed · retained"} · Geometry height ${top(b).toFixed(1)} → ${top(a).toFixed(1)} · Plot ${a.footprint??1} × ${a.footprint??1} cells · Walker 17.1, unchanged`
  picker.value=id;nav.querySelectorAll("button").forEach(el=>el.setAttribute("aria-current",String(el.dataset.id===id)))
  history.replaceState(null,"",`?${parksMode?"collection=parks&":""}model=${id}`);render()
}
function filter(){
  const q=search.value.toLowerCase()
  filtered=after.filter(a=>(group.value==="all"||(group.value==="architecture")===(parksMode?["park-lamp","park-statue","park-fountain","park-bench","park-border"].includes(a.id):architectureIds.includes(a.id)))&&`${a.title} ${a.id}`.toLowerCase().includes(q))
  picker.replaceChildren();nav.replaceChildren()
  for(const asset of filtered){
    const option=document.createElement("option");option.value=asset.id;option.textContent=asset.title;picker.append(option)
    const button=document.createElement("button");button.textContent=asset.title;button.dataset.id=asset.id;button.onclick=()=>select(asset.id);nav.append(button)
  }
  for(const id of ["previous","next"])root.querySelector<HTMLButtonElement>(`#${id}`)!.disabled=!filtered.length
  picker.disabled=!filtered.length
  if(filtered.length)select(filtered[0]!.id)
  else{
    pair.forEach(p=>{p.built.dispose();p.person.dispose()});pair=[]
    renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true)
    root.querySelector("h2")!.textContent="No matching models"
    root.querySelector("#note")!.textContent="Try a different name or model group."
    root.querySelector("#dimensions")!.textContent=""
  }
}
rotation.oninput=()=>{yaw=Number(rotation.value);render()};elevation.onchange=()=>{pitch=Number(elevation.value);render()};zoom.oninput=render;townScale.onchange=render
search.oninput=filter;group.onchange=filter;picker.onchange=()=>select(picker.value)
root.querySelector<HTMLButtonElement>("#previous")!.onclick=()=>select(filtered[(selected-1+filtered.length)%filtered.length]!.id)
root.querySelector<HTMLButtonElement>("#next")!.onclick=()=>select(filtered[(selected+1)%filtered.length]!.id)
root.querySelector<HTMLButtonElement>("#reset")!.onclick=()=>{yaw=0;pitch=30;rotation.value="0";elevation.value="30";zoom.value="1";townScale.checked=false;render()}
root.querySelector<HTMLButtonElement>("#save")!.onclick=()=>{const a=document.createElement("a");a.download=`inkline-${picker.value}-before-after.png`;a.href=renderer.domElement.toDataURL();a.click()}
renderer.domElement.onpointerdown=e=>{drag=e.clientX;renderer.domElement.setPointerCapture(e.pointerId)}
renderer.domElement.onpointermove=e=>{if(drag===null)return;yaw=Math.max(-180,Math.min(180,Math.round(yaw+(e.clientX-drag)*.5)));drag=e.clientX;rotation.value=String(yaw);render()}
renderer.domElement.onpointerup=()=>drag=null
new ResizeObserver(render).observe(view)
async function start(){
  const requested=new URLSearchParams(location.search).get("model")
  const response=await fetch(`/model-review/${parksMode?"parks":"proportions"}-before.json.gz`)
  if(!response.ok)throw new Error(`Baseline ${response.status}`)
  const bytes=await response.arrayBuffer()
  // Dev servers serve .gz verbatim. Some hosts decompress it automatically.
  const raw=new Uint8Array(bytes)
  before=JSON.parse(raw[0]===31&&raw[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text():new TextDecoder().decode(raw))
  if(before.models.length!==after.length||after.some(a=>!before.models.some(b=>b.id===a.id)))throw new Error("Comparison catalogue does not match the frozen baseline")
  filter();if(requested&&after.some(a=>a.id===requested))select(requested)
  root.querySelector("#status")!.textContent=parksMode?"12 park comparisons · unchanged walker":`${architectureIds.length} building appearances · ${after.length-architectureIds.length} shared examples`
  Object.assign(window,{proportionReview:{ids:after.map(a=>a.id),select,render,capture:()=>renderer.domElement.toDataURL(),stats:()=>({id:picker.value,before:before.revision,yaw,pitch,pairs:pair.length})}})
}
start().catch(error=>{root.querySelector("#status")!.textContent=String(error);root.querySelector("#status")!.classList.add("error");console.error(error)})
