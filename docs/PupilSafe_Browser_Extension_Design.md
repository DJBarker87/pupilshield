# PupilSafe AI Browser Extension — Design Document v1.0

**Author:** Dom Barker  
**Date:** March 2026  
**Version:** 1.0  
**Status:** Ready for build  
**Parent spec:** PupilSafe AI Product Design Document v2.1

---

## Purpose

The PupilSafe AI browser extension eliminates the tab-switching and copy-paste friction in the current workflow. Today, a teacher using PupilSafe AI performs seven discrete steps to complete a round-trip: copy the prompt, click an AI link, paste the prompt, wait for the response, copy the response, switch back to PupilSafe, paste, and click de-anonymise. Every step is a drop-off point.

The extension reduces this to a fluid three-step flow: click "Send to AI" in PupilSafe → paste into the AI (Ctrl+V) → click "Send back to PupilSafe" on the AI page. The teacher never manually switches tabs or copies the AI response.

**Design philosophy:** Clipboard bridge, not DOM injection. The extension never manipulates the internal DOM of ChatGPT, Claude, or Copilot. It communicates via the system clipboard and browser messaging APIs. This makes it robust against AI provider UI changes — when ChatGPT ships a redesign, the extension keeps working because it never depended on ChatGPT's markup.

---

## Supported Platforms

| Browser | Extension API | Store |
|---------|--------------|-------|
| Chrome | Manifest V3 | Chrome Web Store |
| Firefox | Manifest V3 (with WebExtensions polyfill) | Firefox Add-ons (AMO) |
| Edge | Manifest V3 (Chromium-based, same as Chrome) | Microsoft Edge Add-ons |

A single codebase targets all three. Chrome and Edge share identical Manifest V3; Firefox requires the `browser_specific_settings` key in the manifest and minor API differences handled by `webextension-polyfill`.

---

## Architecture

### Components

```
pupilsafe-extension/
├── manifest.json              # Manifest V3 (Chrome/Edge), with Firefox overrides
├── background.js              # Service worker: message routing between tabs
├── content-scripts/
│   ├── pupilsafe-bridge.js    # Injected into pupilsafe.co.uk — listens for prompt-ready events
│   └── ai-panel.js            # Injected into AI provider pages — renders floating panel
├── ai-panel.css               # Styles for the floating panel (small, unobtrusive)
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── popup/
│   ├── popup.html             # Minimal popup: status + settings
│   └── popup.js
└── _locales/                  # (optional) i18n
```

### Data Flow

```
┌──────────────────┐                          ┌──────────────────┐
│   PupilSafe AI   │                          │   AI Provider    │
│   (browser tab)  │                          │   (browser tab)  │
│                  │                          │                  │
│  [Send to AI] ───┼──── message ────────────→│  Panel appears:  │
│                  │  (via background.js)     │  "Prompt ready!  │
│                  │                          │   Paste now."    │
│                  │                          │                  │
│                  │                          │  Teacher pastes  │
│                  │                          │  (Ctrl+V / ⌘V)  │
│                  │                          │                  │
│                  │                          │  AI generates    │
│                  │                          │  response...     │
│                  │                          │                  │
│  Response lands  │                          │  Teacher selects │
│  in paste-back ←─┼──── message ────────────┤  response, clicks│
│  textarea.       │  (via background.js)    │  [Send back to   │
│                  │                          │   PupilSafe]     │
│  Auto-triggers   │                          │                  │
│  de-anonymise.   │                          └──────────────────┘
└──────────────────┘
```

### Message Protocol

All communication between tabs uses `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` (via the background service worker). Messages are simple JSON objects with a `type` field.

| Message | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `PROMPT_READY` | PupilSafe → background → AI tab | `{ type: "PROMPT_READY", prompt: string }` | Prompt has been copied to clipboard; notify the AI tab |
| `PROMPT_ACKNOWLEDGED` | AI tab → background → PupilSafe | `{ type: "PROMPT_ACKNOWLEDGED" }` | AI tab confirms it received the notification |
| `RESPONSE_CAPTURED` | AI tab → background → PupilSafe | `{ type: "RESPONSE_CAPTURED", response: string }` | Teacher has selected and sent back the AI response |
| `RESPONSE_RECEIVED` | PupilSafe → background → AI tab | `{ type: "RESPONSE_RECEIVED" }` | PupilSafe confirms it received the response |
| `STATUS_CHECK` | Any → background | `{ type: "STATUS_CHECK" }` | Check if the other tab is open and connected |
| `STATUS_RESPONSE` | background → requester | `{ type: "STATUS_RESPONSE", pupilsafeOpen: bool, aiTabOpen: bool }` | Current connection status |

