/**
 * Spanish for what the player can pick (`view/tools.ts`): what each tool,
 * panel, and map view is called, what its chip says on hover, and what the
 * tool bar says of each tool. The labels sit on the tool bar's buttons, a
 * phone's among them: one short word each.
 */
import { home, PAVE_COST, PAVED_PACE, ROAD_COST } from "../../game/content/index.ts"
import type { CommandId, MapViewId, ToolbarId } from "../../view/tools.ts"
import * as token from "../token.ts"
import { decimal } from "./grammar.ts"
import { cost } from "./said.ts"

/** A command: its label on a button or a chip, and what it does, in a line. */
export const commands = {
  select: { label: "mirar", title: "Mirar: escoge un edificio o una casa para ver qué hace" },
  road: { label: "camino", title: "Camino: arrastra para trazar uno" },
  pave: { label: "empedrar", title: "Empedrar: arrastra a lo largo de un camino para empedrarlo" },
  homes: { label: "casas", title: "Casas: arrastra a lo largo de un camino para poner una hilera" },
  build: { label: "construir", title: "Abre el menú de construcción" },
  bulldoze: { label: "derribar", title: "Derribar: quita lo que haya en una casilla" },
  town: { label: "pueblo", title: "Abre el panel del pueblo: objetivos, impuestos y comercio" },
  speed: { label: "velocidad", title: "Haz que el tiempo corra más rápido: 1×, 2×, 4×" },
  pause: { label: "pausa", title: "Pausa el pueblo, o ponlo en marcha otra vez" }
} satisfies Record<CommandId, { readonly label: string; readonly title: string }>

/** What the tool bar says of each tool on hover. */
export const toolbar = {
  select: "Haz clic en un edificio o una casa para ver qué hace · arrastra para moverte · rueda para el zoom",
  road: `Arrastra para trazar un camino · ${token.coins(ROAD_COST)} por casilla`,
  pave: `Arrastra a lo largo de un camino para empedrarlo: porteadores y repartidores van ${decimal(PAVED_PACE)}× más rápido por él, y a las casas de al lado les gusta · ${token.coins(PAVE_COST.coins)} y ${token.amount("stone", PAVE_COST.stone)} por casilla`,
  homes: `Arrastra para poner una hilera de casas a lo largo de un camino · ${cost(home.cost)} cada una`,
  build: "Elige un edificio y luego haz clic para colocarlo · Esc para terminar",
  bulldoze: "Haz clic en un edificio, una casa, un camino, un árbol o un campo para quitarlo"
} satisfies Record<ToolbarId, string>

/** A map view: what it is called in the list, on a chip ("mapa de incendios"), and what it colours the map by. */
export const mapViews = {
  appeal: { label: "atractivo", chip: "mapa de atractivo", title: "Colorea el mapa según el atractivo" },
  workers: { label: "trabajadores", chip: "mapa de trabajadores", title: "Colorea el mapa según los trabajadores" },
  fire: { label: "incendios", chip: "mapa de incendios", title: "Colorea el mapa según el riesgo de incendio" },
  health: { label: "salud", chip: "mapa de salud", title: "Colorea el mapa según el riesgo para la salud" },
  order: { label: "orden", chip: "mapa de orden", title: "Colorea el mapa según el riesgo de robos" },
  condition: { label: "estado", chip: "mapa de estado", title: "Colorea el mapa según el estado de los edificios" }
} satisfies Record<MapViewId, { readonly label: string; readonly chip: string; readonly title: string }>
