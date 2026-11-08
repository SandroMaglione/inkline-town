import { every } from "../../content/index.ts"
import { appealGrid, buildingSource, homeSource, landSource, parkSources, type AppealSource } from "../../world/appeal.ts"
import { Appeal, Building, Condition, Game, Rules, House, Park, Paused, Paved, Rising, Road, Ruin, Site, Tile, Time, Tree, Upgraded, Water } from "../../schema.ts"

/** Reckons every cell's desirability, every `appeal.every` steps (and at once when there is none yet). */
export const Appraise = Game.System(
  "Town/Appraise",
  {
    queries: {
      buildings: Game.Query({ selection: { tile: Game.Query.read(Tile), building: Game.Query.read(Building), upgraded: Game.Query.optional(Upgraded) }, without: [Site, Rising] }),
      trees: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Tree] }),
      water: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Water] }),
      paved: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road, Paved] }),
      parks: Game.Query({ selection: { tile: Game.Query.read(Tile), park: Game.Query.read(Park) } }),
      roads: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Road] }),
      ruins: Game.Query({ selection: { tile: Game.Query.read(Tile) }, with: [Ruin] }),
      homes: Game.Query({ selection: { tile: Game.Query.read(Tile), condition: Game.Query.read(Condition), house: Game.Query.read(House), closed: Game.Query.optional(Paused) }, without: [Site, Rising] })
    },
    resources: { time: Game.System.readResource(Time), appeal: Game.System.writeResource(Appeal) },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules
    const { appeal, condition: wear } = rules

    if (!every(resources.time.get(), appeal.every) && resources.appeal.get().cells.length > 0) return
    const sources: Array<AppealSource> = []
    const { data: buildings } = queries.buildings
    for (const entity of queries.buildings.each()) {
      const s = buildingSource(buildings.building.get(entity).kind, buildings.tile.get(entity), rules, buildings.upgraded.get(entity)?.level ?? 0)
      if (s) sources.push(s)
    }
    for (const entity of queries.trees.each()) sources.push(landSource("forest", queries.trees.data.tile.get(entity), rules))
    for (const entity of queries.water.each()) sources.push(landSource("water", queries.water.data.tile.get(entity), rules))
    for (const entity of queries.paved.each()) sources.push(landSource("paved", queries.paved.data.tile.get(entity), rules))
    const roads = new Set(queries.roads.each().map((entity) => `${queries.roads.data.tile.get(entity).x},${queries.roads.data.tile.get(entity).y}`))
    const { data: parks } = queries.parks
    sources.push(...parkSources(queries.parks.each().map((entity) => ({ ...parks.tile.get(entity), ...parks.park.get(entity) })), (x, y) => roads.has(`${x},${y}`), rules))
    for (const entity of queries.ruins.each()) sources.push(landSource("ruin", queries.ruins.data.tile.get(entity), rules))
    const { data: homes } = queries.homes
    for (const entity of queries.homes.each()) {
      if (homes.condition.get(entity).value < wear.worn) sources.push(landSource("worn", homes.tile.get(entity), rules))
      const fine = homes.closed.has(entity) ? null : homeSource(homes.house.get(entity).tier, homes.tile.get(entity), rules)
      if (fine) sources.push(fine)
    }
    resources.appeal.set({ cells: appealGrid(sources, rules) })
  }
)
