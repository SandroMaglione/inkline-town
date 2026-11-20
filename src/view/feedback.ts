/**
 * What the simulation told the player this step: toasts to show (it says
 * them as data; here they are put into the words of the language in use),
 * and the panel's selection.
 */
import { Game, Selection, Toast } from "../game/schema.ts"
import { say } from "../i18n/index.ts"
import { Interaction, Shown, Words } from "./services.ts"

export const ShowFeedback = Game.System(
  "Town/ShowFeedback",
  {
    events: { toast: Game.System.readEvent(Toast), selection: Game.System.readEvent(Selection) },
    services: { interaction: Game.System.service(Interaction), shown: Game.System.service(Shown), words: Game.System.service(Words) }
  },
  ({ events, services }) => {
    const ui = services.interaction
    for (const notice of events.toast.all()) services.shown.town.toasts.push(say(services.words.current.notice, notice))
    for (const change of events.selection.all()) {
      if ("select" in change) ui.selected = change.select
      else if ("clear" in change) ui.selected = null
      else if (ui.selected === change.clearIf) ui.selected = null
    }
  }
)
