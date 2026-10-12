# The mayor's plan: levers, pressure, and 60–90 minute towns

A plan for turning the current simulation into a game you play as the town's
mayor for one sitting of 45, 60, or 90 minutes, which ends with a town that
either flourished or fell apart, and lets you see why.

Section 0 is the version that was built from it. The rest starts with what
the code did before it, and where it would not hold up over a long run (§1). Then it covers what similar games do and what they leave out
(§2), how a session should be set up and paced (§3–4), the levers (§5), the
pressures that make decline possible (§6), new content (§7), how you win or
lose (§8),
what the engine needs (§9), and the order to build it in (§10).

---

## 0. The version built: "the charter"

The plan below is the full menu. The first version takes the smallest part
of it that makes a complete game: you feel the pressure of managing the
town's goods and coins for the whole sitting, and every term ends in a way
you can read. It keeps the levers few, so the game stays easy to learn and
to maintain.

### What is in

| Area | In this version | From the plan |
|------|-----------------|---------------|
| **Setting up** | A new-town dialog: land size (small, medium, large), richness (rich, fair, harsh), term (45, 60, 90 minutes), and seed, with a preview of the land | §3 |
| **Land** | An island-like stretch of land on a 64-cell square: a wandering coast, capes reaching out, lakes, forests, stone, and ore, all scaled by size and richness | user request |
| **Rhythm** | Six years a term; every year after the first ends in a winter (fields stop, fishing halves, homes eat faster) | §6.2 |
| **Pressure** | Administration grows with the number of homes; prices fall as the town sells and rise as it buys; stone and ore run out; crown requests grow through the term, with fines and snubs for missed ones | §5.4, §6.3, §6.4 |
| **Approval** | One town-wide figure from needs, taxes, unpaid wages, the crown's snubs, and hungry winters, with its parts shown. It sets how many people each home holds | §6.1, simplified |
| **Levers** | Taxes per tier; sell, buy, or neither for each good; the reserve; pausing a building; answering the crown; game speed (pause, 1×, 2×, 4×) | §5.1, §5.3, §5.4, §9 |
| **Ends** | Complete (every goal held two minutes; retire or keep governing); bankrupt; revolt; abandoned; dismissed by the crown (three requests missed in a row); or the term runs out with a verdict. The reckoning shows the term's chart and chronicle | §8 |
| **Engine** | Road paths cached against a fingerprint of the road network; history and chronicle saved with the town; `pnpm check` drives every end state | §9 |

### What is left for later

Laws and edicts, wages and service funding, loans, tiers 3 and 4,
desirability, fire and sickness, elections, gold and favor, and great works.
Each can be added on top of approval and the crown without changing what is
here.

### What the simulation changed

The bot (`pnpm balance`) played every change before it stayed. These are
the calls it forced:

- **The first year has no winter.** On a 45-minute term, a winter at
  minute 5 sent most towns into a hunger spiral, then debt, then bankruptcy
  by minute 12.
- **Administration grows per home and more gently.** It started at
  homes²/45; a town of settlers went bankrupt by minute 15. It is now
  homes × (0.5 + homes/200).
- **Crown requests are sized by what the town makes** of the good in the
  time given, and capped by what it can store. Requests sized by the clock
  asked a small town for 120 fish.
- **Markets do more.** A walker's basket holds 10 of each provision (not
  6), a market's shelf 12, and two walkers can be out at once. With one
  small walker, food reached about half the homes however many fisheries
  there were, which made the game about walkers rather than goods.
- **Bread, cloth, and faith last longer** (90, 180, and 150 seconds), so a
  home can have all three at once and become citizens.
- **Four goals, not five.** "Food in store" fought the markets for the same
  fish; approval already measures whether homes are fed. Goals are a share
  of citizens (30%) and approval (15) on top of residents and coins for the
  land's size.
- **Greed and neglect must lose.** Taxing at 200% still grew towns to 40,000
  coins, so taxes now weigh more on approval (0.6 a point) and low approval
  empties homes faster. A town left to itself sat safe until its term ran
  out, so the crown now dismisses a mayor who misses three requests in a
  row.

### Measured outcomes

Fair land throughout. The sensible bot is a mediocre player: it lays out a
rough street grid, builds chains in fixed ratios, answers the crown when it
can (buying what it lacks), and cuts taxes once only approval stands
between it and a complete town. The greedy bot taxes at 200%, sells
everything, and ignores the crown. The idle bot founds the basics and stops.

