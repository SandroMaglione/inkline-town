import { Burning, Census, Game, House, Paused, Rising, Sick, Site, Staff } from "../../schema.ts"
import { met } from "../../rules/households.ts"

export const TakeCensus = Game.System(
  "Town/TakeCensus",
  {
    queries: {
      homes: Game.Query({ selection: { house: Game.Query.read(House), sick: Game.Query.optional(Sick) }, without: [Site, Rising, Paused] }),
      workplaces: Game.Query({ selection: { staff: Game.Query.read(Staff) }, without: [Site, Rising] }),
      burning: Game.Query({ selection: { burning: Game.Query.read(Burning) } })
    },
    resources: { census: Game.System.writeResource(Census) }
  },
  ({ queries, resources }) => {
    let homes = 0
    let settlers = 0
    let citizens = 0
    let burghers = 0
    let sick = 0
    const needs = { food: 0, bread: 0, cloth: 0, faith: 0, furniture: 0 }
    for (const { data } of queries.homes.each()) {
      const h = data.house.get()
      homes += 1
      if (h.tier === 1) settlers += h.residents
      else citizens += h.residents
      if (h.tier === 3) burghers += h.residents
      if (data.sick.present) sick += 1
      for (const n of ["food", "bread", "cloth", "faith", "furniture"] as const) if (met(h, n)) needs[n] += 1
    }
    let jobs = 0
    let employed = 0
    for (const { data } of queries.workplaces.each()) {
      const s = data.staff.get()
      jobs += s.needed
      employed += s.assigned
    }
    resources.census.set({ homes, settlers, citizens, burghers, jobs, employed, ...needs, sick, burning: queries.burning.each().length })
  }
)
