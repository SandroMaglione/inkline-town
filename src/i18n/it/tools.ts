/**
 * Italian for what the player can pick (`view/tools.ts`): what each tool,
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
  select: { label: "seleziona", title: "Seleziona: scegli un edificio o una casa per vedere che cosa fa" },
  road: { label: "strada", title: "Strada: trascina per tracciarne una" },
  pave: { label: "selciato", title: "Selciato: trascina lungo una strada per lastricarla" },
  homes: { label: "case", title: "Case: trascina lungo una strada per disporne una fila" },
  build: { label: "costruisci", title: "Apri il menu delle costruzioni" },
  bulldoze: { label: "demolisci", title: "Demolisci: togli ciò che sta su una casella" },
  town: { label: "paese", title: "Apri il pannello del paese: obiettivi, tasse e commercio" },
  speed: { label: "velocità", title: "Fai scorrere il tempo più in fretta: 1×, 2×, 4×" },
  pause: { label: "pausa", title: "Metti in pausa il paese, o fallo ripartire" }
} satisfies Record<CommandId, { readonly label: string; readonly title: string }>

/** What the tool bar says of each tool on hover. */
export const toolbar = {
  select: "Clicca un edificio o una casa per vedere che cosa fa · trascina per spostarti · rotella per lo zoom",
  road: `Trascina per tracciare una strada · ${token.coins(ROAD_COST)} a casella`,
  pave: `Trascina lungo una strada per lastricarla: portatori e ambulanti ci vanno ${decimal(PAVED_PACE)}× più svelti, e alle case accanto piace · ${token.coins(PAVE_COST.coins)} e ${token.amount("stone", PAVE_COST.stone)} a casella`,
  homes: `Trascina per disporre una fila di case lungo una strada · ${cost(home.cost)} l'una`,
  build: "Scegli un edificio, poi clicca per posarlo · Esc per smettere",
  bulldoze: "Clicca un edificio, una casa, una strada, un albero o un campo per toglierlo"
} satisfies Record<ToolbarId, string>

/** A map view: what it is called in the list, on a chip ("mappa degli incendi"), and what it colours the map by. */
export const mapViews = {
  appeal: { label: "attrattiva", chip: "mappa dell'attrattiva", title: "Colora la mappa secondo l'attrattiva" },
  workers: { label: "lavoratori", chip: "mappa dei lavoratori", title: "Colora la mappa secondo i lavoratori" },
  fire: { label: "incendi", chip: "mappa degli incendi", title: "Colora la mappa secondo il rischio d'incendio" },
  health: { label: "salute", chip: "mappa della salute", title: "Colora la mappa secondo il rischio per la salute" },
  order: { label: "ordine", chip: "mappa dell'ordine", title: "Colora la mappa secondo il rischio di furti" },
  condition: { label: "stato", chip: "mappa dello stato", title: "Colora la mappa secondo lo stato degli edifici" }
} satisfies Record<MapViewId, { readonly label: string; readonly chip: string; readonly title: string }>
