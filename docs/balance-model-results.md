# Balance model results

Generated from PR #3 at 8de46be33c351052af64326f034888e0f09092a8. No shipped parameter changes. Rules SHA-256: c2654cafa41aad51176030ba4f2ec484d61bfd372f9d8a247284a64855ab3c7c.

## First citizens, with unchanged rules

An authored starting district pays for its roads and homes, then uses ordinary construction edits and the UI-supported tool reserve of 10. The real game first reaches citizens at 336 seconds; the coarse model estimates 255. At ten minutes the game has 32 citizens, 55 residents and 1149 coins. The forecast has 32 citizens, 61 residents and 1467 coins. This is a progression fixture, not a generated-map victory claim.

## Production capacity

Outputs per minute with full crews, sufficient inputs, output room and maintained condition. Apprentice rows deliberately include the actual tick alignment. These are workshop ceilings, not delivered food.

| Building | Own crew + tool | Apprentices + tool | Apprentices, no tool |
|---|---:|---:|---:|
| fishery | 15 | n/a | n/a |
| farm | 15 | n/a | n/a |
| mill | 10 | 7.5 | 5 |
| bakery | 20 | 15 | 10 |
| sheep | 7.5 | n/a | n/a |
| weaver | 7.5 | 5.63 | 3.75 |
| sawmill | 12 | 9 | 6 |

## Useful constraints

- The first citizen chain alone costs 870 coins and 3 construction tools. Its 3 wearing workshops also need working tools. Total 6, versus 8 at a fair start. Raw industry adds more tool demand.
- Settlers accept cloth, and bread is preferred for food. Supplying a broad settler district can consume goods intended for citizen upgrades.
- Promotion changes the workforce: citizens cannot fill settlers' jobs. Keep raw-production households within commuting distance.
- Build mills/bakeries before farms can plant on their future plots. A previous ordering failed with the real game's “No room there”; the revised verified schedule has 0 rejected-action messages.
- An unmaintained building loses half speed after about 33 minutes. After it crosses the repair threshold there are 200 seconds before half speed.
- The original sensible bot's minute-30 town has 130 completed homes. Its pooled cloth capacity is 20.63/min against 43.33..86.67/min to supply every home. 4 homes satisfy the desirability gate even if all citizen needs were supplied. Even granting burghers wherever desirability permits, citizen housing is capped at 32, below the 96 citizens required at the population goal.

## Winters

Fully staffed, maintained fisheries; homes consume per household. Each figure excludes spoilage and delivery loss.

| Winter | Duration in a 60-minute term | Fish/min/fishery | Homes supported, late refresh | Homes supported, frequent refresh |
|---|---:|---:|---:|---:|
| mild | 3 min | 11.25 | 7.5 | 3.75 |
| normal | 3 min | 7.5 | 5 | 2.5 |
| hard | 4.5 min | 3.75 | 2.5 | 1.25 |

## Verification

12/12 controlled comparisons pass. Production tolerances allow one incomplete job at the window boundary; ledger rounding is exact. Service checks compare finite-path mathematics to actual game excursions.

| Check | Expected | Actual | Allowed error | Pass |
|---|---:|---:|---:|---|
| collection-rounding | 48 | 48 | 0 | true |
| shared-carrier-capacity | 27.27 | 24 | 8 | true |
| bakery/citizens/tool/new | 10 | 9 | 1 | true |
| bakery/apprentices/tool/new | 7.5 | 7 | 1 | true |
| bakery/apprentices/no-tool/new | 5 | 4 | 1 | true |
| bakery/citizens/no-tool/worn | 2.5 | 2 | 1 | true |
| weaver/citizens/tool/new | 7.5 | 7 | 1 | true |
| weaver/apprentices/tool/new | 5.63 | 5 | 1 | true |
| weaver/apprentices/no-tool/new | 3.75 | 3 | 1 | true |
| weaver/citizens/no-tool/worn | 1.88 | 1 | 1 | true |
| straight-service-hit | 1 | 1 | 0.05 | true |
| branched-service-hit | 0.44 | 0.4 | 0.14 | true |

## Practical suggestions

Concentrate bread, cloth and faith in a small desirable district before scaling the whole town. Budget working tools separately from construction tools. Keep a settler workforce near farms and resource gatherers. Reserve workshop plots before agriculture expands. Size winter food capacity from household demand and storage losses, not resident count or summer fishing. Place repair services before condition crosses the half-speed threshold.

Use static constraints and parameter/configuration search to reject weak designs quickly; verify promising designs and thresholds in the real game. Use the coarse forecast as an estimate with its measured timing and cash errors, not as a precise victory predictor.

## Scope and limitations

- Exact functions and finite-path probabilities are separated from steady-state ceilings and coarse forecasts.
- The construction fixture establishes first citizens on authored flat land, not victory on every generated seed.
- The forecast's revisit gaps, shelf allocation, field placement and equipment distribution are approximations. Calibration errors are reported, not hidden.
- Wild forest regeneration is bounded in steady-state analysis and excluded from the transient finite-tree forecast. Maintenance and disaster constraints are analyzed; stochastic disasters and repairs are verified in the real game, not reproduced as an exact joint distribution.
