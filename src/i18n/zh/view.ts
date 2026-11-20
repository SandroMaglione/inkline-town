/**
 * Simplified Chinese for what the view reads off the town (`src/view`): the
 * panels of a building, a home, a park, and a ruin; why something is not
 * working and what to do about it; the alerts; the tooltip under the
 * pointer; the map views' legends; and what an upgrade changes. The same
 * entries as English's (`satisfies typeof English`), each with the same
 * tokens in it, in the words senshinya's fork gave the panels.
 *
 * A panel's labels are short nouns ("维护费", "劳动力"); a reason or a piece
 * of advice under a row is a short clause with no full stop ("在附近建造仓库"),
 * and what is read as sentences (behind an ⓘ, a map view's legend) ends in
 * 。. The parts of a line are set apart with " · ", as the fork sets them; a
 * cost keeps English's dots, which the page drops between its icons.
 */
import { COMMUTE, home, type Crew, type GoodId, type GroundId, type Kind, type KindId, type Need, type PropId, type Tier } from "../../game/content/index.ts"
import type { Cause, RiskId, Street } from "../../game/rules/explain.ts"
import type { GoalId } from "../../game/rules/goals.ts"
import type { Salvage } from "../../game/rules/salvage.ts"
import type { Change } from "../../game/rules/upgrades.ts"
import type { Lock } from "../../game/said.ts"
import type { Status } from "../../game/schema.ts"
import type { AppealLabel, AppealPart, ParkLabel } from "../../game/world/appeal.ts"
import type { view as English } from "../en/view.ts"
import type { Problem } from "../../view/facts.ts"
import type { PlaceProblem } from "../../view/interaction/placing.ts"
import type { LegendKeys } from "../../view/overlay.ts"
import type { WantedReason } from "../../view/upgrades.ts"
import * as token from "../token.ts"
import { say, type Wording } from "../wording.ts"
import { signed } from "./grammar.ts"
import { built, goods, grounds, needs, props, tiers } from "./nouns.ts"
import { cost, lock, salvage } from "./said.ts"

const kindName = (id: KindId, level = 0) => built(id, level).noun.word
/** A building as a chip, by the word given (an upgrade's name) or its plain name. */
const chip = (id: KindId, shown?: string) => token.kind(id, shown)
const town = token.command("town")
/** Who works a building, as its homes are called. */
const crewPeople = (crew: Crew) => tiers[crew === "citizens" ? 2 : 1].people
/** A span of seconds, to a tenth: "4.5 秒". */
const seconds = (s: number) => `${Math.round(s * 10) / 10} 秒`

/** What a cause or a problem says: why, and (when there is something to do) what. */
interface Told {
  readonly why: string
  readonly fix?: string
}
/** A building's problem: in a word or two, why in a line, and what to do. */
interface ToldProblem extends Told {
  readonly label: string
}
/** One thing an upgrade changes, as a row: what, from what to what, and what qualifies it. */
interface Gain {
  readonly label: string
  readonly value?: string
  readonly note?: string
}

// ── Streets: what makes one, and what would lift it ───────────────────────

/** What a source of desirability is called in a street's readout. */
const source = {
  kind: (l) => kindName(l.kind, l.level),
  homes: () => "邻近优质住宅",
  water: () => "水域",
  woods: () => "树林",
  paved: () => "石铺道路",
  ruin: () => "废墟",
  worn: () => "破旧住宅",
  park: () => "公园"
} satisfies Wording<AppealLabel>

/** What counts most against a street, in a line: "采石场 −6、仓库 −2". */
const against = (parts: ReadonlyArray<AppealPart>, most = 2): string =>
  parts.filter((p) => p.value < 0).slice(0, most).map((p) => `${say(source, p.label)} ${signed(p.value)}`).join("、")

const street = {
  source,
  against,
  /** A street against what the next tier needs: "当前 −4，需要 5：采石场 −6". */
  short: (s: Street, needed: number): string => {
    const why = against(s.parts)
    return `当前 ${signed(s.desirability)}，需要 ${needed}${why ? `：${why}` : ""}`
  },
  /** What would lift a street: the things a mayor can do (`dragged`: something drags it down). Buildings as chips. */
  advice: (dragged: boolean): string =>
    dragged ? `移走附近工业建筑，或增建公园、${chip("chapel")}、石铺道路` : `在附近增建公园、${chip("chapel")}或石铺道路`
}

// ── Why a home lacks something ────────────────────────────────────────────

