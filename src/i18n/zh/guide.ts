/**
 * Simplified Chinese for the mayor's guide (`game/rules/guide.ts`): what
 * each step asks for, why, and what closes it; and what the guide says of
 * the town as it stands (what is under way, what opens a building, what
 * comes next). The same steps and the same tokens as English's
 * (`../en/guide.ts`), in the words of senshinya's fork, which translated the
 * guide when its text still lived in the rules.
 *
 * As in English, a step is one thing to do (`action`, one sentence, ending
 * in 。), one reason (`why`), and what puts it away (`goal`, a short clause
 * that reads after "完成条件："). Tools, panels, and map views are tokens;
 * what a finger and a mouse do is said with `token.device` (轻点, 点击).
 * Where a sentence names a building or a good again where English says
 * "it", the second is plain words, so a step shows the chips English's
 * does and no more. Amounts stay words.
 */
import type { GoodId, KindId } from "../../game/content/index.ts"
import type { Chapter, GuideLocked, GuideSoon, GuideStepId, GuideWaiting } from "../../game/rules/guide.ts"
import type { guide as English } from "../en/guide.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { built, tiers } from "./nouns.ts"

/** A building, as a chip: by its plain name, or by the word the sentence needs (市场大厅, for the market's upgrade). */
const k = (id: KindId, shown?: string) => token.kind(id, shown)
/** A good, as a chip. */
const g = (id: GoodId) => token.good(id)
const tool = token.command
const map = token.view
const tap = token.device("轻点", "点击")
/** The market's upgrade, as its chip says it. */
const marketHall = k("market", built("market", 1).noun.word)

/** A step in words: what to do, why, and when it is done. */
interface Step {
  readonly action: string
  readonly why: string
  readonly goal: string
}

const chapters = {
  founding: "建立城镇",
  standing: "维持运转",
  citizens: "吸引市民",
  governing: "治理城镇"
} satisfies Record<Chapter, string>

