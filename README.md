# Town

A town simulation in the spirit of Anno, drawn in pale isometric line art:
lay roads, house settlers, gather and craft goods, keep homes supplied, and
grow settlers into citizens. Game logic runs on the [bevy-ts](../../bevy-ts)
ECS; Pixi draws it.

```sh
pnpm install
pnpm dev --host --port 5232
pnpm typecheck
```

The bevy-ts packages are linked from `../../bevy-ts` and consumed as source,
so clone [bevy-ts](https://github.com/SandroMaglione/bevy-ts) two levels up
first (for example `gamedev/bevy-ts` next to `gamedev/games/inkline-town`).

## How the town works

- **A new town** is generated land (a lake, forests, stone and ore) with a
  town hall in a clearing, ringed by road, plus starting coins and goods.
- **Coins**: homes the town hall can reach by road pay taxes; traders buy
  the goods the town chooses to sell beyond a reserve; every building costs
  upkeep. Building costs coins up front. The **town** panel (T, or click the
  top bar) shows the treasury, people, supplies, and goods over time, and
  holds the levers: a tax rate per tier (high taxes shrink homes), which
  goods to sell, and how much to keep.
- **Materials** (planks, stone, tools) come from storage: a new building is a
  site until carriers have brought what it costs, then it goes up.
- **Homes** fill with settlers once a road touches them. Settlers need food
  (fish or bread); with bread, cloth, and faith a home becomes a two-story
  citizens' home that holds and pays twice as much.
- **Buildings** need a road at the middle of a side and workers from the
  homes. Gatherers work the land within their reach (trees, rocks, water,
  fields); workshops turn one good into another.
- **Carriers** walk every good along the roads: producers send to whoever
  wants it (a site, a workshop, a market) or else to storage; storage sends
  to whoever wants what it holds.
- **Walkers** from the town hall and markets hand out food and cloth to the
  homes they pass; the chapel's brings faith.
- Larger buildings unlock as the town grows (by residents, then citizens).

## Code

- `src/iso.ts`: the grid and the unit everything is measured in (1/16 cell = 2×1 px).
- `src/content.ts`: goods, building kinds, home tiers, costs, upkeep, taxes: plain data.
- `src/archetypes.ts`: content to components.
- `src/mapgen.ts`: the land of a new town, from a seed.
- `src/schema.ts`: the ECS world: components, relations, resources, services.
- `src/grid.ts`: occupancy, entrances, reach, and road paths.
- `src/sim/`: the fixed-step simulation (no renderer access): edits, work, logistics, walkers, town.
- `src/present.ts`: per-frame interaction, panel, and view sync.
- `src/art.ts`: all drawing.
- `src/ui.ts`, `src/host.ts`, `src/main.ts`: the page bridge, camera, input, panels, and start-up.

The simulation runs on bevy-ts-browser's `FixedLoop` at 60 steps a second,
with integer state and a seeded random resource. Every saved component is
validated, so **save** / **load** snapshot the whole world to localStorage.

In development the console has `town.ui`, `town.runtime`, and
`town.advance(seconds)` to fast-forward the simulation.

## Balancing

`pnpm balance` runs a bot that plays the real simulation headless, the way a
sensible player would, on several seeds, and summarises how the towns did:
residents, coins and where they came from, when citizens first appeared, how
well homes were supplied, and which buildings were stuck and why.

```sh
pnpm balance -- --seeds 10 --minutes 45
pnpm balance -- --tax 150
pnpm balance -- --set kinds.fishery.recipe.seconds=3 --set home.tiers.1.tax=2
pnpm balance -- --seeds 1 --verbose        # minute by minute, what was built, what was left
```
