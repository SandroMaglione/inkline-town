/** Phone-sized checks against the real local game: the town picker's found
 * button is on screen, and the folded HUD opens and closes. Start pnpm dev
 * first. BROWSER_EXECUTABLE_PATH selects an installed browser, as in
 * check-browser.ts. Screenshots go to output/inkline-3d/phone-check.
 */
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { chromium } from "playwright"

const executable=process.env.BROWSER_EXECUTABLE_PATH??["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})})
const output="output/inkline-3d/phone-check"
await mkdir(output,{recursive:true})
const errors:Array<string>=[]
try {
  for (const [name,width,height] of [["portrait",390,720],["landscape",762,330]] as const) {
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true})
    page.on("pageerror",e=>errors.push(`${name}: ${e.message}`))
    await page.goto(process.env.GAME_BASE_URL??"http://127.0.0.1:5232")
    await page.waitForFunction(()=>"town" in window)
    // The found button sits inside the screen without scrolling: it is pinned to the bottom.
    const found=page.getByRole("button",{name:"Start new",exact:true})
    const box=(await found.boundingBox())!
    assert.ok(box.y>=0&&box.y+box.height<=height,`${name}: the found button is off screen`)
    await page.screenshot({path:`${output}/${name}-picker.png`})
    await page.getByRole("button",{name:"small",exact:true}).click()
    await found.click()
    await page.waitForTimeout(1500)
    // Folded: no goods row, no system bar, no overlay list.
    for (const hidden of [".hud .stock",".system",".views"]) assert.equal(await page.locator(hidden).isVisible(),false,`${name}: ${hidden} is out`)
    await page.screenshot({path:`${output}/${name}-game.png`})
    for (const [button,shows] of [[".goods-chip",".hud .stock"],[".toolbar .more",".system"],[".fold-buttons button:last-child",".views"]] as const) {
      await page.locator(button).click()
      assert.ok(await page.locator(shows).isVisible(),`${name}: ${button} opens ${shows}`)
      await page.locator(button).click()
      assert.equal(await page.locator(shows).isVisible(),false,`${name}: ${button} folds ${shows}`)
    }
    // Everything fits the width: nothing scrolls sideways.
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${name}: the page scrolls sideways`)
    await page.close()
  }
  assert.deepEqual(errors,[])
  console.log("phone checks passed")
} finally {
  await browser.close()
}
