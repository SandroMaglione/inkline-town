/**
 * German for what the player can pick (`view/tools.ts`): what each tool,
 * panel, and map view is called, what its chip says on hover, and what the
 * tool bar says of each tool. The labels sit on the tool bar's buttons, a
 * phone's among them: one short word each, a noun, so capitalised.
 *
 * A cell of the map is a "Feld" everywhere; a farm's field is an "Acker",
 * so the two never read alike.
 */
import { home, PAVE_COST, PAVED_PACE, ROAD_COST } from "../../game/content/index.ts"
import type { CommandId, MapViewId, ToolbarId } from "../../view/tools.ts"
import * as token from "../token.ts"
import { decimal } from "./grammar.ts"
import { cost } from "./said.ts"

/** A command: its label on a button or a chip, and what it does, in a line. */
export const commands = {
  select: { label: "Auswahl", title: "Auswahl: Wähle ein Gebäude oder Haus, um zu sehen, was es tut" },
  road: { label: "Straße", title: "Straße: Ziehe, um eine anzulegen" },
  pave: { label: "Pflaster", title: "Pflaster: Ziehe entlang einer Straße, um sie zu pflastern" },
  homes: { label: "Häuser", title: "Häuser: Ziehe entlang einer Straße, um eine Reihe anzulegen" },
  build: { label: "Bauen", title: "Öffne das Baumenü" },
  bulldoze: { label: "Abriss", title: "Abriss: Entferne, was auf einem Feld steht" },
  town: { label: "Ort", title: "Öffne das Fenster des Ortes: Ziele, Steuern und Handel" },
  speed: { label: "Tempo", title: "Lass die Zeit schneller laufen: 1×, 2×, 4×" },
  pause: { label: "Pause", title: "Halte den Ort an, oder lass ihn weiterlaufen" }
} satisfies Record<CommandId, { readonly label: string; readonly title: string }>

/** What the tool bar says of each tool on hover. */
export const toolbar = {
  select: "Klicke auf ein Gebäude oder Haus, um zu sehen, was es tut · Ziehen verschiebt · Mausrad zoomt",
  road: `Ziehe, um eine Straße anzulegen · ${token.coins(ROAD_COST)} pro Feld`,
  pave: `Ziehe entlang einer Straße, um sie zu pflastern: Träger und Läufer gehen darauf ${decimal(PAVED_PACE)}× so schnell, und die Häuser daneben mögen das · ${token.coins(PAVE_COST.coins)} und ${token.amount("stone", PAVE_COST.stone)} pro Feld`,
  homes: `Ziehe, um eine Reihe Häuser entlang einer Straße anzulegen · ${cost(home.cost)} pro Haus`,
  build: "Wähle ein Gebäude, dann klicke, um es zu platzieren · Esc zum Beenden",
  bulldoze: "Klicke auf ein Gebäude, ein Haus, eine Straße, einen Baum oder einen Acker, um es zu entfernen"
} satisfies Record<ToolbarId, string>

/** A map view: what it is called in the list, on a chip ("Brandkarte"), and what it colours the map by. */
export const mapViews = {
  appeal: { label: "Wohnwert", chip: "Wohnwertkarte", title: "Färbe die Karte nach dem Wohnwert" },
  workers: { label: "Arbeiter", chip: "Arbeiterkarte", title: "Färbe die Karte nach den Arbeitern" },
  fire: { label: "Feuer", chip: "Brandkarte", title: "Färbe die Karte nach der Brandgefahr" },
  health: { label: "Gesundheit", chip: "Gesundheitskarte", title: "Färbe die Karte nach der Krankheitsgefahr" },
  order: { label: "Ordnung", chip: "Ordnungskarte", title: "Färbe die Karte nach der Gefahr von Diebstahl" },
  condition: { label: "Zustand", chip: "Zustandskarte", title: "Färbe die Karte nach dem Zustand der Gebäude" }
} satisfies Record<MapViewId, { readonly label: string; readonly chip: string; readonly title: string }>
