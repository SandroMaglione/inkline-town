# Balance model results

Generated from PR #3 at d85daeb0dd603bb2331ea3617587ff8311776f94. Current shipped parameters, with no report-time overrides. Rules SHA-256: ab3123a31ccaa327eff54c63532ed318fc298229127c3879e31b2dea52586d9a.

## First citizens, with the current rules

An authored starting district pays for its roads and homes, then uses ordinary construction edits and the UI-supported tool reserve of 10. The real game first reaches citizens at 267 seconds; the coarse model estimates 249. At ten minutes the game has 48 citizens, 82 residents and 1728 coins. The forecast has 48 citizens, 82 residents and 1748 coins. This is a progression fixture, not a generated-map victory claim.

## Production capacity

Outputs per minute with full crews, sufficient inputs, output room and maintained condition. Apprentice rows deliberately include the actual tick alignment. These are workshop ceilings, not delivered food.

| Building | Own crew + tool | Apprentices + tool | Apprentices, no tool |
|---|---:|---:|---:|
| fishery | 15 | n/a | n/a |
| farm | 15 | n/a | n/a |
| mill | 10 | 7.5 | 5 |
| bakery | 20 | 15 | 10 |
| sheep | 10 | n/a | n/a |
| weaver | 10 | 7.5 | 5 |
| sawmill | 12 | 9 | 6 |

## Useful constraints

- The first citizen chain alone costs 870 coins and 3 construction tools. Its 3 wearing workshops also need working tools. Total 6, versus 10 at a fair start. Raw industry adds more tool demand.
- The verified park uses three adjacent flower cells, one fountain and one lamp: 97 coins, 2.65/min upkeep, +6 desirability at the nearest cells, reach 2. Its effects combine with industry and chapel effects; nearby raw industry remains a liability. Place furnishings after the ground exists.
- Cloth reaches existing citizens and settlers on eligible streets. Eligible settlers request bread independently of their food meter; other settlers prefer fish and use bread as a fallback.
- Skilled jobs receive native crews first. Surplus citizens can fill rough jobs at full speed, and settlers can fill skilled jobs at apprentice pace. The road commute still constrains both.
- Build mills/bakeries before farms can plant on their future plots. A previous ordering failed with the real game's “No room there”; the revised verified schedule has 0 rejected-action messages.
- An unmaintained building loses half speed after about 33 minutes. After it crosses the repair threshold there are 600 seconds before half speed.

## Winters

Fully staffed, maintained fisheries; homes consume per household. Each figure excludes spoilage and delivery loss.

| Winter | Duration in a 60-minute term | Fish/min/fishery | Homes supported, late refresh | Homes supported, frequent refresh |
|---|---:|---:|---:|---:|
| mild | 3 min | 11.25 | 11.25 | 5.63 |
| normal | 3 min | 7.5 | 7.5 | 3.75 |
| hard | 4.5 min | 6 | 6 | 3 |

## Verification

12/12 controlled comparisons pass. Production tolerances allow one incomplete job at the window boundary; ledger rounding is exact. Service checks compare whole dispatch rotations to the shared planner, with exact visit fractions.

| Check | Expected | Actual | Allowed error | Pass |
|---|---:|---:|---:|---|
| collection-rounding | 36 | 36 | 0 | true |
| shared-carrier-capacity | 27.27 | 24 | 8 | true |
| bakery/citizens/tool/new | 10 | 9 | 1 | true |
| bakery/apprentices/tool/new | 7.5 | 7 | 1 | true |
| bakery/apprentices/no-tool/new | 5 | 4 | 1 | true |
| bakery/citizens/no-tool/worn | 2.5 | 2 | 1 | true |
| weaver/citizens/tool/new | 10 | 9 | 1 | true |
| weaver/apprentices/tool/new | 7.5 | 7 | 1 | true |
| weaver/apprentices/no-tool/new | 5 | 4 | 1 | true |
| weaver/citizens/no-tool/worn | 2.5 | 2 | 1 | true |
| straight-service-coverage | 1 | 1 | 0 | true |
| branched-service-coverage | 1 | 1 | 0 | true |

## Practical suggestions

Concentrate bread, cloth and faith in a small desirable district before scaling the whole town. Budget working tools separately from construction tools. Keep available workers within commuting distance of farms and resource gatherers. Reserve workshop plots before agriculture expands. Size winter food capacity from household demand and storage losses, not resident count or summer fishing. Place repair services before condition crosses the half-speed threshold.

Use static constraints and parameter/configuration search to reject weak designs quickly; verify promising designs and thresholds in the real game. Use the coarse forecast as an estimate with its measured timing and cash errors, not as a precise victory predictor.

## Scope and limitations

- Exact functions and planned tour coverage are separated from steady-state ceilings and coarse forecasts.
- The construction fixture establishes first citizens on authored flat land, not victory on every generated seed.
- The forecast's revisit gaps, shelf allocation, field placement and equipment distribution are approximations. Calibration errors are reported, not hidden.
- Wild forest regeneration is bounded in steady-state analysis and excluded from the transient finite-tree forecast. Maintenance and disaster constraints are analyzed; stochastic disasters and repairs are verified in the real game, not reproduced as an exact joint distribution.
## Applied tuning and full victories

PR #4's mathematical component is merged into PR #3. These changes apply to the shipped game; the report above supplies no additional overrides. The original victory requirements, including the continuous two-minute hold, remain unchanged.