| Charter | Mayor | Seeds | Complete | Lost | Ran out |
|---------|-------|-------|----------|------|---------|
| small, 45 min | sensible | 8 | 1 (minute 40) | — | 7 |
| medium, 60 min | sensible | 8 | 1 (minute 45) | — | 7 |
| large, 90 min | sensible | 4 | — | 2 bankrupt (61, 89) | 2 |
| medium, 60 min | greedy | 4 | — | 3 in revolt, 1 dismissed (19–22) | — |
| medium, 60 min | idle | 4 | — | 4 dismissed (22) | — |

(Measured again after the simulation was made faster, which changed how
often carriers are sent out; the large row is from before that change.)

So a careless mayor loses, a decent one wins small towns and comes close
on larger ones, and a player who lays out tighter chains than the bot
should complete medium and large towns. Most "ran out" terms ended within
one or two goals, nearly always the share of citizens or the coins.

**How the pressure builds** (sensible mayor, medium land, 60 minutes,
averaged over the 8 seeds every 10 minutes):

| Minute | Residents | Citizens | Coins | Costs ÷ income | Administration a minute | Approval | Homes fed |
|--------|-----------|----------|-------|----------------|-------------------------|----------|-----------|
| 10 | 163 | 0 | 224 | 0.73 | 39 | 25 | 58% |
| 20 | 230 | 5 | 237 | 0.95 | 70 | 18 | 48% |
| 30 | 284 | 45 | 401 | 0.72 | 89 | 17 | 45% |
| 40 | 321 | 39 | 847 | 1.22 | 106 | 15 | 44% |
| 50 | 355 | 61 | 1545 | 1.03 | 114 | 20 | 48% |
| 60 | 335 | 49 | 1802 | 1.34 | 118 | 15 | 38% |

Costs climb from about three quarters of income to more than all of it,
administration triples, and fewer homes are fed as the town spreads. Each
new year's winter pulls the curve down before spring lets it recover. On
large land over 90 minutes the same shape stretches out: administration
grows from 27 to 226 coins a minute.

Reproduce with `pnpm balance -- --size medium --term 60 --seeds 8` (a few
minutes a seed headless; split seeds across processes with `--from`).

## 1. What we have, and how it holds up over a long run

### What works well already

- **The core loop is complete and readable.** Roads, homes, gatherers,
  workshops, carriers, service walkers, needs, two home tiers, taxes,
  upkeep, and selling to traders.
- **The simulation is deterministic.** It uses integer state, a fixed 60 Hz
  step, and a seeded `Rng`. It is fully snapshotable and validated on load.
  This is the right base for seeds, scenarios, replays, and a headless
  balance bot.
- **`pnpm balance` plays the real simulation headless.** It is the most
  valuable tool for tuning long sessions, and every phase below should
  extend it.
- **Status reasons are clear:** `unconnected`, `unstaffed`, `starved`,
  `blocked`. Players can see why a building has stopped.

### Measured: 90-minute bot runs

`pnpm balance -- --seeds 3 --minutes 90` with today's content, at 100% tax:

| | Result |
|---|---|
| Residents at the end | 114 on average, of whom 2 are citizens |
| First citizens | Never, never, minute 12 |
| Coins at the end | 10,240 on average, still rising at +109 a minute |
| Lowest coins / minutes in debt | 46 / 0 |
| Homes supplied | Food 64%, cloth 38%, faith 63% |
| Most common problems | Quarry starved for 93 of 90 min/seed (the problem minutes are summed over every quarry, so they can exceed 90), sawmill blocked 73, fishery blocked 68 |

Seed 1000, minute by minute:

- By minute 5 the town has 19 homes, 60 settlers, and 16 buildings.
- By minute 90 it has 21 homes, 72 settlers, and the same 16 buildings.
- Coins rise in a straight line, from 98 to 5,675.
- From minute 20 on, the quarry is starved: the rocks within its reach are
  gone.

**The town is finished at minute 5, and the next 85 minutes change nothing.**

Part of this is the bot itself. It only builds homes when it is short of
workers or food reaches 70% of homes, and it never builds the mill, so its
bakery stays starved. Even so, nothing in the game pushes back. Coins pile
up, and there is no reason to do anything else.

Headless, the simulation runs at about 34× real time on a 32 × 32 map. A
90-minute seed takes about 2.6 minutes, so a 10-seed sweep of 90-minute games
takes about half an hour.

### What breaks or flattens past about 30 minutes

I read this from the code (`content.ts`, `sim/*.ts`, `mapgen.ts`). The bot
runs above back up findings 1–5. The other numbers are back-of-envelope
estimates.

