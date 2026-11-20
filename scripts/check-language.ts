/** The language, against the real local game: the founding screen and the
 * system bar both open the language's dialog, which lists every language by
 * its own name; choosing another keeps the choice, brings the page back in
 * it, and carries on with the town in play, looking where the mayor was
 * looking; and what the town said before reads in the new language too.
 * Start pnpm dev first. BROWSER_EXECUTABLE_PATH selects an installed
 * browser, as in check-browser.ts. Screenshots go to
 * output/inkline-3d/language-check.
 */
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { chromium, type Page } from "playwright"

import type { Event } from "../src/game/said.ts"
import { en, languageName, load, locales, say, type Catalog, type Locale } from "../src/i18n/index.ts"
import type { CameraView } from "../src/render/pixi3d/scene.ts"

// `window.town`, as the dev page hands it to the console, is declared in check-browser.ts.

const executable=process.env.BROWSER_EXECUTABLE_PATH??["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})})
const output="output/inkline-3d/language-check"
await mkdir(output,{recursive:true})
const errors:Array<string>=[]
const base=process.env.GAME_BASE_URL??"http://127.0.0.1:5232"

/** The page says it is in a language: its tag, its catalog, and a label only that language's catalog has. */
const reads=async(page:Page,t:Catalog,what:string)=>{
  assert.equal(await page.evaluate(()=>document.documentElement.lang),t.locale,`${what}: the page's lang`)
  assert.equal(await page.evaluate(()=>window.town.words.current.locale),t.locale,`${what}: the catalog in use`)
}
/** Opens the language's dialog from the button with this title, and checks it lists every language by its own name, the one in use marked. */
const openDialog=async(page:Page,opener:ReturnType<Page["locator"]>,t:Catalog,what:string)=>{
  await opener.click()
  const dialog=page.locator(".dialog.language.open")
  await dialog.waitFor()
  const choices=dialog.locator(".choices button")
  assert.deepEqual(await choices.allTextContents(),locales.map(languageName),`${what}: every language by its own name`)
  assert.deepEqual(await choices.evaluateAll(buttons=>buttons.map(b=>b.getAttribute("lang"))),[...locales],`${what}: each name is marked as its own language`)
  assert.deepEqual(await dialog.locator(".choices button.on").allTextContents(),[languageName(locales.find(l=>l===t.locale)!)],`${what}: the language in use is marked`)
  return dialog
}

try {
  // One browser's storage for the whole visit: the choice is kept there.
  const context=await browser.newContext({viewport:{width:1280,height:800},locale:"en-US"})
  const page=await context.newPage()
  page.on("pageerror",e=>errors.push(e.message))
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text())})
  await page.goto(base)
  await page.waitForFunction(()=>"town" in window)
  await reads(page,en,"a reader of English")

  // The founding screen: the first thing a new mayor reads has the language's button on it.
  const fromCharter=await openDialog(page,page.locator(".dialog.open .language-button"),en,"the founding screen")
  await page.screenshot({path:`${output}/founding.png`})
  // The language already in use is no change: the dialog closes, and the charter is still there.
  await fromCharter.locator(".choices button.on").click()
  assert.equal(await page.locator(".dialog.language.open").count(),0)
  assert.ok(await page.getByRole("button",{name:en.page.charter.start,exact:true}).isVisible())

  // A town in play, somewhere particular to look from.
  await page.getByRole("button",{name:en.page.charter.start,exact:true}).click()
  await page.waitForFunction(()=>!window.town.interaction.founding&&window.town.shown.town.stats!==null)
  await page.evaluate(()=>{window.town.advance(20);window.town.view.setView({x:24,y:27,zoom:1.6,heading:1.1,elevation:0.7})})
  let town=await page.evaluate(()=>{const s=window.town.snapshot();return{entities:s.entities.length,seed:s.resources["Town/Charter"].seed as number,step:s.resources["Town/Time"].step as number,view:window.town.view.view()}})
  let current:Catalog=en

  // To every other language and back: each change keeps the choice, comes back in that language, and carries the town on.
  const round:ReadonlyArray<Locale>=[...locales.filter(l=>l!==en.locale),...(locales.length>1?[locales.find(l=>l===en.locale)!]:[])]
  for (const to of round) {
    const t=await load(to)
    const dialog=await openDialog(page,page.locator(".system button").filter({has:page.locator(`xpath=self::*[@title=${JSON.stringify(current.page.system.language.tip)}]`)}),current,`in ${current.locale}`)
    await page.screenshot({path:`${output}/choosing-${current.locale}.png`})
    await dialog.getByRole("button",{name:languageName(to),exact:true}).click()
    await page.waitForFunction(tag=>document.documentElement.lang===tag&&"town" in window&&!window.town.interaction.founding&&window.town.shown.town.stats!==null,to)
    await reads(page,t,`chosen ${to}`)
    assert.equal(await page.evaluate(()=>localStorage.getItem("inkline-town/language")),to,"the choice is kept for the next visit")
    assert.equal(await page.locator(".dialog.open").count(),0,`${to}: no charter is asked for: the town is carried on with`)
    const back=await page.evaluate(()=>{const s=window.town.snapshot();return{entities:s.entities.length,seed:s.resources["Town/Charter"].seed as number,step:s.resources["Town/Time"].step as number,view:window.town.view.view(),events:(s.resources["Town/Chronicle"].lines as ReadonlyArray<{readonly event:Event}>).map(l=>l.event),told:window.town.shown.town.stats!.chronicle.map(l=>l.text)}})
    assert.equal(back.seed,town.seed,`${to}: the same town`)
    assert.equal(back.entities,town.entities,`${to}: with everything it had`)
    assert.ok(back.step>=town.step,`${to}: no earlier than it was left (${back.step} after ${town.step})`)
    for (const axis of ["x","y","zoom","heading","elevation"] as const satisfies ReadonlyArray<keyof CameraView>) assert.ok(Math.abs(back.view[axis]-town.view[axis])<1e-6,`${to}: looking from where the mayor was (${axis}: ${back.view[axis]} for ${town.view[axis]})`)
    // The town's past is data, so it reads in the language chosen, not the one it was played in.
    assert.deepEqual(back.told,back.events.map(event=>say(t.chronicle,event)),`${to}: the chronicle reads in ${to}`)
    assert.ok(back.told.length>0)
    // And the page's own labels are that language's.
    const toolbar=await page.locator(".toolbar").innerText()
    for (const id of ["road","homes","build"] as const) assert.ok(toolbar.includes(t.commands[id].label),`${to}: the tool bar says "${t.commands[id].label}"`)
    await page.screenshot({path:`${output}/in-${to}.png`})
    town={entities:back.entities,seed:back.seed,step:back.step,view:back.view}
    current=t
  }

  // A visit after: the language chosen last is the one the page opens in, whatever the browser's own.
  const again=await context.newPage()
  await again.goto(base)
  await again.waitForFunction(()=>"town" in window)
  await reads(again,current,"the next visit")
  await again.close()

  // A phone: the founding screen's button is on screen, and the dialog fits.
  const phone=await browser.newPage({viewport:{width:390,height:720},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:"en-US"})
  phone.on("pageerror",e=>errors.push(`phone: ${e.message}`))
  await phone.goto(base)
  await phone.waitForFunction(()=>"town" in window)
  const button=(await phone.locator(".dialog.open .language-button").boundingBox())!
  assert.ok(button.y>=0&&button.x>=0&&button.x+button.width<=390,"phone: the language button is on the founding screen")
  const found=(await phone.getByRole("button",{name:en.page.charter.start,exact:true}).boundingBox())!
  assert.ok(found.y>=0&&found.y+found.height<=720,"phone: the found button is still on screen")
  const sheet=await openDialog(phone,phone.locator(".dialog.open .language-button"),en,"phone")
  const card=(await sheet.locator(".sheet").boundingBox())!
  assert.ok(card.x>=0&&card.x+card.width<=390&&card.y>=0&&card.y+card.height<=720,"phone: the language dialog fits the screen")
  await phone.screenshot({path:`${output}/phone.png`})
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),"phone: the page scrolls sideways")
  await phone.close()

  assert.deepEqual(errors,[])
  console.log(`language checks passed: ${locales.map(languageName).join(", ")}`)
} finally {
  await browser.close()
}
