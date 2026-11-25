---
name: fis-ui-testing
description: UI testing of FIS screens — scenarios, stable selectors, and result verification. Activate when a task requires verifying FIS UI behavior or a user-visible flow.
metadata:
  origin: FIS
---

# FIS UI Testing

UI tests verify user-visible behavior end-to-end. They run against the local checkout where possible, with a stable, semantic selection strategy.

## Workflow

1. **Define the scenario** as a user journey: given → when → then.
2. **Use stable selectors** — data-testid or semantic roles (`button`, `input[name=...]`) over CSS class names or positional XPath.
3. **Wait for state, not time** — wait for the specific element/response, not arbitrary `sleep`.
4. **Assert the user-visible result** — the text/state the user actually sees.

## Scenario Checklist

- Login / auth state (if the flow requires it).
- Create / edit / search a screen.
- Empty and error states (not just the happy path).
- No side effects on the platform (UI tests are read-only unless explicitly scoped).

## Anti-Patterns

- Brittle selectors (`div > div > .css-xyz`) that break on any markup change.
- Arbitrary timeouts instead of waiting for a condition.
- Asserting internal state instead of what the user sees.
- UI tests that mutate production data without confirmation.

## Related

- `fis-search-testing` — deterministic search verification.
- `fis-crud` — object lifecycle the UI exercises.