const notLately = {
  food: "市场配送员近期未经过",
  bread: "市场配送员近期未携带面包经过",
  cloth: "市场配送员近期未携带布料经过",
  faith: "传教士近期未经过",
  furniture: "市场配送员近期未携带家具经过"
} satisfies Record<Need, string>

const noneInTown = {
  food: { why: "城镇没有食物库存", fix: `在水边建造${chip("fishery")}，这是最快的办法` },
  bread: { why: "城镇没有面包", fix: `建造${chip("bakery")}：${chip("farm")}的${token.good("wheat")}送至${chip("mill")}，${token.good("flour")}再送至${chip("bakery")}` },
  cloth: { why: "城镇没有布料", fix: `建造${chip("weaver")}：将${chip("sheep")}的${token.good("wool")}织成布料` },
  furniture: { why: "城镇没有家具", fix: `建造${chip("carpenter")}：用${token.good("planks")}制作${token.good("furniture")}` }
} satisfies Record<Exclude<Need, "faith">, Told>

const risks = { fire: "火灾", health: "疾病", order: "治安" } satisfies Record<RiskId, string>

/** Why a need is unmet, and what to do about it: the cause in a line, the cure with its buildings as chips. */
const cause: Wording<Cause, Told> = {
  noWalker: (c) =>
    c.service === "market"
      ? { why: "市场配送员无法到达此街区", fix: `建造${chip("market")}：市场配送范围为 ${c.range} 格道路，${chip("townhall")}为 ${c.hallRange} 格` }
      : { why: "传教士无法到达此街区", fix: `建造${chip("chapel")}：传教士可行走 ${c.range} 格道路` },
  tooPoor: (c) => ({
    why: `此处不配送${needs[c.need]}：街区宜居度至少需要 ${c.needed}，当前为 ${signed(c.desirability)}`,
    fix: "提高街区宜居度（查看“街区”一项）"
  }),
  noneInTown: (c) => noneInTown[c.need],
  notLately: (c) => ({ why: notLately[c.need] }),
  unkept: (c) => ({
    why: `${c.high.map((r) => risks[r]).join("、")}风险未受控制`,
    fix: `${chip("firewatch")}、${chip("healer")}和${chip("watchhouse")}的服务人员都需要经过此处`
  })
}

// ── Why a building is not working ─────────────────────────────────────────

const sources = { stone: "石料", ore: "矿石", field: "成熟作物" } as const

/** Why a building is not working: in a word or two, why in a line, and what to do (its buildings and goods as chips). */
const problem: Wording<Problem, ToldProblem> = {
  unconnected: () => ({ label: "未连接道路", why: "建筑一侧的中点需要连接道路", fix: "沿建筑一侧铺设道路" }),
  noWorkersNear: (p) => ({
    label: "缺少工人",
    why: `${COMMUTE} 格道路内没有${p.crew === "citizens" ? "市民住宅（或移民小屋）" : "移民小屋"}`,
    fix: "在附近建造住宅，或铺路连接附近住宅"
  }),
  workersTaken: () => ({ label: "缺少工人", why: "附近居民都已有工作", fix: `在 ${COMMUTE} 格道路内增建住宅` }),
  full: () => ({ label: "库存已满", why: "产品无处可送", fix: `在附近建造${chip("warehouse")}，或在${town}面板中出售积压物资` }),
  paused: () => ({ label: "已暂停", why: "不雇佣工人，维护费为四分之一", fix: "点击下方按钮恢复工作" }),
  fishedOut: (p) => ({
    label: "鱼群恢复中",
    why: `范围内水域已被捕捞，每处水域捕鱼后需休养 ${p.seconds} 秒`,
    fix: `为渔场保留更长的独立岸线，或减少同片水域上的${chip("fishery")}`
  }),
  noWater: (p) => ({ label: "没有水域", why: `${p.radius} 格内没有水域`, fix: "将其重建在岸边" }),
  workedOut: (p) => ({
    label: "矿藏已采尽",
    why: `范围内的采空矿面会缓慢产出少量${goods[p.source].word}`,
    fix: `在未采尽的矿藏旁重建，或在${town}面板中购买${token.good(p.source)}`
  }),
  growing: (p) => ({ label: "等待中", why: `范围内的${p.source === "tree" ? "树木" : "作物"}尚未成熟` }),
  noTrees: (p) => ({ label: "没有成熟树木", why: `${p.radius} 格内没有成熟树木`, fix: `在附近建造${chip("forester")}，补种树木` }),
  noSource: (p) => ({ label: `缺少${sources[p.source]}`, why: `${p.radius} 格内没有${sources[p.source]}`, fix: "在资源附近重建" }),
  noInput: (p) => ({
    label: `缺少${goods[p.good].word}`,
    why: `等待${goods[p.good].word}`,
    fix: p.maker ? `建造${chip(p.maker)}，或在${town}面板中购买${token.good(p.good)}` : `在${town}面板中购买${token.good(p.good)}`
  }),
  nothingToHandOut: () => ({ label: "无物资可配送", why: "没有可配送的鲜鱼、面包或布料", fix: "补充仓储物资，配送员从中取货" }),
  noPlanks: () => ({ label: "缺少木板", why: "没有可供修缮的材料", fix: `建造${chip("sawmill")}` }),
  waiting: () => ({ label: "等待中", why: "等待中" }),
  onFire: () => ({ label: "着火了！", why: "工人已逃离", fix: `${chip("firewatch")}的消防员可扑灭火灾` })
}

