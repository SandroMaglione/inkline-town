/**
 * Every view follows its entity once a frame: a building's stage of
 * building, work, wear, risks and the map view's tint; a home's tier and
 * troubles; walkers along their routes with what they carry; trees and
 * fields growing; rocks worked down; fish where the water would give a catch.
 */
import { CONDITION_MAX, condition as wear, goodIds, home, kinds, RESTOCK_TICKS, risk, RISK_MAX, total } from "../../../game/content/index.ts"
import { CELL_STEPS } from "../../../game/schedule.ts"
import { Appeal, Errand, Field, Game, Grid, Rescue, Roam, Rock, Route, Tile, Time, Tree, Water, type GridValue } from "../../../game/schema.ts"
import { appealAt } from "../../../game/world/appeal.ts"
import { entrances, isRoad, type TileLike } from "../../../game/world/grid.ts"
import { U, type Point } from "../../../game/world/iso.ts"
import { buildOf, problemOf, siteShare, worksShare } from "../../../view/facts.ts"
import { BuildingRead, HouseRead, RuinRead } from "../../../view/frame.ts"
import { Clock, Shown } from "../../../view/services.ts"
import type { Alert, Emphasis, Load } from "../../art.ts"
import type { DoorSet } from "../models.ts"
import { rockBlocks, type RockPart } from "../rock-blocks.ts"
import { BuildingNodes, FieldNodes, HouseNodes, RockNodes, RuinNodes, StageService, TreeNodes, WalkerNodes } from "../services.ts"
import { hazardStrength } from "../surface-state.ts"

/** Doors follow road entrances on all four sides as the camera turns. */
const doorsOf = (grid: GridValue, tile: TileLike): DoorSet => {
  const open = entrances(tile).filter((c) => isRoad(grid, c.x, c.y))
  return {
    right: open.some((c) => c.side === 0),
    left: open.some((c) => c.side === 1),
    backRight: open.some((c) => c.side === 2),
    backLeft: open.some((c) => c.side === 3)
  }
}

/** The sign over a home or building: what is wrong now, or the risk nearest the top past `risk.warn`. */
const alertOf = (r: { readonly fire: number; readonly health: number; readonly order: number } | undefined, sick: boolean, worn: boolean): Alert | null => {
  if (sick) return "sick"
  if (r) {
    const worst = (["fire", "health", "order"] as const).reduce((a, b) => (r[b] > r[a] ? b : a))
    if (r[worst] >= risk.warn) return worst
  }
  return worn ? "worn" : null
}

/**
 * Where a walker stands, in cells: on the lattice, a little to one side of
 * the road's middle; which way it faces; and which foot is forward.
 */
const walkerAt = (route: { readonly cells: ReadonlyArray<Point>; readonly index: number; readonly step: number }) => {
  const here = route.cells[route.index]!
  const next = route.cells[route.index + 1]
  const before = route.cells[route.index - 1]
  const dir = next ? { x: next.x - here.x, y: next.y - here.y } : before ? { x: here.x - before.x, y: here.y - before.y } : { x: 0, y: 0 }
  const units = next ? Math.floor(route.step / (CELL_STEPS / 16)) : 0
  const along = units * U
  const side = 2 * U
  return {
    x: here.x + 0.5 + dir.x * along - dir.y * side,
    y: here.y + 0.5 + dir.y * along + dir.x * side,
    dir,
    phase: next ? Math.floor(units / 3) % 2 : 0
  }
}

/** Neighbouring rocks drawn as one outcrop, formed again only when a rock runs out (or the land changes). */
const rockShapes: { key: string; parts: Map<number, RockPart> } = { key: "", parts: new Map() }

