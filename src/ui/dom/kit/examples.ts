/**
 * Every building block of the page in each of its states, on one sheet: the
 * place to look before adding a variant, and the sheet `ui-kit.html` shows
 * (`pnpm dev`, then /ui-kit.html). A new state of a block gets an example here.
 */
import type { Line } from "../../../view/contracts.ts"
import { costChips } from "./cost-chips.ts"
import { el } from "./dom.ts"
import { iconEl, iconNames, icon } from "./icons.ts"
import { syncLines } from "./lines.ts"
import type { Pictures } from "./picture.ts"
import { money, row } from "./rows.ts"
import { section } from "./section.ts"
import { slider } from "./slider.ts"
import { sparkline } from "./sparkline.ts"
import { callouts, iconize } from "./text.ts"

/** Every tone a line can take, with a value, goods, a note, and a fix. */
const lines: ReadonlyArray<Line> = [
  { icon: "workers", label: "workers", value: "4 of 4", tone: "ok" },
  { icon: "workers", label: "workers", value: "2 of 4", tone: "warn", note: "everyone nearby has a job: lay more homes within 15 road cells" },
  { icon: "tools", label: "tools", value: "none", tone: "bad", note: "half pace until one comes", fix: { text: "build a smithy, or buy tools in the [town] panel", build: "smithy" } },
  { icon: "jobs", label: "holds", value: "nothing", tone: "dim" },
  { icon: "people", label: "handed out, last minute", goods: [{ good: "fish", count: 6 }, { good: "bread", count: 2 }] },
  { icon: "upkeep", label: "upkeep", value: "3 coins a minute" }
]

/** `pictures`: where the examples' building pictures come from (the sheet draws a placeholder). */
export const kitExamples = (pictures: Pictures): HTMLElement => {
  const sheet = el("aside", "panel open")
  sheet.style.position = "static"
  sheet.style.width = "380px"
  sheet.style.maxWidth = "none"

  const tones = section("lines", "info", "Every row a panel shows: a value, goods as chips, a note when something wants doing, and what to do about it.")
  tones.classList.add("lines")
  syncLines(pictures, tones, [], lines)
  sheet.append(tones)

  const numbers = section("rows and sums", "coins")
  row(numbers, "settlers", "settlers").textContent = "42"
  money(row(numbers, "taxes", "taxes"), 18)
  money(row(numbers, "upkeep", "upkeep"), -7)
  money(row(numbers, "a minute", "coins"), 0, " coins")
  const spark = el("div", "spark")
  spark.innerHTML = sparkline([3, 5, 4, 8, 7, 11, 10, 14])
  numbers.append(spark)
  sheet.append(numbers)

  const costs = section("costs", "build")
  const enough = costChips({ coins: 40, materials: { planks: 4 } }, () => ({ coins: 100, stock: { wood: 0, planks: 10, stone: 0, ore: 0, tools: 0, fish: 0, smoked: 0, wheat: 0, flour: 0, bread: 0, wool: 0, cloth: 0, furniture: 0 } }))
  const short = costChips({ coins: 120, materials: { stone: 6 } }, () => ({ coins: 100, stock: { wood: 0, planks: 0, stone: 2, ore: 0, tools: 0, fish: 0, smoked: 0, wheat: 0, flour: 0, bread: 0, wool: 0, cloth: 0, furniture: 0 } }))
  enough.refresh()
  short.refresh()
  costs.append(el("p", "empty", "affordable"), enough.box, el("p", "empty", "short of coins and stone"), short.box)
  sheet.append(costs)

  const levers = section("sliders", "taxes")
  const rate = slider(50, 150, 5, () => {})
  rate.sync(120)
  levers.append(rate.input)
  sheet.append(levers)

  const words = section("messages", "chronicle")
  const said = el("p", "")
  said.innerHTML = iconize(callouts("Lay [homes] by a road, build a fishery for 2 planks, then open the [view:workers]. Press (S) to select."))
  words.append(said)
  sheet.append(words)

  const glyphs = section("icons", "picture")
  const grid = el("div", "chips")
  grid.innerHTML = iconNames.map((name) => `<span class="chip" title="${name}">${icon(name, 16)}</span>`).join("")
  glyphs.append(grid)
  sheet.append(glyphs)

  const help = section("a section's help", "info", "A section's help sits behind the ⓘ: one line of what the numbers mean.")
  help.append(iconEl("hint"))
  sheet.append(help)
  return sheet
}