---

## Component Details

### 1. PupilSafe Bridge (`pupilsafe-bridge.js`)

**Injected into:** `*://pupilsafe.co.uk/*`, `*://www.pupilsafe.co.uk/*`, `*://localhost:*/*` (for dev)

**What it does:**

This content script bridges the PupilSafe AI web app and the extension. It listens for a custom DOM event from the Svelte app and forwards it to the background worker. It also receives the AI response back and injects it into the paste-back textarea.

**Integration with SplitView.svelte:**

The existing "Copy prompt" button in SplitView stays as-is (for teachers without the extension). A new "Send to AI" button appears *only when the extension is detected*. The Svelte app detects the extension by listening for a `PUPILSAFE_EXTENSION_READY` custom event that the content script dispatches on load.

```javascript
// pupilsafe-bridge.js

// Signal to the web app that the extension is installed
window.dispatchEvent(new CustomEvent('PUPILSAFE_EXTENSION_READY'));

// Listen for the web app's "send to AI" action
window.addEventListener('PUPILSAFE_SEND_PROMPT', (event) => {
  const { prompt } = event.detail;
  
  // Copy to clipboard (the web app already does this, but belt-and-braces)
  navigator.clipboard.writeText(prompt).catch(() => {
    // Clipboard write may fail; the web app's own copy is the primary
  });
  
  // Forward to background worker
  chrome.runtime.sendMessage({
    type: 'PROMPT_READY',
    prompt: prompt
  });
});

// Listen for response coming back from AI tab
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RESPONSE_CAPTURED') {
    // Inject response into the web app
    window.dispatchEvent(new CustomEvent('PUPILSAFE_RESPONSE_RECEIVED', {
      detail: { response: message.response }
    }));
    
    // Confirm receipt
    chrome.runtime.sendMessage({ type: 'RESPONSE_RECEIVED' });
  }
});
```

**Changes to SplitView.svelte:**

```svelte
<script>
  let extensionDetected = false;
  
  // Detect extension on mount
  onMount(() => {
    window.addEventListener('PUPILSAFE_EXTENSION_READY', () => {
      extensionDetected = true;
    });
    
    // Listen for response from extension
    window.addEventListener('PUPILSAFE_RESPONSE_RECEIVED', (event) => {
      aiResponseText = event.detail.response;
      // Optionally auto-trigger de-anonymisation
    });
  });
  
  function sendToAI() {
    window.dispatchEvent(new CustomEvent('PUPILSAFE_SEND_PROMPT', {
      detail: { prompt: assembledPrompt }
    }));
    promptSentViaExtension = true;
  }
</script>

<!-- Existing copy button always visible -->
<button on:click={copyPrompt}>Copy prompt</button>

<!-- Extension button appears only when detected -->
{#if extensionDetected}
  <button on:click={sendToAI} class="extension-send-btn">
    Send to AI ⚡
  </button>
{/if}
```

### 2. AI Panel (`ai-panel.js` + `ai-panel.css`)

**Injected into:** `*://chatgpt.com/*`, `*://chat.openai.com/*`, `*://claude.ai/*`, `*://copilot.microsoft.com/*`

**What it does:**

Renders a small, draggable floating panel in the bottom-right corner of the AI provider page. The panel has two states: "waiting for prompt" and "ready to send back." It never touches the AI provider's DOM beyond its own panel container.

**Panel states:**

#### State 1: Idle (no prompt pending)

Small minimised pill showing the PupilSafe logo and "Connected" text. Stays out of the way. Teacher can drag it to reposition. Clicking expands to show a brief status message.

```
┌─────────────────────────┐
│ 🛡️ PupilSafe · Connected │
└─────────────────────────┘
```

#### State 2: Prompt Ready (after PROMPT_READY message received)

Panel expands with a gentle animation. Shows a clear instruction and a visual cue.