| # | Finding | Where | Effect on a 90-minute game |
|---|---------|-------|----------------------------|
| 1 | **Nothing is left to reach after the citizens' tier.** There are two tiers, and the last unlock is mine/smithy at 10 citizens. | `content.ts` `home.tiers`, `unlock` | The town plateaus around minutes 25–35, and the rest of the session is waiting. |
| 2 | **Coins have no sink late in the game.** A citizens' home pays about 29 coins a minute (8 × 3.6). Upkeep is a flat 2–12 a minute per building. | `town.ts` `taxOf`, `content.ts` `upkeep` | The treasury grows without limit, and money stops being a decision. |
| 3 | **Trade pays a fixed price with unlimited demand.** A sheep farm makes about 7.5 wool a minute from nothing, which sells for about 15 coins a minute against 5 upkeep. | `Collect` in `town.ts` | Building more raw-goods farms becomes a money printer that is never answered. |
| 4 | **Debt has no consequence.** The treasury can go negative and everything keeps working. The bot tracks `debtMinutes`, but the game ignores it. | `Collect`, `ApplyEdits` | The town cannot decay economically, so "completely decayed" is not a possible outcome. |
| 5 | **Stone and ore run out, and the town is never told.** There are about 3 stone outcrops and 2 ore outcrops, each 3–6 rocks of 40. Stone is on the default sell list with a reserve of 25, so it is quietly sold off. Ore is the only way to get tools, and tools are only used for building. | `mapgen.ts`, `ROCK_AMOUNT`, `trade.sells` | Depletion arrives without warning around minutes 30–50. After that you can build no more mills, bakeries, or weavers, and nothing in the game explains why. |
| 6 | **Workers are one global pool, filled in the order buildings were placed.** Settlers and citizens can do any job, and distance does not matter. | `AssignStaff` | The player cannot set priorities in a labour crisis. Upgrading homes never costs you workers. |
| 7 | **`connected` only checks for a road at the door, not a route to the town hall.** A home on a road that does not reach the hall still fills with residents and counts toward the workforce, but pays no tax. | `sim/shared.ts` | Free workers come from isolated road islands, which is confusing and exploitable. |
| 8 | **Homes have only one pressure: needs.** There is no approval, no emigration spiral, no fire, no disease, and no wear. | `Households` | The town can only fail slowly, by running out of food. |
| 9 | **History is kept in the page (`host.ts`) for only the last 10 minutes,** and it is not saved. | `host.ts` `HISTORY = 150` | There is no way to show the arc of a 90-minute game at the end. |
| 10 | **Time controls exist only in the console.** `town.advance` is dev-only. | `main.ts` | Long sessions need pause and 1×/2×/4× speed in the UI. |
| 11 | **Pathfinding cost grows with map size.** `Dispatch` runs a full BFS (`reach`) for every sender with a free carrier, every step, and allocates two `Int32Array(GRID²)` each time. | `logistics.ts`, `grid.ts` | This is fine on a 32 × 32 map. On a 64 × 64 map with about 200 buildings it is roughly 16 times the work, enough to matter at 4× speed. |
| 12 | **`GRID = 32` is a compile-time constant.** The grid arrays and `key()` all assume it. | `iso.ts`, `grid.ts` | Choosing a map size per session needs this to become a runtime value. |

**Bottom line:** the simulation is stable, with nothing that crashes or
leaks that I could see. It is **too stable**. It has no late-game goals, no
sinks, and no way to fail, so a 90-minute session would be about 30 minutes
of game and 60 minutes of idling.

---

## 2. What similar games do, and what they leave out

| Game | Borrow this | Why it fits Inkline Town |
|------|-------------|--------------------------|
| **Anno 1800 / 1404** | Five or more population tiers, each with its own basic and luxury needs. **Each tier's jobs need workers of that tier.** NPC traders buy and sell. Quests. A newspaper that can be bent with propaganda. | Tier-specific workforce makes upgrading homes a real trade-off, and the quests give structure. |
| **Caesar III / Pharaoh / Zeus** | Walker coverage (we already have this). **Desirability** of land drives home evolution. Fire and collapse risk is handled by walkers. **Requests from Rome** with a deadline and a "favor" score. A wages slider. Festivals. | This matches our walker model closely. Requests give the mayor outside pressure. |
| **Banished / Farthest Frontier** | Tools and clothes **wear out**. **Seasons**, so you stockpile before winter. Disease, fire, and starvation spirals. Nomads arrive when you are doing well. | Wear and seasons are the sinks and rhythm a long session needs. |
| **Tropico** | **Edicts** that cost coins and change behaviour. Factions with approval. **Elections at intervals.** A per-building budget. | This is the most literal "be the mayor" game. Edicts are cheap to build and deep to play. |
| **Frostpunk** | A **book of laws**: mutually exclusive choices with a cooldown and moral weight. Hope and discontent meters. **Scheduled crises** that you can see coming. | Laws make it feel like you run the town and do not just build it. A known crisis gives the session an arc. |
| **Against the Storm** | **Designed for one sitting.** Reputation races against impatience, **orders** (contracts) you choose from, cornerstone perks offered at intervals, hostility that climbs over time. | This is the closest model to "one game of 60–90 minutes with a real ending". |
| **Foundation / Manor Lords** | Mandates from estates (crown, church, merchants), each with its own reputation. Approval governs growth. | Requests from more than one faction make for interesting conflicts. |
| **Cities: Skylines / SimCity** | **Budget sliders per department** (service funding changes coverage). Loans with interest. | This is the mayor's desk. Our service walkers already have range and interval to scale. |