// ── Upgrades ──────────────────────────────────────────────────────────────

/** What an upgrade changes, a row each: what, from what to what, and (after a comma, in a line) what qualifies it. */
const change: Wording<Change, Gain> = {
  output: (c) => ({ label: goods[c.good].word, value: `每分钟 ${c.from} → ${c.to}（每批耗时 ${seconds(c.secondsFrom)} → ${seconds(c.secondsTo)}）` }),
  workers: (c) => ({ label: "工人", value: `${c.from} → ${c.to} 人` }),
  holds: (c) => ({ label: "每种物资容量", value: `${c.from} → ${c.to}` }),
  carriers: (c) => ({ label: "运输员", value: `${c.from} → ${c.to} 人` }),
  firefighters: (c) => ({ label: "消防员", value: `${c.from} → ${c.to} 人` }),
  reach: (c) => ({ label: "服务范围", value: `${c.from} → ${c.to} 格道路` }),
  calls: (c) => ({ label: "服务人员出发间隔", value: `${seconds(c.from)} → ${seconds(c.to)}` }),
  deep: () => ({ label: "全速开采采空矿面，免受三分之一速度的限制" }),
  admin: (c) => ({ label: "行政开支减免", value: `${c.from}% → ${c.to}%` }),
  appeal: (c) => ({
    label: "周围宜居度",
    value: `${c.from === null ? "0" : signed(c.from)} → ${signed(c.to)}`,
    ...(c.reach === null ? {} : { note: `影响 ${c.reach} 格` })
  }),
  upkeep: (c) => ({ label: "维护费", value: `${c.from} → ${token.rate(c.to)}` })
}

/** Why the town needs an upgrade now. In an alert its buildings and goods are chips; in a panel it is said in words. */
const wanted = {
  nextRank: "下一级晋升要求此项升级",
  shelvesFull: "仓储已满",
  rockWorked: "范围内矿藏已采尽",
  millsWait: `${chip("mill")}正在等待${token.good("wheat")}`,
  breadShort: `已全速生产，住宅仍缺少${token.good("bread")}`,
  unreached: "有住宅超出所有食物配送员的服务范围",
  beyondPriest: "有住宅超出传教士的服务范围",
  fireRisk: "所服务街区的住宅火灾风险较高"
} satisfies Record<WantedReason, string>

const upgrade = {
  change,
  /** A change in one line: "周围宜居度 +4 → +6，影响 6 格". */
  line: (g: Gain): string => `${[g.label, ...(g.value === undefined ? [] : [g.value])].join(" ")}${g.note === undefined ? "" : `，${g.note}`}`,
  /** What starting an upgrade costs: coins now, and the materials carriers then bring. */
  price: (c: Kind["cost"]): string => {
    const carried = cost({ coins: 0, materials: c.materials })
    return `立即支付 ${token.coins(c.coins)}${carried ? ` · 运输员送来 ${carried}` : ""}`
  },
  /** The treasury lacks this much of what it costs to begin. */
  short: (n: number): string => `还缺 ${token.coins(n)}`,
  wanted,
  /** The first upgrade the town needs, in the ticker: why, what becomes what, and how to begin. */
  hint: (h: { readonly reason: WantedReason; readonly kind: KindId; readonly level: number }): string =>
    `${wanted[h.reason]}：${chip(h.kind, kindName(h.kind, h.level))}可升级为${kindName(h.kind, h.level + 1)}。${token.device("轻点", "点击")}金色箭头下的建筑，开始施工`,
  /** The upgrade tool's tooltip. */
  path: (kind: KindId, level: number): string => `${kindName(kind, level)} → ${kindName(kind, level + 1)}`,
  underWay: "施工中：运输员正在送来建材",
  begin: "点击开始施工，期间建筑继续工作",
  pick: (kind: KindId): string => `升级：选择一座${kindName(kind)} · Esc 取消`,
  /** The gestures' answers. */
  pickOne: "请选择要升级的建筑",
  already: (kind: KindId): string => `${kindName(kind)}正在升级施工`,
  /** An upgrade under way, in the building's panel. */
  becoming: (kind: KindId, level: number): string => `正在升级为${kindName(kind, level)}`,
  built: "施工进度",
  stillBring: (left: string): string => `运输员仍在送来 ${left}，建筑继续工作`,
  allIn: "材料已齐，施工人员正在搭建；建筑继续工作"
}

