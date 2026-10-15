# Market hall and church assets

The tier 2 presentation assets are approved, including the church's straight-sided
timber double door. They are registered in the catalogue and review map. Gameplay
still selects the original tier 1 buildings.

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
Do not replace `buildingAsset()` with the preview helper without those controls.

## Gameplay integration still needed

- Define upgrade eligibility, costs and service effects. Persist a service tier
  with a backward-compatible tier 1 default for existing saves.
- Pass tier through presentation to `src/render3d/models.ts` and
  `src/render3d/views.ts`; include it in shared model/cache keys. Preserve the
  current condition, winter, smoke and construction behavior.
- Use the upgraded silhouette and dimensions for construction and effects.
  Keep the chapel's original cupola and market's original flag on tier 1.
- Add upgrade UI and verify save/load, construction, road-facing entrances,
  selection and rotation. Asset metadata alone does not activate upgrades.

## Review and export

Run `pnpm dev` and open `/service-upgrades.html` for synchronized tier comparisons,
street scale and GLB downloads. `/asset-lab.html?asset=church` and
`/asset-lab.html?asset=market-hall` inspect each model. `/map-lab.html` includes both.

`pnpm assets:build` exports GLB and JSON geometry, verifies reimported geometry and
unlit materials, and produces `output/inkline-3d/inkline-service-upgrades.html`.
The standalone viewer works without a dev server.
