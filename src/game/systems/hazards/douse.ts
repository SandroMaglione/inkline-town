import { ruinDraft } from "../../world/archetypes.ts"
import { Burning, Fires, Game, House, Rescue, Route, Ruin, Tile } from "../../schema.ts"

const BurningRead = Game.Query({ selection: { tile: Game.Query.read(Tile), burning: Game.Query.read(Burning), house: Game.Query.optional(House) } })

/**
 * A firefighter at the blaze puts it out: the house is lost, but the fire
 * goes no further. Then the firefighter walks back to the watch.
 */
export const Douse = Game.System(
  "Town/Douse",
  {
    queries: { crews: Game.Query({ selection: { route: Game.Query.write(Route), rescue: Game.Query.write(Rescue) } }), burning: BurningRead },
    resources: { fires: Game.System.writeResource(Fires) },
    commands: Game.System.commands(Game.System.spawns(Ruin), Game.System.despawns(Rescue, Burning))
  },
  ({ queries, resources, commands }) => {
    for (const { entity, data } of queries.crews.each()) {
      const route = data.route.get()
      const rescue = data.rescue.get()
      const arrived = route.index >= route.cells.length - 1
      if (!arrived) continue
      if (rescue.back) {
        commands.despawn(entity)
        continue
      }
      const target = queries.burning.getHandle(rescue.target)
      if (target.ok) {
        const b = target.value.data.burning.get()
        commands.despawn(target.value.entity)
        commands.spawn(ruinDraft(target.value.data.tile.get(), "burnt"))
        const house = target.value.data.house.present
        resources.fires.update((f) => ({
          ...f,
          fires: f.fires.map((x) => (x.id === b.fire ? { ...x, homes: x.homes + (house ? 1 : 0), buildings: x.buildings + (house ? 0 : 1) } : x))
        }))
      }
      data.route.set({ cells: [...route.cells].reverse(), index: 0, step: 0 })
      data.rescue.set({ ...rescue, back: true })
    }
  }
)
