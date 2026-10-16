/**
 * The README's pictures and its film: a grown town loaded through the real
 * page, shot at desktop size, with the news, overlays and camera buttons
 * hidden. The film runs on Playwright's clock and steps the town itself, so
 * every frame is two thirtieths of a second of the town's time (double
 * speed), however slow the screenshot. Pictures go to `output/look-readme`.
 *
 *   node scripts/balance.ts --size large --land rich --term 90 --seeds 1 --snapshot 80 --out snapshots
 *   pnpm dev --host 127.0.0.1 --port 5232 &
 *   SAVE=snapshots/large-rich-1000-80min.json RECKON=1 node scripts/look-readme.ts    stills (RECKON plays to the term's end)
 *   MODE=wide WIDE=0.75 NAME=large SAVE=... node scripts/look-readme.ts             one wide view at that zoom
 *   MODE=film SIZE=1600x900 SCALE=1 SAVE=... node scripts/look-readme.ts            30 s of frames for the film
 */
import { existsSync } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { chromium } from "playwright"

const executable = process.env.BROWSER_EXECUTABLE_PATH ?? ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync)
const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) })
const out = process.env.OUT ?? "output/look-readme"
await mkdir(out, { recursive: true })
if (!process.env.SAVE) throw new Error("SAVE=<a save file, as `pnpm balance --snapshot` writes>")
const save = await readFile(process.env.SAVE, "utf8")
const [width = 1440, height = 900] = (process.env.SIZE ?? "1440x900").split("x").map(Number)
const errors: Array<string> = []

const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(process.env.SCALE ?? 2) })
page.on("pageerror", (e) => errors.push(e.message))
await page.clock.install()
await page.goto(process.env.GAME_BASE_URL ?? "http://127.0.0.1:5232")
await page.evaluate((text) => localStorage.setItem("inkline-town/save/manual", text), save)
await page.reload()
const run = (ms: number) => page.clock.runFor(ms)
const until = async (test: () => Promise<boolean>) => { for (let i = 0; i < 400 && !(await test()); i++) await run(50) }
await until(() => page.evaluate(() => !!(window as any).town))
const mode = process.env.MODE ?? "stills"
const settle = (ms = 800) => run(ms)
if (mode === "stills") {
  // The charter, as a new mayor sees it first: a large, rich land.
  await page.getByRole("button", { name: "large", exact: true }).click()
  await page.getByRole("button", { name: "rich", exact: true }).click()
  await settle()
  await page.locator(".sheet.wide").screenshot({ path: `${out}/charter.png` })
}
await page.getByRole("button", { name: /Continue/ }).first().click()
await until(() => page.evaluate(() => !(window as any).town.ui.founding))
await page.evaluate(() => (window as any).town.ui.guide.push({ type: "off" }))
// The news, the overlay list, the camera buttons, and the "loaded" toast stay out of the pictures.
await page.addStyleTag({ content: ".ticker, .views, .camera-controls, .toast { display: none !important; }" })
await run(1000)

type Camera = { x: number; y: number; zoom: number; heading: number; elevation: number }
const camera = (c: Camera) => page.evaluate((c) => {
  const v = (window as any).town.view
  v.heading = c.heading; v.elevation = c.elevation
  v.camera.zoom = c.zoom; v.camera.updateProjectionMatrix()
  v.focus(c.x, c.y)
}, c)
const town = () => page.evaluate(() => (window as any).town.runtime.snapshot()) as Promise<any>
const hall = (await town()).entities.find((e: any) => e.components["Town/TownHall"]).components["Town/Tile"]
console.log(JSON.stringify({ hall }))

// The middle of the town: the mean of its buildings and homes.
const built = (await town()).entities.filter((e: any) => (e.components["Town/Building"] || e.components["Town/House"]) && e.components["Town/Tile"]).map((e: any) => e.components["Town/Tile"])
const middle = { x: built.reduce((a: number, t: any) => a + t.x, 0) / built.length, y: built.reduce((a: number, t: any) => a + t.y, 0) / built.length }
// The busiest corner: the cell with the most buildings and homes within four cells, away from the town hall.
const busiest = built.map((a: any) => ({ x: a.x + 1, y: a.y + 1, n: built.filter((b: any) => Math.abs(b.x - a.x) <= 4 && Math.abs(b.y - a.y) <= 4).length }))
  .filter((c: any) => Math.hypot(c.x - hall.x, c.y - hall.y) > 7)
  .sort((a: any, b: any) => b.n - a.n)[0]
console.log(JSON.stringify({ middle, busiest, built: built.length }))

