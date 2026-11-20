/**
 * Simplified Chinese names for what the town is made of: its buildings and
 * what they become when upgraded, its goods, homes, ranks, lands, winters,
 * and parks. Every table is keyed by the game's ids and checked against
 * them, as English's are.
 *
 * Where the names come from. The names, and most of the wording of this
 * catalog, come from two community translations of the game into Simplified
 * Chinese, made in October 2026 before the game had a catalog: senshinya's
 * fork (github.com/senshinya/inkline-town), the fuller and later of the two,
 * whose words are used wherever it has them, and SuJiurong's fork
 * (github.com/SuJiurong/inkline-town-zh-cn), checked against it. Where the
 * two name a thing differently, senshinya's name stands (原木, not 木材, for
 * wood; 林务所, not 林场, for the forester; 织布坊, not 纺织坊, for the weaver;
 * 修缮工坊, not 维修工坊, for the builder's yard; 市民宅邸, not 高级住宅, for
 * the townhouse). What the game has said since was written here, in the
 * same words.
 *
 * How things are named. A building is a place: a yard or a works for a
 * trade (伐木场, 锯木厂, 采石场), a workshop (面包坊, 木工坊), a post for a
 * service (消防站, 治安所, 医馆); an upgrade takes a name of its own (市政厅 →
 * 行会大厅 → 城市政厅, 农场 → 庄园, 教堂 → 大教堂). The people who walk from
 * a building are named by what they do: the market's and the town hall's
 * 配送员, the chapel's 传教士, the healer's 医师, the fire watch's 巡查员 and
 * its 消防员, the watch house's 警员, the builder's yard's 工匠; whoever else
 * walks is a 服务人员, and whoever carries goods a 运输员.
 *
 * Each noun carries its measure word (`grammar.ts`): a building 座, a home
 * 栋, a person 位, a cell 格, a furnishing 件; goods and coins are counted
 * bare ("20 木板", "25 金币"), as both forks count them.
 *
 * The settlement is 城镇 in a sentence whatever its rank; a sentence that
 * names a rank sets it in quotation marks ("城镇已晋升为“村庄”"), so the
 * rank 城镇 never reads as the town itself. A street is a landmark's word
 * and one of six ways a street is named (巷, 街, 里, 路, 弄, 步道), the town
 * hall's a square (市政广场).
 */
import type { GoodId, GroundId, KindId, LandId, Need, PropId, SizeId, Tier, WinterId } from "../../game/content/index.ts"
import type { Place } from "../../game/said.ts"
import { noun, type Noun } from "./grammar.ts"

/** Something built: what it is called, and what it is for, in a line. */
export interface Thing {
  readonly noun: Noun
  readonly blurb: string
}
/** A building: counted in 座. */
const building = (word: string, blurb: string): Thing => ({ noun: noun(word, "座"), blurb })
/** A piece of a park: ground counted in cells, a furnishing as a piece. */
const piece = (word: string, measure: string, blurb: string): Thing => ({ noun: noun(word, measure), blurb })

