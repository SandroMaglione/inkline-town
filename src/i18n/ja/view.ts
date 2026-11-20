/**
 * Japanese for what the view reads off the town (`src/view`): the panels of
 * a building, a home, a park, and a ruin; why something is not working and
 * what to do about it; the alerts; the tooltip under the pointer; the map
 * views' legends; and what an upgrade changes. The same entries as
 * English's (`satisfies typeof English`), each with the same tokens in it.
 *
 * A panel's labels are nouns, as a Japanese game's are ("維持費", "働き手");
 * a reason or a piece of advice under a row is a short plain clause with no
 * full stop ("近くに倉庫を建てる"), and what is read as sentences (behind an
 * ⓘ, a map view's legend) is in です・ます. Where English separates the
 * parts of a line with " · ", Japanese uses "・"; a cost keeps English's
 * dots, which the page drops between its icons.
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
/** A span of seconds, to a tenth: "4.5秒". */
const seconds = (s: number) => `${Math.round(s * 10) / 10}秒`

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
  homes: () => "隣の立派な家",
  water: () => "水辺",
  woods: () => "森",
  paved: () => "舗装道路",
  ruin: () => "廃墟",
  worn: () => "傷んだ家",
  park: () => "公園"
} satisfies Wording<AppealLabel>

/** What counts most against a street, in a line: "採石場−6、倉庫−2". */
const against = (parts: ReadonlyArray<AppealPart>, most = 2): string =>
  parts.filter((p) => p.value < 0).slice(0, most).map((p) => `${say(source, p.label)}${signed(p.value)}`).join("、")

const street = {
  source,
  against,
  /** A street against what the next tier needs: "ここは−4、必要5：採石場−6". */
  short: (s: Street, needed: number): string => {
    const why = against(s.parts)
    return `ここは${signed(s.desirability)}、必要${needed}${why ? `：${why}` : ""}`
  },
  /** What would lift a street: the things a mayor can do (`dragged`: something drags it down). Buildings as chips. */
  advice: (dragged: boolean): string =>
    dragged ? `工房を遠ざけるか、公園、${chip("chapel")}、舗装を加える` : `隣に公園、${chip("chapel")}、舗装道路を加える`
}

// ── Why a home lacks something ────────────────────────────────────────────

const notLately = {
  food: "市場の売り子が最近来ていない",
  bread: "市場の売り子が最近パンを持って来ていない",
  cloth: "市場の売り子が最近布を持って来ていない",
  faith: "礼拝堂の司祭が最近来ていない",
  furniture: "市場の売り子が最近家具を持って来ていない"
} satisfies Record<Need, string>

const noneInTown = {
  food: { why: "町に食料の蓄えがない", fix: `水辺に${chip("fishery")}を建てる。いちばん早い` },
  bread: { why: "町にパンがない", fix: `${chip("bakery")}を建てる。${chip("farm")}の${token.good("wheat")}が${chip("mill")}へ、その${token.good("flour")}が${chip("bakery")}へ行く` },
  cloth: { why: "町に布がない", fix: `${chip("weaver")}を建てる。${chip("sheep")}の${token.good("wool")}を織る` },
  furniture: { why: "町に家具がない", fix: `${chip("carpenter")}を建てる。${token.good("planks")}から${token.good("furniture")}を作る` }
} satisfies Record<Exclude<Need, "faith">, Told>

const risks = { fire: "火災", health: "病気", order: "盗難" } satisfies Record<RiskId, string>

/** Why a need is unmet, and what to do about it: the cause in a line, the cure with its buildings as chips. */
const cause: Wording<Cause, Told> = {
  noWalker: (c) =>
    c.service === "market"
      ? { why: "市場の売り子がこの通りまで来ない", fix: `${chip("market")}を建てる。売り子は道路${c.range}マス、${chip("townhall")}の巡回人は${c.hallRange}マスまで歩く` }
      : { why: "礼拝堂の司祭がこの通りまで来ない", fix: `${chip("chapel")}を建てる。司祭は道路${c.range}マスまで歩く` },
  tooPoor: (c) => ({
    why: `${needs[c.need]}は魅力度${c.needed}以上の通りにしか届かず、ここは${signed(c.desirability)}`,
    fix: "通りを良くする（「通り」を参照）"
  }),
  noneInTown: (c) => noneInTown[c.need],
  notLately: (c) => ({ why: notLately[c.need] }),
  unkept: (c) => ({
    why: `${c.high.map((r) => risks[r]).join("、")}が抑えられていない`,
    fix: `${chip("firewatch")}、${chip("healer")}、${chip("watchhouse")}のすべてがここを回る必要がある`
  })
}

