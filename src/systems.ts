/**
 * The yard's systems: the player's intents become factories and belts,
 * factories work through their jobs, crates ride the belts, and the views
 * follow.
 */
import { RenderSync } from "@typeonce/bevy-ts-render"

import { BELT_SPEED, BeltView, CrateView, drawBeltBase, drawBeltHatch, drawBeltRails, drawBuilding, drawPlate, drawPlot, FactoryView, heightOf } from "./art.ts"
import { FOOTPRINT, TILE_H, TILE_W, U, inside, toGrid, toScreen, type Point } from "./iso.ts"
import { kinds, insetOf, nameFor, awningFor, type KindId } from "./kinds.ts"
import { key, lengthOf, pointAt, route, type Usage, type Yard } from "./route.ts"
import {
  Belt, BeltNodes, Clock, Counters, Crate, CrateNodes, DeltaTime, Elapsed, Factory, FactoryNodes, Game,
  Flow, StageService, Totals, Ui, Work
} from "./schema.ts"
import type { BeltValue, FactoryValue, HitBox, Preview, WorkValue } from "./schema.ts"

/** Closest two crates may ride on a belt, in grid cells. */
const SPACING = 7 * U
const BUILD_SECONDS = 2.4

const FactoryRead = Game.Query({ selection: { factory: Game.Query.read(Factory), work: Game.Query.read(Work) } })
const FactoryWrite = Game.Query({ selection: { factory: Game.Query.read(Factory), work: Game.Query.write(Work) } })
const BeltRead = Game.Query({ selection: { belt: Game.Query.read(Belt) } })
const CrateRead = Game.Query({ selection: { crate: Game.Query.read(Crate) } })
const CrateWrite = Game.Query({ selection: { crate: Game.Query.write(Crate) } })

export const AdvanceClock = Game.System(
  "Factory/AdvanceClock",
  {
    resources: { dt: Game.System.writeResource(DeltaTime), elapsed: Game.System.writeResource(Elapsed) },
    services: { clock: Game.System.service(Clock) }
  },
  ({ resources, services }) => {
    resources.dt.set(services.clock.deltaSeconds)
    resources.elapsed.update((t) => t + services.clock.deltaSeconds)
  }
)

// ── Placing and connecting ────────────────────────────────────────────────

/** Moves a belt's ends from the plates' edges in to the buildings' walls. */
const toWalls = (points: ReadonlyArray<Point>, fromInset: number, toInset: number | null): Array<Point> => {
  const out = points.map((p) => ({ x: p.x, y: p.y }))
  const reach = (end: { x: number; y: number }, next: Point, inset: number) => {
    const length = Math.hypot(end.x - next.x, end.y - next.y) || 1
    end.x += ((end.x - next.x) / length) * inset
    end.y += ((end.y - next.y) / length) * inset
  }
  if (out.length >= 2) {
    reach(out[0]!, out[1]!, fromInset)
    if (toInset !== null) reach(out[out.length - 1]!, out[out.length - 2]!, toInset)
  }
  return out
}

interface Placed {
  readonly id: number
  readonly kind: KindId
  readonly x: number
  readonly y: number
}

/** What stands where, kept up to date while one tick's intents are applied. */
class Occupancy implements Yard {
  readonly factories = new Map<number, Placed>()
  readonly cells = new Map<number, number>()
  readonly uses = new Map<number, Usage>()
  readonly beltCells = new Map<number, Array<number>>()
  readonly belts = new Map<number, BeltValue>()

  addFactory(f: Placed) {
    this.factories.set(f.id, f)
    for (let dx = 0; dx < FOOTPRINT; dx++) for (let dy = 0; dy < FOOTPRINT; dy++) this.cells.set(key(f.x + dx, f.y + dy), f.id)
  }

  addBelt(b: BeltValue) {
    this.belts.set(b.id, b)
    b.cells.forEach((c, i) => {
      const k = key(c.x, c.y)
      const u = this.uses.get(k) ?? { h: false, v: false, turn: false }
      const use = b.uses[i]!
      if (use === "turn") u.turn = true
      else u[use] = true
      this.uses.set(k, u)
      this.beltCells.set(k, [...(this.beltCells.get(k) ?? []), b.id])
    })
  }

