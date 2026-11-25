---
name: fis-acceptance
description: Acceptance checklist and the "getting up to speed" ritual — read acceptance.json + decision journal, verify current state, work on one item, flip to passing only after end-to-end verification, leave a clean state. Activate at the start and end of every stage/session.
metadata:
  origin: FIS
---

# FIS Acceptance Ledger & Getting Up To Speed

Every task has a canonical acceptance checklist (`acceptance.json`), each criterion marked `passes: false` until verified end-to-end. The agent may only flip `false → true`; the list itself is immutable (no add/remove/edit of items). This prevents "declaring victory too early".

## When to Activate

- Start of every stage/session (before doing work).
- End of every stage/session (before closing it).

## Ritual — Getting Up To Speed (start of stage)

Run these BEFORE making changes, so you don't build on a broken state:

1. Confirm the working directory.
2. Read `acceptance.json` (pending criteria) and `decisions.jsonl` (what was decided before).
3. Read git log / progress notes to see recent work.
4. Run a smoke check of the CURRENT state (run tests / verify the function still works) before touching anything.

## Ritual — Clean State (end of stage)

1. Make only the intended change (one acceptance item at a time).
2. Verify it end-to-end (create → read back; run the function and compare; UI scenario).
3. Only after verification, flip the item to `passes: true` (see `lib/pipeline/acceptance.js`).
4. Commit with a descriptive message + write a progress note.

## Rules

- The checklist is JSON, not Markdown — the model is less likely to overwrite it.
- It is unacceptable to remove or edit acceptance items. Only flip `passes`.
- A stage is not complete while it still owns pending acceptance items.

## Anti-Patterns

- Marking an item `passes: true` without end-to-end verification.
- Adding/removing items to make the task look done.
- Starting new work without checking that the current state is clean.

## Related

- `fis-platform` — safe vs dangerous operations.
- `fis-crud` — object lifecycle checklist.
