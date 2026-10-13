import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir,writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { chromium } from "playwright"

declare global {interface Window {parkLab:{capture:(time?:number,width?:number,height?:number)=>string;pause:()=>void;stats:()=>{view:string;yaw:number;pitch:number;time:number;frames:number;fountains:number;parkCells:number;entrances:number;triangles:number}}}}
const executablePath=process.env.BROWSER_EXECUTABLE_PATH??["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})}),page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:2})
const output="output/inkline-3d/park-review",errors:string[]=[]
page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)})
await mkdir(`${output}/frames`,{recursive:true})
const save=async(name:string,time=2)=>{const data=await page.evaluate(t=>window.parkLab.capture(t),time);await writeFile(`${output}/${name}.png`,Buffer.from(data.split(",")[1]!,"base64"));return data}
try{
  await page.goto(`${process.env.GAME_BASE_URL??"http://127.0.0.1:5232"}/park-lab.html`)
  await page.waitForFunction(()=>window.parkLab?.stats().frames>2)
  await page.evaluate(()=>window.parkLab.pause())
  const stats=await page.evaluate(()=>window.parkLab.stats())
  assert.equal(stats.parkCells,25);assert.equal(stats.entrances,2);assert.equal(stats.fountains,1);assert.ok(stats.triangles>0)
  assert.equal(await page.locator(".stage canvas").evaluate(c=>Math.round(c.getBoundingClientRect().width)),await page.locator(".stage").evaluate(c=>c.clientWidth),"Canvas CSS size must fit at high DPI")
  const front=await save("park")
  await page.getByRole("button",{name:"See the back",exact:true}).click();assert.notEqual(await save("park-rear"),front)
  await page.getByRole("button",{name:"Reset view",exact:true}).click()
  await page.getByLabel("Park elevation").selectOption("55");await save("park-above")
  await page.getByRole("button",{name:"Reset view",exact:true}).click()
  await page.getByRole("button",{name:"Statue close-up",exact:true}).click();await save("statue")
  await page.getByRole("button",{name:"See the back",exact:true}).click();await save("statue-rear")
  await page.getByRole("button",{name:"Reset view",exact:true}).click()
  await page.getByRole("button",{name:"Fountain close-up",exact:true}).click()
  const a=await save("fountain",0),b=await save("fountain",1)
  assert.notEqual(a,b,"Actual rendered fountain pixels must animate")
  const now=await page.evaluate(()=>window.parkLab.stats())
  await page.waitForFunction(f=>window.parkLab.stats().frames>f+4,now.frames)
  assert.equal(await page.evaluate(()=>window.parkLab.stats().time),now.time,"Pausing must freeze the water")
  for(let i=0;i<150;i++){
    const image=await page.evaluate(t=>window.parkLab.capture(t,800,650),i/30)
    await writeFile(`${output}/frames/${String(i).padStart(4,"0")}.png`,Buffer.from(image.split(",")[1]!,"base64"))
  }
  execFileSync("ffmpeg",["-y","-loglevel","error","-framerate","30","-i",`${output}/frames/%04d.png`,"-c:v","libx264","-crf","19","-pix_fmt","yuv420p","-movflags","+faststart",`${output}/fountain.mp4`])
  await page.getByRole("button",{name:"Built park",exact:true}).click();await page.screenshot({path:`${output}/page.png`})
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${output}/phone.png`})
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({parkCells:stats.parkCells,entrances:stats.entrances,fountains:stats.fountains,videoFrames:150,phoneLayout:true,browserErrors:errors}))
}finally{await browser.close()}