  blocked = (x: number, y: number) => this.cells.has(key(x, y))
  usage = (x: number, y: number) => this.uses.get(key(x, y))

  canPlace(x: number, y: number) {
    for (let dx = 0; dx < FOOTPRINT; dx++) {
      for (let dy = 0; dy < FOOTPRINT; dy++) {
        const cx = x + dx
        const cy = y + dy
        if (!inside(cx, cy) || this.cells.has(key(cx, cy)) || this.uses.has(key(cx, cy))) return false
      }
    }
    return true
  }
}

/** A building's hit area: its plate, or its walls and roof as drawn. */
const hitBox = (f: FactoryValue): HitBox => {
  const kind = kinds[f.kind]
  const centre = toScreen(f.x + FOOTPRINT / 2, f.y + FOOTPRINT / 2)
  const a = kind.half * U
  const top = centre.y - a * TILE_H - heightOf(kind) - 26
  return {
    id: f.id,
    depth: f.x + f.y + FOOTPRINT,
    contains: (at) => {
      const g = toGrid(at.x, at.y)
      if (g.x >= f.x && g.x <= f.x + FOOTPRINT && g.y >= f.y && g.y <= f.y + FOOTPRINT) return true
      return Math.abs(at.x - centre.x) <= a * TILE_W && at.y >= top && at.y <= centre.y
    }
  }
}

const factoryAt = (hits: ReadonlyArray<HitBox>, at: Point): number | null => hits.find((h) => h.contains(at))?.id ?? null

/** The footprint centred on a point, by its top cell. */
const footprintAt = (at: Point): Point => {
  const g = toGrid(at.x, at.y)
  return { x: Math.floor(g.x - (FOOTPRINT - 1) / 2), y: Math.floor(g.y - (FOOTPRINT - 1) / 2) }
}

const cellAt = (at: Point): Point => {
  const g = toGrid(at.x, at.y)
  return { x: Math.floor(g.x), y: Math.floor(g.y) }
}

const emptyPreview = (): Preview => ({ ghost: null, plots: [], path: null, hoverFactory: null, hoverBelt: null, focus: null, danger: false, tooltip: null })

