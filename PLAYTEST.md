# Playtesting with replays

While you play the dev build, the game keeps the last minute of play. When
something looks wrong, save it as a replay: a small file the agent opens
without a browser to see exactly what happened, step by step.

## 1. Start the dev build

This branch pins the Ritmo source commit while the new package names await
publication. Prepare it before installing the game:

```sh
pnpm engine:prepare
pnpm install --frozen-lockfile
pnpm dev
```

Open the address it prints (usually http://localhost:5173). Replays work in
`pnpm dev` only; a production build carries none of this.

## 2. Save a replay

Any of these saves the last minute of play:

- **The button.** Press `\` (backslash) or the "◉ monitor" button in the
  corner to open the Ritmo monitor, then **Save replay**. Do it right after
  you see the problem: the replay holds the last 60 seconds before the press.
- **By itself, when a step fails.** If the simulation fails, a replay is
  saved without you doing anything.
- **By itself, when a rule breaks.** The dev build checks rules after every
  step (today: the treasury always holds a whole number of coins). The first
  time one breaks, a replay is saved.

To try the loop out on purpose, open the game with `?replay-demo` at the end
of the address (http://localhost:5173/?replay-demo). That adds a rule made
to be broken: "fewer than ten buildings". Build until the town has ten, and a
replay is saved.

## 3. Where the file lands

In the terminal running `pnpm dev` you see a line like:

```
[bevy-ts] replay saved: .replays/2026-10-17T12-04-09.512Z-tick-1412.json (1800 ticks): invariant fewer than ten buildings broke at tick 1412: ...
```

The file is in `.replays/` in this folder. It is ignored by git: it is a
debugging aid, not part of the game.

## 4. What to tell the agent

Tell it three things:

1. **The file:** for example `.replays/2026-10-17T12-04-09.512Z-tick-1412.json`.
2. **What you saw:** "the baker's cart walked through the river", "I placed
   a market and the coins did not go down".
3. **Roughly when, if you pressed the button late:** "about ten seconds before
   I saved".

The agent then runs `pnpm replay <file>` to replay it headless, checks that
it replays the same way twice, finds the cause with the journal, cuts the few
steps that show it into a test, fixes it, and deletes the replay.

## For the agent

- `pnpm replay <file>`: replays it, compares the recorded checkpoints, replays
  twice for determinism, and prints the session report.
- `pnpm replay <file> --journal <from>-<to>`: what happened in those ticks.
- `pnpm replay <file> --extract <from>-<to> <out.json>`: a small replay with
  its own start, for building a test. Prefer an ordinary `headless` test when
  the start is easy to rebuild (`test/homes-edit.test.ts` came from one).
- A replay recorded before a schema change fails with "replay recorded with
  an older schema": ask for a new one.
- The recorder is wired in `src/dev/devtools.ts`; the simulation's input is
  the `Edits` source (plain edits), and its messages to the page are the
  `Toast` and `Selection` events.
