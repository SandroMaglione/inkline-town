import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir,writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { chromium } from "playwright"
declare global { interface Window { effectsLab:{capture:(t:number,focus?:boolean)=>string;pause:()=>void;stats:()=>{tier:number;yaw:number;time:number;frame:number;templates:number;activeTemplates:number;models:number}} } }
const executablePath=process.env.BROWSER_EXECUTABLE_PATH??["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})}),page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:2}),errors:string[]=[],output="output/inkline-3d/house-effects"
page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())})
await mkdir(`${output}/frames`,{recursive:true})
await mkdir(`${output}/fire-frames`,{recursive:true})
try{
  await page.goto(`${process.env.GAME_BASE_URL??"http://127.0.0.1:5232"}/effects-lab.html`)
  await page.waitForFunction(()=>window.effectsLab?.stats().frame>2)
  await page.evaluate(()=>window.effectsLab.pause())
  for(const tier of [1,2,3]){
    await page.getByLabel("House tier").selectOption(String(tier))
    const data=await page.evaluate(()=>window.effectsLab.capture(2.0))
    await writeFile(`${output}/tier-${tier}.png`,Buffer.from(data.split(",")[1]!,"base64"))
  }
  await page.getByLabel("House tier").selectOption("2")
  const stats=await page.evaluate(()=>window.effectsLab.stats())
  assert.equal(stats.models,8); assert.ok(stats.templates<=3)
  assert.equal(stats.activeTemplates,1)
  assert.equal(await page.locator("canvas.rendering").evaluate(c=>c.getBoundingClientRect().width),1440,"Canvas CSS size must not grow with device pixel ratio")
  const original=await page.evaluate(()=>window.effectsLab.capture(2))
  await page.getByLabel("Effect strength").fill("0")
  const clean=await page.evaluate(()=>window.effectsLab.capture(2));assert.notEqual(clean,original)
  await page.getByLabel("Effect strength").fill("100")
  const t0=await page.evaluate(()=>window.effectsLab.capture(0)),t1=await page.evaluate(()=>window.effectsLab.capture(1))
  assert.notEqual(t0,t1,"Animation must change the actual rendered pixels")
  await page.getByRole("button",{name:"See the back",exact:true}).click()
  const back=await page.evaluate(()=>window.effectsLab.capture(2));await writeFile(`${output}/rear.png`,Buffer.from(back.split(",")[1]!,"base64"))
  await page.getByRole("button",{name:"See the back",exact:true}).click()
  for(let i=0;i<150;i++){
    const data=await page.evaluate(t=>window.effectsLab.capture(t),i/30)
    await writeFile(`${output}/frames/${String(i).padStart(4,"0")}.png`,Buffer.from(data.split(",")[1]!,"base64"))
    const fire=await page.evaluate(t=>window.effectsLab.capture(t,true),i/30)
    await writeFile(`${output}/fire-frames/${String(i).padStart(4,"0")}.png`,Buffer.from(fire.split(",")[1]!,"base64"))
    if(i===60)await writeFile(`${output}/fire-close-up.png`,Buffer.from(fire.split(",")[1]!,"base64"))
  }
  execFileSync("ffmpeg",["-y","-loglevel","error","-framerate","30","-i",`${output}/frames/%04d.png`,"-c:v","libx264","-crf","19","-pix_fmt","yuv420p","-movflags","+faststart",`${output}/house-effects.mp4`])
  execFileSync("ffmpeg",["-y","-loglevel","error","-framerate","30","-i",`${output}/fire-frames/%04d.png`,"-c:v","libx264","-crf","19","-pix_fmt","yuv420p","-movflags","+faststart",`${output}/fire-close-up.mp4`])
  await page.evaluate(()=>scrollTo(0,250));await page.screenshot({path:`${output}/preview.png`})
  await page.setViewportSize({width:390,height:844})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:`${output}/phone.png`})
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({models:stats.models,templates:stats.templates,tiers:[1,2,3],animationFrames:150,video:`${output}/house-effects.mp4`,browserErrors:errors}))
}finally{await browser.close()}
