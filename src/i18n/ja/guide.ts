/**
 * Japanese for the mayor's guide (`game/rules/guide.ts`): what each step
 * asks for, why, and what closes it; and what the guide says of the town as
 * it stands (what is under way, what opens a building, what comes next).
 * The same steps and the same tokens as English's (`../en/guide.ts`), in
 * sentences of Japanese's own, in です・ます.
 *
 * As in English, a step is one thing to do (`action`, one sentence, ending
 * in 。), one reason (`why`), and what puts it away (`goal`, a plain clause
 * that reads after "完了条件："). Tools, panels, and map views are tokens;
 * what a finger and a mouse do is said with `token.device` (タップ,
 * クリック). Where English ends a sentence with something only a finger
 * does ("then tap Build"), Japanese ends its verb differently for each, so
 * the device's choice holds the verb's ending too. Amounts stay words.
 */
import type { GoodId, KindId } from "../../game/content/index.ts"
import type { Chapter, GuideLocked, GuideSoon, GuideStepId, GuideWaiting } from "../../game/rules/guide.ts"
import type { guide as English } from "../en/guide.ts"
import * as token from "../token.ts"
import type { Wording } from "../wording.ts"
import { built, goods } from "./nouns.ts"

/** A building, as a chip: by its plain name, or by the word the sentence needs (屋内市場, for the market's upgrade). */
const k = (id: KindId, shown?: string) => token.kind(id, shown)
/** A good, as a chip. */
const g = (id: GoodId) => token.good(id)
const tool = token.command
const map = token.view
const tap = token.device("タップ", "クリック")
/** The market's upgrade, as its chip says it. */
const marketHall = k("market", built("market", 1).noun.word)

/** A step in words: what to do, why, and when it is done. */
interface Step {
  readonly action: string
  readonly why: string
  readonly goal: string
}

const chapters = {
  founding: "町の創設",
  standing: "町を保つ",
  citizens: "市民を育てる",
  governing: "統治"
} satisfies Record<Chapter, string>

