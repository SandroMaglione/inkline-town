# Developing Inkline Town

[← back to the README](README.md)

Inkline Town is a TypeScript game. The simulation runs on the
[bevy-ts](https://github.com/SandroMaglione/bevy-ts) ECS at a fixed step and
knows nothing of the page; [Three.js](https://threejs.org) draws the 3D world;
Pixi renders the original menu thumbnails; saving is
written with [Effect](https://effect.website).

```sh
pnpm install
pnpm dev --host --port 5232
pnpm typecheck
pnpm test       # model-based tests: random mayors, rules that must always hold; and saving
pnpm check      # every way a term can end, ends it
pnpm check:browser # the actual 3D game: placement, picking, saves, populated towns and phone layout
pnpm balance    # a bot plays terms headless and reports the pressure
```

Before pushing, run `pnpm typecheck`, `pnpm test`, and `pnpm check`.

## The playable 3D game

Open [`/`](http://localhost:5232/) with the dev server running. The existing
simulation, town panels, economy, charter, history, reckoning and save format
drive the approved 3D models. Drag to pan; right-drag or choose **Rotate** to
turn and tilt. Scroll to zoom. Q/E turn, arrow keys pan, Home resets, and
the camera toolbar provides the same controls. On touch screens, two fingers
pan and pinch to zoom; twisting them rotates. Road/home tools still drag to
build; camera gestures never place anything.

`src/render3d/scene.ts` owns the orthographic camera, ground projection and
frame source. `views.ts` follows live construction, upgrades, resources,
production, problem markers and the simulation's walkers and cargo. Flags,
mill sails and smoke animate in 3D. `pool.ts` instances repeated geometry,
preserves entity IDs for picking, varies costumes per instance, and bounds
the cache of unused animation/construction states. Loading or founding a
town clears and rebuilds the presentation from the saved world.

`pnpm check:browser` uses an isolated Chromium browser and the running dev
server. It can use installed Brave/Chrome or `BROWSER_EXECUTABLE_PATH`; otherwise
install Chromium with `pnpm exec playwright install chromium`. `GAME_BASE_URL`
overrides the local URL. It generates a reproducible 20-minute bot save,
loads it through the real UI, and writes screenshots and measurements to
`output/inkline-3d/game-check/`. `GAME_SAVE_PATH` can supply another save.
Phone viewport and simulated touch checks do not replace physical-device testing.

![A populated town in the actual 3D game](docs/screenshots/game-3d.png)

## The art gallery

With `pnpm dev` running, [`/gallery.html`](http://localhost:5232/gallery.html)
shows every drawing in the game side by side: each building with and
without doors, homes, trees, rocks, fields, water, roads, carriers with each
load, walkers, residents, and the page's icons. Scroll or drag to look
around, ctrl + wheel (or pinch) to zoom. `?sheet` lays the same drawings out
as the labelled sheet the README's pictures come from. The gallery is not
part of the build.

## The 3D art study

With `pnpm dev` running, [`/asset-lab.html`](http://localhost:5232/asset-lab.html)
compares the complete world catalogue with the actual drawings from
`art.ts`. Choose a collection or search by name. Drag to rotate; the rotation
and elevation controls also work with a keyboard. The original view uses a
30-degree orthographic camera with the game's 64×32 projection.

| Collection | Models | Coverage |
| --- | ---: | --- |
| Buildings | 16 | Every building kind, with its roof, topper and yard |
| Homes | 8 | Both tiers in all four roof palettes |
| Land | 19 | Three tree shapes at three growth stages, stone and ore in both resource states, four crop stages, roads and water |
| People | 27 | Carriers, settlers, citizens, market and chapel walkers, all six hats and the sixteen reference-gallery residents |
| Cargo and vehicles | 69 | Eleven distinct goods and labelled crates; empty handcart/barrow and small/full loads of each good; the approved mixed goods plate |
| Construction and effects | 10 | Empty/supplied sites, frame/walls, problem sign, smoke and four placement/reach outlines |

The 149 entries cover object families and representative seeded variants.
Continuous growth, construction progress, walk poses and colours can be
generated; this is not a list of every possible random seed. Page icons
remain the game's original 2D UI art.

![Complete 3D world catalogue at a rotated angle](screenshots/3d-catalogue.webp)

`pnpm assets:build` exports 149 GLBs and editable geometry descriptions,
a manifest, and two standalone viewers to `output/inkline-3d/`:
`inkline-3d-study.html` and `inkline-3d-map.html`. It reimports every GLB and
checks geometry and unlit materials. The viewers work without a dev server;
their optional web fonts use the network. The game build remains separate.

- `src/asset-lab/primitives.ts`: renderer-independent polygon/stroke schema
  and reusable modelling operations in the game's cell units and pixel heights.
- `buildings.ts`, `land.ts`, `people.ts`, `construction.ts`: procedural
  models; `assets.ts` collects them and retains the approved house/prop models.
- `renderer.ts`: Three.js adapter, material batching, depth-tested ink,
  continuous curved outlines and silhouette hulls. GLB uses ordinary meshes
  and unlit materials so the ink survives import into another renderer.
- `main.ts`: original drawing comparisons, collection/search UI and downloads.

The art viewer uses fixed poses; the playable game animates them from live
state. The Three.js adapter does not establish compatibility with the private
PixiJS 3D beta. Rear facades and rounded volumes interpret surfaces the original
drawing does not show. GLB edge antialiasing can differ from the live viewer.

### The complete 3D review map

Open [`/map-lab.html`](http://localhost:5232/map-lab.html) to see every catalogue
model on one island. Drag to pan, right-drag or choose Rotate to orbit, and
scroll or pinch to zoom. The toolbar also controls zoom, rotation and tilt.
WASD or arrow keys pan; Q/E rotate; Home restores the original view.
Double-click the ground to focus the camera there.

![Every model together on the review island](screenshots/3d-map-complete.webp)

District shortcuts focus the town, workshops, homes, people, cargo yard or
forest. Inspect selects any of the 149 models and links to its original
drawing comparison. Eight additional people walk along the street using two
procedural poses; pause them for review. Smoke and the problem sign face
the camera so they stay readable when the map turns.

Map faces and strokes are batched by material. Tests check catalogue
coverage, valid geometry and the presence of every model on the map.
This tests presentation and camera controls; it runs no town simulation.
The walking preview does not export skeletal animation.

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
- `src/render3d/`: live world renderer, model instances, camera and map input.
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
deploys the game to <https://inkline.typeonce.dev>. Alchemy attaches that
custom domain to the `prod` Worker and creates its DNS record and certificate
in the `typeonce.dev` Cloudflare zone. Check that the game opens and save/load
works there after each release.

`admin` is the existing local Alchemy Cloudflare profile. On another
machine, use your own logged-in profile or set `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`, then omit `--profile admin`. Keep credentials outside
the repository. Releases run locally; pushing to GitHub does not deploy.

For a temporary preview, run:

```sh
pnpm --dir deploy exec alchemy deploy --stage preview --profile admin
pnpm --dir deploy exec alchemy destroy --stage preview --profile admin
```

The second command removes the preview. Each stage has its own Worker;
previews stay on their `workers.dev` URL and never claim the custom domain.
