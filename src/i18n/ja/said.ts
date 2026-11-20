/**
 * Japanese for what the simulation says as data (`game/said.ts`): the
 * chronicle's news, the answers to an edit, why a term ended, and what
 * something costs and gives back. One function for each thing it can say,
 * as in English. The news is told in です・ます, a sentence or two each;
 * where English packs a clause after a colon, Japanese often makes it a
 * sentence of its own.
 */
import type { GoodId, Kind, KindId } from "../../game/content/index.ts"
import type { Salvage } from "../../game/rules/salvage.ts"
import type { Event, Lock, Notice, Reason } from "../../game/said.ts"
import * as token from "../token.ts"
import { say, type Wording } from "../wording.ts"
import { count, counted, noun } from "./grammar.ts"
import { built, goods, landOf, names, place, props, quantity, rankOf, sizeOf, winterOf } from "./nouns.ts"

/** A building in the news, as a chip, by what it is called at its level. */
const building = (id: KindId, level = 0) => token.kind(id, built(id, level).noun.word)
const ware = (id: GoodId) => token.good(id)
/** So many of a good, the good as a chip: "[板材]20枚". */
const some = (id: GoodId, n: number) => `${ware(id)}${counted(n, goods[id])}`

// ── Costs ─────────────────────────────────────────────────────────────────

const entries = (materials: Partial<Record<GoodId, number>>) =>
  (Object.entries(materials) as Array<[GoodId, number]>).filter(([, n]) => n > 0)

/** A cost as amounts side by side: its coins (when it has any), then each material. The page sets them as icons, without the dots. */
export const cost = (c: Kind["cost"]): string =>
  [...(c.coins > 0 ? [token.coins(c.coins)] : []), ...entries(c.materials).map(([g, n]) => token.amount(g, n))].join(" · ")

/** What pulling something down costs and gives back: "−25・板材2、石材3を回収" (nothing: an empty line). */
export const salvage = (s: Salvage): string => {
  const back = entries(s.back).map(([g, n]) => token.amount(g, n)).join("、")
  return [...(s.fee !== 0 ? [token.coins(-s.fee, true)] : []), ...(back ? [`${back}を回収`] : [])].join("・")
}

const coin = noun("金貨", "枚")
/** A number with its sign, the minus a true minus: "+25", "−25". */
const figure = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

/** An amount in words, where an icon cannot go (a tooltip, a title): "金貨25枚", "毎分金貨3枚", "板材2枚". A signed amount is a change, and reads as one: "金貨+25". */
export const amount = {
  coins: (n: number, marked = false): string => (marked ? `${coin.word}${figure(n)}` : count(n, coin)),
  rate: (n: number, marked = false): string => (marked ? `毎分${coin.word}${figure(n)}` : `毎分${count(n, coin)}`),
  good: (id: GoodId, n: number): string => quantity(id, n),
  /** After a number of coins beside their icon: a minute's worth. */
  perMinute: "/分"
}

// ── The chronicle ─────────────────────────────────────────────────────────

const homes = noun("家", "軒"), buildings = noun("建物", "棟")

