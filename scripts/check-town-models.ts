/** Review gallery and portable export checks, using the same isolated browser
 * workflow as check-browser.ts. The dev server must already be running. */
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright"

const executablePath = process.env.BROWSER_EXECUTABLE_PATH ?? ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })
const errors: string[] = []
page.on("pageerror", e => errors.push(e.message))
page.on("console", e => { if (e.type() === "error") errors.push(e.text()) })
page.on("response", r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`) })
const output = "output/inkline-3d/town-review"
await mkdir(output, { recursive: true })
const groups = ["Buildings", "Gardens & squares", "Homes & neighbourhoods", "Winter", "Ruins", "People & cargo", "Building condition"]
const captureSheet = async () => {
  const previous = await page.locator("#sheet-link").getAttribute("href")
  await page.getByRole("button", { name: "Save model sheet", exact: true }).click()
  await page.waitForFunction(previous => {
    const link = document.querySelector<HTMLAnchorElement>("#sheet-link")!
    return !link.hidden && link.getAttribute("href") !== previous
  }, previous)
  return page.evaluate(async () => {
    const blob = await fetch(document.querySelector<HTMLAnchorElement>("#sheet-link")!.href).then(r => r.blob())
    return new Promise<string>(resolve => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(blob)
    })
  })
}
try {
  await page.goto(`${process.env.GAME_BASE_URL ?? "http://127.0.0.1:5232"}/model-review.html`)
  await page.locator(".model-view").first().waitFor()
  for (const group of groups) {
    await page.getByRole("button", { name: group, exact: true }).click()
    const collection = new URL(page.url()).searchParams.get("collection")!
    const image = await captureSheet()
    assert.ok(image?.startsWith("data:image/png;base64,"))
    await writeFile(`${output}/${collection}.png`, Buffer.from(image.split(",")[1]!, "base64"))
    await page.evaluate(() => scrollTo(0, 350))
    await page.screenshot({ path: `${output}/${collection}-page.png` })
    await page.getByRole("button", { name: "See the back", exact: true }).click()
    assert.equal(await page.locator("output").textContent(), "180°")
    await page.getByRole("button", { name: "Reset view", exact: true }).click()
    await page.getByLabel("View elevation").selectOption("50")
    const rear = await captureSheet()
    assert.ok(rear && rear !== image, `${group}: the exported view must respond to the camera`)
    await page.getByRole("button", { name: "Reset view", exact: true }).click()
    console.log(`ok ${collection}: ${await page.locator(".model-view").count()} models, rotation, elevation, PNG export`)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("button", { name: "Gardens & squares", exact: true }).click()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Phone preview must fit the viewport")
  await page.screenshot({ path: `${output}/phone.png` })
  assert.deepEqual(errors, [])
  console.log("ok phone layout; no browser errors")
} finally {
  await browser.close()
}
