/**
 * The tool bar, built from the tool table (`view/tools.ts`): the town's
 * panel first and larger, then the tools, the clock, and (on a phone) the
 * menu the bottom-right buttons fold into.
 */
import type { Interaction } from "../../view/contracts.ts"
import { commands, toolbar as tools, type Command } from "../../view/tools.ts"
import type { Controls } from "./controls.ts"
import { el } from "./kit/dom.ts"
import { iconEl } from "./kit/icons.ts"

export const createToolbar = (ui: Interaction, controls: Pick<Controls, "toggleMenu" | "choose" | "setSpeed" | "togglePause" | "cycleSpeed" | "toggleFold">) => {
  const bar = el("div", "toolbar")
  // The town's panel is opened most: it has a button of its own, first and larger.
  const townButton = el("button", "town-button")
  townButton.title = "The town's goals, numbers, taxes, and trade (T)"
  townButton.append(iconEl("town", 22), el("span", "", "town"), el("kbd", "", "T"))
  townButton.onclick = () => controls.toggleMenu("town")
  // Everything the bottom-right buttons do, folded into one menu on a phone.
  const moreButton = el("button", "more")
  moreButton.title = "Share, the guide, save, load, new town"
  moreButton.append(iconEl("more"))
  moreButton.onclick = () => controls.toggleFold("more")
  const toolGroup = el("div", "group")
  bar.append(townButton, toolGroup)
  const buttons = tools.map(({ id, tip }) => {
    const command: Command = commands[id]
    const button = el("button", "")
    button.title = tip
    button.append(iconEl(command.icon), document.createTextNode(command.label), el("kbd", "", command.key ?? ""))
    const action = command.action
    button.onclick = () => ("menu" in action ? controls.toggleMenu(action.menu) : "tool" in action ? controls.choose(action.tool) : undefined)
    toolGroup.append(button)
    return { action, button }
  })
  const speedGroup = el("div", "group speed")
  bar.append(speedGroup)
  const speeds = [
    { speed: 0, label: "", key: "space" },
    { speed: 1, label: "1×", key: "1" },
    { speed: 2, label: "2×", key: "2" },
    { speed: 4, label: "4×", key: "3" }
  ].map(({ speed, label, key }) => {
    const button = el("button", speed === 0 ? "pause" : "", label)
    if (speed === 0) button.append(iconEl("pause", 14))
    button.title = speed === 0 ? "Pause the town, or run it again (space)" : `Run the town at ${label} (${key})`
    // Pause is a switch: pressed again it runs the town at its last speed.
    button.onclick = () => (speed === 0 ? controls.togglePause() : controls.setSpeed(speed))
    speedGroup.append(button)
    return { speed, button }
  })
  // A phone has room for one speed button: it runs a paused town, else goes on to the next speed.
  const cycle = el("button", "cycle")
  cycle.title = "Change speed: 1×, 2×, 4×"
  cycle.onclick = () => controls.cycleSpeed()
  speedGroup.append(cycle)
  bar.append(moreButton)

  return {
    element: bar,
    moreButton,
    /** Shows which tool and panel are picked. */
    refresh: () => {
      for (const { action, button } of buttons) {
        const on = "menu" in action
          ? action.menu === "build" && (ui.menu === "build" || ui.tool === "place" || ui.tool === "ground" || ui.tool === "prop" || ui.tool === "upgrade")
          : "tool" in action && action.tool === ui.tool
        button.classList.toggle("on", on)
      }
      townButton.classList.toggle("on", ui.menu === "town")
    },
    /** Shows the speed, and what pause would run again (`last`). */
    showSpeed: (speed: number, last: number) => {
      for (const s of speeds) s.button.classList.toggle("on", s.speed === speed)
      // Paused, the pause button shows play.
      const pause = speeds[0]!.button
      pause.replaceChildren(iconEl(speed === 0 ? "play" : "pause", 14))
      pause.setAttribute("aria-label", speed === 0 ? "Run the town" : "Pause the town")
      cycle.textContent = `${speed === 0 ? last : speed}×`
      cycle.title = speed === 0 ? `Run the town at ${last}×` : "Change speed: 1×, 2×, 4×"
    }
  }
}
