/**
 * French for what the player can pick (`view/tools.ts`): what each tool,
 * panel, and map view is called, what its chip says on hover, and what the
 * tool bar says of each tool. The labels sit on the tool bar's buttons, a
 * phone's among them: one short word each.
 *
 * Every map view's chip is a "carte …" (feminine), so a sentence gives it
 * "la" outside the chip, whichever view it names.
 */
import { home, PAVE_COST, PAVED_PACE, ROAD_COST } from "../../game/content/index.ts"
import type { CommandId, MapViewId, ToolbarId } from "../../view/tools.ts"
import * as token from "../token.ts"
import { decimal } from "./grammar.ts"
import { cost } from "./said.ts"

/** A command: its label on a button or a chip, and what it does, in a line. */
export const commands = {
  select: { label: "choisir", title: "Choisir : désignez un bâtiment ou une maison pour voir son rôle" },
  road: { label: "route", title: "Route : faites glisser pour en tracer une" },
  pave: { label: "paver", title: "Paver : faites glisser le long d'une route pour la paver" },
  homes: { label: "maisons", title: "Maisons : faites glisser le long d'une route pour en poser une rangée" },
  build: { label: "bâtir", title: "Ouvrir le menu de construction" },
  bulldoze: { label: "raser", title: "Raser : enlever ce qui se trouve sur une case" },
  town: { label: "ville", title: "Ouvrir le panneau de la ville : objectifs, impôts et commerce" },
  speed: { label: "vitesse", title: "Faire passer le temps plus vite : 1×, 2×, 4×" },
  pause: { label: "pause", title: "Mettre la ville en pause, ou la relancer" }
} satisfies Record<CommandId, { readonly label: string; readonly title: string }>

/** What the tool bar says of each tool on hover. */
export const toolbar = {
  select: "Cliquez sur un bâtiment ou une maison pour voir son rôle · faites glisser pour vous déplacer · molette pour zoomer",
  road: `Faites glisser pour tracer une route · ${token.coins(ROAD_COST)} la case`,
  pave: `Faites glisser le long d'une route pour la paver : on y marche ${decimal(PAVED_PACE)}× plus vite, et les maisons voisines l'apprécient · ${token.coins(PAVE_COST.coins)} et ${token.amount("stone", PAVE_COST.stone)} la case`,
  homes: `Faites glisser pour poser une rangée de maisons le long d'une route · ${cost(home.cost)} chacune`,
  build: "Choisissez un bâtiment, puis cliquez pour le placer · Échap pour arrêter",
  bulldoze: "Cliquez sur un bâtiment, une maison, une route, un arbre ou un champ pour l'enlever"
} satisfies Record<ToolbarId, string>

/** A map view: what it is called in the list, on a chip ("carte des incendies"), and what it colours the map by. */
export const mapViews = {
  appeal: { label: "attrait", chip: "carte de l'attrait", title: "Colorer la carte selon l'attrait" },
  workers: { label: "travailleurs", chip: "carte des travailleurs", title: "Colorer la carte selon les travailleurs" },
  fire: { label: "incendie", chip: "carte des incendies", title: "Colorer la carte selon le risque d'incendie" },
  health: { label: "santé", chip: "carte de la santé", title: "Colorer la carte selon le risque pour la santé" },
  order: { label: "ordre", chip: "carte de l'ordre", title: "Colorer la carte selon le risque de vol" },
  condition: { label: "état", chip: "carte de l'état", title: "Colorer la carte selon l'état des bâtiments" }
} satisfies Record<MapViewId, { readonly label: string; readonly chip: string; readonly title: string }>
