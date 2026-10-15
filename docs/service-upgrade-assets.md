# Market hall and church assets

The tier 2 presentation assets are approved, including the church's straight-sided
timber double door. They are registered in the catalogue and review map, and
the town draws them once a market or chapel is upgraded (see `Kind.upgrade`).

## Asset API

`src/asset-lab/service-upgrades.ts` exports `marketHall()`, `church()`, and:

```ts
serviceBuilding("market", 2) // market-hall
serviceBuilding("chapel", 2) // church
serviceBuilding("market", 1) // existing market
```

Both upgrades retain the family's 2×2 footprint. Their catalogue references are
`{ type: "building", kind: "market" | "chapel", tier: 2 }`. `kind` remains the
existing service family. Asset IDs are `market-hall` and `church`.

These functions currently build complete preview assets, including plates. Live
integration should support the existing `BuildingOptions` conventions for
road-facing doors, construction fitting, plate visibility and separate motion.
Do not replace `buildingAsset()` with the preview help## In the town

`buildingAsset(id, …, upgraded)` in `src/render3d/models.ts` draws an
upgraded market or chapel with `serviceBuilding(kind, 2, { plate: false, doors })`.
The town draws plates apart, so the model leaves its own out. The model turns a
quarter at a time (`quartersFor`) to put the most of its street fronts on the
roads at its doors: the market hall's two arcades, the church's tower door.
The light stays baked from the same side: a lit wall that turns to face a
shaded side takes its material's shaded colour. `upgradeHeights` gives each
model's eaves (for surface effects and fire) and its top (for the problem
marker). The market hall drops the market's flag. The model cache key includes
the tier.

The building panel pictures an upgraded building with its model
(`src/render3d/portrait.ts`): drawn once from the town's own camera, at the
town's scale and cropped to the model, beside the 2D pictures of the rest.

oes not activate upgrades.

## Review and export

Run `pnpm dev` and open `/service-upgrades.html` for synchronized tier comparisons,
street scale and GLB downloads. `/asset-lab.html?asset=church` and
`/asset-lab.html?asset=market-hall` inspect each model. `/map-lab.html` includes both.

`pnpm assets:build` exports GLB and JSON geometry, verifies reimported geometry and
unlit materials, and produces `output/inkline-3d/inkline-service-upgrades.html`.
The standalone viewer works without a dev server.
