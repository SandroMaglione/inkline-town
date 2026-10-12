# Factory yard

A prototype: place line-drawn isometric factories on a grid, connect them
with conveyor belts, and watch crates flow. Game logic runs on the
[bevy-ts](../../bevy-ts) ECS; Pixi draws it.

```sh
pnpm install
pnpm dev --host --port 5232
pnpm typecheck
```

The bevy-ts packages are linked from `../../bevy-ts` and consumed as source.

- `src/iso.ts`: the grid and the unit everything is measured in (1/16 cell = 2×1 px).
- `src/kinds.ts`: the factory kinds and their sizes.
- `src/route.ts`: belt pathfinding.
- `src/schema.ts`, `src/systems.ts`: the ECS world and its systems.
- `src/art.ts`: all drawing.
- `src/host.ts`, `src/main.ts`: the page, camera, input, panel, and start-up.
