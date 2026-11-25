---
name: fis-initializer
description: Initializer stage — scaffold the task environment (acceptance.json, decisions.jsonl, progress.json, init.sh) and run a smoke test before any implementation. Activate at the very first stage of every task.
metadata:
  origin: FIS
---

# FIS Initializer Stage

The first stage of every task scaffolds the environment so later stages start from a clean, well-understood state. This is deterministic, not ad hoc.

## What to produce

1. `acceptance.json` — canonical checklist (all `passes: false`), via `initTask()`.
2. `decisions.jsonl` — empty journal.
3. `progress.json` — task metadata + note log.
4. `init.sh` — script to bring up the local checkout + run a smoke test.
5. Initial git commit.

## Ritual

1. Run `initTask(taskDir, { taskId, taskFamily, criteria })` (see `lib/pipeline/initializer.js`).
2. Write `init.sh` that starts the local checkout.
3. Run the smoke test — verify the app/function is in a working state.
4. Commit the scaffold.
5. Read the acceptance checklist and pick the first pending criterion.

## Anti-Patterns

- Starting implementation before the environment is scaffolded.
- Skipping the smoke test (later stages then build on a broken state).
- Leaving the environment dirty (no commit / no progress note) for the next stage.

## Related

- `fis-acceptance` — the checklist and getting-up-to-speed ritual.
- `fis-platform` — safe vs dangerous operations.
