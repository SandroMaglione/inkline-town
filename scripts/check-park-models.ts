/** Isolated screenshot review, following the repository's check:park workflow. */
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright"

const executablePath=process.env.BROWSER_EXECUTABLE_PATH??["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})})
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1}),errors:string[]=[]
page.on("pageerror",e=>errors.push(e.message));page.on("console",e=>{if(e.type()==="error")errors.push(e.text())})
const output="output/inkline-3d/parks"
await mkdir(output,{recursive:true})
try{
  await page.goto(`${process.env.GAME_BASE_URL??"http://127.0.0.1:5236"}/proportion-review.html?collection=parks`)
  await page.waitForFunction(()=>Boolean((window as any).proportionReview))
  const ids:string[]=await page.evaluate(()=>(window as any).proportionReview.ids)
  assert.equal(ids.length,12)
  assert.match(await page.locator(".footer").innerText(),/f4df9d5/)
  const manifest:Array<{id:string;title:string;note:string;file:string}>=[]
  for(const id of ids){
    await page.getByLabel("Choose model",{exact:true}).selectOption(id)
    assert.equal(await page.evaluate(()=>(window as any).proportionReview.stats().pairs),2)
    const file=`${id}.png`
    await page.locator(".view").screenshot({path:`${output}/${file}`})
    manifest.push({id,title:await page.locator("h2").innerText(),note:await page.locator("#note").innerText(),file})
    await page.getByLabel("Model rotation",{exact:true}).fill("180")
    assert.equal(await page.evaluate(()=>(window as any).proportionReview.stats().yaw),180)
    await page.locator(".view").screenshot({path:`${output}/${id}-rear.png`})
    await page.getByRole("button",{name:"Reset view",exact:true}).click()
  }
  await page.getByLabel("Choose model",{exact:true}).selectOption("park-built")
  await page.getByLabel("View elevation",{exact:true}).selectOption("50")
  await page.locator(".view").screenshot({path:`${output}/park-built-above.png`})
  await page.getByRole("button",{name:"Reset view",exact:true}).click()
  const downloadEvent=page.waitForEvent("download")
  await page.getByRole("button",{name:"Save comparison",exact:true}).click()
  const download=await downloadEvent
  assert.equal(download.suggestedFilename(),"inkline-park-built-before-after.png")
  await download.saveAs(`${output}/download.png`)
  await page.getByLabel("Model group",{exact:true}).selectOption("architecture")
  assert.equal(await page.getByLabel("Choose model",{exact:true}).locator("option").count(),5)
  await page.getByLabel("Find a model",{exact:true}).fill("fountain")
  assert.equal(await page.getByLabel("Choose model",{exact:true}).locator("option").count(),1)
  await page.reload();await page.waitForFunction(()=>Boolean((window as any).proportionReview))
  assert.equal(await page.getByLabel("Choose model",{exact:true}).inputValue(),"park-fountain")
  assert.equal(new URL(page.url()).searchParams.get("collection"),"parks")
  await page.setViewportSize({width:390,height:844})
  for(const id of ["park-lamp","park-statue","park-fountain","park-built"]){
    await page.getByLabel("Choose model",{exact:true}).selectOption(id)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${id}: phone overflow`)
    await page.locator(".view").screenshot({path:`${output}/${id}-phone.png`})
  }
  await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2))
  assert.deepEqual(errors,[])
  console.log(`Verified ${ids.length} park pairs, both sides, rotation, filtering, deep links, download and phone layout; no browser errors`)
}finally{await browser.close()}
