/**
 * PupilSafe AI — Manifest V3 Background Service Worker
 *
 * Routes messages between the PupilSafe web app tab and AI provider tabs
 * (ChatGPT, Claude, Copilot). Tracks tab lifecycle so prompts and responses
 * flow reliably even when tabs are opened, closed, or switched.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {number|null} Tab ID of the PupilSafe web app */
let pupilsafeTabId = null;

/** @type {number|null} Currently active AI provider tab */
let aiTabId = null;

/** @type {Set<number>} All registered AI provider tab IDs */
const aiTabIds = new Set();

/** @type {object|null} Prompt queued while no AI tab is available */
let pendingPrompt = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deliver a prompt message to the current AI tab.
 * On failure the prompt is stashed for later delivery.
 */
function deliverPrompt(prompt) {
  if (!aiTabId) {
    pendingPrompt = prompt;
    return;
  }

  chrome.tabs.sendMessage(aiTabId, prompt).then(() => {
    pendingPrompt = null;
    // Focus the AI tab so the user sees the injection happen
    chrome.tabs.update(aiTabId, { active: true }).catch(() => {});
  }).catch(() => {
    // AI tab not ready — stash for retry on next load
    pendingPrompt = prompt;
  });
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    // -- PupilSafe web app announces itself ---------------------------------
    case 'REGISTER_PUPILSAFE': {
      pupilsafeTabId = sender.tab.id;
      sendResponse({ ok: true });
      break;
    }

    // -- AI provider content script announces itself ------------------------
    case 'REGISTER_AI_TAB': {
      const tabId = sender.tab.id;
      aiTabIds.add(tabId);
      aiTabId = tabId;
      sendResponse({ ok: true });

      // If a prompt was queued before the AI tab existed, deliver it now
      if (pendingPrompt) {
        deliverPrompt(pendingPrompt);
      }
      break;
    }

    // -- PupilSafe sends an anonymised prompt to inject ---------------------
    case 'PROMPT_READY': {
      if (aiTabId) {
        chrome.tabs.sendMessage(aiTabId, message).then(() => {
          pendingPrompt = null;
          // Bring the AI tab into view
          chrome.tabs.update(aiTabId, { active: true }).catch(() => {});
        }).catch(() => {
          // Delivery failed — stash for later
          pendingPrompt = message;
        });
      } else {
        pendingPrompt = message;
      }
      sendResponse({ ok: true });
      break;
    }

    // -- AI content script sends back the AI response -----------------------
    case 'RESPONSE_CAPTURED': {
      if (pupilsafeTabId) {
        chrome.tabs.sendMessage(pupilsafeTabId, message).catch(() => {
          // PupilSafe tab may have been closed — swallow error
        });
      }
      sendResponse({ ok: true });
      break;
    }

    // -- Either side asks for current connection status ---------------------
    case 'STATUS_CHECK': {
      sendResponse({
        type: 'STATUS_RESPONSE',
        pupilsafeOpen: pupilsafeTabId !== null,
        aiTabOpen: aiTabId !== null,
      });
      break;
    }

    // -- AI content script requests focus back to PupilSafe -----------------
    case 'FOCUS_PUPILSAFE_TAB': {
      if (pupilsafeTabId) {
        chrome.tabs.update(pupilsafeTabId, { active: true }).then((tab) => {
          if (tab && tab.windowId) {
            chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
          }
        }).catch(() => {});
      }
      sendResponse({ ok: true });
      break;
    }

    // -- Acknowledgement-only messages --------------------------------------
    case 'RESPONSE_RECEIVED': {
      sendResponse({ ok: true });
      break;
    }
  }

  // Return true to keep the message channel open for async sendResponse calls
  return true;
});

// ---------------------------------------------------------------------------
// Tab lifecycle events
// ---------------------------------------------------------------------------

/**
 * Clean up state when any tracked tab is closed.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === pupilsafeTabId) {
    pupilsafeTabId = null;
  }

  if (aiTabIds.has(tabId)) {
    aiTabIds.delete(tabId);
  }

  if (tabId === aiTabId) {
    aiTabId = null;
  }
});

/**
 * When the active AI tab finishes loading and there is a pending prompt,
 * deliver it automatically.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === aiTabId && changeInfo.status === 'complete' && pendingPrompt) {
    deliverPrompt(pendingPrompt);
  }
});

/**
 * When the user switches to a known AI tab, promote it to the active AI tab.
 */
chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (aiTabIds.has(tabId)) {
    aiTabId = tabId;
  }
});
