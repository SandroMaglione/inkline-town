/**
 * Japanese for the page itself (`ui/dom` and what starts it, `app/browser.ts`):
 * its buttons, headings, tooltips, dialogs, and the chips a message's tokens
 * become. The same entries as English, part for part (`satisfies` holds it
 * to them).
 *
 * Buttons, headings, and a panel's rows are terse nouns, as a Japanese game
 * writes them; what is read as sentences (behind an ⓘ, in a dialog) is in
 * です・ます. A sentence with the page's own markup set into it takes each
 * piece as a string, as in English, and Japanese puts it where it reads:
 * the crown's request is "王室の要請：[魚]×20", a good and how many, as a
 * Japanese interface lists a demand.
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
import { counted, signed } from "./grammar.ts"
import { built, goods, grounds, landOf, names, props, rankName, rankOf, sizeOf, tiers, winterOf, winters } from "./nouns.ts"

/** A number with its sign as a slider or a chip shows it: "+4", "-4", "0". */
const plus = (n: number) => `${n > 0 ? "+" : ""}${n}`
const name = (id: KindId, level = 0) => built(id, level).noun.word
/** So many of a good, in words: "魚20匹". */
const some = (good: GoodId, n: number) => `${goods[good].word}${counted(n, goods[good])}`

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
const lay = "建設"

