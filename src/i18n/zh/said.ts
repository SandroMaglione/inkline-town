/**
 * Simplified Chinese for what the simulation says as data (`game/said.ts`):
 * the chronicle's news, the answers to an edit, why a term ended, and what
 * something costs and gives back. One function for each thing it can say,
 * as in English, most of it in the words of senshinya's fork (see
 * `nouns.ts`), which wrote the same news when the game still wrote it as
 * prose. Where English packs a clause after a colon, Chinese keeps the
 * colon (：) or makes the clause a sentence of its own.
 */
import type { GoodId, Kind, KindId } from "../../game/content/index.ts"
import type { Salvage } from "../../game/rules/salvage.ts"
import type { Event, Lock, Notice, Reason } from "../../game/said.ts"
import * as token from "../token.ts"
import { say, type Wording } from "../wording.ts"
import { count, noun, signed } from "./grammar.ts"
import { built, goods, landOf, names, place, props, rankName, rankOf, winters } from "./nouns.ts"

/** A building in the news, as a chip, by what it is called at its level. */
const building = (id: KindId, level = 0) => token.kind(id, built(id, level).noun.word)
const ware = (id: GoodId) => token.good(id)

// ── Costs ─────────────────────────────────────────────────────────────────

const entries = (materials: Partial<Record<GoodId, number>>) =>
  (Object.entries(materials) as Array<[GoodId, number]>).filter(([, n]) => n > 0)

/** A cost as amounts side by side: its coins (when it has any), then each material. The page sets them as icons, without the dots. */
export const cost = (c: Kind["cost"]): string =>
  [...(c.coins > 0 ? [token.coins(c.coins)] : []), ...entries(c.materials).map(([g, n]) => token.amount(g, n))].join(" · ")

/** What pulling something down costs and gives back: "−25 金币 · 返还 2 木板、3 石料" (nothing: an empty line). */
export const salvage = (s: Salvage): string => {
  const back = entries(s.back).map(([g, n]) => token.amount(g, n)).join("、")
  return [...(s.fee !== 0 ? [token.coins(-s.fee, true)] : []), ...(back ? [`返还 ${back}`] : [])].join(" · ")
}

/** A number as it is, or (`marked`) with its sign: "+25", "−25". */
const figure = (n: number, marked: boolean) => (marked ? signed(n) : `${n}`)

/** An amount in words, where an icon cannot go (a tooltip, a title): "25 金币", "+3 金币/分钟", "2 木板". */
export const amount = {
  coins: (n: number, marked = false): string => `${figure(n, marked)} 金币`,
  rate: (n: number, marked = false): string => `${figure(n, marked)} 金币/分钟`,
  good: (id: GoodId, n: number): string => count(n, goods[id]),
  /** After a number of coins beside their icon: a minute's worth. */
  perMinute: "/分钟"
}

// ── The chronicle ─────────────────────────────────────────────────────────

const homes = noun("住宅", "栋"), buildings = noun("建筑", "栋")