| Parameter | Before | Shipped |
|---|---:|---:|
| Food need lifetime | 60 s | 90 s |
| Bread need lifetime | 90 s | 120 s |
| Cloth need lifetime | 180 s | 240 s |
| Faith need lifetime | 150 s | 180 s |
| Sheep and weaver job interval | 8 s | 6 s |
| Starting tools, fair / harsh | 8 / 6 | 10 / 8 |
| Hard-winter fishing multiplier | 0.25 | 0.40 |
| Builder repair threshold | 550 | 650 |

The repair threshold gives builders 600 seconds before condition reaches half speed, up from 200 seconds. Taxes and building costs were not changed in this tuning.

Eligible settlers now request bread independently of their food meter; cloth goes to existing citizens or homes that can promote. Native crews retain priority, then surplus citizens fill rough jobs at full speed. Service walkers rotate through planned tours covering reachable branches. After construction demand, carriers refill operating shelves by their normalized fill level. The model and game share these rules and the patrol planner.

The bot establishes desirable citizen streets earlier, sizes bread and cloth chains for eligible recipients, avoids industry beside those streets and uses bounded purchases through ordinary trade rules when a functioning chain needs help. These results measure the combined rules, numbers and bot policy, rather than isolating one parameter.

## Ranks on generated charters, with upgrades and furniture

The term no longer ends in a single win: a town rises from hamlet to village, town and city as each rank's goals hold for two minutes, and the term plays on to its end. The town rank (`TOWN_RANK`) is the old "complete" town. The sensible bot plays through ordinary edits, with shipped rules and seeded disasters. It now takes a guildhall once a village (and an ovenworks, estate or masonry once a town, where bread, wheat or stone run short), lays in flour before winter, and builds a carpenter once homes are fit for townhouses.

Fifteen 60-minute charters, at `cd186a3` (upgrades and the income goal, with the old bot), at `e610f70` (furniture, and the bot below), and now (a market's walker no longer loses what it brings home; see Furniture, measured, below):

| Charter | `cd186a3` | `e610f70` | Now |
|---|---|---|---|
| medium fair 8919 | town at 45 min | town at 38 min | town at 44 min |
| medium fair 16838 | town at 53 min | town at 28 min | town at 28 min |
| medium fair 24757 | town at 53 min | town at 55 min | town at 43 min |
| medium fair 32676 | village | town at 33 min | town at 32 min |
| medium fair 40595 | hamlet | hamlet | village |
| medium fair 48514 | village | village | village |
| medium fair 56433 | village | town at 36 min | town at 43 min |
| medium harsh 8919 | village | village | town at 53 min |
| medium harsh 16838 | village | town at 46 min | town at 47 min |
| medium rich 8919 | town at 46 min | village | town at 46 min |
| small fair 8919 | town at 27 min | town at 22 min, city at 41 min | town at 22 min |
| small fair 16838 | town at 25 min | town at 24 min | town at 28 min |
| small harsh 24757 | town at 48 min | bankrupt at 41 min | town at 37 min |
| large fair 8919 | hamlet | hamlet | village |
| large fair 16838 | village | village | village |

Now 11 of 15 reach the town rank, against 8 before. The one step back is small fair 8919, which still becomes a town at 22 minutes but no longer a city: this run has no burghers, and like the bot's other turns it diverges move by move from the last. At `e610f70`, the two regressions were the bot's, not a rule hole: on small harsh 24757 its decisions match the old run move for move until minute 24, when a lamp goes down one decision earlier, and the run diverges from there. Large charters outgrow the bot's district planning before and after. No bot run reached burghers: a townhouse needs desirability 12, every service calling, and furniture, which takes deliberate zoning the bot does not do.

Reproduce one:

```sh
pnpm balance --seeds 1 --from 1 --term 60
```

Seeds 8919 and 16838 (medium fair) are permanent regressions in `test/balance-victory.test.ts`: each becomes a village and stands, and reaches the town rank.

## Furniture, measured

`pnpm balance:furniture` plays a street of homes beside the town hall, a market and carpenters across it, in the real simulation, headless. Everything else a townhouse asks (desirability, the three services, bread, cloth, faith, repair) is given, so the run measures furniture alone. Thirty minutes each, medium fair seed 7:

| Homes | Carpenters | Every home a townhouse by | Townhouses held, second half | Made a minute |
|---|---|---|---|---|
| 4 | 1 | minute 5 | 4.0 of 4 | 6.5 |
| 8 | 1 | minute 12 | 8.0 of 8 | 7.4 |
| 16 | 1 | never | 6.1 of 16 | 7.4 |
| 24 | 1 | never | 6.1 of 24 | 7.4 |
| 24 | 2 | never | 15.0 of 24 | 12.2 |

Before the walker fix, 8 and 16 homes made no townhouse in thirty minutes. A market refills while its walker is out, and a walker home with what it did not hand out put it back only up to the shelf's room: a walker home with ten pieces of furniture lost eight. Nearly all furniture was lost that way, none reached the store, and a home pays its rise (2 furniture) from the store. Bread, fish and cloth leaked the same way, less.

One carpenter keeps about eight townhouses (some 96 burghers) furnished. A city on a small charter asks 15% of 270 residents, four townhouses; a medium one, 15% of 480, six. Every citizens' home on a street fit for townhouses takes furniture too, whether or not it is ready to rise, and the walker tops a piece up at half its life, so a home uses one about every 150 seconds: a long street of fine homes needs a second carpenter before the last of them can rise.

Generate fresh model results using the CLI documented in [balance-model.md](balance-model.md). The report above records its source commit and exact rule hash.
