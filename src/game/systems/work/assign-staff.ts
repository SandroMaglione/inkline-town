import { every } from "../../content/index.ts"
import { crewOf, stepsOf, type Crew } from "../../content/index.ts"
import { doors, key, reach } from "../../world/grid.ts"
import { Building, Burning, Game, Rules, Grid, House, Paused, Rising, Site, Staff, Tile, Time } from "../../schema.ts"
import { assignWorkers } from "../../rules/production.ts"

/** Workers are reassigned this often: residents move in and out every few seconds, no faster. */
export const STAFF_TICKS = stepsOf(0.5)

/**
 * Residents go to work at the workplaces within a commute of their home
 * (`COMMUTE` road cells), nearest homes first; the workplaces with the
 * fewest of their crew within reach are staffed first (in the order they
 * were placed, among equals), so a mine with its own cottages is not robbed
 * of them by a workshop in town. Settlers do the rough work and citizens the skilled; citizens
 * never take a settlers' job, and settlers fill a citizens' job only once
 * every workplace has had its own crew, as apprentices at a slower pace. A
 * paused or burning building gets nobody.
 */
export const AssignStaff = Game.System(
  "Town/AssignStaff",
  {
    queries: {
      homes: Game.Query({ selection: { tile: Game.Query.read(Tile), house: Game.Query.read(House) }, without: [Site, Rising, Burning] }),
      workplaces: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          building: Game.Query.read(Building),
          staff: Game.Query.write(Staff),
          paused: Game.Query.optional(Paused),
          burning: Game.Query.optional(Burning)
        },
        without: [Site, Rising]
      })
    },
    resources: { grid: Game.System.readResource(Grid), time: Game.System.readResource(Time) },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules
    const { kinds, commute: COMMUTE, staffTicks: STAFF_TICKS } = rules

    if (!every(resources.time.get(), STAFF_TICKS)) return
    const grid = resources.grid.get()
    const homes: Array<{ readonly id: number; readonly crew: Crew; left: number; readonly doors: ReadonlyArray<{ readonly x: number; readonly y: number }> }> = []
    for (const { entity, data } of queries.homes.each()) {
      const h = data.house.get()
      const ds = doors(grid, data.tile.get())
      if (h.residents > 0 && ds.length > 0) homes.push({ id: entity.id, crew: crewOf(h.tier), left: h.residents, doors: ds })
    }
    type Row = ReturnType<typeof queries.workplaces.each>[number]
    const places: Array<{
      readonly id: number;
      readonly data: Row["data"]
      readonly staff: { readonly needed: number; readonly assigned: number; readonly apprentices: number; readonly nearby: number }
      readonly crew: Crew
      readonly within: ReadonlyArray<{ readonly home: (typeof homes)[number]; readonly distance: number }>
      assigned: number
      apprentices: number
      readonly nearby: number
    }> = []
    for (const { entity, data } of queries.workplaces.each()) {
      const staff = data.staff.get()
      if (staff.needed === 0) continue
      const crew = kinds[data.building.get().kind].crew
      const starts = doors(grid, data.tile.get())
      const within: Array<{ readonly home: (typeof homes)[number]; readonly distance: number }> = []
      if (starts.length > 0 && !data.paused.present && !data.burning.present) {
        const roads = reach(grid, starts)
        for (const home of homes) {
          let distance = -1
          for (const d of home.doors) {
            const n = roads.distance[key(d.x, d.y)]!
            if (n >= 0 && (distance < 0 || n < distance)) distance = n
          }
          if (distance >= 0 && distance <= COMMUTE) within.push({ home, distance })
        }
        within.sort((a, b) => a.distance - b.distance)
      }
      const nearby = within.reduce((n, w) => n + (w.home.crew === crew ? w.home.left : 0), 0)
      places.push({ id: entity.id, data, staff, crew, within, assigned: 0, apprentices: 0, nearby })
    }
    const assigned = assignWorkers(
      homes.map((h) => ({ id: h.id, crew: h.crew, residents: h.left })),
      places.map((p) => ({ id: p.id, crew: p.crew, needed: p.staff.needed,
        within: p.within.map((w) => ({ home: w.home.id, distance: w.distance })) }))
    )
    for (const { id, data, staff } of places) {
      const next = assigned.get(id)!
      if (staff.assigned !== next.assigned || staff.apprentices !== next.apprentices || staff.nearby !== next.nearby) data.staff.set({ ...staff, ...next })
    }
  }
)