const steps = {
  // ── The opening, in order ──
  homes: {
    action: `选择${tool("homes")}，沿市政厅周围的灰色道路拖动${token.device("，再轻点“建造”", "")}。`,
    why: "移民会入住与道路相连的住宅；有食物供应的住宅缴纳税款，为城镇带来收入。",
    goal: "一栋住宅建成"
  },
  road: {
    action: `选择${tool("road")}，从市政厅周围的道路向水边拖动铺路。`,
    why: `建筑一侧的中点必须连接道路，人员才能到达。接下来要建${k("fishery")}，需要靠近水域。`,
    goal: "道路延伸至距水域两格以内"
  },
  fishery: {
    action: `${tap}${k("fishery")}，将其放在这条道路旁，距水域不超过两格。`,
    why: `移民需要食物。城镇最初只有少量${g("fish")}，且库存中的${g("fish")}会逐渐腐坏。`,
    goal: `一座${k("fishery")}建成`
  },
  look: {
    action: `使用${tool("select")}，再${tap}${k("fishery")}打开详情面板。`,
    why: "建筑的工人来自十五格道路内的住宅；详情面板显示人手和运转障碍，顶部就业计数汇总所有岗位。",
    goal: "打开一座建筑的详情面板"
  },
  lumberjack: {
    action: `在树林旁、与道路相连的位置建造${k("lumberjack")}。`,
    why: `${g("planks")}即将耗尽，而住宅和建筑都需要木板。先采集${g("wood")}，才能加工${g("planks")}。`,
    goal: `一座${k("lumberjack")}建成`
  },
  sawmill: {
    action: `在${k("lumberjack")}附近、与道路相连的位置建造${k("sawmill")}。`,
    why: `物资通过生产链加工：${k("lumberjack")}获取${g("wood")}，${k("sawmill")}将其加工成${g("planks")}，运输员沿道路在建筑之间搬运。`,
    goal: `一座${k("sawmill")}建成`
  },
  term: {
    action: `打开${tool("town")}面板，查看顶部的发展目标。`,
    why: `达成目标可让聚落依次晋升为村庄、城镇和城市，每次晋升都会获得王室奖励。需要考虑布局时，可用${tool("pause")}让时间停下。`,
    goal: "打开城镇面板"
  },
  grow: {
    action: "继续铺路、建造住宅，直到十栋住宅建成。",
    why: `人口增加会带来更多税收，并在${tool("build")}菜单中解锁新建筑。引导只会在城镇需要时建议建造。`,
    goal: "十栋住宅建成"
  },

  // ── The course goes on: citizens ──
  quarry: {
    action: `在浅色岩石旁、与道路相连的位置建造${k("quarry")}。`,
    why: `${g("stone")}即将耗尽，市民所需的工坊都要用到石料。深色岩石是${g("ore")}，稍后才会用到。`,
    goal: `一座${k("quarry")}建成`
  },
  cloth: {
    action: `建造${k("sheep")}和${k("weaver")}，让两者相邻并连接道路。`,
    why: `住宅需要${g("bread")}、${g("cloth")}和信仰才能升级为市民住宅。${k("sheep")}获取${g("wool")}，${k("weaver")}将其织成${g("cloth")}。`,
    goal: `一座${k("sheep")}和一座${k("weaver")}建成`
  },
  chapel: {
    action: `在住宅区中、与道路相连的位置建造${k("chapel")}。`,
    why: `第二项需求是信仰。${k("chapel")}的传教士为沿途住宅提供信仰服务，${k("chapel")}也会提高街区宜居度。`,
    goal: `一座${k("chapel")}建成`
  },
  wheat: {
    action: `建造${k("farm")}和${k("mill")}。`,
    why: `第三项需求是${g("bread")}，它的生产链最长：${k("farm")}种植${g("wheat")}，${k("mill")}将小麦磨成${g("flour")}。`,
    goal: `一座${k("farm")}和一座${k("mill")}建成`
  },
  bakery: {
    action: `在${k("mill")}附近建造${k("bakery")}。`,
    why: `面包坊把${k("mill")}的${g("flour")}烤成${g("bread")}。${tiers[1].home.word}获得${g("bread")}供应后，税收也会增加 50%。`,
    goal: `一座${k("bakery")}建成`
  },
  citizens: {
    action: `使用${tool("select")}，再${tap}住宅，查看升级为市民住宅还缺少什么。`,
    why: `住宅获得${g("bread")}、${g("cloth")}和信仰，街区宜居度达到 5，并从库存支付${g("planks")}与${g("stone")}后，即可升级。详情面板会列出尚未满足的条件。`,
    goal: "首栋住宅入住市民"
  },
  goals: {
    action: `打开${tool("town")}面板，查看距离发展目标还有多远。`,
    why: "首批市民已入住；城镇等级越高，要求的市民占比也越高。",
    goal: "打开城镇面板"
  },
  ranks: {
    action: `达成${tool("town")}面板中的全部目标，提升城镇等级。`,
    why: `同时满足全部目标并维持两分钟，即可晋升，最高成为城市。达到城镇等级后，${k("market")}和${k("chapel")}可原地升级。需要处理问题时，引导会及时提醒。`,
    goal: "晋升为城市"
  },

  // ── Around the course, when the town needs them ──
  crown: {
    action: "用顶部王室要求中的“交付”按钮，送出所需物资。",
    why: "交付可获得金币；逾期会被罚款，连续三次未交付将导致任期失败。",
    goal: "交付所需物资"
  },
  winter: {
    action: `在冬季到来前建造${k("granary")}或${k("smokehouse")}。`,
    why: `冬季捕鱼减少，居民食物消耗加快，${g("fish")}还会在库存中腐坏。${k("granary")}可将保鲜时间延长至五倍，${g("smoked")}则能储存整个冬季。`,
    goal: `一座${k("granary")}或${k("smokehouse")}建成`
  },
  tools: {
    action: `在${tool("town")}面板的“物资与贸易”中，将${g("tools")}设为买入。`,
    why: `工坊会消耗${g("tools")}，只有${k("smithy")}能生产新工具；市民达到 10 人时解锁铁匠铺。`,
    goal: `设为买入${g("tools")}，或建成${k("smithy")}`
  },
  forester: {
    action: `在${k("lumberjack")}旁建造${k("forester")}。`,
    why: `${k("lumberjack")}附近的树木即将砍完，${k("forester")}可以补种。`,
    goal: `一座${k("forester")}建成`
  },
  firewatch: {
    action: `在住宅区中、与道路相连的位置建造${k("firewatch")}。`,
    why: `木制小屋容易着火，火势还会蔓延至邻居。消防巡查员降低火灾风险，消防员负责灭火。${map("fire")}可显示火灾风险。`,
    goal: `一座${k("firewatch")}建成`
  },
  builder: {
    action: `在破旧建筑附近建造${k("builder")}。`,
    why: `破旧建筑效率减半，还有坍塌风险。修缮工坊的工匠使用${g("planks")}和${g("stone")}维修沿途建筑。${map("condition")}可显示建筑状况。`,
    goal: `一座${k("builder")}建成`
  },
  market: {
    action: `在距离市政厅较远的住宅区建造${k("market")}。`,
    why: `部分住宅超出了市政厅配送员的二十格道路范围，无法获得食物。${k("market")}可向更远的街区配送。`,
    goal: `一座${k("market")}建成`
  },
  markethall: {
    action: `${tap}上方带金色箭头的${k("market")}，在详情面板中开始升级${marketHall}。`,
    why: `部分住宅位于所有配送员的服务范围之外。${marketHall}配送更频繁、范围更远，无需另建一座${k("market")}。`,
    goal: `一座${marketHall}建成`
  },
  street: {
    action: `将这栋住宅所在街区的宜居度提高至 5：在附近增建${k("chapel")}、${k("market")}或公园，并让工坊远离住宅。`,
    why: `这栋住宅已有${g("bread")}、${g("cloth")}和信仰，但市民还要求街区宜居。${map("appeal")}可显示宜居度。`,
    goal: "优质街区的一栋住宅入住市民"
  },
  carpenter: {
    action: `建造${k("carpenter")}，用${g("planks")}制作${g("furniture")}。`,
    why: `富裕市民居住的市民宅邸需要${g("furniture")}：首次升级要消耗两件，此后还需${k("market")}定期配送，才能维持等级。市民宅邸容纳人数最多，税收也最高。`,
    goal: `一座${k("carpenter")}建成`
  },
  healer: {
    action: `在住宅区中、与道路相连的位置建造${k("healer")}。`,
    why: `疾病正在蔓延，患病住宅的容量减半。${k("healer")}的医师会巡视住宅、治疗病人。${map("health")}可显示疾病风险。`,
    goal: `一座${k("healer")}建成`
  },
  watchhouse: {
    action: `在住宅区中、与道路相连的位置建造${k("watchhouse")}。`,
    why: `宜居度低、住宅半空和支持度低都会增加盗窃风险。治安所警员沿街巡逻，维护秩序。${map("order")}可显示治安风险。`,
    goal: `一座${k("watchhouse")}建成`
  },
  trade: {
    action: `在${tool("town")}面板的“物资与贸易”中，出售积压物资，或买入短缺物资。`,
    why: "新城镇默认不交易物资。出售多余物资，可以换取金币。",
    goal: "设为出售或买入一种物资"
  },
  taxes: {
    action: `在${tool("town")}面板中适当提高税率。`,
    why: "居民较满意，但城镇正在亏损，可考虑适当加税。税率超过 125% 会积累持久的怨恨。",
    goal: "调整一次税率"
  },
  smithy: {
    action: `在带锈色纹路的深色岩石旁建造${k("mine")}，并建造${k("smithy")}。`,
    why: `${g("tools")}即将耗尽，工坊还会持续消耗。${k("mine")}开采${g("ore")}，${k("smithy")}将矿石锻造成${g("tools")}。`,
    goal: `一座${k("mine")}和一座${k("smithy")}建成`
  }
} satisfies Record<GuideStepId, Step>

