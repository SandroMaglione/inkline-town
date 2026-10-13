# Balance model results

Generated from PR #3 at 619268604f382a5c73b50fc7c4049b90fc63fb07. Current shipped parameters, with no report-time overrides. Rules SHA-256: f3ee5d19da245921f0f6a7ef8ad9eefe92918b02fc9f6b6b1239f9d30963a193.

## First citizens, with the current rules

An authored starting district pays for its roads and homes, then uses ordinary construction edits and the UI-supported tool reserve of 10. The real game first reaches citizens at 267 seconds; the coarse model estimates 249. At ten minutes the game has 32 citizens, 60 residents and 1310 coins. The forecast has 32 citizens, 60 residents and 1374 coins. This is a progression fixture, not a generated-map victory claim.

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
- The verified park uses three adjacent flower cells, one fountain and one lamp: 97 coins, 2.65/min upkeep, +8 desirability at the nearest cells, reach 2. Its effects combine with industry and chapel effects; nearby raw industry remains a liability. Place furnishings after the ground exists.
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
| collection-rounding | 48 | 48 | 0 | true |
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

Three deterministic medium/fair charters ran through ordinary player edits with shipped rules, seeded disasters and no direct state injections:

| Seed | Outcome | End minute | Residents | Citizens | Coins | Approval | Longest goal hold |
|---|---|---:|---:|---:|---:|---:|---:|
| 1000 | won | 22.5 | 384 | 116 | 4948 | 58 | 120 s |
| 8919 | term over | 60 | 271 | 32 | 16067 | 27 | 0 s |
| 16838 | won | 23.5 | 401 | 184 | 4816 | 57 | 120 s |

Before this tuning, the measured seed-1000 baseline ended its 60-minute term with 297 residents, 16 citizens, approval -4 and coins -1. No baseline result was measured for the other two seeds.

The failed charter has enough money but lacks population and citizens. Layout and eligible housing remain limiting factors. Two of three examples winning establishes legal full victory, not a human success rate or a guarantee across maps. Investigate district placement and citizen coverage on seed 8919 before increasing taxes or reducing win goals.

Reproduce the generated runs:

```sh
pnpm balance --seeds 3 --term 60 --json output/balance-rules/results.json
```

Both winning seeds are permanent full-game regressions in `test/balance-victory.test.ts`. Local validation passes: all 37 tests, typecheck, simulation invariants, production build and the documented browser workflow covering placement, save/load, populated towns, camera angles, walkers, phone/touch and reckoning. No hosted CI checks are configured; no production deployment or physical-device validation was performed.

Generate fresh model results using the CLI documented in [balance-model.md](balance-model.md). The report above records its source commit and exact rule hash.
