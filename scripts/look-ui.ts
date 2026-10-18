/**
 * A look at the panels and markers in a lived-in town, at desktop and phone
 * sizes: a fishery whose water is fished out (and the fish on the water
 * around it), a settlers' cottage and a citizens' home with what they lack
 * and what to do, the gold arrows over what can be upgraded, the town hall's
 * panel with its upgrade, and the build menu. Screenshots go to
 * `output/look-ui`.
 *
 *   node scripts/balance.ts --size small --seeds 1 --snapshot 30 --out snapshots
 *   pnpm dev --host 127.0.0.1 --port 5232 &
 *   SAVE=snapshots/small-fair-8919-30min.json node scripts/look-ui.ts
 */
import { existsSync } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { chromium, type Page } from "playwright"

const executable = process.env.BROWSER_EXECUTABLE_PATH ?? ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) })
const out = process.env.OUT ?? "output/look-ui"
await mkdir(out, { recursive: true })
if (!process.env.SAVE) throw new Error("SAVE=<a save file, as `pnpm balance --snapshot` writes>")
const save = await readFile(process.env.SAVE, "utf8")
const errors: Array<string> = []

type Tile = { x: number; y: number; size: number }
const town = (page: Page) => page.evaluate(() => (window as any).town.runtime.snapshot()) as Promise<any>
const find = async (page: Page, test: (e: any) => boolean) => (await town(page)).entities.find(test) as any

