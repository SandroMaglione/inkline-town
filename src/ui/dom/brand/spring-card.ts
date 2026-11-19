/**
 * The sign-up's card at the first spring (`signup.ts`): when the town's first
 * winter ends, a card rises above the tool bar and the town pauses under it,
 * with its own PAUSED badge. "Keep playing", the ×, or Esc put it away and the
 * town goes on at the speed it had.
 *
 * It waits its turn: while the mayor is in the middle of something (a road
 * being drawn, a panel, a fold or a dialog open, a toast up), it holds off and
 * comes right after. It comes once a term at most, never on the founding
 * screen or a visit to someone else's town, and only while the sign-up may
 * show on this device.
 */
import type { Stats } from "../../../view/contracts.ts"
import { firstSpring, type Season } from "./signup-rules.ts"
import { createSignup, signupMemory, type Signup } from "./signup.ts"

export interface SpringCardHost {
  readonly speed: () => number
  readonly setSpeed: (speed: number) => void
  /** The mayor is in the middle of something: the card waits. */
  readonly busy: () => boolean
  /** The card has no place now (founding a town, visiting one): it does not come, and goes if it is up. */
  readonly away: () => boolean
}

export const createSpringCard = (host: SpringCardHost) => {
  /** The town the season below belongs to, and its season last frame. */
  let town: number | null = null
  let before: Season | null = null
  /** The first spring came and the card waits its turn. */
  let due = false
  /** The towns and terms it has come in this session. */
  const shown = new Set<string>()
  let card: Signup | null = null
  let term = ""
  let resumeSpeed = 1

  /** Takes the card down; `resume`: the town goes back to the speed it had. */
  const takeDown = (resume: boolean) => {
    if (!card) return
    card.element.remove()
    card = null
    document.body.classList.remove("signup-up")
    // The mayor may have set the town going under the card: their choice stands.
    if (resume && host.speed() === 0) host.setSpeed(resumeSpeed)
  }

  const putUp = () => {
    due = false
    shown.add(term)
    resumeSpeed = host.speed()
    host.setSpeed(0)
    card = createSignup("spring", {
      close: () => {
        signupMemory.closed()
        takeDown(true)
      }
    })
    card.element.classList.add("afloat")
    document.body.append(card.element)
    document.body.classList.add("signup-up")
  }

  return {
    /** Once a frame: watches for the first spring, and puts the card up when its turn comes. */
    sync: (s: Stats) => {
      if (s.charter.seed !== town) {
        // Another town (founded or loaded): its season starts over, and a card for the last one goes.
        town = s.charter.seed
        before = null
        due = false
        takeDown(false)
      }
      const now: Season = { year: s.season.year, winter: s.season.winter }
      term = `${s.charter.seed}|${s.fate.term}`
      if (firstSpring(before, now) && !shown.has(term)) due = true
      before = now
      if (s.fate.state !== "playing") due = false
      if (card && host.away()) takeDown(false)
      if (due && !card && !host.away() && !host.busy()) {
        if (signupMemory.allowed()) putUp()
        else due = false
      }
    },
    /** Esc: puts the card away, if it is up. */
    escape: (): boolean => {
      if (!card) return false
      signupMemory.closed()
      takeDown(true)
      return true
    },
    isOpen: () => card !== null
  }
}