### What these games leave out, and where we can stand apart

1. **A session length that is designed in.** Most city builders are open-ended,
   and only Against the Storm paces a run on purpose. A "charter" that fixes
   the map size and length, and tunes pacing to match, is rare.
2. **An ending that tells the story.** Few games end a run with "here is
   what your town became, and the three decisions that did it". A
   **chronicle** (§8) is cheap for us to build, because the simulation is
   deterministic and every edit already passes through one queue.
3. **Clear cause and effect.** Anno and Tropico hide why people leave. We
   already show status reasons per building. We can extend that to approval
   ("−12 taxes, −8 no faith, +5 festival").
4. **Politics with memory.** Tropico's promises are shallow. We can keep a
   ledger of petitions you accepted or ignored and requests you met or missed,
   and let it come due later.

---

## 3. Setting up a session: the town charter

A new-game screen, which replaces the bare `newTown` seed:

| Choice | Options | What it changes |
|--------|---------|-----------------|
| **Land** | Hamlet 32² · Village 48² · Town 64² | Grid size, and the number of forests, outcrops, and lakes, all scaled to area. |
| **Term** | 45 · 60 · 90 minutes (game time at 1×) | Year length, event cadence, unlock thresholds, the target for each era, and when the final reckoning happens. |
| **Ambition** | Gentle · Steady · Hard | Starting coins, request deadlines, how hard events hit, and how harsh debt is. |
| **Seed** | Number or random | Same land, same events. You can share a seed as a challenge. |
| **Mandate** (optional) | "Reach 400 residents", "Never go into debt", "Build the cathedral", "Trade city: earn 50% of income from trade" | An optional win objective on top of the score. |

Suggested defaults: **Village 48² + 60 min** and **Town 64² + 90 min**.

**Under the hood:** add a `Charter` resource
(`{ size, termTicks, ambition, mandate }`). It is saved with the snapshot.
`content.ts` numbers that depend on pacing read from a function of the
charter instead of constants. The balance bot gets matching `--size` and
`--term` flags.

---

## 4. The arc of a session

The 90-minute version is shown here. The other lengths compress the eras
proportionally.