if (mode === "film") {
  // One take: the whole town turning, down to the town hall and along its streets, then back out.
  const fps = 30, seconds = Number(process.env.FILM_SECONDS ?? 30)
  const h = { x: hall.x + 1.5, y: hall.y + 1.5 }
  const q = Math.PI / 4
  const keys: Array<[number, Camera]> = [
    [0, { ...middle, zoom: 0.62, heading: q - 0.4, elevation: 0.64 }],
    [7, { ...middle, zoom: 0.78, heading: q - 0.1, elevation: 0.58 }],
    [13, { ...h, zoom: 2.3, heading: q + 0.2, elevation: 0.52 }],
    [20, { x: busiest.x, y: busiest.y, zoom: 2.5, heading: q + 0.4, elevation: 0.5 }],
    [24, { x: (busiest.x + middle.x) / 2, y: (busiest.y + middle.y) / 2, zoom: 1.5, heading: q + 0.2, elevation: 0.56 }],
    [seconds, { ...middle, zoom: 0.66, heading: q - 0.25, elevation: 0.64 }]
  ]
  const ease = (t: number) => t * t * (3 - 2 * t)
  const at = (s: number): Camera => {
    const i = Math.max(0, keys.findIndex(([k], j) => s >= k && s <= (keys[j + 1]?.[0] ?? Infinity)))
    const [k0, a] = keys[i]!, [k1, b] = keys[Math.min(i + 1, keys.length - 1)]!
    const t = k1 > k0 ? ease((s - k0) / (k1 - k0)) : 0
    // Zoom is eased in log space, so the dolly feels even.
    const mix = (p: number, q: number) => p + (q - p) * t
    return { x: mix(a.x, b.x), y: mix(a.y, b.y), heading: mix(a.heading, b.heading), elevation: mix(a.elevation, b.elevation), zoom: Math.exp(mix(Math.log(a.zoom), Math.log(b.zoom))) }
  }
  // The page's own loop is held (its speed buttons hidden), and the town is stepped here at twice its pace, exactly
  // two thirtieths of a second a frame: under Playwright's clock the loop's frames come unevenly.
  await page.addStyleTag({ content: ".toolbar .speed, .paused-tag { display: none !important; }" })
  await page.evaluate(() => { (window as any).town.ui.speed = 0 })
  await mkdir(`${out}/frames`, { recursive: true })
  for (let f = 0; f < fps * seconds; f++) {
    await camera(at(f / fps))
    await page.evaluate((s) => (window as any).town.advance(s), 2 / fps)
    await run(1000 / fps)
    await page.screenshot({ path: `${out}/frames/${String(f).padStart(4, "0")}.png` })
    if (f % 60 === 0) console.log(`frame ${f}`)
  }
}
if (mode === "wide") {
  await camera({ ...middle, zoom: Number(process.env.WIDE ?? 0.8), heading: Math.PI / 4, elevation: Math.PI / 6 })
  await settle()
  await page.screenshot({ path: `${out}/${process.env.NAME ?? "wide"}.png` })
}
if (mode === "stills") {
  const shot = async (name: string) => { await settle(); await page.screenshot({ path: `${out}/${name}.png` }) }
  const view = { heading: Math.PI / 4, elevation: Math.PI / 6 }
  await camera({ ...middle, zoom: Number(process.env.WIDE ?? 0.8), ...view })
  await shot("town")
  await camera({ x: hall.x + 2.5, y: hall.y + 2, zoom: 2.4, ...view, heading: Math.PI / 4 + 0.4 })
  await shot("street")

  await camera({ ...middle, zoom: 1, ...view })
  await page.locator(".toolbar button").filter({ hasText: /^town/ }).first().click()
  await shot("ui-town-panel")
  await page.keyboard.press("Escape")
  await page.locator(".toolbar button").filter({ hasText: /^build/ }).first().click()
  await shot("ui-build-menu")
  await page.keyboard.press("Escape")
  await settle()

  // A mill, picked on the map.
  const mill = (await town()).entities.find((e: any) => e.components["Town/Building"]?.kind === (process.env.PICK ?? "mill") && !e.components["Town/Site"])
  if (mill) {
    const t = mill.components["Town/Tile"]
    await camera({ x: t.x + t.size / 2 + 1, y: t.y + t.size / 2, zoom: 2.2, ...view })
    await settle(300)
    const p = await page.evaluate(([x, y]) => (window as any).town.view.project(x, y, 10), [t.x + t.size / 2, t.y + t.size / 2])
    await page.mouse.click(p.x, p.y)
    await page.mouse.move(width / 3, height - 160)
    await shot("ui-building")
    await page.keyboard.press("Escape")
  }

  // The end of the term, and its reckoning.
  if (process.env.RECKON) {
    await page.evaluate(() => {
      const { runtime } = (window as any).town
      const s = runtime.snapshot()
      return s.resources["Town/Time"]
    }).then((t) => console.log(JSON.stringify({ time: t })))
    for (let i = 0; i < 40 && !(await page.locator(".dialog.open").count()); i++) {
      await page.evaluate(() => (window as any).town.advance(30))
      await settle(200)
    }
    await settle()
    await page.locator(".dialog.open").first().screenshot({ path: `${out}/reckoning.png` })
  }
}
console.log(JSON.stringify({ errors }))
await browser.close()