export const Interact = Game.System(
  "Factory/Interact",
  {
    queries: { factories: FactoryRead, belts: BeltRead, crates: CrateRead },
    resources: { counters: Game.System.writeResource(Counters), totals: Game.System.readResource(Totals), flow: Game.System.readResource(Flow) },
    services: { ui: Game.System.service(Ui) }
  },
  ({ queries, resources, services, commands }) => {
    const ui = services.ui
    let yard = new Occupancy()
    const entities = { factories: new Map<number, unknown>(), belts: new Map<number, unknown>() }
    const works = new Map<number, WorkValue>()
    const names = new Map<number, FactoryValue>()
    for (const { entity, data } of queries.factories.each()) {
      const f = data.factory.get()
      yard.addFactory(f)
      entities.factories.set(f.id, entity.id)
      works.set(f.id, data.work.get())
      names.set(f.id, f)
    }
    for (const { entity, data } of queries.belts.each()) {
      const b = data.belt.get()
      yard.addBelt(b)
      entities.belts.set(b.id, entity.id)
    }
    let hits: Array<HitBox> = [...names.values()].map(hitBox).sort((l, r) => r.depth - l.depth)

    const despawnBelt = (id: number) => {
      const entity = entities.belts.get(id)
      if (entity === undefined) return
      commands.despawn(entity as never)
      for (const crate of queries.crates.each()) if (crate.data.crate.get().belt === id) commands.despawn(crate.entity.id)
      entities.belts.delete(id)
    }

    const removeFactory = (factory: number) => {
      const entity = entities.factories.get(factory)
      if (entity !== undefined) commands.despawn(entity as never)
      for (const b of yard.belts.values()) if (b.from === factory || b.to === factory) despawnBelt(b.id)
      if (ui.selected === factory) ui.selected = null
    }

    const remove = (at: Point) => {
      const factory = factoryAt(hits, at)
      if (factory !== null) return removeFactory(factory)
      const cell = cellAt(at)
      const belt = inside(cell.x, cell.y) ? yard.beltCells.get(key(cell.x, cell.y))?.at(-1) : undefined
      if (belt !== undefined) despawnBelt(belt)
    }

    /** Places a factory, returning its id (or `null` when there is no room). */
    const place = (kind: KindId, cell: Point): number | null => {
      if (!yard.canPlace(cell.x, cell.y)) {
        ui.toast("No room there")
        return null
      }
      const { nextId, placed } = resources.counters.get()
      const factory: FactoryValue = { id: nextId, kind, name: nameFor(placed), color: awningFor(placed), x: cell.x, y: cell.y }
      const work: WorkValue = { status: "building", built: 0, progress: 0, inputs: 0, outputs: 0, shipped: 0, made: 0, turn: 0, pulse: 0 }
      commands.spawn(Game.Command.spawn([Factory, factory], [Work, work]))
      resources.counters.set({ nextId: nextId + 1, placed: placed + 1 })
      yard.addFactory(factory)
      names.set(factory.id, factory)
      works.set(factory.id, work)
      hits = [...names.values()].map(hitBox).sort((l, r) => r.depth - l.depth)
      return factory.id
    }

    const connect = (fromId: number, toId: number) => {
      const from = yard.factories.get(fromId)
      const to = yard.factories.get(toId)
      if (!from || !to || fromId === toId) return
      if (kinds[from.kind].makes === 0) return ui.toast("A depot only takes crates in")
      if (kinds[to.kind].needs === 0) return ui.toast("A source takes nothing in")
      for (const b of yard.belts.values()) if (b.from === fromId && b.to === toId) return ui.toast("Already connected")
      const found = route(yard, from, to)
      if (!found) return ui.toast("No room for a belt")
      const { nextId } = resources.counters.get()
      const points = toWalls(found.points, insetOf(kinds[from.kind]), insetOf(kinds[to.kind]))
      const belt: BeltValue = { id: nextId, from: fromId, to: toId, cells: found.cells, uses: found.uses, points, length: lengthOf(points) }
      commands.spawn(Game.Command.spawn([Belt, belt]))
      resources.counters.update((c) => ({ ...c, nextId: c.nextId + 1 }))
      yard.addBelt(belt)
    }

    /** A plot's top cell lies wholly inside the yard. */
    const onYard = (cell: Point) => inside(cell.x, cell.y) && inside(cell.x + FOOTPRINT - 1, cell.y + FOOTPRINT - 1)

    for (const intent of ui.intents.splice(0)) {
      switch (intent.type) {
        case "place":
          place(intent.kind, intent.cell)
          break
        case "build": {
          if (!ui.plot) break
          const id = place(intent.kind, ui.plot)
          if (id !== null) {
            ui.plot = null
            ui.plotKind = null
            ui.selected = id
          }
          break
        }
        case "remove":
          removeFactory(intent.factory)
          break
        case "link": {
          const at = (cell: Point) => yard.cells.get(key(cell.x, cell.y))
          const from = at(intent.from)
          const to = at(intent.to)
          if (from !== undefined && to !== undefined) connect(from, to)
          break
        }
        case "clear":
          for (const entity of entities.factories.values()) commands.despawn(entity as never)
          for (const id of [...entities.belts.keys()]) despawnBelt(id)
          for (const crate of queries.crates.each()) commands.despawn(crate.entity.id)
          resources.counters.update((c) => ({ ...c, placed: 0 }))
          yard = new Occupancy()
          names.clear()
          hits = []
          ui.selected = null
          ui.dragFrom = null
          ui.linkFrom = null
          ui.plot = null
          break
        case "press":
          ui.dragFrom = ui.mode === "select" && ui.linkFrom === null ? factoryAt(hits, intent.at) : null
          break
        case "release": {
          if (ui.mode === "bulldoze") {
            if (!intent.panned) remove(intent.at)
            break
          }
          const target = factoryAt(hits, intent.at)
          if (ui.dragFrom !== null && target !== null && target !== ui.dragFrom) {
            // Dragged from one factory to another: a belt between them.
            connect(ui.dragFrom, target)
            ui.selected = ui.dragFrom
            ui.plot = null
          } else if (ui.linkFrom !== null) {
            if (!intent.panned) {
              if (target !== null && target !== ui.linkFrom) connect(ui.linkFrom, target)
              ui.linkFrom = null
            }
          } else if (target !== null && target === ui.dragFrom) {
            ui.selected = target
            ui.plot = null
          } else if (!intent.panned) {
            // A tap on the ground picks the plot there (or closes the panel off the yard).
            const cell = footprintAt(intent.at)
            ui.selected = null
            ui.plot = onYard(cell) ? cell : null
            ui.plotKind = null
          }
          ui.dragFrom = null
          break
        }
      }
    }
    if (ui.selected !== null && !yard.factories.has(ui.selected)) ui.selected = null
    if (ui.linkFrom !== null && !yard.factories.has(ui.linkFrom)) ui.linkFrom = null

    // What the pointer is over, and what that brings into focus.
    ui.hits = hits
    const preview = emptyPreview()
    const pointer = ui.pointer
    if (pointer) {
      preview.hoverFactory = factoryAt(hits, pointer)
      const cell = cellAt(pointer)
      preview.hoverBelt = preview.hoverFactory === null && inside(cell.x, cell.y) ? yard.beltCells.get(key(cell.x, cell.y))?.at(-1) ?? null : null
    }

    const around = (id: number) => {
      const factories = new Set([id])
      const belts = new Set<number>()
      for (const b of yard.belts.values()) {
        if (b.from === id || b.to === id) {
          belts.add(b.id)
          factories.add(b.from)
          factories.add(b.to)
        }
      }
      return { factories, belts }
    }

    if (ui.plot) {
      const free = yard.canPlace(ui.plot.x, ui.plot.y)
      preview.plots.push({ ...ui.plot, look: free ? "picked" : "blocked" })
      if (ui.plotKind) preview.ghost = { kind: ui.plotKind, cell: ui.plot, valid: free }
    }

    if (ui.mode === "bulldoze") {
      preview.danger = true
      if (preview.hoverFactory !== null) preview.focus = around(preview.hoverFactory)
      else if (preview.hoverBelt !== null) {
        const b = yard.belts.get(preview.hoverBelt)!
        preview.focus = { factories: new Set([b.from, b.to]), belts: new Set([b.id]) }
      }
    } else {
      const from = ui.dragFrom ?? ui.linkFrom
      const source = from !== null ? yard.factories.get(from) : undefined
      if (source && pointer && preview.hoverFactory !== from) {
        const target = preview.hoverFactory !== null ? yard.factories.get(preview.hoverFactory) : undefined
        const cell = cellAt(pointer)
        const found = target ? route(yard, source, target) : inside(cell.x, cell.y) ? route(yard, source, { cell }) : null
        const allowed = target !== undefined && kinds[source.kind].makes > 0 && kinds[target.kind].needs > 0
        if (found) {
          preview.path = {
            points: toWalls(found.points, insetOf(kinds[source.kind]), target ? insetOf(kinds[target.kind]) : null),
            valid: allowed
          }
        }
      }
      // The plot under the pointer, when a tap there would pick it.
      if (pointer && from === null && preview.hoverFactory === null) {
        const cell = footprintAt(pointer)
        const picked = ui.plot && ui.plot.x === cell.x && ui.plot.y === cell.y
        if (onYard(cell) && !picked) preview.plots.unshift({ ...cell, look: "hover" })
      }
      const focusOn = from ?? preview.hoverFactory ?? ui.selected
      if (focusOn !== null) {
        const focus = around(focusOn)
        if (preview.hoverFactory !== null) focus.factories.add(preview.hoverFactory)
        preview.focus = focus
      }
    }

    const shown = preview.hoverFactory
    const f = shown !== null ? names.get(shown) : undefined
    const w = shown !== null ? works.get(shown) : undefined
    if (f && w) {
      const kind = kinds[f.kind]
      const stock = kind.makes === 0 ? `${w.shipped} shipped` : kind.needs === 0 ? `${w.outputs} ready` : `${w.inputs} in · ${w.outputs} out`
      preview.tooltip = `${kind.title.toLowerCase()}/${f.name}   ${w.status} · ${stock}`
    } else if (preview.hoverBelt !== null) {
      const b = yard.belts.get(preview.hoverBelt)!
      preview.tooltip = `belt ${names.get(b.from)?.name ?? "?"} → ${names.get(b.to)?.name ?? "?"}   ${resources.flow.get()[b.id] ?? 0} crates`
    }
    ui.preview = preview

    // The side panel: the picked factory, or the picked plot.
    const flow = resources.flow.get()
    const link = (id: number, belt: number) => {
      const other = names.get(id)!
      return { id, name: other.name, kind: other.kind, crates: flow[belt] ?? 0 }
    }
    const picked = ui.selected !== null ? names.get(ui.selected) : undefined
    const pickedWork = ui.selected !== null ? works.get(ui.selected) : undefined
    if (picked && pickedWork) {
      const belts = [...yard.belts.values()]
      ui.panel = {
        type: "factory",
        id: picked.id,
        name: picked.name,
        kind: picked.kind,
        status: pickedWork.status,
        inputs: pickedWork.inputs,
        outputs: pickedWork.outputs,
        made: picked.kind === "depot" ? pickedWork.shipped : pickedWork.made,
        takes: belts.filter((b) => b.to === picked.id).map((b) => link(b.from, b.id)),
        feeds: belts.filter((b) => b.from === picked.id).map((b) => link(b.to, b.id)),
        linking: ui.linkFrom === picked.id
      }
    } else if (ui.plot) {
      const { x, y } = ui.plot
      let reason = `${FOOTPRINT} × ${FOOTPRINT} cells, free to build on`
      for (let dx = 0; dx < FOOTPRINT; dx++) {
        for (let dy = 0; dy < FOOTPRINT; dy++) {
          if (yard.cells.has(key(x + dx, y + dy))) reason = "a factory stands here"
          else if (yard.uses.has(key(x + dx, y + dy)) && reason.endsWith("on")) reason = "a belt runs across it"
        }
      }
      ui.panel = { type: "plot", x, y, free: yard.canPlace(x, y), reason }
    } else ui.panel = null

    const centres = new Map<number, Point>()
    for (const f of names.values()) centres.set(f.id, toScreen(f.x + FOOTPRINT / 2, f.y + FOOTPRINT / 2))
    ui.centres = centres

    let crates = 0
    for (const _ of queries.crates.each()) crates++
    ui.stats = { factories: yard.factories.size, belts: yard.belts.size, crates, shipped: resources.totals.get().shipped }
  }
)