/** Each building as it is built, then as each of its upgrades (see `Kind.upgrade`). */
export const kinds = {
  townhall: [
    building("市政厅", "城镇的中心：储存物资、征收税款，并派出配送员供应食物"),
    building("行会大厅", "配有钟楼的市政建筑：仓储容量翻倍，运输员增多，配送范围扩大，行政开支降低 10%"),
    building("城市政厅", "穹顶下的城市行政中心：仓储容量、运输员人数和配送范围达到最高，行政开支降低 20%")
  ],
  warehouse: [
    building("仓库", "在生产地和使用地附近储存物资"),
    building("货运仓库", "设有装卸场与吊机：仓储容量超过原来的两倍，运输员增加两人")
  ],
  granary: [building("粮仓", "储存食物，使鲜鱼和面包的腐坏速度降至五分之一")],
  lumberjack: [building("伐木场", "砍伐附近长成的树木，获得原木")],
  forester: [building("林务所", "在附近的空地上种树")],
  quarry: [
    building("采石场", "开采附近岩石中的石料"),
    building("石工作坊", "设有吊架与石工棚：可全速开采采空矿面，免受三分之一速度的限制，但粉尘会进一步降低周围宜居度")
  ],
  mine: [building("矿场", "开采附近矿床中的矿石")],
  fishery: [building("渔场", "捕鱼；两格以内需要有独立的捕鱼水域")],
  smokehouse: [building("熏鱼坊", "将鲜鱼熏制，使其能储存一整个冬季")],
  sawmill: [building("锯木厂", "将原木锯成木板")],
  smithy: [building("铁匠铺", "将矿石锻造成工具")],
  farm: [
    building("农场", "在周围播种农田，收获小麦"),
    building("庄园", "配有谷仓与鸽舍：增加一名工人，更快地收获周围农田")
  ],
  mill: [building("磨坊", "将小麦磨成面粉")],
  bakery: [
    building("面包坊", "将面粉烤成面包"),
    building("烘焙工坊", "增加一座烤炉和一名面包师：每批面包的制作时间由六秒缩短至四秒")
  ],
  sheep: [building("牧羊场", "剪取羊毛")],
  weaver: [building("织布坊", "将羊毛织成布料")],
  carpenter: [building("木工坊", "用木板制作家具，供应富裕市民居住的市民宅邸")],
  market: [
    building("市场", "配送员向沿途住宅供应鲜鱼、熏鱼、面包、布料和家具"),
    building("市场大厅", "带顶大厅：配送员出发更频繁、走得更远，并改善周围街区的宜居度")
  ],
  chapel: [
    building("教堂", "传教士为沿途住宅提供信仰服务"),
    building("大教堂", "带钟楼的教堂：传教士出发更频繁、走得更远，并显著改善周围街区的宜居度")
  ],
  firewatch: [
    building("消防站", "巡查员降低沿途住宅与工坊的火灾风险，消防员赶赴火场灭火"),
    building("消防队", "配有钟楼与水泵：巡查更频繁、范围更远，消防员由两人增加至四人")
  ],
  healer: [building("医馆", "医师巡视沿途住宅，治疗病人")],
  hospital: [building("医院", "医师巡视更频繁，服务范围更大")],
  watchhouse: [building("治安所", "警员沿街巡逻，维护沿途住宅的治安")],
  builder: [building("修缮工坊", "工匠使用木板和石料修缮沿途的住宅与建筑")]
} satisfies Record<KindId, readonly [Thing, ...ReadonlyArray<Thing>]>

/** A building at its level of upgrades (0: as built). A level it has no name for reads as the last it has. */
export const built = (id: KindId, level = 0): Thing => {
  const levels: readonly [Thing, ...ReadonlyArray<Thing>] = kinds[id]
  return levels[Math.max(0, Math.min(level, levels.length - 1))] ?? levels[0]
}

/** A good: the ware, counted bare ("20 木板"). */
export const goods = {
  wood: noun("原木"),
  planks: noun("木板"),
  stone: noun("石料"),
  ore: noun("矿石"),
  tools: noun("工具"),
  fish: noun("鲜鱼"),
  smoked: noun("熏鱼"),
  wheat: noun("小麦"),
  flour: noun("面粉"),
  bread: noun("面包"),
  wool: noun("羊毛"),
  cloth: noun("布料"),
  furniture: noun("家具")
} satisfies Record<GoodId, Noun>

/** A tier of homes: who lives there, and what the home is called. */
export const tiers = {
  1: { people: "移民", home: noun("移民小屋", "栋") },
  2: { people: "市民", home: noun("市民住宅", "栋") },
  3: { people: "富裕市民", home: noun("市民宅邸", "栋") }
} satisfies Record<Tier, { readonly people: string; readonly home: Noun }>

/** The town's ranks, lowest first (see `ranks` in the content). */
export const ranks = ["聚落", "村庄", "城镇", "城市"] as const
/** A rank's name: one past the last reads as the last. */
export const rankName = (rank: number): string => ranks[Math.max(0, Math.min(rank, ranks.length - 1))] ?? ranks[0]
/** A rank as a running sentence names it, in quotation marks: "“村庄”". */
export const rankOf = (rank: number): string => `“${rankName(rank)}”`

