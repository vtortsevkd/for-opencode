---
name: fis-ui-electron-testing
description: Electron UI testing on FIS — Playwright _electron, the two-runtime model (main/renderer/IPC), IPC mocking, stable selectors, and task analysis. Activate for any Electron-based UI test or when driving the FIS desktop client.
metadata:
  origin: FIS
---

# FIS Electron UI Testing

Electron apps run TWO JavaScript runtimes. Tests must target the right layer, or they flake.

## The two-runtime model

| Layer | Runtime | Test surface |
|---|---|---|
| main | Node.js (OS + REST) | `app.evaluate(({ app, ipcMain }) => ...)` |
| renderer | Chromium (DOM) | Playwright `page` / `window` |
| IPC | bridge (`ipcMain` / `ipcRenderer`) | mock at the boundary |

## Toolchain

- `playwright` `_electron` — launch + drive the app (standard since 2022; Spectron is dead).
- `@playwright/test` — runner, retries, trace.
- `@axe-core/playwright` — accessibility + semantic selectors.
- `pywinauto` — native dialogs (file picker, alert) that Playwright can't see.

## Task analysis (before writing a test)

1. **Which layer?** renderer / main / IPC / external REST?
2. **What to mock?** REST, MCP, external services — anything non-deterministic.
3. **Which selector?** `data-testid`, else ARIA role; never `.css-xyz`.
4. **What flakes?** animations, network, timing — wait on state, not timers.
5. **Native dialog?** file picker / alert → pywinauto.

## Patterns

Launch + drive:

```js
import { _electron as electron } from 'playwright'
const app = await electron.launch({ args: ['dist/main.js'], env: { FIS_MOCK: '1' } })
const win = await app.firstWindow()
await win.getByRole('button', { name: 'Создать' }).click()
```

Mock at the IPC boundary (renderer isolated from platform):

```js
await app.evaluate(({ ipcMain }) => {
  ipcMain.handle('fis:readObject', () => ({ id: 'Contractor_001' }))
})
```

Multi-window (modal):

```js
const modal = await app.waitForEvent('window')
```

## Deterministic grading

Wire `ctx.tools.runUiScenario` to a Playwright+Electron run that returns `{ ok, detail }`. The `code:ui_scenario` grader then returns `pass`/`fail` — a deterministic judge, not an LLM rubric. See `lib/pipeline/judges/code.js` and the `ui_flow` entry in `registry`.

## IPC Contract Tests (the cheap, undervalued layer)

Before any E2E scenario, test each `ipcMain.handle` contract deterministically — no app launch needed:

```js
// main process, test mode
await app.evaluate(({ ipcMain }) => {
  ipcMain.handle('fis:readObject', (event, id) => {
    if (!isTrustedSender(event.senderFrame?.url)) throw new Error('untrusted sender')
    return readObject(id) // returns the { status, summary, ... } envelope
  })
})
```

Contract assertions:
- valid `id` → returns the tool envelope (`status: success`, `summary`, `next_actions`).
- invalid / empty `id` → fail-closed (no side effect).
- untrusted sender origin → rejected.

These tests are fast, deterministic, and catch backend wiring bugs before the UI is even involved. They are a `code` grader target, not an LLM rubric.

## Anti-Patterns

- Testing the wrong layer (renderer bug asserted in the main process).
- Hitting real FIS/REST instead of mocking at IPC.
- `sleep` instead of waiting on state.
- Brittle selectors (`.css-xyz`, positional XPath).
- Assuming Playwright sees native dialogs.

## Related

- `fis-ui-testing` — scenario definition and selector strategy.
- `fis-platform` — safe vs dangerous operations.