| Era | 90-min term | What unlocks | What pushes back |
|-----|-------------|--------------|------------------|
| **Founding** | 0–15 | Today's start: wood, planks, fish, stone, settlers. | Nothing serious. Learn the land. The first small request from the crown arrives. |
| **Growth** | 15–40 | Citizens (today's tier 2), farm chain, cloth, chapel. **Edicts unlock.** | The first winter (§6.2). Stone runs low. The first fire. |
| **Prosperity** | 40–70 | **Tier 3 burghers** (beer, furniture, school, tavern), trading post with imports, guild hall, loans. | Tools wear out. Larger requests. Sickness. The first **election** (about minute 45). |
| **Legacy** | 70–90 | **Tier 4 patricians** (wine or jewelry, glass, theatre). **A great work** (cathedral or town walls, built in stages). | A hard winter, an approval squeeze, and a final election. The final reckoning comes at the end of the term. |

The aim is that every era adds **a new need, a new lever, and a new
pressure**, so the player is never just waiting.

---

## 5. The mayor's desk: levers

Most of these already have a path in the code: they become new `Edit`
types in `ui.ts` and fields on `Policy` or new resources in `schema.ts`.
They are applied in `ApplyEdits` and read by systems.

### 5.1 Treasury and budget

- **Taxes per tier** (we already have this). Extend it to the new tiers.
- **Wages:** one slider at 75%, 100%, 125%, or 150%. It multiplies the
  labour part of upkeep. Higher wages raise approval and speed up work (a
  multiplier on the `Work` progress increment). Lower wages raise the risk of
  strikes.
- **Service funding by category** (services, storage, crafts, and so on):
  50%, 100%, or 150%. It scales walker `range` and `interval` (`Service`) and
  carrier count. Underfunded markets reach fewer homes.
- **Loans:** borrow 500, 1,500, or 4,000 coins at about 10% interest per
  "year", repaid automatically from the ledger. This is the honest way to
  fund a great work, and the way a reckless mayor sinks the town.
- **Debt consequences**, which fix finding 4:
  - Below 0, wages go unpaid and approval falls each minute.
  - After N minutes in debt, buildings go on strike (`Status: "strike"`) at
    random.
  - After the bankruptcy threshold, the crown appoints a steward. The
    session ends early as **Abandoned**, or it goes on under hard terms.

### 5.2 Laws and edicts

A small law book: about 12 to 16 edicts, each with an enact cost, a running
upkeep, an effect, and an approval swing for each tier. Some come in
mutually exclusive pairs. Each has a 3-minute cooldown, so a change has to
stick. Examples:

| Edict | Effect | Cost |
|-------|--------|------|
| Rationing | Food lasts 1.5× longer (`home.lasts`). | Settlers' approval −10. |
| Long shifts / Day of rest (exclusive) | +25% production / +approval and +faith. | −approval / −production. |
| Free bread | Market walkers hand out bread even to homes that are not low. Approval +. | Its upkeep is the price of the bread. |
| Building code | Fire risk halved. | Homes cost +1 stone. |
| Forest protection | Lumberjacks fell only in forests with a forester nearby. Stops clear-cutting. | Wood output −. |
| Open gates / Closed gates (exclusive) | Immigration ×1.5 / emigration halved, and immigration ×0.5. | — |
| Tariffs | Trade price +20%. | Traders visit less often. |
| Guild charter | Workshops hold more (`cap` +4) and make batch +1. | Burghers' approval +. Settlers' approval −. |
| Festival (one-off, 2 min) | Large approval boost, and needs count as met. | Coins, plus bread and cloth. |
| Night watch | Crime and fire risk −. | Upkeep. |
| Tithe | +10% of taxes go to the chapel, and faith lasts longer. | Settlers' approval −. |

Edicts are content, so they belong as plain data in `content.ts`, beside
`kinds`, under an `edicts` record. A `Laws` resource holds the active set.

### 5.3 Work and production

- **Priority and pause per building**, which fixes finding 6. In the building
  panel there is a high/normal/low priority and a pause toggle. `AssignStaff`
  fills high priority first. A paused building has no upkeep for staff. This
  is the cheapest and most-wanted lever in every game in this genre.
- **Workforce by tier, from Anno.** Workshops above tier 1 need workers of that
  tier (bakery and weaver need citizens, brewery needs burghers). Upgrading
  every home then starves the fisheries. This is a lever and a puzzle at once.
- **Jobs must be reachable by road**, which fixes finding 7. A home only adds
  to the pool for workplaces on its road network.

### 5.4 Trade

- **Import as well as export.** For each good there are three choices: sell
  above the reserve, buy below a floor, or do nothing. Buying is how you get
  ore and stone once the land runs dry.
- **Prices that respond to the market**, which fixes finding 3. Each good's
  price drifts toward its base price and drops as you sell in volume. When
  the town floods a good, its price sinks. A small random walk, from the
  seeded `Rng`, adds life.
- **Trading post or harbour building.** Unlocked in Prosperity, it raises
  `TRADE_LOAD` and enables imports. Without it you can only sell surplus
  through the town hall.
- **Caravans and ships**, as events (§6.4): a visiting merchant wants 40 cloth
  within 3 minutes at double the price.

### 5.5 Gold and favor

- **Gold** is a luxury chain: gold ore (a rare deposit, found by a
  *prospector*), then a *mint*, which turns it into coins at a good rate, or a
  *goldsmith*, which makes jewelry for tier 4. It gives the late game a
  valuable, finite resource to fight over.
- **Favor** is a second, political currency from the crown and the guilds. You
  earn it by meeting requests. You spend it on charters (a new deposit
  surveyed, a tax holiday, permission for a great work) or to cancel a bad
  event. Missing requests costs favor, and favor below zero brings sanctions.

---

## 6. Pressures: how a town can decay

Without these, growth is the only outcome. Each one is a small system in
`sim/`, and each has a lever that answers it.

### 6.1 Approval (the core of being mayor)

Each home gets an `approval` value from −100 to +100, recomputed each settle
from these inputs:

- the tax rate (we already have `appealOf`)
- wages
- needs met
- active edicts
- events
- desirability of the land around it (§7.3)
- crowding
- unemployment

Approval replaces `appealOf` inside `capacity`, and it also drives:

- **Immigration:** when the town's average approval is above a threshold and
  there is free housing, new homes fill faster. A "nomads arrive" event comes
  at high approval.
- **Emigration:** below 0, residents leave even when their needs are met.
- **Unrest:** below −40 for long enough, a home's workers go on strike or
  there is a riot. Riots damage buildings and make walkers stop.

The town panel shows a breakdown, for example "Approval 34: taxes −12,
faith +8, festival +10, crowding −4".

### 6.2 Seasons

There is one year every 10 minutes on a 90-minute term, or every 7 on a
60-minute term, with a winter of about 25% of each year.

- **In winter,** fields do not grow (`Grow`), fishing is half speed, and homes
  gain a **firewood** need. Firewood comes from a wood-cutter or charcoal
  burner that turns wood into firewood.
- **In spring,** fields and fishing return.

This gives the run a rhythm, makes you stockpile before winter, and makes
storage capacity matter. It is visible in advance: the top bar shows a season
dial.

### 6.3 Wear and sinks

These fix findings 2 and 5:

- **Tools wear out.** Every workshop uses one tool every N jobs, or works at
  half speed without. The smithy becomes a permanent industry and ore a real
  constraint.
- **Building condition.** Condition falls slowly, and an *engineer/builder*
  walker repairs it using planks and stone. A neglected building drops in
  output and eventually collapses into a ruin you have to clear. **This is the
  main material sink** and the main visible decay.
- **Upkeep scales with size.** The town hall's administration upkeep grows
  with the number of homes, which brings in the classic "administration cost"
  curve.
- **Depletion is visible.** Outcrops show how much is left. A toast fires at
  25% and when exhausted. Stone is removed from the default sell list.

### 6.4 Events, requests, and petitions

There is an **event deck** drawn with the seeded `Rng`, on a cadence set by
the charter (about every 3–5 minutes). Each event is plain data
(`{ id, weight, era, condition, choices[] }`) with two or three choices, so
you are deciding as the mayor and not just reading a popup.

- **Crown requests:** "Send 30 planks within 4 min" pays favor and coins.
  Ignoring one costs favor. They grow with each era.
- **Petitions from residents:** "The east quarter wants a market within 2 min"
  or "Lower the settlers' tax". Accepting creates a promise you have to keep.
  Breaking it costs a large amount of approval.
- **Merchant offers:** "Buy 50 wool at 3× within 3 min" or "A sale on ore
  today".
- **Hazards:** fire (spreads to neighbours unless a fire watch walker or a well
  is near), sickness (stops homes without a healer's coverage), a harsh winter
  (winter lasts longer), and a poor harvest.
- **Good fortune:** a new deposit is found, a travelling scholar appears, or
  nomads arrive.
- **Elections** happen in the middle of the term and at the end. Average
  approval decides whether you keep office, which gives a bonus, or face a
  hostile council: one edict slot fewer and tax changes locked for 5 minutes.

An event can be postponed or ignored. Each event writes a line to the
chronicle (§8).

---

## 7. New content

Everything here is plain data in `content.ts` plus art, which fits how the
project is built now.

### 7.1 Tiers

| Tier | Needs | Pays/resident | Workers for |
|------|-------|---------------|-------------|
| 1 Settlers (today) | Food | 1.8 | Gathering, fishery, sawmill |
| 2 Citizens (today) | Bread, cloth, faith | 3.6 | Bakery, weaver, smithy, mill |
| **3 Burghers** | + beer, furniture, education (school walker), tavern | ~6 | Brewery, carpenter, glassworks, trading post |
| **4 Patricians** | + wine or jewelry, glass, theatre | ~10 | Mint, goldsmith, great work |

### 7.2 Goods and chains (new)

- **Firewood:** wood, then the charcoal burner. A winter need.
- **Beer:** barley from the farm, then a brewery. The farm gets a crop choice
  of wheat or barley, which is a small lever of its own.
- **Furniture:** planks plus tools, made by a carpenter.
- **Glass:** sand from the lakeshore, then a glassworks.
- **Wine:** a vineyard on a hillside or by water, then a winery.
- **Gold:** a gold deposit, then a mint (coins) or a goldsmith (jewelry).
- **Meat:** a pig farm. A second food source, so food has some variety.

### 7.3 Buildings and services

- **Service walkers:** a well and fire watch (fire), a healer (sickness), a
  builder's yard (repairs, §6.3), a school (education), a tavern, and a
  theatre.
- **Civic:** a tax office (extends the town hall's tax reach and adds a second
  collection point), a granary (food storage that does not spoil), a trading
  post or harbour, and a guild hall (unlocks the guild edicts).
- **Desirability, from Caesar:** gardens, statues, and plazas raise the
  desirability of nearby land. Workshops and quarries lower it. Homes need
  enough desirability to reach tier 3 or 4. This makes the layout itself a
  decision, which today's free-for-all placement lacks.
- **A great work:** a cathedral, a town wall, or a harbour lighthouse. It is
  built in three or four stages, each a large materials site, and gives
  prestige, favor, and a large score bonus. It is the endgame sink for coins
  and goods.

---

## 8. End states: winning, losing, and the town chronicle

A session ends in one of three ways:

- **Victory:** you finish the town and retire.
- **Defeat:** you are removed or the town is abandoned.
- **The term runs out:** a final reckoning gives a verdict.

Victory and defeat are checked continuously by a `Fate` system at the end of
`simulate`. Its state, `{ status, warnings, since }`, is a saved resource, so
a reload never resets a crisis.

### 8.1 Victory: "the town is complete"

All of the following must hold **at once, for 3 minutes in a row**. The
3 minutes stop a lucky moment from counting. Targets scale with the
charter's map size, and the 64² values are shown.

| Condition | Target (64²) | Why |
|-----------|--------------|-----|
| **Rank** | City: 600 or more residents, weighted by tier | You grew the town as far as it goes. |
| **Housing** | At least 85% of possible home lots built and occupied, and at least 60% of homes at the top tier unlocked by the charter | "You got all the houses": the land is used, and the homes are good ones. |
| **Wealth** | Treasury of 5,000 or more, no loans outstanding, and net income of 0 or more a minute | You can afford the town you built. |
| **Supplies** | At least 100 of every food good and 50 of every need good in storage, or a granary rated full | The town would survive a bad winter without you. |
| **Approval** | Town average +40 or more, with no home below 0 | People are happy, not just numerous. |
| **Great work** (Steady and Hard only) | Completed | It is the capstone. |

When all of them hold, the top bar shows a **"The town is complete"**
countdown. When it finishes, there are two choices:

- **Retire as mayor:** the session ends as a **Victory**, with the score
  from §8.3 plus a bonus for minutes left on the term. Finishing early scores
  higher.
- **Keep governing:** the game carries on as a sandbox. The victory stays
  recorded, and the final score still counts at the end of the term.

The town panel shows a **checklist** of the conditions, each with its current
value against the target, so the player always knows how far from done they
are.

### 8.2 Defeat: "the mayor is removed"

There are four ways to lose. Each one escalates in steps, shown in a crisis
meter on the top bar and in toasts, so **defeat is never a surprise**. Each
can be recovered from until the last step.

| Way to lose | Warning | Danger | Removed when |
|-------------|---------|--------|--------------|
| **Bankruptcy** | Treasury below 0: wages unpaid and approval −5 a minute | Below −500 (scaled to income), or 2 minutes in debt: buildings strike at random and no new building is allowed | **3 minutes below the debt limit**, or a loan payment missed twice |
| **Revolt** | Town average approval below −20 | Below −40: riots in the unhappiest homes damage nearby buildings, and walkers stay home | **Average approval below −50 for 3 minutes**, or riots in 25% of homes at once |
| **Abandonment** | Residents below 50% of the peak | Below 25% of the peak: traders and the crown stop visiting | **Residents below 10% of the peak** (once the peak was 40 or more), or zero residents for 2 minutes after minute 10 |
| **Crown's displeasure** (with requests, §6.4) | Favor below 0 | Favor below −50: taxes are seized each minute | **Favor at −100** |

Each step sends a line to the chronicle. The danger step names the fastest
way out. For example: "Bankrupt in 1:40. Cut wages, pause the smithy (−12 a
minute), or take a loan."

On removal, the session ends as a **Defeat**, with the reason, the minute it
happened, and the timeline leading up to it.

**On the debt limit:** a flat −500 would be too harsh for a large town and
too soft for a small one. Scaling it to about 5 minutes of gross income gives
the player room to borrow against the future without a death spiral being
free.

### 8.3 Final reckoning (the term runs out)

At the end of the term (or at victory or defeat):

1. **Town rank:** Hamlet, Village, Town, Market Town, or City, by population
   weighted by tier.
2. **Verdict:** **Victory** or **Defeat** when §8.1 or §8.2 ended the game.
   When the term ran out instead, it is Flourishing, Prosperous, Holding, or
   Declining. That verdict compares the final 10 minutes with the peak and the
   trend, so a town that was large but is collapsing reads as **Declining**.
3. **Legacy score:** residents × tier weight, plus great works, favor,
   treasury, mandate met, and approval, minus debt and ruins.
4. **Timeline:** coins, residents by tier, approval, and favor over the whole
   game, with markers for events, edicts, and elections. This needs history
   kept **inside the simulation** and saved with the town, which fixes
   finding 9. Store a sample every 15 seconds of game time: 360 samples for 90
   minutes, which is small enough to save.
5. **Chronicle:** about ten generated lines covering the turning points, for
   example "Minute 38: the harsh winter and the bread shortage. Approval fell to
   −20; 46 settlers left." It is built from an append-only `Chronicle` resource
   that systems write to.

---

## 9. The engine: holding up at 64² and 4× speed

1. **A runtime grid size** (finding 12). Move `GRID` into the `Charter` and
   size `GridBuilder` arrays from it. `key()` takes the width. Scale `mapgen`
   features by area.
2. **Cached road reach** (finding 11). Keep a `RoadVersion` counter that goes
   up when a road is added or removed. Cache `reach` results per source door
   set until the version changes. Reuse the `Int32Array`s. Also, `Dispatch`
   should only consider senders whose stock changed, or round-robin a slice
   of them each tick. Moving goods 1–2 steps later is invisible to the player.
3. **Speed controls in the UI** (finding 10): pause, 1×, 2×, and 4×, which run
   `simulate` that many times a frame. Keep the fixed step.
4. **Autosave** every 2 minutes of game time, plus a "last three autosaves"
   ring in localStorage. A 90-minute run must survive a closed tab.
5. **Invariant checks.** In dev, and in the bot, check every N ticks:
   - no negative stock
   - goods conserved through carriers
   - walkers belong to existing buildings
   - entity count is bounded
   - residents do not exceed capacity
6. **Extend the balance bot:**
   - `--term`, `--size`, and `--ambition` flags
   - The bot's personalities: **sensible** (today's), **greedy** (200% taxes,
     sells everything), **neglectful** (no services, ignores requests), and
     **ambitious** (heavy loans, a great work)
   - Pass bands per charter. For example, on Town 64² with a 90-minute term:
     - The sensible bot should reach **Victory** between minutes 60 and 90
       on at least 6 of 10 seeds, and finish **Prosperous** or better on the
       rest.
     - The greedy bot should lose, to **Revolt** or **Bankruptcy**.
     - The neglectful bot should lose to **Abandonment** before minute 70.

     If victory comes before minute 45, it is too easy. If the greedy bot
     thrives, a pressure is missing.
   - The bot reports how each run ended (victory, defeat and its reason, or
     the verdict) and at what minute, in place of today's flat "residents at
     the end".
   - Pacing checks: first citizens by minute ~12, first burghers by minute
     ~45, first patricians by minute ~70. These targets scale with the term.