const steps = {
  // ── The opening, in order ──
  homes: {
    action: `${tool("homes")}を選び、町役場を囲む灰色の道路に沿ってドラッグ${token.device("し、「建設」をタップします", "します")}。`,
    why: "入植者は道路に面した家に住みつき、どの家も税を納めます。それが町の収入です。",
    goal: "家が1軒建つ"
  },
  road: {
    action: `${tool("road")}を選び、町役場の道路から水辺に向けて道路を引きます。`,
    why: `建物はどれも、辺のどれかの中央に道路が接していないと、誰もたどり着けません。次は${k("fishery")}で、近くに水が必要です。`,
    goal: "道路が水辺から2マス以内に届く"
  },
  fishery: {
    action: `${k("fishery")}を${tap}し、水辺から2マス以内になるよう、その道路沿いに置きます。`,
    why: `入植者は${g("fish")}を食べます。最初に少しありますが、${g("fish")}は蓄えのうちに腐ります。`,
    goal: `${k("fishery")}が建つ`
  },
  look: {
    action: `${tool("select")}で${k("fishery")}を${tap}し、パネルを開きます。`,
    why: "建物には、道路で15マス以内の家から働き手が来ます。パネルには人数と、足を引っぱっているものが出ます。上部の仕事の数字はその合計です。",
    goal: "建物のパネルを開く"
  },
  lumberjack: {
    action: `木々のそばの道路沿いに${k("lumberjack")}を建てます。`,
    why: `${g("planks")}が残り少なく、家にも建物にも使います。${g("planks")}のもとは${g("wood")}です。`,
    goal: `${k("lumberjack")}が建つ`
  },
  sawmill: {
    action: `${k("lumberjack")}の近くの道路沿いに${k("sawmill")}を建てます。`,
    why: `物資は順に作られます。${k("lumberjack")}が${g("wood")}を伐り、${k("sawmill")}がそれをひいて${g("planks")}にします。その間は運搬人が道路を通って運びます。`,
    goal: `${k("sawmill")}が建つ`
  },
  term: {
    action: `${tool("town")}パネルを開き、いちばん上にある目標を読みます。`,
    why: `目標を達成すると、町は集落から村、町、都市へと昇格し、そのたびに王室から報酬が届きます。考える時間が要るときは、${tool("pause")}で時計を止められます。`,
    goal: "町のパネルを開く"
  },
  grow: {
    action: "家が10軒建つまで、道路と家を増やします。",
    why: `人が増えれば税も増え、${tool("build")}メニューに新しい建物が加わります。ガイドが建物を勧めるのは、町に必要になってからです。`,
    goal: "家が10軒建つ"
  },

  // ── The course goes on: citizens ──
  quarry: {
    action: `白っぽい岩のそばの道路沿いに${k("quarry")}を建てます。`,
    why: `${g("stone")}が残り少なく、市民に必要な工房にも使います。黒っぽい岩は${g("ore")}で、あとで使います。`,
    goal: `${k("quarry")}が建つ`
  },
  cloth: {
    action: `${k("sheep")}と${k("weaver")}を、互いに近い道路沿いに建てます。`,
    why: `家は${g("bread")}、${g("cloth")}、信仰がそろうと市民の家になります。${k("sheep")}が${g("wool")}を刈り、${k("weaver")}がそれを織って${g("cloth")}にします。`,
    goal: `${k("sheep")}と${k("weaver")}が建つ`
  },
  chapel: {
    action: `家々の間の道路沿いに${k("chapel")}を建てます。`,
    why: `2つ目の必需品は信仰です。${k("chapel")}の司祭が通りかかる家に信仰を届け、${k("chapel")}は周りの通りを住みよくします。`,
    goal: `${k("chapel")}が建つ`
  },
  wheat: {
    action: `${k("farm")}と${k("mill")}を建てます。`,
    why: `3つ目の必需品は${g("bread")}で、いちばん長い連鎖です。${k("farm")}が${g("wheat")}を育て、${k("mill")}がそれをひいて${g("flour")}にします。`,
    goal: `${k("farm")}と${k("mill")}が建つ`
  },
  bakery: {
    action: `${k("mill")}の近くに${k("bakery")}を建てます。`,
    why: `${k("mill")}の${g("flour")}を焼いて${g("bread")}にします。食卓に${g("bread")}があれば、入植者の小屋でも税が1.5倍になります。`,
    goal: `${k("bakery")}が建つ`
  },
  citizens: {
    action: `${tool("select")}で家を${tap}し、市民が住むのにまだ何が足りないかを見ます。`,
    why: `${g("bread")}、${g("cloth")}、信仰、魅力度5の通りがそろい、蓄えから${g("planks")}と${g("stone")}が払えると、家は格上げされます。足りないものはパネルに出ます。`,
    goal: "最初の家に市民が住む"
  },
  goals: {
    action: `${tool("town")}パネルを開き、目標まであとどれくらいかを見ます。`,
    why: "最初の市民が越してきました。位が上がるごとに、市民の割合がより多く求められます。",
    goal: "町のパネルを開く"
  },
  ranks: {
    action: `${tool("town")}パネルの目標をすべて達成して、町の位を上げます。`,
    why: `2分間保てば町は昇格し、最後は都市になります。「町」の位で${k("market")}と${k("chapel")}を改築できます。手が必要なときはガイドが知らせます。`,
    goal: "町が「都市」になる"
  },

  // ── Around the course, when the town needs them ──
  crown: {
    action: "上部に出ている王室の要請の「送る」ボタンで、求められた品を送ります。",
    why: "金貨がもらえます。応えなかった要請は罰金になり、3回続けて逃すと任期が終わります。",
    goal: "品を送る"
  },
  winter: {
    action: `冬が来る前に${k("granary")}か${k("smokehouse")}を建てます。`,
    why: `冬は漁が鈍り、家々はよく食べ、${g("fish")}は蓄えのうちに腐ります。${k("granary")}なら5倍長もちし、${g("smoked")}は冬じゅうもちます。`,
    goal: `${k("granary")}か${k("smokehouse")}が建つ`
  },
  tools: {
    action: `${tool("town")}パネルの「物資と交易」で、${g("tools")}を買う設定にします。`,
    why: `工房は${g("tools")}をすり減らします。新しく作れるのは${k("smithy")}だけで、市民10人で解禁されます。`,
    goal: `町が${g("tools")}を買う、または${k("smithy")}が建つ`
  },
  forester: {
    action: `${k("lumberjack")}の隣に${k("forester")}を建てます。`,
    why: `${k("lumberjack")}の周りの木が尽きかけています。${k("forester")}が新しい木を植えます。`,
    goal: `${k("forester")}が建つ`
  },
  firewatch: {
    action: `家々の間の道路沿いに${k("firewatch")}を建てます。`,
    why: `木造の小屋は燃えやすく、火事は隣へ燃え広がります。火の番が危険を抑え、火消しが火を消します。危険は${map("fire")}で見られます。`,
    goal: `${k("firewatch")}が建つ`
  },
  builder: {
    action: `傷んだ建物の近くに${k("builder")}を建てます。`,
    why: `傷んだ建物は半分の速さでしか働かず、崩れることもあります。大工が道すがら${g("planks")}と${g("stone")}で直します。状態は${map("condition")}で見られます。`,
    goal: `${k("builder")}が建つ`
  },
  market: {
    action: `町役場からいちばん遠い家々の間に${k("market")}を建てます。`,
    why: `町役場の巡回人は道路で20マスまでしか届かず、その先の家には食料が届きません。${k("market")}の売り子がもっと遠くまで運びます。`,
    goal: `${k("market")}が建つ`
  },
  markethall: {
    action: `${k("market")}（上に金色の矢印）を${tap}し、パネルから${marketHall}への改築を始めます。`,
    why: `どの食料の巡回人も届かない家があります。${marketHall}の売り子はより遠く、より頻繁に回り、2つ目の${k("market")}の維持費もかかりません。`,
    goal: `${marketHall}が建つ`
  },
  street: {
    action: `近くに${k("chapel")}か${k("market")}か公園を置き、工房を遠ざけて、この家の通りの魅力度を5に上げます。`,
    why: `${g("bread")}も${g("cloth")}も信仰もありますが、市民はまともな通りにしか住みません。魅力度は${map("appeal")}で見られます。`,
    goal: "上等な通りの家に市民が住む"
  },
  carpenter: {
    action: `${g("planks")}から${g("furniture")}を作る${k("carpenter")}を建てます。`,
    why: `富裕市民は町屋敷に住み、町屋敷には${g("furniture")}が要ります。格上げに2点、その後も${k("market")}からときどき1点ずつ必要です。町屋敷は税も住める人数もいちばん多い家です。`,
    goal: `${k("carpenter")}が建つ`
  },
  healer: {
    action: `家々の間の道路沿いに${k("healer")}を建てます。`,
    why: `病気が広がっています。病気の家には半分の人しか住めません。${k("healer")}の医師が家々を回って治します。危険は${map("health")}で見られます。`,
    goal: `${k("healer")}が建つ`
  },
  watchhouse: {
    action: `家々の間の道路沿いに${k("watchhouse")}を建てます。`,
    why: `貧しい通り、半分空いた家、低い支持率は泥棒を生みます。衛兵が通りを巡回して治安を守ります。危険は${map("order")}で見られます。`,
    goal: `${k("watchhouse")}が建つ`
  },
  trade: {
    action: `${tool("town")}パネルの「物資と交易」で、余っている物資を売るか、足りない物資を買います。`,
    why: "指示するまで、町は何も交易しません。余った物資は、まだ稼いでいない金貨です。",
    goal: "町が何かを売る、または買う"
  },
  taxes: {
    action: `${tool("town")}パネルで税を少し上げます。`,
    why: "町は満足していますが、金貨が減っています。支持率が高ければ増税に耐えられます。125%を超えると、長く残る恨みを買います。",
    goal: "税率を変える"
  },
  smithy: {
    action: `赤さびの筋が入った黒っぽい岩のそばに${k("mine")}を建て、${k("smithy")}も建てます。`,
    why: `${g("tools")}が残り少なく、どの工房もすり減らします。${k("mine")}が${g("ore")}を掘り、${k("smithy")}がそれを鍛えて${g("tools")}にします。`,
    goal: `${k("mine")}と${k("smithy")}が建つ`
  }
} satisfies Record<GuideStepId, Step>