// ── Work ──────────────────────────────────────────────────────────────────

export const RunFactories = Game.System(
  "Factory/RunFactories",
  {
    queries: { factories: FactoryWrite, belts: BeltRead, crates: CrateRead },
    resources: { dt: Game.System.readResource(DeltaTime), totals: Game.System.writeResource(Totals) }
  },
  ({ queries, resources, commands }) => {
    const dt = resources.dt.get()
    const outgoing = new Map<number, Array<BeltValue>>()
    const incoming = new Set<number>()
    for (const { data } of queries.belts.each()) {
      const b = data.belt.get()
      outgoing.set(b.from, [...(outgoing.get(b.from) ?? []), b])
      incoming.add(b.to)
    }
    // A belt takes a new crate once the last one has moved off its start.
    const nearest = new Map<number, number>()
    for (const { data } of queries.crates.each()) {
      const c = data.crate.get()
      nearest.set(c.belt, Math.min(nearest.get(c.belt) ?? Infinity, c.distance))
    }

    for (const { data } of queries.factories.each()) {
      const f = data.factory.get()
      const kind = kinds[f.kind]
      const w = { ...data.work.get() }
      w.pulse = Math.max(0, w.pulse - dt * 3)
      if (w.built < 1) {
        w.built = Math.min(1, w.built + dt / BUILD_SECONDS)
        w.status = "building"
        data.work.set(w)
        continue
      }
      const outs = outgoing.get(f.id) ?? []
      const fed = incoming.has(f.id)

      if (w.progress === 0 && w.inputs >= kind.needs && w.outputs + kind.makes <= kind.outputCap && (kind.makes > 0 || w.inputs > 0)) {
        w.inputs -= kind.needs
        w.progress = 1e-6
      }
      if (w.progress > 0) {
        w.progress += dt / kind.period
        if (w.progress >= 1) {
          w.progress = 0
          w.outputs += kind.makes
          w.made += 1
          w.pulse = 1
          if (kind.makes === 0) {
            w.shipped += 1
            resources.totals.update((t) => ({ shipped: t.shipped + 1 }))
          }
        }
      }

      // Send one crate a tick down the next belt with room at its start.
      if (w.outputs > 0) {
        for (let i = 0; i < outs.length; i++) {
          const belt = outs[(w.turn + i) % outs.length]!
          if ((nearest.get(belt.id) ?? Infinity) < SPACING) continue
          const start = belt.points[0]!
          commands.spawn(Game.Command.spawn([Crate, { belt: belt.id, distance: 0, color: f.color, x: start.x, y: start.y }]))
          nearest.set(belt.id, 0)
          w.outputs -= 1
          w.turn = (w.turn + i + 1) % outs.length
          break
        }
      }

      w.status = w.progress > 0
        ? "working"
        : w.outputs + kind.makes > kind.outputCap && kind.makes > 0
        ? outs.length > 0 ? "blocked" : "idle"
        : w.inputs < Math.max(1, kind.needs)
        ? fed ? "starved" : "idle"
        : "working"
      data.work.set(w)
    }
  }
)

