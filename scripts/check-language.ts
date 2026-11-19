/** Real locale detection, live switching, and persistence. Start the dev server first. */
import assert from "node:assert/strict"
import { chromium } from "playwright"
import { LANGUAGE_KEY } from "../src/i18n/index.ts"

const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {})
})
const base = process.env.GAME_BASE_URL ?? "http://127.0.0.1:5232"
const errors: string[] = []
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 600, height: 912 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 762, height: 330 }]) {
    const phone = viewport.width <= 760 || viewport.height <= 500
    const context = await browser.newContext({ locale: "fr-CA", viewport, hasTouch: phone, isMobile: phone })
    const page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(base)
    await page.waitForFunction(() => "town" in window)
    assert.equal(await page.locator("html").getAttribute("lang"), "fr")
    const chooser = page.locator(".dialog.open .language-picker select")
    assert.equal(await chooser.inputValue(), "fr")
    assert.equal(await page.locator(".dialog.open .language-picker .language-label").isVisible(), false)
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_KEY), null)
    assert.ok(await page.getByRole("button", { name: "Nouvelle partie", exact: true }).isVisible())
    if (!phone) {
      const bindings = await page.evaluate(async () => {
        // Reuse the app's exact module URLs, including Vite's hot-reload timestamps.
        const moduleUrl = (path: string) => {
          const entry = performance.getEntriesByType("resource").find((entry) => new URL(entry.name).pathname === path)
          if (!entry) throw new Error(`The game did not load ${path}`)
          return entry.name
        }
        const domUrl = moduleUrl("/src/i18n/dom.ts"), textUrl = moduleUrl("/src/ui/dom/kit/text.ts")
        const { setMarkup }: typeof import("../src/i18n/dom.ts") = await import(domUrl)
        const { callouts, setIconizedText }: typeof import("../src/ui/dom/kit/text.ts") = await import(textUrl)
        const root = document.createElement("div")
        root.id = "locale-binding-probe"
        root.hidden = true
        setMarkup(root, '<button data-kind="fishery" title="Language">Pause work</button><input value="initial"><p title="Pick a fishery to upgrade">wood → planks</p>')
        const notice = document.createElement("p")
        notice.className = "iconized"
        setIconizedText(notice, "Guildhall · −500 coins · carriers bring 30 planks · 40 stone · 6 tools")
        root.append(notice)
        const button = root.querySelector("button")!, input = root.querySelector("input")!
        input.value = "player input"
        let clicks = 0
        button.onclick = () => {
          root.dataset.clicks = String(++clicks)
          root.dataset.sameButton = String(root.querySelector("button") === button)
        }
        document.body.append(root)
        return {
          french: button.textContent, title: button.title,
          recipe: root.querySelector("p")!.textContent, upgrade: root.querySelector("p")!.title,
          notice: notice.textContent, amounts: notice.querySelectorAll(".amount").length,
          buildingChip: callouts("Build a fishery").includes('data-kind="fishery"'),
          toolChip: callouts("Lay [homes]").includes('data-tool="homes"')
        }
      })
      assert.deepEqual(bindings, {
        french: "Suspendre le travail", title: "Langue", recipe: "bois → planches", upgrade: "Choisissez un bâtiment à améliorer : pêcherie",
        notice: "Maison des guildes · −500 · les porteurs apportent 30 40 6", amounts: 4, buildingChip: true, toolChip: true
      })
    }
    const box = (await chooser.boundingBox())!
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height)
    await chooser.selectOption("en")
    assert.ok(await page.getByRole("button", { name: "Start new", exact: true }).isVisible())
    if (!phone) {
      const bindings = await page.evaluate(() => {
        const root = document.getElementById("locale-binding-probe")!
        const button = root.querySelector("button")!
        button.click()
        const result = {
          english: button.textContent, title: button.title, kind: button.dataset.kind,
          input: root.querySelector("input")!.value, clicks: root.dataset.clicks, sameButton: root.dataset.sameButton,
          recipe: root.querySelector("p")!.textContent, upgrade: root.querySelector("p")!.title,
          notice: root.querySelector(".iconized")!.textContent, amounts: root.querySelectorAll(".iconized .amount").length
        }
        root.remove()
        return result
      })
      assert.deepEqual(bindings, {
        english: "Pause work", title: "Language", kind: "fishery", input: "player input", clicks: "1", sameButton: "true",
        recipe: "wood → planks", upgrade: "Pick a fishery to upgrade",
        notice: "Guildhall · −500 · carriers bring 30 40 6", amounts: 4
      })
    }
    await page.reload()
    await page.waitForFunction(() => "town" in window)
    assert.equal(await page.locator("html").getAttribute("lang"), "en")
    await page.getByRole("button", { name: "Start new", exact: true }).click()
    await page.locator(".toolbar .pause").click()
    await page.waitForFunction(() => window.town.interaction.speed === 0)
    const before = await page.evaluate(() => JSON.stringify(window.town.snapshot()))
    if (phone) {
      await page.locator(".toolbar .more").click()
      await page.locator(".system .language-picker").click()
      await page.keyboard.press("Escape")
      assert.ok(await page.locator(".system").isVisible())
    }
    const picker = page.locator(".system .language-picker")
    const label = picker.locator(".language-label")
    assert.ok(await picker.locator(".glyph").isVisible())
    assert.equal(await label.isVisible(), phone, "the folded menu shows the language label")
    if (phone) {
      assert.equal(await label.textContent(), "language")
      const icon = (await picker.locator(".glyph").boundingBox())!
      const caption = (await label.boundingBox())!
      const select = (await picker.locator("select").boundingBox())!
      const menu = (await page.locator(".system").boundingBox())!
      assert.ok(icon.x + icon.width <= caption.x, "the icon precedes the label")
      assert.ok(select.x <= icon.x && select.x + select.width >= caption.x + caption.width, "the select covers icon and label")
      assert.ok(menu.x >= 0 && menu.x + menu.width <= viewport.width && menu.y >= 0 && menu.y + menu.height <= viewport.height, "the folded menu stays on screen")
    }
    await page.locator(".system .language-picker select").selectOption("fr")
    assert.equal(await label.textContent(), "langue")
    if (phone) {
      const menu = (await page.locator(".system").boundingBox())!
      assert.ok(menu.x >= 0 && menu.x + menu.width <= viewport.width && menu.y >= 0 && menu.y + menu.height <= viewport.height, "the translated menu stays on screen")
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.town.snapshot())), before, "switching must not change the world")
    assert.equal(await page.locator(".toolbar .town-button").getAttribute("title"), "Objectifs, statistiques, impôts et commerce de la ville (T)")
    assert.equal(await page.locator(".toolbar .pause").getAttribute("aria-label"), "Reprendre la partie")
    if (!phone) {
      await page.evaluate(() => {
        const hall = window.town.snapshot().entities.find((entity) => entity.components["Town/TownHall"])
        if (!hall) throw new Error("Missing town hall")
        window.town.interaction.selected = hall.id
      })
      const upgrade = page.locator(".panel.open .upgrade")
      await upgrade.waitFor()
      assert.equal(await upgrade.locator(".begin .sub").textContent(), "la ville doit atteindre le rang village")
      const missing = upgrade.locator(".note").filter({ hasText: "il manque en réserve" })
      assert.equal(await missing.count(), 1)
      assert.ok((await missing.textContent())?.includes("Les travaux attendent ces matériaux"))
      assert.ok(await missing.locator("svg").count() > 0, "missing resources keep their icons")
      await picker.locator("select").selectOption("en")
      assert.equal(await upgrade.locator(".begin .sub").textContent(), "needs the town to be a village")
      assert.equal(await upgrade.locator(".note").filter({ hasText: "the store lacks" }).count(), 1)
      await picker.locator("select").selectOption("fr")
      assert.equal(await upgrade.locator(".note").filter({ hasText: "il manque en réserve" }).count(), 1)
      await page.locator(".panel .close").click()
    }
    if (phone) await page.locator(".toolbar .more").click()
    await page.locator(".toolbar .town-button").click()
    const townText = await page.locator(".panel.open").textContent()
    assert.ok(townText?.includes("marchandises et commerce"), townText ?? "missing town panel")
    await page.locator(".panel .close").click()
    await page.locator(".toolbar button").filter({ hasText: /^construire/ }).click()
    assert.equal(await page.locator(".panel .option .name").first().textContent(), "entrepôt")
    await page.locator(".panel .close").click()
    if (!phone) {
      await page.getByRole("button", { name: "Pivoter", exact: true }).click()
      await page.locator(".system .language-picker select").selectOption("en")
      assert.equal(await page.getByRole("button", { name: "Rotate", exact: true }).getAttribute("aria-pressed"), "true")
      await page.getByRole("button", { name: "Pan", exact: true }).click()
      assert.equal(await page.getByRole("button", { name: "Pan", exact: true }).getAttribute("aria-pressed"), "true")
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await context.close()
  }
  const context = await browser.newContext({ locale: "ja-JP" })
  const page = await context.newPage()
  await page.goto(base)
  await page.waitForFunction(() => "town" in window)
  assert.equal(await page.locator("html").getAttribute("lang"), "en")
  await context.close()
  assert.deepEqual(errors, [])
  console.log("language checks passed: browser detection, saved override, live switching, unchanged world, desktop and phones")
} finally {
  await browser.close()
}