/** The land's size, as a button says it; a sentence says it of the map ("中型地图"). */
export const sizes = { small: "小型", medium: "中型", large: "大型" } satisfies Record<SizeId, string>
export const lands = {
  rich: { name: "富饶", blurb: "茂密森林、充足石料与矿石、两片湖泊，以及充裕的启动资金" },
  fair: { name: "适中", blurb: "各类资源足够使用，前提是避免浪费" },
  harsh: { name: "贫瘠", blurb: "稀疏森林、少量石料、一处矿床和一片湖泊" }
} satisfies Record<LandId, { readonly name: string; readonly blurb: string }>
/** A town's land in a sentence: "中型地图，资源适中". */
export const landOf = (size: SizeId, land: LandId): string => `${sizes[size]}地图，资源${lands[land].name}`
/** A winter by its severity: each is a winter's name of its own ("严冬"). */
export const winters = { mild: "暖冬", normal: "普通冬季", hard: "严冬" } satisfies Record<WinterId, string>

export const grounds = {
  lawn: piece("草坪", "格", "铺设公园的草地"),
  flowers: piece("花坛", "格", "种满花卉，比草坪更美观"),
  path: piece("碎石小径", "格", "穿过公园的小径"),
  square: piece("石铺广场", "格", "石块铺成的广场，可摆放雕像或喷泉")
} satisfies Record<GroundId, Thing>
export const props = {
  lamp: piece("路灯", "件", "小径旁的铁制路灯"),
  fountain: piece("喷泉", "件", "盛着清水的石制喷泉"),
  statue: piece("雕像", "件", "城镇奠基者的石像，公园的骄傲")
} satisfies Record<PropId, Thing>

export const needs = { food: "食物", bread: "面包", cloth: "布料", faith: "信仰", furniture: "家具" } satisfies Record<Need, string>

/** What a landmark lends its streets' names: 磨坊巷, 铁匠街. */
const streets = {
  townhall: "市政", warehouse: "仓库", granary: "粮仓", lumberjack: "木材", forester: "森林", quarry: "采石",
  mine: "矿山", fishery: "渔人", smokehouse: "熏鱼", sawmill: "锯木", smithy: "铁匠", farm: "农场", mill: "磨坊",
  bakery: "面包", sheep: "牧羊", weaver: "织布", market: "集市", chapel: "教堂", firewatch: "消防", healer: "医馆",
  hospital: "医院", watchhouse: "治安", builder: "修缮", carpenter: "木工"
} satisfies Record<KindId, string>
/** The ways a street is called: as many as `STREET_WAYS`. */
const ways = ["巷", "街", "里", "路", "弄", "步道"] as const

/** Where something happened: "磨坊巷", "市政广场", or "城镇边缘". */
export const place = (where: Place): string =>
  where === null ? "城镇边缘" : `${streets[where.kind]}${where.kind === "townhall" ? "广场" : ways[where.way % ways.length]}`

/**
 * The finished names, as the page reads them: a heading (`title`), the
 * word in a sentence (`name`), and what it is for (`blurb`). Chinese has
 * no capitals, so a heading and a name are the same word.
 */
export const names = {
  kind: {
    /** "市场大厅": a building at its level of upgrades, as a heading. */
    title: (id: KindId, level = 0): string => built(id, level).noun.word,
    /** "市场大厅": as a sentence names it. */
    name: (id: KindId, level = 0): string => built(id, level).noun.word,
    blurb: (id: KindId, level = 0): string => built(id, level).blurb
  },
  good: {
    /** "木板", "熏鱼": the ware. */
    name: (id: GoodId): string => goods[id].word
  },
  tier: {
    /** "移民", "市民", "富裕市民". */
    people: (tier: Tier): string => tiers[tier].people,
    /** "移民小屋", "市民住宅", "市民宅邸". */
    home: (tier: Tier): string => tiers[tier].home.word
  },
  /** "聚落", "村庄", "城镇", "城市": a rank past the last reads as the last. */
  rank: (rank: number): string => rankName(rank),
  size: (id: SizeId): string => sizes[id],
  land: { name: (id: LandId): string => lands[id].name, blurb: (id: LandId): string => lands[id].blurb },
  winter: (id: WinterId): string => winters[id],
  ground: { title: (id: GroundId): string => grounds[id].noun.word, name: (id: GroundId): string => grounds[id].noun.word, blurb: (id: GroundId): string => grounds[id].blurb },
  prop: { title: (id: PropId): string => props[id].noun.word, name: (id: PropId): string => props[id].noun.word, blurb: (id: PropId): string => props[id].blurb },
  need: (need: Need): string => needs[need],
  place
}
