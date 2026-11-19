/**
 * The sign-up for news of the next Typeonce game: an email field and "Get new
 * games", under the studio's mark (the same as the credit's, `credit.ts`).
 * Two places carry it, both when the town is waiting anyway:
 *
 * - `spring`: a card above the tool bar the moment the town's first winter
 *   ends, with the town paused under it (`spring-card.ts`). Its top strip is
 *   the town's own voice, and "Keep playing" sits beside the button.
 * - `reckoning`: a panel on the end-of-term screen, under its buttons.
 *
 * Signing up puts both away for good on this device; closing either (the ×,
 * "Keep playing", Esc) puts both away for a day (`signup-rules.ts`). It never
 * takes the keyboard by itself, and the keys typed in its field are not the
 * town's (`keys.ts` and the map's input skip an `<input>`).
 */
import { el } from "../kit/dom.ts"
import { createMark } from "./credit.ts"
import {
  OUTCOME_TEXT,
  readMemory,
  remember,
  signupAllowed,
  subscribe,
  type Outcome,
  type SignupHost,
  type SignupStorage
} from "./signup-rules.ts"

export type SignupPlacement = "spring" | "reckoning"

/** This device's `localStorage`; reaching it can throw, which the rules catch. */
const storage = (): SignupStorage => window.localStorage

/** What this device remembers of the sign-up. */
export const signupMemory = {
  /** The sign-up may show now: not signed up here, and not closed in the last day. */
  allowed: (): boolean => signupAllowed(readMemory(storage), Date.now()),
  signedUp: (): boolean => {
    const memory = readMemory(storage)
    return memory !== null && "signedUp" in memory
  },
  /** Closed: away for a day (a sign-up already made stays made). */
  closed: (): void => {
    if (!signupMemory.signedUp()) remember(storage, { closedAt: Date.now() })
  },
  /** Signed up: away for good. */
  done: (): void => remember(storage, { signedUp: true })
}

/** The page's own address and network. */
const pageHost = (): SignupHost => ({ hostname: location.hostname, href: location.href, fetch: window.fetch.bind(window) })

export interface SignupActions {
  /** The player put it away (the ×, "Keep playing", Esc): the placement takes it down. */
  readonly close: () => void
}

export interface Signup {
  readonly element: HTMLElement
  readonly field: HTMLInputElement
  /** Shows how a sign-up went: the error under the field, or the thanks in place of the form. */
  readonly show: (outcome: Outcome) => void
  /** The address is on its way: the button waits. */
  readonly sending: (on: boolean) => void
}

/**
 * The sign-up's markup and behaviour. `send`: how the address goes out
 * (the endpoint, or on any other address than typeonce.games, a made-up
 * answer); the UI kit passes its own to show each state without sending.
 */
export const createSignup = (placement: SignupPlacement, actions: SignupActions, send: (email: string) => Promise<Outcome> = (email) => subscribe(email, pageHost())): Signup => {
  const box = el("section", `signup ${placement}`)
  box.setAttribute("aria-label", "New games from Typeonce Games")

  const close = el("button", "close", "×")
  close.type = "button"
  close.title = "Close"
  close.setAttribute("aria-label", "Close")
  close.onclick = () => actions.close()
  box.append(close)

  if (placement === "spring") {
    const moment = el("p", "moment")
    moment.append(el("b", "", "Spring of year 3."), document.createTextNode(" The town came through its first winter."))
    box.append(moment)
  }

  const inner = el("div", "inner")
  const studio = el("p", "studio")
  studio.append(createMark(22), el("span", "", "Typeonce Games"))
  const words = el("div", "words")
  words.append(
    studio,
    el("p", "headline", "Play the next Typeonce game first"),
    el("p", "body", "Inkline Town is made by Typeonce Games. Leave your email and the next free game reaches you the day it ships.")
  )

  const form = el("form", "")
  form.noValidate = true
  const field = el("input", "")
  field.type = "email"
  field.name = "email"
  field.placeholder = "you@example.com"
  field.autocomplete = "email"
  field.spellcheck = false
  field.setAttribute("autocapitalize", "off")
  field.setAttribute("aria-label", "Email address")
  const buttons = el("div", "buttons")
  const submit = el("button", "frame primary", "Get new games")
  submit.type = "submit"
  buttons.append(submit)
  // On the card the town waits under it: "Keep playing" is the way back.
  const keep = placement === "spring" ? el("button", "frame keep", "Keep playing") : null
  if (keep) {
    keep.type = "button"
    keep.onclick = () => actions.close()
    buttons.append(keep)
  }
  const message = el("p", "message")
  message.setAttribute("role", "status")
  message.setAttribute("aria-live", "polite")
  form.append(field, buttons, message)
  const act = el("div", "act")
  act.append(form)
  inner.append(words, act)
  box.append(inner)

  // An error stays until the address is edited.
  const clearError = () => {
    if (!box.classList.contains("error")) return
    box.classList.remove("error")
    field.removeAttribute("aria-invalid")
    message.textContent = ""
  }
  field.addEventListener("input", clearError)
  // Esc in the field closes the card too (the page's keys skip a field).
  box.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || placement !== "spring") return
    event.stopPropagation()
    actions.close()
  })

  let busy = false
  const sending = (on: boolean) => {
    busy = on
    submit.disabled = on
    box.classList.toggle("sending", on)
  }
  const show = (outcome: Outcome) => {
    if (outcome === "ok") {
      const done = el("div", "done")
      const thanks = el("p", "thanks", OUTCOME_TEXT.ok)
      thanks.setAttribute("role", "status")
      done.append(thanks)
      // The only thing left to do: keep playing, now the main button.
      if (keep) {
        keep.classList.add("primary")
        const row = el("div", "buttons")
        row.append(keep)
        done.append(row)
      }
      box.classList.remove("error")
      box.classList.add("signed-up")
      form.replaceWith(done)
      return
    }
    box.classList.add("error")
    if (outcome === "invalid_email") field.setAttribute("aria-invalid", "true")
    else field.removeAttribute("aria-invalid")
    message.textContent = OUTCOME_TEXT[outcome]
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    if (busy) return
    clearError()
    sending(true)
    void send(field.value).then((outcome) => {
      sending(false)
      if (outcome === "ok") signupMemory.done()
      show(outcome)
      // The player just pressed the button: the address to fix is where they are taken.
      if (outcome !== "ok") field.focus()
    })
  })

  return { element: box, field, show, sending }
}