// ── Why a building is not working ─────────────────────────────────────────

const sources = { stone: "石材", ore: "鉱石", field: "実った畑" } as const

/** Why a building is not working: in a word or two, why in a line, and what to do (its buildings and goods as chips). */
const problem: Wording<Problem, ToldProblem> = {
  unconnected: () => ({ label: "道路なし", why: "辺のどれかの中央に道路が必要", fix: "辺のどれかに沿って道路を敷く" }),
  noWorkersNear: (p) => ({
    label: "働き手なし",
    why: `道路${COMMUTE}マス以内に${p.crew === "citizens" ? "市民（または入植者）の家" : "入植者の小屋"}がない`,
    fix: "もっと近くに家を並べるか、近くの家まで道路を引く"
  }),
  workersTaken: () => ({ label: "働き手なし", why: "近くの人はみな仕事がある", fix: `道路${COMMUTE}マス以内に家を増やす` }),
  full: () => ({ label: "満杯", why: "作った物の行き場がない", fix: `近くに${chip("warehouse")}を建てるか、${town}パネルで余りを売る` }),
  paused: () => ({ label: "休止中", why: "働き手なし、維持費は4分の1", fix: "下のボタンで作業を再開する" }),
  fishedOut: (p) => ({
    label: "魚なし",
    why: `届く水を獲り尽くした。どの水辺も漁のあと${p.seconds}秒休む`,
    fix: `自分だけの長い岸を与えるか、この水の${chip("fishery")}を減らす`
  }),
  noWater: (p) => ({ label: "水なし", why: `${p.radius}マス以内に水がない`, fix: "岸辺に建て直す" }),
  workedOut: (p) => ({
    label: "掘り尽くし",
    why: `届く掘り跡から、ときどき${goods[p.source].word}が少し採れるだけ`,
    fix: `新しい岩のそばに建てるか、${town}パネルで${token.good(p.source)}を買う`
  }),
  growing: (p) => ({ label: "待機中", why: `届く${p.source === "tree" ? "木" : "畑"}はまだ育っている` }),
  noTrees: (p) => ({ label: "木なし", why: `${p.radius}マス以内に育った木がない`, fix: `近くに${chip("forester")}を建てる。木を植え直す` }),
  noSource: (p) => ({ label: `${sources[p.source]}なし`, why: `${p.radius}マス以内に${sources[p.source]}がない`, fix: "もっと近くに建て直す" }),
  noInput: (p) => ({
    label: `${goods[p.good].word}なし`,
    why: `${goods[p.good].word}待ち`,
    fix: p.maker ? `${chip(p.maker)}を建てるか、${town}パネルで${token.good(p.good)}を買う` : `${town}パネルで${token.good(p.good)}を買う`
  }),
  nothingToHandOut: () => ({ label: "配る物なし", why: "ここに魚もパンも布もない", fix: "倉庫の蓄えを満たす（配る物は倉庫から持ち出す）" }),
  noPlanks: () => ({ label: "板材なし", why: "直すための材料がない", fix: `${chip("sawmill")}を建てる` }),
  waiting: () => ({ label: "待機中", why: "待機中" }),
  onFire: () => ({ label: "火事！", why: "働き手が逃げ出した", fix: `${chip("firewatch")}の火消しが火を消す` })
}

// ── Upgrades ──────────────────────────────────────────────────────────────

