/**
 * Residents out walking: a few from the town's homes wander its roads for a
 * while and go back in, dressed in their household's colour (see
 * `residentDress`). They are only for looking at: not part of the
 * simulation, not saved, and they do nothing to the town.
 */
import { homeAt, residentDress } from "../art.ts"
import { WalkerView } from "./views.ts"
import type { GameScene } from "./scene.ts"
import type { Tier } from "../../game/content/index.ts"
import { DIRS, doors, isRoad } from "../../game/world/grid.ts"
import { U, type Point } from "../../game/world/iso.ts"
import type { GridValue } from "../../game/schema.ts"

/** A home as the townsfolk see it. */
export interface Household {
  readonly x: number
  readonly y: number
  readonly tier: Tier
  readonly residents: number
}

interface Stroller {
  readonly view: WalkerView
  cell: Point
  prev: Point | null
  next: Point
  /** 0 → 1 of the way from `cell` to `next`. */
  t: number
  /** Cells to walk before going home. */
  left: number
  readonly pace: number
  /** How far from the road's middle: on the right, as carriers keep, but further out, by the kerb. */
  readonly side: number
  /** 0 → 1 fading in; below 0 fading out. */
  fade: number
}

/** About one resident in this many is out walking, up to `MOST`. */
const PER = 10
const MOST = 40
/** Cells a second at 1×. */
const PACE = 0.7

export class Townsfolk {
  private readonly layer: GameScene
  private folk: Array<Stroller> = []
  private wait = 0

  constructor(layer: GameScene) {
    this.layer = layer
  }

  /** Everyone goes in: a new town, or one loaded. */
  clear() {
    for (const s of this.folk) s.view.destroy()
    this.folk = []
  }

  /** Moves everyone on by `dt` seconds of the town's time, and sends someone out now and then. */
  step(dt: number, homes: ReadonlyArray<Household>, grid: GridValue) {
    if (dt <= 0) return
    const residents = homes.reduce((n, h) => n + h.residents, 0)
    const want = Math.min(MOST, Math.round(residents / PER))
    this.wait -= dt
    if (this.wait <= 0 && this.folk.length < want) {
      this.wait = 0.4 + Math.random() * 0.8
      this.send(homes, grid)
    }
    for (let i = this.folk.length - 1; i >= 0; i--) {
      const s = this.folk[i]!
      if (!isRoad(grid, s.cell.x, s.cell.y) || !isRoad(grid, s.next.x, s.next.y)) s.fade = Math.min(s.fade, -0.01)
      s.t += dt * s.pace
      while (s.t >= 1) {
        s.t -= 1
        s.prev = s.cell
        s.cell = s.next
        s.left -= 1
        if (s.left <= 0 && s.fade > 0) s.fade = -0.01
        s.next = this.onward(s.cell, s.prev, grid)
      }
      s.fade = s.fade >= 0 ? Math.min(1, s.fade + dt * 2) : s.fade - dt * 2
      if (s.fade <= -1) {
        s.view.destroy()
        this.folk.splice(i, 1)
        continue
      }
      this.place(s)
    }
  }

  /** Someone leaves a home that has a road at its door. */
  private send(homes: ReadonlyArray<Household>, grid: GridValue) {
    const open = homes.filter((h) => h.residents > 0)
    if (open.length === 0) return
    const h = open[Math.floor(Math.random() * open.length)]!
    const out = doors(grid, { x: h.x, y: h.y, size: 1 })
    if (out.length === 0) return
    const start = out[Math.floor(Math.random() * out.length)]!
    const n = Math.random()
    const view = new WalkerView(this.layer, 0, residentDress(homeAt(h.x, h.y).cloth, h.tier, n), null)
    view.alpha = 0
    this.layer.add(view)
    const cell = { x: start.x, y: start.y }
    this.folk.push({
      view,
      cell,
      prev: null,
      next: this.onward(cell, null, grid),
      t: 0,
      left: 6 + Math.floor(Math.random() * 14),
      pace: PACE * (h.tier === 2 ? 0.85 : 1) * (0.85 + n * 0.3),
      side: (4 + Math.round(n)) * U,
      fade: 0
    })
  }

  /** A road cell to go on to: anywhere but back, unless the road ends. */
  private onward(cell: Point, prev: Point | null, grid: GridValue): Point {
    const ways = DIRS.map((d) => ({ x: cell.x + d.x, y: cell.y + d.y })).filter((c) => isRoad(grid, c.x, c.y))
    const ahead = ways.filter((c) => !prev || c.x !== prev.x || c.y !== prev.y)
    const choices = ahead.length > 0 ? ahead : ways
    return choices.length > 0 ? choices[Math.floor(Math.random() * choices.length)]! : cell
  }

  private place(s: Stroller) {
    const dir = { x: s.next.x - s.cell.x, y: s.next.y - s.cell.y }
    // Smoothly, not on the lattice: they walk slower than the town's walkers, and stepping from unit to unit would stutter.
    const units = Math.floor(s.t * 16)
    const along = s.t
    s.view.alpha = s.fade >= 0 ? s.fade : 1 + s.fade
    s.view.update(
      s.cell.x + 0.5 + dir.x * along - dir.y * s.side,
      s.cell.y + 0.5 + dir.y * along + dir.x * s.side,
      dir,
      dir.x === 0 && dir.y === 0 ? 0 : Math.floor(units / 3) % 2,
      { kind: "none" }
    )
  }
}
