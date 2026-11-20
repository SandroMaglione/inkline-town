import { WINTER_WARNING } from "../../content/index.ts"
import { Charter, Chronicle, Game, Rules, Pantry, Stock, Time } from "../../schema.ts"
import { elapsed, seasonAt, write } from "../shared.ts"
import { larder } from "../../rules/goals.ts"

/**
 * Winter comes and goes, and the chronicle says so. A minute before it
 * comes, the almanac warns the town how hard it will be, and how long the
 * food in store would last.
 */
export const Seasons = Game.System(
  "Town/Seasons",
  {
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      stock: Game.System.readResource(Stock),
      pantry: Game.System.readResource(Pantry),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ resources, services }) => {
    const rules = services.rules
    const { winters } = rules

    const charter = resources.charter.get()
    const t = elapsed(resources.time.get(), charter)
    if (t <= 0) return
    const now = seasonAt(t, charter, rules)
    const before = seasonAt(t - 1, charter, rules)
    if (now.winter && !before.winter) {
      const w = now.severity ?? "normal"
      write(
        resources.chronicle,
        t,
        { _tag: "winter", severity: w, year: now.year, fishing: Math.round(winters[w].fishing * 100), heating: winters[w].heating }
      )
    }
    if (!now.winter && before.winter) write(resources.chronicle, t, { _tag: "spring", year: now.year })
    if (!now.winter && now.coming !== null && now.left === WINTER_WARNING) {
      const eats = resources.pantry.get().eatenLast
      write(
        resources.chronicle,
        t,
        { _tag: "winterComing", severity: now.coming, larder: larder(resources.stock.get()), eats },
        true
      )
    }
  }
)
