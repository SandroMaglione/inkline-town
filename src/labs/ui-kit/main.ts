/** The page's building blocks in each of their states (see `ui/dom/kit/examples.ts`). */
import { kitExamples } from "../../ui/dom/kit/examples.ts"

/** A placeholder picture: the sheet needs no renderer. */
const placeholder = async (what: unknown) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="56"><rect width="64" height="56" rx="6" fill="#e2e5de"/><text x="32" y="32" font-size="10" text-anchor="middle" fill="#3d4943">${String(what)}</text></svg>`)}`

document.getElementById("kit")!.append(kitExamples(placeholder))
