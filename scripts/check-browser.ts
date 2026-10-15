/** End-to-end checks against the real local game, in an isolated browser.
 * Start pnpm dev first. BROWSER_EXECUTABLE_PATH selects an installed browser;
 * otherwise use Playwright Chromium (pnpm exec playwright install chromium).
 */
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir,readFile,writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { chromium } from "playwright"
import type { UiValue } from "../src/ui.ts"
import type { GameScene } from "../src/render3d/scene.ts"
import type { Snapshot } from "../src/sim/headless.ts"

declare global {
  interface Window {
    town:{ui:UiValue;view:GameScene;advance:(seconds:number)=>void;runtime:{snapshot:()=>Snapshot}}
  }
}
const executable=process.env.BROWSER_EXECUTABLE_PATH??["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})})
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1})
const errors:Array<string>=[]
page.on("pageerror",e=>errors.push(e.message))
page.on("console",m=>{if(m.type()==="error")errors.push(m.text())})
const output="output/inkline-3d/game-check"
await mkdir(output,{recursive:true})
const facts:Record<string,unknown>={}
const frames=async()=>page.waitForFunction(()=>window.town?.view.stats().frames>3)
const snapshot=()=>page.evaluate(()=>window.town.runtime.snapshot())
const entities=async(kind:string)=>(await snapshot()).entities.filter(e=>kind in e.components)
const point=async(x:number,y:number,z=0)=>page.evaluate(([x,y,z])=>window.town.view.project(x!,y!,z!),[x,y,z])
const clickGrid=async(x:number,y:number,z=0)=>{const p=await point(x,y,z);await page.mouse.click(p.x,p.y)}
const dragGrid=async(a:[number,number],b:[number,number])=>{const p=await point(...a),q=await point(...b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:8});await page.mouse.up()}
const tool=async(name:string)=>page.locator(".toolbar button").filter({hasText:new RegExp("^"+name)}).click()
const capture=async(name:string)=>{
  const frame=await page.evaluate(()=>window.town.view.stats().frames)
  await page.waitForFunction(f=>window.town.view.stats().frames>f+20,frame)
  await page.screenshot({path:`${output}/${name}.png`})
  const data=await page.evaluate(()=>window.town.view.capture())
  await writeFile(`${output}/${name}.webp`,Buffer.from(data.split(",")[1]!,"base64"))
}
try {
  await page.goto(process.env.GAME_BASE_URL??"http://127.0.0.1:5232")
  await page.waitForFunction(()=>window.town)
  await page.getByRole("button",{name:"small",exact:true}).click()
  await page.getByRole("button",{name:"Start new",exact:true}).click()
  await page.waitForFunction(()=>!window.town.ui.founding)
  await page.locator(".toolbar .pause").click()
  const hall=(await entities("Town/TownHall"))[0]!,tile=hall.components["Town/Tile"]
  await page.keyboard.press("e")
  await clickGrid(tile.x+1.5,tile.y+1.5,48)
  await page.waitForFunction(id=>window.town.ui.selected===id,hall.id)
  assert.equal((await page.evaluate(()=>window.town.ui.panel))?.type,"building")
  facts.rotatedSelection=true
  await tool("road")
  await dragGrid([tile.x+5.5,tile.y+1.5],[tile.x+8.5,tile.y+1.5])
  await page.waitForFunction(([x,y])=>[6,7,8].every(dx=>window.town.runtime.snapshot().entities.some(e=>e.components["Town/Road"]&&e.components["Town/Tile"].x===x!+dx&&e.components["Town/Tile"].y===y!+1)),[tile.x,tile.y])
  facts.rotatedRoadDrag=true
  await tool("homes")
  await dragGrid([tile.x+5.5,tile.y+2.5],[tile.x+8.5,tile.y+2.5])
  await page.waitForFunction(()=>window.town.runtime.snapshot().entities.filter(e=>e.components["Town/House"]).length===4)
  facts.rotatedHomeDrag=true
  await tool("build")
  await page.locator(".panel .option").filter({has:page.locator(".name",{hasText:"lumberjack"})}).click()
  await clickGrid(tile.x+7,tile.y)
  await page.waitForFunction(()=>window.town.runtime.snapshot().entities.some(e=>e.components["Town/Building"]?.kind==="lumberjack"))
  const lumber=(await entities("Town/Building")).find(e=>e.components["Town/Building"].kind==="lumberjack")!
  assert.deepEqual(lumber.components["Town/Tile"],{x:tile.x+6,y:tile.y-1,size:2})
  facts.rotatedBuildingPlacement=true
  await capture("construction")
  await page.evaluate(()=>window.town.advance(90))
  await page.waitForFunction(()=>window.town.ui.stats!.settlers>0)
  assert.ok((await entities("Town/House")).some(e=>!("Town/Site" in e.components)))
  facts.liveConstruction=true
  await tool("select")
  await page.keyboard.press("e")
  const lt=lumber.components["Town/Tile"]
  await clickGrid(lt.x+1,lt.y+1,16)
  await page.waitForFunction(id=>window.town.ui.selected===id,lumber.id)
  const pauseWork=page.getByRole("button",{name:"Pause work",exact:true})
  await pauseWork.click()
  await page.waitForFunction(id=>!!window.town.runtime.snapshot().entities.find(e=>e.id===id)?.components["Town/Paused"],lumber.id)
  await page.getByRole("button",{name:"Resume work",exact:true}).click()
  await page.waitForFunction(id=>!("Town/Paused" in window.town.runtime.snapshot().entities.find(e=>e.id===id)!.components),lumber.id)
  facts.buildingPauseResume=true
  await page.locator(".panel .close").click()
  await page.getByRole("button",{name:"save",exact:true}).click()
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("inkline-town/save/manual")!))
  await tool("bulldoze")
  await clickGrid(lt.x+1,lt.y+1,16)
  await page.waitForFunction(id=>!window.town.runtime.snapshot().entities.some(e=>e.id===id),lumber.id)
  facts.rotatedBulldozing=true
  await page.getByRole("button",{name:"load",exact:true}).click()
  await page.getByRole("button",{name:"Load without saving",exact:true}).click()
  await page.waitForFunction(id=>window.town.runtime.snapshot().entities.some(e=>e.id===id),lumber.id)
  await page.waitForFunction(()=>window.town.view.stats().nodes>0)
  assert.deepEqual(await snapshot(),saved.world)
  facts.saveLoadUnchangedFormat=true
  const restoredNodes=await page.evaluate(()=>window.town.view.stats().nodes)
  const renderableCount=(await snapshot()).entities.filter(e=>["Town/Building","Town/House","Town/Tree","Town/Rock","Town/Field","Town/Figure"].some(c=>c in e.components)).length
  assert.ok(restoredNodes>=renderableCount,`Restored ${restoredNodes} nodes for ${renderableCount} renderable entities`)
  facts.restoreRebuildsScene=true
  await capture("live-town")
  await page.getByRole("button",{name:"new town",exact:true}).click()
  await page.getByRole("button",{name:"Choose new land without saving",exact:true}).click()
  await page.getByRole("button",{name:"large",exact:true}).click()
  await page.getByRole("button",{name:"rich",exact:true}).click()
  await page.getByRole("button",{name:"Start new",exact:true}).click()
  await page.waitForFunction(()=>!window.town.ui.founding&&window.town.ui.stats?.charter.size==="large")
  assert.equal((await entities("Town/House")).length,0)
  assert.equal((await entities("Town/TownHall")).length,1)
  await page.locator(".toolbar .pause").click()
  await page.waitForFunction(()=>window.town.view.stats().frames>20)
  facts.newTownClearsOldScene=true
  facts.largeIsland=await page.evaluate(()=>window.town.view.stats())
  await capture("large-island")
  const fixture=process.env.GAME_SAVE_PATH??`${output}/fixture/large-rich-24757-20min.json`
  if (!existsSync(fixture)) execFileSync(process.execPath,["scripts/balance.ts","--seeds","1","--from","3","--size","large","--land","rich","--term","45","--snapshot","20","--out",`${output}/fixture`],{stdio:"pipe"})
  const grown=JSON.parse(await readFile(fixture,"utf8"))
  await page.evaluate(save=>{
    localStorage.removeItem("inkline-town/save/auto")
    localStorage.setItem("inkline-town/save/manual",JSON.stringify({...save,savedAt:Date.now()}))
  },grown)
  await page.getByRole("button",{name:"load",exact:true}).click()
  await page.getByRole("button",{name:"Load without saving",exact:true}).click()
  await page.waitForFunction(()=>window.town.ui.stats!.settlers>100)
  // The guide puts away what the bot's town has already done on the page's first frame; the rest loads exactly as saved.
  const withoutGuide=(w:Snapshot)=>({...w,resources:{...w.resources,"Town/Guide":null}})
  const loaded=await snapshot()
  assert.deepEqual(withoutGuide(loaded),withoutGuide(grown.world))
  assert.ok(["homes","fishery","market"].every(id=>loaded.resources["Town/Guide"].done.includes(id)),"The guide puts away what the town has done")
  facts.guide=loaded.resources["Town/Guide"]
  const settledFrame=await page.evaluate(()=>window.town.view.stats().frames)
  await page.waitForFunction(start=>window.town.view.stats().frames>start+60,settledFrame)
  facts.populatedTown=await page.evaluate(()=>window.town.view.stats())
  assert.ok((await entities("Town/Figure")).length>0,"Live simulated carriers must render")
  const grownHall=(await entities("Town/TownHall"))[0]!,ht=grownHall.components["Town/Tile"]
  await page.evaluate(([x,y])=>window.town.view.focus(x!,y!),[ht.x+1.5,ht.y+1.5])
  await capture("populated-town")
  for (let angle=0;angle<8;angle++) {
    await page.keyboard.press("e")
    await clickGrid(ht.x+1.5,ht.y+1.5,48)
    await page.waitForFunction(id=>window.town.ui.selected===id,grownHall.id)
    await page.locator(".panel .close").click()
  }
  facts.selectionAllEightAngles=true
  await page.keyboard.press("e")
  await capture("populated-rotated")
  await page.getByRole("button",{name:"4×",exact:true}).click()
  const before=await snapshot()
  const positions=await page.evaluate(()=>[...window.town.view.nodes].filter(n=>n.constructor.name==="WalkerView").map(n=>n.group.position.toArray()))
  await page.waitForFunction(t=>window.town.runtime.snapshot().resources["Town/Time"].tick>t+30,before.resources["Town/Time"].tick)
  await page.locator(".toolbar .pause").click()
  const paused=await snapshot(),pf=await page.evaluate(()=>window.town.view.stats().frames)
  await page.waitForFunction(f=>window.town.view.stats().frames>f+10,pf)
  assert.equal((await snapshot()).resources["Town/Time"].tick,paused.resources["Town/Time"].tick)
  assert.notDeepEqual(await page.evaluate(()=>[...window.town.view.nodes].filter(n=>n.constructor.name==="WalkerView").map(n=>n.group.position.toArray())),positions)
  facts.speedAndPause=true
  facts.liveWalkerMovement=true
  await page.setViewportSize({width:390,height:844})
  // A phone has no camera bar (pinch zooms and turns): recentre from the menu.
  await page.locator(".toolbar .more").click()
  await page.getByRole("button",{name:"recentre",exact:true}).click()
  await page.keyboard.press("q")
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll(".toolbar,.hud,.fold-buttons")].some(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1})),false)
  facts.phoneViewport=true
  await tool("homes")
  const touch=await page.context().newCDPSession(page),beforeTouch=await snapshot(),cameraBefore=await page.evaluate(()=>window.town.view.stats())
  // Below the ticker (the guide fills its top half on a phone), on the map itself.
  await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:130,y:540,id:1}]})
  await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:130,y:540,id:1},{x:230,y:580,id:2}]})
  await touch.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:100,y:510,id:1},{x:290,y:620,id:2}]})
  await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]})
  const tf=await page.evaluate(()=>window.town.view.stats().frames)
  await page.waitForFunction(f=>window.town.view.stats().frames>f+5,tf)
  assert.deepEqual(await snapshot(),beforeTouch,"Pinching a build tool must never commit an edit")
  const cameraAfter=await page.evaluate(()=>window.town.view.stats())
  assert.ok(cameraAfter.zoom>cameraBefore.zoom)
  assert.notEqual(cameraAfter.heading,cameraBefore.heading)
  facts.touchPinchRotateDoesNotBuild=true
  await tool("select")
  await page.locator(".toolbar .more").click()
  await page.getByRole("button",{name:"recentre",exact:true}).click()
  await capture("phone")
  await page.setViewportSize({width:1440,height:1000})
  // A saved term that has ended still opens the existing reckoning UI.
  const ended=structuredClone(grown)
  ended.world.resources["Town/Fate"]={...ended.world.resources["Town/Fate"],state:"over",reason:"The term has ended.",at:ended.world.resources["Town/Time"].tick}
  await page.evaluate(save=>localStorage.setItem("inkline-town/save/manual",JSON.stringify({...save,savedAt:Date.now()})),ended)
  await page.getByRole("button",{name:"load",exact:true}).click()
  await page.getByRole("button",{name:"Load without saving",exact:true}).click()
  await page.getByRole("button",{name:"Next term",exact:true}).waitFor({state:"visible"})
  await page.getByRole("button",{name:"Retire: found a new town",exact:true}).waitFor({state:"visible"})
  assert.equal(await page.evaluate(()=>window.town.ui.stats!.fate.state),"over")
  facts.reckoning=true
  // Sharing: the card, then a link that opens the town in another browser (a phone), which can play on from there.
  await page.getByRole("button",{name:"Share the town",exact:true}).click()
  const card=page.locator(".dialog.share img.card-preview")
  await card.waitFor({state:"visible"})
  assert.deepEqual(await card.evaluate(async(img:HTMLImageElement)=>{await img.decode();return [img.naturalWidth,img.naturalHeight]}),[2400,1260])
  await page.getByRole("button",{name:"Make a link",exact:true}).click()
  const link=page.locator(".dialog.share .link-row input")
  await link.waitFor({state:"visible"})
  const url=await link.inputValue()
  assert.match(url,/\/t\/[a-z2-9]{8}$/)
  const unfurl=await (await fetch(url)).text()
  assert.ok(unfurl.includes(`<meta property="og:image" content="${new URL(url).origin}/api/towns/`),"A shared link unfurls to its picture")
  const picture=await fetch(unfurl.match(/property="og:image" content="([^"]+)"/)![1]!)
  assert.equal(picture.headers.get("content-type"),"image/jpeg")
  const sharedWorld=await snapshot()
  const visitor=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true})
  visitor.on("pageerror",e=>errors.push(`visitor: ${e.message}`))
  await visitor.goto(url)
  await visitor.waitForFunction(()=>document.body.classList.contains("visiting"),undefined,{timeout:60000})
  const visited=await visitor.evaluate(()=>window.town.runtime.snapshot())
  assert.deepEqual(visited.entities,sharedWorld.entities,"The visitor sees the town as it was shared")
  assert.deepEqual(visited.resources,sharedWorld.resources)
  assert.ok(await visitor.locator(".toolbar").isHidden(),"A visitor's building tools are put away")
  await visitor.getByRole("button",{name:"Look at the town",exact:true}).click()
  await visitor.getByRole("button",{name:"Play from here",exact:true}).click()
  assert.equal(new URL(visitor.url()).pathname,"/")
  assert.ok(await visitor.locator(".toolbar").isVisible(),"Playing on brings the tools back")
  await visitor.screenshot({path:`${output}/shared-visitor.png`})
  await visitor.close()
  facts.sharedLink=url
  assert.deepEqual(errors,[])
  await writeFile(`${output}/results.json`,JSON.stringify(facts,null,2))
  console.log(JSON.stringify(facts,null,2))
}catch(error){await page.screenshot({path:`${output}/failure.png`});console.error({errors,facts});throw error}
finally{await browser.close()}
