/** What the simulation told the player this step: toasts to show, and the panel's selection. */
import { Game, Selection, Toast } from "../game/schema.ts"
import { Interaction, Shown } from "./services.ts"

export const ShowFeedback = Game.System(
  "Town/ShowFeedback",
  {
    events: { toast: Game.System.readEvent(Toast), selection: Game.System.readEvent(Selection) },
    services: { interaction: Game.System.service(Interaction), shown: Game.System.service(Shown) }
  },
  ({ events, services }) => {
    const ui = services.interaction
    for (const message of events.toast.all()) services.shown.town.toasts.push(message)
    for (const change of events.selection.all()) {
      if ("select" in change) ui.selected = change.select
      else if ("clear" in change) ui.selected = null
      else if (ui.selected === change.clearIf) ui.selected = null
    }
  }
)
