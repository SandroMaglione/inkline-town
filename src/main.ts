/**
 * An isometric yard of line-drawn factories joined by conveyor belts, on
 * the bevy-ts ECS with Pixi drawing it.
 */
import { PixiNodeRegistry } from "@typeonce/bevy-ts-pixi"

import type { BeltView, CrateView, FactoryView } from "./art.ts"
import { createHost } from "./host.ts"
import { BeltNodes, Clock, CrateNodes, FactoryNodes, Game, StageService, Ui } from "./schema.ts"
import { setup, update } from "./systems.ts"

const start = async () => {
  const mount = document.getElementById("app")!
  const { app, stage, ui, syncPage } = await createHost(mount)
  const clock = { deltaSeconds: 1 / 60 }

  const runtime = Game.Runtime.make({
    services: Game.Runtime.services(
      Game.Runtime.service(Ui, ui),
      Game.Runtime.service(Clock, clock),
      Game.Runtime.service(StageService, stage),
      Game.Runtime.service(FactoryNodes, PixiNodeRegistry.make<FactoryView>(stage.objects)),
      Game.Runtime.service(BeltNodes, PixiNodeRegistry.make<BeltView>(stage.belts)),
      Game.Runtime.service(CrateNodes, PixiNodeRegistry.make<CrateView>(stage.objects))
    ),
    resources: {
      DeltaTime: 0,
      Elapsed: 0,
      Counters: { nextId: 1, placed: 0 },
      Totals: { shipped: 0 },
      Flow: {}
    }
  })
  runtime.tick(setup)
  app.ticker.add((ticker) => {
    clock.deltaSeconds = Math.min(ticker.deltaMS / 1000, 0.05)
    runtime.tick(update)
    syncPage()
  })
}

void start()
