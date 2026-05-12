# Kinetics — Agent Summary

## Quick Overview
Chrome extension (MV3) enforcing the Cornell 20-8-2 ergonomic posture protocol. Sessions consist of cycles: sit → stand → move, with configurable durations.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest. Permissions: alarms, storage, scripting, activeTab, host_permissions |
| `background.js` | Service worker. Manages posture state machine via chrome.alarms. Injects content scripts dynamically on alarm fire. |
| `content.js` | Injected into pages. Shows modal overlay + plays chime on message from background. Handles Enter/Escape/click-outside dismiss. |
| `content.css` | Styles for the modal overlay (dark theme, blur backdrop, animations). |
| `popup.html` | Popup UI: day/session controls, countdown timers, stats, settings panel. |
| `popup.js` | Popup logic: storage reads, timer updates via 1s interval, settings save/load. |
| `styles.css` | Popup styles (dark theme, gradients, tabular-nums). |
| `fallback.html` | Standalone notification page opened when no injectable tab is available. |
| `icon.png` | Extension icon. |

## Architecture

```
Background (alarm fires)
  → query active tab
  → injectInto(tabId): insertCSS + executeScript
  → sendMessage (fire-and-forget, .catch(() => {}))
  → content.js listener fires
    → playChime() (Web Audio API)
    → showModal(message) (creates overlay, appends to body)
    → sendResponse({ success: true })
```

## Key Behaviors

- **State machine**: onInstalled clears alarms + resets storage. Alarm handler transitions sitting→standing→moving→sitting x3 cycles, then ends session.
- **Settings**: sit/stand/move durations stored in `chrome.storage.local.settings`. Default: 20/8/2. Cycles always 3.
- **Injection**: `chrome.scripting.insertCSS` + `executeScript` on every alarm. Content script guard (`kineticsContentScriptLoaded`) prevents duplicate listeners.
- **Notifications**: sendMessage is fire-and-forget with `.catch`. Modal overlay with z-index max. Chime via Web Audio API (suspended AudioContext handled with try/catch).
- **Fallback**: If no valid tab found, opens `fallback.html?msg=...` via `chrome.tabs.create`.
- **Top-frame only**: Content script checks `window.top === window.self` to skip iframes.

## Data in chrome.storage.local

| Key | Type | Description |
|-----|------|-------------|
| dayActive | boolean | Whether a day is in progress |
| sessionActive | boolean | Whether a session is currently running |
| currentPosture | "sitting"\|"standing"\|"moving"\|null | Current posture phase |
| cycleCount | number | Cycles completed in current session (0-2) |
| sessionStartTime | number | Date.now() when session started |
| postureStartTime | number | Date.now() when current posture started |
| postureDurationMins | number | Duration of current posture (from settings) |
| stats.totalSessions | number | Total sessions today |
| stats.totalSitMins | number | Total minutes sat today |
| stats.totalStandMins | number | Total minutes stood today |
| stats.totalMoveMins | number | Total minutes moved today |
| settings | object | { sitMins, standMins, moveMins, sessionCycles } |

## v2 Changes from v1
- Customizable durations via settings panel (gear icon in popup)
- Audible chime on posture transitions
- Keyboard shortcuts (Enter/Escape) and click-outside to dismiss modals
- Fallback notification page when no injectable tab available
- Full state reset on install and end-day (clears leftover posture/cycle state)
- Stale alarm clearing on session start and in alarm handler

## Known Gotchas
- `host_permissions` required because alarms fire without user gesture (activeTab alone won't work for injection from service worker)
- sendMessage is fire-and-forget — never await it, always `.catch(() => {})` to avoid unhandled rejections
- AudioContext may be suspended on page load — `ctx.resume()` is called but may not always work. Handled with try/catch.
