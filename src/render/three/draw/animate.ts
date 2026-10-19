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
    services.stage.setFish(queries.water.each().filter(({ data }) => tick - data.water.get().fished >= RESTOCK_TICKS).map(({ data }) => data.tile.get()))

    for (const { entity, data } of queries.buildings.each()) {
      const kind = kinds[data.building.get().kind]
      const status = data.status.get()
      // An upgrade the town needs now, and can make (see `upgradesWanted`).
      const upgradable = services.shown.scene.wanted.has(entity.id)
      const recipe = data.recipe.value()
      const walkers = data.walkers.value()?.length ?? 0
      const worn = (data.condition.value()?.value ?? CONDITION_MAX) < wear.worn
      const r = data.risk.value()
      services.buildingNodes.get(entity.id)?.update(
        {
          alert: alertOf(r ? { fire: r.fire, health: 0, order: 0 } : undefined, false, worn),
          burning: data.burning.present,
          worn,
          effects: {
            wear: 1-(data.condition.value()?.value??CONDITION_MAX)/CONDITION_MAX,
            fireRisk: hazardStrength(r?.fire??0,risk.warn,RISK_MAX)
          },
          working: status === "working",
          tint: services.shown.scene.tints.get(entity.id),
          problem: problemOf(kind, status) !== null,
          build: buildOf(data.site.value(), data.rising.value()),
          beat: recipe ? recipe.made : data.service.value() ? walkers : 0,
          doors: doorsOf(grid, data.tile.get()),
          site: siteShare(data.site.value()),
          level: data.upgraded.value()?.level ?? 0,
          works: worksShare(data.works.value()),
          upgradable
        },
        dt,
        emphasis(entity.id)
      )
    }
    for (const { entity, data } of queries.houses.each()) {
      const tile = data.tile.get()
      const worn = (data.condition.value()?.value ?? CONDITION_MAX) < wear.worn
      const desirability = appealAt(cells, tile.x, tile.y)
      services.houseNodes
        .get(entity.id)
        ?.update(
          {
            tier: data.house.get().tier,
            build: buildOf(data.site.value(), data.rising.value()),
            doors: doorsOf(grid, tile),
            site: siteShare(data.site.value()),
            alert: data.site.present ? null : alertOf(data.risk.value(), data.sick.present, worn),
            burning: data.burning.present,
            worn,
            effects: {
              wear: Math.max(desirability<0?0.55:0,1-(data.condition.value()?.value??CONDITION_MAX)/CONDITION_MAX),
              fireRisk: hazardStrength(data.risk.value()?.fire??0,risk.warn,RISK_MAX),
              health: hazardStrength(data.risk.value()?.health??0,risk.warn,RISK_MAX),
              order: hazardStrength(data.risk.value()?.order??0,risk.warn,RISK_MAX),
              sick: Number(data.sick.present)
            },
            band: desirability < 0 ? "poor" : desirability >= home.tiers[2].appeal ? "fine" : "plain",
            closed: data.closed.present,
            tint: services.shown.scene.tints.get(entity.id)
          },
          emphasis(entity.id)
        )
    }
    for (const { entity } of queries.ruins.each()) services.ruinNodes.get(entity.id)?.update(emphasis(entity.id))
    for (const { entity, data } of queries.walkers.each()) {
      const p = walkerAt(data.route.get())
      const errand = data.errand.value()
      const roam = data.roam.value()
      const load: Load = errand
        ? { kind: "cart", good: errand.good, count: !errand.back || errand.count > 0 ? errand.count : 0 }
        : data.rescue.value()
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
    for (const { entity, data } of queries.trees.each())
      services.treeNodes.get(entity.id)?.update(data.tree.get().growth, emphasis(entity.id))
    // Neighbouring rocks are drawn as one big outcrop; the blocks are formed again only when a rock runs out (or the land changes).
    const rocks = queries.rocks.each()
    const rockKey = `${rocks.length}:${rocks.reduce((n, { entity }) => n + entity.id, 0)}`
    if (rockKey !== rockShapes.key) {
      rockShapes.key = rockKey
      rockShapes.parts = rockBlocks(rocks.map(({ entity, data }) => ({ id: entity.id, ...data.tile.get(), ore: data.rock.get().ore })))
    }
    const amounts = new Map<number, number>(rocks.map(({ entity, data }) => [entity.id, data.rock.get().amount]))
    for (const { entity, data } of rocks) {
      const r = data.rock.get()
      const part = rockShapes.parts.get(entity.id)
      if (!part || !part.draws) services.rockNodes.get(entity.id)?.update(r.ore, r.amount, part ? 0 : 1, part ? 0 : 1)
      else services.rockNodes.get(entity.id)?.update(r.ore, part.members.reduce((n, id) => n + (amounts.get(id) ?? 0), 0) / part.members.length, part.w, part.h)
    }
    for (const { entity, data } of queries.fields.each()) services.fieldNodes.get(entity.id)?.update(data.field.get().growth)
  }
)