export const page = {
  /** What a building's chip in a message says on hover. */
  chips: {
    goTo: (id: KindId): string => `${name(id)}へ移動`,
    /** A row that places a building, on hover. */
    place: (id: KindId): string => `${name(id)}を建てる`,
    build: (id: KindId): string => `${name(id)}を建てる：${built(id).blurb}`
  },
  /** How long ago a save was made, roughly. */
  ago: {
    now: "たった今",
    minutes: (n: number): string => `${n}分前`,
    hours: (n: number): string => `${n}時間前`,
    yesterday: "昨日",
    days: (n: number): string => `${n}日前`
  },
  /** Words more than one part of the page says. */
  common: {
    close: "閉じる",
    closeEsc: "閉じる（Esc）",
    cancel: "キャンセル",
    /** A section's ⓘ. */
    whatThisMeans: "説明",
    showWhere: "場所を表示",
    dismiss: "閉じる",
    coins: "金貨"
  },

  // ── The map and its tools ───────────────────────────────────────────────

  /** What picking something to put on the map says, and the bar a held stroke waits at. */
  map: {
    place: (id: KindId): string => {
      const what = name(id)
      return token.device(`${what}を置く場所をタップし、もう一度タップで建設`, `クリックで${what}を置く・Escで終了`)
    },
    layGround: (id: GroundId): string => {
      const what = grounds[id].noun.word
      return token.device(`ドラッグで${what}の範囲を決め、「${lay}」をタップ`, `ドラッグで${what}を敷く・Escで終了`)
    },
    furnish: (id: PropId): string => {
      const what = props[id].noun.word
      return token.device(`${what}を置く公園のマスをタップし、もう一度タップで設置`, `公園のマスをクリックして${what}を置く・Escで終了`)
    },
    /** A touch tap that holds what it would do: tapped again, it does it. */
    tapAgain: { remove: "もう一度タップで撤去", build: "もう一度タップでここに建設" },
    overlays: "地図の表示",
    stroke: { build: lay, cancel: "取消" }
  },
  toolbar: {
    town: { label: "町", title: "町の目標、数字、税、交易（T）" },
    more: "共有、ガイド、保存、読込、新しい町",
    pause: "町を一時停止、または再開（スペース）",
    /** A speed's button: "町を2×で動かす（2）". */
    runAt: (speed: string, key: string): string => `町を${speed}で動かす（${key}）`,
    cycle: "速度を変える：1×、2×、4×",
    /** The pause switch, read aloud: what pressing it does now. */
    run: "町を動かす",
    pauseNow: "町を一時停止",
    runAtLast: (last: number): string => `町を${last}×で動かす`
  },
  mapViews: {
    title: "地図の表示",
    help: "どれかで地図を色分けすると、町のうまくいっている所とそうでない所がわかります。もう一度キーを押す（またはクリックする）と消えます。",
    show: (label: string, key: string): string => `地図に${label}を表示（${key}）。もう一度で非表示`
  },
  /** Share, the guide, save, load, and new town: each button's label and what it says on hover. */
  system: {
    share: { label: "共有", tip: "町の画像か、誰でも開いて眺めたり続きを遊んだりできるリンクを共有" },
    guide: {
      label: "ガイド",
      tip: "ガイドのオン・オフ：新しい町長に、次にすることとその理由を教える",
      turnOn: "ガイドを再びオンにする：次の一手とその理由が、ティッカーのいちばん上に出る",
      turnOff: "ガイドをオフにする"
    },
    language: { label: "言語", tip: "町を表示する言語を選ぶ" },
    save: { label: "保存", tip: "このブラウザに町を保存（2分ごとにも自動保存）" },
    load: { label: "読込", tip: "最新のセーブを読み込む：手動と自動保存の新しいほう" },
    newTown: { label: "新規", tip: "新しい土地に新しい町を作る" },
    recentre: { label: "中央へ", tip: "元の角度と中心に戻す" },
    leave: {
      load: leave("最新のセーブを読み込みますか？", "今の町は、最新のセーブ（手動か自動保存）に置き換わります。", "保存してから読み込む", "保存せずに読み込む"),
      newTown: leave("新しい町を作りますか？", "先に保存しなければ、この町は二度と戻りません。", "保存してから土地を選ぶ", "保存せずに土地を選ぶ"),
      stay: "このまま続ける"
    }
  },
  /** The camera bar in the map's corner (the renderer draws it): its two drag modes, the zoom, and the way back. */
  camera: {
    label: "カメラ",
    pan: { label: "移動", title: "ドラッグで視点を移動。道路、舗装、住宅、公園の地面のツールはドラッグで建設" },
    rotate: { label: "回転", title: "置く代わりにドラッグで回転。右ドラッグでも回転し、QとEで8分の1ずつ回る。" },
    zoomOut: "縮小",
    zoom: "カメラのズーム",
    zoomIn: "拡大",
    reset: { label: "カメラをリセット", title: "元の角度と中心（Home）" }
  },
  /** Choosing the language: every language is listed by its own name, so only what is around the list is said here. */
  language: {
    /** On the language now in use, read aloud. */
    current: (name: string): string => `${name}（使用中）`,
    /** The browser would not keep the choice, so the page stays as it is. */
    notKept: "このブラウザが選択を保存できないため、言語はそのままです"
  },
  /** The maker's credit: what each link is, read aloud. */
  credit: {
    typeonce: "Typeonce Games：Inkline Townの作者によるほかのゲーム",
    ritmo: "GitHubのritmo：Inkline Townを動かすECSランタイム",
    madeWith: "使用技術",
    madeBy: "制作：Typeonce",
    newTab: (label: string): string => `${label}（新しいタブで開く）`
  },

  // ── The heads-up display ────────────────────────────────────────────────

  hud: {
    /** What each good is for: who makes it, who takes it. */
    goods: {
      wood: "木こり小屋が伐り、製材所がひいて板材にする",
      planks: "家や建物の材料。製材所が木材から作る",
      stone: "建設と舗装に使う。採石場が岩から切り出すが、岩はいずれ尽きる",
      ore: "道具だけに使う。市民が10人になると鉱山が赤さびた鉱床から掘り、鍛冶屋が鍛えて道具にする",
      tools: "建設に使い、工房は50〜60回の作業ごとに1個すり減らす。鍛冶屋が作るか、買う",
      fish: "入植者の食料。漁師小屋が水辺でとる。約3分で腐る",
      smoked: "冬じゅうもつ魚。燻製小屋が作る",
      wheat: "農場が育て、製粉所がひいて小麦粉にする（冬はとれない）",
      flour: "製粉所で作られ、パン屋が焼いてパンにする",
      bread: "市民に必要な食料。パンのある小屋は税が1.5倍。約5分で腐る",
      wool: "牧羊場が刈り、織物工房が織って布にする",
      cloth: "市民に必要。魅力度5以上の通りにしか届かない",
      furniture: "富裕市民の町屋敷に必要。家具工房が板材から作る。町屋敷にふさわしい通りにしか届かない"
    } satisfies Record<GoodId, string>,
    /** A good and what it is for: "板材：家や建物の材料…". */
    good: (name: string, help: string): string => `${name}：${help}`,
    /** A good's last minute, under what it is for. */
    goodFlow: (f: { readonly made: number; readonly used: number; readonly traded: number; readonly stock: number; readonly elsewhere: number }): string =>
      `直近1分：生産${f.made}、消費${f.used}${f.traded !== 0 ? `、${f.traded > 0 ? "購入" : "売却"}${Math.abs(f.traded)}` : ""}。倉庫に${f.stock}、町中に${f.elsewhere}（工房や市場、運搬中）。`,
    stock: "町の倉庫にある物資と、それぞれの増減・クリックで町の生産と消費",
    goodsChip: "倉庫の物資",
    folk: "町の数字、目標、施策を開く（T）",
    treasury: {
      plain: "財源の金貨と、今の税率での毎分の増減・クリックで町の直近1分",
      counted: (f: { readonly change: number; readonly made: number; readonly used: number; readonly traded: number; readonly net: number }): string =>
        `財源の金貨・クリックで町の直近1分\n直近1分：${signed(f.change)}（収入${f.made}、支出${f.used}${f.traded !== 0 ? `、交易${signed(f.traded)}` : ""}）\n今の税率で：毎分${signed(f.net)}（税、交易、維持費、運営費）`
    },
    clock: {
      paused: "停止中",
      /** Under the clock: "2年目・冬まで3:20（厳しい）". `until` is one of the three below. */
      year: (year: number, until: string): string => `${year}年目・${until}`,
      winter: (severity: WinterId, spring: string): string => `${winterOf[severity]}・春まで${spring}`,
      winterIn: (left: string, coming: WinterId): string => `冬まで${left}（${winters[coming]}）`,
      noMoreWinters: "任期中の冬はもうない",
      /** The clock on hover: the season, the almanac's next two winters (`null`: beyond the term), and what each kind does to a catch (percent). */
      title: (c: { readonly winter: boolean; readonly coming: WinterId | null; readonly after: WinterId | null; readonly fishing: Readonly<Record<WinterId, number>> }): string =>
        `${c.winter ? "冬：畑は眠り、漁は鈍り、家々はよく食べる" : "任期の残り時間"}\n暦：次の冬は${c.coming === null ? "任期の後" : winters[c.coming]}、その次は${c.after === null ? "任期の後" : winters[c.after]}。\n穏やか：漁獲${c.fishing.mild}%。平年並み：${c.fishing.normal}%。厳しい：期間が1.5倍、漁獲${c.fishing.hard}%、暖をとる家は火災の危険。`
    },
    approval: "支持率",
    settlers: "入植者",
    citizens: "市民",
    /** Beside the citizens, once there are any: "· 富裕市民12". */
    burghers: (n: number): string => `富裕市民${n}`,
    jobs: {
      short: (n: number): string => `${n}か所不足`,
      filled: "就業",
      filledTitle: `働いている人／必要な人：どの職場も人手が足りています。住民は道路で最大${COMMUTE}マスまで歩いて働きに行きます。`,
      /** How many workplaces are short, and the first few of them. */
      shortTitle: (n: number, places: ReadonlyArray<ShortPlace>): string =>
        `働いている人／必要な人。${n}か所の職場で人手不足：${places.map((w) => `${w.title}${w.assigned}/${w.needed}${w.nobodyNear ? `（道路${COMMUTE}マス以内に家がない）` : ""}`).join("、")}。クリックで順に訪れます。`
    },
    /** The goods' last minute, side by side: each column, and what it counts. */
    flow: {
      counting: "町の物資を集計中：30秒で最初の数字が出ます…",
      made: { label: "生産", title: "直近1分に工房と採集で作られた量" },
      used: { label: "消費", title: "直近1分に食べた、加工した、建設に使った、腐った、送った量" },
      traded: { label: "交易", title: "直近1分に買った（+）、売った（−）量" },
      storage: { label: "倉庫", title: "町役場、倉庫、穀物庫にある量" },
      about: { label: "町中", title: "工房や市場、巡回人のかご、運搬人の箱にある量" }
    },
    /** The crown's request: `amount` and `good` are set in bold, the good with its icon. */
    crown: {
      asks: (amount: string, good: string): string => `王室の要請：${good}×${amount}`,
      inStore: (n: number): string => `在庫${n}`,
      /** What is in store (coloured by whether it is enough), when it is due (bold), and what it pays. */
      terms: (inStore: string, due: string, reward: string): string => `${inStore}・期限${due}・${reward}`,
      reward: (coins: number): string => `金貨+${coins}`,
      send: "送る",
      sendTitle: (good: GoodId, amount: number, reward: number): string => `${some(good, amount)}を王室に送り、金貨${reward}枚を得る`,
      notEnough: (good: GoodId): string => `倉庫の${goods[good].word}がまだ足りない`
    },
    /** What threatens the term, or is about to raise the town a rank: `left` is a clock. */
    warnings: {
      bankruptIn: (left: string) => warning("借金", `財源が戻らなければ${left}後に破産`),
      debt: warning("借金", "賃金が払えていない"),
      revoltIn: (left: string) => warning("騒乱", `${left}後に町長が追放される`),
      restless: warning("不穏", "支持率が反乱に向かって下がっている"),
      emptying: warning("流出", "人々が町を去っている"),
      patience: (streak: number) => warning("王室の忍耐", `${streak}回続けて要請を逃した。あと1回で町長は罷免`),
      /** Every goal of the next rank (`to`) is met and holding. */
      rises: (to: number, left: string) => warning("目標すべて達成", `${left}後に町は${rankOf(to)}になる`)
    }
  },

  // ── The ticker ──────────────────────────────────────────────────────────

  ticker: {
    bulb: "ガイドと、いま注意すべきこと",
    tucked: "ガイドは右上の電球の中にあります",
    guideOff: "ガイドはオフ・右下から再びオンにできます",
    /** How long ago a piece of news happened, in the town's own time. */
    ago: {
      now: "たった今",
      seconds: (n: number): string => `${n}秒前`,
      minutes: (n: number): string => `${n}分前`
    },
    /** The guide's heading: "ガイド・町の創設". */
    guide: (chapter: string): string => `ガイド・${chapter}`,
    step: (at: number, of: number): string => `ステップ${at}/${of}`,
    firstSteps: "新しい町の最初の一歩",
    hide: "隠す",
    hideTitle: "ガイドをオフにする（右下のガイドボタンで再びオン）",
    /** Under a step: what closes it. `goal` is the step's own words. */
    doneWhen: (goal: string): string => `完了条件：${goal}`,
    skip: "このステップを飛ばす",
    tuck: "隠す：ガイドは右上の電球に残ります",
    now: "現在",
    lately: "最近"
  },

  // ── The panels ──────────────────────────────────────────────────────────

  town: {
    title: "町",
    /** Under the heading: "中くらいのふつうの土地・村・第2期（60分）". */
    sub: (c: { readonly size: SizeId; readonly land: LandId; readonly rank: number; readonly term: number; readonly minutes: number }): string =>
      `${sizeOf[c.size]}${landOf[c.land]}・${rankName(c.rank)}・第${c.term}期（${c.minutes}分）`,
    seed: (seed: number): string => `シード${seed}`,
    goals: {
      title: "目標",
      help: "町は集落から村、町、都市へと昇格します。次の位の目標をすべて同時に達成して2分間保つと、王室から報酬が届き、ゲームは続きます。一度上がった位は下がりません。",
      top: (now: number): string => `最高の位、${rankOf(now)}です。任期を重ねて町を保ち続けましょう。`,
      holding: (now: number, left: string): string => `すべて達成：あと${left}保てば、${rankOf(now)}から${rankOf(now + 1)}になります。`,
      toward: (now: number): string => `現在は${rankOf(now)}。これらを達成すると${rankOf(now + 1)}になります。`
    },
    approval: {
      title: "支持率",
      help: "支持率が高いと家に住む人が増え、低いと減ります。−50が2分続くと、町は町長を追放します。",
      heading: "現在 → 向かう先"
    },
    treasury: {
      title: "財源",
      help: "毎分の金貨です。税は食料の届いた家からだけ、満たした必需品に応じて入ります。運営費は家ごとにかかり、町の大きさより速く増えます。大きな町では小屋を1軒増やしても納める税とほぼ同じ費用がかかりますが、市民の家や町屋敷なら同じ費用で2〜3倍の人が住めます。借金が3分続くと破産します。",
      taxes: "税",
      supplied: "すべての家に行き渡れば",
      trade: "交易",
      upkeep: "維持費",
      admin: "運営費",
      net: "毎分",
      /** The sum of the above, with its sign: "金貨+12". */
      netCoins: (n: number): string => `金貨${signed(n)}`,
      leftOnTable: (gap: number): string => `毎分金貨${gap}枚を取り逃している：飢えた家は何も納めず、パンのある小屋は1.5倍、上等な通りは4分の1増し`
    },
    taxes: {
      title: "税率",
      help: `税を下げると支持率が上がり、上げると下がります（各階層の人数で重みづけ）。100%を超えると出ていく住民もいて、入植者は市民より先に出ていくため、税率を上げても収入が増えるとは限りません。各税率の下には、家々が落ち着いたときに各段階で納める額が出ます。${mood.grudge.above}%を超えると、税率を戻しても消えない恨みも残ります。最後に税を下げても、任期中の取り立ては帳消しになりません。`,
      slider: "ドラッグで税率を設定。ダブルクリックで標準の100%",
      /** What a rate does to approval (`sway`: 0 at the usual rate), and whether it is high enough to leave a grudge. */
      effect: (sway: number, grudge: boolean): string =>
        `${sway === 0 ? "標準の税率" : `支持率${signed(sway)}`}${grudge ? "・この高さが続く間は恨みがたまり、ゆっくりとしか消えない" : ""}`,
      /** Taxes a minute at each step of the rate, and the step that brings in most. */
      outlook: (steps: ReadonlyArray<{ readonly rate: number; readonly taxes: number }>, best: number): string =>
        `落ち着いたときの毎分の税：${steps.map((o) => `${o.rate}%で${o.taxes}`).join("・")}・最大は${best}%`,
      outlookTitle: "この税率が続き、家々が落ち着いたときの全世帯からの毎分の税：100%を超えると住民は出ていき、支持率も税率に従う"
    },
    people: {
      title: "人々",
      settlers: "入植者",
      citizens: "市民",
      burghers: "うち富裕市民",
      homes: "家",
      jobs: "就業",
      jobsOf: (employed: number, jobs: number): string => `${employed}/${jobs}`,
      staffed: "どの職場も人手が足りている",
      /** How many workplaces are short, the first few (`more`: there are others), and where to find them. */
      short: (n: number, places: ReadonlyArray<ShortPlace>, more: boolean): string =>
        `${n}か所で人手不足：${places.map((w) => `${w.title}${w.assigned}/${w.needed}${w.nobodyNear ? "（届く範囲に誰もいない）" : ""}`).join("、")}${more ? "、…" : ""}・仕事の数字をクリックで順に訪れる`
    },
    needs: {
      title: "家への供給",
      help: "飢えた家は税を納めません。入植者には市場から食料（魚、燻製魚、パン）が必要で、パンもあれば小屋の税は1.5倍になります。巡回1回で住民4人につき魚かパンを1つ届けるので、市民の家は小屋の2倍、町屋敷は3倍食べます。市民と富裕市民にはパン、布、信仰が、富裕市民にはさらに家具工房の家具が必要です。布は魅力度5以上、家具は12以上の通りにしか届きません。魚は約3分、パンは5分で腐り、穀物庫なら5倍長もちします。",
      larder: "食料の蓄え",
      eaten: "消費・直近1分の腐敗",
      trouble: "病気の家・火事"
    },
    crown: {
      title: "王室",
      help: "王室の求めに応えると金貨がもらえます。逃した要請は罰金になり、町はしばらくその無礼を覚えています。続けて逃しすぎると、王室は町長を罷免します。",
      tally: "達成・未達",
      /** An open request: `what` (so many of a good) is set in bold. */
      wants: (what: string, left: string, reward: string): string => `要請：${what}・残り${left}・${reward}`,
      what: (good: GoodId, amount: number): string => some(good, amount),
      reward: (coins: number): string => `金貨+${coins}`,
      next: (left: string, patience: number): string => `次の要請まで${left}・${patience}回続けて逃すと任期終了`
    },
    trade: {
      title: "物資と交易",
      help: "商人は数秒ごとに訪れます。物資のスライダーを左に動かすと町が残す量を超えた分を売り、右に動かすとその量まで買います（価格は1.5倍）。端に寄せるほど1回の量が増え、中央では売りも買いもしません。売れば値が下がり、買えば3倍の速さで上がります。高値はゆっくりしか戻らないので、買うのは不足を補う程度にしましょう。買った食料に頼る町は、毎分の出費が増えていきます。",
      keep: "蓄えておく量",
      keepTitle: "町が各物資を残しておく量：これを超えた分だけ売り、これまでしか買わない",
      keepNote: "各物資：これを超えた分だけ売り、これまでしか買わない",
      deal: (good: GoodId): string => `左にドラッグで${goods[good].word}を売り、右で買う。端ほど、商人が来るたびの量が増える。ダブルクリックで取引をやめる。`,
      /** What a good's slider is set to: nothing, or the most it sells or buys a minute. */
      none: "取引なし",
      sell: (most: number): string => `売り≤${most}/分`,
      buy: (most: number): string => `買い≤${most}/分`,
      /** A good's price in coins, and (when it is not the usual) in percent of the usual: "単価3.5（120%）". A bare "3.5枚" beside planks would read as so many planks. */
      price: (coins: number, percent: number | null): string => `単価${coins}${percent === null ? "" : `（${percent}%）`}`,
      asks: "商人の売値（1つあたり）",
      pays: "商人の買値（1つあたり）"
    },
    chronicle: "年代記"
  },
  build: {
    title: "建設",
    sub: token.device("選んでから、置く場所をタップ", "選んでから地図をクリック・Escで終了"),
    categories: { storage: "保管", gathering: "採集", crafts: "工房", food: "食料", services: "公共" } satisfies Record<Category, string>,
    cost: "費用",
    does: "役割",
    /** What keeps the town from building something yet, in place of what it is for. */
    needsResidents: (n: number): string => `住民${n}人が必要`,
    needsCitizens: (n: number): string => `市民${n}人が必要`,
    /** What each of a building's chips says on hover. */
    recipe: (r: { readonly input: GoodId | null; readonly inputs: number; readonly output: GoodId; readonly batch: number; readonly seconds: number }): string =>
      `${r.seconds}秒ごとに${r.input ? `${some(r.input, r.inputs)}から` : ""}${some(r.output, r.batch)}を作る`,
    serves: (range: number): string => `巡回人は入口から道路${range}マス以内の家を回る`,
    holds: (cap: number, keeps: number | null): string => `各物資を${cap}まで保管${keeps === null ? "" : `し、食料を${keeps}倍長もちさせる`}`,
    crew: (workers: number, tier: Tier): string => `働き手は${tiers[tier].people}${workers}人、道路${COMMUTE}マス以内の家から`,
    appeal: (value: number, reach: number): string => `隣の魅力度${plus(value)}、${reach}マスまで${value < 0 ? "：家は遠ざける" : "：家に好まれる"}`,
    upkeep: "維持費：建っている間の毎分の金貨（休止中は4分の1）",
    /** A building's whole line on hover: what it is, who works it, how far it reaches, what it does to its street, and what it costs to keep. */
    option: (id: KindId, k: { readonly workers: number; readonly citizens: boolean; readonly range: number | null; readonly appeal: { readonly value: number; readonly reach: number } | null; readonly upkeep: number }): string =>
      `${names.kind.title(id)}：${built(id).blurb}${k.workers > 0 ? `・道路${COMMUTE}マス以内から${k.citizens ? "市民" : "入植者"}${k.workers}人` : ""}${k.range === null ? "" : `・巡回は道路${k.range}マス`}${k.appeal ? `・魅力度${plus(k.appeal.value)}、${k.appeal.reach}マスまで` : ""}・毎分金貨${k.upkeep}枚`,
    parks: {
      title: "公園",
      help: `地面を敷いてから、その上に調度品を置きます。つながった地面は1つの公園になり、置く物が多いほど周りの通りが良くなります（市民には${home.tiers[2].appeal}、町屋敷には${home.tiers[3].appeal}が必要）。調度品は${park.cellsPerProp}マスにつき1つ有効で、公園どうしが接する所では最も立派なものが満額で効きます。`,
      ground: "地面・ドラッグで範囲を決める",
      furnishings: "調度品・公園のマスをクリック",
      beauty: "公園に加わる美しさ",
      upkeep: "維持費（毎分の金貨）",
      /** A park piece's whole line on hover: `name` and `blurb` are its own. */
      piece: (name: string, blurb: string, p: { readonly beauty: number; readonly upkeep: number; readonly ground: boolean }): string =>
        `${name}：${blurb}・美しさ+${p.beauty}${p.ground ? "（1マスあたり）" : ""}・毎分金貨${p.upkeep}枚`
    }
  },
  /** The panel of what is picked: a building, a home, a park, or a ruin. */
  selection: {
    park: "公園",
    ruin: "廃墟",
    /** Under the heading: who lives in a home of each tier, and what a ruin or a park is for. */
    home: {
      1: "入植者が住み、力仕事をする",
      2: "市民が住み、熟練の仕事をし、税を2倍納める",
      3: "富裕市民が住み、最も多く税を納める"
    } satisfies Record<Tier, string>,
    aboutRuin: "撤去して土地を空ける",
    aboutPark: "この地面とつながったすべてのマス：地面を広げたり調度品を置いたりすると、周りの通りが良くなる",
    status: "状態",
    /** How a building is, in a word, when nothing is wrong with it. */
    statuses: {
      building: "建設中",
      idle: "待機中",
      working: "稼働中",
      starved: "材料不足",
      blocked: "停滞",
      unstaffed: "人手不足",
      unconnected: "道路なし",
      paused: "休止中"
    } satisfies Record<Status, string>,
    causes: { burnt: "焼失", collapsed: "倒壊", derelict: "荒廃" } satisfies Record<Extract<Panel, { readonly type: "ruin" }>["cause"], string>,
    /** A park's worth in a word: the desirability it gives, and how far. */
    parkWorth: (value: number, reach: number): string => `${plus(value)}、${reach}マスまで`,
    whatMakesIt: "内訳",
    whatIsLeft: "残っているもの",
    pause: "作業を休止",
    resume: "作業を再開",
    pauseTitle: "休止中の建物は働き手がいなくなり、維持費は4分の1になる",
    closeHome: "家を閉鎖",
    reopenHome: "家を再開",
    closeTitle: "閉鎖した家は空き家になり、税も町役場の運営費もかかりません。再開すれば入植者が戻ります。",
    remove: "撤去"
  },
  /** What upgrading a building would cost and give: `to` is the level it would stand at. */
  upgrade: {
    title: (id: KindId, to: number): string => `${name(id, to)}に改築`,
    begin: (id: KindId, to: number): string => `${name(id, to)}への改築を始める`,
    needed: (why: string): string => `いま必要：${why}`,
    notNeeded: "まだ不要：必要になると金色の矢印が出る",
    pay: "支払い",
    get: "得られるもの",
    now: "着工時",
    price: (coins: number): string => token.coins(coins),
    short: (coins: number): string => `${token.coins(coins)}不足`,
    later: "あとで運び込む",
    lacks: (lacking: ReadonlyArray<{ readonly good: GoodId; readonly count: number }>): string =>
      `蓄えに${lacking.map((l) => token.amount(l.good, l.count)).join("、")}が足りない：届くまで工事は待つ`,
    fromStore: "蓄えから：届きしだい工事が進む",
    upkeepAfter: "改築後の維持費",
    goesOn: "工事の間も稼働を続け、敷地の中に足場が組まれる"
  },

  // ── The sheets ──────────────────────────────────────────────────────────

  /** Founding a town: the charter. */
  charter: {
    by: "作",
    sub: "土地を選び、任期が終わる前に町を目標まで育てましょう。",
    land: {
      title: "土地",
      /** What a land of this size asks of a town: each figure is a chip. */
      note: (residents: string, income: string): string => `「町」の目標${residents}${income}`,
      residents: (n: number): string => `住民${n}人`,
      income: (coins: number): string => `+${coins}/分`,
      tip: (residents: number, income: number): string => `「町」の位には住民${residents}人と毎分金貨${income}枚の収入が必要です。「村」はそれより少なく、「都市」は多く必要です`
    },
    term: {
      title: "任期",
      label: (minutes: number): string => `${minutes}分`,
      years: (years: number, minutes: number): string => `${years}年（1年${minutes}分）`,
      winters: (n: number): string => `冬${n}回`,
      tip: (minutes: number, years: number): string => `1×で${minutes}分：${years}年間、2年目からは毎年の終わりに冬が来る`
    },
    richness: {
      title: "豊かさ",
      coins: (n: number): string => `初期金貨${n}枚`
    },
    reroll: "↻別の土地",
    rerollTitle: (seed: number): string => `別の土地を引く（いまはシード${seed}）`,
    cells: (n: number): string => `${n}マス`,
    trees: (n: number): string => `木${n}本`,
    stone: (n: number): string => `石${n}`,
    ore: (n: number): string => `鉱石${n}`,
    start: "新しく始める",
    resume: "保存した町を続ける",
    /** The town saved in this browser, by its title, and (when known) how long ago it was saved. */
    resumeTitle: (title: string, saved: string | null): string => `このブラウザに保存した町を続ける：${title}${saved === null ? "" : `・保存：${saved}`}`
  },
  /** The end of the term. */
  reckoning: {
    lost: "任期は失敗・結果を見る",
    over: (term: number): string => `第${term}期終了・結果を見る`,
    /** The heading of a term that ran its course: `verdict` is one of `verdict` below. */
    title: (term: number, verdict: string): string => `第${term}期終了：${verdict}`,
    /** What became of a town whose term ran out. */
    verdict: { unrooted: "町は根づかなかった", flourishing: "繁栄", holding: "持ちこたえている", declining: "衰退" },
    facts: {
      rank: "位",
      minutes: "在任（分）",
      residents: "住民",
      citizens: "市民・富裕",
      coins: "金貨",
      approval: "支持率",
      crown: "要請：達成・未達",
      score: "得点"
    },
    legend: "— 住民（破線：次の位）・金貨・- - 支持率・網かけ：冬",
    next: "次の任期",
    nextTitle: (minutes: number): string => `さらに${minutes}分務める：同じ町、新しい冬、王室の要請はまた小さく始まる`,
    retire: "引退して新しい町を作る",
    found: "新しい町を作る",
    look: "町を眺める",
    share: "町を共有",
    shareTitle: "町と評価の画像、または誰でも開けるリンク"
  },
  /** The picture a town is shared as, and the lines a link to it previews with. */
  card: {
    /** How a lost term ended (`ended`: the view's word for it), as a headline. */
    lost: (ended: string): string => ended,
    over: (now: number, term: number, verdict: string): string => `${rankName(now)}：第${term}期終了、${verdict}`,
    playing: (now: number, year: number, term: number): string => `${rankName(now)}・${year}年目・第${term}期`,
    land: (size: SizeId, land: LandId, minutes: number): string => `${sizeOf[size]}${landOf[land]}・任期${minutes}分`,
    residents: "住民",
    citizens: "市民",
    coins: "金貨",
    approval: "支持率"
  },
  share: {
    title: "町を共有",
    sub: "画像をどこにでも投稿するか、リンクを作りましょう。リンクを開いた人には、あなたがいま見ている位置からこの町が動いている様子が見え、ここから続きを遊べます。",
    /** The picture's button: a phone hands it to its share sheet, a computer saves it. */
    sharePicture: "画像を共有",
    savePicture: "画像を保存",
    makeLink: "リンクを作る",
    making: "リンクを作成中…",
    again: "もう一度リンクを作る",
    shareLink: "リンクを共有",
    copyLink: "リンクをコピー",
    open: "開く",
    noPicture: "画像を作れませんでした",
    /** What handing the picture or the link to the device came to. */
    offered: {
      shared: () => "共有しました",
      notShared: () => "共有されませんでした",
      saved: (o) => `画像を${o.name}として保存しました`,
      copied: () => "リンクをコピーしました",
      link: (o) => o.url
    } satisfies Wording<Offered>,
    /** Why a town could not be shared, or a shared one opened. What the server itself says (`error`) is in its own words. */
    failed: {
      unreachable: (f): string => (f.sending ? "町を共有するためのサーバーに接続できませんでした" : "その町のサーバーに接続できませんでした"),
      notFound: () => "そのリンクで共有された町はありません（共有は6か月間保存されます）",
      refused: (f) => `${f.sending ? "町を共有できませんでした" : "その町を開けませんでした"}：${f.error ?? `サーバーの応答は${f.status}`}`,
      unpacked: () => "町をまとめられませんでした"
    } satisfies Wording<ShareFailure>,
    notShared: "町を共有できませんでした",
    notOpened: "その町を開けませんでした"
  },
  /** Visiting a shared town. */
  visit: {
    shared: "共有された町",
    play: "ここから遊ぶ",
    playTitle: "この町を自分のものにする：建設も統治もでき、このブラウザに自動保存される",
    yours: "町はあなたのものです。遊ぶうちに自動保存されます",
    own: "自分の町を作る"
  },
  /** Saving and loading. */
  save: {
    notReady: "準備中",
    saved: "保存しました",
    /** A save's title, as it is listed: "中くらいのふつうの土地・2年目・23分経過". */
    title: (c: { readonly size: SizeId; readonly land: LandId; readonly year: number; readonly minutes: number }): string =>
      `${sizeOf[c.size]}${landOf[c.land]}・${c.year}年目・${c.minutes}分経過`,
    untitled: "ある町",
    /** A save from before saves had titles. */
    earlier: "以前のセーブ",
    loaded: (title: string): string => `「${title}」を読み込みました`,
    loadedAuto: (title: string): string => `自動保存を読み込みました：${title}`,
    /** What went wrong with a save. */
    trouble: {
      nothingSaved: (e): string => (e.auto ? "自動保存はまだありません" : "まだ何も保存されていません"),
      unreadable: () => "セーブを読めませんでした",
      wrongVersion: (e): string => (e.older ? "古いバージョンのゲームのセーブです" : "新しいバージョンのゲームのセーブです"),
      rejected: (e) => `このゲームに合わないセーブです：${e.reason}`,
      storageFailed: (e) => `保存できませんでした：${e.reason}`,
      unsaveable: (e) => `町を保存できませんでした：${e.reason}`
    } satisfies Wording<Trouble>
  },
  /**
   * News of the next Typeonce game (`ui/dom/brand/signup.ts`): the card at the first spring, and the panel on the
   * reckoning. "Typeonce Games" is a name, and stays.
   */
  signup: {
    /** The sign-up, read aloud. */
    label: "Typeonce Gamesの新作",
    /** The card's top strip, in the town's own voice: the moment (in bold), and what it means. The first spring is always year 3's. */
    moment: { lead: "3年目の春。", text: "町は最初の冬を越えました。" },
    headline: "Typeonceの次のゲームを、いち早く遊ぼう",
    body: "Inkline TownはTypeonce Gamesが作っています。メールアドレスを残せば、次の無料ゲームを公開の日にお届けします。",
    /** The field, read aloud, and what it shows while empty. */
    email: "メールアドレス",
    placeholder: "you@example.com",
    submit: "新作を受け取る",
    keep: "遊び続ける",
    /** How a sign-up went, in the studio's words (as on typeonce.games). */
    outcome: {
      ok: "受信箱を確認して、登録を完了してください。",
      invalid_email: "メールアドレスが正しくないようです。",
      rate_limited: "試行回数が多すぎます。1分待ってから、もう一度お試しください。",
      unavailable: "送信できませんでした。もう一度お試しください。"
    }
  },
  /** On the card shown while the town is drawn for the first time (the page's own HTML says it in English until the language is known). */
  loading: "町を描いています…",
  /** The town could not start, or stopped: said in place of the page. */
  fatal: {
    start: (why: string): string => `町を開始できませんでした：${why}`,
    frame: (delta: number): string => `無効なフレーム間隔：${delta}`,
    stopped: "システムの障害で町が止まりました。",
    loop: (field: string): string => `無効な固定ループ設定：${field}`
  }
} satisfies typeof English