export const chronicle = {
  founded: (e) => `${sizeOf[e.size]}${landOf[e.land]}に町を開きました。任期は${e.term}分です。`,
  nextTerm: (e) => `第${e.term}期：町長の任期がさらに${e.minutes}分続きます。`,
  residents: (e) => `住民が${e.mark}人になりました。`,
  treasuryEmpty: () => "財源が底をつきました。賃金が払えません。",
  uproar: () => "町は騒然としています。",
  bankrupt: () => "破産：王室が町長から財源を取り上げました。",
  revolt: () => "反乱：町の人々が町長を追放しました。",
  abandoned: () => "放棄：人々が町を去りました。",
  dismissed: (e) => `罷免：王室は、要請に${e.patience}回応えなかった町長を解任しました。`,
  termOver: (e) => `第${e.term}期が終わりました。町は${rankOf(e.rank)}として健在です。`,
  goalsMet: (e) => `${rankOf(e.rank)}の目標をすべて達成しました。あとは維持するだけです。`,
  rankReached: (e) => `町は${rankOf(e.rank)}になりました。王室から金貨${e.reward}枚が届きます。`,
  crownAsks: (e) => `王室が${e.minutes}分以内に${some(e.good, e.amount)}を求めています。報酬は金貨${e.reward}枚です。`,
  crownUnanswered: (e) => `王室の求めた${some(e.good, e.amount)}を届けられませんでした。罰金は金貨${e.fine}枚です。`,
  crownSent: (e) => `王室に${some(e.good, e.amount)}を送り、金貨${e.reward}枚を受け取りました。`,
  winter: (e) =>
    `${e.year}年目、${winterOf[e.severity]}です。畑は眠り、漁獲は${e.fishing}%に落ちます。${e.heating ? "家々は暖をとるために火をたきます。" : ""}`,
  spring: (e) => `${e.year}年目の春です。`,
  winterComing: (e) => `あと1分で冬です。暦によれば${winterOf[e.severity]}になりそうです。食料の蓄えは${e.larder}、町は毎分${e.eats}を食べます。`,
  fire: (e) => `${place(e.place)}で火事！`,
  fireOver: (e) => {
    const took = [...(e.homes > 0 ? [count(e.homes, homes)] : []), ...(e.buildings > 0 ? [count(e.buildings, buildings)] : [])]
    return `${place(e.place)}の火事：${took.length > 0 ? `${took.join("と")}が焼け落ちました` : "鎮火しました"}。`
  },
  sickness: (e) => `${place(e.place)}で病気が出ました。医師なら治せます。`,
  theftCoins: (e) => `${place(e.place)}で泥棒が金貨${e.coins}枚を盗んでいきました。`,
  theftGoods: (e) => `${place(e.place)}で泥棒が${ware(e.good)}を盗んでいきました。`,
  derelict: (e) => `${place(e.place)}の家が盗難のあと空き家になり、荒れ果てました。`,
  collapsed: (e) => `${place(e.place)}の${e.kind === null ? "家" : building(e.kind)}が崩れ落ちました。誰も修繕しなかったのです。`,
  rotted: (e) =>
    `この1分で、${e.rotted === 1 ? "蓄えの魚かパンが1つ" : `蓄えの魚とパンが合わせて${e.rotted}個`}腐りました。${
      e.made === null
        ? `${building("granary")}なら${ware("fish")}と${ware("bread")}が5倍長もちし、${ware("smoked")}は腐りません。`
        : `町は毎分約${e.made}の食料を作り、${e.eaten}を食べています。${token.kind("fishery")}を減らすか、${building("smokehouse")}を建てるか、${ware("fish")}を売れば無駄が減ります。`
    }`,
  lastRock: (e) =>
    e.ore
      ? `露天の${ware("ore")}を掘り尽くしました。掘った跡からも少しずつ採れます。${ware("ore")}と${ware("tools")}は商人から買えます。`
      : `露天の${ware("stone")}を切り尽くしました。掘った跡からも少しずつ採れます。${ware("stone")}は商人から買えます。`,
  worksBegin: (e) => `${building(e.kind, e.level - 1)}の工事が始まりました。${built(e.kind, e.level).noun.word}になります。`,
  upgraded: (e) => `${building(e.kind, e.level - 1)}が${built(e.kind, e.level).noun.word}になりました。`,
  legacy: (e) => e.text
} satisfies Wording<Event>

// ── Why a term ended ──────────────────────────────────────────────────────

/** How a term ended, in a word, for the reckoning's heading. */
export const ended = {
  bankrupt: "破産",
  revolt: "反乱",
  abandoned: "放棄",
  dismissed: "罷免",
  over: "任期満了"
} satisfies Record<Exclude<Reason, "none">, string>

// ── What an edit answers with ─────────────────────────────────────────────

/** What a town still lacks before it can build something: "住民20人が必要（現在12人）". */
export const lock = {
  residents: (l) => `住民${l.needs}人が必要（現在${l.has}人）`,
  citizens: (l) => `市民${l.needs}人が必要（現在${l.has}人）`
} satisfies Wording<Lock>

/** What keeps a town from an upgrade: the rank it must reach first. */
export const needsRank = (n: number): string => `${rankOf(n)}への昇格が必要`

export const notice = {
  locked: (n) => `${names.kind.title(n.kind)}：${say(lock, n.lock)}`,
  pieceLocked: (n) => `${props[n.prop].noun.word}：もっと大きな町が必要です`,
  noRoom: () => "そこには置けません",
  short: (n) => `${n.of === "coins" ? "金貨" : goods[n.of].word}が足りません`,
  parkFirst: () => "先に公園の地面を敷いてください",
  rockUnworked: () => "先に掘り尽くしてください。撤去できるのは掘った跡だけです",
  hallStays: () => "町役場は撤去できません",
  salvageFee: (n) => `撤去には${token.coins(n.fee)}かかります`,
  pulledDown: (n) => {
    const said = salvage(n.salvage)
    return `${n.cancelled ? "取り消しました" : "撤去しました"}${said ? `・${said}` : ""}${n.lost > 0 ? `（${n.lost}は倉庫に入りきりませんでした）` : ""}`
  },
  crownSent: (n) => `送りました・${token.coins(n.reward, true)}`,
  upgradeBlocked: (n) => `${names.kind.title(n.kind, n.level)}：${needsRank(n.rank)}`,
  worksBegun: (n) => `${names.kind.title(n.kind, n.level)}・${token.coins(-n.coins, true)}・運搬人が${cost({ coins: 0, materials: n.materials })}を運びます`
} satisfies Wording<Notice>
