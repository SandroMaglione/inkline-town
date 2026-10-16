/** Same isolated Playwright review workflow as check-town-models.ts. */
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright"

const executablePath=process.env.BROWSER_EXECUTABLE_PATH??["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})})
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1}),errors:string[]=[]
page.on("pageerror",e=>errors.push(e.message));page.on("console",e=>{if(e.type()==="error")errors.push(e.text())})
const output="output/inkline-3d/proportions"
await mkdir(output,{recursive:true})
try{
  await page.goto(`${process.env.GAME_BASE_URL??"http://127.0.0.1:5236"}/proportion-review.html`)
  await page.waitForFunction(()=>Boolean((window as any).proportionReview))
  const ids:string[]=await page.evaluate(()=>(window as any).proportionReview.ids)
  assert.equal(ids.length,45)
  const manifest:Array<{id:string;title:string;note:string;file:string}>=[]
  for(const id of ids){
    await page.getByLabel("Choose model",{exact:true}).selectOption(id)
    assert.equal(await page.evaluate(()=>(window as any).proportionReview.stats().pairs),2)
    const file=`${id}.png`
    await page.locator(".view").screenshot({path:`${output}/${file}`})
    manifest.push({id,title:await page.locator("h2").innerText(),note:await page.locator("#note").innerText(),file})
    await page.getByLabel("Model rotation",{exact:true}).fill("180")
    assert.equal(await page.evaluate(()=>(window as any).proportionReview.stats().yaw),180)
    if(["cottage","townhouse","hospital","chapel","smithy","firewatch","guildhall","cityhall","church","market-hall","scaffold-90"].includes(id))await page.locator(".view").screenshot({path:`${output}/${id}-rear.png`})
    await page.getByRole("button",{name:"Reset view",exact:true}).click()
  }
  await page.getByLabel("Choose model",{exact:true}).selectOption("citizen")
  await page.getByLabel("View elevation",{exact:true}).selectOption("0")
  await page.locator(".view").screenshot({path:`${output}/citizen-eye-level.png`})
  await page.getByRole("button",{name:"Reset view",exact:true}).click()
  await page.getByLabel("Choose model",{exact:true}).selectOption("cityhall")
  await page.getByLabel("One scale across all models",{exact:true}).check()
  await page.locator(".view").screenshot({path:`${output}/cityhall-town-scale.png`})
  const downloadEvent=page.waitForEvent("download")
  await page.getByRole("button",{name:"Save comparison",exact:true}).click()
  const download=await downloadEvent
  assert.equal(download.suggestedFilename(),"inkline-cityhall-before-after.png")
  await download.saveAs(`${output}/download.png`)
  await page.getByLabel("Model group",{exact:true}).selectOption("architecture")
  assert.equal(await page.getByLabel("Choose model",{exact:true}).locator("option").count(),36)
  await page.getByLabel("Find a model",{exact:true}).fill("hospital")
  assert.equal(await page.getByLabel("Choose model",{exact:true}).locator("option").count(),1)
  await page.getByLabel("Find a model",{exact:true}).fill("no-matches")
  assert.equal(await page.getByRole("button",{name:"Next model",exact:true}).isDisabled(),true)
  assert.equal(await page.locator("h2").innerText(),"No matching models")
  await page.getByLabel("Find a model",{exact:true}).fill("hospital")
  await page.reload();await page.waitForFunction(()=>Boolean((window as any).proportionReview))
  assert.equal(await page.getByLabel("Choose model",{exact:true}).inputValue(),"hospital")
  await page.setViewportSize({width:390,height:844})
  for(const id of ["cottage","townhouse","cityhall","scaffold-90"]){
    await page.getByLabel("Choose model",{exact:true}).selectOption(id)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${id}: phone overflow`)
    await page.locator(".view").screenshot({path:`${output}/${id}-phone.png`})
  }
  await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2))
  assert.deepEqual(errors,[])
  console.log(`Verified ${ids.length} frozen/live pairs, rotation, filtering, deep links, PNG download and phone layout; no browser errors`)
}finally{await browser.close()}
