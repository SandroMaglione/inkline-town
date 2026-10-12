# Town

A town simulation in the spirit of Anno, drawn in pale isometric line art:
lay roads, house settlers, gather and craft goods, keep homes supplied, and
grow settlers into citizens, over one term in office of 45 to 90 minutes
that ends with the town complete, lost, or run out. Game logic runs on the
[bevy-ts](https://github.com/SandroMaglione/bevy-ts) ECS; Pixi draws it.

```sh
pnpm install
pnpm dev --host --port 5232
pnpm typecheck
pnpm check      # every way a term can end, ends it
pnpm balance    # a bot plays terms headless and reports the pressure
```

## Cloudflare release

The game is deployed with [Alchemy](https://alchemy.run/) as a Cloudflare
Worker serving the Vite build. The separate `deploy/` package keeps its
dependencies out of the game, and Cloudflare stores the deployment state.
Saves stay in the player's browser.

```sh
pnpm install --frozen-lockfile
pnpm --dir deploy install --frozen-lockfile
pnpm --dir deploy exec alchemy plan --stage prod --profile admin --no-input
pnpm release --profile admin --yes --no-input
```

Release from an up-to-date `main`. The release command checks the game's
types and simulation and the deployment config, then Alchemy builds and
deploys the game. It prints the live URL; check that the game opens and
save/load works there after each release.

`admin` is the existing local Alchemy Cloudflare profile. On another
machine, use your own logged-in profile or set `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`, then omit `--profile admin`. Keep credentials outside
the repository. Releases run locally; pushing to GitHub does not deploy.

For a temporary preview, run:

```sh
pnpm --dir deploy exec alchemy deploy --stage preview --profile admin
pnpm --dir deploy exec alchemy destroy --stage preview --profile admin
```

The second command removes the preview. Each stage has its own Worker.

## A term in office

- **The charter**: a new town is founded on land you choose: its size
  (small, medium, large), its richness (rich, fair, harsh: forests, stone,
  ore, lakes, and the starting treasury), and the length of the term (45,
  60, or 90 minutes at 1×). The land is an island-like stretch with a
  wandering coast and capes reaching out; the same seed always makes the
  same land.
- **Pressure** builds as the town grows:
  - *winters*: a term is six years, and every year but the first ends in a
    winter when fields do not grow, fisheries catch half as much, and homes
    eat faster;
  - *administration*: the town hall costs more per home the more homes
    there are, so a big town of poor homes cannot pay its way;
  - *the crown* asks for goods the town makes, more as the term goes on;
    sending them pays, and an unanswered request is a fine and a snub the
    town remembers;
  - *the market*: prices fall the more the town sells and rise the more
    it buys; stone and ore run out;
  - *approval*, from -100 to 100, follows needs met, taxes, unpaid wages,
    snubs from the crown, and hungry winters, and decides how many people
    each home holds.
- **The levers**: taxes per tier; for each good, sell beyond the reserve,
  buy up to it (at half again the price), or neither; the reserve itself;
  pausing a building (no workers, a quarter of its upkeep); answering the
  crown; and the speed of time (space pauses, 1, 2, 3 for 1×, 2×, 4×).
- **The end**: the town is *complete* once it holds every goal for two
  minutes (enough residents and coins for its size, three in ten of them
  citizens, approval 15 or more, not losing coins); you may retire or keep
  governing. It is *lost* to bankruptcy (three minutes in debt), revolt
  (approval at -50 or below for two minutes), abandonment (people fall
  below 15% of their peak), or dismissal (three of the crown's requests
  missed in a row). Otherwise the term runs out, and the town
  is judged flourishing, holding on, or declining. The reckoning shows the
  term's history and its chronicle.

## How the town works

- **A new town** has a town hall in a clearing, ringed by road, plus
  starting coins and goods.
- **Coins**: homes the town hall can reach by road pay taxes; traders buy
  what the town sells and sell it what it buys; every building costs upkeep
  and the town hall costs administration. Building costs coins up front.
  The **town** panel (T, or click the top bar) shows the goals, approval,
  treasury, people, supplies, the crown, goods and trade, and the
  chronicle, and holds the levers.
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
- `src/mapgen.ts`: the land of a new town, from its charter.
- `src/schema.ts`: the ECS world: components, relations, resources, services.
- `src/grid.ts`: occupancy, entrances, reach, and road paths.
- `src/sim/`: the fixed-step simulation (no renderer access): edits, work, logistics, walkers, town, and the term
  (seasons, the crown, approval, the end of the term, history).
- `src/present.ts`: per-frame interaction, panel, and view sync.
- `src/art.ts`: all drawing.
- `src/ui.ts`, `src/host.ts`, `src/main.ts`: the page bridge, camera, input, panels, and start-up.

The simulation runs on bevy-ts-browser's `FixedLoop` at 60 steps a second
(times the chosen speed), with integer state and a seeded random resource.
Every saved component and resource is validated, so **save** / **load**
snapshot the whole world, history and chronicle included, to localStorage.

In development the console has `town.ui`, `town.runtime`, and
`town.advance(seconds)` to fast-forward the simulation.

## Balancing

`pnpm balance` runs a bot that plays the real simulation headless, the way a
kind of mayor would, on several seeds, and reports how each term ended and
how the pressure on the town built up: residents, coins, costs against
income, administration, approval, food, the crown, and which goals were met,
averaged over the seeds still in office every few minutes.

```sh
pnpm balance -- --size large --term 90 --land harsh
pnpm balance -- --bot greedy          # sensible (default), greedy (taxes at 200%, sells everything, ignores the crown), idle
pnpm balance -- --seeds 4 --from 4    # seeds 4 to 7, to split a sweep across processes
pnpm balance -- --set crown.fine=2 --set kinds.fishery.recipe.seconds=3
pnpm balance -- --seeds 1 --verbose --every 1   # minute by minute
```

`pnpm check` puts the real simulation into each way a term can end
(complete, bankrupt, revolt, abandoned, dismissed, run out), checks an unanswered
crown request, and checks that a town saved mid-term loads back the same.