/** What an upgrade changes, a row each: what, from what to what, and (in brackets, in a line) what qualifies it. */
const change: Wording<Change, Gain> = {
  output: (c) => ({ label: goods[c.good].word, value: `毎分${c.from} → ${c.to}（1回${seconds(c.secondsFrom)} → ${seconds(c.secondsTo)}）` }),
  workers: (c) => ({ label: "働き手", value: `${c.from} → ${c.to}` }),
  holds: (c) => ({ label: "保管量", value: `各物資${c.from} → ${c.to}` }),
  carriers: (c) => ({ label: "運搬人", value: `${c.from} → ${c.to}` }),
  firefighters: (c) => ({ label: "火消し", value: `${c.from} → ${c.to}` }),
  reach: (c) => ({ label: "巡回範囲", value: `道路${c.from} → ${c.to}マス` }),
  calls: (c) => ({ label: "巡回の間隔", value: `${seconds(c.from)} → ${seconds(c.to)}` }),
  deep: () => ({ label: "掘り尽くした岩も3分の1でなく全速で切る" }),
  admin: (c) => ({ label: "運営費", value: `${c.from}% → ${c.to}%減` }),
  appeal: (c) => ({
    label: "周りの魅力度",
    value: `${c.from === null ? "0" : signed(c.from)} → ${signed(c.to)}`,
    ...(c.reach === null ? {} : { note: `${c.reach}マスまで` })
  }),
  upkeep: (c) => ({ label: "維持費", value: `${c.from} → ${token.rate(c.to)}` })
}

/** Why the town needs an upgrade now. In an alert its buildings and goods are chips; in a panel it is said in words. */
const wanted = {
  nextRank: "次の位で必要",
  shelvesFull: "棚がいっぱい",
  rockWorked: "岩を掘り尽くした",
  millsWait: `${chip("mill")}が${token.good("wheat")}を待っている`,
  breadShort: `全力で焼いても家々に${token.good("bread")}が行き渡らない`,
  unreached: "どの食料の巡回人も届かない家がある",
  beyondPriest: "司祭の届かない家がある",
  fireRisk: "周りの通りの家は火災の危険が高い"
} satisfies Record<WantedReason, string>

const upgrade = {
  change,
  /** A change in one line: "周りの魅力度：+4 → +6（6マスまで）". */
  line: (g: Gain): string => `${[g.label, ...(g.value === undefined ? [] : [g.value])].join("：")}${g.note === undefined ? "" : `（${g.note}）`}`,
  /** What starting an upgrade costs: coins now, and the materials carriers then bring. */
  price: (c: Kind["cost"]): string => {
    const carried = cost({ coins: 0, materials: c.materials })
    return `着工時に${token.coins(c.coins)}${carried ? `・運搬人が${carried}を運ぶ` : ""}`
  },
  /** The treasury lacks this much of what it costs to begin. */
  short: (n: number): string => `${token.coins(n)}不足`,
  wanted,
  /** The first upgrade the town needs, in the ticker: why, what becomes what, and how to begin. */
  hint: (h: { readonly reason: WantedReason; readonly kind: KindId; readonly level: number }): string =>
    `${wanted[h.reason]}：${chip(h.kind, kindName(h.kind, h.level))}は${kindName(h.kind, h.level + 1)}に改築できる。金色の矢印の下の建物を${token.device("タップ", "クリック")}して開始`,
  /** The upgrade tool's tooltip. */
  path: (kind: KindId, level: number): string => `${kindName(kind, level)} → ${kindName(kind, level + 1)}`,
  underWay: "工事中：運搬人が資材を運んでいる",
  begin: "クリックで開始：その間も稼働を続ける",
  pick: (kind: KindId): string => `改築：${kindName(kind)}を選ぶ・Escで終了`,
  /** The gestures' answers. */
  pickOne: "改築する建物を選んでください",
  already: (kind: KindId): string => `${kindName(kind)}はすでに改築中です`,
  /** An upgrade under way, in the building's panel. */
  becoming: (kind: KindId, level: number): string => `${kindName(kind, level)}に改築中`,
  built: "完成",
  stillBring: (left: string): string => `運搬人が${left}をまだ運んでいる。その間も稼働を続ける`,
  allIn: "資材はすべて届いた。大工が仕上げていて、その間も稼働を続ける"
}

// ── Placing ───────────────────────────────────────────────────────────────

const gathered = { tree: "木", stone: "白っぽい石の岩", ore: "黒っぽい鉱石の岩", water: "水" } as const