export const MoveCrates = Game.System(
  "Factory/MoveCrates",
  {
    queries: { crates: CrateWrite, belts: BeltRead, factories: FactoryWrite },
    resources: { dt: Game.System.readResource(DeltaTime), flow: Game.System.writeResource(Flow) }
  },
  ({ queries, resources, commands }) => {
    const step = BELT_SPEED * resources.dt.get()
    const belts = new Map<number, BeltValue>()
    for (const { data } of queries.belts.each()) belts.set(data.belt.get().id, data.belt.get())
    const targets = new Map<number, { readonly cap: number; readonly ready: boolean; inputs: number; set: (inputs: number) => void }>()
    for (const { data } of queries.factories.each()) {
      const f = data.factory.get()
      const w = data.work.get()
      targets.set(f.id, {
        cap: kinds[f.kind].inputCap,
        ready: w.built >= 1,
        inputs: w.inputs,
        set: (inputs) => data.work.set({ ...data.work.get(), inputs })
      })
    }

    const rows = [...queries.crates.each()]
    const riding = new Map<number, typeof rows>()
    for (const row of rows) {
      const belt = row.data.crate.get().belt
      if (!belts.has(belt)) commands.despawn(row.entity.id)
      else riding.set(belt, [...(riding.get(belt) ?? []), row])
    }

    for (const [id, crates] of riding) {
      const belt = belts.get(id)!
      const target = targets.get(belt.to)
      crates.sort((l, r) => r.data.crate.get().distance - l.data.crate.get().distance)
      let limit = belt.length
      for (const row of crates) {
        const c = row.data.crate.get()
        const distance = Math.max(c.distance, Math.min(c.distance + step, limit))
        // At the end of the belt, the crate goes in if the building has room.
        if (distance >= belt.length - 1e-6 && target && target.ready && target.inputs < target.cap) {
          target.inputs += 1
          target.set(target.inputs)
          resources.flow.update((flow) => ({ ...flow, [id]: (flow[id] ?? 0) + 1 }))
          commands.despawn(row.entity.id)
          continue
        }
        if (distance !== c.distance) {
          const p = pointAt(belt.points, distance)
          row.data.crate.set({ ...c, distance, x: p.x, y: p.y })
        }
        limit = distance - SPACING
      }
    }
  }
)