/** What is happening, once the mayor has done a step's part and the town is at work on it. */
const waiting = {
  homesNoPlanks: () => `家は${g("planks")}を待っていますが、蓄えにありません。`,
  homesRising: () => `大工が蓄えから新しい家へ${g("planks")}を運んでいます。家が建てば入植者が越してきます。${tool("speed")}で時間を早められます。`,
  siteNoPlanks: () => `蓄えに${g("planks")}がないので、工事が止まっています。${tool("town")}パネルで何かを売るか、そこで${g("planks")}を買ってください。`,
  siteRising: () => `いまは工事中です。運搬人が蓄えから${g("planks")}と${g("stone")}を運び、大工が建てます。${tool("speed")}で時間を早められます。`,
  homesLaid: () => "家10軒の区画ができました。大工が建てているところです。"
} satisfies Wording<GuideWaiting>

/** Why the town cannot build what a step asks for yet, and what to do meanwhile. */
const locked = {
  residents: (l) => `${k(l.kind)}は住民${l.needs}人で解禁されます（現在${l.now}人）。${tool("homes")}を増やし、食べ物を絶やさないようにしましょう。`,
  citizens: (l) => `${k(l.kind)}は市民${l.needs}人で解禁されます（現在${l.now}人）。`,
  coins: (l) => `金貨を貯めましょう。${k(l.kind)}は金貨${l.cost}枚です（現在${l.now}枚）。家は毎分税を納めます。`
} satisfies Wording<GuideLocked>

/** A good's count with its counter, as the guide's next step says it: "30枚". */
const many = (id: GoodId, n: number) => `${n}${goods[id].counter}`

/** The next step that waits for the town to need it: what it will ask for, and when it comes. */
const upcoming = {
  lumberjack: (s) => `次：${g("planks")}が${many("planks", s.below)}を切ったら${k("lumberjack")}と${k("sawmill")}（現在${many("planks", s.now)}）。`,
  sawmill: (s) => `次：${g("planks")}が${many("planks", s.below)}を切ったら${k("sawmill")}（現在${many("planks", s.now)}）。`,
  quarry: (s) => `次：${g("stone")}が${many("stone", s.below)}を切ったら${k("quarry")}（現在${many("stone", s.now)}）。`
} satisfies Wording<GuideSoon>

export const guide = { chapters, steps, waiting, locked, upcoming } satisfies typeof English