```
┌─────────────────────────────────────┐
│ 🛡️ PupilSafe                    ─  │
│                                     │
│  ✅ Prompt copied to clipboard!     │
│                                     │
│  Paste it into the chat below       │
│  (Ctrl+V / ⌘V)                     │
│                                     │
│  Then wait for the AI to respond.   │
└─────────────────────────────────────┘
```

#### State 3: Ready to Capture (teacher clicks to indicate AI has responded)

After the teacher has pasted and the AI has responded, they need to get the response back to PupilSafe. The panel shows:

```
┌─────────────────────────────────────┐
│ 🛡️ PupilSafe                    ─  │
│                                     │
│  AI responded? Select the response  │
│  text, then:                        │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Send response to PupilSafe  │  │
│  └───────────────────────────────┘  │
│                                     │
│  Or: paste any copied text back:    │
│  ┌───────────────────────────────┐  │
│  │   Use clipboard instead       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Two capture methods (critical for reliability):**

1. **Selection-based (primary):** Teacher selects the AI response text on the page, then clicks "Send response to PupilSafe." The extension reads `window.getSelection().toString()` — no DOM parsing needed. This works regardless of how the AI provider structures its output.

2. **Clipboard-based (fallback):** Teacher copies the AI response manually (Ctrl+C), then clicks "Use clipboard instead." The extension reads from the clipboard. This covers cases where selection is awkward (e.g., the AI produced a table that doesn't select cleanly).

Both methods send a `RESPONSE_CAPTURED` message to the background worker, which forwards it to the PupilSafe tab.

#### State 4: Sent (confirmation)

```
┌─────────────────────────────────────┐
│ 🛡️ PupilSafe                    ─  │
│                                     │
│  ✅ Sent to PupilSafe!              │
│                                     │
│  Switch back to de-anonymise.       │
│  (Or we'll open the tab for you.)   │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Open PupilSafe tab          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

After confirmation, the "Open PupilSafe tab" button focuses the PupilSafe tab (using `chrome.runtime.sendMessage` → background worker → `chrome.tabs.update` to bring it to front). The panel minimises back to the idle pill after 3 seconds.

**Panel implementation notes:**

- The panel is injected as a shadow DOM element to prevent style conflicts with the AI provider's page. All styles are scoped within the shadow root.
- Panel position is remembered in `chrome.storage.local` so the teacher doesn't have to reposition it every session.
- The panel has a "minimise" button (the `─` in the top right) that collapses it back to the pill. It re-expands automatically when a new `PROMPT_READY` arrives.
- The panel uses a high z-index (2147483647) to sit above AI provider UI.

### 3. Background Service Worker (`background.js`)

**What it does:**

Routes messages between the PupilSafe tab and the AI provider tab. Maintains awareness of which tabs are open and connected.

```javascript
// background.js

let pupilsafeTabId = null;
let aiTabId = null;

// Track which tabs have our content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderTabId = sender.tab?.id;
  
  switch (message.type) {
    case 'REGISTER_PUPILSAFE':
      pupilsafeTabId = senderTabId;
      sendResponse({ ok: true });
      break;
      
    case 'REGISTER_AI_TAB':
      aiTabId = senderTabId;
      sendResponse({ ok: true });
      break;
      
    case 'PROMPT_READY':
      // Forward from PupilSafe to AI tab
      if (aiTabId) {
        chrome.tabs.sendMessage(aiTabId, message)
          .catch(() => {
            // AI tab closed or not ready — store for when it opens
            pendingPrompt = message;
          });
      } else {
        // No AI tab open yet — store the prompt
        pendingPrompt = message;
      }
      break;
      
    case 'RESPONSE_CAPTURED':
      // Forward from AI tab to PupilSafe
      if (pupilsafeTabId) {
        chrome.tabs.sendMessage(pupilsafeTabId, message)
          .catch(() => {
            // PupilSafe tab closed — can't deliver
            // Show notification? Store for later?
          });
      }
      break;
      
    case 'STATUS_CHECK':
      sendResponse({
        type: 'STATUS_RESPONSE',
        pupilsafeOpen: pupilsafeTabId !== null,
        aiTabOpen: aiTabId !== null
      });
      break;
      
    case 'FOCUS_PUPILSAFE_TAB':
      if (pupilsafeTabId) {
        chrome.tabs.update(pupilsafeTabId, { active: true });
      }
      break;
  }
  
  return true; // Keep message channel open for async response
});

// Clean up when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === pupilsafeTabId) pupilsafeTabId = null;
  if (tabId === aiTabId) aiTabId = null;
});

// Deliver pending prompt when AI tab opens
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === aiTabId && changeInfo.status === 'complete' && pendingPrompt) {
    chrome.tabs.sendMessage(tabId, pendingPrompt)
      .then(() => { pendingPrompt = null; })
      .catch(() => {});
  }
});
```

### 4. Extension Popup (`popup.html` / `popup.js`)

Minimal popup accessed by clicking the extension icon in the toolbar. Shows:

- Connection status: "PupilSafe tab: ✅ Open" / "AI tab: ✅ ChatGPT connected"
- Quick link to open PupilSafe AI if not already open
- Version number
- Link to pupilsafe.co.uk

This is intentionally minimal. The popup is not the primary UI — the floating panel on the AI page is. The popup exists for status checking and troubleshooting.

---

## Manifest

```json
{
  "manifest_version": 3,
  "name": "PupilSafe AI",
  "version": "1.0.0",
  "description": "Bridges PupilSafe AI with your AI assistant. Anonymised prompts in, de-anonymised responses back — no tab switching.",
  "permissions": [
    "activeTab",
    "clipboardRead",
    "clipboardWrite",
    "storage"
  ],
  "host_permissions": [
    "*://pupilsafe.co.uk/*",
    "*://www.pupilsafe.co.uk/*",
    "*://chatgpt.com/*",
    "*://chat.openai.com/*",
    "*://claude.ai/*",
    "*://copilot.microsoft.com/*",
    "*://localhost/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://pupilsafe.co.uk/*", "*://www.pupilsafe.co.uk/*", "*://localhost/*"],
      "js": ["content-scripts/pupilsafe-bridge.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "*://chatgpt.com/*",
        "*://chat.openai.com/*",
        "*://claude.ai/*",
        "*://copilot.microsoft.com/*"
      ],
      "js": ["content-scripts/ai-panel.js"],
      "css": ["ai-panel.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "extension@pupilsafe.co.uk",
      "strict_min_version": "109.0"
    }
  }
}
```

---

## Privacy Constraints

The extension handles anonymised prompts and AI responses. These may contain fake student names, noised scores, and AI-generated text. While this data is already anonymised, the extension should still be privacy-conscious:

1. **No data leaves the browser.** Messages pass between tabs via the browser's internal messaging API. Nothing is sent to any server. No analytics, no telemetry, no error reporting.

2. **No persistent storage of prompts or responses.** The extension uses `chrome.storage.local` only for panel position and UI preferences. Prompt text and response text are held in memory only and discarded when tabs close.

3. **No content script on pages other than the four AI providers and PupilSafe itself.** The extension does not inject into any other website.

4. **Clipboard access is user-initiated only.** The extension reads the clipboard only when the teacher clicks "Use clipboard instead." It writes to the clipboard only as part of the "Send to AI" action (belt-and-braces alongside the web app's own clipboard write). Both are direct responses to explicit user actions, never background operations.

5. **The Chrome Web Store listing states clearly:** "This extension passes data between your PupilSafe AI tab and your AI assistant tab. No data is sent to any server. No data is stored. The extension works entirely within your browser."

---

## UX Flow (Teacher's Perspective)

### First Time

1. Teacher installs the extension from the Chrome Web Store (linked from the PupilSafe AI site).
2. Teacher opens PupilSafe AI and goes through the normal flow: paste data, anonymise, choose template, generate prompt.
3. At the SplitView step, a new "Send to AI ⚡" button appears alongside the existing "Copy prompt" button. A small tooltip says "New! PupilSafe extension detected — send your prompt directly."
4. Teacher clicks "Send to AI ⚡" — the prompt is copied to clipboard and a notification is queued for the AI tab.
5. Teacher clicks the "ChatGPT" / "Claude" / "Copilot" link (opens in new tab as before).
6. On the AI page, the PupilSafe floating panel appears in the bottom-right: "✅ Prompt copied! Paste it below (Ctrl+V)."
7. Teacher pastes into the AI chat input and sends.
8. AI generates its response.
9. Teacher selects the AI response text (or copies it).
10. Teacher clicks "Send response to PupilSafe" on the floating panel.
11. Panel shows "✅ Sent!" with an "Open PupilSafe tab" button.
12. Teacher clicks the button (or manually switches tabs). The response is already in the paste-back textarea. De-anonymise button is ready.

### Repeat Use

Steps 4–12 become muscle memory. The extension reduces the cognitive load from "remember to copy, remember which tab, remember to paste" to "click Send, paste, click Send back."

### Without the Extension

The existing flow (copy prompt, open AI tab, paste, copy response, switch back, paste) continues to work identically. The extension is a convenience layer, not a requirement. The "Copy prompt" button and the paste-back textarea never go away.

---

## Edge Cases and Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Teacher clicks "Send to AI" but no AI tab is open yet | Prompt is stored in background worker. When teacher opens an AI tab, the panel appears with "Prompt ready — paste now." |
| AI tab is open but on a different AI provider than expected | The panel appears on whichever AI provider tab is registered. If multiple AI tabs are open, the most recently focused one receives the prompt notification. |
| Teacher closes the PupilSafe tab before sending response back | Panel shows a warning: "PupilSafe tab not found. Please reopen PupilSafe AI to receive the response." The response text is held in memory until the PupilSafe tab reopens. |
| Teacher closes the AI tab before sending response back | No issue — teacher can still manually copy/paste the response into PupilSafe's paste-back textarea. The extension is a convenience, not a dependency. |
| Multiple PupilSafe tabs open | Background worker tracks the most recently registered one. Only one PupilSafe tab is "active" at a time. |
| Teacher uses "Send to AI" for a second prompt before completing the first round-trip | New prompt replaces the pending one. Panel updates to show the new prompt notification. Previous prompt is discarded (the teacher can always re-copy from PupilSafe). |
| Selection-based capture returns empty text | Panel shows: "No text selected. Try selecting the response again, or use the clipboard button instead." |
| Clipboard read fails (permission denied) | Panel shows: "Clipboard access denied. Please select the text and use the 'Send response' button instead." Fallback to selection-based capture. |
| AI provider page has an unusually high z-index element covering the panel | Teacher can drag the panel to a different position. The drag position persists across sessions. |

---

## Multiple AI Tabs

Teachers might have ChatGPT, Claude, and Copilot open simultaneously. The background worker handles this by tracking the most recently focused AI tab as the "active" one.

**Tab priority logic:**

1. When a content script registers on an AI page (`REGISTER_AI_TAB`), it becomes the active AI tab.
2. If multiple AI tabs are open, the background worker listens for `chrome.tabs.onActivated` and updates `aiTabId` to the most recently focused AI provider tab.
3. `PROMPT_READY` messages are sent to the active AI tab only. All other AI tabs show the idle pill.
4. Any AI tab can send `RESPONSE_CAPTURED` — regardless of which one received the prompt notification. This handles the case where a teacher pastes the prompt into a different AI than the one they originally opened.

---

## Build and Distribution

### Build Tooling

No build step required for MVP. The extension is vanilla JavaScript with no framework dependencies. The content scripts and background worker are plain JS files. If the panel UI grows more complex later, a lightweight build step (esbuild) can be added.

### Distribution

| Store | Review time | Cost | Notes |
|-------|------------|------|-------|
| Chrome Web Store | 1–3 days | $5 one-time developer fee | Covers Chrome + Edge (Edge can install from CWS) |
| Firefox Add-ons (AMO) | 1–5 days | Free | Requires the `browser_specific_settings` block in manifest |
| Edge Add-ons | 1–7 days | Free | Can also sideload from CWS; dedicated listing is better for discoverability |

**Publish to Chrome Web Store first** — this covers Chrome and Edge users immediately (Edge can install Chrome extensions). Firefox listing follows.

### Versioning

Extension version tracks independently from PupilSafe AI. The message protocol (`PROMPT_READY`, `RESPONSE_CAPTURED`, etc.) is the contract between the extension and the web app. As long as both sides speak the same message types, they're compatible. If the protocol ever needs to change, include a `protocolVersion` field in messages and handle gracefully.

---

## Changes to PupilSafe AI Web App

The web app needs minimal changes to support the extension:

### SplitView.svelte Modifications

1. **Extension detection:** Listen for the `PUPILSAFE_EXTENSION_READY` custom event. Set a boolean flag. Show the "Send to AI ⚡" button conditionally.

2. **Send prompt via extension:** Dispatch a `PUPILSAFE_SEND_PROMPT` custom event with the assembled prompt as detail. The content script picks it up.

3. **Receive response from extension:** Listen for `PUPILSAFE_RESPONSE_RECEIVED` custom event. Populate the paste-back textarea with the response text. Optionally auto-trigger de-anonymisation (with a brief "Response received from extension — de-anonymising..." status message).

4. **Status indicator:** A small "🛡️ Extension connected" badge in the SplitView header when the extension is detected. Helps the teacher understand why the extra button appeared.

### No Other Changes Required

The landing page, privacy page, anonymisation engine, prompt system, and de-anonymisation logic are completely unaffected. The extension is a pure UX layer on top of the existing SplitView.

---

## Testing Plan

### Manual Testing Matrix

| Test | Chrome | Firefox | Edge |
|------|--------|---------|------|
| Extension installs and content scripts load | | | |
| PupilSafe detects extension (button appears) | | | |
| "Send to AI" copies prompt and notifies AI tab | | | |
| Panel appears on ChatGPT with prompt notification | | | |
| Panel appears on Claude with prompt notification | | | |
| Panel appears on Copilot with prompt notification | | | |
| Selection-based capture works | | | |
| Clipboard-based capture works | | | |
| Response arrives in PupilSafe paste-back textarea | | | |
| "Open PupilSafe tab" focuses correct tab | | | |
| Panel drag-to-reposition persists | | | |
| Panel minimise/expand works | | | |
| AI tab opened before "Send to AI" (pending prompt) | | | |
| AI tab closed mid-flow (graceful fallback) | | | |
| PupilSafe tab closed mid-flow (warning shown) | | | |
| Multiple AI tabs open (correct routing) | | | |
| Extension disabled: PupilSafe works normally without it | | | |

### Key Regression Test

With the extension disabled or uninstalled, the existing SplitView flow (copy prompt → manual paste → manual copy → manual paste back) must work identically to how it works today. The extension is additive only.

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Background worker + message protocol | 1 day | Message routing between tabs, tab tracking |
| 2. PupilSafe bridge content script | 0.5 days | Extension detection, prompt dispatch, response receipt |
| 3. AI panel content script + CSS | 2 days | Floating panel with all four states, shadow DOM, drag, minimise |
| 4. SplitView.svelte integration | 0.5 days | Extension detection, "Send to AI" button, response listener |
| 5. Popup | 0.5 days | Status display, links |
| 6. Cross-browser testing | 1 day | Chrome, Firefox, Edge manual testing matrix |
| 7. Chrome Web Store submission | 0.5 days | Listing, screenshots, description, review |
| **Total** | **~6 days** | **Extension live on Chrome Web Store + Firefox AMO** |

---

## Future Enhancements (Post v1.0)

These are explicitly out of scope for v1.0 but noted for later consideration:

1. **Auto-detect AI response completion.** Monitor the page for the AI "stop generating" state (without DOM injection — use MutationObserver on broad container elements). When detected, automatically transition the panel from "waiting" to "ready to capture." This is the single biggest UX improvement after v1.0, but it requires per-provider detection logic that may break with UI updates. Evaluate stability before shipping.

2. **Auto-paste prompt into AI input.** Instead of "paste now (Ctrl+V)", programmatically paste into the AI input field. Requires finding the input element on each provider's page — fragile. The clipboard approach is better for v1.0.

3. **Keyboard shortcuts.** Ctrl+Shift+S to send prompt, Ctrl+Shift+R to send response back. Registered via `chrome.commands` in the manifest.

4. **Badge count.** Show a "1" badge on the extension icon when a prompt is pending or a response is ready. Uses `chrome.action.setBadgeText`.

5. **Multiple round-trips.** Support multiple prompt/response cycles in a single session (e.g., teacher sends a follow-up prompt based on the first AI response). Requires a message queue rather than single pending prompt.

6. **Onboarding tooltip.** First time the extension is installed and the teacher opens PupilSafe AI, show a brief animated tooltip pointing to the "Send to AI ⚡" button: "New! Your extension is connected. Click here to send your prompt directly to ChatGPT." Dismiss after first use.