// ── Views ─────────────────────────────────────────────────────────────────

export const RenderFactories = RenderSync.system(Game, {
  name: "Factory/RenderFactories",
  renderable: Factory,
  registry: FactoryNodes,
  services: { stage: StageService },
  create: ({ renderable, services }) => new FactoryView(renderable.kind, renderable.name, renderable.color, services.stage),
  apply: (node, { renderable }) => node.place(renderable.x, renderable.y)
})

export const RenderBelts = RenderSync.system(Game, {
  name: "Factory/RenderBelts",
  renderable: Belt,
  registry: BeltNodes,
  create: ({ renderable }) => new BeltView(renderable.points),
  apply: () => {}
})

export const RenderCrates = RenderSync.system(Game, {
  name: "Factory/RenderCrates",
  renderable: Crate,
  transform: Crate,
  registry: CrateNodes,
  create: ({ renderable }) => new CrateView(renderable.color),
  apply: (node, { transform }) => node.place(transform.x, transform.y)
})

type Emphasis = "normal" | "dim" | "focus" | "danger"

export const Animate = Game.System(
  "Factory/Animate",
  {
    queries: { factories: FactoryRead, belts: BeltRead, crates: CrateRead },
    resources: { dt: Game.System.readResource(DeltaTime), elapsed: Game.System.readResource(Elapsed) },
    services: { ui: Game.System.service(Ui), factoryNodes: Game.System.service(FactoryNodes), beltNodes: Game.System.service(BeltNodes), crateNodes: Game.System.service(CrateNodes) }
  },
  ({ queries, resources, services }) => {
    const { focus, danger } = services.ui.preview
    const emphasis = (inFocus: boolean): Emphasis => (focus === null ? "normal" : !inFocus ? "dim" : danger ? "danger" : "focus")
    const dt = resources.dt.get()
    // A factory gets a door on its left wall when a belt meets it there (its +y side).
    const leftDoors = new Set<number>()
    const centres = new Map<number, Point>()
    for (const { data } of queries.factories.each()) {
      const f = data.factory.get()
      centres.set(f.id, { x: f.x + FOOTPRINT / 2, y: f.y + FOOTPRINT / 2 })
    }
    for (const { data } of queries.belts.each()) {
      const b = data.belt.get()
      const ends: ReadonlyArray<readonly [number, Point]> = [[b.from, b.points[0]!], [b.to, b.points[b.points.length - 1]!]]
      for (const [id, end] of ends) {
        const c = centres.get(id)
        if (c && end.y - c.y > Math.abs(end.x - c.x)) leftDoors.add(id)
      }
    }
    for (const { entity, data } of queries.factories.each()) {
      const f = data.factory.get()
      services.factoryNodes.get(entity.id as never)?.update(data.work.get(), dt, emphasis(focus?.factories.has(f.id) ?? true), leftDoors.has(f.id))
    }
    for (const { entity, data } of queries.belts.each()) {
      services.beltNodes.get(entity.id as never)?.update(resources.elapsed.get(), emphasis(focus?.belts.has(data.belt.get().id) ?? true))
    }
    for (const { entity, data } of queries.crates.each()) {
      const node = services.crateNodes.get(entity.id as never)
      if (node) node.alpha = focus === null || focus.belts.has(data.crate.get().belt) ? 1 : 0.25
    }
  }
)

