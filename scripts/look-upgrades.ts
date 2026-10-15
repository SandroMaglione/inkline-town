/**
 * A look at upgrades in the real 3D game: the build menu's upgrades, the
 * upgrade tool's tooltip over the town hall, its scaffolding part way, and
 * the guildhall it becomes. Screenshots go to `output/upgrades`.
 *
 *   pnpm dev --host 127.0.0.1 --port 5232 &
 *   node scripts/look-upgrades.ts
 */
import { chromium } from "playwright"
import { mkdir } from "node:fs/promises"

const executable = process.env.BROWSER_EXECUTABLE_PATH
const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
const out = process.env.OUT ?? "output/upgrades"
await mkdir(out, { recursive: true })
const errors: Array<string> = []
page.on("pageerror", (e) => errors.push(e.message))
try {
  await page.goto(process.env.GAME_BASE_URL ?? "http://127.0.0.1:5232")
  await page.waitForFunction(() => (window as any).town)
  await page.getByRole("button", { name: "small", exact: true }).click()
  await page.getByRole("button", { name: "Start new", exact: true }).click()
  await page.waitForFunction(() => !(window as any).town.ui.founding)
  await page.locator(".toolbar .pause").click()
  // A town that has reached the town rank, with coins and materials to spare.
  await page.evaluate(() => {
    const { runtime } = (window as any).town
    const s = runtime.snapshot()
    s.resources["Town/Fate"].rank = 2
    s.resources["Town/Treasury"].coins = 5000
    const hall = s.entities.find((e: any) => e.components["Town/TownHall"])
    hall.components["Town/Inventory"].stock = { ...hall.components["Town/Inventory"].stock, planks: 90, stone: 90, tools: 20 }
    runtime.restore(s)
  })
  await page.evaluate(() => (window as any).town.advance(1))
  const hall = await page.evaluate(() => (window as any).town.runtime.snapshot().entities.find((e: any) => e.components["Town/TownHall"]).components["Town/Tile"])
  await page.evaluate(([x, y]) => { const v = (window as any).town.view; v.focus(x, y); v.camera.zoom = 2.2; v.camera.updateProjectionMatrix() }, [hall.x + 1.5, hall.y + 1.5])
  // The build menu, scrolled to its upgrades.
  await page.locator(".toolbar button").filter({ hasText: /build/i }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.locator(".panel h3, .panel .title, .panel summary").filter({ hasText: /upgrades/i }).first().scrollIntoViewIfNeeded().catch(() => {})
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/1-build-menu.png` })
  // The upgrade tool over the town hall.
  await page.evaluate(() => { const t = (window as any).town; t.ui.menu = null; t.ui.tool = "upgrade"; t.ui.upgrading = "townhall" })
  const box = await page.evaluate(([x, y]) => (window as any).town.view.project(x, y, 40), [hall.x + 1.5, hall.y + 1.5])
  if (box) await page.mouse.move(box.x, box.y)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/2-hover-tooltip.png` })
  // Begin, then part way.
  await page.evaluate(([x, y]) => (window as any).town.ui.edits.push({ type: "upgrade", cell: { x, y } }), [hall.x, hall.y])
  await page.evaluate(() => (window as any).town.advance(50))
  await page.evaluate(() => { const t = (window as any).town; t.ui.tool = "select"; t.ui.upgrading = null })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/3-scaffolding.png` })
  await page.evaluate(() => (window as any).town.advance(90))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/4-guildhall.png` })
  console.log(JSON.stringify({ errors, upgraded: await page.evaluate(() => (window as any).town.runtime.snapshot().entities.find((e: any) => e.components["Town/TownHall"]).components["Town/Upgraded"] ?? null) }))
} finally {
  await browser.close()
}