---

## 10. Order of work

Each phase can be played on its own and is checked with the bot before the
next phase starts.

**Phase 1: long sessions work at all** (engine and the clearest fixes)
- **End states (§8):** the `Fate` system, the victory checklist, and the
  bankruptcy and abandonment defeats with their warning steps. Revolt and the
  crown's displeasure wait for approval and favor in Phases 2–3. Until then,
  the victory conditions use only rank, housing, wealth, and supplies.
- Speed controls and autosave.
- The `Charter` resource and new-game screen (size + term). Runtime `GRID`.
- Cached reach and Dispatch throttling.
- History and chronicle saved in the simulation, plus an end-of-term reckoning
  screen.
- Debt consequences. Building pause and priority. Visible depletion. Stone off
  the default sell list. Jobs reachable by road.
- Bot: `--term 90 --size 64`, invariants, and the greedy and neglectful
  personalities.

**Phase 2: the mayor's desk**
- Approval per home, with the breakdown UI. Emigration and immigration.
- Wages and service funding.
- Laws and edicts (about 8 to start).
- Import trade, market-driven prices, and loans.

**Phase 3: pressure and rhythm**
- Seasons with winter, and firewood.
- Tool wear and building condition, with the builder's yard.
- The event deck: crown requests, petitions, merchant offers, fire,
  sickness. Favor.
- Elections.

**Phase 4: depth for the second half**
- Tier 3 (burghers) and the beer, furniture, school, and tavern chains.
- Desirability.
- Tier 4, gold, mint, and the great work.
- Mandates.

**Phase 5: polish**
- Advisors that point at the biggest problem ("Your bakeries lack tools").
- Seed challenges. Chronicle styled as a town newspaper.

### First step

Phase 1's **end states, speed controls, the charter, debt consequences, and
building priority** come first. With an end state, the 90-minute bot run
gives a measurable target ("victory around minute 60–90; greedy play loses")
to tune every later phase against. The bot already runs on the npm bevy-ts
0.5.0 packages.
