/**
 * Japanese names for what the town is made of: its buildings and what they
 * become when upgraded, its goods, homes, ranks, lands, winters, and parks.
 * Every table is keyed by the game's ids and checked against them, as
 * English's are.
 *
 * How things are named. Buildings are named as places, the way Japanese
 * town-builders name them: a hut for a trade (木こり小屋, 漁師小屋), a works
 * (製材所, 製粉所), a workshop (家具工房), a yard (採石場); an upgrade takes a
 * name of its own (町役場 → ギルド会館 → 市庁舎, 農場 → 荘園, パン屋 → 製パン所).
 * The people who walk from a building are named by what they do, not by
 * their building: the market's 売り子, the chapel's 司祭, the healer's 医師,
 * the fire watch's 火の番 and its 火消し, the watch house's 衛兵, the
 * builder's yard's 大工; whoever else walks is a 巡回人, and whoever carries
 * goods a 運搬人.
 *
 * Each noun carries its counter (`grammar.ts`): a building 棟, a home 軒, a
 * person 人, a cell マス, a coin 枚 (coins are 金貨, gold pieces), and each
 * good the unit it comes in: wood in logs (本), planks and cloth in sheets
 * (枚), wheat in sheaves (束), flour and wool in sacks (袋), fish by the fish
 * (匹), furniture by the piece (点), the rest as pieces (個).
 *
 * The settlement is 町 in a sentence whatever its rank; a rank is written in
 * 「」 where a sentence names it ("町は「村」になりました"), so the rank 町
 * never reads as the town itself. A street is a landmark's word and one of
 * six ways a Japanese street is named (通り, 小路, 横丁, 坂, 町, 辻), the town
 * hall's a square (役場広場), as an old town names its quarters after its
 * trades (鍛冶屋町, 粉屋小路).
 */
import type { GoodId, GroundId, KindId, LandId, Need, PropId, SizeId, Tier, WinterId } from "../../game/content/index.ts"
import type { Place } from "../../game/said.ts"
import { counted, noun, type Noun } from "./grammar.ts"

/** Something built: what it is called, and what it is for, in a line. */
export interface Thing {
  readonly noun: Noun
  readonly blurb: string
}
/** A building: counted in 棟. */
const building = (word: string, blurb: string): Thing => ({ noun: noun(word, "棟"), blurb })
/** A piece of a park, counted as a piece. */
const piece = (word: string, counter: string, blurb: string): Thing => ({ noun: noun(word, counter), blurb })

/** Each building as it is built, then as each of its upgrades (see `Kind.upgrade`). */
export const kinds = {
  townhall: [
    building("町役場", "町の中心。物資の保管、税の徴収、食料を配る巡回人"),
    building("ギルド会館", "時計塔のある町役場。保管量は2倍、運搬人が増え、巡回人はより遠くまで歩き、町の運営費は1割安くなる"),
    building("市庁舎", "丸屋根を戴く都市の庁舎。保管量も運搬人も最大で、巡回人は最も遠くまで歩き、運営費は2割安くなる")
  ],
  warehouse: [
    building("倉庫", "物資を、作る場所と使う場所の近くに保管する"),
    building("集積所", "荷積み場と巻き上げ機つき。保管量は2倍以上、運搬人が2人増える")
  ],
  granary: [building("穀物庫", "食料を保管し、魚とパンを5倍長もちさせる")],
  lumberjack: [building("木こり小屋", "近くの育った木を伐って木材にする")],
  forester: [building("植林小屋", "近くの空き地に木を植える")],
  quarry: [
    building("採石場", "近くの岩から石材を切り出す"),
    building("石材工房", "起重機と石工小屋つき。掘り尽くした岩も3分の1ではなく全速で切り続ける。周りはさらに埃っぽくなる")
  ],
  mine: [building("鉱山", "近くの鉱床から鉱石を掘る")],
  fishery: [building("漁師小屋", "魚をとる。2マス以内に自分だけの水辺が要る")],
  smokehouse: [building("燻製小屋", "魚を燻製にする。燻製魚は冬じゅうもつ")],
  sawmill: [building("製材所", "木材をひいて板材にする")],
  smithy: [building("鍛冶屋", "鉱石を鍛えて道具にする")],
  farm: [
    building("農場", "周りに畑を作り、小麦を収穫する"),
    building("荘園", "納屋と鳩小屋つき。3人目の働き手が同じ畑を1.5倍の速さで刈り取る")
  ],
  mill: [building("製粉所", "小麦をひいて小麦粉にする")],
  bakery: [
    building("パン屋", "小麦粉を焼いてパンにする"),
    building("製パン所", "2つ目のかまどと3人目のパン職人。パンが6秒ではなく4秒ごとに焼ける")
  ],
  sheep: [building("牧羊場", "羊の毛を刈って羊毛をとる")],
  weaver: [building("織物工房", "羊毛を織って布にする")],
  carpenter: [building("家具工房", "板材から家具を作る。富裕市民の町屋敷のため")],
  market: [
    building("市場", "売り子が、通りかかる家に魚、パン、布、家具を届ける"),
    building("屋内市場", "屋根のある市場。売り子はより遠くまで、より頻繁に回り、周りの通りも上等になる")
  ],
  chapel: [
    building("礼拝堂", "司祭が、通りかかる家に信仰を届ける"),
    building("教会", "塔のある教会。司祭はより遠くまで、より頻繁に回り、周りの通りは最も上等になる")
  ],
  firewatch: [
    building("火の番所", "火の番が道すがら家と工房の火の気を見回り、火事には火消しが駆けつける"),
    building("消防団", "鐘楼とポンプつき。火の番はより遠くまで、より頻繁に回り、火消しは2人ではなく4人で駆けつける")
  ],
  healer: [building("診療所", "医師が道すがら家々を訪ね、病人を治す")],
  hospital: [building("病院", "医師がより頻繁に、より遠くまで往診する")],
  watchhouse: [building("衛兵所", "衛兵が通りを巡回し、道すがら家々の治安を守る")],
  builder: [building("修繕所", "大工が道すがら家や建物を板材と石材で修繕する")]
} satisfies Record<KindId, readonly [Thing, ...ReadonlyArray<Thing>]>

