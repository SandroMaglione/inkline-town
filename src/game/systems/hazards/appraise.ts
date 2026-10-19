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
    for (const { data } of queries.buildings.each()) {
      const s = buildingSource(data.building.get().kind, data.tile.get(), rules, data.upgraded.value()?.level ?? 0)
      if (s) sources.push(s)
    }
    for (const { data } of queries.trees.each()) sources.push(landSource("forest", data.tile.get(), rules))
    for (const { data } of queries.water.each()) sources.push(landSource("water", data.tile.get(), rules))
    for (const { data } of queries.paved.each()) sources.push(landSource("paved", data.tile.get(), rules))
    const roads = new Set(queries.roads.each().map(({ data }) => `${data.tile.get().x},${data.tile.get().y}`))
    sources.push(...parkSources(queries.parks.each().map(({ data }) => ({ ...data.tile.get(), ...data.park.get() })), (x, y) => roads.has(`${x},${y}`), rules))
    for (const { data } of queries.ruins.each()) sources.push(landSource("ruin", data.tile.get(), rules))
    for (const { data } of queries.homes.each()) {
      if (data.condition.get().value < wear.worn) sources.push(landSource("worn", data.tile.get(), rules))
      const fine = data.closed.present ? null : homeSource(data.house.get().tier, data.tile.get(), rules)
      if (fine) sources.push(fine)
    }
    resources.appeal.set({ cells: appealGrid(sources, rules) })
  }
)