// ── Placing ───────────────────────────────────────────────────────────────

const gathered = { tree: "树木", stone: "浅色石料岩石", ore: "深色矿石岩石", water: "水域" } as const

const place = {
  /** What is wrong with a building where it would stand. */
  problem: {
    noRoad: () => "建筑一侧的中点需要连接道路",
    nothingNear: (p) => `${p.radius} 格内没有${gathered[p.source]}`
  } satisfies Wording<PlaceProblem>,
  /** A building refused where it was put down: "渔场：建筑一侧的中点需要连接道路". */
  refused: (kind: KindId, why: string): string => `${kindName(kind)}：${why}`
}

// ── Map views ─────────────────────────────────────────────────────────────

/** Each map view's legend: its heading, what each colour means, and how the reading works. */
const legend = {
  appeal: {
    title: "宜居度",
    keys: {
      townhouses: `${home.tiers[3].appeal} 以上：市民宅邸`,
      citizens: `${home.tiers[2].appeal} 以上：市民住宅`,
      settlers: "0 至 4：仅限移民",
      fewer: "低于 0：人口与税收减少",
      squalid: `${home.squalid} 及以下：脏乱`
    },
    note: "宜居度每一点都有效：低于 0 会减少入住人数和税收，高于 0 增加税收。工业降低宜居度；公园、教堂、市场和石铺道路提高宜居度。公园越丰富，影响范围越大。"
  },
  workers: {
    title: "劳动力",
    keys: { staffed: "人手充足", short: "人手不足", none: "没有工人", settlers: "移民住宅", citizens: "市民住宅" },
    note: `居民最多步行 ${COMMUTE} 格道路上班。选择工作场所可查看招工范围和范围内住宅。`
  },
  fire: {
    title: "火灾",
    keys: { good: "已巡查", fair: "上升", bad: "高风险或着火" },
    note: "建筑也会按风险着色。消防站巡查员会重置沿途住宅和工坊的火灾风险；朱红色表示风险已超过一半，仍有时间干预。木制小屋、炉灶、锻炉和拥挤都会增加风险。"
  },
  health: {
    title: "健康",
    keys: { good: "已诊治", fair: "上升", bad: "高风险或患病" },
    note: "医馆医师重置疾病风险并治疗病人。饥饿、拥挤、脏乱、采石粉尘和静水都会增加风险。"
  },
  order: {
    title: "治安",
    keys: { good: "治安良好", fair: "上升", bad: "盗窃频发" },
    note: "治安所警员维护秩序。低支持度、脏乱和入住不足会增加风险；先发生盗窃，之后住宅可能荒废。"
  },
  condition: {
    title: "建筑状况",
    keys: { good: "维护良好", fair: "需要修缮", bad: "破旧：效率减半" },
    note: "修缮工坊的工匠使用木板与石料维修沿途建筑。状况降至零时建筑坍塌。"
  }
} satisfies { readonly [V in keyof LegendKeys]: { readonly title: string; readonly keys: Readonly<Record<LegendKeys[V], string>>; readonly note: string } }

// ── Parks and ruins ───────────────────────────────────────────────────────

/** What a park does for the streets around it. */
const parkWorth = (value: number, reach: number): string => `宜居度 ${signed(value)}，影响 ${reach} 格`
/** What became of a ruin, in a word. */
const ruinCause = { burnt: "烧毁", collapsed: "坍塌", derelict: "荒废" }

// ── The catalog's part ────────────────────────────────────────────────────

