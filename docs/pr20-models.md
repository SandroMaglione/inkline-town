# PR #20 model handoff

Run `pnpm dev --host 127.0.0.1 --port 5236`, then open
`http://127.0.0.1:5236/model-review.html?collection=handoff`.
Rotation, elevation, PNG sheets and individual GLB exports work in this
view. The models use the same close framing as the other building collections.

The carpenter is an open timber workshop with a boarded store door,
28-pixel eaves and a 38-pixel ridge. Its bench, vice, tools, sawhorse,
plank bearers, chairs and chest stay inside the original two-cell plot.
It has no flue or smoke emitter. Furniture uses the same chair and chest
geometry in the work yard and on delivery carts.

The civic milestones have full models in `src/asset-lab/civic.ts`. The
guildhall is a steep-roofed guild house with a prominent clock tower,
balcony, dormers and guild banners. The city hall has lower wings, corner
pavilions, a columned portico, ceremonial stair and large ribbed dome with
a lantern. Compare all three civic stages at
`/model-review.html?collection=milestones`, using one camera scale.
Civic surface bounds use their
own eave heights, and marker heights are cached from their actual geometry.
The original town hall flag is hidden on the full civic upgrade models.

The depot gantry, ovenworks flue, masonry derrick, estate dovecote and hay
shelter, and fire brigade pump and hose cart extend their existing models. The depot and
ovenworks additions turn with their road-facing work yards. The fire
brigade equips the yard rather than adding a second floating bell.

The proportion pass is reviewed at `/proportion-review.html`. All 36 building
appearances and nine shared-prop examples have frozen originals from `a2845b4`
beside current geometry, with one unchanged walker and one camera for both views.
Filtering, shared rotation, elevation, zoom, a fixed town scale and PNG download
work on desktop and phone. The frozen data is a 505 KB gzip file under
`public/model-review/`; `scripts/snapshot-proportions.ts` records its provenance
and refuses to overwrite it.

Homes now have 20-unit timber doors and 22-unit floor spacing, with eaves at
24, 46 and 68. Public floors are generally 24–26 units. Larger shell volumes,
workshop shelters and flues have individual dimensions; no global mesh scaling
is applied. Towers, mine machinery and the civic dome retain their landmark
heights. The fire lookout gains standing clearance. Shared chairs and benches
have matching seat heights, tool rails are reachable, generic goods crates are
smaller, and scaffolds have full-height working bays and higher guard rails.
The mine model and shared chest were checked and retained. Plot sizes, walker
geometry, economy values and simulation rules are unchanged. The three home
height fields in content are drawing dimensions used by construction and effects.

Construction uses `scaffoldAsset(size, height, share)` from
`src/asset-lab/scaffolding.ts`. It has no building-kind branches or model
lookup. Modular timber bays, up to two working platforms, an access ladder,
canvas screens and supply piles fit inside the plot. Central bays on all
four sides remain clear at ground level. One generator covers every
building kind, with progress quantized into 24 steps in the live view.
`/model-review.html?collection=works` shows three delivery stages and six
different building forms. Geometry is retained because it reads as a
worksite without requiring a bespoke construction asset for each building.
Repeated members use solid faces and economical outlines.
The review map has an upgrade annex; temporary
construction examples were moved away from the carpenter's plot.

The [Anatomy Asset skill](https://github.com/Teddarific/skills/tree/main/skills/anatomy-asset) was read as an external reference, without local
installation. Its solid parts, connected supports and purposeful detail
informed the models. Geometry remains native `Drawing` data.

Validation commands are `pnpm typecheck`, `pnpm test`, `pnpm check`,
`pnpm assets:build`, and the browser workflows `check:models`, `check:proportions`,
`check:revisions`, `check:phone`, `check:effects`, `check:park`,
`check:browser` and `look:upgrades`, with `GAME_BASE_URL` set to the server.
Economy balance and save-migration changes belong to the parent PR.

The proportion pass passes typecheck, build, the full test suite, `pnpm check`,
all 45 comparison pairs, model gallery and revision browser checks, and
export/reimport of all 236 GLBs. Geometry checks cover walker-sized home doors,
floor clearance, unchanged plots, marker clearance in every orientation and
the lookout route with full walker headroom.
Both civic upgrades complete through the real upgrade command. The live
upgrade and phone menu/portrait checks also pass without
browser errors. Effects and park checks also pass with the revised geometry.
After rebasing onto parent head `44e6ef9`, the full game browser check passes:
construction, walker movement, selection at all eight angles, save/load,
scene restoration, phone gestures, reckoning and sharing. The parent's road
connection fix resolves the earlier settler timeout. The 45-pair comparison
workflow, typecheck, full tests, simulation checks and build were rerun on
that combined revision.
