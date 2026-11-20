/**
 * Simplified Chinese for the page itself (`ui/dom` and what starts it,
 * `app/browser.ts`): its buttons, headings, tooltips, dialogs, and the chips
 * a message's tokens become. The same entries as English, part for part
 * (`satisfies` holds it to them), in the words of senshinya's fork wherever
 * it had the same thing to say; the parts the page has gained since (the
 * language menu, the maker's credit, the sign-up for the next game) were
 * written here, in the same words.
 *
 * Buttons, headings, and a panel's rows are short nouns or verbs ("交付",
 * "维护费"); what is read as sentences (behind an ⓘ, in a dialog) ends in
 * 。. A sentence with the page's own markup set into it takes each piece as
 * a string, as in English, and Chinese puts it where it reads.
 *
 * The page sets a warning's lead in bold with a space before its text, and
 * the charter's "by" with a space before the author: so neither ends in a
 * colon here, which would leave a full-width colon and a space between them.
 */
import { COMMUTE, home, mood, park, type Category, type GoodId, type GroundId, type KindId, type LandId, type PropId, type SizeId, type Tier, type WinterId } from "../../game/content/index.ts"
import type { Status } from "../../game/schema.ts"
import type { Trouble } from "../../platform/save.ts"
import type { Offered, ShareFailure } from "../../platform/share/client.ts"
import type { Panel } from "../../view/contracts.ts"
import type { page as English } from "../en/page.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { count, signed } from "./grammar.ts"
import { built, goods, grounds, landOf, lands, names, props, rankName, rankOf, sizes, tiers, winters } from "./nouns.ts"

/** A number with its sign as a slider or a chip shows it: "+4", "-4", "0". */
const plus = (n: number) => `${n > 0 ? "+" : ""}${n}`
const name = (id: KindId, level = 0) => built(id, level).noun.word
/** So many of a good, in words: "20 鲜鱼". */
const some = (good: GoodId, n: number) => count(n, goods[good])

/** A workplace short of its crew, as the view names it. */
interface ShortPlace {
  readonly title: string
  readonly assigned: number
  readonly needed: number
  readonly nobodyNear: boolean
}

/** A warning over the town: what it is, in a word or two, and what it says. */
const warning = (lead: string, text: string) => ({ lead, text })

/** Asking before something that replaces the town: the question, what it means, and its two ways on. */
const leave = (title: string, text: string, saveThen: string, without: string) => ({ title, text, saveThen, without })

/** What the bar a held stroke waits at calls its button: the messages that send a finger to it name it by this. */
const lay = "建造"

