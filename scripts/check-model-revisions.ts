import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright"
import { inkAssets } from "../src/render/three/assets/assets.ts"

const executablePath=process.env.BROWSER_EXECUTABLE_PATH??["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})})
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:2}),errors:string[]=[],output="output/inkline-3d/model-revisions"
page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)})
await mkdir(output,{recursive:true})
try{
  await page.goto(`${process.env.GAME_BASE_URL??"http://127.0.0.1:5232"}/asset-lab.html?asset=problem-marker`)
  await page.waitForFunction(()=>Boolean((window as any).inkLab))
  for(const yaw of [0,180]){
    await page.evaluate(y=>(window as any).inkLab.rotate(y),yaw)
    const image=await page.evaluate(()=>(window as any).inkLab.capture("model"))
    await writeFile(`${output}/marker-${yaw}.png`,Buffer.from(image.split(",")[1],"base64"))
    const glyph=await page.evaluate(async data=>{
      const image=new Image();image.src=data;await image.decode();const c=document.createElement("canvas");c.width=image.width;c.height=image.height;const ctx=c.getContext("2d")!;ctx.drawImage(image,0,0)
      const pixels=ctx.getImageData(0,0,c.width,c.height).data,red=(i:number)=>pixels[i]!>150&&pixels[i+1]!<130&&pixels[i+2]!<120&&pixels[i+3]!>100
      let l=c.width,r=0,t=c.height,b=0
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(red((y*c.width+x)*4)){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y)}
      let inside=0
      for(let y=Math.ceil(t+(b-t)*0.2);y<b-(b-t)*0.2;y++)for(let x=Math.ceil(l+(r-l)*0.2);x<r-(r-l)*0.2;x++)if(red((y*c.width+x)*4))inside++
      return inside
    },image)
    assert.ok(glyph>100,`The exclamation mark must remain visible at ${yaw}°, not just its red border`)
  }
  await page.evaluate(()=>(window as any).inkLab.select("smoke"))
  const first=await page.evaluate(()=>(window as any).inkLab.captureEffect(0)),next=await page.evaluate(()=>(window as any).inkLab.captureEffect(1))
  assert.notEqual(first,next,"Smoke must animate in the actual GPU rendering")
  await writeFile(`${output}/smoke.png`,Buffer.from(next.split(",")[1],"base64"))
  const count=await page.evaluate(()=>{const lab=(window as any).inkLab;for(const a of lab.assets){lab.select(a.id);assertGeometry(lab.stats().triangles,a.id)}function assertGeometry(n:number,id:string){if(n<=0)throw new Error(`${id}: empty render`)}return lab.assets.length})
  assert.equal(count,inkAssets.length)
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({catalogueModels:count,markerViews:[0,180],animatedSmoke:true,browserErrors:errors}))
}finally{await browser.close()}