/** A building at its level of upgrades (0: as built). A level it has no name for reads as the last it has. */
export const built = (id: KindId, level = 0): Thing => {
  const levels: readonly [Thing, ...ReadonlyArray<Thing>] = kinds[id]
  return levels[Math.max(0, Math.min(level, levels.length - 1))] ?? levels[0]
}

/** A good: the ware, and the unit it is counted in. */
export const goods = {
  wood: noun("木材", "本"),
  planks: noun("板材", "枚"),
  stone: noun("石材", "個"),
  ore: noun("鉱石", "個"),
  tools: noun("道具", "個"),
  fish: noun("魚", "匹"),
  smoked: noun("燻製魚", "匹"),
  wheat: noun("小麦", "束"),
  flour: noun("小麦粉", "袋"),
  bread: noun("パン", "個"),
  wool: noun("羊毛", "袋"),
  cloth: noun("布", "枚"),
  furniture: noun("家具", "点")
} satisfies Record<GoodId, Noun>

/** So many of a good, in words: "板材3枚", "小麦粉5袋". */
export const quantity = (id: GoodId, n: number): string => `${goods[id].word}${counted(n, goods[id])}`

/** A tier of homes: who lives there, and what the home is called. */
export const tiers = {
  1: { people: "入植者", home: noun("入植者の小屋", "軒") },
  2: { people: "市民", home: noun("市民の家", "軒") },
  3: { people: "富裕市民", home: noun("町屋敷", "軒") }
} satisfies Record<Tier, { readonly people: string; readonly home: Noun }>

/** The town's ranks, lowest first (see `ranks` in the content). */
export const ranks = ["集落", "村", "町", "都市"] as const
/** A rank's name: one past the last reads as the last. */
export const rankName = (rank: number): string => ranks[Math.max(0, Math.min(rank, ranks.length - 1))] ?? ranks[0]
/** A rank as a sentence names it, set off in 「」: "「村」". */
export const rankOf = (rank: number): string => `「${rankName(rank)}」`

