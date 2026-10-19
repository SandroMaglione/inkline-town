/**
 * The town's upgrades: every one it could make, kind by kind and level by
 * level, for the town panel; the ones it needs now, for the gold arrows; and
 * a word for the first of those while nothing is being upgraded.
 */
import { anA, goodIds, kindOrder, kinds, nextUpgrade, ranks, risk, upgradeAt, type KindId } from "../game/content/index.ts"
import { upgradeChanges, upgradePrice } from "../game/rules/upgrades.ts"
import { met, upgradeBlock } from "../game/schedule.ts"
import type { TileLike } from "../game/world/grid.ts"
import type { Alert } from "./contracts.ts"
import { growingNear } from "./facts.ts"
import type { BuildingRow, Frame, HouseRow } from "./frame.ts"

/** Why each building's upgrade is needed now, by its id, reckoned once a second (see `upgradesWanted`). */
export interface Wanted {
  at: number
  why: ReadonlyMap<number, string>
}
export const noneWanted = (): Wanted => ({ at: -1, why: new Map() })

/**
 * The upgrades the town needs now, by the building, each with why: not every one it could make, but those
 * where the building is what holds the town back. A town hall the next rank asks for, or whose shelves are
 * full; a warehouse full; a quarry worked out; a farm whose mills wait on wheat; a bakery working flat out
 * while homes go without bread; a market whose walkers leave homes unreached; a chapel whose priests leave
 * homes without faith; a fire watch with homes on its streets at high fire risk.
 */
export const upgradesWanted = (frame: Frame, wanted: Wanted): ReadonlyMap<number, string> => {
  const { grid, buildings, houses } = frame
  const tick = frame.world.time.step
  if (Math.floor(tick / 60) === wanted.at) return wanted.why
  const why = new Map<number, string>()
  const standingRows = buildings.filter((r) => !r.data.site.present && !r.data.rising.present && !r.data.works.value())
  const homes = houses.filter((r) => !r.data.site.present && !r.data.rising.present && !r.data.closed.present)
  const full = (r: BuildingRow) => {
    const inv = r.data.inventory.value()
    return !!inv && goodIds.some((g) => inv.accepts.includes(g) && inv.stock[g] >= inv.cap * 0.9)
  }
  const near = (r: BuildingRow, tile: TileLike, range: number) => {
    const t = r.data.tile.get()
    return Math.abs(tile.x - (t.x + t.size / 2)) + Math.abs(tile.y - (t.y + t.size / 2)) <= range
  }
  const fishy = (r: HouseRow, need: "bread" | "faith") => r.data.house.get().tier >= 2 && !met(r.data.house.get(), need)
  const nextHall = ranks[Math.min(frame.world.fate.rank + 1, ranks.length - 1)]!.hall
  const millsWait = standingRows.some((r) => r.data.building.get().kind === "mill" && r.data.status.get() === "starved")
  const breadShort = frame.world.stock.bread < 5 && homes.some((r) => fishy(r, "bread"))
  for (const r of standingRows) {
    const kind = kinds[r.data.building.get().kind], level = r.data.upgraded.value()?.level ?? 0, status = r.data.status.get()
    if (!nextUpgrade(kind, level)) continue
    const reach = r.data.service.value()?.range ?? 0
    const reason =
      kind.id === "townhall" ? (nextHall > level ? "the next rank asks for it" : full(r) ? "its shelves are full" : null)
      : kind.id === "warehouse" ? (full(r) ? "its shelves are full" : null)
      : kind.id === "quarry" ? (status === "starved" && growingNear(grid, r.data.tile.get(), kind, frame.rockAt) ? "it has worked its rock down" : null)
      : kind.id === "farm" ? (millsWait ? "the mills wait on wheat" : null)
      : kind.id === "bakery" ? (status === "working" && breadShort ? "homes go without bread while it works flat out" : null)
      : kind.id === "market" ? (frame.unreachedHomes() > 0 ? "homes lie beyond every food walker" : null)
      : kind.id === "chapel" ? (homes.some((h) => fishy(h, "faith") && !near(r, h.data.tile.get(), reach)) ? "homes lie beyond its priest" : null)
      : kind.id === "firewatch" ? (homes.some((h) => (h.data.risk.value()?.fire ?? 0) >= risk.warn && near(r, h.data.tile.get(), reach + 6)) ? "homes on its streets are at high fire risk" : null)
      : null
    if (reason) why.set(r.entity.id, reason)
  }
  wanted.at = Math.floor(tick / 60)
  wanted.why = why
  return why
}

