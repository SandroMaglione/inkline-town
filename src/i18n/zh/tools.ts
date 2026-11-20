/**
 * Simplified Chinese for what the player can pick (`view/tools.ts`): what
 * each tool, panel, and map view is called, what its chip says on hover,
 * and what the tool bar says of each tool. A label sits on a tool bar
 * button, a phone's among them, and a Chinese character is as wide as two
 * letters: two characters each, as senshinya's fork named them.
 */
import { home, PAVE_COST, PAVED_PACE, ROAD_COST } from "../../game/content/index.ts"
import type { CommandId, MapViewId, ToolbarId } from "../../view/tools.ts"
import * as token from "../token.ts"
import { cost } from "./said.ts"

/** A command: its label on a button or a chip, and what it does, in a line. */
export const commands = {
  select: { label: "选择", title: "选择建筑或住宅查看详情" },
  road: { label: "道路", title: "道路：拖动铺设" },
  pave: { label: "铺石", title: "铺石：沿道路拖动铺设石料" },
  homes: { label: "住宅", title: "住宅：沿道路拖动建造一排住宅" },
  build: { label: "建造", title: "打开建造菜单" },
  bulldoze: { label: "拆除", title: "拆除格子上的建筑或设施" },
  town: { label: "城镇", title: "打开城镇面板：目标、税收与贸易" },
  speed: { label: "倍速", title: "切换速度：1×、2×、4×" },
  pause: { label: "暂停", title: "暂停或继续游戏" }
} satisfies Record<CommandId, { readonly label: string; readonly title: string }>

/** What the tool bar says of each tool on hover. */
export const toolbar = {
  select: "点击建筑或住宅查看详情 · 拖动平移 · 滚轮缩放",
  road: `拖动铺设道路 · 每格 ${token.coins(ROAD_COST)}`,
  pave: `沿道路拖动铺石：运输员和服务人员的速度提升至 ${PAVED_PACE} 倍，并提高沿街宜居度 · 每格 ${token.coins(PAVE_COST.coins)}和 ${token.amount("stone", PAVE_COST.stone)}`,
  homes: `拖动沿道路建造住宅 · 每栋 ${cost(home.cost)}`,
  build: "选择建筑，再点击放置 · Esc 取消",
  bulldoze: "点击拆除建筑、住宅、道路、树木或农田"
} satisfies Record<ToolbarId, string>

/** A map view: what it is called in the list, on a chip ("火灾视图"), and what it colours the map by. */
export const mapViews = {
  appeal: { label: "宜居度", chip: "宜居度视图", title: "按宜居度着色" },
  workers: { label: "劳动力", chip: "劳动力视图", title: "按劳动力分布着色" },
  fire: { label: "火灾", chip: "火灾视图", title: "按火灾风险着色" },
  health: { label: "健康", chip: "健康视图", title: "按健康风险着色" },
  order: { label: "治安", chip: "治安视图", title: "按盗窃风险着色" },
  condition: { label: "建筑状况", chip: "建筑状况视图", title: "按建筑状况着色" }
} satisfies Record<MapViewId, { readonly label: string; readonly chip: string; readonly title: string }>
