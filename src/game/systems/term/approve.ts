import { approvalTarget, nextApproval } from "../../rules/approval.ts"
import { stepsOf } from "../../content/index.ts"
import { Charter, Crown, Game, Rules, House, Mood, Paused, Policy, Rising, Site, Time, Treasury } from "../../schema.ts"
import { elapsed, seasonAt } from "../shared.ts"

/**
 * What the town makes of how it is run, every collection: its needs, its
 * taxes, unpaid wages, snubs from the crown, a hungry winter. Approval
 * moves towards that a few points at a time.
 */
export const Approve = Game.System(
  "Town/Approve",
  {
    queries: { homes: Game.Query({ selection: { house: Game.Query.read(House) }, without: [Site, Rising, Paused] }) },
    resources: {
      time: Game.System.readResource(Time),
      charter: Game.System.readResource(Charter),
      policy: Game.System.readResource(Policy),
      treasury: Game.System.readResource(Treasury),
      crown: Game.System.readResource(Crown),
      mood: Game.System.writeResource(Mood)
    },
    services: { rules: Game.System.service(Rules) }
  },
  ({ queries, resources, services }) => {
    const rules = services.rules

    const t = elapsed(resources.time.get(), resources.charter.get())
    if (t % stepsOf(10) !== 0) return
    const policy = resources.policy.get()
    const m = resources.mood.get()
    const parts = approvalTarget(queries.homes.each().map(({ data }) => data.house.get()), policy,
      resources.treasury.get().coins, resources.crown.get().snubs.length, seasonAt(t, resources.charter.get(), rules).winter, rules, m.memory)
    resources.mood.set({ approval: nextApproval(m.approval, parts.target, rules), ...parts })

  }
)
