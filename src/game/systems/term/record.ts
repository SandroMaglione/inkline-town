import { HISTORY_TICKS } from "../../content/index.ts"
import { Census, Charter, Fate, Game, History, Ledger, Mood, Time, Treasury } from "../../schema.ts"
import { elapsed } from "../shared.ts"

/** A sample of the town every `HISTORY_TICKS`. */
export const Record = Game.System(
  "Town/Record",
  {
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      census: Game.System.readResource(Census),
      treasury: Game.System.readResource(Treasury),
      ledger: Game.System.readResource(Ledger),
      mood: Game.System.readResource(Mood),
      fate: Game.System.readResource(Fate),
      history: Game.System.writeResource(History)
    }
  },
  ({ resources }) => {
    const t = elapsed(resources.time.get(), resources.charter.get())
    if (t <= 0 || t % HISTORY_TICKS !== 0) return
    const f = resources.fate.get()
    if (f.state !== "playing") return
    const census = resources.census.get()
    const ledger = resources.ledger.get()
    const sample = {
      tick: t,
      coins: resources.treasury.get().coins,
      residents: census.settlers + census.citizens,
      citizens: census.citizens,
      approval: resources.mood.get().approval,
      net: ledger.taxes + ledger.trade - ledger.upkeep - ledger.admin
    }
    resources.history.update((h) => ({ samples: [...h.samples, sample].slice(-1000) }))
  }
)
