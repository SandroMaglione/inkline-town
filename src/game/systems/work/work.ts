import { upgradeAt } from "../../content/index.ts"
import { around, ownerAt, useAt } from "../../world/grid.ts"
import { Building, Charter, Chronicle, Flow, Condition, Field, Game, Rules, Gatherer, Grid, Inventory, Paused, Recipe, Rising, Rock, Site, Staff, Status, Tile, Time, Tree, Upgraded, type Status as StatusValue, Water } from "../../schema.ts"
import { connected, elapsed, seasonAt, write } from "../shared.ts"
import { equipmentPace, effort, paced } from "../../rules/production.ts"
import { each } from "./per-good.ts"

/**
 * One step of every recipe. A job starts when there is room for what it
 * makes, its input is in, and (for a gatherer) the land has what it needs
 * within reach: a grown tree is felled, a rock chipped, a ripe field
 * reaped, a rested cell of water fished. Then the crew puts its
 * worker-steps in; a full crew finishes in `period` steps. It goes at half
 * pace without the tools it wears out, and
 * at half pace again once it is run down; in winter, fishing goes at the
 * winter's pace (a hard winter's is a quarter).
 */
export const Work = Game.System(
  "Town/Work",
  {
    queries: {
      workshops: Game.Query({
        selection: {
          tile: Game.Query.read(Tile),
          building: Game.Query.read(Building),
          staff: Game.Query.read(Staff),
          recipe: Game.Query.write(Recipe),
          inventory: Game.Query.write(Inventory),
          status: Game.Query.write(Status),
          gatherer: Game.Query.optional(Gatherer),
          paused: Game.Query.optional(Paused),
          condition: Game.Query.optional(Condition),
          upgraded: Game.Query.optional(Upgraded)
        },
        without: [Site, Rising]
      }),
      trees: Game.Query({ selection: { tree: Game.Query.read(Tree) } }),
      rocks: Game.Query({ selection: { rock: Game.Query.write(Rock) } }),
      fields: Game.Query({ selection: { field: Game.Query.write(Field) } }),
      waters: Game.Query({ selection: { water: Game.Query.write(Water) } })
    },
    resources: {
      grid: Game.System.readResource(Grid),
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      flow: Game.System.writeResource(Flow),
      chronicle: Game.System.writeResource(Chronicle)
    },
    services: { rules: Game.System.service(Rules) },
    commands: Game.System.commands(Game.System.despawns(Tree))
  },
  ({ queries, resources, commands, services }) => {
    const rules = services.rules
    const { kinds, winters, grown: GROWN } = rules
    const made: Record<string, number> = {}

    const grid = resources.grid.get()
    const tick = resources.time.get().step
    const t = elapsed(resources.time.get(), resources.charter.get())
    const season = seasonAt(t, resources.charter.get(), rules)
    const fishing = season.severity ? winters[season.severity].fishing : 1
    // The land by entity, looked up only once some gatherer starts a job this step.
    const lazy = <T>(make: () => T) => {
      let value: T | undefined
      return () => (value ??= make())
    }
    const trees = lazy(() => new Map(queries.trees.each().map((entity) => [entity.id as number, entity])))
    const rocks = lazy(() => new Map(queries.rocks.each().map((entity) => [entity.id as number, entity])))
    const fields = lazy(() => new Map(queries.fields.each().map((entity) => [entity.id as number, entity])))
    const waters = lazy(() => new Map(queries.waters.each().map((entity) => [entity.id as number, entity])))
    const land = { tree: queries.trees.data.tree, rock: queries.rocks.data.rock, field: queries.fields.data.field, water: queries.waters.data.water }
    const used = new Set<number>()
    // A worked face gives one more now and then.
    if (tick % rules.faceTicks === 0)
      for (const entity of queries.rocks.each()) {
        const r = land.rock.get(entity)
        if (r.amount <= 0) land.rock.set(entity, { ...r, amount: 1 })
      }

    /** Takes what a gatherer needs from the land within reach, or says there is none. */
    const gather = (source: "tree" | "stone" | "ore" | "field" | "water", tile: { x: number; y: number; size: number }, radius: number, deep = false): boolean => {
      for (const c of around(tile, radius)) {
        const use = useAt(grid, c.x, c.y)
        const id = ownerAt(grid, c.x, c.y)
        if (used.has(id)) continue
        if (source === "water" && use === "water") {
          // A cell fished rests a while before it gives another catch.
          const water = waters().get(id)
          if (!water || tick - land.water.get(water).fished < rules.restockTicks) continue
          land.water.set(water, { fished: tick })
          used.add(id)
          return true
        }
        if (source === "tree" && use === "tree") {
          const tree = trees().get(id)
          if (!tree || land.tree.get(tree).growth < GROWN.tree) continue
          commands.despawn(tree)
          used.add(id)
          return true
        }
        if ((source === "stone" || source === "ore") && use === "rock") {
          const rock = rocks().get(id)
          if (!rock) continue
          const r = land.rock.get(rock)
          if (r.ore !== (source === "ore")) continue
          // A masonry cuts a worked face at full pace (see `Upgrade.deep`); anyone else waits for it.
          if (r.amount <= 0) {
            if (!deep) continue
            used.add(id)
            return true
          }
          // Quarried down, a rock stays as a worked face (see `FACE_TICKS`).
          land.rock.set(rock, { ...r, amount: r.amount - 1 })
          if (r.amount === 2 && ![...rocks().values()].some((o) => o !== rock && land.rock.get(o).ore === r.ore && land.rock.get(o).amount >= 2))
            write(
              resources.chronicle,
              t,
              r.ore
                ? "The last of the open ore is dug: the worked faces still give a little, slowly. Traders sell ore and tools."
                : "The last of the open stone is quarried: the worked faces still give a little, slowly. Traders sell stone.",
              true,
              c
            )
          return true
        }
        if (source === "field" && use === "field") {
          const field = fields().get(id)
          if (!field || land.field.get(field).growth < GROWN.field) continue
          land.field.set(field, { growth: 0 })
          used.add(id)
          return true
        }
      }
      return false
    }

    const { data } = queries.workshops
    for (const entity of queries.workshops.each()) {
      const tile = data.tile.get(entity)
      const kind = kinds[data.building.get(entity).kind]
      const staff = data.staff.get(entity)
      const gatherer = data.gatherer.get(entity)
      let recipe = data.recipe.get(entity)
      const inventory = data.inventory.get(entity)
      let stock = inventory.stock
      const open = connected(grid, tile)
      const room = stock[recipe.output] + recipe.batch <= inventory.cap
      const fed = recipe.input === null || stock[recipe.input] >= recipe.inputs
      let short = !fed

      if (open && staff.assigned > 0 && recipe.progress === 0 && room && fed) {
        const deep = upgradeAt(kind, data.upgraded.get(entity)?.level ?? 0)?.deep ?? false
        if (gatherer && !gather(gatherer.source, tile, gatherer.radius, deep)) short = true
        else {
          if (recipe.input !== null) stock = { ...stock, [recipe.input]: stock[recipe.input] - recipe.inputs }
          recipe = { ...recipe, progress: 1 }
        }
      }

      const pace = equipmentPace(kind, stock.tools, data.condition.get(entity)?.value ?? Infinity, fishing, rules)
      const put = effort(staff, tick, rules)
      if (open && recipe.progress > 0 && put > 0 && paced(pace, tick)) {
        const progress = recipe.progress + put
        if (progress > recipe.period * staff.needed) {
          recipe = { ...recipe, progress: 0, made: recipe.made + 1 }
          stock = { ...stock, [recipe.output]: stock[recipe.output] + recipe.batch }
          made[recipe.output] = (made[recipe.output] ?? 0) + recipe.batch
          // Every so many jobs wear out a tool.
          if (kind.wear && recipe.made % kind.wear === 0 && stock.tools > 0) stock = { ...stock, tools: stock.tools - 1 }
        } else recipe = { ...recipe, progress }
      }
      const status: StatusValue = data.paused.has(entity)
        ? "paused"
        : !open
        ? "unconnected"
        : staff.assigned === 0
        ? "unstaffed"
        : recipe.progress > 0
        ? "working"
        : !room
        ? "blocked"
        : short
        ? "starved"
        : "idle"
      data.recipe.set(entity, recipe)
      if (stock !== inventory.stock) data.inventory.set(entity, { ...inventory, stock })
      if (data.status.get(entity) !== status) data.status.set(entity, status)
    }
    if (Object.keys(made).length > 0) resources.flow.update((f) => ({ ...f, made: each((g) => f.made[g] + (made[g] ?? 0)) }))
  }
)
