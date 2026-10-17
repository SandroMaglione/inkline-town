import { spoilExpectation } from "../rules/decay.ts"
/**
 * What time does to the town: homes and buildings run down until a builder
 * mends them, and fall into ruin if none does; fish and bread rot on the
 * shelf, slower in a granary. The pantry keeps count of what the town ate
 * and what rotted, a minute at a time.
 */
import * as Random from "@typeonce/ritmo-math/Random"

import { RuinParts, ruinDraft } from "../archetypes.ts"
import { foods, goodIds, stepsOf } from "../content.ts"
import { counted, placeName } from "../places.ts"
import { Building, Burning, Charter, Chronicle, Condition, Game, Rules, House, Inventory, Pantry, Recipe, Rising, Rng, Site, Staff, Tile, Time, maybe } from "../schema.ts"
import { elapsed, write } from "./shared.ts"

/** The pantry warns of rotting food at most this often. */
const ROT_WARNING = stepsOf(5 * 60)

export const Decay = Game.System(
  "Town/Decay",
  {
    queries: {
      worn: Game.Query({
        selection: { tile: Game.Query.read(Tile), condition: Game.Query.write(Condition), house: Game.Query.optional(House), building: Game.Query.optional(Building) },
        without: [Site, Rising, Burning]
      }),
      landmarks: Game.Query({ selection: { tile: Game.Query.read(Tile), building: Game.Query.read(Building) }, without: [Site, Rising] }),
      shelves: Game.Query({ selection: { inventory: Game.Query.write(Inventory), building: Game.Query.optional(Building) }, without: [Site, Rising] }),
      /** Who makes food, and whether anyone is at work there: for the rot warning's reckoning of what the town makes. */
      makers: Game.Query({ selection: { recipe: Game.Query.read(Recipe), staff: Game.Query.read(Staff) }, with: [Building], without: [Site, Rising, Burning] })
    },
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      rng: Game.System.writeResource(Rng),
      pantry: Game.System.writeResource(Pantry),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.spawns(...RuinParts), Game.System.despawns(Condition))
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { kinds, condition: wear, spoils, spoilTicks: SPOIL_TICKS } = rules

    const tick = resources.time.get().step
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
        commands.despawn(entity)
        commands.spawn(ruinDraft(tile, "collapsed"))
        write(
          resources.chronicle,
          t,
          b ? `The ${kinds[b.kind].title.toLowerCase()} on ${placeName(landmarks, tile)} fell down: nobody mended it.` : `A home on ${placeName(landmarks, tile)} fell down: nobody mended it.`,
          true,
          tile
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
      const warn = p.rotted >= 6 && p.rotted * 4 >= p.eaten && t - p.warned >= ROT_WARNING
      if (warn) {
        // What the town could make of food a minute with the crews it has, against what it ate: rot is the difference, not a want of granaries.
        let made = 0
        for (const { data } of queries.makers.each()) {
          const r = data.recipe.get()
          if (data.staff.get().assigned > 0 && (foods as ReadonlyArray<string>).includes(r.output)) made += (r.batch * 3600) / r.period
        }
        const cause = made > p.eaten * 1.5
          ? `the town makes about ${Math.round(made)} food a minute and eats ${p.eaten}: fewer fisheries, a smokehouse, or selling fish would stop the waste`
          : `a granary keeps fish and bread five times as long, and smoked fish keeps`
        write(resources.chronicle, t, `${counted(p.rotted, "fish or loaf", "fish and loaves")} rotted in store this minute: ${cause}.`, true)
      }
      resources.pantry.set({ eaten: 0, rotted: 0, eatenLast: p.eaten, rottedLast: p.rotted, warned: warn ? t : p.warned })
    }
  }
)