export const chronicle = {
  founded: (e) => `城镇建立于${landOf(e.size, e.land)}，任期 ${e.term} 分钟。`,
  nextTerm: (e) => `第 ${e.term} 届任期：市长继续执政 ${e.minutes} 分钟。`,
  residents: (e) => `城镇居民已达 ${e.mark} 位。`,
  treasuryEmpty: () => "财政资金耗尽：工资无法支付。",
  uproar: () => "城镇陷入骚乱。",
  bankrupt: () => "破产：王室收回了市长的财政管理权。",
  revolt: () => "叛乱：居民赶走了市长。",
  abandoned: () => "废弃：居民已离开城镇。",
  dismissed: (e) => `撤职：市长连续 ${e.patience} 次未满足要求，王室已将其撤换。`,
  termOver: (e) => `第 ${e.term} 届任期结束，${rankName(e.rank)}仍在运转。`,
  goalsMet: (e) => `${rankOf(e.rank)}的全部目标已达成，保持达标即可晋级。`,
  rankReached: (e) => `城镇已晋升为${rankOf(e.rank)}，王室赏赐 ${e.reward} 金币。`,
  crownAsks: (e) => `王室要求在 ${e.minutes} 分钟内交付 ${e.amount} ${ware(e.good)}，奖励 ${e.reward} 金币。`,
  crownUnanswered: (e) => `王室要求的 ${e.amount} ${ware(e.good)}未按时交付：罚款 ${e.fine} 金币。`,
  crownSent: (e) => `已向王室交付 ${e.amount} ${ware(e.good)}，获得 ${e.reward} 金币。`,
  winter: (e) => `第 ${e.year} 年，${winters[e.severity]}到来：农田停产，捕鱼量降至 ${e.fishing}%${e.heating ? "；住宅生火取暖" : ""}。`,
  spring: (e) => `第 ${e.year} 年，春季到来。`,
  winterComing: (e) => `一分钟后进入${winters[e.severity]}：食物库存 ${e.larder} 份，城镇每分钟消耗 ${e.eats} 份。`,
  fire: (e) => `${place(e.place)}发生火灾！`,
  fireOver: (e) => {
    const took = [...(e.homes > 0 ? [count(e.homes, homes)] : []), ...(e.buildings > 0 ? [count(e.buildings, buildings)] : [])]
    return `${place(e.place)}的火灾：${took.length > 0 ? `${took.join("和 ")}被烧毁` : "已扑灭"}。`
  },
  sickness: (e) => `${place(e.place)}出现疾病：医师可以治疗。`,
  theftCoins: (e) => `${place(e.place)}的盗贼偷走了 ${e.coins} 金币。`,
  theftGoods: (e) => `${place(e.place)}的盗贼偷走了${ware(e.good)}。`,
  derelict: (e) => `${place(e.place)}的一栋住宅多次遭窃，居民离开后房屋荒废。`,
  collapsed: (e) => `${place(e.place)}的${e.kind === null ? "一栋住宅" : building(e.kind)}因无人修缮而坍塌。`,
  rotted: (e) =>
    `本分钟库存中有 ${e.rotted} 份鲜鱼或面包腐坏：${
      e.made === null
        ? `${building("granary")}可使${ware("fish")}和${ware("bread")}的腐坏速度降至五分之一，${ware("smoked")}不会腐坏`
        : `城镇每分钟约生产 ${e.made} 份食物，消耗 ${e.eaten} 份：减少${token.kind("fishery")}、建${building("smokehouse")}或出售${ware("fish")}可避免浪费`
    }。`,
  lastRock: (e) =>
    e.ore
      ? `最后一处露天${ware("ore")}已采尽，采空矿面仍会缓慢产出少量矿石。也可向商人购买${ware("ore")}和${ware("tools")}。`
      : `最后一处露天${ware("stone")}已采尽，采空矿面仍会缓慢产出少量石料。也可向商人购买${ware("stone")}。`,
  worksBegin: (e) => `${building(e.kind, e.level - 1)}开始升级施工，完工后将成为${built(e.kind, e.level).noun.word}。`,
  upgraded: (e) => `${building(e.kind, e.level - 1)}已升级为${built(e.kind, e.level).noun.word}。`,
  legacy: (e) => e.text
} satisfies Wording<Event>

// ── Why a term ended ──────────────────────────────────────────────────────

/** How a term ended, in a word, for the reckoning's heading. */
export const ended = {
  bankrupt: "破产",
  revolt: "叛乱",
  abandoned: "废弃",
  dismissed: "撤职",
  over: "任期结束"
} satisfies Record<Exclude<Reason, "none">, string>

// ── What an edit answers with ─────────────────────────────────────────────

/** What a town still lacks before it can build something: "需要 20 位居民（当前 12 位）". */
export const lock = {
  residents: (l) => `需要 ${l.needs} 位居民（当前 ${l.has} 位）`,
  citizens: (l) => `需要 ${l.needs} 位市民（当前 ${l.has} 位）`
} satisfies Wording<Lock>

/** What keeps a town from an upgrade: the rank it must reach first. */
export const needsRank = (n: number): string => `需要城镇等级达到${rankOf(n)}`

export const notice = {
  locked: (n) => `${names.kind.title(n.kind)}${say(lock, n.lock)}`,
  pieceLocked: (n) => `${props[n.prop].noun.word}需要更大的城镇`,
  noRoom: () => "此处空间不足",
  short: (n) => `${n.of === "coins" ? "金币" : goods[n.of].word}不足`,
  parkFirst: () => "请先铺设公园地面",
  rockUnworked: () => "请先采尽矿藏，只有采空矿面可以清理",
  hallStays: () => "市政厅不可拆除",
  salvageFee: (n) => `拆除需要 ${token.coins(n.fee)}`,
  pulledDown: (n) => {
    const said = salvage(n.salvage)
    return `${n.cancelled ? "已取消施工" : "已拆除"}${said ? ` · ${said}` : ""}${n.lost > 0 ? `（${n.lost} 份物资因仓储空间不足而损失）` : ""}`
  },
  crownSent: (n) => `已交付 · ${token.coins(n.reward, true)}`,
  upgradeBlocked: (n) => `${names.kind.title(n.kind, n.level)}${needsRank(n.rank)}`,
  worksBegun: (n) => `${names.kind.title(n.kind, n.level)} · ${token.coins(-n.coins, true)} · 运输员将送来 ${cost({ coins: 0, materials: n.materials })}`
} satisfies Wording<Notice>