for (const [name, width, height, phone] of [["desktop", 1440, 1000, false], ["phone", 390, 844, true]] as const) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, ...(phone ? { isMobile: true, hasTouch: true } : {}) })
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`))
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`) })
  const settle = () => page.waitForTimeout(600)
  const shot = async (label: string) => { await settle(); await page.screenshot({ path: `${out}/${name}-${label}.png` }) }
  const at = (x: number, y: number, z = 0) => page.evaluate(([x, y, z]) => (window as any).town.view.project(x, y, z), [x, y, z]) as Promise<{ x: number; y: number }>
  const look = (x: number, y: number, zoom: number) => page.evaluate(([x, y, zoom]) => { const v = (window as any).town.view; v.focus(x, y); v.camera.zoom = zoom; v.camera.updateProjectionMatrix() }, [x, y, zoom])
  const pick = async (tile: Tile, z = 10) => {
    const p = await at(tile.x + tile.size / 2, tile.y + tile.size / 2, z)
    if (phone) await page.touchscreen.tap(p.x, p.y)
    else {
      await page.mouse.click(p.x, p.y)
      await page.mouse.move(width / 3, height - 140)
    }
  }
  const close = async () => { await page.locator(".panel .close").first().click().catch(() => {}); await settle() }

  await page.goto(process.env.GAME_BASE_URL ?? "http://127.0.0.1:5232")
  await page.evaluate((text) => localStorage.setItem("inkline-town/save/manual", text), save)
  await page.reload()
  await page.waitForFunction(() => (window as any).town)
  await page.getByRole("button", { name: /Continue/ }).first().click()
  await page.waitForFunction(() => !(window as any).town.ui.founding)
  await page.locator(".toolbar .pause").click()
  await page.evaluate(() => (window as any).town.ui.guide.push({ type: "off" }))

  // 0. The problem marker over a lumberjack (paused), clear of its roof.
  const lumber = await find(page, (e) => e.components["Town/Building"]?.kind === "lumberjack" && !e.components["Town/Site"])
  if (lumber) {
    const l: Tile = lumber.components["Town/Tile"]
    await page.evaluate((l) => (window as any).town.ui.edits.push({ type: "pause", cell: { x: l.x, y: l.y }, on: true }), l)
    await page.evaluate(() => (window as any).town.advance(1))
    await look(l.x + 1, l.y + 1, phone ? 2.4 : 3.2)
    await shot("0-marker")
    await page.evaluate((l) => (window as any).town.ui.edits.push({ type: "pause", cell: { x: l.x, y: l.y }, on: false }), l)
    await page.evaluate(() => (window as any).town.advance(1))
  }

  // 1. A fishery, its water fished out: its status says so, and what to do; the water beyond it still shows fish.
  const fishery = await find(page, (e) => e.components["Town/Building"]?.kind === "fishery" && !e.components["Town/Site"])
  if (fishery) {
    const f: Tile = fishery.components["Town/Tile"]
    await page.evaluate((f) => {
      const { runtime } = (window as any).town
      const s = runtime.snapshot(), tick = s.resources["Town/Time"].step
      for (const e of s.entities) {
        const t = e.components["Town/Tile"], w = e.components["Town/Water"]
        if (w && Math.abs(t.x - f.x) <= 3 && Math.abs(t.y - f.y) <= 3) e.components["Town/Water"] = { fished: tick }
      }
      const restored = runtime.restore(s)
      if (!restored.ok) throw new Error(`The changed town did not load: ${JSON.stringify(restored.error)}`)
    }, f)
    await page.evaluate(() => (window as any).town.advance(12))
    await look(f.x + 1, f.y + 1, phone ? 1.4 : 2)
    await pick(f)
    await shot("1-fishery")
    await close()
  }

  // 2. A settlers' cottage and a citizens' home: what they lack, why, and what to do.
  for (const [label, tier] of [["2-cottage", 1], ["3-citizens-home", 2]] as const) {
    const home = await find(page, (e) => e.components["Town/House"]?.tier === tier && e.components["Town/House"].residents > 0 && !e.components["Town/Site"])
    if (!home) continue
    const h: Tile = home.components["Town/Tile"]
    await look(h.x + 0.5, h.y + 0.5, phone ? 1.4 : 2)
    await pick(h, 6)
    await shot(label)
    await close()
  }

  // 3. The upgrades the town can begin now, as gold arrows over the buildings; then the town hall's panel.
  await page.evaluate(() => {
    const { runtime } = (window as any).town
    const s = runtime.snapshot()
    s.resources["Town/Fate"].rank = Math.max(s.resources["Town/Fate"].rank, 2)
    s.resources["Town/Treasury"].coins = 5000
    const restored = runtime.restore(s)
    if (!restored.ok) throw new Error(`The changed town did not load: ${JSON.stringify(restored.error)}`)
  })
  await page.evaluate(() => (window as any).town.advance(1))
  const hall = (await find(page, (e) => e.components["Town/TownHall"])).components["Town/Tile"] as Tile
  await look(hall.x + 1.5, hall.y + 1.5, phone ? 0.9 : 1.2)
  await shot("4-upgrade-arrows")
  await look(hall.x + 1.5, hall.y + 1.5, phone ? 1.4 : 2)
  await pick(hall, 20)
  await shot("5-town-hall")
  await close()

  // 3b. Works in progress: one building of each kind that has an upgrade, begun together, seen early, midway and done
  // (desktop only), with the panel of the first while its works go on.
  if (!phone) {
    await page.evaluate(() => {
      const { runtime } = (window as any).town
      const s = runtime.snapshot()
      s.resources["Town/Treasury"].coins = 20000
      for (const e of s.entities) {
        const inv = e.components["Town/Inventory"]
        if (e.components["Town/Storage"] && inv) inv.stock = { ...inv.stock, planks: Math.min(inv.cap, 120), stone: Math.min(inv.cap, 120), tools: Math.min(inv.cap, 40), cloth: Math.min(inv.cap, 40) }
      }
      const restored = runtime.restore(s)
      if (!restored.ok) throw new Error(`The changed town did not load: ${JSON.stringify(restored.error)}`)
    })
    const kinds = ["townhall", "warehouse", "farm", "bakery", "market", "chapel", "quarry", "firewatch"]
    const picked: Array<{ kind: string; tile: Tile }> = []
    for (const kind of kinds) {
      const b = await find(page, (e) => (e.components["Town/Building"]?.kind === kind || (kind === "townhall" && e.components["Town/TownHall"])) && !e.components["Town/Site"] && !e.components["Town/Works"])
      if (!b) continue
      const tile: Tile = b.components["Town/Tile"]
      picked.push({ kind, tile })
      await page.evaluate((t) => (window as any).town.ui.edits.push({ type: "upgrade", cell: { x: t.x, y: t.y } }), tile)
    }
    await page.evaluate(() => (window as any).town.advance(1))
    const progress = async () => (await town(page)).entities.filter((e: any) => e.components["Town/Works"]).length
    for (const [stage, seconds] of [["early", 12], ["midway", 40], ["done", 400]] as const) {
      await page.evaluate((n) => (window as any).town.advance(n), seconds)
      for (const { kind, tile } of picked) {
        await look(tile.x + tile.size / 2, tile.y + tile.size / 2, kind === "townhall" ? 2.2 : 2.8)
        await settle()
        await page.screenshot({ path: `${out}/${name}-works-${kind}-${stage}.png`, clip: { x: width / 2 - 360, y: height / 2 - 300, width: 720, height: 520 } })
      }
      if (stage === "early" && picked[0]) {
        await look(picked[0].tile.x + 1.5, picked[0].tile.y + 1.5, 2)
        await pick(picked[0].tile, 20)
        await shot("works-panel")
        await close()
      }
    }
    console.log(JSON.stringify({ upgraded: picked.map((p) => p.kind), underway: await progress() }))
  }

  // 4. The build menu: no upgrades in it now.
  await page.locator(".toolbar button").filter({ hasText: /^build/i }).first().click()
  await settle()
  await page.locator(".panel").getByText(/parks/i).first().scrollIntoViewIfNeeded().catch(() => {})
  await shot("6-build-menu")
  await page.close()
}
console.log(JSON.stringify({ errors }))
await browser.close()