export const view = {
  /** What a building is doing, in a word. */
  status: {
    building: "施工中", idle: "空闲", working: "工作中", starved: "缺少原料", blocked: "库存已满", unstaffed: "缺少工人", unconnected: "未连接道路", paused: "已暂停"
  } satisfies Record<Status, string>,
  street,
  cause,
  /** A cause in one line: "why：what to do". */
  causeLine: (told: Told): string => (told.fix === undefined ? told.why : `${told.why}：${told.fix}`),
  problem,
  /** A problem in one line, for the panel's header and the tooltip: "未连接道路：建筑一侧的中点需要连接道路". */
  problemLine: (told: ToldProblem): string => `${told.label}：${told.why}`,
  upgrade,
  place,
  legend,
  /** How a risk reads: "正常", "40%", or "高，85%". */
  risk: { ok: "正常", some: (percent: number): string => `${percent}%`, high: (percent: number): string => `高，${percent}%` },
  /** What pulling something down (or cancelling a site) costs and gives back: "拆除：−25 金币 · 返还 2 木板、3 石料". */
  salvage: (s: { readonly cancelled: boolean; readonly salvage: Salvage }): string => {
    const said = salvage(s.salvage)
    return `${s.cancelled ? "取消施工" : "拆除"}${said ? `：${said}` : ""}`
  },

  /** What moves the town's approval, a row each. */
  mood: {
    base: "城镇基础支持",
    needs: "需求满足",
    taxes: "当前税率",
    grudge: "高税率积累的怨恨",
    debt: "拖欠工资",
    crown: "王室不满",
    winter: "冬季饥饿"
  },

  /** What the next rank asks: each goal, and how the town stands against it. */
  goal: {
    text: {
      residents: (target) => `${target} 位居民`,
      citizens: (target) => `市民占比 ${target}%`,
      burghers: (target) => `富裕市民占比 ${target}%`,
      approval: (target) => `支持度至少 ${target}`,
      income: (target) => `每分钟净收入 ${target} 金币，且无负债`,
      hall: (target) => kindName("townhall", target)
    } satisfies Record<GoalId, (target: number) => string>,
    value: {
      residents: (value) => `${value}`,
      citizens: (value) => `${value}%`,
      burghers: (value) => `${value}%`,
      approval: (value) => `${value}`,
      income: (value) => `${value}`,
      hall: (value, target): string => (value >= target ? "已建成" : "尚未建成")
    } satisfies Record<GoalId, (value: number, target: number) => string>
  },

  /** What needs looking at now, in the ticker: buildings, goods, and tools as chips; amounts in words. */
  alerts: {
    fire: (burning: number, watched: boolean): string =>
      `${burning} 处着火：${watched ? `${chip("firewatch")}的消防员正在赶来` : `请在附近建造${chip("firewatch")}，派出消防员灭火`}`,
    sick: (sick: number, healed: boolean): string =>
      `${sick} 户患病，容纳人数减半：${healed ? `道路服务范围内的${chip("healer")}可上门治愈` : `请在住宅区建造${chip("healer")}`}`,
    /** Workshops idle for want of their input, by kind: "生产停滞：磨坊 ×2 缺少小麦。…". */
    idle: (waiting: ReadonlyArray<{ readonly kind: KindId; readonly good: GoodId; readonly n: number }>): string =>
      `生产停滞：${waiting.map((w) => `${chip(w.kind)}${w.n > 1 ? ` ×${w.n} ` : ""}缺少${token.good(w.good)}`).join("、")}。请增建原料生产设施，或在${town}面板中购买`,
    /** Workplaces no home can reach, by kind. */
    remote: (remote: ReadonlyArray<{ readonly kind: KindId; readonly n: number }>): string =>
      `缺少工人：${remote.map((w) => `${chip(w.kind)}${w.n > 1 ? ` ×${w.n}` : ""}`).join("、")}。请在 ${COMMUTE} 格道路内建造${token.command("homes")}，或铺路连接附近住宅`,
    hungry: `没有食物库存，居民挨饿且不缴税：请增建${chip("fishery")}，或在${town}面板中购买${token.good("fish")}`
  },

  /** A building's panel. */
  building: {
    beingBuilt: "施工中",
    waitingFor: "等待物资",
    carriersBring: "运输员从仓储运来建材；缺少的物资可在城镇面板中购买",
    builders: "施工人员",
    atWork: "施工中",
    workers: "劳动力",
    staffed: (assigned: number, needed: number): string => `${assigned}/${needed}`,
    nobodyNear: (crew: Crew): string => `${COMMUTE} 格道路内没有${crewPeople(crew)}，请在附近建造住宅`,
    allTaken: `附近居民都已有工作，请在 ${COMMUTE} 格道路内增建住宅`,
    apprentices: "移民代替市民工作，效率为正常的四分之三",
    makes: "生产",
    /** What it makes: from what, into what (each with its icon), or what alone. */
    recipe: (input: GoodId | null, output: GoodId): string => (input ? `${token.good(input)} → ${token.good(output)}` : goods[output].word),
    walkersOut: "外出服务人员",
    handedOut: "上分钟配送",
    handedTo: (n: number): string => `配送至 ${n} 户住宅`,
    nothing: "暂无",
    nobodyNeeded: "沿途住宅暂无需要的物资",
    shelf: "当前货架库存",
    holds: "库存",
    tools: "工具",
    none: "无",
    noTools: "缺少工具时效率减半；可由铁匠铺生产，或在城镇面板中购买",
    upkeep: "维护费",
    upkeepValue: (coins: number): string => token.rate(coins),
    condition: "建筑状况",
    runDown: "效率减半，并有坍塌风险；修缮工坊可维修",
    wearing: "修缮工坊的工匠经过时会进行维修",
    fireRisk: "火灾风险",
    fireCure: "消防站的巡查员经过时可降低风险",
    appeal: "周围宜居度",
    work: "工作情况",
    running: "维护与影响",
    /** Behind the ⓘ of "维护与影响": a sentence for each thing that costs or risks something. */
    help: {
      upkeep: "建成后每分钟支付维护费，暂停时为四分之一。",
      condition: "建筑会逐渐老化，修缮工坊可进行维修。",
      hot: "烤炉或锻炉会增加自身及两格内住宅的火灾风险。",
      appeal: (reach: number, worse: boolean): string => `影响周围 ${reach} 格的宜居度${worse ? "，附近住宅的容纳人数和税收可能减少" : ""}。`
    }
  },

  /** A home's panel. */
  house: {
    household: "住户",
    beingBuilt: "施工中",
    builders: "施工人员",
    waitingPlank: "等待木板送达",
    closed: "已关闭",
    empty: "空置",
    closedNote: "不缴税，也不产生行政开支；重新开放后居民会逐渐入住",
    /** Why it holds fewer than it could. */
    fewer: {
      sick: "患病期间容纳人数减半",
      disapproval: "支持度偏低，入住人数减少",
      street: (advice: string): string => `街区环境较差，入住人数减少：${advice}`,
      taxed: (rate: number): string => `税率为 ${rate}%，部分居民迁出`,
      needs: "需求尚未全部满足，入住人数减少"
    },
    onFire: "着火了",
    fled: "居民已逃离",
    sick: "患病",
    halved: "容纳人数减半",
    sickNote: "一分钟后病情消退，或由医馆的医师上门治愈",
    residents: "居民",
    living: (n: number, room: number): string => `${n}/${room}`,
    pays: "纳税",
    paying: (coins: number): string => token.rate(coins),
    hungry: "挨饿",
    hungryNote: "挨饿：没有食物，不缴税",
    could: (coins: number): string => `需求全部满足时可缴 ${token.rate(coins)}`,
    worksAt: "工作地点",
    workplace: (kind: KindId): string => kindName(kind),
    nothingNearby: "附近暂无工作",
    needs: "需求",
    met: "✓",
    missing: "缺少",
    /** What a need is wanted for: the tier it would raise the home to. */
    forTier: (tier: Tier): string => `升级为${tiers[tier].home.word}所需`,
    street: "街区",
    streetOf: (desirability: number, needed: number): string => `${signed(desirability)}/${needed}`,
    desirability: (d: number): string => signed(d),
    services: "公共服务",
    rebuilding: "改建费用",
    rebuilt: "已完成 ✓",
    shortOf: (short: Kind["cost"]): string =>
      `城镇还缺 ${[...(short.coins > 0 ? [token.coins(short.coins)] : []), ...(Object.entries(short.materials) as Array<[GoodId, number]>).map(([g, n]) => token.amount(g, n))].join("、")}`,
    waitsForStore: `材料备齐前保持当前等级；可自行生产，或在${town}面板中购买`,
    rebuiltAlready: "已完成改建，恢复到该等级无需再次付费",
    readyFor: (tier: Tier): string => `可升级为${tiers[tier].home.word}`,
    readyNote: "下一位居民入住时升级，并支付本次改建费用",
    safety: "风险与状况",
    risks: "风险",
    allLow: "均较低",
    riskOf: { fire: "火灾风险", health: "疾病风险", order: "盗窃风险" } satisfies Record<RiskId, string>,
    cure: { fire: "消防站的巡查员可降低风险", health: "医馆的医师可降低风险", order: "治安所的警员可降低风险" } satisfies Record<RiskId, string>,
    robbed: "遭窃次数",
    times: (n: number): string => `${n}×`,
    condition: "建筑状况",
    runDown: "降低周围宜居度，并有坍塌风险；修缮工坊可维修",
    wearing: "修缮工坊的工匠经过时会进行维修",
    /** Behind the ⓘ of "需求", by the home's tier: what red and amber mean, and what the next tier asks. */
    needsHelp: {
      1: `红色为当前需求，黄色为升级所需。市民住宅容量翻倍，人均基础税额也翻倍；移民小屋仅获得面包供应，税收便可提高 50%。服务人员沿道路满足需求，街区宜居度反映环境好坏（市民需要 ${home.tiers[2].appeal}）。`,
      2: `红色为当前需求，缺少时会降级为移民小屋。黄色为升级为富裕市民居住的市民宅邸所需：街区宜居度达到 ${home.tiers[3].appeal}，并有消防站、医馆与治安所的服务人员经过。`,
      3: "红色为当前需求，缺少时会降级为市民住宅。"
    } satisfies Record<Tier, string>,
    safetyHelp: "住宅的火灾、疾病与盗窃风险会缓慢上升，对应的服务人员经过时可降低风险。",
    /** How it is, in a word or two for the header. */
    summary: (n: number): string => `${n} 位居民`
  },

  /** A park's panel. */
  park: {
    worth: parkWorth,
    /** What a park's beauty is made of. */
    part: {
      ground: (l): string => (l.capped ? "地面（已达计入上限）" : "地面"),
      ways: () => "连接道路的入口",
      prop: (l) => props[l.prop].noun.word
    } satisfies Wording<ParkLabel>,
    size: "规模",
    sizeOf: (n: number, beauty: number): string => `${n} 格 · 美观值 ${beauty}`,
    madeOf: "组成",
    /** Its parts with what each is worth, already worded: "地面 2、路灯 1.5". */
    parts: (parts: ReadonlyArray<{ readonly label: string; readonly value: number }>): string => parts.map((p) => `${p.label} ${p.value}`).join("、") || "暂无",
    streets: "周围街区",
    ways: "连接道路的入口",
    waysIn: (n: number): string => `${n}${n > 2 ? "（仅计入 2 个）" : ""}`,
    none: "无",
    noWays: "铺设碎石小径或石铺广场连接道路：每个入口 +1.5，最多计入两个",
    furnishings: "计入效果的设施",
    furnished: (placed: number, room: number): string => `${placed}/${room}`,
    crowded: (n: number): string => `超出 ${n} 件：每两格公园地面可计入一件设施，请扩建地面`,
    nicerWith: "建议添置",
    missing: (ids: ReadonlyArray<PropId>): string => ids.map((id) => props[id].noun.word).join("、"),
    upkeep: "维护费",
    upkeepValue: (coins: number): string => token.rate(coins)
  },

  /** A ruin's panel. */
  ruin: {
    cause: ruinCause,
    happened: "原因",
    what: { burnt: "被火灾烧毁", collapsed: "因无人修缮而坍塌", derelict: "多次遭窃后被遗弃" },
    appeal: "周围宜居度",
    untilCleared: "拆除清理后消除影响"
  },

  /** What the pointer is over, in a line; and what a tool would lay there, and for how much. Amounts as icons. */
  tooltip: {
    /** A building: what it is doing, or what keeps it from it; and what it is becoming, when works are under way. */
    building: (b: { readonly kind: KindId; readonly level: number; readonly state: string; readonly works: { readonly level: number; readonly percent: number } | null }): string =>
      `${kindName(b.kind, b.level)} · ${b.state}${b.works ? ` · 正在升级为${kindName(b.kind, b.works.level)}，已完成 ${b.works.percent}%` : ""}`,
    /** Bulldozing: what pulling it down gives back, or that it stays. */
    bulldozeBuilding: (kind: KindId, level: number, back: string): string => `${kindName(kind, level)} · ${back}`,
    hallStays: "市政厅不可拆除",
    bulldozeHome: (tier: Tier, back: string): string => `${tiers[tier].home.word} · ${back}`,
    homeClosed: (tier: Tier): string => `${tiers[tier].home.word} · 已关闭`,
    home: (h: { readonly tier: Tier; readonly residents: number; readonly desirability: number; readonly burning: boolean; readonly sick: boolean }): string =>
      `${tiers[h.tier].home.word} · ${h.residents} 位居民 · 宜居度 ${h.desirability}${h.burning ? " · 着火了！" : h.sick ? " · 患病" : ""}`,
    ruin: (cause: "burnt" | "collapsed" | "derelict"): string => `废墟 · ${ruinCause[cause]} · 拆除以清理`,
    park: (what: { readonly prop: PropId } | { readonly ground: GroundId }, whole: { readonly cells: number; readonly value: number; readonly reach: number } | null): string =>
      `公园 · ${"prop" in what ? props[what.prop].noun.word : grounds[what.ground].noun.word}${whole ? ` · ${whole.cells} 格 · ${parkWorth(whole.value, whole.reach)}` : ""}`,
    /** Placing a building: what keeps it from here, or what it costs. */
    placeLocked: (kind: KindId, l: Lock): string => `${kindName(kind)} · ${say(lock, l)}`,
    placeNoRoom: (kind: KindId): string => `${kindName(kind)} · 此处空间不足`,
    placeProblem: (kind: KindId, why: string): string => `${kindName(kind)} · ${why}`,
    placeCost: (kind: KindId, c: Kind["cost"]): string => `${kindName(kind)} · ${cost(c)}`,
    pave: (c: { readonly coins: number; readonly stone: number }): string => `铺石 · 每格 ${token.coins(c.coins)} 和 ${token.amount("stone", c.stone)} · 提高步行速度`,
    desirability: (d: number): string => `宜居度 ${d}`,
    cancel: "在此松手可取消",
    /** What new homes would bring in once fed, or that they would cost more than they pay. */
    homesWorth: (coins: number): string => (coins > 0 ? ` · 供餐后净收入 ${token.rate(coins, true)}` : " · 新增行政开支高于税收：升级住宅更划算"),
    homes: (c: Kind["cost"], worth: string | null): string => `住宅 · 每栋 ${cost(c)}${worth ?? " · 请沿道路建造"}`,
    road: (coins: number): string => `道路 · 每格 ${token.coins(coins)}`,
    /** A stroke being dragged: how much it lays, and what that costs. */
    roadStroke: (n: number, c: Kind["cost"]): string => `${n} 格道路 · ${cost(c)}`,
    homesStroke: (n: number, c: Kind["cost"], worth: string): string => `${n} 栋住宅 · ${cost(c)}${worth}`,
    paveStroke: (n: number, c: Kind["cost"]): string => `铺石 ${n} 格 · ${cost(c)}`,
    groundStroke: (ground: GroundId, n: number, c: Kind["cost"]): string => `${grounds[ground].noun.word} · ${n} 格 · ${cost(c)}`,
    ground: (ground: GroundId, c: Kind["cost"], park: number | null): string => `${grounds[ground].noun.word} · ${cost(c)}${park === null ? "" : ` · 公园宜居度 ${signed(park)}`}`,
    /** A furnishing about to be set: what the park would be worth with it (and is now, when that differs), and whether it is one too many. */
    prop: (prop: PropId, c: Kind["cost"], park: { readonly value: number; readonly before: number | null; readonly crowded: boolean } | null): string =>
      `${props[prop].noun.word} · ${cost(c)}${park ? ` · 公园宜居度 ${signed(park.value)}${park.before === null ? "" : `（当前 ${signed(park.before)}）`}` : ""}${park?.crowded ? " · 设施过密" : ""}`,
    propNeedsPark: (prop: PropId): string => `${props[prop].noun.word} · 请先铺设公园地面`,
    removeProp: (prop: PropId): string => `拆除${props[prop].noun.word}`,
    removeGround: (ground: GroundId): string => `移除${grounds[ground].noun.word}`,
    workedFace: (ore: boolean): string => `${ore ? "矿石" : "石料"}采空矿面 · 可拆除清理`,
    rock: (ore: boolean, left: number): string => `${ore ? "矿石" : "石料"} · 剩余 ${left}`,
    /** What a thing being placed would reach, said beside its outline. */
    walkersReach: (range: number): string => `服务人员从入口出发，覆盖 ${range} 格道路`,
    workersFrom: `工人来自 ${COMMUTE} 格道路以内的住宅`,
    residentsWalk: `居民步行上班范围为 ${COMMUTE} 格道路`
  }
} satisfies typeof English
