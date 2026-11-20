/**
 * Japanese for what the player can pick (`view/tools.ts`): what each tool,
 * panel, and map view is called, what its chip says on hover, and what the
 * tool bar says of each tool. A label sits on a tool bar button, a phone's
 * among them, and each kanji is as wide as two letters: two of them at
 * most, as Japanese game interfaces name their tools.
 */
import { home, PAVE_COST, PAVED_PACE, ROAD_COST } from "../../game/content/index.ts"
import type { CommandId, MapViewId, ToolbarId } from "../../view/tools.ts"
import * as token from "../token.ts"
import { cost } from "./said.ts"

/** A command: its label on a button or a chip, and what it does, in a line. */
export const commands = {
  select: { label: "選択", title: "選択：建物や家を選んで、何をしているかを見る" },
  road: { label: "道路", title: "道路：ドラッグして敷く" },
  pave: { label: "舗装", title: "舗装：道路に沿ってドラッグして舗装する" },
  homes: { label: "住宅", title: "住宅：道路に沿ってドラッグして家を並べる" },
  build: { label: "建設", title: "建設メニューを開く" },
  bulldoze: { label: "撤去", title: "撤去：マスの上にあるものを取り除く" },
  town: { label: "町", title: "町のパネルを開く：目標、税、交易" },
  speed: { label: "速度", title: "時間を早める：1×、2×、4×" },
  pause: { label: "停止", title: "町を一時停止する、または再開する" }
} satisfies Record<CommandId, { readonly label: string; readonly title: string }>

/** What the tool bar says of each tool on hover. */
export const toolbar = {
  select: "建物や家をクリックして何をしているかを見る・ドラッグで移動・ホイールでズーム",
  road: `ドラッグして道路を敷く・1マス${token.coins(ROAD_COST)}`,
  pave: `道路に沿ってドラッグして舗装する。運搬人と巡回人が${PAVED_PACE}倍の速さで歩け、沿道の家にも好まれる・1マス${token.coins(PAVE_COST.coins)}と${token.amount("stone", PAVE_COST.stone)}`,
  homes: `道路に沿ってドラッグして家を並べる・1軒${cost(home.cost)}`,
  build: "建物を選び、クリックして置く・Escで終了",
  bulldoze: "建物、家、道路、木、畑をクリックして取り除く"
} satisfies Record<ToolbarId, string>

/** A map view: what it is called in the list, on a chip ("火災マップ"), and what it colours the map by. */
export const mapViews = {
  appeal: { label: "魅力度", chip: "魅力度マップ", title: "地図を魅力度で色分けする" },
  workers: { label: "労働者", chip: "労働者マップ", title: "地図を労働者で色分けする" },
  fire: { label: "火災", chip: "火災マップ", title: "地図を火災の危険度で色分けする" },
  health: { label: "健康", chip: "健康マップ", title: "地図を病気の危険度で色分けする" },
  order: { label: "治安", chip: "治安マップ", title: "地図を盗難の危険度で色分けする" },
  condition: { label: "状態", chip: "状態マップ", title: "地図を建物の傷み具合で色分けする" }
} satisfies Record<MapViewId, { readonly label: string; readonly chip: string; readonly title: string }>