const place = {
  /** What is wrong with a building where it would stand. */
  problem: {
    noRoad: () => "辺のどれかの中央に道路が必要",
    nothingNear: (p) => `${p.radius}マス以内に${gathered[p.source]}がない`
  } satisfies Wording<PlaceProblem>,
  /** A building refused where it was put down: "漁師小屋：辺のどれかの中央に道路が必要". */
  refused: (kind: KindId, why: string): string => `${kindName(kind)}：${why}`
}

// ── Map views ─────────────────────────────────────────────────────────────

/** Each map view's legend: its heading, what each colour means, and how the reading works. */
const legend = {
  appeal: {
    title: "魅力度",
    keys: {
      townhouses: `${home.tiers[3].appeal}以上：町屋敷`,
      citizens: `${home.tiers[2].appeal}以上：市民`,
      settlers: "0〜4：入植者のみ",
      fewer: "0未満：人も税も減る",
      squalid: `${home.squalid}以下：不潔`
    },
    note: "1点ごとに効きます。0を下回ると、小屋は1点ごとに住める人も税も減り、上回ると税が増えます。工房は家を遠ざけ、公園（置く物が多いほど遠くまで効く）、礼拝堂、市場、舗装道路は家を引き寄せます。"
  },
  workers: {
    title: "労働者",
    keys: { staffed: "人手十分", short: "人手不足", none: "働き手なし", settlers: "入植者の家", citizens: "市民の家" },
    note: `住民は道路で最大${COMMUTE}マスまで歩いて働きに行きます。職場を選ぶと、その範囲と範囲内の家が見られます。`
  },
  fire: {
    title: "火災",
    keys: { good: "見回り済み", fair: "上昇中", bad: "危険、または火事" },
    note: "建物にも色がつきます。火の番所の火の番は、道すがら家と工房の危険をすべて元に戻します。朱色は半分を超えた印で、まだ間に合います。木造の小屋、かまど、炉、過密が危険を高めます。"
  },
  health: {
    title: "健康",
    keys: { good: "往診済み", fair: "上昇中", bad: "危険、または病気" },
    note: "診療所の医師が危険を元に戻し、病人を治します。飢え、過密、不潔、採石場の埃、よどんだ水が危険を高めます。"
  },
  order: {
    title: "治安",
    keys: { good: "保たれている", fair: "上昇中", bad: "泥棒がいる" },
    note: "衛兵所の衛兵が治安を保ちます。低い支持率、不潔、満員でない家が危険を高めます。まず盗難が起き、次に家が荒れ果てます。"
  },
  condition: {
    title: "状態",
    keys: { good: "手入れ良好", fair: "要修繕", bad: "荒廃：半分の速さ" },
    note: "修繕所の大工が、通りかかった建物を板材と石材で直します。0になると崩れ落ちます。"
  }
} satisfies { readonly [V in keyof LegendKeys]: { readonly title: string; readonly keys: Readonly<Record<LegendKeys[V], string>>; readonly note: string } }

// ── Parks and ruins ───────────────────────────────────────────────────────

/** What a park does for the streets around it. */
const parkWorth = (value: number, reach: number): string => `魅力度${signed(value)}、${reach}マスまで`
/** What became of a ruin, in a word. */
const ruinCause = { burnt: "焼失", collapsed: "倒壊", derelict: "荒廃" }

// ── The catalog's part ────────────────────────────────────────────────────