/** The ghost of the building being placed, and the belt being dragged. */
export const DrawPreview = Game.System(
  "Factory/DrawPreview",
  {
    resources: { elapsed: Game.System.readResource(Elapsed) },
    services: { ui: Game.System.service(Ui), stage: Game.System.service(StageService) }
  },
  ({ resources, services }) => {
    const { ghost, path } = services.ui.preview
    const { overlay, ghost: shadow } = services.stage
    overlay.clear()
    shadow.clear()
    for (const plot of services.ui.preview.plots) drawPlot(overlay, plot.x, plot.y, plot.look, resources.elapsed.get())
    if (ghost) {
      const kind = kinds[ghost.kind]
      const centre = toScreen(ghost.cell.x + FOOTPRINT / 2, ghost.cell.y + FOOTPRINT / 2)
      shadow.position.set(centre.x, centre.y)
      shadow.zIndex = ghost.cell.x + ghost.cell.y + FOOTPRINT
      drawBuilding(shadow, kind, 0xb9beb5, 1, 0, 0)
      shadow.alpha = ghost.valid ? 0.45 : 0.25
      shadow.tint = ghost.valid ? 0xffffff : 0xf3b5aa
    }
    if (path && path.points.length >= 2) {
      drawBeltBase(overlay, path.points, 0.7)
      drawBeltHatch(overlay, path.points, resources.elapsed.get() * BELT_SPEED, 0.6)
      drawBeltRails(overlay, path.points, path.valid ? 0.9 : 0.45, path.valid ? 0x3d4943 : 0x8f9891)
    }
  }
)

export const setup = Game.Schedule(Interact, Game.Schedule.applyDeferred(), RenderFactories, RenderBelts)

export const update = Game.Schedule(
  AdvanceClock,
  Interact,
  RunFactories,
  Game.Schedule.applyDeferred(),
  MoveCrates,
  Game.Schedule.applyDeferred(),
  RenderFactories,
  RenderBelts,
  RenderCrates,
  Animate,
  DrawPreview
)
