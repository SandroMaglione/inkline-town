# Developing Inkline Town

[← back to the README](README.md)

Inkline Town is a TypeScript game. The simulation runs on the
[bevy-ts](https://github.com/SandroMaglione/bevy-ts) ECS at a fixed step and
knows nothing of the page; [Pixi](https://pixijs.com) draws it; saving is
written with [Effect](https://effect.website).

```sh
pnpm install
pnpm dev --host --port 5232
pnpm typecheck
pnpm test       # model-based tests: random mayors, rules that must always hold; and saving
pnpm check      # every way a term can end, ends it
pnpm balance    # a bot plays terms headless and reports the pressure
```

Before pushing, run `pnpm typecheck`, `pnpm test`, and `pnpm check`.

## The art gallery

With `pnpm dev` running, [`/gallery.html`](http://localhost:5232/gallery.html)
shows every drawing in the game side by side: each building with and
without doors, homes, trees, rocks, fields, water, roads, carriers with each
load, walkers, residents, and the page's icons. Scroll or drag to look
around, ctrl + wheel (or pinch) to zoom. `?sheet` lays the same drawings out
as the labelled sheet the README's pictures come from. The gallery is not
part of the build.

## Opening a bot's town in the browser

`pnpm balance -- --snapshot <minute>` writes each seed's town at that minute
to `snapshots/` (git-ignored) as a save file. To play one, put its contents
in the page's save slot from the console and press **load**:

```js
localStorage.setItem("inkline-town/save/manual", /* the file's contents */)
```

That is how the README's screenshots of grown towns were made.

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
- `src/art.ts`: all drawing: buildings and their yards, homes, the land, roads, carts, and figures.
- `src/townsfolk.ts`: residents out walking, for looking at only: not simulated, not saved.
- `src/icons.ts`: the page's line-drawn icons.
- `src/gallery.ts`: the dev-only art gallery (see above).
- `src/sim/headless.ts`: a town with no page, stepped from code: what the tests, `check`, and `balance` play.
- `src/save.ts`: saving and loading as [Effect](https://effect.website) programs: a versioned file in a slot
  (the mayor's own, or the autosave), typed errors for each way a load can fail.
- `src/ui.ts`, `src/host.ts`, `src/main.ts`: the page bridge, camera, input, panels, and start-up.

The simulation runs on bevy-ts-browser's `FixedLoop` at 60 steps a second
(times the chosen speed), with integer state and a seeded random resource.
Every saved component and resource is validated, so **save** / **load**
snapshot the whole world, history and chronicle included, to localStorage;
the page also autosaves every two minutes of game time, and **load** takes
whichever is newer.

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
pnpm balance -- --snapshot 40                   # save each seed's town at minute 40 (see above)
```

## Testing

The simulation has no renderer in it: it runs headless (`src/sim/headless.ts`),
about 60 to 80 times faster than real time, so the tests play real towns.

`pnpm test` runs model-based tests built on Effect's `Schema` and
`Arbitrary`. They generate sequences of what a mayor can do (roads, homes,
buildings where they fit, bulldozing, taxes, trade, pausing, answering the
crown, saving and loading, waiting through seasons, and fortune good and
bad), play them on the real simulation, and after every command check what
must always be true: goods within their shelves, tiles on the land and
apart, residents and workers within bounds, the census matching the homes,
walkers belonging to standing buildings, approval and prices within their
bounds, the clock and the record only going forward, and a term ending only
in the allowed ways. A failure shrinks to the shortest sequence that still
breaks a rule. A second property checks that the same charter and commands
always make the same town. `RUNS=200 pnpm test` searches harder;
`SEED=…` replays.

`pnpm check` puts the real simulation into each way a term can end
(complete, bankrupt, revolt, abandoned, dismissed, run out), checks an unanswered
crown request, and checks that a town saved mid-term loads back the same.

## Releasing to Cloudflare

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