/** The land's size, as a button says it; `sizeOf` as a sentence does. */
export const sizes = { small: "小", medium: "中", large: "大" } satisfies Record<SizeId, string>
export const sizeOf = { small: "小さな", medium: "中くらいの", large: "広い" } satisfies Record<SizeId, string>
export const lands = {
  rich: { name: "豊か", blurb: "深い森、豊富な石材と鉱石、湖が2つ、潤沢な財源" },
  fair: { name: "ふつう", blurb: "無駄にしなければ、何でも足りるだけある" },
  harsh: { name: "痩せた", blurb: "まばらな森、わずかな石材、鉱床が1つ、湖が1つ" }
} satisfies Record<LandId, { readonly name: string; readonly blurb: string }>
/** A land as a sentence names it: "豊かな土地", "痩せた土地". */
export const landOf = { rich: "豊かな土地", fair: "ふつうの土地", harsh: "痩せた土地" } satisfies Record<LandId, string>
/** A winter's severity, as a label says it; `winterOf` as a sentence names the winter. */
export const winters = { mild: "穏やか", normal: "平年並み", hard: "厳しい" } satisfies Record<WinterId, string>
export const winterOf = { mild: "穏やかな冬", normal: "平年並みの冬", hard: "厳しい冬" } satisfies Record<WinterId, string>

export const grounds = {
  lawn: piece("芝生", "マス", "公園を作るための芝"),
  flowers: piece("花壇", "マス", "花を植えた縁取り。芝生より美しい"),
  path: piece("砂利道", "マス", "公園を抜ける散歩道"),
  square: piece("石畳の広場", "マス", "敷石の広場。像や噴水を置ける")
} satisfies Record<GroundId, Thing>
export const props = {
  lamp: piece("街灯", "基", "散歩道に沿った鉄の街灯"),
  fountain: piece("噴水", "基", "澄んだ水をたたえた石の水盤"),
  statue: piece("像", "体", "石の創設者像。公園の誇り")
} satisfies Record<PropId, Thing>

export const needs = { food: "食料", bread: "パン", cloth: "布", faith: "信仰", furniture: "家具" } satisfies Record<Need, string>

/** What a landmark lends its streets' names: 粉屋小路, パン屋通り. */
const streets = {
  townhall: "役場", warehouse: "倉庫", granary: "穀倉", lumberjack: "木こり", forester: "森番", quarry: "石切",
  mine: "鉱山", fishery: "漁師", smokehouse: "燻製", sawmill: "製材", smithy: "鍛冶屋", farm: "農場", mill: "粉屋",
  bakery: "パン屋", sheep: "羊飼い", weaver: "機屋", market: "市場", chapel: "礼拝堂", firewatch: "火の番", healer: "薬師",
  hospital: "病院", watchhouse: "衛兵", builder: "大工", carpenter: "家具屋"
} satisfies Record<KindId, string>
/** The ways a street is called: as many as `STREET_WAYS`. */
const ways = ["通り", "小路", "横丁", "坂", "町", "辻"] as const

/** Where something happened: "粉屋通り", "役場広場", or "町はずれ". */
export const place = (where: Place): string =>
  where === null ? "町はずれ" : `${streets[where.kind]}${where.kind === "townhall" ? "広場" : ways[where.way % ways.length]}`

/**
 * The finished names, as the page reads them: a heading (`title`), the
 * word in a sentence (`name`), and what it is for (`blurb`). Japanese has
 * no capitals, so a heading and a name are the same word.
 */
export const names = {
  kind: {
    /** "屋内市場": a building at its level of upgrades, as a heading. */
    title: (id: KindId, level = 0): string => built(id, level).noun.word,
    /** "屋内市場": as a sentence names it. */
    name: (id: KindId, level = 0): string => built(id, level).noun.word,
    blurb: (id: KindId, level = 0): string => built(id, level).blurb
  },
  good: {
    /** "板材", "燻製魚": the ware. */
    name: (id: GoodId): string => goods[id].word
  },
  tier: {
    /** "入植者", "市民", "富裕市民". */
    people: (tier: Tier): string => tiers[tier].people,
    /** "入植者の小屋", "市民の家", "町屋敷". */
    home: (tier: Tier): string => tiers[tier].home.word
  },
  /** "集落", "村", "町", "都市": a rank past the last reads as the last. */
  rank: (rank: number): string => rankName(rank),
  size: (id: SizeId): string => sizes[id],
  land: { name: (id: LandId): string => lands[id].name, blurb: (id: LandId): string => lands[id].blurb },
  winter: (id: WinterId): string => winters[id],
  ground: { title: (id: GroundId): string => grounds[id].noun.word, name: (id: GroundId): string => grounds[id].noun.word, blurb: (id: GroundId): string => grounds[id].blurb },
  prop: { title: (id: PropId): string => props[id].noun.word, name: (id: PropId): string => props[id].noun.word, blurb: (id: PropId): string => props[id].blurb },
  need: (need: Need): string => needs[need],
  place
}