/** What is happening, once the mayor has done a step's part and the town is at work on it. */
const waiting = {
  homesNoPlanks: () => `住宅正在等待${g("planks")}，但仓储中已无木板。`,
  homesRising: () => `施工人员正从仓储向新住宅运送${g("planks")}，建成后移民便会入住。${tool("speed")}可加快时间。`,
  siteNoPlanks: () => `库存中的${g("planks")}已耗尽，工地正在等待：在${tool("town")}面板出售多余物资，或购买${g("planks")}。`,
  siteRising: () => `目前仍是工地：运输员先从仓储运来${g("planks")}和${g("stone")}，随后开始搭建。${tool("speed")}可加快时间。`,
  homesLaid: () => "十栋住宅已放置，正在施工。"
} satisfies Wording<GuideWaiting>

/** Why the town cannot build what a step asks for yet, and what to do meanwhile. */
const locked = {
  residents: (l) => `${k(l.kind)}需要 ${l.needs} 位居民才能解锁（当前 ${l.now} 位）：增建${tool("homes")}并保证食物供应。`,
  citizens: (l) => `${k(l.kind)}需要 ${l.needs} 位市民才能解锁（当前 ${l.now} 位）。`,
  coins: (l) => `先积攒金币：${k(l.kind)}需要 ${l.cost} 金币（当前 ${l.now}）。住宅每分钟缴纳税款。`
} satisfies Wording<GuideLocked>

/** The next step that waits for the town to need it: what it will ask for, and when it comes. */
const upcoming = {
  lumberjack: (s) => `接下来：${g("planks")}库存低于 ${s.below} 时建造${k("lumberjack")}和${k("sawmill")}（当前 ${s.now}）。`,
  sawmill: (s) => `接下来：${g("planks")}库存低于 ${s.below} 时建造${k("sawmill")}（当前 ${s.now}）。`,
  quarry: (s) => `接下来：${g("stone")}库存低于 ${s.below} 时建造${k("quarry")}（当前 ${s.now}）。`
} satisfies Wording<GuideSoon>

export const guide = { chapters, steps, waiting, locked, upcoming } satisfies typeof English