export const page = {
  /** What a building's chip in a message says on hover. */
  chips: {
    goTo: (id: KindId): string => `定位${name(id)}`,
    /** A row that places a building, on hover. */
    place: (id: KindId): string => `建造${name(id)}`,
    build: (id: KindId): string => `建造${name(id)}：${built(id).blurb}`
  },
  /** How long ago a save was made, roughly. */
  ago: {
    now: "刚刚",
    minutes: (n: number): string => `${n} 分钟前`,
    hours: (n: number): string => `${n} 小时前`,
    yesterday: "昨天",
    days: (n: number): string => `${n} 天前`
  },
  /** Words more than one part of the page says. */
  common: {
    close: "关闭",
    closeEsc: "关闭（Esc）",
    cancel: "取消",
    /** A section's ⓘ. */
    whatThisMeans: "查看说明",
    showWhere: "定位",
    dismiss: "收起",
    coins: "金币"
  },

  // ── The map and its tools ───────────────────────────────────────────────

  /** What picking something to put on the map says, and the bar a held stroke waits at. */
  map: {
    place: (id: KindId): string => {
      const what = name(id)
      return token.device(`轻点预览${what}的位置，再次轻点确认建造`, `点击放置${what} · Esc 取消`)
    },
    layGround: (id: GroundId): string => {
      const what = grounds[id].noun.word
      return token.device(`拖出矩形铺设${what}，然后轻点“${lay}”`, `拖出矩形铺设${what} · Esc 取消`)
    },
    furnish: (id: PropId): string => {
      const what = props[id].noun.word
      return token.device(`轻点公园格子预览${what}，再次轻点确认摆放`, `点击公园格子摆放${what} · Esc 取消`)
    },
    /** A touch tap that holds what it would do: tapped again, it does it. */
    tapAgain: { remove: "再次轻点确认拆除", build: "再次轻点确认在此建造" },
    overlays: "地图图层",
    stroke: { build: lay, cancel: "取消" }
  },
  toolbar: {
    town: { label: "城镇", title: "城镇目标、统计、税率和贸易（T）" },
    more: "更多操作：分享、引导、保存、读取、新城镇",
    pause: "暂停或继续游戏（空格键）",
    /** A speed's button: "以 2× 运行（2）". */
    runAt: (speed: string, key: string): string => `以 ${speed} 运行（${key}）`,
    cycle: "切换速度：1×、2×、4×",
    /** The pause switch, read aloud: what pressing it does now. */
    run: "继续游戏",
    pauseNow: "暂停游戏",
    runAtLast: (last: number): string => `以 ${last} 倍速运行`
  },
  mapViews: {
    title: "地图图层",
    help: "按这些指标给地图着色，查看城镇各处的情况；再次按快捷键或点击即可隐藏。",
    show: (label: string, key: string): string => `在地图上显示${label}（${key}）；再次点击隐藏`
  },
  /** Share, the guide, save, load, and new town: each button's label and what it says on hover. */
  system: {
    share: { label: "分享", tip: "分享城镇图片，或生成链接，让他人查看城镇并继续游玩" },
    guide: {
      label: "引导",
      tip: "开关新手引导：提示下一步做什么，以及原因",
      turnOn: "重新开启引导，在动态栏顶部查看下一步及其原因",
      turnOff: "关闭引导"
    },
    language: { label: "语言", tip: "选择城镇显示的语言" },
    save: { label: "保存", tip: "将城镇保存到此浏览器（每两分钟自动保存）" },
    load: { label: "读取", tip: "读取最新的手动或自动存档" },
    newTown: { label: "新城镇", tip: "在新地图上建立城镇" },
    recentre: { label: "重置镜头", tip: "恢复初始角度和中心" },
    leave: {
      load: leave("读取最新存档？", "当前城镇将被最新的手动或自动存档替换。", "保存后读取", "不保存，直接读取"),
      newTown: leave("建立新城镇？", "除非先保存，否则当前城镇将永久丢失。", "保存后选择新地图", "不保存，直接选择新地图"),
      stay: "继续游戏"
    }
  },
  /** The camera bar in the map's corner (the renderer draws it): its two drag modes, the zoom, and the way back. */
  camera: {
    label: "地图镜头",
    pan: { label: "平移", title: "拖动平移；道路、铺石、住宅和公园地面工具通过拖动建造" },
    rotate: { label: "旋转", title: "拖动旋转地图；右键拖动也可旋转，Q 和 E 每次旋转八分之一圈" },
    zoomOut: "缩小",
    zoom: "镜头缩放",
    zoomIn: "放大",
    reset: { label: "重置镜头", title: "恢复初始角度和中心（Home）" }
  },
  /** Choosing the language: every language is listed by its own name, so only what is around the list is said here. */
  language: {
    /** On the language now in use, read aloud. */
    current: (name: string): string => `${name}（当前使用）`,
    /** The browser would not keep the choice, so the page stays as it is. */
    notKept: "此浏览器无法保存所选语言，界面语言保持不变"
  },
  /** The maker's credit: what each link is, read aloud. */
  credit: {
    typeonce: "Typeonce Games：Inkline Town 作者的更多游戏",
    ritmo: "GitHub 上的 ritmo：制作 Inkline Town 所用的 ECS 运行时",
    madeWith: "基于",
    madeBy: "由 Typeonce 制作",
    newTab: (label: string): string => `${label}（在新标签页中打开）`
  },

  // ── The heads-up display ────────────────────────────────────────────────

  hud: {
    /** What each good is for: who makes it, who takes it. */
    goods: {
      wood: "伐木场砍伐树木；锯木厂将原木加工成木板",
      planks: "住宅和建筑的建材：锯木厂将原木加工成木板",
      stone: "用于建筑和铺路：采石场从有限的岩石中开采",
      ore: "仅用于制造工具：达到 10 位市民后，矿场从锈红色矿床开采矿石，铁匠铺将其锻造成工具",
      tools: "用于建筑；工坊每工作 50 或 60 次消耗一件，可由铁匠铺生产或购买",
      fish: "移民的食物：渔场在水边捕鱼；约三分钟后腐坏",
      smoked: "能储存一整个冬季的鱼：由熏鱼坊制作",
      wheat: "农场种植小麦；磨坊将其磨成面粉（冬季停止种植）",
      flour: "由磨坊生产；面包坊将其烤成面包",
      bread: "市民所需的食物；供应面包的移民小屋税收增加 50%；约五分钟后腐坏",
      wool: "牧羊场剪取羊毛；织布坊将其织成布料",
      cloth: "市民的需求：只配送到宜居度至少为 5 的街区",
      furniture: "富裕市民的需求：木工坊用木板制作家具，只配送到宜居度适合市民宅邸的街区"
    } satisfies Record<GoodId, string>,
    /** A good and what it is for: "木板：住宅和建筑的建材…". */
    good: (name: string, help: string): string => `${name}：${help}`,
    /** A good's last minute, under what it is for. */
    goodFlow: (f: { readonly made: number; readonly used: number; readonly traded: number; readonly stock: number; readonly elsewhere: number }): string =>
      `上分钟：生产 ${f.made}，消耗 ${f.used}${f.traded !== 0 ? `，${f.traded > 0 ? "买入" : "卖出"} ${Math.abs(f.traded)}` : ""}。仓储 ${f.stock}，城镇其他处 ${f.elsewhere}（工坊、市场和运输途中）。`,
    stock: "仓储物资及其变化趋势 · 点击查看生产与消耗",
    goodsChip: "查看库存、生产与消耗",
    folk: "打开城镇统计、目标和政策面板（T）",
    treasury: {
      plain: "财政金币及当前每分钟收支 · 点击查看上分钟收支",
      counted: (f: { readonly change: number; readonly made: number; readonly used: number; readonly traded: number; readonly net: number }): string =>
        `财政金币 · 点击查看上分钟收支\n上分钟：${signed(f.change)}（收入 ${f.made}，支出 ${f.used}${f.traded !== 0 ? `，贸易 ${signed(f.traded)}` : ""}）\n按当前税率：${signed(f.net)}/分钟（税收、贸易、维护、行政）`
    },
    clock: {
      paused: "已暂停",
      /** Under the clock: "第 2 年 · 距离冬季 3:20（严冬）". `until` is one of the three below. */
      year: (year: number, until: string): string => `第 ${year} 年 · ${until}`,
      winter: (severity: WinterId, spring: string): string => `${winters[severity]} · 距离春季 ${spring}`,
      winterIn: (left: string, coming: WinterId): string => `距离冬季 ${left}（${winters[coming]}）`,
      noMoreWinters: "本任期不再有冬季",
      /** The clock on hover: the season, the almanac's next two winters (`null`: beyond the term), and what each kind does to a catch (percent). */
      title: (c: { readonly winter: boolean; readonly coming: WinterId | null; readonly after: WinterId | null; readonly fishing: Readonly<Record<WinterId, number>> }): string =>
        `${c.winter ? "冬季：农田停产，捕鱼减少，食物消耗加快" : "任期剩余时间"}\n年历：下个冬季为${c.coming === null ? "任期之外" : winters[c.coming]}，再下个为${c.after === null ? "任期之外" : winters[c.after]}。\n暖冬：捕鱼量 ${c.fishing.mild}%。普通冬季：${c.fishing.normal}%。严冬：时长增加 50%，捕鱼量 ${c.fishing.hard}%，住宅取暖增加火灾风险。`
    },
    approval: "支持度",
    settlers: "移民",
    citizens: "市民",
    /** Beside the citizens, once there are any: "· 12 富裕市民". */
    burghers: (n: number): string => `${n} 富裕市民`,
    jobs: {
      short: (n: number): string => `${n} 处缺人 · 点击定位`,
      filled: "已就业",
      filledTitle: `已就业人数 / 所需人数：所有工作场所人手充足。居民最多步行 ${COMMUTE} 格道路上班。`,
      /** How many workplaces are short, and the first few of them. */
      shortTitle: (n: number, places: ReadonlyArray<ShortPlace>): string =>
        `已就业人数 / 所需人数。${n} 处工作场所缺人：${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? `（${COMMUTE} 格道路内无住宅）` : ""}`).join("、")}。点击逐一定位。`
    },
    /** The goods' last minute, side by side: each column, and what it counts. */
    flow: {
      counting: "正在统计城镇物资，首批数据将在半分钟后显示……",
      made: { label: "生产", title: "上分钟由工坊和采集建筑生产" },
      used: { label: "消耗", title: "上分钟用于食用、加工、建造，以及腐坏和交付的物资" },
      traded: { label: "交易", title: "上分钟买入（+）或卖出（−）" },
      storage: { label: "仓储", title: "存放在市政厅、仓库和粮仓中" },
      about: { label: "城镇其他处", title: "位于工坊、市场，或由服务人员和运输员携带" }
    },
    /** The crown's request: `amount` and `good` are set in bold, the good with its icon. */
    crown: {
      asks: (amount: string, good: string): string => `王室要求 ${amount} ${good}`,
      inStore: (n: number): string => `库存 ${n}`,
      /** What is in store (coloured by whether it is enough), when it is due (bold), and what it pays. */
      terms: (inStore: string, due: string, reward: string): string => `${inStore} · 剩余 ${due} · ${reward}`,
      reward: (coins: number): string => `+${coins} 金币`,
      send: "交付",
      sendTitle: (good: GoodId, amount: number, reward: number): string => `交付 ${some(good, amount)}，获得 ${reward} 金币`,
      notEnough: (good: GoodId): string => `库存${goods[good].word}不足`
    },
    /** What threatens the term, or is about to raise the town a rank: `left` is a clock. */
    warnings: {
      bankruptIn: (left: string) => warning("负债", `若财政未改善，将在 ${left} 后破产`),
      debt: warning("负债", "工资无法支付"),
      revoltIn: (left: string) => warning("骚乱", `居民将在 ${left} 后驱逐市长`),
      restless: warning("不满", "支持度偏低，有骚乱风险"),
      emptying: warning("人口流失", "居民正在离开城镇"),
      patience: (streak: number) => warning("王室耐心", `已连续 ${streak} 次未交付；再有一次市长就会被撤换`),
      /** Every goal of the next rank (`to`) is met and holding. */
      rises: (to: number, left: string) => warning("所有目标已达成", `再保持 ${left} 即可晋升为${rankOf(to)}`)
    }
  },

  // ── The ticker ──────────────────────────────────────────────────────────

  ticker: {
    bulb: "新手引导与当前需要关注的问题",
    tucked: "引导已收起，可轻点右上角灯泡重新查看",
    guideOff: "引导已关闭 · 可从右下方重新开启",
    /** How long ago a piece of news happened, in the town's own time. */
    ago: {
      now: "刚刚",
      seconds: (n: number): string => `${n} 秒前`,
      minutes: (n: number): string => `${n} 分钟前`
    },
    /** The guide's heading: "引导 · 建立城镇". */
    guide: (chapter: string): string => `引导 · ${chapter}`,
    step: (at: number, of: number): string => `第 ${at}/${of} 步`,
    firstSteps: "新城镇的入门步骤",
    hide: "隐藏引导",
    hideTitle: "关闭引导（可通过右下角的引导按钮重新开启）",
    /** Under a step: what closes it. `goal` is the step's own words. */
    doneWhen: (goal: string): string => `完成条件：${goal}`,
    skip: "跳过此步骤",
    tuck: "收起引导，之后可轻点右上角灯泡查看",
    now: "当前",
    lately: "最近"
  },

  // ── The panels ──────────────────────────────────────────────────────────

  town: {
    title: "城镇",
    /** Under the heading: "中型地图，资源适中 · 村庄 · 第 2 届任期，60 分钟". */
    sub: (c: { readonly size: SizeId; readonly land: LandId; readonly rank: number; readonly term: number; readonly minutes: number }): string =>
      `${landOf(c.size, c.land)} · ${rankName(c.rank)} · 第 ${c.term} 届任期，${c.minutes} 分钟`,
    seed: (seed: number): string => `地图种子 ${seed}`,
    goals: {
      title: "晋升目标",
      help: "城镇由聚落逐步发展为村庄、城镇和城市。同时满足下一级的全部目标并保持两分钟，即可晋级并获得王室奖励。晋级不会结束游戏，已获得的等级也不会降低。",
      top: (now: number): string => `当前等级：${rankName(now)}，已达最高等级。继续执政，让城镇长久繁荣。`,
      holding: (now: number, left: string): string => `目标全部达成：再维持 ${left}，即可从${rankOf(now)}晋升为${rankOf(now + 1)}。`,
      toward: (now: number): string => `当前等级：${rankName(now)}。完成以下目标可晋升为${rankOf(now + 1)}。`
    },
    approval: {
      title: "支持度",
      help: "支持度高时，住宅容纳更多居民；低时则减少。支持度持续两分钟处于 −50 或以下，居民会赶走市长。",
      heading: "当前 → 目标"
    },
    treasury: {
      title: "财政",
      help: "以下为每分钟收支。有食物的住宅才缴税，税额随需求满足程度变化。行政开支按住宅计算，且增长快于城镇规模：在大型城镇中，多建一座移民小屋的开支约等于它缴纳的税款，而市民住宅或市民宅邸以同样的开支可容纳两到三倍的人口。连续负债三分钟将导致破产。",
      taxes: "税收",
      supplied: "需求全部满足时",
      trade: "贸易",
      upkeep: "维护费",
      admin: "行政开支",
      net: "每分钟",
      /** The sum of the above, with its sign: "+12 金币". */
      netCoins: (n: number): string => `${signed(n)} 金币`,
      leftOnTable: (gap: number): string => `每分钟少收 ${gap} 金币：挨饿的住宅不纳税，供应面包的小屋多缴 50%，优质街区最多多缴 25%`
    },
    taxes: {
      title: "税率",
      help: `降税提高支持度，加税降低支持度，影响按各阶层人口加权。税率超过 100% 还会使部分居民迁出，移民比市民更敏感，因此加税未必增收。下方列出各档税率稳定后的预计税收。超过 ${mood.grudge.above}% 会积累怨恨，即使降税也只会缓慢消退，任期末突击降税无法抹去长期重税的影响。`,
      slider: "拖动调整税率；双击恢复标准税率 100%",
      /** What a rate does to approval (`sway`: 0 at the usual rate), and whether it is high enough to leave a grudge. */
      effect: (sway: number, grudge: boolean): string =>
        `${sway === 0 ? "标准税率" : `支持度 ${signed(sway)}`}${grudge ? " · 维持高税率会积累怨恨，降税后也只会缓慢消退" : ""}`,
      /** Taxes a minute at each step of the rate, and the step that brings in most. */
      outlook: (steps: ReadonlyArray<{ readonly rate: number; readonly taxes: number }>, best: number): string =>
        `稳定后税收/分钟：${steps.map((o) => `${o.rate}% ${o.taxes}`).join(" · ")} · ${best}% 时最高`,
      outlookTitle: "各档税率稳定后的每分钟住宅税收估算：超过 100% 会使部分居民迁出，税率也会影响支持度"
    },
    people: {
      title: "人口",
      settlers: "移民",
      citizens: "市民",
      burghers: "其中富裕市民",
      homes: "住宅",
      jobs: "已就业",
      jobsOf: (employed: number, jobs: number): string => `${employed}/${jobs}`,
      staffed: "所有工作场所人手充足",
      /** How many workplaces are short, the first few (`more`: there are others), and where to find them. */
      short: (n: number, places: ReadonlyArray<ShortPlace>, more: boolean): string =>
        `${n} 处缺少工人：${places.map((w) => `${w.title} ${w.assigned}/${w.needed}${w.nobodyNear ? "（范围内无人）" : ""}`).join("、")}${more ? "、…" : ""} · 点击就业人数逐一定位`
    },
    needs: {
      title: "需求满足情况",
      help: "挨饿的住宅不缴税。移民需要市场供应鲜鱼、熏鱼或面包；小屋获得面包后，税收增加 50%。每次送餐按每四位居民一份计算，向上取整；满员市民住宅的消耗为小屋的两倍，市民宅邸为三倍。市民需要面包、布料与信仰，富裕市民还需要木工坊生产的家具。布料只配送到宜居度至少为 5 的街区，家具则至少需要 12。鲜鱼约三分钟腐坏，面包约五分钟；粮仓可将保鲜时间延长至五倍。",
      larder: "食物库存",
      eaten: "上分钟食用 · 腐坏",
      trouble: "患病住户 · 着火建筑"
    },
    crown: {
      title: "王室",
      help: "交付王室要求的物资可获得金币。逾期会受罚，并暂时降低支持度；连续多次未交付，王室将撤换市长。",
      tally: "已交付 · 未交付",
      /** An open request: `what` (so many of a good) is set in bold. */
      wants: (what: string, left: string, reward: string): string => `需要 ${what} · 剩余 ${left} · ${reward}`,
      what: (good: GoodId, amount: number): string => some(good, amount),
      reward: (coins: number): string => `+${coins} 金币`,
      next: (left: string, patience: number): string => `下次要求还有 ${left} · 连续 ${patience} 次未交付将结束任期`
    },
    trade: {
      title: "物资与贸易",
      help: "商人每隔几秒交易一次。将滑块向左拖动，出售超过保留量的物资；向右拖动，以标价的 1.5 倍购入至保留量。拖得越远，每次交易量越大；居中时停止交易。出售使价格下降，购买使价格上涨，上涨速度为下降的三倍；高价回落也很慢。进口适合临时补缺，长期依赖进口食物会让开销不断增加。",
      keep: "库存保留量",
      keepTitle: "每种物资的保留量：只出售超过此数量的库存，只购买至此数量",
      keepNote: "每种物资均适用：超过保留量才出售，不足时最多购入至保留量",
      deal: (good: GoodId): string => `向左拖动出售${goods[good].word}，向右拖动购买；离中点越远，每次交易量越大。双击停止交易。`,
      /** What a good's slider is set to: nothing, or the most it sells or buys a minute. */
      none: "不交易",
      sell: (most: number): string => `出售 ≤${most}/分钟`,
      buy: (most: number): string => `购买 ≤${most}/分钟`,
      /** A good's price in coins, and (when it is not the usual) in percent of the usual: "3.5 金币（120%）". */
      price: (coins: number, percent: number | null): string => `${coins} 金币${percent === null ? "" : `（${percent}%）`}`,
      asks: "商人出售每件物资的价格",
      pays: "商人收购每件物资的价格"
    },
    chronicle: "大事记"
  },
  build: {
    title: "建造",
    sub: token.device("选择建筑，再轻点地图预览位置", "选择建筑，再点击地图放置 · Esc 取消"),
    categories: { storage: "仓储", gathering: "采集", crafts: "制造", food: "食品", services: "公共服务" } satisfies Record<Category, string>,
    cost: "费用",
    does: "效果",
    /** What keeps the town from building something yet, in place of what it is for. */
    needsResidents: (n: number): string => `需要 ${n} 位居民`,
    needsCitizens: (n: number): string => `需要 ${n} 位市民`,
    /** What each of a building's chips says on hover. */
    recipe: (r: { readonly input: GoodId | null; readonly inputs: number; readonly output: GoodId; readonly batch: number; readonly seconds: number }): string =>
      `${r.input ? `将 ${some(r.input, r.inputs)}加工成 ${some(r.output, r.batch)}` : `生产 ${some(r.output, r.batch)}`}，每 ${r.seconds} 秒一次`,
    serves: (range: number): string => `服务人员为距入口 ${range} 格道路内的住宅提供服务`,
    holds: (cap: number, keeps: number | null): string => `每种物资最多储存 ${cap} 件${keeps === null ? "" : `，鲜鱼和面包的腐坏速度降至原来的 1/${keeps}`}`,
    crew: (workers: number, tier: Tier): string => `需要 ${workers} 位${tiers[tier].people}，来自 ${COMMUTE} 格道路内的住宅`,
    appeal: (value: number, reach: number): string => `周围宜居度 ${plus(value)}，影响 ${reach} 格${value < 0 ? "：住宅应远离" : "：适合住宅"}`,
    upkeep: "维护费：每分钟的金币支出（暂停时为四分之一）",
    /** A building's whole line on hover: what it is, who works it, how far it reaches, what it does to its street, and what it costs to keep. */
    option: (id: KindId, k: { readonly workers: number; readonly citizens: boolean; readonly range: number | null; readonly appeal: { readonly value: number; readonly reach: number } | null; readonly upkeep: number }): string =>
      `${names.kind.title(id)}：${built(id).blurb}${k.workers > 0 ? ` · ${k.workers} 位${k.citizens ? "市民" : "移民"}工人，来自 ${COMMUTE} 格道路以内` : ""}${k.range === null ? "" : ` · 服务范围 ${k.range} 格道路`}${k.appeal ? ` · 宜居度 ${plus(k.appeal.value)}，影响 ${k.appeal.reach} 格` : ""} · ${k.upkeep} 金币/分钟`,
    parks: {
      title: "公园",
      help: `先铺地面，再摆放设施。相连地面组成一座公园，设施越丰富，周围宜居度越高（市民住宅需要 ${home.tiers[2].appeal}，市民宅邸需要 ${home.tiers[3].appeal}）。每 ${park.cellsPerProp} 格地面可计入一件设施；多座公园的影响重叠时，最优公园全额计入。`,
      ground: "地面 · 拖出矩形铺设",
      furnishings: "设施 · 点击公园格子摆放",
      beauty: "为公园增加的美观值",
      upkeep: "维护费，金币/分钟",
      /** A park piece's whole line on hover: `name` and `blurb` are its own. */
      piece: (name: string, blurb: string, p: { readonly beauty: number; readonly upkeep: number; readonly ground: boolean }): string =>
        `${name}：${blurb} · 美观值 +${p.beauty}${p.ground ? "/格" : ""} · ${p.upkeep} 金币/分钟`
    }
  },
  /** The panel of what is picked: a building, a home, a park, or a ruin. */
  selection: {
    park: "公园",
    ruin: "废墟",
    /** Under the heading: who lives in a home of each tier, and what a ruin or a park is for. */
    home: {
      1: "移民居住于此，负责基础劳动",
      2: "市民居住于此，负责技术工作，人均基础税额为移民的两倍",
      3: "富裕市民居住于此，基础税额最高"
    } satisfies Record<Tier, string>,
    aboutRuin: "拆除废墟以清理地块",
    aboutPark: "所有相连地块组成这座公园；扩建地面或摆放设施，提高附近街区的宜居度",
    status: "运行状态",
    /** How a building is, in a word, when nothing is wrong with it. */
    statuses: {
      building: "施工中",
      idle: "空闲",
      working: "工作中",
      starved: "缺少原料",
      blocked: "库存已满",
      unstaffed: "缺少工人",
      unconnected: "未连接道路",
      paused: "已暂停"
    } satisfies Record<Status, string>,
    causes: { burnt: "烧毁", collapsed: "坍塌", derelict: "荒废" } satisfies Record<Extract<Panel, { readonly type: "ruin" }>["cause"], string>,
    /** A park's worth in a word: the desirability it gives, and how far. */
    parkWorth: (value: number, reach: number): string => `${plus(value)}，影响 ${reach} 格`,
    whatMakesIt: "构成与效果",
    whatIsLeft: "残留情况",
    pause: "暂停工作",
    resume: "恢复工作",
    pauseTitle: "暂停的建筑不雇佣工人，维护费降至四分之一",
    closeHome: "关闭住宅",
    reopenHome: "重新开放住宅",
    closeTitle: "关闭的住宅保持空置，不缴税，也不产生行政开支。重新开放后，居民会逐渐入住。",
    remove: "拆除"
  },
  /** What upgrading a building would cost and give: `to` is the level it would stand at. */
  upgrade: {
    title: (id: KindId, to: number): string => `升级为${name(id, to)}`,
    begin: (id: KindId, to: number): string => `开始建造${name(id, to)}`,
    needed: (why: string): string => `当前需要：${why}`,
    notNeeded: "暂不急需，出现需求时会显示金色箭头",
    pay: "需要支付",
    get: "升级效果",
    now: "开工时支付",
    price: (coins: number): string => token.coins(coins),
    short: (coins: number): string => `还缺 ${token.coins(coins)}`,
    later: "随后送达的建材",
    lacks: (lacking: ReadonlyArray<{ readonly good: GoodId; readonly count: number }>): string =>
      `库存还缺 ${lacking.map((l) => token.amount(l.good, l.count)).join("、")}，施工按材料送达推进，材料不足时将在对应进度等待`,
    fromStore: "运输员从仓储送来材料，施工随材料送达推进",
    upkeepAfter: "升级后维护费",
    goesOn: "施工期间建筑继续工作，脚手架搭建在原有地块内"
  },

  // ── The sheets ──────────────────────────────────────────────────────────

  /** Founding a town: the charter. */
  charter: {
    by: "作者",
    sub: "选择地图，在任期结束前达成城镇发展目标。",
    land: {
      title: "地图大小",
      /** What a land of this size asks of a town: each figure is a chip. */
      note: (residents: string, income: string): string => `城镇等级目标 ${residents}${income}`,
      residents: (n: number): string => `${n} 位居民`,
      income: (coins: number): string => `+${coins}/分钟`,
      tip: (residents: number, income: number): string => `城镇等级需要 ${residents} 位居民和每分钟 ${income} 金币的净收入；村庄要求较低，城市要求更高`
    },
    term: {
      title: "任期",
      label: (minutes: number): string => `${minutes} 分钟`,
      years: (years: number, minutes: number): string => `${years} 年，每年 ${minutes} 分钟`,
      winters: (n: number): string => `${n} 个冬季`,
      tip: (minutes: number, years: number): string => `正常速度下 ${minutes} 分钟，共 ${years} 年；第一年之后，每年年末迎来冬季`
    },
    richness: {
      title: "资源丰度",
      coins: (n: number): string => `初始 ${n} 金币`
    },
    reroll: "↻ 换张地图",
    rerollTitle: (seed: number): string => `重新生成地图（当前种子 ${seed}）`,
    cells: (n: number): string => `${n} 格`,
    trees: (n: number): string => `${n} 棵树`,
    stone: (n: number): string => `${n} 处石料`,
    ore: (n: number): string => `${n} 处矿石`,
    start: "新建城镇",
    resume: "继续存档",
    /** The town saved in this browser, by its title, and (when known) how long ago it was saved. */
    resumeTitle: (title: string, saved: string | null): string => `继续此浏览器中的存档：${title}${saved === null ? "" : `，${saved}保存`}`
  },
  /** The end of the term. */
  reckoning: {
    lost: "任期失败 · 查看原因",
    over: (term: number): string => `第 ${term} 届任期结束 · 查看结算`,
    /** The heading of a term that ran its course: `verdict` is one of `verdict` below. */
    title: (term: number, verdict: string): string => `第 ${term} 届任期结束：${verdict}`,
    /** What became of a town whose term ran out. */
    verdict: { unrooted: "城镇未能扎根", flourishing: "欣欣向荣", holding: "勉强维持", declining: "走向衰败" },
    facts: {
      rank: "城镇等级",
      minutes: "执政分钟数",
      residents: "居民",
      citizens: "市民 · 富裕市民",
      coins: "金币",
      approval: "支持度",
      crown: "王室交付 · 逾期",
      score: "得分"
    },
    legend: "— 人口（虚线为下一级目标） · 金币 · - - 支持度 · 阴影为冬季",
    next: "下一任期",
    nextTitle: (minutes: number): string => `继续执政 ${minutes} 分钟：保留城镇，重新生成冬季，王室要求从较少物资重新开始`,
    retire: "卸任并新建城镇",
    found: "建立新城镇",
    look: "查看城镇",
    share: "分享城镇",
    shareTitle: "分享城镇图片和任期评价，或生成分享链接"
  },
  /** The picture a town is shared as, and the lines a link to it previews with. */
  card: {
    /** How a lost term ended (`ended`: the view's word for it), as a headline. */
    lost: (ended: string): string => ended,
    over: (now: number, term: number, verdict: string): string => `${rankName(now)}：第 ${term} 届任期结束，${verdict}`,
    playing: (now: number, year: number, term: number): string => `${rankName(now)} · 第 ${year} 年 · 第 ${term} 届任期`,
    land: (size: SizeId, land: LandId, minutes: number): string => `${sizes[size]} · ${lands[land].name}资源 · 任期 ${minutes} 分钟`,
    residents: "居民",
    citizens: "市民",
    coins: "金币",
    approval: "支持度"
  },
  share: {
    title: "分享城镇",
    sub: "可保存或分享城镇图片，也可生成链接。打开链接的人会从当前视角看到城镇运行，并可接手继续游玩。",
    /** The picture's button: a phone hands it to its share sheet, a computer saves it. */
    sharePicture: "分享图片",
    savePicture: "保存图片",
    makeLink: "生成链接",
    making: "正在生成链接…",
    again: "重新生成链接",
    shareLink: "分享链接",
    copyLink: "复制链接",
    open: "打开",
    noPicture: "无法生成图片",
    /** What handing the picture or the link to the device came to. */
    offered: {
      shared: () => "已分享",
      notShared: () => "已取消分享",
      saved: (o) => `图片已保存为 ${o.name}`,
      copied: () => "链接已复制",
      link: (o) => o.url
    } satisfies Wording<Offered>,
    /** Why a town could not be shared, or a shared one opened. What the server itself says (`error`) is in its own words. */
    failed: {
      unreachable: (f): string => (f.sending ? "无法连接服务器，暂时无法分享城镇" : "无法连接服务器，暂时无法读取城镇"),
      notFound: () => "此链接下没有城镇（分享链接保留六个月）",
      refused: (f) => `${f.sending ? "无法分享城镇" : "无法打开这座城镇"}：${f.error ?? `服务器返回状态码 ${f.status}`}`,
      unpacked: () => "无法生成城镇存档"
    } satisfies Wording<ShareFailure>,
    notShared: "无法分享城镇",
    notOpened: "无法打开这座城镇"
  },
  /** Visiting a shared town. */
  visit: {
    shared: "分享的城镇",
    play: "接手游玩",
    playTitle: "接手这座城镇，继续建设和治理；进度会自动保存在此浏览器中",
    yours: "已接手城镇：游玩进度将自动保存",
    own: "建立自己的城镇"
  },
  /** Saving and loading. */
  save: {
    notReady: "尚未就绪",
    saved: "已保存",
    /** A save's title, as it is listed: "中型地图，资源适中 · 第 2 年 · 已进行 23 分钟". */
    title: (c: { readonly size: SizeId; readonly land: LandId; readonly year: number; readonly minutes: number }): string =>
      `${landOf(c.size, c.land)} · 第 ${c.year} 年 · 已进行 ${c.minutes} 分钟`,
    untitled: "一座城镇",
    /** A save from before saves had titles. */
    earlier: "旧版存档",
    loaded: (title: string): string => `已读取：${title}`,
    loadedAuto: (title: string): string => `已读取自动存档：${title}`,
    /** What went wrong with a save. */
    trouble: {
      nothingSaved: (e): string => (e.auto ? "尚无自动存档" : "尚无存档"),
      unreadable: () => "无法读取存档",
      wrongVersion: (e): string => (e.older ? "该存档来自旧版游戏" : "该存档来自新版游戏"),
      rejected: (e) => `存档与当前游戏不兼容：${e.reason}`,
      storageFailed: (e) => `保存失败：${e.reason}`,
      unsaveable: (e) => `无法保存城镇：${e.reason}`
    } satisfies Wording<Trouble>
  },
  /**
   * News of the next Typeonce game (`ui/dom/brand/signup.ts`): the card at the first spring, and the panel on the
   * reckoning. "Typeonce Games" is a name, and stays.
   */
  signup: {
    /** The sign-up, read aloud. */
    label: "Typeonce Games 的新游戏",
    /** The card's top strip, in the town's own voice: the moment (in bold), and what it means. The first spring is always year 3's. */
    moment: { lead: "第 3 年，春季到来。", text: "城镇熬过了第一个冬季。" },
    headline: "抢先玩到 Typeonce 的下一款游戏",
    body: "Inkline Town 由 Typeonce Games 制作。留下邮箱，下一款免费游戏发布当天就会送到你手中。",
    /** The field, read aloud, and what it shows while empty. */
    email: "邮箱地址",
    placeholder: "you@example.com",
    submit: "获取新游戏",
    keep: "继续游戏",
    /** How a sign-up went, in the studio's words (as on typeonce.games). */
    outcome: {
      ok: "请查收邮件以确认订阅。",
      invalid_email: "这个邮箱地址似乎不正确。",
      rate_limited: "尝试次数过多，请稍等一分钟再试。",
      unavailable: "提交失败，请重试。"
    }
  },
  /** On the card shown while the town is drawn for the first time (the page's own HTML says it in English until the language is known). */
  loading: "正在绘制城镇…",
  /** The town could not start, or stopped: said in place of the page. */
  fatal: {
    start: (why: string): string => `城镇启动失败：${why}`,
    frame: (delta: number): string => `无效的帧间隔：${delta}`,
    stopped: "系统发生错误，城镇已停止运行。",
    loop: (field: string): string => `固定循环选项无效：${field}`
  }
} satisfies typeof English
