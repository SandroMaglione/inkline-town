/**
 * A look at the screens PR #20 added, at desktop and phone sizes: the build
 * menu's upgrades and the carpenter, the upgrade tool's tooltip, a building
 * panel with works under way, a townhouse panel short of furniture, the
 * goods bar and the town panel's needs, and the trade rows. Screenshots go
 * to `output/look-ui`.
 *
 *   pnpm dev --host 127.0.0.1 --port 5232 &
 *   node scripts/look-ui.ts
 */
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { chromium, type Page } from "playwright"

const executable = process.env.BROWSER_EXECUTABLE_PATH ?? ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) })
const out = process.env.OUT ?? "output/look-ui"
await mkdir(out, { recursive: true })
const errors: Array<string> = []

/** A town at the town rank, with a street of townhouses and citizens' homes east of the hall, a market, and goods to spare. */
const stage = async (page: Page) => {
  await page.evaluate(() => {
    const { runtime } = (window as any).town
    const s = runtime.snapshot()
    s.resources["Town/Fate"].rank = 2
    s.resources["Town/Treasury"].coins = 5000
    const hall = s.entities.find((e: any) => e.components["Town/TownHall"])
    const t = hall.components["Town/Tile"]
    hall.components["Town/Inventory"].stock = { ...hall.components["Town/Inventory"].stock, planks: 90, stone: 90, tools: 20, cloth: 12, bread: 20, furniture: 3 }
    const zero = Object.fromEntries(Object.keys(hall.components["Town/Inventory"].stock).map((g) => [g, 0]))
    // Homes on the east side of the ring road: three townhouses (one with furniture, two without), then citizens' homes.
    for (let i = 0; i < 5; i++) {
      const tier = i < 3 ? 3 : 2
      s.entities.push({
        id: s.nextEntity++,
        components: {
          "Town/Tile": { x: t.x + 4, y: t.y - 1 + i, size: 1 },
          "Town/House": { tier, residents: tier === 3 ? 8 : 6, food: 3, bread: 3, cloth: 3, faith: 3, furniture: i === 0 ? 2 : 0, clock: 0 },
          "Town/Risk": { fire: 0, health: 0, order: 0, thefts: 0 },
          "Town/Condition": { value: 1000 }
        }
      })
    }
    void zero
    runtime.restore(s)
  })
  await page.evaluate(() => (window as any).town.advance(1))
}

const hallTile = (page: Page) =>
  page.evaluate(() => (window as any).town.runtime.snapshot().entities.find((e: any) => e.components["Town/TownHall"]).components["Town/Tile"] as { x: number; y: number })

const settle = (page: Page) => page.waitForTimeout(500)

for (const [name, width, height, phone] of [["desktop", 1440, 1000, false], ["phone", 390, 844, true]] as const) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, ...(phone ? { isMobile: true, hasTouch: true } : {}) })
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`))
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`) })
  const shot = async (label: string) => { await settle(page); await page.screenshot({ path: `${out}/${name}-${label}.png` }) }
  const tap = async (x: number, y: number) => (phone ? page.touchscreen.tap(x, y) : page.mouse.click(x, y))
  const at = (x: number, y: number, z = 0) => page.evaluate(([x, y, z]) => (window as any).town.view.project(x, y, z), [x, y, z]) as Promise<{ x: number; y: number }>
  const close = async () => { await page.locator(".panel .close").first().click().catch(() => {}); await settle(page) }

  await page.goto(process.env.GAME_BASE_URL ?? "http://127.0.0.1:5232")
  await page.waitForFunction(() => (window as any).town)
  await page.getByRole("button", { name: "small", exact: true }).click()
  await page.getByRole("button", { name: "Start new", exact: true }).click()
  await page.waitForFunction(() => !(window as any).town.ui.founding)
  await page.locator(".toolbar .pause").click()
  await page.locator(".guide .hide, .guide button").filter({ hasText: /hide/i }).first().click().catch(() => {})
  await stage(page)
  const hall = await hallTile(page)
  await page.evaluate(([x, y]) => { const v = (window as any).town.view; v.focus(x, y); v.camera.zoom = 2; v.camera.updateProjectionMatrix() }, [hall.x + 3, hall.y + 1.5])

  // 1. The build menu: its upgrades section, and the carpenter among the workshops.
  await page.locator(".toolbar button").filter({ hasText: /^build/i }).first().click()
  await settle(page)
  await page.locator(".panel .option").filter({ hasText: /carpenter/i }).first().scrollIntoViewIfNeeded().catch(() => {})
  await shot("1-build-carpenter")
  await page.locator(".panel").getByText(/upgrades/i).first().scrollIntoViewIfNeeded().catch(() => {})
  await shot("2-build-upgrades")

  // 2. The upgrade tool's tooltip over the town hall (desktop only: phones show what is about to be built in a strip).
  await page.evaluate(() => { const t = (window as any).town; t.ui.menu = null; t.ui.tool = "upgrade"; t.ui.upgrading = "townhall" })
  await close()
  const over = await at(hall.x + 1.5, hall.y + 1.5, 40)
  await page.mouse.move(over.x, over.y)
  await shot("3-upgrade-tooltip")

  // 3. Works begun on the town hall, part way, and its panel.
  await page.evaluate(([x, y]) => (window as any).town.ui.edits.push({ type: "upgrade", cell: { x, y } }), [hall.x, hall.y])
  await page.evaluate(() => (window as any).town.advance(30))
  await page.evaluate(() => { const t = (window as any).town; t.ui.tool = "select"; t.ui.upgrading = null })
  await tap(over.x, over.y)
  await shot("4-works-panel")
  await close()

  // 4. A townhouse short of furniture, and one furnished.
  for (const [label, dy] of [["5-townhouse-unfurnished", 0], ["6-townhouse-furnished", -1]] as const) {
    const p = await at(hall.x + 4.5, hall.y + dy + 0.5, 10)
    await tap(p.x, p.y)
    if (!phone) await page.mouse.move(width / 3, height - 160)
    await shot(label)
    await close()
  }

  // 5. The goods bar (on phones, opened from its chip) and the town panel: needs and trade.
  if (phone) await page.locator(".goods-chip").click().catch(() => {})
  await shot("7-goods-bar")
  if (phone) await page.locator(".goods-chip").click().catch(() => {})
  await page.locator(".toolbar button").filter({ hasText: /^town/i }).first().click()
  await shot("8-town-panel")
  await page.locator(".panel").getByText(/furniture/i).last().scrollIntoViewIfNeeded().catch(() => {})
  await shot("9-town-panel-furniture")
  await page.close()
}
console.log(JSON.stringify({ errors }))
await browser.close()
