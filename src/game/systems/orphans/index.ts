/**
 * A walker or a field is spawned already belonging to the building that sent
 * or sowed it. When that building went in the same step (burnt down while
 * sending its firefighters, say), the belonging fails and the newcomer would
 * stay behind with no home: it goes too, as it would have with its building.
 */
export { DropOrphans } from "./drop-orphans.ts"
