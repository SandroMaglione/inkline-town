import { spoilExpectation } from "../rules/decay.ts"
/**
 * What time does to the town: homes and buildings run down until a builder
 * mends them, and fall into ruin if none does; fish and bread rot on the
 * shelf, slower in a granary. The pantry keeps count of what the town ate
 * and what rotted, a minute at a time.
 */
import * as Random from "@typeonce/bevy-ts-math/Random"

import { ruinDraft } from "../archetypes.ts"
import { goodIds, ticks } from "../content.ts"
import { counted, placeName } from "../places.ts"
import { Building, Burning, Charter, Chronicle, Condition, Game, Rules, House, Inventory, Pantry, Rising, Rng, Site, Tile, Time, maybe } from "../schema.ts"
import { elapsed, write } from "./shared.ts"

/** The pantry warns of rotting food at most this often. */
const ROT_WARNING = ticks(5 * 60)

export const Decay = Game.System(
  "Town/Decay",
  {
    queries: {
      worn: Game.Query({
        selection: { tile: Game.Query.read(Tile), condition: Game.Query.write(Condition), house: Game.Query.optional(House), building: Game.Query.optional(Building) },
        without: [Site, Rising, Burning]
      }),
      landmarks: Game.Query({ selection: { tile: Game.Query.read(Tile), building: Game.Query.read(Building) }, without: [Site, Rising] }),
      shelves: Game.Query({ selection: { inventory: Game.Query.write(Inventory), building: Game.Query.optional(Building) }, without: [Site, Rising] })
    },
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      rng: Game.System.writeResource(Rng),
      pantry: Game.System.writeResource(Pantry),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { kinds, condition: wear, spoils, spoilTicks: SPOIL_TICKS } = rules

    const tick = resources.time.get().tick
    const t = elapsed(resources.time.get(), resources.charter.get())

    // Wear: a point every `wear.every` steps; at nothing it falls down.
    if (tick % wear.every === 0) {
      const landmarks = queries.landmarks.each().map(({ data }) => ({ kind: data.building.get().kind, ...data.tile.get() }))
      for (const { entity, data } of queries.worn.each()) {
        const value = data.condition.get().value - 1
        if (value > 0) {
          data.condition.set({ value })
          continue
        }
        const tile = data.tile.get()
        const b = maybe(data.building)
        commands.despawn(entity.id)
        commands.spawn(ruinDraft(tile, "collapsed"))
        write(
          resources.chronicle,
          t,
          b ? `The ${kinds[b.kind].title.toLowerCase()} on ${placeName(landmarks, tile)} fell down: nobody mended it.` : `A home on ${placeName(landmarks, tile)} fell down: nobody mended it.`,
          true
        )
      }
    }

    // Spoiling: each shelf loses its share of what spoils, a granary's a fifth as much.
    if (tick % SPOIL_TICKS === 0) {
      const random = Random.make(resources.rng.get())
      let rotted = 0
      for (const { data } of queries.shelves.each()) {
        const inv = data.inventory.get()
        const keeps = kinds[maybe(data.building)?.kind ?? "townhall"].keeps ?? 1
        let stock = inv.stock
        for (const g of goodIds) {
          const life = spoils[g]
          if (life === undefined || stock[g] <= 0) continue
          const expected = spoilExpectation(stock[g], g, keeps, rules)
          const lose = Math.min(stock[g], Math.floor(expected) + (random.next() < expected % 1 ? 1 : 0))
          if (lose <= 0) continue
          stock = { ...stock, [g]: stock[g] - lose }
          rotted += lose
        }
        if (stock !== inv.stock) data.inventory.set({ ...inv, stock })
      }
      resources.rng.set(random.state)
      if (rotted > 0) resources.pantry.update((p) => ({ ...p, rotted: p.rotted + rotted }))
    }

    // The pantry's minute.
    if (t > 0 && t % 3600 === 0) {
      const p = resources.pantry.get()
      const warn = p.rotted >= 6 && t - p.warned >= ROT_WARNING
      if (warn) write(resources.chronicle, t, `${counted(p.rotted, "fish or loaf", "fish and loaves")} rotted in store this minute: a granary keeps them five times as long, and smoked fish keeps.`, true)
      resources.pantry.set({ eaten: 0, rotted: 0, eatenLast: p.eaten, rottedLast: p.rotted, warned: warn ? t : p.warned })
    }
  }
)