export const Animate = Game.System(
  "Town/Animate",
  {
    queries: {
      buildings: BuildingRead,
      houses: HouseRead,
      ruins: RuinRead,
      walkers: Game.Query({
        selection: {
          route: Game.Query.read(Route),
          errand: Game.Query.optional(Errand),
          roam: Game.Query.optional(Roam),
          rescue: Game.Query.optional(Rescue)
        }
      }),
      trees: Game.Query({ selection: { tree: Game.Query.read(Tree) } }),
      rocks: Game.Query({ selection: { rock: Game.Query.read(Rock), tile: Game.Query.read(Tile) } }),
      fields: Game.Query({ selection: { field: Game.Query.read(Field) } }),
      water: Game.Query({ selection: { tile: Game.Query.read(Tile), water: Game.Query.read(Water) } })
    },
    resources: { grid: Game.System.readResource(Grid), appeal: Game.System.readResource(Appeal), time: Game.System.readResource(Time) },
    services: {
      stage: Game.System.service(StageService),
      shown: Game.System.service(Shown),
      clock: Game.System.service(Clock),
      ruinNodes: Game.System.service(RuinNodes),
      buildingNodes: Game.System.service(BuildingNodes),
      houseNodes: Game.System.service(HouseNodes),
      walkerNodes: Game.System.service(WalkerNodes),
      treeNodes: Game.System.service(TreeNodes),
      rockNodes: Game.System.service(RockNodes),
      fieldNodes: Game.System.service(FieldNodes)
    }
  },
  ({ queries, resources, services }) => {
    const grid = resources.grid.get()
    const cells = resources.appeal.get().cells
    const { hover, danger } = services.shown.scene.preview
    const emphasis = (id: number): Emphasis => (danger && hover === id ? "danger" : "normal")
    const dt = services.clock.deltaSeconds
    // Fish where the water would give a catch now; none where it rests after one.
    const tick = resources.time.get().step
    const water = queries.water.data
    services.stage.setFish(queries.water.each().filter((entity) => tick - water.water.get(entity).fished >= RESTOCK_TICKS).map((entity) => water.tile.get(entity)))

    const building = queries.buildings.data
    for (const entity of queries.buildings.each()) {
      const kind = kinds[building.building.get(entity).kind]
      const status = building.status.get(entity)
      // An upgrade the town needs now, and can make (see `upgradesWanted`).
      const upgradable = services.shown.scene.wanted.has(entity.id)
      const recipe = building.recipe.get(entity)
      const walkers = building.walkers.get(entity)?.length ?? 0
      const worn = (building.condition.get(entity)?.value ?? CONDITION_MAX) < wear.worn
      const r = building.risk.get(entity)
      services.buildingNodes.get(entity.id)?.update(
        {
          alert: alertOf(r ? { fire: r.fire, health: 0, order: 0 } : undefined, false, worn),
          burning: building.burning.has(entity),
          worn,
          effects: {
            wear: 1-(building.condition.get(entity)?.value??CONDITION_MAX)/CONDITION_MAX,
            fireRisk: hazardStrength(r?.fire??0,risk.warn,RISK_MAX)
          },
          working: status === "working",
          tint: services.shown.scene.tints.get(entity.id),
          problem: problemOf(kind, status) !== null,
          build: buildOf(building.site.get(entity), building.rising.get(entity)),
          beat: recipe ? recipe.made : building.service.get(entity) ? walkers : 0,
          doors: doorsOf(grid, building.tile.get(entity)),
          site: siteShare(building.site.get(entity)),
          level: building.upgraded.get(entity)?.level ?? 0,
          works: worksShare(building.works.get(entity)),
          upgradable
        },
        dt,
        emphasis(entity.id)
      )
    }
    const house = queries.houses.data
    for (const entity of queries.houses.each()) {
      const tile = house.tile.get(entity)
      const worn = (house.condition.get(entity)?.value ?? CONDITION_MAX) < wear.worn
      const desirability = appealAt(cells, tile.x, tile.y)
      services.houseNodes
        .get(entity.id)
        ?.update(
          {
            tier: house.house.get(entity).tier,
            build: buildOf(house.site.get(entity), house.rising.get(entity)),
            doors: doorsOf(grid, tile),
            site: siteShare(house.site.get(entity)),
            alert: house.site.has(entity) ? null : alertOf(house.risk.get(entity), house.sick.has(entity), worn),
            burning: house.burning.has(entity),
            worn,
            effects: {
              wear: Math.max(desirability<0?0.55:0,1-(house.condition.get(entity)?.value??CONDITION_MAX)/CONDITION_MAX),
              fireRisk: hazardStrength(house.risk.get(entity)?.fire??0,risk.warn,RISK_MAX),
              health: hazardStrength(house.risk.get(entity)?.health??0,risk.warn,RISK_MAX),
              order: hazardStrength(house.risk.get(entity)?.order??0,risk.warn,RISK_MAX),
              sick: Number(house.sick.has(entity))
            },
            band: desirability < 0 ? "poor" : desirability >= home.tiers[2].appeal ? "fine" : "plain",
            closed: house.closed.has(entity),
            tint: services.shown.scene.tints.get(entity.id)
          },
          emphasis(entity.id)
        )
    }
    for (const entity of queries.ruins.each()) services.ruinNodes.get(entity.id)?.update(emphasis(entity.id))
    const walker = queries.walkers.data
    for (const entity of queries.walkers.each()) {
      const p = walkerAt(walker.route.get(entity))
      const errand = walker.errand.get(entity)
      const roam = walker.roam.get(entity)
      const load: Load = errand
        ? { kind: "cart", good: errand.good, count: !errand.back || errand.count > 0 ? errand.count : 0 }
        : walker.rescue.get(entity)
          ? { kind: "service", role: "firefighter" }
        : roam?.service === "fire"
          ? { kind: "service", role: "watchman" }
        : roam?.service === "health"
          ? { kind: "service", role: "physician" }
        : roam?.service === "order"
          ? { kind: "service", role: "constable" }
        : roam?.service === "repair"
          ? { kind: "service", role: "builder" }
        : roam?.service === "faith"
          ? { kind: "bell" }
          : roam && total(roam.basket) > 0
            ? { kind: "basket", goods: goodIds.filter((g) => roam.basket[g] > 0) }
            : { kind: "none" }
      services.walkerNodes.get(entity.id)?.update(p.x, p.y, p.dir, p.phase, load)
    }
    const tree = queries.trees.data
    for (const entity of queries.trees.each())
      services.treeNodes.get(entity.id)?.update(tree.tree.get(entity).growth, emphasis(entity.id))
    // Neighbouring rocks are drawn as one big outcrop; the blocks are formed again only when a rock runs out (or the land changes).
    const rocks = queries.rocks.each()
    const rock = queries.rocks.data
    const rockKey = `${rocks.length}:${rocks.reduce((n, entity) => n + entity.id, 0)}`
    if (rockKey !== rockShapes.key) {
      rockShapes.key = rockKey
      rockShapes.parts = rockBlocks(rocks.map((entity) => ({ id: entity.id, ...rock.tile.get(entity), ore: rock.rock.get(entity).ore })))
    }
    const amounts = new Map<number, number>(rocks.map((entity) => [entity.id, rock.rock.get(entity).amount]))
    for (const entity of rocks) {
      const r = rock.rock.get(entity)
      const part = rockShapes.parts.get(entity.id)
      if (!part || !part.draws) services.rockNodes.get(entity.id)?.update(r.ore, r.amount, part ? 0 : 1, part ? 0 : 1)
      else services.rockNodes.get(entity.id)?.update(r.ore, part.members.reduce((n, id) => n + (amounts.get(id) ?? 0), 0) / part.members.length, part.w, part.h)
    }
    const field = queries.fields.data
    for (const entity of queries.fields.each()) services.fieldNodes.get(entity.id)?.update(field.field.get(entity).growth)
  }
)