export const view = {
  /** What a building is doing, in a word. */
  status: {
    building: "建設中", idle: "待機中", working: "稼働中", starved: "材料不足", blocked: "停滞", unstaffed: "人手不足", unconnected: "道路なし", paused: "休止中"
  } satisfies Record<Status, string>,
  street,
  cause,
  /** A cause in one line: "why：what to do". */
  causeLine: (told: Told): string => (told.fix === undefined ? told.why : `${told.why}：${told.fix}`),
  problem,
  /** A problem in one line, for the panel's header and the tooltip: "道路なし：辺のどれかの中央に道路が必要". */
  problemLine: (told: ToldProblem): string => `${told.label}：${told.why}`,
  upgrade,
  place,
  legend,
  /** How a risk reads: "良好", "40%", or "高い（85%）". */
  risk: { ok: "良好", some: (percent: number): string => `${percent}%`, high: (percent: number): string => `高い（${percent}%）` },
  /** What pulling something down (or cancelling a site) costs and gives back: "撤去：−25・板材2、石材3を回収". */
  salvage: (s: { readonly cancelled: boolean; readonly salvage: Salvage }): string => {
    const said = salvage(s.salvage)
    return `${s.cancelled ? "取消" : "撤去"}${said ? `：${said}` : ""}`
  },

  /** What moves the town's approval, a row each. */
  mood: {
    base: "町の気分",
    needs: "必需品の充足",
    taxes: "現在の税",
    grudge: "過去の税への恨み",
    debt: "未払いの賃金",
    crown: "王室の不興",
    winter: "飢えた冬"
  },

  /** What the next rank asks: each goal, and how the town stands against it. */
  goal: {
    text: {
      residents: (target) => `住民${target}人`,
      citizens: (target) => `うち市民${target}%`,
      burghers: (target) => `うち富裕市民${target}%`,
      approval: (target) => `支持率${target}以上`,
      income: (target) => `毎分金貨${target}枚、借金なし`,
      hall: (target) => kindName("townhall", target)
    } satisfies Record<GoalId, (target: number) => string>,
    value: {
      residents: (value) => `${value}`,
      citizens: (value) => `${value}%`,
      burghers: (value) => `${value}%`,
      approval: (value) => `${value}`,
      income: (value) => `${value}`,
      hall: (value, target): string => (value >= target ? "完成" : "未完成")
    } satisfies Record<GoalId, (value: number, target: number) => string>
  },

  /** What needs looking at now, in the ticker: buildings, goods, and tools as chips; amounts in words. */
  alerts: {
    fire: (burning: number, watched: boolean): string =>
      `火事${burning}件：${watched ? `${chip("firewatch")}の火消しが向かっている` : `近くに${chip("firewatch")}を建てる。火消しが火を消す`}`,
    sick: (sick: number, healed: boolean): string =>
      `病気の家${sick}軒、住める人は半分：${healed ? `道路で届く範囲の${chip("healer")}が治す` : `家々の間に${chip("healer")}を建てる`}`,
    /** Workshops idle for want of their input, by kind: "材料待ち：製粉所×2に小麦が必要。…". */
    idle: (waiting: ReadonlyArray<{ readonly kind: KindId; readonly good: GoodId; readonly n: number }>): string =>
      `材料待ち：${waiting.map((w) => `${chip(w.kind)}${w.n > 1 ? `×${w.n}` : ""}に${token.good(w.good)}が必要`).join("、")}。作る建物を増やすか、${town}パネルで買う`,
    /** Workplaces no home can reach, by kind. */
    remote: (remote: ReadonlyArray<{ readonly kind: KindId; readonly n: number }>): string =>
      `${remote.map((w) => `${chip(w.kind)}${w.n > 1 ? `×${w.n}` : ""}`).join("、")}に働き手がいない：道路${COMMUTE}マス以内に${token.command("homes")}を並べるか、近くの家まで道路を引く`,
    hungry: `食料の蓄えがなく、家々は飢えて税を納めない：${chip("fishery")}をもう1棟建てるか、${town}パネルで${token.good("fish")}を買う`
  },

  /** A building's panel. */
  building: {
    beingBuilt: "建設中",
    waitingFor: "資材待ち",
    carriersBring: "運搬人が倉庫から運ぶ。町にない物は町のパネルで買う",
    builders: "大工",
    atWork: "作業中",
    workers: "働き手",
    staffed: (assigned: number, needed: number): string => `${assigned}/${needed}人`,
    nobodyNear: (crew: Crew): string => `道路${COMMUTE}マス以内に${crewPeople(crew)}が住んでいない：もっと近くに家を並べる`,
    allTaken: `近くの人はみな仕事がある：道路${COMMUTE}マス以内に家を増やす`,
    apprentices: "入植者が市民の代わりに、4分の3の速さで働いている",
    makes: "生産",
    /** What it makes: from what, into what (each with its icon), or what alone. */
    recipe: (input: GoodId | null, output: GoodId): string => (input ? `${token.good(input)} → ${token.good(output)}` : goods[output].word),
    walkersOut: "巡回中",
    handedOut: "直近1分の配布",
    handedTo: (n: number): string => `巡回先の家${n}軒へ`,
    nothing: "なし",
    nobodyNeeded: "巡回先に、手持ちの物を必要とする家がなかった",
    shelf: "いまの在庫",
    holds: "保管量",
    tools: "道具",
    none: "なし",
    noTools: "届くまで半分の速さ：鍛冶屋が作るか、町のパネルで買う",
    upkeep: "維持費",
    upkeepValue: (coins: number): string => token.rate(coins),
    condition: "状態",
    runDown: "半分の速さで、崩れるおそれもある：修繕所が直す",
    wearing: "修繕所の大工が通りかかると直す",
    fireRisk: "火災の危険",
    fireCure: "火の番所の火の番が通りかかると下がる",
    appeal: "周りの魅力度",
    work: "作業",
    running: "運営",
    /** Behind the ⓘ of "運営": a sentence for each thing that costs or risks something. */
    help: {
      upkeep: "維持費は建っている間ずっと毎分かかります。休止中は4分の1です。",
      condition: "どんな物も傷みます。修繕所が直します。",
      hot: "かまどや炉があり、それ自体にも2マス以内の家にも火災の危険があります。",
      appeal: (reach: number, worse: boolean): string =>
        `${reach}マス先までの通りの住みよさを変えます。${worse ? "近くの家は住める人が減り、税も減ります。" : ""}`
    }
  },

  /** A home's panel. */
  house: {
    household: "世帯",
    beingBuilt: "建設中",
    builders: "大工",
    waitingPlank: "板材待ち",
    closed: "閉鎖中",
    empty: "空き家",
    closedNote: "税を納めず、町役場の負担にもならない：再開すれば入植者が戻る",
    /** Why it holds fewer than it could. */
    fewer: {
      sick: "病気の間は半分",
      disapproval: "町が町長を支持しない間は減る",
      street: (advice: string): string => `通りが貧しいので少ない：${advice}`,
      taxed: (rate: number): string => `税率${rate}%で減っている：出ていく人がいる`,
      needs: "必需品がすべてそろうまで少ない"
    },
    onFire: "火事",
    fled: "全員避難",
    sick: "病気",
    halved: "半分",
    sickNote: "1分で治るか、診療所の医師が来れば治る",
    residents: "住民",
    living: (n: number, room: number): string => `${n}/${room}人`,
    pays: "納税",
    paying: (coins: number): string => token.rate(coins),
    hungry: "飢え",
    hungryNote: "飢え：食料がなく、税もない",
    could: (coins: number): string => `必需品がすべてそろえば${token.rate(coins)}`,
    worksAt: "勤め先",
    workplace: (kind: KindId): string => kindName(kind),
    nothingNearby: "近くになし",
    needs: "必需品",
    met: "✓",
    missing: "不足",
    /** What a need is wanted for: the tier it would raise the home to. */
    forTier: (tier: Tier): string => `${tiers[tier].people}に必要`,
    street: "通り",
    streetOf: (desirability: number, needed: number): string => `${signed(desirability)}/${needed}`,
    desirability: (d: number): string => signed(d),
    services: "公共サービス",
    rebuilding: "建て替え",
    rebuilt: "完了✓",
    shortOf: (short: Kind["cost"]): string =>
      `町に${[...(short.coins > 0 ? [token.coins(short.coins)] : []), ...(Object.entries(short.materials) as Array<[GoodId, number]>).map(([g, n]) => token.amount(g, n))].join("、")}が足りない`,
    waitsForStore: `蓄えにそろうまで今の段階で待つ：作るか、${town}パネルで買う`,
    rebuiltAlready: "建て替え済み：費用なしで元に戻る",
    readyFor: (tier: Tier): string => `${tiers[tier].people}を迎える準備完了`,
    readyNote: "次の住民が越してくると格上げされ、そのとき建て替え費用を払う",
    safety: "危険と傷み",
    risks: "危険",
    allLow: "すべて低い",
    riskOf: { fire: "火災の危険", health: "病気の危険", order: "盗難の危険" } satisfies Record<RiskId, string>,
    cure: { fire: "火の番所の火の番が下げる", health: "診療所の医師が下げる", order: "衛兵所の衛兵が下げる" } satisfies Record<RiskId, string>,
    robbed: "盗難",
    times: (n: number): string => `${n}回`,
    condition: "状態",
    runDown: "通りの魅力を下げ、崩れるおそれもある：修繕所が直す",
    wearing: "修繕所の大工が通りかかると直す",
    /** Behind the ⓘ of "必需品", by the home's tier: what red and amber mean, and what the next tier asks. */
    needsHelp: {
      1: `赤はいま必要なもの。黄は市民の家になるために必要なもので、市民の家は住める人も税も2倍です。パンだけでも小屋の税は1.5倍になります。必需品は巡回人が道路沿いに届けます。「通り」はその場所の住みよさです（市民には魅力度${home.tiers[2].appeal}が必要）。`,
      2: `赤はいま必要なもので、欠けると入植者に戻ります。黄は富裕市民の町屋敷になるために必要なもので、魅力度${home.tiers[3].appeal}の通りと、火の番所、診療所、衛兵所すべての巡回が条件です。`,
      3: "赤はいま必要なもので、欠けると市民に戻ります。"
    } satisfies Record<Tier, string>,
    safetyHelp: "どの家も火事、病気、盗難の危険が少しずつ高まります。対応する施設の巡回人が通りかかると下がります。",
    /** How it is, in a word or two for the header. */
    summary: (n: number): string => `住民${n}人`
  },

  /** A park's panel. */
  park: {
    worth: parkWorth,
    /** What a park's beauty is made of. */
    part: {
      ground: (l): string => (l.capped ? "地面（効くのはここまで）" : "地面"),
      ways: () => "通りからの入口",
      prop: (l) => props[l.prop].noun.word
    } satisfies Wording<ParkLabel>,
    size: "広さ",
    sizeOf: (n: number, beauty: number): string => `${n}マス・美しさ${beauty}`,
    madeOf: "内訳",
    /** Its parts with what each is worth, already worded: "地面2、街灯1.5". */
    parts: (parts: ReadonlyArray<{ readonly label: string; readonly value: number }>): string => parts.map((p) => `${p.label}${p.value}`).join("、") || "まだなし",
    streets: "周りの通り",
    ways: "通りからの入口",
    waysIn: (n: number): string => `${n}${n > 2 ? "（有効は2つまで）" : ""}`,
    none: "なし",
    noWays: "砂利道か石畳の広場を道路までつなぐ：1つにつき+1.5、有効は2つまで",
    furnishings: "有効な調度品",
    furnished: (placed: number, room: number): string => `${placed}/${room}`,
    crowded: (n: number): string => `${n}個多すぎる：有効なのは公園2マスにつき1個なので、地面を広げる`,
    nicerWith: "あるとよい物",
    missing: (ids: ReadonlyArray<PropId>): string => ids.map((id) => props[id].noun.word).join("、"),
    upkeep: "維持費",
    upkeepValue: (coins: number): string => token.rate(coins)
  },

  /** A ruin's panel. */
  ruin: {
    cause: ruinCause,
    happened: "何があったか",
    what: { burnt: "焼け落ちた", collapsed: "修繕されずに崩れ落ちた", derelict: "盗難のあと荒れ果てた" },
    appeal: "周りの魅力度",
    untilCleared: "撤去するまで続く"
  },

  /** What the pointer is over, in a line; and what a tool would lay there, and for how much. Amounts as icons. */
  tooltip: {
    /** A building: what it is doing, or what keeps it from it; and what it is becoming, when works are under way. */
    building: (b: { readonly kind: KindId; readonly level: number; readonly state: string; readonly works: { readonly level: number; readonly percent: number } | null }): string =>
      `${kindName(b.kind, b.level)}・${b.state}${b.works ? `・${kindName(b.kind, b.works.level)}に改築中、${b.works.percent}%完成` : ""}`,
    /** Bulldozing: what pulling it down gives back, or that it stays. */
    bulldozeBuilding: (kind: KindId, level: number, back: string): string => `${kindName(kind, level)}・${back}`,
    hallStays: "町役場は撤去できない",
    bulldozeHome: (tier: Tier, back: string): string => `${tiers[tier].home.word}・${back}`,
    homeClosed: (tier: Tier): string => `${tiers[tier].home.word}・閉鎖中`,
    home: (h: { readonly tier: Tier; readonly residents: number; readonly desirability: number; readonly burning: boolean; readonly sick: boolean }): string =>
      `${tiers[h.tier].home.word}・住民${h.residents}人・魅力度${h.desirability}${h.burning ? "・火事！" : h.sick ? "・病気" : ""}`,
    ruin: (cause: "burnt" | "collapsed" | "derelict"): string => `廃墟・${ruinCause[cause]}・撤去で片づく`,
    park: (what: { readonly prop: PropId } | { readonly ground: GroundId }, whole: { readonly cells: number; readonly value: number; readonly reach: number } | null): string =>
      `公園・${"prop" in what ? props[what.prop].noun.word : grounds[what.ground].noun.word}${whole ? `・${whole.cells}マス・${parkWorth(whole.value, whole.reach)}` : ""}`,
    /** Placing a building: what keeps it from here, or what it costs. */
    placeLocked: (kind: KindId, l: Lock): string => `${kindName(kind)}・${say(lock, l)}`,
    placeNoRoom: (kind: KindId): string => `${kindName(kind)}・ここには置けない`,
    placeProblem: (kind: KindId, why: string): string => `${kindName(kind)}・${why}`,
    placeCost: (kind: KindId, c: Kind["cost"]): string => `${kindName(kind)}・${cost(c)}`,
    pave: (c: { readonly coins: number; readonly stone: number }): string => `舗装・1マス${token.coins(c.coins)}と${token.amount("stone", c.stone)}・歩くのが速くなる`,
    desirability: (d: number): string => `魅力度${d}`,
    cancel: "ここで離すと取り消し",
    /** What new homes would bring in once fed, or that they would cost more than they pay. */
    homesWorth: (coins: number): string => (coins > 0 ? `・食料が届けば${token.rate(coins, true)}` : "・税より運営費がかかる：上等な家ほど税が多い"),
    homes: (c: Kind["cost"], worth: string | null): string => `住宅・1軒${cost(c)}${worth ?? "・道路沿いに並べる"}`,
    road: (coins: number): string => `道路・1マス${token.coins(coins)}`,
    /** A stroke being dragged: how much it lays, and what that costs. */
    roadStroke: (n: number, c: Kind["cost"]): string => `道路${n}マス・${cost(c)}`,
    homesStroke: (n: number, c: Kind["cost"], worth: string): string => `家${n}軒・${cost(c)}${worth}`,
    paveStroke: (n: number, c: Kind["cost"]): string => `舗装${n}マス・${cost(c)}`,
    groundStroke: (ground: GroundId, n: number, c: Kind["cost"]): string => `${grounds[ground].noun.word}${n}マス・${cost(c)}`,
    ground: (ground: GroundId, c: Kind["cost"], park: number | null): string => `${grounds[ground].noun.word}・${cost(c)}${park === null ? "" : `・公園の魅力度${signed(park)}`}`,
    /** A furnishing about to be set: what the park would be worth with it (and is now, when that differs), and whether it is one too many. */
    prop: (prop: PropId, c: Kind["cost"], park: { readonly value: number; readonly before: number | null; readonly crowded: boolean } | null): string =>
      `${props[prop].noun.word}・${cost(c)}${park ? `・公園の魅力度${signed(park.value)}${park.before === null ? "" : `（現在${signed(park.before)}）`}` : ""}${park?.crowded ? "・置きすぎ" : ""}`,
    propNeedsPark: (prop: PropId): string => `${props[prop].noun.word}・先に公園の地面を敷く`,
    removeProp: (prop: PropId): string => `${props[prop].noun.word}を撤去`,
    removeGround: (ground: GroundId): string => `${grounds[ground].noun.word}を撤去`,
    workedFace: (ore: boolean): string => `${ore ? "鉱石" : "石材"}の掘り跡・撤去で片づく`,
    rock: (ore: boolean, left: number): string => `${ore ? "鉱石" : "石材"}・残り${left}`,
    /** What a thing being placed would reach, said beside its outline. */
    walkersReach: (range: number): string => `巡回人は入口から道路${range}マスまで届く`,
    workersFrom: `働き手は道路${COMMUTE}マス以内の家から来る`,
    residentsWalk: `住民は道路${COMMUTE}マス以内の職場へ歩く`
  }
} satisfies typeof English