/** Every upgrade the town could make; the buildings to arrow (`due`); and the hint for the first, if it is time for one. */
export const upgradesOf = (frame: Frame, needed: ReadonlyMap<number, string>) => {
  const { buildings } = frame
  const rank = frame.world.fate.rank
  let hint: Alert | null = null
  const upgradeRows = new Map<string, { kind: KindId; level: number; ready: number; underway: number; first: (typeof buildings)[number] | null }>()
  // Every buildable kind's first upgrade is listed, built or not, so the menu says what is to come; the town hall's by where it stands.
  for (const id of kindOrder) if (kinds[id].upgrade) upgradeRows.set(`${id}:0`, { kind: id, level: 0, ready: 0, underway: 0, first: null })
  for (const row of buildings) {
    const { data } = row
    if (data.site.present || data.rising.present) continue
    const kind = kinds[data.building.get().kind]
    const level = data.upgraded.value()?.level ?? 0
    const works = data.works.value()
    const from = works ? works.level - 1 : level
    if (!nextUpgrade(kind, from)) continue
    const k = `${kind.id}:${from}`
    const entry = upgradeRows.get(k) ?? { kind: kind.id, level: from, ready: 0, underway: 0, first: null }
    if (works) entry.underway += 1
    else {
      entry.ready += 1
      entry.first ??= row
    }
    upgradeRows.set(k, entry)
  }
  const upgrades = [...upgradeRows.values()].map((r) => {
    const kind = kinds[r.kind], up = nextUpgrade(kind, r.level)!
    return {
      kind: r.kind, level: r.level, from: (upgradeAt(kind, r.level)?.title ?? kind.title).toLowerCase(), to: up.title.toLowerCase(), blurb: up.blurb,
      coins: up.cost.coins, materials: up.cost.materials, price: upgradePrice(up), changes: upgradeChanges(kind, r.level),
      blocked: upgradeBlock(up, rank, { ranks }), ready: r.ready, underway: r.underway, first: r.first
    }
  })
  // The upgrades the town needs now, where it can make them (the rank reached, the coins in hand): a gold arrow over each,
  // and a word for the first while nothing is being upgraded.
  const coinsNow = frame.world.treasury.coins
  // One arrow a kind: the first building of it that needs it (one farm made an estate is the answer, not all of them).
  const arrowed = new Set<KindId>()
  const due = new Map([...needed].filter(([id]) => {
    const row = buildings.find((b) => b.entity.id === id)
    const kind = row && kinds[row.data.building.get().kind]
    const up = row && kind && nextUpgrade(kind, row.data.upgraded.value()?.level ?? 0)
    if (!up || !kind || arrowed.has(kind.id) || upgradeBlock(up, rank, { ranks }) !== null || coinsNow < up.cost.coins) return false
    arrowed.add(kind.id)
    return true
  }))
  const [firstId, firstWhy] = [...due][0] ?? []
  const dueFirst = firstId === undefined ? undefined : buildings.find((b) => b.entity.id === firstId)
  if (dueFirst && !upgrades.some((u) => u.underway > 0)) {
    const kind = kinds[dueFirst.data.building.get().kind], level = dueFirst.data.upgraded.value()?.level ?? 0
    const from = (upgradeAt(kind, level)?.title ?? kind.title).toLowerCase(), to = nextUpgrade(kind, level)!.title.toLowerCase()
    hint = { tone: "hint", text: `${firstWhy}: the ${from} can become ${anA(to)}. {Tap|Click} it, under its gold arrow, to begin`, at: dueFirst.data.tile.get(), size: dueFirst.data.tile.get().size, id: dueFirst.entity.id }
  }
  return { upgrades: upgrades.map(({ first: _first, ...u }) => u), due, hint }
}
